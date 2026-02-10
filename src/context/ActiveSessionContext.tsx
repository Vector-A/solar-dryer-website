import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface ActiveSession {
  id: string;
  name: string;
  startTimestamp: number;
}

interface ActiveSessionContextValue {
  activeSession: ActiveSession | null;
  startSession: (session: ActiveSession) => void;
  stopSession: () => void;
}

const STORAGE_KEY = "solar_dryer_active_session";

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveSession;
        if (parsed?.id && parsed?.startTimestamp) {
          setActiveSession(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      if (activeSession) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [activeSession]);

  const value = useMemo<ActiveSessionContextValue>(
    () => ({
      activeSession,
      startSession: (session) => setActiveSession(session),
      stopSession: () => setActiveSession(null)
    }),
    [activeSession]
  );

  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}

export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) {
    throw new Error("useActiveSession must be used within ActiveSessionProvider");
  }
  return ctx;
}
