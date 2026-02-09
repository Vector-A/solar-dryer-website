import { Timestamp } from "firebase/firestore";

export function formatDate(value?: Timestamp | Date | null): string {
  if (!value) return "--";
  const date = value instanceof Date ? value : value.toDate();
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function formatDateTime(value?: Timestamp | Date | null): string {
  if (!value) return "--";
  const date = value instanceof Date ? value : value.toDate();
  return date.toLocaleString();
}

export function safeNumber(value?: number | null): string {
  if (value === undefined || value === null) return "--";
  return value.toString();
}
