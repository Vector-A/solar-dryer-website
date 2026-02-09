import CalendarIcon from "./icons/CalendarIcon";
import { Link } from "react-router-dom";

interface HistoryRowProps {
  id: string;
  name: string;
  dateLabel: string;
  onDelete: (id: string, name: string) => void;
}

export default function HistoryRow({ id, name, dateLabel, onDelete }: HistoryRowProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="glass-card flex flex-1 items-center justify-between gap-4 rounded-xl px-4 py-3">
        <div className="text-sm font-semibold text-gray-100 sm:text-base">{name}</div>
        <div className="flex items-center gap-2 text-xs text-ember sm:text-sm">
          <CalendarIcon className="h-4 w-4" />
          <span>{dateLabel}</span>
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
          className="rounded-lg bg-red-600 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white hover:bg-red-500 sm:text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
