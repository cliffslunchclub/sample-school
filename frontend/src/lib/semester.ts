// Monday–Friday lunch schedule — driven by semester dates stored in DB.
// All functions accept optional start/end overrides; the constants below are
// compile-time fallbacks used before the DB value is loaded.

export const SEMESTER_START = "2026-09-14";
export const SEMESTER_END   = "2026-11-11";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type Weekday = typeof WEEKDAYS[number];
export function weekdayOf(key: string): Weekday {
  return WEEKDAYS[new Date(key.slice(0, 10) + "T12:00:00Z").getUTCDay() - 1];
}

export interface LunchDate {
  iso: string;     // canonical noon-UTC ISO, stored on meal_selections.lunch_date
  key: string;     // YYYY-MM-DD
  weekday: Weekday;
}

function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

/** Every weekday within the semester range, in order. */
export function lunchDates(
  start: string = SEMESTER_START,
  end:   string = SEMESTER_END,
): LunchDate[] {
  const out: LunchDate[] = [];
  const [sy, sm, sd] = start.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = end.slice(0, 10).split("-").map(Number);
  let cur = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  while (cur <= endMs) {
    const d = new Date(cur);
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      out.push({ iso: `${key}T12:00:00.000Z`, key, weekday: WEEKDAYS[dow - 1] });
    }
    cur += 86400000;
  }
  return out;
}

/** Extract a YYYY-MM-DD key from a stored date string. */
export function keyOf(dateStr?: string): string {
  return dateStr ? dateStr.slice(0, 10) : "";
}

/** Canonical stored value (noon UTC) for a given day key. */
export function isoForKey(key: string): string {
  return `${key}T12:00:00.000Z`;
}

/** PocketBase filter matching a datetime field to a single calendar day. */
export function dayFilter(field: string, key: string): string {
  return `${field} >= "${key} 00:00:00.000Z" && ${field} <= "${key} 23:59:59.999Z"`;
}

export interface OrderWindow {
  open: boolean;
  keys: string[]; // upcoming Monday–Friday keys
}

/**
 * Parent ordering window: open Thursday–Friday, targeting next week's
 * Monday through Friday.
 */
export function orderingWindow(now: Date = new Date()): OrderWindow {
  // Interpret ordering deadlines in the school timezone, regardless of the Mac timezone.
  const schoolNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dow = schoolNow.getDay(); // 0 Sun … 6 Sat
  const open = dow === 4 || dow === 5;
  const daysUntilMon = (8 - dow) % 7; // Thu→4, Fri→3
  const mon = new Date(schoolNow);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(mon.getDate() + daysUntilMon);

  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { open, keys: WEEKDAYS.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return fmt(d); }) };
}

/** The lunch dates a parent can currently edit (window open + within semester). */
export function editableLunchDates(
  now:   Date   = new Date(),
  start: string = SEMESTER_START,
  end:   string = SEMESTER_END,
): LunchDate[] {
  const w = orderingWindow(now);
  if (!w.open) return [];
  return lunchDates(start, end).filter((d) => w.keys.includes(d.key));
}

/** Whether a given day key is currently editable by a parent. */
export function isKeyEditable(key: string, now: Date = new Date()): boolean {
  const w = orderingWindow(now);
  return w.open && w.keys.includes(key);
}
