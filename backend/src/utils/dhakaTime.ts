/**
 * Bangladesh Standard Time helpers. Bangladesh is UTC+6 with no daylight
 * saving, so a fixed offset is exact — no timezone database needed. Reports
 * and the public Danger Map both bucket incidents by *Dhaka* local time, not
 * the server's timezone, so "evening" means evening in Dhaka wherever the
 * backend is hosted.
 */
const OFFSET_MS = 6 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const shifted = (d: Date) => new Date(d.getTime() + OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, "0");

/** Hour of day (0-23) in Dhaka. */
export function dhakaHour(d: Date): number {
  return shifted(d).getUTCHours();
}

/** Calendar date in Dhaka as "YYYY-MM-DD". */
export function dhakaDateKey(d: Date): string {
  return shifted(d).toISOString().slice(0, 10);
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00+06:00`);
  return !Number.isNaN(t) && dhakaDateKey(new Date(t)) === s;
}

/** The instant a Dhaka calendar day begins (00:00 Dhaka time). */
export function startOfDhakaDay(key: string): Date {
  if (!isDateKey(key)) throw new Error(`Invalid date: ${key}`);
  return new Date(Date.parse(`${key}T00:00:00+06:00`));
}

/** Shift a YYYY-MM-DD key by whole days. */
export function addDaysToKey(key: string, days: number): string {
  return dhakaDateKey(new Date(startOfDhakaDay(key).getTime() + days * DAY_MS));
}

/** "21 Sep 2026" */
export function formatDhakaDate(d: Date | string): string {
  const s = typeof d === "string" ? shifted(startOfDhakaDay(d)) : shifted(d);
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

/** "21 Sep 2026, 14:05" */
export function formatDhaka(d: Date): string {
  const s = shifted(d);
  return `${formatDhakaDate(d)}, ${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
}

/** "Sun 21" — short day label for charts. */
export function dayLabel(key: string): string {
  const s = shifted(startOfDhakaDay(key));
  return `${WEEKDAYS[s.getUTCDay()]} ${s.getUTCDate()}`;
}

/** 18 -> "6 PM", 0 -> "12 AM" */
export function formatHour12(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12} ${hh < 12 ? "AM" : "PM"}`;
}

/** (18, 22) -> "6–10 PM"; (22, 2) -> "10 PM–2 AM" */
export function formatHourRange(startHour: number, endHour: number): string {
  const a = formatHour12(startHour);
  const b = formatHour12(endHour);
  const sameMeridiem = a.slice(-2) === b.slice(-2) && ((startHour % 24) < 12) === ((endHour % 24) < 12) && startHour < endHour;
  return sameMeridiem ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/** Human duration: 45s, 3m 12s, 1h 5m */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
