// User-visible Stats copy, in one place. Strings follow the wireframes
// (.agent/plan/261001_125643_wave-gestures-and-stats.wireframes.html, S1–S7)
// and the plan's copy rules for states the wireframes only describe in notes.

import { runLabel } from './timerLabels';
import { addDays, startOfDay, weekStart, entryTime } from './stats';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const monthLabel = (index) => MONTHS[index];

const plural = (n, word) => (n === 1 ? word : `${word}s`);

// "28 Sep"
export function shortDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "12 Jul 2026"
export const longDate = (ms) => `${shortDate(ms)} ${new Date(ms).getFullYear()}`;

// Subtitle: "This week · 28 Sep – 4 Oct".
export function weekRange(now) {
  const start = weekStart(now);
  return `This week · ${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
}

// "52 m", "3 h 05 m".
export function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} m`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} m`;
}

// The line under the day dots. streak: utils/stats.js weekStreak().
export function streakLine({ current, days, met }, goal) {
  const of = `${days} of ${goal} ${plural(goal, 'day')}`;
  if (met) return `${of} · goal met ✓`;
  if (current === 0) return `Train ${goal} ${plural(goal, 'day')} this week to start a streak`;
  return `${of} · ${goal - days} more to keep the streak`;
}

export const goalChip = (goal) => `Goal ${goal}/wk ›`;

// Hint in the weekly goal sheet (S6).
export const goalHint = (goal) =>
  `A week counts toward your streak when you train on ${goal} ${plural(goal, 'day')}. `
  + 'A day counts after 5 minutes of training.';

// Tile delta against last week. → { text, up }. Time compares whole minutes.
export function timeDelta(nowMs, lastMs) {
  const diff = Math.round(nowMs / 60000) - Math.round(lastMs / 60000);
  return countDelta(diff, 0, (n) => formatDuration(n * 60000));
}

export function countDelta(now, last, format = String) {
  const diff = now - last;
  if (diff === 0) return { text: 'Same as last week', up: false };
  if (diff > 0) return { text: `+${format(diff)} vs last week`, up: true };
  return { text: `−${format(-diff)} vs last week`, up: false };
}

// History day header: "Today", "Yesterday", "Mon 28 Sep" (with the year when
// it isn't this year's).
export function dayLabel(ms, now) {
  const day = startOfDay(ms);
  if (day === startOfDay(now)) return 'Today';
  if (day === addDays(now, -1)) return 'Yesterday';
  const d = new Date(ms);
  const base = `${WEEKDAYS[d.getDay()]} ${shortDate(ms)}`;
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// "18:05"
export function clockTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "23 min" of active time.
export const entryMinutes = (ms) => (ms < 60000 ? '<1 min' : `${Math.round(ms / 60000)} min`);

// History row title: the run label, or "Combo session".
export function entryTitle(entry) {
  if (entry.type === 'combos') return 'Combo session';
  return runLabel(entry.kind, { roundSec: entry.roundSec, rounds: entry.rounds }, entry.presetName);
}

// History row meta: lead (in a brighter grey) + the rest, joined by " · ".
// "5/5 rounds · 23 min", "4/12 rounds · stopped · 15 min", "Done · 2 min",
// "8/10 done · 24 min".
export function entryMeta(entry) {
  const minutes = entryMinutes(entryTime(entry));
  if (entry.type === 'combos') return { lead: `${entry.comboIds.length}/${entry.total} done`, rest: [minutes] };
  if (entry.kind === 'countdown') return { lead: entry.completed ? 'Done' : 'Stopped', rest: [minutes] };
  if (entry.rounds == null) {
    return { lead: `${entry.roundsDone} ${plural(entry.roundsDone, 'round')}`, rest: [minutes] };
  }
  const lead = `${entry.roundsDone}/${entry.rounds} rounds`;
  return { lead, rest: entry.completed ? [minutes] : ['stopped', minutes] };
}

// Delete alert (S7): "Countdown · 2:00, yesterday at 17:58. Your stats will be
// recalculated without it."
export function deleteMessage(entry, now) {
  const day = dayLabel(entry.at, now);
  const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day;
  return `${entryTitle(entry)}, ${when} at ${clockTime(entry.at)}. Your stats will be recalculated without it.`;
}
