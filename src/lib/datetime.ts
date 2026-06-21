// Centralized IST (Asia/Kolkata) date/time handling.
//
// Storage truth: the backend stores/returns timestamps in UTC (timestamptz / ISO with Z).
// The whole app is operated in India, so the UI thinks in IST. This module is the single
// source of truth for converting between the two so every page filters and displays consistently.
//
// IST is a fixed +05:30 offset with no DST, so we can convert without extra dependencies.

export const IST = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

export interface UTCRange {
  /** Inclusive start, UTC ISO string. */
  fromUTC: string;
  /** Exclusive end, UTC ISO string. */
  toUTC: string;
}

/**
 * Current IST calendar date as "YYYY-MM-DD" (what the user perceives as "today" in India),
 * regardless of the browser's local timezone.
 */
export function istTodayString(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

/** Add `days` to a "YYYY-MM-DD" string, returning a new "YYYY-MM-DD" string. */
export function addDays(dateStr: string, days: number): string {
  // Anchor at noon UTC to avoid any boundary rounding, then format back as a plain date.
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The UTC range covering a single IST calendar day.
 * e.g. "2026-06-18" (IST) -> 2026-06-17T18:30:00Z .. 2026-06-18T18:30:00Z
 */
export function istDayRange(dateStr: string): UTCRange {
  const start = new Date(`${dateStr}T00:00:00${IST_OFFSET}`);
  const end = new Date(`${addDays(dateStr, 1)}T00:00:00${IST_OFFSET}`);
  return { fromUTC: start.toISOString(), toUTC: end.toISOString() };
}

/** UTC range for today (IST). */
export function todayRange(): UTCRange {
  return istDayRange(istTodayString());
}

/** UTC range for yesterday (IST). */
export function yesterdayRange(): UTCRange {
  return istDayRange(addDays(istTodayString(), -1));
}

/** UTC range for the current IST week (Monday 00:00 IST through next Monday 00:00 IST). */
export function thisWeekRange(): UTCRange {
  const today = istTodayString();
  // Day of week for the IST date (0=Sun..6=Sat); treat Monday as the start of the week.
  const dow = new Date(`${today}T12:00:00${IST_OFFSET}`).getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  const monday = addDays(today, -daysSinceMonday);
  return {
    fromUTC: istDayRange(monday).fromUTC,
    toUTC: istDayRange(addDays(monday, 6)).toUTC,
  };
}

/** UTC range for the current IST month (1st 00:00 IST through 1st of next month 00:00 IST). */
export function thisMonthRange(): UTCRange {
  const today = istTodayString();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const start = new Date(`${firstOfMonth}T00:00:00${IST_OFFSET}`);
  const [y, m] = firstOfMonth.split("-").map(Number);
  const nextMonthFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = new Date(`${nextMonthFirst}T00:00:00${IST_OFFSET}`);
  return { fromUTC: start.toISOString(), toUTC: end.toISOString() };
}

/**
 * Convert a `datetime-local`/`<input type="datetime-local">` value (entered by the user in IST,
 * format "YYYY-MM-DDTHH:mm") into a UTC ISO string suitable for API `from`/`to` params.
 */
export function toUTCISOFromISTLocal(localValue: string): string {
  if (!localValue) return "";
  const withSeconds = localValue.length === 16 ? `${localValue}:00` : localValue;
  return new Date(`${withSeconds}${IST_OFFSET}`).toISOString();
}

/** The IST calendar date ("YYYY-MM-DD") that a UTC/ISO timestamp falls on. */
export function istDateOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d);
}

/** Shift a UTC ISO timestamp by a number of hours, returning a UTC ISO string. */
export function shiftHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

/** Format a UTC/ISO timestamp from the API as a full IST date + time string. */
export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format a UTC/ISO timestamp from the API as an IST time-of-day string. */
export function formatISTTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
