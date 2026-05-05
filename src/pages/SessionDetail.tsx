import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { onValue, ref } from "firebase/database";
import { db, rtdb } from "../firebase";
import { downloadCsv } from "../lib/csv";
import { formatDate } from "../lib/format";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface SessionData {
  name?: string;
  readingsPath?: string;
  createdAt?: any;
  conditionLabel?: string;
}

interface SampleItem {
  id: string;
  Hum?: number;
  Temp1?: number;
  Temp2?: number;
  timestamp?: number;
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

    let unsubRtdb: (() => void) | null = null;
    const fallback = setTimeout(() => setIsLoading(false), 5000);

    getDoc(doc(db, "sessions", sessionId))
      .then((snap) => {
        const data = (snap.data() as SessionData) || null;
        setSession(data);

        if (!data?.readingsPath) {
          setIsLoading(false);
          clearTimeout(fallback);
          return;
        }

        unsubRtdb = onValue(
          ref(rtdb, `readings/${data.readingsPath}`),
          (snap) => {
            const items: SampleItem[] = [];
            snap.forEach((child) => {
              items.push({ id: child.key!, ...(child.val() as Omit<SampleItem, "id">) });
            });
            setSamples(items);
            setIsLoading(false);
            clearTimeout(fallback);
          },
          () => {
            push("Failed to load session readings.");
            setIsLoading(false);
            clearTimeout(fallback);
          }
        );
      })
      .catch(() => {
        push("Failed to load session details.");
        setIsLoading(false);
        clearTimeout(fallback);
      });

    return () => {
      clearTimeout(fallback);
      if (unsubRtdb) unsubRtdb();
    };
  }, [sessionId, push]);

  const headerDate = useMemo(() => formatDate(session?.createdAt), [session]);

  const handleDownload = () => {
    const rows = [
      ["Timestamp", "Temp1 (°C)", "Temp2 (°C)", "Humidity (%)"],
      ...samples.map((s) => [
        s.timestamp ? new Date(s.timestamp * 1000).toISOString() : s.id,
        String(s.Temp1 ?? "--"),
        String(s.Temp2 ?? "--"),
        String(s.Hum ?? "--"),
      ]),
    ];
    downloadCsv(`${session?.name || "session"}.csv`, rows);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="glass-card flex flex-1 items-center justify-between gap-4 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-100 sm:text-base">
              {session?.name || "Session"}
            </span>
            {session?.conditionLabel && (
              <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-semibold text-ember">
                {session.conditionLabel}
              </span>
            )}
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
        ) : samples.length === 0 ? (
          <p className="text-sm text-gray-400">No readings recorded for this session.</p>
        ) : (
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr>
                <th className="px-3 py-2 text-xs">Timestamp</th>
                <th className="px-3 py-2 text-xs">Temp1 (°C)</th>
                <th className="px-3 py-2 text-xs">Temp2 (°C)</th>
                <th className="px-3 py-2 text-xs">Humidity (%)</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2 text-xs text-gray-300">
                    {s.timestamp
                      ? new Date(s.timestamp * 1000).toLocaleString()
                      : s.id}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border border-emberSoft px-2 py-0.5 text-emberDark">
                      {s.Temp1 ?? "--"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border border-emberSoft px-2 py-0.5 text-emberDark">
                      {s.Temp2 ?? "--"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full border border-emberSoft px-2 py-0.5 text-emberDark">
                      {s.Hum ?? "--"}
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
