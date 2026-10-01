// Training log: pure entry builders and validation, no React, no storage.
//
// Entries, newest first (by `at`), one AsyncStorage key (hooks/useHistory.js):
//   timer:  { id, type: 'timer', at, kind, presetName, roundSec, rounds,
//             roundsDone, workMs, completed, spans }
//   combos: { id, type: 'combos', at, comboIds, total, spans }
// `spans` are wall-clock [start, end] windows of actual training, used for
// training time and streaks. What gets logged when: wireframe section 5.

import { workSummary, activeSpans } from './roundTimer';

export const MAX_ENTRIES = 2000;
// A run stopped early is only logged with at least this much round time done.
export const MIN_PARTIAL_WORK_MS = 60 * 1000;
// One combo activation counts as this much drilling (its 60 s bar)…
export const COMBO_ACTIVE_MS = 60 * 1000;
// …and activity closer together than this joins up into one window.
export const COMBO_IDLE_GAP_MS = 5 * 60 * 1000;

const isNum = (v, min = 0) => Number.isFinite(v) && v >= min;
const isSpans = (spans) =>
  Array.isArray(spans) && spans.every(s => Array.isArray(s) && s.length === 2 && isNum(s[0]) && s[1] >= s[0]);

// An entry as read back from storage.
export function isEntry(e) {
  if (!e || typeof e.id !== 'string' || !isNum(e.at) || !isSpans(e.spans)) return false;
  if (e.type === 'timer') {
    return (e.kind === 'workout' || e.kind === 'countdown')
      && (e.presetName === null || typeof e.presetName === 'string')
      && isNum(e.roundSec, 1)
      && (e.rounds === null || (Number.isInteger(e.rounds) && e.rounds >= 1))
      && Number.isInteger(e.roundsDone) && e.roundsDone >= 0
      && isNum(e.workMs)
      && typeof e.completed === 'boolean';
  }
  if (e.type === 'combos') {
    return Array.isArray(e.comboIds) && e.comboIds.every(Number.isInteger)
      && Number.isInteger(e.total) && e.total >= 0;
  }
  return false;
}

// Adds the entry, or replaces the one with its id. Newest first, capped.
export function upsertEntry(entries, entry) {
  const next = entries.filter(e => e.id !== entry.id);
  const i = next.findIndex(e => e.at < entry.at);
  next.splice(i < 0 ? next.length : i, 0, entry);
  return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
}

export const removeEntry = (entries, id) => entries.filter(e => e.id !== id);

// ---- Timer ----

// run: useRoundTimer's run; pieces: its activity pieces (utils/roundTimer.js),
// all closed. → the entry, or null when a run stopped early isn't worth logging.
export function timerEntry(run, pieces, completed) {
  if (pieces.length === 0) return null;
  const { roundsDone, workMs } = workSummary(run.segments, pieces);
  if (!completed && workMs < MIN_PARTIAL_WORK_MS) return null;
  return {
    id: `timer-${pieces[0].w0}`,
    type: 'timer',
    at: pieces[0].w0,
    kind: run.kind,
    presetName: run.presetName,
    roundSec: run.config.roundSec,
    rounds: run.kind === 'countdown' ? 1 : run.config.rounds,
    roundsDone,
    workMs,
    completed,
    spans: activeSpans(run.segments, pieces),
  };
}

// ---- Combo sessions ----

// Activity windows of a combo session. activations: when combos were opened
// (epoch ms); each counts for COMBO_ACTIVE_MS, cut short by finishedAt.
// finishedAt (or null): when it was finished; that extends the last window if
// it came soon enough.
export function comboSpans(activations, finishedAt = null) {
  const spans = [];
  const sorted = [...activations].sort((a, b) => a - b);
  for (const t of sorted) {
    let end = t + COMBO_ACTIVE_MS;
    if (finishedAt != null && finishedAt >= t) end = Math.min(end, finishedAt);
    const last = spans[spans.length - 1];
    if (last && t - last[1] <= COMBO_IDLE_GAP_MS) last[1] = Math.max(last[1], end);
    else spans.push([t, end]);
  }
  const last = spans[spans.length - 1];
  if (last && finishedAt != null && finishedAt > last[1] && finishedAt - last[1] <= COMBO_IDLE_GAP_MS) {
    last[1] = finishedAt;
  }
  return spans;
}

// id: the session's id; doneIds: combo ids done; total: combos in the session.
// → the entry, or null when no combo was done.
export function comboEntry({ id, activations, doneIds, total, finishedAt = null }) {
  if (doneIds.length === 0 || activations.length === 0) return null;
  return {
    id,
    type: 'combos',
    at: Math.min(...activations),
    comboIds: [...doneIds],
    total,
    spans: comboSpans(activations, finishedAt),
  };
}
