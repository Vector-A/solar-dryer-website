import { Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/TopNav";
import Home from "./pages/Home";
import History from "./pages/History";
import SessionDetail from "./pages/SessionDetail";
import { ToastProvider } from "./components/Toast";

export default function App() {
  return (
    <ToastProvider>
      <div className="app-bg min-h-screen text-white">
        <div className="mx-auto flex max-w-5xl flex-col px-5 pb-20 pt-10">
          <TopNav />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:sessionId" element={<SessionDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ToastProvider>
  );
}
