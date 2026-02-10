import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  serverTimestamp as firestoreServerTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { onValue, ref, set as rtdbSet } from "firebase/database";
import MetricCard from "../components/MetricCard";
import HumidityPill from "../components/HumidityPill";
import { db, rtdb } from "../firebase";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useActiveSession } from "../context/ActiveSessionContext";

interface LiveData {
  Hum?: number;
  Temp1?: number;
  Temp2?: number;
}

const DEVICE_ID = "dryer-01";
const LIVE_PATH = "Solardryer";
const COMMAND_PATH = `devices/${DEVICE_ID}/command`;
const LOG_INTERVAL_MS = 60_000;
const TIMER_INTERVAL_MS = 1000;

const formatElapsed = (startTimestamp: number) => {
  const diffMs = Date.now() - startTimestamp;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
};

export default function Home() {
  const [liveData, setLiveData] = useState<LiveData>({});
  const [isBusy, setIsBusy] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(true);
  const [elapsedLabel, setElapsedLabel] = useState<string>("00:00");
  const { push } = useToast();
  const { activeSession, startSession, stopSession } = useActiveSession();
  const logTimerRef = useRef<number | null>(null);
  const lastLogRef = useRef<number>(0);

  useEffect(() => {
    const fallback = setTimeout(() => setIsLiveLoading(false), 3000);
    const liveRef = ref(rtdb, LIVE_PATH);
    const unsub = onValue(
      liveRef,
      (snap) => {
        setLiveData((snap.val() as LiveData) || {});
        setIsLiveLoading(false);
        clearTimeout(fallback);
      },
      () => {
        push("Failed to load live sensor data.");
        setIsLiveLoading(false);
        clearTimeout(fallback);
      }
    );
    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, [push]);

  useEffect(() => {
    if (!activeSession?.startTimestamp) {
      setElapsedLabel("00:00");
      return;
    }
    const updateLabel = () => setElapsedLabel(formatElapsed(activeSession.startTimestamp));
    updateLabel();
    const timer = setInterval(updateLabel, TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeSession?.startTimestamp]);

  useEffect(() => {
    if (!activeSession?.id) {
      if (logTimerRef.current) {
        window.clearInterval(logTimerRef.current);
        logTimerRef.current = null;
      }
      return;
    }

    if (logTimerRef.current) return;

    logTimerRef.current = window.setInterval(async () => {
      const now = Date.now();
      if (now - lastLogRef.current < LOG_INTERVAL_MS) return;

      const dryerTempC = liveData.Temp1;
      const collectorTempC = liveData.Temp2;
      const humidityPct = liveData.Hum;

      if (
        dryerTempC === undefined ||
        collectorTempC === undefined ||
        humidityPct === undefined
      ) {
        return;
      }

      try {
        await setDoc(doc(collection(db, "sessions", activeSession.id, "samples")), {
          dryerTempC,
          collectorTempC,
          humidityPct,
          createdAt: firestoreServerTimestamp(),
          timestampMs: now
        });
        lastLogRef.current = now;
      } catch (error) {
        console.error("Failed to log sample", error);
      }
    }, LOG_INTERVAL_MS);

    return () => {
      if (logTimerRef.current) {
        window.clearInterval(logTimerRef.current);
        logTimerRef.current = null;
      }
    };
  }, [activeSession?.id, liveData.Temp1, liveData.Temp2, liveData.Hum]);

  const display = useMemo(() => {
    const dryer = liveData.Temp1 ?? 20;
    const collector = liveData.Temp2 ?? 20;
    const humidity = liveData.Hum ?? 20;
    return {
      dryer: `${dryer}\u00B0C`,
      collector: `${collector}\u00B0C`,
      humidity: `${humidity}%`
    };
  }, [liveData]);

  const createExperimentName = () => {
    try {
      const key = "solar_dryer_experiment_counter";
      const current = Number(window.sessionStorage.getItem(key) || "0");
      const next = current + 1;
      window.sessionStorage.setItem(key, String(next));
      return `Experiment ${next}`;
    } catch {
      return `Experiment ${Date.now()}`;
    }
  };

  const handleTurnOn = async () => {
    if (isBusy || activeSession) return;
    setIsBusy(true);
    try {
      const name = createExperimentName();
      const sessionRef = doc(collection(db, "sessions"));
      const startTimestamp = Date.now();

      startSession({ id: sessionRef.id, name, startTimestamp });

      // Firestore write in background
      void setDoc(sessionRef, {
        name,
        status: "running",
        createdAt: firestoreServerTimestamp(),
        createdAtClient: startTimestamp,
        deviceId: DEVICE_ID
      }).catch((error) => {
        console.error("Failed to start session", error);
        push("Failed to start the session.");
      });

      // RTDB command for fast response
      void rtdbSet(ref(rtdb, COMMAND_PATH), {
        action: "start",
        timestamp: Date.now()
      }).catch((error) => {
        console.error("Failed to send start command", error);
        push("Failed to send start command.");
      });
    } catch (error) {
      console.error("Failed to start session", error);
      push("Failed to start the session.");
      stopSession();
    } finally {
      setIsBusy(false);
    }
  };

  const handleTurnOff = async () => {
    if (isBusy || !activeSession) return;
    setIsBusy(true);
    const sessionIdToStop = activeSession.id;
    stopSession();
    try {
      void updateDoc(doc(db, "sessions", sessionIdToStop), {
        status: "stopped",
        endedAt: firestoreServerTimestamp()
      }).catch((error) => {
        console.error("Failed to stop session", error);
        push("Failed to stop the session.");
      });

      void rtdbSet(ref(rtdb, COMMAND_PATH), {
        action: "stop",
        timestamp: Date.now()
      }).catch((error) => {
        console.error("Failed to send stop command", error);
        push("Failed to send stop command.");
      });
    } catch (error) {
      console.error("Failed to stop session", error);
      push("Failed to stop the session.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full max-w-3xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
        <div>
          <div className="title-gradient text-3xl font-semibold sm:text-4xl">Solar Dryer</div>
        </div>
        <div className="flex flex-col items-center justify-center sm:flex-row">
          <div className="flex items-center gap-2 rounded-full bg-white px-2 py-2 shadow">
            <button
              type="button"
              onClick={handleTurnOn}
              disabled={isBusy || !!activeSession}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold text-black transition ${
                activeSession ? "bg-gray-500" : "bg-green-500 hover:bg-green-400"
              } disabled:opacity-60`}
            >
              Turn On
            </button>
            <button
              type="button"
              onClick={handleTurnOff}
              disabled={isBusy || !activeSession}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                activeSession ? "bg-red-600 hover:bg-red-500" : "bg-gray-500"
              } disabled:opacity-60`}
            >
              Turn Off
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-center text-xs text-gray-300 sm:text-sm">
        This dashboard is a real-time control panel used to monitor temperature and humidity; simply click the
        "Turn On" button to start the system or click "History" to see existing data.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-gray-200">
        {activeSession ? (
          <span>Active Session: {activeSession.name} - {elapsedLabel}</span>
        ) : (
          <span>No Active Session</span>
        )}
      </div>

      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 place-items-center gap-6 sm:grid-cols-2">
        {isLiveLoading ? (
          <>
            <Skeleton className="h-56 w-full max-w-[300px]" />
            <Skeleton className="h-56 w-full max-w-[300px]" />
          </>
        ) : (
          <>
            <MetricCard value={display.dryer} label="Dryer temperature" />
            <MetricCard value={display.collector} label="Collector temperature" />
          </>
        )}
      </div>

      <div className="w-full max-w-3xl">
        {isLiveLoading ? (
          <Skeleton className="mt-8 h-12 w-full rounded-full" />
        ) : (
          <HumidityPill value={display.humidity} />
        )}
      </div>
    </div>
  );
}
