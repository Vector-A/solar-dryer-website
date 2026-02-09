import { useEffect, useMemo, useRef, useState } from "react";
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
import { onValue, ref } from "firebase/database";
import MetricCard from "../components/MetricCard";
import HumidityPill from "../components/HumidityPill";
import { db, rtdb } from "../firebase";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface LiveData {
  Hum?: number;
  Temp1?: number;
  Temp2?: number;
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
  const logTimerRef = useRef<number | null>(null);
  const lastLogRef = useRef<number>(0);
  const lastStartRef = useRef<number | null>(null);
  const storageKey = "solar_dryer_active_start";
  const storageNameKey = "solar_dryer_active_name";

  const readStoredActive = () => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { id?: string; startMs?: number };
      return parsed?.id ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeStoredActive = (id: string, startMs: number, name?: string) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ id, startMs }));
      if (name) {
        window.localStorage.setItem(storageNameKey, name);
      }
    } catch {}
  };

  const clearStoredActive = () => {
    try {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(storageNameKey);
    } catch {}
  };

  useEffect(() => {
    try {
      const parsed = readStoredActive();
      if (parsed?.startMs && typeof parsed.startMs === "number") {
        setLocalStartMs(parsed.startMs);
        lastStartRef.current = parsed.startMs;
      }
      if (parsed?.id && !activeSessionId) {
        setActiveSessionId(parsed.id);
      }
      const storedName = window.localStorage.getItem(storageNameKey);
      if (storedName && !activeSessionName) {
        setActiveSessionName(storedName);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => setIsLiveLoading(false), 3000);
    const liveRef = ref(rtdb, "Solardryer");
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
        const activeId = snap.docs[0]?.id || null;

        if (!activeId) {
          setActiveSessionName(null);
          setActiveSessionId(null);
          setActiveSessionStartedAt(null);
          setLocalStartMs(null);
          lastStartRef.current = null;
          clearStoredActive();
        } else {
          const stored = readStoredActive();
          const storedStart = stored?.id === activeId ? stored.startMs ?? null : null;

          setActiveSessionName(active?.name || null);
          setActiveSessionId(activeId);

          const createdMs = active?.createdAt?.toDate ? active.createdAt.toDate().getTime() : null;
          const startMs = storedStart ?? createdMs ?? lastStartRef.current ?? Date.now();
          lastStartRef.current = startMs;
          setActiveSessionStartedAt(new Date(startMs));

          writeStoredActive(activeId, startMs, active?.name);
        }

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
    const updateLabel = () => {
      const diffMs = Date.now() - started.getTime();
      const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (value: number) => value.toString().padStart(2, "0");
      setElapsedLabel(hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`);
    };
    updateLabel();
    const timer = setInterval(updateLabel, 1000);
    return () => clearInterval(timer);
  }, [activeSessionStartedAt, localStartMs]);

  useEffect(() => {
    if (!activeSessionId) {
      if (logTimerRef.current) {
        window.clearInterval(logTimerRef.current);
        logTimerRef.current = null;
      }
      return;
    }

    if (logTimerRef.current) {
      return;
    }

    logTimerRef.current = window.setInterval(async () => {
      const now = Date.now();
      if (now - lastLogRef.current < 1000) return;

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
        await addDoc(collection(db, "sessions", activeSessionId, "samples"), {
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
    }, 1000);

    return () => {
      if (logTimerRef.current) {
        window.clearInterval(logTimerRef.current);
        logTimerRef.current = null;
      }
    };
  }, [activeSessionId, liveData.Temp1, liveData.Temp2, liveData.Hum]);

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

  const createExperimentName = async () => {
    const allSnap = await getDocs(query(collection(db, "sessions")));
    let maxNumber = 0;
    allSnap.docs.forEach((docSnap) => {
      const name = docSnap.data()?.name as string | undefined;
      const match = name?.match(/Experiment\s+(\d+)/i);
      if (match) {
        maxNumber = Math.max(maxNumber, Number(match[1]));
      }
    });
    return `Experiment ${maxNumber + 1}`;
  };

  const handleTurnOn = async () => {
    try {
      if (isBusy || activeSessionId) return;
      setIsBusy(true);
      const name = await createExperimentName();
      const sessionRef = await addDoc(collection(db, "sessions"), {
        name,
        status: "running",
        createdAt: firestoreServerTimestamp(),
        deviceId: DEVICE_ID
      });
      const startMs = Date.now();
      
      // Update local state immediately for better UX
      setActiveSessionName(name);
      setActiveSessionId(sessionRef.id);
      setLocalStartMs(startMs);
      lastStartRef.current = startMs;
      setActiveSessionStartedAt(new Date(startMs));
      writeStoredActive(sessionRef.id, startMs, name);
      
      // Send device command
      await setDoc(doc(db, "devices", DEVICE_ID, "command"), {
        recording: true,
        activeSessionId: sessionRef.id,
        updatedAt: firestoreServerTimestamp()
      });
      
      push("Session started successfully!");
    } catch (error) {
      console.error("Failed to start session", error);
      // Clear state on error
      setActiveSessionName(null);
      setActiveSessionId(null);
      setLocalStartMs(null);
      lastStartRef.current = null;
      clearStoredActive();
      push("Failed to start the session.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleTurnOff = async () => {
    try {
      if (isBusy) return;
      setIsBusy(true);
      
      const stored = readStoredActive();
      const sessionIdToStop = activeSessionId ?? stored?.id ?? null;
      
      // Don't proceed if there's nothing to stop
      if (!sessionIdToStop) {
        setIsBusy(false);
        return;
      }
      
      // Stop the session
      await updateDoc(doc(db, "sessions", sessionIdToStop), {
        status: "stopped",
        endedAt: firestoreServerTimestamp()
      });
      
      // Send device command
      await setDoc(doc(db, "devices", DEVICE_ID, "command"), {
        recording: false,
        activeSessionId: null,
        updatedAt: firestoreServerTimestamp()
      });
      
      // Clear state immediately for better UX
      setActiveSessionName(null);
      setActiveSessionStartedAt(null);
      setActiveSessionId(null);
      setLocalStartMs(null);
      lastStartRef.current = null;
      clearStoredActive();
      
      push("Session stopped successfully!");
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
              disabled={isBusy || !!activeSessionId}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isBusy
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : activeSessionId
                    ? "bg-gray-500 text-white cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-400 text-black cursor-pointer"
              }`}
            >
              {isBusy ? "..." : "Turn On"}
            </button>
            <button
              type="button"
              onClick={handleTurnOff}
              disabled={isBusy || !activeSessionId}
              className={`w-24 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isBusy
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : activeSessionId
                    ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                    : "bg-gray-500 text-white cursor-not-allowed"
              }`}
            >
              {isBusy ? "..." : "Turn Off"}
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
