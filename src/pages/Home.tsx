import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp as firestoreServerTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import MetricCard from "../components/MetricCard";
import HumidityPill from "../components/HumidityPill";
import { db } from "../firebase";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface LiveData {
  dryerTempC?: number;
  collectorTempC?: number;
  humidityPct?: number;
}

const DEVICE_ID = "dryer-01";

export default function Home() {
  const [liveData, setLiveData] = useState<LiveData>({});
  const [isBusy, setIsBusy] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(true);
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);
  const [activeSessionStartedAt, setActiveSessionStartedAt] = useState<any | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localStartMs, setLocalStartMs] = useState<number | null>(null);
  const [isActiveLoading, setIsActiveLoading] = useState(true);
  const [elapsedLabel, setElapsedLabel] = useState<string>("00:00");
  const { push } = useToast();

  useEffect(() => {
    const fallback = setTimeout(() => setIsLiveLoading(false), 3000);
    const unsub = onSnapshot(
      doc(db, "live", "current"),
      (snap) => {
        setLiveData((snap.data() as LiveData) || {});
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
    const fallback = setTimeout(() => setIsActiveLoading(false), 3000);
    const activeQuery = query(
      collection(db, "sessions"),
      where("status", "==", "running"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(
      activeQuery,
      (snap) => {
        const active = snap.docs[0]?.data();
        setActiveSessionName(active?.name || null);
        setActiveSessionStartedAt(active?.createdAt || null);
        setActiveSessionId(snap.docs[0]?.id || null);
        setIsActiveLoading(false);
        clearTimeout(fallback);
      },
      () => {
        push("Failed to load active session status.");
        setIsActiveLoading(false);
        clearTimeout(fallback);
      }
    );
    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, [push]);

  useEffect(() => {
    const startedValue = activeSessionStartedAt ?? (localStartMs ? new Date(localStartMs) : null);
    if (!startedValue) {
      setElapsedLabel("00:00");
      return;
    }
    const started = startedValue?.toDate ? startedValue.toDate() : new Date(startedValue);
    const update = () => {
      const diffMs = Date.now() - started.getTime();
      const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (value: number) => value.toString().padStart(2, "0");
      setElapsedLabel(hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeSessionStartedAt, localStartMs]);

  const display = useMemo(() => {
    const dryer = liveData.dryerTempC ?? 20;
    const collector = liveData.collectorTempC ?? 20;
    const humidity = liveData.humidityPct ?? 20;
    return {
      dryer: `${dryer}\u00B0C`,
      collector: `${collector}\u00B0C`,
      humidity: `${humidity}%`
    };
  }, [liveData]);

  const createExperimentName = async () => {
    const latestQuery = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(1));
    const latestSnap = await getDocs(latestQuery);
    const latest = latestSnap.docs[0]?.data();
    const latestName = typeof latest?.name === "string" ? latest.name : "";
    const match = latestName.match(/Experiment\s+(\d+)/i);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `Experiment ${nextNumber}`;
  };

  const handleTurnOn = async () => {
    try {
      setIsBusy(true);
      const name = await createExperimentName();
      const sessionRef = await addDoc(collection(db, "sessions"), {
        name,
        status: "running",
        createdAt: firestoreServerTimestamp(),
        deviceId: DEVICE_ID
      });
      setActiveSessionName(name);
      setActiveSessionId(sessionRef.id);
      setLocalStartMs(Date.now());
      setActiveSessionStartedAt(new Date());
      await setDoc(doc(db, "devices", DEVICE_ID, "command"), {
        recording: true,
        activeSessionId: sessionRef.id,
        updatedAt: firestoreServerTimestamp()
      });
    } catch (error) {
      console.error("Failed to start session", error);
      push("Failed to start the session.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleTurnOff = async () => {
    try {
      setIsBusy(true);
      if (activeSessionId) {
        await updateDoc(doc(db, "sessions", activeSessionId), {
          status: "stopped",
          endedAt: firestoreServerTimestamp()
        });
      } else {
        const runningQuery = query(
          collection(db, "sessions"),
          where("status", "==", "running"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const runningSnap = await getDocs(runningQuery);
        const running = runningSnap.docs[0];
        if (running) {
          await updateDoc(running.ref, {
            status: "stopped",
            endedAt: firestoreServerTimestamp()
          });
        }
      }
      await setDoc(doc(db, "devices", DEVICE_ID, "command"), {
        recording: false,
        activeSessionId: null,
        updatedAt: firestoreServerTimestamp()
      });
      setActiveSessionName(null);
      setActiveSessionStartedAt(null);
      setActiveSessionId(null);
      setLocalStartMs(null);
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
              disabled={isBusy || !!activeSessionName || !!activeSessionId}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold text-black transition ${
                activeSessionName ? "bg-gray-500" : "bg-green-500 hover:bg-green-400"
              } disabled:opacity-60`}
            >
              Turn On
            </button>
            <button
              type="button"
              onClick={handleTurnOff}
              disabled={isBusy || (!activeSessionName && !activeSessionId)}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                activeSessionName || activeSessionId ? "bg-red-600 hover:bg-red-500" : "bg-gray-500"
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
        {isActiveLoading ? (
          <Skeleton className="h-3 w-24" />
        ) : activeSessionName ? (
          <span>Active Session: {activeSessionName} - {elapsedLabel}</span>
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
