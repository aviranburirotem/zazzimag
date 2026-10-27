// Instagram posting queue: schedule maths, in Israel time.
// Shared by the server (which decides what to post now) and the console (which shows when each post goes out).
//
// schedule = { on: true, every: 2, time: "18:00", lastAuto: "2026-10-27" | null }
//   on        post the queue automatically
//   every     days between automatic posts (1 = every day)
//   time      time of day for automatic posts, Israel time
//   lastAuto  Israel date of the last automatic post
// queue item = { id, custom: false, at: "2026-10-29T12:30", status: "queued" | "posting" | "error", ... }
//   custom + at  this post goes out at its own date and time (Israel time) instead of the schedule

export const TZ = "Asia/Jerusalem";

// Israel date ("YYYY-MM-DD") and minutes since midnight for a moment in time
export function local(ms = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// "YYYY-MM-DDTHH:MM" in Israel time → milliseconds (handles summer/winter time)
export function toMs(localStr) {
  const m = String(localStr || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess;
  for (let i = 0; i < 2; i++) { // offset = what Israel shows at t, minus t
    const l = local(t), [y, mo, d] = l.date.split("-").map(Number);
    const shown = Date.UTC(y, mo - 1, d, Math.floor(l.minutes / 60), l.minutes % 60);
    t = guess - (shown - t);
  }
  return t;
}

export const minutesOf = (hhmm) => { const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/); return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : 18 * 60; };
export const addDays = (date, n) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// an item can go out (not already being posted, not failed)
export const ready = (it) => it && (it.status || "queued") === "queued";

// the first day automatic posting is allowed (today or later)
function firstAutoDay(schedule, today) {
  const every = Math.max(1, Number(schedule.every) || 1);
  if (!schedule.lastAuto) return today;
  if (schedule.lastAuto === today) return addDays(today, every);
  const next = addDays(schedule.lastAuto, every);
  return daysBetween(today, next) > 0 ? next : today;
}

// What should go out right now? → the item, or null
export function dueNow(queue, schedule, now = Date.now()) {
  // 1. posts with their own time, oldest due first
  const custom = queue.filter((it) => ready(it) && it.custom && toMs(it.at) <= now).sort((a, b) => toMs(a.at) - toMs(b.at));
  if (custom.length) return { item: custom[0], auto: false };
  // 2. the next post in line, when the schedule says so
  if (!schedule || !schedule.on) return null;
  const { date: today, minutes } = local(now);
  if (firstAutoDay(schedule, today) !== today || minutes < minutesOf(schedule.time)) return null;
  const next = queue.find((it) => ready(it) && !it.custom);
  return next ? { item: next, auto: true, today } : null;
}

// When each post will go out → { [id]: "YYYY-MM-DDTHH:MM" | null } (null = waiting: schedule off, or no time set)
export function plan(queue, schedule, now = Date.now()) {
  const out = {};
  const { date: today, minutes } = local(now);
  const every = Math.max(1, Number(schedule?.every) || 1), at = minutesOf(schedule?.time);
  let day = schedule?.on ? firstAutoDay(schedule, today) : null;
  for (const it of queue) {
    if (it.custom) { out[it.id] = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(it.at || "") ? it.at.slice(0, 16) : null; continue; }
    if (!ready(it) || !day) { out[it.id] = null; continue; }
    out[it.id] = `${day}T${hhmm(at)}`;
    day = addDays(day, every);
  }
  return out;
}

// "Thu 29 Oct, 18:00" (or "Today, 18:00")
export function nice(localStr, now = Date.now()) {
  if (!localStr) return "";
  const [d, t] = localStr.split("T");
  const today = local(now).date;
  if (d === today) return `Today, ${t}`;
  if (d === addDays(today, 1)) return `Tomorrow, ${t}`;
  const [y, m, dd] = d.split("-").map(Number);
  return `${new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}, ${t}`;
}
