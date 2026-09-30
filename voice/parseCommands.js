import { parseCommands as parseComboCommands } from './comboGrammar';
import { parseTimerCommands } from './timerGrammar';

// Combo and timer commands in one list, in spoken order. Each carries
// domain: 'combo' | 'timer'; timer set/duration commands have final: true.
export function parseCommands(transcript) {
  const combo = parseComboCommands(transcript).map(c => ({ ...c, domain: 'combo' }));
  return [...combo, ...parseTimerCommands(transcript)].sort((a, b) => a.pos - b.pos);
}
