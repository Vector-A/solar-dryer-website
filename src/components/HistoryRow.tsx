import CalendarIcon from "./icons/CalendarIcon";
import { Link } from "react-router-dom";

interface HistoryRowProps {
  id: string;
  name: string;
  dateLabel: string;
  isActive?: boolean;
  onDelete: (id: string, name: string) => void;
}

export default function HistoryRow({ id, name, dateLabel, isActive, onDelete }: HistoryRowProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="glass-card flex flex-1 items-center justify-between gap-4 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-100 sm:text-base">{name}</span>
          {isActive && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-ember sm:text-sm">
          <CalendarIcon className="h-4 w-4" />
          <span>{dateLabel || "--"}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to={`/history/${id}`}
          className="rounded-lg bg-ember px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-black sm:text-sm"
        >
          Detailed Data
        </Link>
        <button
          type="button"
          onClick={() => onDelete(id, name)}
          disabled={isActive}
          className={`rounded-lg px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white sm:text-sm ${
            isActive
              ? "cursor-not-allowed bg-gray-600 opacity-40"
              : "bg-red-600 hover:bg-red-500"
          }`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
