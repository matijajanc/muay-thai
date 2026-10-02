// Picking a training session: pure functions, no React.
import { COMBOS } from '../data/combos';

// Combos per session: the Settings choices and the default.
export const SESSION_SIZES = [5, 10, 15, 20];
export const SESSION_SIZE = 10;
export const MAX_SESSION_SIZE = 20;

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

// Shuffled, with combos the previous session didn't have first.
function freshFirst(list, previousIds) {
  return [
    ...shuffle(list.filter(c => !previousIds.has(c.id))),
    ...shuffle(list.filter(c => previousIds.has(c.id))),
  ];
}

// How many saved favorites to mix into a session: 2 or 3 at random, or all of
// them when there are fewer than 3.
export function favoriteMixCount(available, random = Math.random) {
  if (available < 3) return available;
  return random() < 0.5 ? 2 : 3;
}

// Up to `size` combos in random order, preferring ones the previous session
// didn't have. `favoriteCount` of `favorites` are always in it (they take their
// place within `size`); the rest come from the pool.
export function pickSession(
  pool, previousIds = new Set(), favorites = [], favoriteCount = 0, size = SESSION_SIZE,
) {
  const mixed = freshFirst(favorites, previousIds).slice(0, Math.min(favoriteCount, size));
  const mixedIds = new Set(mixed.map(c => c.id));
  const rest = freshFirst(pool.filter(c => !mixedIds.has(c.id)), previousIds);
  return shuffle([...mixed, ...rest].slice(0, size));
}
