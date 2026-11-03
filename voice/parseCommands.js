import { parseCommands as parseComboCommands } from './comboGrammar';
import { parseTimerCommands } from './timerGrammar';

// Combo and timer commands in one list, in spoken order. Each carries
// domain: 'combo' | 'timer'; timer set/duration commands have final: true.
export function parseCommands(transcript) {
  const combo = parseComboCommands(transcript).map(c => ({ ...c, domain: 'combo' }));
  return [...combo, ...parseTimerCommands(transcript)].sort((a, b) => a.pos - b.pos);
}

const isStop = (c) => c.key === 'timer:stop';
const keys = (commands) => commands.map(c => c.key).join(' ');

// The commands to act on from every alternative the recognizer offers (best
// guess first), not just the top one — the correct "combo N" is frequently the
// 2nd or 3rd. Prefer the one that contains the most commands (earliest
// alternative wins ties).
//
// "start timer" is often heard as "stop timer", which does nothing while the
// timer is idle. Then a "start timer" in another alternative wins, and a stop
// waits for the final result, which is where the alternatives come. Never the
// other way round: a lower guess must not stop a running round.
export function parseAlternatives(transcripts, { timerIdle = false } = {}) {
  const parsed = transcripts.map(parseCommands);
  let best = [];
  for (const commands of parsed) {
    if (commands.length > best.length) best = commands;
  }
  if (!timerIdle || !best.some(isStop)) return best;
  const asStart = keys(best.map(c => (isStop(c) ? { key: 'timer:start' } : c)));
  return parsed.find(commands => keys(commands) === asStart)
    ?? best.map(c => (isStop(c) ? { ...c, tentative: true } : c));
}
