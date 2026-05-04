export function formatDate(value?: any): string {
  if (value === undefined || value === null) return "--";
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : value?.toDate
          ? value.toDate()
          : new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function formatDateTime(value?: any): string {
  if (value === undefined || value === null) return "--";
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : value?.toDate
          ? value.toDate()
          : new Date(value);
  return date.toLocaleString();
}

export function safeNumber(value?: number | null): string {
  if (value === undefined || value === null) return "--";
  return value.toString();
}
