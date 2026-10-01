// User-visible round-timer copy derived from a run and its position, in one
// place so the Timer tab, the Training clock and the tab label agree.
// Strings follow the wireframes (.agent/plan/*boxing-round-timer.wireframes.html).

import { colors } from '../constants/theme';
import { formatClock, ceilSec, isInfinite, secondsPhrase, workoutTotalSec } from './roundTimer';

const roundsOf = (run) => (isInfinite(run.config.rounds) ? null : run.config.rounds);

// Top-left label of the run screens, and a timer entry's title in Stats:
// "Muay Thai · 5 × 3:00" / "Countdown · 2:00". config: { roundSec, rounds }.
export function runLabel(kind, config, presetName) {
  if (kind === 'countdown') return `Countdown · ${formatClock(config.roundSec)}`;
  const rounds = isInfinite(config.rounds) ? '∞' : config.rounds;
  return `${presetName} · ${rounds} × ${formatClock(config.roundSec)}`;
}

// "Round 3 of 5", or "Round 7" with ∞ rounds.
export function roundOf(run, round) {
  const n = roundsOf(run);
  return n ? `Round ${round} of ${n}` : `Round ${round}`;
}

// Phase color: lead-in, round, round-end warning, rest (paused is handled by callers).
export function phaseColor(pos) {
  if (!pos || pos.done) return colors.timerDone;
  if (pos.phase === 'prep') return colors.timerPrep;
  if (pos.phase === 'rest') return colors.timerRest;
  return pos.warn ? colors.timerWarn : colors.timerWork;
}

// Uppercase phase label: GET READY / ROUND 2 OF 5 / COUNTDOWN / REST.
export function phaseLabel(run, pos) {
  if (pos.done) return 'DONE';
  if (pos.phase === 'prep') return 'GET READY';
  if (pos.phase === 'rest') return 'REST';
  if (run.kind === 'countdown') return 'COUNTDOWN';
  return roundOf(run, pos.round).toUpperCase();
}

// Big digits: seconds only during the lead-in, m:ss otherwise.
export function phaseDigits(pos) {
  const sec = ceilSec(pos.remainingMs);
  return pos.phase === 'prep' ? String(sec) : formatClock(sec);
}

// Line under the lead-in digits: "Round 1 of 5" / "Countdown 2:00 starts".
function leadInLine(run) {
  return run.kind === 'countdown'
    ? `Countdown ${formatClock(run.config.roundSec)} starts`
    : roundOf(run, 1);
}

// Line under the ring digits.
export function ringUnder(run, pos, paused) {
  if (paused) return 'paused';
  if (pos.phase === 'prep') return leadInLine(run);
  return `of ${formatClock(pos.segment.durMs / 1000)}`;
}

// "Next" meta card: "Rest 2:00" / "Round 3 of 5".
export function nextLabel(run, pos) {
  const next = pos.next;
  if (!next) return 'Done';
  if (next.kind === 'rest') return `Rest ${formatClock(next.durMs / 1000)}`;
  return roundOf(run, next.round);
}

// "Workout left" meta card.
export const workoutLeft = (run, pos) =>
  isInfinite(run.config.rounds) ? '∞' : formatClock(ceilSec(pos.totalLeftMs));

// Short line in the dial hub (Center clock): "next: rest".
export function hubLine(run, pos, paused) {
  if (paused) return 'PAUSED';
  if (pos.done) return '';
  const next = pos.next;
  if (!next) return run.kind === 'countdown' ? '' : 'last round';
  if (next.kind === 'rest') return 'next: rest';
  if (run.kind === 'countdown') return `next: ${formatClock(next.durMs / 1000)}`;
  return `next: R${next.round}`;
}

// Line beside the band digits (Top/Bottom clock): "Next: Round 3 of 5".
export function bandLine(run, pos, paused) {
  if (paused) return 'Paused';
  if (pos.done) return '';
  if (pos.phase === 'prep') return leadInLine(run);
  if (!pos.next) return run.kind === 'countdown' ? `of ${formatClock(run.config.roundSec)}` : 'Last round';
  return `Next: ${nextLabel(run, pos)}`;
}

// Timer tab label while a run is going. On the Timer tab: the time only.
// Elsewhere: "R2 · 1:12" in a round, "Rest · 0:42" in rest, "0:07" in the
// lead-in or a countdown. Paused adds "❚❚ ".
export function tabLabel(run, pos, paused, onTimerTab) {
  const time = formatClock(ceilSec(pos.remainingMs));
  let text = time;
  if (!onTimerTab) {
    if (pos.phase === 'rest') text = `Rest · ${time}`;
    else if (pos.phase === 'work' && run.kind === 'workout') text = `R${pos.round} · ${time}`;
  }
  return paused ? `❚❚ ${text}` : text;
}

// Header timer pill on Training (J): "5 × 3:00".
export const pillLabel = (settings) =>
  `${isInfinite(settings.rounds) ? '∞' : settings.rounds} × ${formatClock(settings.roundSec)}`;

// Setup subtitle (A): "5 × 3:00 · rest 2:00 · total 23:10".
export function setupSummary(settings) {
  const total = workoutTotalSec(settings);
  const base = `${pillLabel(settings)} · rest ${formatClock(settings.restSec)}`;
  return total == null ? base : `${base} · total ${formatClock(total)}`;
}

// Docked start button (A): "Start · 23:10".
export function startLabel(settings) {
  const total = workoutTotalSec(settings);
  return total == null ? 'Start' : `Start · ${formatClock(total)}`;
}

// Option values: "10 s", "Off".
export const optionLabel = (sec) => (sec > 0 ? `${sec} s` : 'Off');

// Hint under the warning chips (B2).
export function warningHint(kind, sec) {
  if (!sec) return 'No warning';
  return kind === 'round'
    ? `Clap this long before the round ends, and TTS says “${secondsPhrase(sec)}”.`
    : `Beep this long before the rest ends, and TTS says “${secondsPhrase(sec)}”.`;
}

// Hint under the start delay chips (B2).
export const delayHint = (sec) =>
  (sec ? 'Counts down with 3-2-1 beeps, then the start bell.' : 'Starts with the bell right away.');

// Hint on the rest screen (G): "Rest-end warning: a beep at 0:10, then 3-2-1 and the start bell."
export function restHint(run, pos) {
  const warn = pos.segment.warnMs / 1000;
  const beeps = run.config.beeps;
  if (warn && beeps) return `Rest-end warning: a beep at ${formatClock(warn)}, then 3-2-1 and the start bell.`;
  if (warn) return `Rest-end warning: a beep at ${formatClock(warn)}, then the start bell.`;
  if (beeps) return '3-2-1, then the start bell.';
  return 'The start bell ends the rest.';
}

// Done screen (I).
export function doneTitle(run) {
  return run.kind === 'countdown'
    ? `Countdown done · ${formatClock(run.config.roundSec)}`
    : 'Workout complete';
}

export function doneLine(run) {
  if (run.kind === 'countdown') return null;
  const rounds = run.segments.filter(s => s.kind === 'work').length;
  return `${rounds} ${rounds === 1 ? 'round' : 'rounds'} · ${formatClock(run.totalMs / 1000)}`;
}

export const doneSay = (run) => (run.kind === 'countdown' ? '“Time.”' : '“Time. Workout complete.”');
