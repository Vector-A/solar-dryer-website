import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import HistoryRow from "../components/HistoryRow";
import { db } from "../firebase";
import { formatDate } from "../lib/format";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

interface SessionItem {
  id: string;
  name: string;
  createdAt?: any;
}

export default function History() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
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
      },
      () => {
        push("Failed to load history sessions.");
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [push]);

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
        {!isLoading &&
          sessions.map((session) => (
            <HistoryRow
              key={session.id}
              id={session.id}
              name={session.name || "Experiment"}
              dateLabel={formatDate(session.createdAt)}
            />
          ))}
      </div>
    </div>
  );
}
