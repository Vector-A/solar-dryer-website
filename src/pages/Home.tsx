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
import ConditionPicker, { type Condition } from "../components/ConditionPicker";

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
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const { push } = useToast();
  const { activeSession, isLoading: isSessionLoading, startSession, stopSession } = useActiveSession();
  const liveDataRef = useRef<LiveData>({});
  const activeSessionNameRef = useRef<string>("");
  const logTimerRef = useRef<number | null>(null);
  const initialWriteSessionRef = useRef<string | null>(null);

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
    liveDataRef.current = liveData;
  }, [liveData]);

  useEffect(() => {
    activeSessionNameRef.current = activeSession?.name ?? "";
  }, [activeSession?.name]);

  useEffect(() => {
    if (!activeSession?.id) {
      if (logTimerRef.current !== null) {
        window.clearInterval(logTimerRef.current);
        logTimerRef.current = null;
      }
      return;
    }
    if (logTimerRef.current !== null) return;

    const writeReading = async () => {
      const { Hum, Temp1, Temp2 } = liveDataRef.current;
      if (Hum === undefined || Temp1 === undefined || Temp2 === undefined) return;
      const now = new Date();
      const timestampSec = Math.floor(now.getTime() / 1000);
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 8).replace(/:/g, "-");
      const key = `ex_${date}_${time}`;
      try {
        await rtdbSet(ref(rtdb, `readings/${key}`), {
          Hum,
          Temp1,
          Temp2,
          timestamp: timestampSec,
        });
      } catch (err) {
        console.error("Failed to write reading", err);
      }
    };

    // Write immediately on session start — use a ref to prevent duplicate
    // in React StrictMode which mounts effects twice in development
    if (initialWriteSessionRef.current !== activeSession.id) {
      initialWriteSessionRef.current = activeSession.id;
      void writeReading();
    }
    logTimerRef.current = window.setInterval(writeReading, LOG_INTERVAL_MS);

    return () => {
      if (logTimerRef.current !== null) {
        window.clearInterval(logTimerRef.current);
        logTimerRef.current = null;
      }
    };
  }, [activeSession?.id]);

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

  const handleTurnOn = () => {
    if (isBusy || activeSession) return;
    setShowConditionPicker(true);
  };

  const handleConditionSelected = async (condition: Condition) => {
    setShowConditionPicker(false);
    setIsBusy(true);
    try {
      const name = createExperimentName();
      const sessionRef = doc(collection(db, "sessions"));
      const startTimestamp = Date.now();

      startSession({ id: sessionRef.id, name, startTimestamp, conditionId: condition.id, conditionLabel: condition.label });

      void setDoc(sessionRef, {
        name,
        status: "running",
        createdAt: firestoreServerTimestamp(),
        createdAtClient: startTimestamp,
        deviceId: DEVICE_ID,
        conditionId: condition.id,
        conditionLabel: condition.label,
      }).catch((error) => {
        console.error("Failed to start session", error);
        push("Failed to start the session.");
      });

      // RTDB command includes conditionId so the microcontroller knows which condition is active
      void rtdbSet(ref(rtdb, COMMAND_PATH), {
        action: "start",
        sessionId: sessionRef.id,
        conditionId: condition.id,
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
    <>
    {showConditionPicker && (
      <ConditionPicker
        onSelect={handleConditionSelected}
        onCancel={() => setShowConditionPicker(false)}
      />
    )}
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
              disabled={isBusy || isSessionLoading || !!activeSession}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold text-black transition ${
                activeSession || isSessionLoading ? "bg-gray-500" : "bg-green-500 hover:bg-green-400"
              } disabled:opacity-60`}
            >
              Turn On
            </button>
            <button
              type="button"
              onClick={handleTurnOff}
              disabled={isBusy || isSessionLoading || !activeSession}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                activeSession && !isSessionLoading ? "bg-red-600 hover:bg-red-500" : "bg-gray-500"
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
          <>
            <span>{activeSession.name}</span>
            <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-semibold text-ember">
              {activeSession.conditionLabel}
            </span>
            <span>{elapsedLabel}</span>
          </>
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
    </>
  );
}
