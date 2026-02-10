import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import HistoryRow from "../components/HistoryRow";
import { db } from "../firebase";
import { formatDate } from "../lib/format";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface SessionItem {
  id: string;
  name: string;
  createdAt?: any;
  createdAtClient?: number;
}

export default function History() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    const fallback = setTimeout(() => setIsLoading(false), 3000);
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<SessionItem, "id">)
          }))
        );
        setIsLoading(false);
        clearTimeout(fallback);
      },
      () => {
        push("Failed to load history sessions.");
        setIsLoading(false);
        clearTimeout(fallback);
      }
    );
    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, [push]);

  const handleDelete = async (id: string, name: string) => {
    const confirmText = prompt(
      `Are you sure you want to delete this experiment? Type "experiment" to continue.\n\n${name}`
    );
    if (confirmText?.toLowerCase() !== "experiment") {
      push("Failed to delete the experiment.");
      return;
    }
    try {
      await deleteDoc(doc(db, "sessions", id));
    } catch (error) {
      console.error("Failed to delete session", error);
      push("Failed to delete the experiment.");
    }
  };

  const ordered = useMemo(() => {
    const extractNumber = (name?: string) => {
      const match = name?.match(/Experiment\s+(\d+)/i);
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };
    return [...sessions].sort((a, b) => {
      const numA = extractNumber(a.name);
      const numB = extractNumber(b.name);
      if (numA !== numB) return numA - numB;
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    });
  }, [sessions]);

  useEffect(() => {
    const extractNumber = (name?: string) => {
      const match = name?.match(/Experiment\s+(\d+)/i);
      return match ? Number(match[1]) : 0;
    };
    const maxNumber = ordered.reduce((max, session) => Math.max(max, extractNumber(session.name)), 0);
    try {
      window.sessionStorage.setItem("solar_dryer_experiment_counter", String(maxNumber));
    } catch {}
  }, [ordered]);

  return (
    <div className="w-full">
      <h1 className="mb-6 text-3xl font-semibold">History</h1>
      <div className="flex flex-col gap-4">
        {isLoading && (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        )}
        {!isLoading && ordered.length === 0 && (
          <div className="text-sm text-gray-300">
            History is empty, please start a new experiment to record
          </div>
        )}
        {!isLoading &&
          ordered.map((session) => (
            <HistoryRow
              key={session.id}
              id={session.id}
              name={session.name || "Experiment"}
              dateLabel={formatDate(session.createdAt ?? session.createdAtClient)}
              onDelete={handleDelete}
            />
          ))}
      </div>
    </div>
  );
}
