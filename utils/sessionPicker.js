// Picking a training session: pure functions, no React.
import { COMBOS } from '../data/combos';

export const SESSION_SIZE = 10;

// Combos matching the filter chips; an empty selection means "any".
export function filterCombos(selectedDiffs, selectedTypes, combos = COMBOS) {
  return combos.filter(c =>
    (selectedDiffs.size === 0 || selectedDiffs.has(c.diff))
    && (selectedTypes.size === 0 || selectedTypes.has(c.type)));
}

// Fisher–Yates, on a copy.
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Up to SESSION_SIZE combos from the pool in random order, preferring ones the
// previous session didn't have.
export function pickSession(pool, previousIds = new Set()) {
  const fresh = shuffle(pool.filter(c => !previousIds.has(c.id)));
  const repeats = shuffle(pool.filter(c => previousIds.has(c.id)));
  return shuffle([...fresh, ...repeats].slice(0, SESSION_SIZE));
}
