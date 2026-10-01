// Round-timer engine: pure functions, no React, no timers.
//
// A run is a list of segments (lead-in, rounds, rests) and a list of cues
// precomputed from the config. The position is always derived from wall-clock
// elapsed time (now − startedAt − pausedTotal), never from counting ticks, so it
// can't drift and pausing is exact.

export const MAX_ROUNDS = 20;
// ∞ rounds (rounds: null) run as this many rounds internally.
const INFINITE_ROUNDS = 99;
// Cues found more than this late (e.g. after returning from the background)
// are dropped silently rather than played in a burst.
export const LATE_CUE_MS = 1500;

export const isInfinite = (rounds) => rounds == null;
const roundCount = (rounds) => (isInfinite(rounds) ? INFINITE_ROUNDS : rounds);

// config: { roundSec, restSec, rounds (null = ∞), delaySec, roundWarnSec, restWarnSec }
// → [{ kind: 'prep' | 'work' | 'rest', round, startMs, durMs, warnMs }]
// `round` is the round a work segment belongs to; for a rest it's the round
// just finished; for the lead-in it's 1. There's no rest after the last round.
// warnMs is 0 when the phase has no warning window, which is also the case when
// the phase is shorter than twice the window.
export function buildSegments(config) {
  const segments = [];
  let t = 0;
  const push = (kind, round, sec, warnSec = 0) => {
    const durMs = sec * 1000;
    const warnMs = warnSec > 0 && sec >= 2 * warnSec ? warnSec * 1000 : 0;
    segments.push({ kind, round, startMs: t, durMs, warnMs });
    t += durMs;
  };
  if (config.delaySec > 0) push('prep', 1, config.delaySec);
  const n = roundCount(config.rounds);
  for (let r = 1; r <= n; r++) {
    push('work', r, config.roundSec, config.roundWarnSec);
    if (r < n && config.restSec > 0) push('rest', r, config.restSec, config.restWarnSec);
  }
  return segments;
}

export const totalMsOf = (segments) => {
  const last = segments[segments.length - 1];
  return last ? last.startMs + last.durMs : 0;
};

const SECONDS_WORDS = { 5: 'Five', 10: 'Ten', 15: 'Fifteen', 30: 'Thirty' };
// The spoken warning line: "Ten seconds".
export const secondsPhrase = (sec) => `${SECONDS_WORDS[sec] ?? sec} seconds`;

// → sorted [{ atMs, sound?, say?, vibrate? }]. Timeline: wireframe section 4.
// config also carries { beeps, voice, vibrate }; kind is 'workout' | 'countdown'.
// No spoken line contains a voice-command trigger word.
export function buildCues(segments, config, kind = 'workout') {
  const cues = [];
  const add = (atMs, cue) => {
    if (!config.voice) delete cue.say;
    if (cue.sound || cue.say) cues.push({ atMs, ...cue });
  };
  const vibrate = !!config.vibrate;

  segments.forEach((seg, i) => {
    const end = seg.startMs + seg.durMs;
    const next = segments[i + 1];

    if (seg.kind === 'prep') add(seg.startMs, { say: 'Get ready' });

    if (seg.kind === 'work') {
      let line;
      if (kind === 'workout') line = !next && seg.round > 1 ? 'Last round' : `Round ${seg.round}`;
      add(seg.startMs, { sound: 'bell', vibrate, say: line });
      if (seg.warnMs) add(end - seg.warnMs, { sound: 'clap', say: secondsPhrase(seg.warnMs / 1000) });
      if (!next) {
        add(end, {
          sound: 'bell-x3',
          vibrate,
          say: kind === 'countdown' ? 'Time.' : 'Time. Workout complete.',
        });
      } else if (next.kind === 'rest') {
        add(end, { sound: 'bell-x3', vibrate, say: 'Rest' });
      }
      // With no rest, the next round's start bell marks the change on its own.
    }

    if (seg.kind === 'rest' && seg.warnMs) {
      add(end - seg.warnMs, { sound: 'rest-warn', say: secondsPhrase(seg.warnMs / 1000) });
    }

    // 3-2-1 into every round that follows the lead-in or a rest.
    if ((seg.kind === 'prep' || seg.kind === 'rest') && config.beeps) {
      for (const s of [3, 2, 1]) if (seg.durMs >= s * 1000) add(end - s * 1000, { sound: 'beep' });
    }
  });

  return cues.sort((a, b) => a.atMs - b.atMs);
}

// Where the run is at elapsedMs.
export function positionAt(segments, elapsedMs) {
  const totalMs = totalMsOf(segments);
  const e = Math.max(0, elapsedMs);
  if (e >= totalMs) {
    return {
      done: true, index: segments.length, segment: null, next: null, phase: 'done', round: null,
      remainingMs: 0, progress: 1, totalLeftMs: 0, warn: false,
    };
  }
  let index = segments.findIndex(s => e < s.startMs + s.durMs);
  if (index < 0) index = segments.length - 1;
  const segment = segments[index];
  const into = e - segment.startMs;
  const remainingMs = segment.durMs - into;
  return {
    done: false,
    index,
    segment,
    next: segments[index + 1] ?? null,
    phase: segment.kind,
    round: segment.round,
    remainingMs,
    progress: into / segment.durMs,
    totalLeftMs: totalMs - e,
    warn: segment.warnMs > 0 && remainingMs <= segment.warnMs,
  };
}

// ---- Clock: { startedAt, pausedAt, pausedTotal } in epoch ms ----

export const startClock = (now) => ({ startedAt: now, pausedAt: null, pausedTotal: 0 });

export const elapsedMs = (clock, now) =>
  (clock.pausedAt ?? now) - clock.startedAt - clock.pausedTotal;

export const pauseClock = (clock, now) =>
  clock.pausedAt != null ? clock : { ...clock, pausedAt: now };

export const resumeClock = (clock, now) =>
  clock.pausedAt == null
    ? clock
    : { ...clock, pausedAt: null, pausedTotal: clock.pausedTotal + (now - clock.pausedAt) };

// A clock that reads `targetMs` elapsed at `now`, keeping the paused state.
export const seekClock = (clock, now, targetMs) => ({
  startedAt: now - targetMs,
  pausedAt: clock.pausedAt != null ? now : null,
  pausedTotal: 0,
});

// ---- Cue scheduling ----

// Index of the first cue at or after elapsedMs: where to resume after a seek.
export const cueIndexAt = (cues, elapsedMs) => {
  const i = cues.findIndex(c => c.atMs >= elapsedMs);
  return i < 0 ? cues.length : i;
};

// Cues due at elapsedMs, starting from index `from`.
// → { due: cues to play now, next: the new index }. Cues more than lateMs
// late are skipped silently, and when catching up (e.g. back from the
// background) only the latest moment plays, so 3-2-1 never comes out as a burst.
export function dueCues(cues, from, elapsedMs, lateMs = LATE_CUE_MS) {
  let due = [];
  let i = from;
  for (; i < cues.length && cues[i].atMs <= elapsedMs; i++) {
    if (elapsedMs - cues[i].atMs <= lateMs) due.push(cues[i]);
  }
  if (due.length > 1) {
    const latest = due[due.length - 1].atMs;
    due = due.filter(c => c.atMs === latest);
  }
  return { due, next: i };
}

// ---- Totals & formatting ----

// Whole workout length in seconds, lead-in included; null for ∞ rounds.
export function workoutTotalSec(config) {
  if (isInfinite(config.rounds)) return null;
  const n = config.rounds;
  return config.delaySec + n * config.roundSec + (n - 1) * config.restSec;
}

// 180 → "3:00", 42 → "0:42"
export const formatClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Countdown display rounds up, so a phase shows its full length at the start
// and reaches 0 exactly when it ends.
export const ceilSec = (ms) => Math.max(0, Math.ceil(ms / 1000));

// ---- Activity (training log) ----
//
// A run's activity is a list of pieces { w0, e0, w1 }: from wall time w0, when
// the run was at e0 elapsed, it ran without pausing until w1 (null while it's
// still running). Pausing closes a piece; resuming, skipping and restarting a
// phase open a new one.

export const openPiece = (pieces, now, elapsed) => [...pieces, { w0: now, e0: elapsed, w1: null }];

// Closes the open piece at `now`, or where the run ended if that was earlier.
export function closePiece(pieces, now, totalMs) {
  const last = pieces[pieces.length - 1];
  if (!last || last.w1 != null) return pieces;
  const w1 = Math.max(last.w0, Math.min(now, last.w0 + totalMs - last.e0));
  return [...pieces.slice(0, -1), { ...last, w1 }];
}

// The elapsed ranges actually run, [[from, to]] (closed pieces only).
const ranges = (pieces) =>
  pieces.filter(p => p.w1 != null).map(p => [p.e0, p.e0 + (p.w1 - p.w0)]);

// → { roundsDone, workMs }: rounds run to their end (a skipped round isn't
// done) and the round time actually run (rests, the lead-in and skipped time
// left out).
export function workSummary(segments, pieces) {
  let roundsDone = 0;
  let workMs = 0;
  const lived = ranges(pieces);
  for (const seg of segments) {
    if (seg.kind !== 'work') continue;
    const end = seg.startMs + seg.durMs;
    if (lived.some(([a, b]) => a < end && b >= end)) roundsDone += 1;
    for (const [a, b] of lived) workMs += Math.max(0, Math.min(b, end) - Math.max(a, seg.startMs));
  }
  return { roundsDone, workMs };
}

// Wall-clock [[start, end]] spans of training: the closed pieces without the
// lead-in (rests count, pauses don't).
export function activeSpans(segments, pieces) {
  const prepEnd = segments[0]?.kind === 'prep' ? segments[0].durMs : 0;
  const spans = [];
  for (const p of pieces) {
    if (p.w1 == null) continue;
    const start = p.w0 + Math.max(0, prepEnd - p.e0);
    if (p.w1 > start) spans.push([start, p.w1]);
  }
  return spans;
}
