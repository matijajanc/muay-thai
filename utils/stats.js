// Stats from the training log (utils/history.js): pure functions, no React.
//
// Training time is the union of all entries' spans, so drilling combos during a
// timer run isn't counted twice. Days are local calendar days and weeks run
// Monday to Sunday, stepped with Date's local-time arithmetic so DST and the
// year end don't shift them.

import { COMBOS } from '../data/combos';

export const TRAINING_DAY_MS = 5 * 60 * 1000; // a day counts after 5 min of training
export const CHART_WEEKS = 12;
export const RECENT_DAYS = 30; // technique mix and most drilled
export const MIN_MIX_COMBOS = 5;
export const TOP_DRILLED = 5;

export const TYPE_ORDER = ['punches', 'kicks', 'elbows', 'knees', 'clinch', 'mixed', 'deadliest'];
const COMBO_BY_ID = new Map(COMBOS.map(c => [c.id, c]));

// ---- Local calendar ----

export const startOfDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Midnight `n` days after the day of `ms` (n may be negative).
export const addDays = (ms, n) => {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() + n);
  return d.getTime();
};

// 0 = Monday … 6 = Sunday.
export const weekdayIndex = (ms) => (new Date(ms).getDay() + 6) % 7;

// Monday 00:00 of the week of `ms`.
export const weekStart = (ms) => addDays(ms, -weekdayIndex(ms));

// "2026-09-28"
const pad2 = (n) => String(n).padStart(2, '0');
export const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// ---- Training time ----

// Overlapping or touching spans merged, sorted by start.
export function unionSpans(spans) {
  const sorted = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

const allSpans = (entries) => unionSpans(entries.flatMap(e => e.spans));

// Training time inside [from, to) of already-merged spans.
const timeIn = (merged, from, to) =>
  merged.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);

// Training time per local day: Map "YYYY-MM-DD" → ms.
export function dayTotals(entries) {
  const totals = new Map();
  for (const [a, b] of allSpans(entries)) {
    for (let t = a; t < b;) {
      const next = Math.min(b, addDays(t, 1));
      const key = dayKey(t);
      totals.set(key, (totals.get(key) ?? 0) + (next - t));
      t = next;
    }
  }
  return totals;
}

// ---- Week streak ----

// goal: training days per week. → {
//   current, best: streaks in weeks;
//   days: training days this week; met: this week reached the goal;
//   week: [{ key, trained, today }] Monday to Sunday }
// A week counts once it has `goal` training days. This week only adds once
// it's met, and an unmet week only breaks the streak once it's over.
export function weekStreak(entries, goal, now) {
  const trainedDays = new Set();
  for (const [key, ms] of dayTotals(entries)) if (ms >= TRAINING_DAY_MS) trainedDays.add(key);

  const daysInWeek = (start) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (trainedDays.has(dayKey(addDays(start, i)))) n += 1;
    return n;
  };
  const metWeeks = new Set();
  for (const key of trainedDays) {
    const [y, m, d] = key.split('-').map(Number);
    const start = weekStart(new Date(y, m - 1, d).getTime());
    if (!metWeeks.has(start) && daysInWeek(start) >= goal) metWeeks.add(start);
  }

  const thisWeek = weekStart(now);
  const prev = (start) => addDays(start, -7);
  let current = 0;
  for (let w = metWeeks.has(thisWeek) ? thisWeek : prev(thisWeek); metWeeks.has(w); w = prev(w)) {
    current += 1;
  }

  let best = 0;
  let run = 0;
  let last = null;
  for (const w of [...metWeeks].sort((a, b) => a - b)) {
    run = last != null && prev(w) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = w;
  }

  const today = dayKey(now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = dayKey(addDays(thisWeek, i));
    return { key, trained: trainedDays.has(key), today: key === today };
  });
  const days = week.filter(d => d.trained).length;
  return { current, best, days, met: days >= goal, week };
}

// ---- This week vs last week ----

const countIn = (entries, from, to) => {
  const inWindow = entries.filter(e => e.at >= from && e.at < to);
  return {
    sessions: inWindow.length,
    rounds: inWindow.reduce((n, e) => n + (e.type === 'timer' ? e.roundsDone : 0), 0),
    combos: inWindow.reduce((n, e) => n + (e.type === 'combos' ? e.comboIds.length : 0), 0),
  };
};

// This week so far against last week up to the same weekday (a Thursday is
// compared with last Monday–Thursday). → { now: totals, last: totals }, where
// totals are { timeMs, rounds, combos, sessions }.
export function weekCompare(entries, now) {
  const merged = allSpans(entries);
  const thisStart = weekStart(now);
  const lastStart = addDays(thisStart, -7);
  const lastEnd = addDays(lastStart, weekdayIndex(now) + 1);
  const thisEnd = addDays(thisStart, 7);
  return {
    now: { timeMs: timeIn(merged, thisStart, thisEnd), ...countIn(entries, thisStart, thisEnd) },
    last: { timeMs: timeIn(merged, lastStart, lastEnd), ...countIn(entries, lastStart, lastEnd) },
  };
}

// ---- Last 12 weeks ----

// Oldest first: [{ start, minutes, month }]. month is the month's index under
// the first week that starts in it (the oldest week always gets one, unless
// the next week starts a new month and would crowd it), else null.
export function weeklyMinutes(entries, now, weeks = CHART_WEEKS) {
  const merged = allSpans(entries);
  const thisWeek = weekStart(now);
  const bars = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const minutes = Math.round(timeIn(merged, start, addDays(start, 7)) / 60000);
    bars.push({ start, minutes, month: null });
  }
  bars.forEach((bar, i) => {
    const month = new Date(bar.start).getMonth();
    if (i === 0) {
      const next = bars[1];
      if (!next || new Date(next.start).getMonth() === month) bar.month = month;
    } else if (new Date(bars[i - 1].start).getMonth() !== month) {
      bar.month = month;
    }
  });
  return bars;
}

// ---- Combos, last 30 days ----

const recentComboIds = (entries, now) => {
  const from = addDays(now, -RECENT_DAYS);
  const done = [];
  for (const e of entries) {
    if (e.type !== 'combos' || e.at < from) continue;
    for (const id of e.comboIds) if (COMBO_BY_ID.has(id)) done.push({ id, at: e.at });
  }
  return done;
};

// → { total, types: [{ type, count, pct }] high to low (all seven types),
//     diffs: [{ diff, count, pct }] beg, int, adv }
export function techniqueMix(entries, now) {
  const done = recentComboIds(entries, now);
  const byType = new Map(TYPE_ORDER.map(t => [t, 0]));
  const byDiff = new Map([['beg', 0], ['int', 0], ['adv', 0]]);
  for (const { id } of done) {
    const combo = COMBO_BY_ID.get(id);
    byType.set(combo.type, (byType.get(combo.type) ?? 0) + 1);
    byDiff.set(combo.diff, (byDiff.get(combo.diff) ?? 0) + 1);
  }
  const total = done.length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const types = TYPE_ORDER
    .map((type, i) => ({ type, count: byType.get(type), pct: pct(byType.get(type)), i }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ i, ...t }) => t);
  const diffs = [...byDiff].map(([diff, count]) => ({ diff, count, pct: pct(count) }));
  return { total, types, diffs };
}

// Top combos by times done: [{ combo, count }], ties to the most recent.
export function mostDrilled(entries, now, limit = TOP_DRILLED) {
  const tally = new Map();
  for (const { id, at } of recentComboIds(entries, now)) {
    const t = tally.get(id) ?? { count: 0, lastAt: 0 };
    tally.set(id, { count: t.count + 1, lastAt: Math.max(t.lastAt, at) });
  }
  return [...tally]
    .sort(([, a], [, b]) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, limit)
    .map(([id, { count }]) => ({ combo: COMBO_BY_ID.get(id), count }));
}

// ---- All time ----

export function allTime(entries) {
  const totals = dayTotals(entries);
  const weeks = new Map();
  for (const [key, ms] of totals) {
    const [y, m, d] = key.split('-').map(Number);
    const start = weekStart(new Date(y, m - 1, d).getTime());
    weeks.set(start, (weeks.get(start) ?? 0) + ms);
  }
  let timeMs = 0;
  for (const ms of totals.values()) timeMs += ms;
  return {
    timeMs,
    ...countIn(entries, -Infinity, Infinity),
    bestWeekMs: Math.max(0, ...weeks.values()),
    since: entries.length ? Math.min(...entries.map(e => e.at)) : null,
  };
}

// Training time of one entry (its spans, merged).
export const entryTime = (entry) => timeIn(unionSpans(entry.spans), -Infinity, Infinity);
