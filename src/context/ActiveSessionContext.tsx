import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

interface ActiveSession {
  id: string;
  name: string;
  startTimestamp: number;
  conditionId: string;
  conditionLabel: string;
}

interface ActiveSessionContextValue {
  activeSession: ActiveSession | null;
  isLoading: boolean;
  startSession: (session: ActiveSession) => void;
  stopSession: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Source of truth: any session with status "running" in Firestore.
  // This means reopening the browser after closing still detects an ongoing session.
  useEffect(() => {
    const q = query(
      collection(db, "sessions"),
      where("status", "==", "running"),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data() as {
            name?: string;
            createdAtClient?: number;
            createdAt?: any;
            conditionId?: string;
            conditionLabel?: string;
          };
          const startTimestamp =
            data.createdAtClient ??
            (data.createdAt?.toDate ? data.createdAt.toDate().getTime() : Date.now());
          setActiveSession({
            id: docSnap.id,
            name: data.name ?? "Experiment",
            startTimestamp,
            conditionId: data.conditionId ?? "condition-1",
            conditionLabel: data.conditionLabel ?? "Condition 1",
          });
        } else {
          setActiveSession(null);
        }
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsub();
  }, []);

  const value = useMemo<ActiveSessionContextValue>(
    () => ({
      activeSession,
      isLoading,
      startSession: (session) => setActiveSession(session),
      stopSession: () => setActiveSession(null)
    }),
    [activeSession, isLoading]
  );

  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}

export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) throw new Error("useActiveSession must be used within ActiveSessionProvider");
  return ctx;
}
