import { COMBOS } from '../../data/combos';
import { filterCombos, pickSession, favoriteMixCount, SESSION_SIZE } from '../sessionPicker';

const set = (...keys) => new Set(keys);

describe('combo data', () => {
  it('has unique ids and names', () => {
    expect(new Set(COMBOS.map(c => c.id)).size).toBe(COMBOS.length);
    expect(new Set(COMBOS.map(c => c.name)).size).toBe(COMBOS.length);
  });
});

describe('filterCombos', () => {
  it('treats an empty selection as "any"', () => {
    expect(filterCombos(set(), set())).toHaveLength(COMBOS.length);
  });

  it('matches difficulty and type together', () => {
    const pool = filterCombos(set('adv'), set('deadliest'));
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(c => c.diff === 'adv' && c.type === 'deadliest')).toBe(true);
  });

  it('returns nothing for a mix with no combos, never the whole library', () => {
    expect(filterCombos(set('beg'), set('elbows'))).toEqual([]);
    expect(filterCombos(set('beg'), set('deadliest'))).toEqual([]);
  });
});

describe('pickSession', () => {
  const pool = COMBOS.slice(0, 20);

  it('picks up to SESSION_SIZE distinct combos from the pool', () => {
    const session = pickSession(pool);
    expect(session).toHaveLength(SESSION_SIZE);
    expect(new Set(session.map(c => c.id)).size).toBe(SESSION_SIZE);
    expect(session.every(c => pool.includes(c))).toBe(true);
  });

  it('uses the whole pool when it is small', () => {
    expect(pickSession(pool.slice(0, 4))).toHaveLength(4);
  });

  it.each([5, 15, 20])('picks %d combos when asked to', (size) => {
    const session = pickSession(COMBOS, new Set(), [], 0, size);
    expect(session).toHaveLength(size);
    expect(new Set(session.map(c => c.id)).size).toBe(size);
  });

  it('avoids the previous session while there are enough other combos', () => {
    const previous = new Set(pool.slice(0, 10).map(c => c.id));
    const session = pickSession(pool, previous);
    expect(session.some(c => previous.has(c.id))).toBe(false);
  });

  it('tops up with repeats only when it must', () => {
    const small = pool.slice(0, 12);
    const previous = new Set(small.slice(0, 10).map(c => c.id));
    const session = pickSession(small, previous);
    expect(session.filter(c => !previous.has(c.id))).toHaveLength(2);
  });
});

describe('mixing in favorites', () => {
  const pool = COMBOS.filter(c => c.diff === 'beg');
  const favorites = COMBOS.filter(c => c.diff === 'adv').slice(0, 5);
  const favIds = new Set(favorites.map(c => c.id));

  it('mixes in 2 or 3, or all of them when there are fewer than 3', () => {
    expect(favoriteMixCount(0)).toBe(0);
    expect(favoriteMixCount(1)).toBe(1);
    expect(favoriteMixCount(2)).toBe(2);
    expect(favoriteMixCount(5, () => 0.1)).toBe(2);
    expect(favoriteMixCount(5, () => 0.9)).toBe(3);
  });

  it.each([2, 3])('keeps the session at SESSION_SIZE with %d favorites in it', (count) => {
    const session = pickSession(pool, new Set(), favorites, count);
    expect(session).toHaveLength(SESSION_SIZE);
    expect(new Set(session.map(c => c.id)).size).toBe(SESSION_SIZE);
    expect(session.filter(c => favIds.has(c.id))).toHaveLength(count);
  });

  it('takes favorites outside the filters, without duplicating one already in the pool', () => {
    const session = pickSession(favorites, new Set(), favorites, 3);
    expect(session).toHaveLength(favorites.length);
    expect(new Set(session.map(c => c.id)).size).toBe(favorites.length);
  });

  it('keeps a 5-combo session at 5 with favorites in it', () => {
    const session = pickSession(pool, new Set(), favorites, 3, 5);
    expect(session).toHaveLength(5);
    expect(session.filter(c => favIds.has(c.id))).toHaveLength(3);
  });

  it('changes nothing when no favorites are mixed in', () => {
    const session = pickSession(pool, new Set(), favorites, 0);
    expect(session.some(c => favIds.has(c.id))).toBe(false);
  });
});
