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
  const [isActiveLoading, setIsActiveLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "live", "current"),
      (snap) => {
        setLiveData((snap.data() as LiveData) || {});
        setIsLiveLoading(false);
      },
      () => {
        push("Failed to load live sensor data.");
        setIsLiveLoading(false);
      }
    );
    return () => unsub();
  }, [push]);

  useEffect(() => {
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
        setIsActiveLoading(false);
      },
      () => {
        push("Failed to load active session status.");
        setIsActiveLoading(false);
      }
    );
    return () => unsub();
  }, [push]);

  const display = useMemo(() => {
    const dryer = liveData.dryerTempC ?? 20;
    const collector = liveData.collectorTempC ?? 20;
    const humidity = liveData.humidityPct ?? 20;
    return {
      dryer: `${dryer}°C`,
      collector: `${collector}°C`,
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
      await setDoc(doc(db, "devices", DEVICE_ID, "command"), {
        recording: false,
        activeSessionId: null,
        updatedAt: firestoreServerTimestamp()
      });
    } catch (error) {
      console.error("Failed to stop session", error);
      push("Failed to stop the session.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3 text-3xl font-semibold sm:text-4xl">Solar Dryer</div>
      <p className="max-w-md text-xs text-gray-300 sm:text-sm">
        This dashboard is a real-time control panel used to monitor temperature and humidity; simply click the
        “Turn On” button to start the system or click “History” to see existing data.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-gray-200">
        {isActiveLoading ? (
          <Skeleton className="h-3 w-24" />
        ) : activeSessionName ? (
          <span>Active Session: {activeSessionName}</span>
        ) : (
          <span>No Active Session</span>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleTurnOn}
          disabled={isBusy}
          className="rounded-full bg-green-500 px-6 py-2 text-sm font-semibold text-black transition hover:bg-green-400 disabled:opacity-60"
        >
          Turn On
        </button>
        <button
          type="button"
          onClick={handleTurnOff}
          disabled={isBusy}
          className="rounded-full bg-gray-400 px-6 py-2 text-sm font-semibold text-black transition hover:bg-gray-300 disabled:opacity-60"
        >
          Turn Off
        </button>
      </div>

      <div className="mt-10 grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        {isLiveLoading ? (
          <>
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </>
        ) : (
          <>
            <MetricCard value={display.dryer} label="Dryer temperature" />
            <MetricCard value={display.collector} label="Collector temperature" />
          </>
        )}
      </div>

      {isLiveLoading ? (
        <Skeleton className="mt-8 h-12 w-full max-w-md rounded-full" />
      ) : (
        <HumidityPill value={display.humidity} />
      )}
    </div>
  );
}
