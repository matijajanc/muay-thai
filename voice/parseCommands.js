import { parseCommands as parseComboCommands } from './comboGrammar';
import { parseTimerCommands, saysStartTimer } from './timerGrammar';

// Combo and timer commands in one list, in spoken order. Each carries
// domain: 'combo' | 'timer'; timer set/duration commands have final: true.
export function parseCommands(transcript) {
  const combo = parseComboCommands(transcript).map(c => ({ ...c, domain: 'combo' }));
  return [...combo, ...parseTimerCommands(transcript)].sort((a, b) => a.pos - b.pos);
}

const isStop = (c) => c.key === 'timer:stop';
const keys = (commands) => commands.map(c => c.key).join(' ');
// How much of what was said an alternative understood. A workout ("2 minute
// timer 2 rounds") says both a round time and a round count, so it outweighs
// an alternative that only caught the countdown ("… two routes").
const weight = (commands) => commands.reduce((n, c) => n + (c.type === 'workout' ? 2 : 1), 0);

// The commands to act on from every alternative the recognizer offers (best
// guess first), not just the top one — the correct "combo N" is frequently the
// 2nd or 3rd. Prefer the one that understood the most (earliest alternative
// wins ties).
//
// "start timer" is often heard as "stop timer", which does nothing useful while
// nothing runs. Then a "start timer" (or "start time") in another alternative
// wins, and a stop waits for the final result, which is where the alternatives
// come. Never the other way round: a lower guess must not stop a running round.
export function parseAlternatives(transcripts, { timerIdle = false } = {}) {
  const parsed = transcripts.map(parseCommands);
  let best = [];
  for (const commands of parsed) {
    if (weight(commands) > weight(best)) best = commands;
  }
  if (!timerIdle || !best.some(isStop)) return best;
  const asStart = best.map(c => (isStop(c) ? { ...c, type: 'start', key: 'timer:start' } : c));
  const exact = parsed.find(commands => keys(commands) === keys(asStart));
  if (exact) return exact;
  if (transcripts.some(saysStartTimer)) return asStart;
  return best.map(c => (isStop(c) ? { ...c, tentative: true } : c));
}
