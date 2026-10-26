const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function istToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function istYesterday(now = new Date()): string {
  return istToday(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday-based week containing the supplied IST date. */
export function weekRange(dateString: string): { start: string; end: string } {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  const start = addDays(dateString, delta);
  return { start, end: addDays(start, 6) };
}

/** First and last day of the IST calendar month. */
export function monthRange(dateString: string): { start: string; end: string; label: string } {
  const [year, month] = dateString.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0));
  const end = last.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${start}T00:00:00Z`));
  return { start, end, label };
}

export function formatIstDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" && DATE_RE.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatIstDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export const formatDateTime = formatIstDateTime;


export function relativeDays(dateString: string | null | undefined, now = new Date()): string {
  if (!dateString) return "—";
  const today = istToday(now);
  const diff = Math.round(
    (new Date(`${dateString}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  return formatIstDate(dateString);
}

export function daysBetweenInclusive(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}
