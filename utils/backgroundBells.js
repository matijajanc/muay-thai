// Round-timer bells while the app is in the background or the screen is off.
// React Native's timers stop there, so what's left of a running run goes to a
// native foreground service (modules/round-bells) that rings the cues at their
// wall-clock times and shows the current phase on the lock screen. Pure, no
// React, no native code.
import { elapsedMs, isInfinite } from './roundTimer';

// ∞ rounds run 99 rounds; this is several hours of cues.
export const MAX_PLAN_CUES = 500;

// The phase's line on the lock screen.
export function phaseTitle(run, segment) {
  if (segment.kind === 'prep') return 'Get ready';
  if (segment.kind === 'rest') return `Rest · round ${segment.round + 1} next`;
  if (run.kind === 'countdown') return 'Countdown';
  return isInfinite(run.config.rounds)
    ? `Round ${segment.round}`
    : `Round ${segment.round} of ${run.config.rounds}`;
}

// What's still ahead of a running run, in wall-clock ms:
// → { label, endAt, phases: [{ at, until, title }], cues: [{ at, sound, vibrate }] },
// or null when nothing is running. A cue due right now is left to the app;
// spoken lines stay in the app (only sounds ring in the background).
export function bellPlan(run, clock, now, maxCues = MAX_PLAN_CUES) {
  if (!run || !clock || clock.pausedAt != null || run.doneAt) return null;
  const e = elapsedMs(clock, now);
  if (e >= run.totalMs) return null;
  const toWall = (ms) => now + (ms - e);
  const phases = run.segments
    .filter(s => s.startMs + s.durMs > e)
    .map(s => ({ at: toWall(s.startMs), until: toWall(s.startMs + s.durMs), title: phaseTitle(run, s) }));
  const cues = run.cues
    .filter(c => c.sound && c.atMs > e)
    .slice(0, maxCues)
    .map(c => ({ at: toWall(c.atMs), sound: c.sound, vibrate: !!c.vibrate }));
  return { label: run.label, endAt: toWall(run.totalMs), phases, cues };
}
