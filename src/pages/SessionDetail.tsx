import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import { db } from "../firebase";
import { downloadCsv } from "../lib/csv";
import { formatDate, formatDateTime, safeNumber } from "../lib/format";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface SessionData {
  name?: string;
  createdAt?: any;
}

interface SampleItem {
  id: string;
  dryerTempC?: number;
  collectorTempC?: number;
  humidityPct?: number;
  createdAt?: any;
  timestampMs?: number;
}

export default function SessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    if (!sessionId) return;
    const fallback = setTimeout(() => setIsLoading(false), 3000);
    getDoc(doc(db, "sessions", sessionId))
      .then((snap) => {
        setSession((snap.data() as SessionData) || null);
      })
      .catch(() => {
        push("Failed to load session details.");
      });

    const sampleQuery = query(
      collection(db, "sessions", sessionId, "samples"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      sampleQuery,
      (snap) => {
        setSamples(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<SampleItem, "id">)
          }))
        );
        setIsLoading(false);
        clearTimeout(fallback);
      },
      () => {
        push("Failed to load session samples.");
        setIsLoading(false);
        clearTimeout(fallback);
      }
    );
    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, [sessionId, push]);

  const headerDate = useMemo(() => formatDate(session?.createdAt), [session]);

  const handleDownload = () => {
    const rows = [
      ["Timestamp", "Dryer Temperature", "Collector Temperature", "Humidity (%)"],
      ...samples.map((sample) => [
        sample.timestampMs
          ? new Date(sample.timestampMs).toISOString()
          : formatDateTime(sample.createdAt),
        safeNumber(sample.dryerTempC),
        safeNumber(sample.collectorTempC),
        safeNumber(sample.humidityPct)
      ])
    ];
    downloadCsv(`${session?.name || "session"}.csv`, rows);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="glass-card flex flex-1 items-center justify-between gap-4 rounded-xl px-4 py-3">
          <div className="text-sm font-semibold text-gray-100 sm:text-base">
            {session?.name || "Session"}
          </div>
          <div className="text-xs text-ember sm:text-sm">{headerDate}</div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/history")}
          className="rounded-lg bg-emberSoft px-4 py-2 text-sm font-semibold text-black"
        >
          Close
        </button>
      </div>

      <div className="table-shell overflow-x-auto rounded-xl p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr>
                <th className="px-3 py-2 text-xs">Timestamp</th>
                <th className="px-3 py-2 text-xs">Dryer temperature</th>
                <th className="px-3 py-2 text-xs">Collector temperature</th>
                <th className="px-3 py-2 text-xs">Humidity (%)</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {sample.timestampMs
                      ? new Date(sample.timestampMs).toLocaleString()
                      : formatDateTime(sample.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border border-emberSoft px-2 py-0.5 text-emberDark">
                      {safeNumber(sample.dryerTempC)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border border-emberSoft px-2 py-0.5 text-emberDark">
                      {safeNumber(sample.collectorTempC)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border border-emberSoft px-2 py-0.5 text-emberDark">
                      {safeNumber(sample.humidityPct)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md bg-black px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
