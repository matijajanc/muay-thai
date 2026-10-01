import {
  buildSegments, totalMsOf, openPiece, closePiece, workSummary, activeSpans,
} from '../roundTimer';
import {
  isEntry, upsertEntry, removeEntry, timerEntry, comboSpans, comboEntry, MAX_ENTRIES,
} from '../history';

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 8, 30, 16, 0); // any wall-clock start

// 5 × 3:00, rest 2:00, 10 s lead-in: 23:10 in all.
const MUAY_THAI = {
  rounds: 5, roundSec: 180, restSec: 120, delaySec: 10,
  roundWarnSec: 10, restWarnSec: 10, beeps: true, voice: true, vibrate: false,
};

function makeRun(config = MUAY_THAI, kind = 'workout', presetName = 'Muay Thai') {
  const segments = buildSegments(config);
  return { kind, config, presetName, segments, totalMs: totalMsOf(segments), doneAt: null };
}

describe('activity pieces', () => {
  it('closes the open piece, clamped to the end of the run', () => {
    const pieces = openPiece([], T0, 0);
    expect(closePiece(pieces, T0 + 5000, 60000)).toEqual([{ w0: T0, e0: 0, w1: T0 + 5000 }]);
    // Back from the background long after the final bell.
    expect(closePiece(pieces, T0 + 10 * MIN, 60000)).toEqual([{ w0: T0, e0: 0, w1: T0 + 60000 }]);
  });

  it('leaves closed pieces alone', () => {
    const closed = [{ w0: T0, e0: 0, w1: T0 + 1000 }];
    expect(closePiece(closed, T0 + 5000, 60000)).toBe(closed);
  });
});

describe('workSummary', () => {
  const run = makeRun();

  it('counts a full run', () => {
    const pieces = [{ w0: T0, e0: 0, w1: T0 + run.totalMs }];
    expect(workSummary(run.segments, pieces)).toEqual({ roundsDone: 5, workMs: 15 * MIN });
  });

  it('leaves pauses out: the clock stands still', () => {
    // Paused 5 min in the middle of round 1 (10 s lead-in + 90 s in).
    const pieces = [
      { w0: T0, e0: 0, w1: T0 + 100000 },
      { w0: T0 + 400000, e0: 100000, w1: T0 + 400000 + run.totalMs - 100000 },
    ];
    expect(workSummary(run.segments, pieces)).toEqual({ roundsDone: 5, workMs: 15 * MIN });
  });

  it('counts rounds run to their end when stopped early', () => {
    // Stopped 1:00 into round 3: 10 s + 3:00 + 2:00 + 3:00 + 2:00 + 1:00.
    const pieces = [{ w0: T0, e0: 0, w1: T0 + 670000 }];
    expect(workSummary(run.segments, pieces)).toEqual({ roundsDone: 2, workMs: 7 * MIN });
  });

  it('leaves out skipped time, and a skipped round is not done', () => {
    // Round 1 skipped after 30 s: the clock jumps to the start of rest 1.
    const pieces = [
      { w0: T0, e0: 0, w1: T0 + 40000 },
      { w0: T0 + 40000, e0: 190000, w1: T0 + 40000 + 300000 }, // rest 1 + round 2
    ];
    expect(workSummary(run.segments, pieces)).toEqual({ roundsDone: 1, workMs: 210000 });
  });
});

describe('activeSpans', () => {
  const run = makeRun();

  it('leaves out the lead-in and pauses, keeps rests', () => {
    const pieces = [
      { w0: T0, e0: 0, w1: T0 + 100000 },
      { w0: T0 + 400000, e0: 100000, w1: T0 + 400000 + 200000 },
    ];
    expect(activeSpans(run.segments, pieces)).toEqual([
      [T0 + 10000, T0 + 100000],
      [T0 + 400000, T0 + 600000],
    ]);
  });

  it('drops a piece that never got past the lead-in', () => {
    const pieces = [{ w0: T0, e0: 0, w1: T0 + 6000 }];
    expect(activeSpans(run.segments, pieces)).toEqual([]);
  });

  it('starts at the first piece when there is no lead-in', () => {
    const noDelay = makeRun({ ...MUAY_THAI, delaySec: 0 });
    expect(activeSpans(noDelay.segments, [{ w0: T0, e0: 0, w1: T0 + 5000 }])).toEqual([[T0, T0 + 5000]]);
  });
});

describe('timerEntry', () => {
  it('logs a completed workout', () => {
    const run = makeRun();
    const entry = timerEntry(run, [{ w0: T0, e0: 0, w1: T0 + run.totalMs }], true);
    expect(entry).toEqual({
      id: `timer-${T0}`,
      type: 'timer',
      at: T0,
      kind: 'workout',
      presetName: 'Muay Thai',
      roundSec: 180,
      rounds: 5,
      roundsDone: 5,
      workMs: 15 * MIN,
      completed: true,
      spans: [[T0 + 10000, T0 + run.totalMs]],
    });
    expect(isEntry(entry)).toBe(true);
  });

  it('logs a completed countdown as 1 round', () => {
    const run = makeRun({ ...MUAY_THAI, rounds: 1, roundSec: 120, restSec: 0 }, 'countdown', null);
    const entry = timerEntry(run, [{ w0: T0, e0: 0, w1: T0 + run.totalMs }], true);
    expect(entry).toMatchObject({ kind: 'countdown', presetName: null, rounds: 1, roundsDone: 1, workMs: 2 * MIN });
    expect(isEntry(entry)).toBe(true);
  });

  it('logs a run stopped early only after at least 60 s of round time', () => {
    const run = makeRun();
    // 10 s lead-in + 59 s of round 1.
    expect(timerEntry(run, [{ w0: T0, e0: 0, w1: T0 + 69000 }], false)).toBeNull();
    const entry = timerEntry(run, [{ w0: T0, e0: 0, w1: T0 + 70000 }], false);
    expect(entry).toMatchObject({ completed: false, roundsDone: 0, workMs: 60000 });
  });

  it('keeps ∞ rounds as null', () => {
    const run = makeRun({ ...MUAY_THAI, rounds: null });
    const entry = timerEntry(run, [{ w0: T0, e0: 0, w1: T0 + 10 * MIN }], false);
    expect(entry.rounds).toBeNull();
    expect(isEntry(entry)).toBe(true);
  });

  it('logs nothing without activity', () => {
    expect(timerEntry(makeRun(), [], true)).toBeNull();
  });
});

describe('comboSpans', () => {
  it('joins activations less than 5 min apart, each counting 60 s', () => {
    const acts = [T0, T0 + 2 * MIN, T0 + 6 * MIN];
    expect(comboSpans(acts)).toEqual([[T0, T0 + 7 * MIN]]);
  });

  it('a gap over 5 min (lunch) starts a new window', () => {
    const acts = [T0, T0 + MIN, T0 + 60 * MIN];
    expect(comboSpans(acts)).toEqual([[T0, T0 + 2 * MIN], [T0 + 60 * MIN, T0 + 61 * MIN]]);
  });

  it('exactly 5 min of idle still joins', () => {
    expect(comboSpans([T0, T0 + 6 * MIN])).toEqual([[T0, T0 + 7 * MIN]]);
  });

  it('finishing cuts the last combo short or extends the window to it', () => {
    expect(comboSpans([T0, T0 + 2 * MIN], T0 + 2 * MIN + 20000)).toEqual([[T0, T0 + 2 * MIN + 20000]]);
    expect(comboSpans([T0, T0 + 2 * MIN], T0 + 5 * MIN)).toEqual([[T0, T0 + 5 * MIN]]);
    // Finished long after: the idle time isn't training.
    expect(comboSpans([T0], T0 + 30 * MIN)).toEqual([[T0, T0 + MIN]]);
  });

  it('activations after an earlier finish (keep training) count in full', () => {
    expect(comboSpans([T0, T0 + 3 * MIN], T0 + 2 * MIN)).toEqual([[T0, T0 + 4 * MIN]]);
  });

  it('sorts the activations', () => {
    expect(comboSpans([T0 + MIN, T0])).toEqual([[T0, T0 + 2 * MIN]]);
  });
});

describe('comboEntry', () => {
  it('builds the entry from the first activation', () => {
    const entry = comboEntry({
      id: 'session-1', activations: [T0 + MIN, T0], doneIds: [3, 7], total: 10,
    });
    expect(entry).toEqual({
      id: 'session-1', type: 'combos', at: T0, comboIds: [3, 7], total: 10, spans: [[T0, T0 + 2 * MIN]],
    });
    expect(isEntry(entry)).toBe(true);
  });

  it('logs nothing when no combo was done', () => {
    expect(comboEntry({ id: 's', activations: [T0], doneIds: [], total: 10 })).toBeNull();
    expect(comboEntry({ id: 's', activations: [], doneIds: [1], total: 10 })).toBeNull();
  });
});

describe('the log', () => {
  const entry = (id, at) => ({ id, type: 'combos', at, comboIds: [1], total: 10, spans: [] });

  it('keeps entries newest first', () => {
    let log = [];
    log = upsertEntry(log, entry('a', 100));
    log = upsertEntry(log, entry('c', 300));
    log = upsertEntry(log, entry('b', 200));
    expect(log.map(e => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('replaces an entry with the same id in place', () => {
    let log = [entry('c', 300), entry('b', 200), entry('a', 100)];
    log = upsertEntry(log, { ...entry('b', 200), total: 8 });
    expect(log.map(e => e.id)).toEqual(['c', 'b', 'a']);
    expect(log[1].total).toBe(8);
  });

  it('is capped, dropping the oldest', () => {
    let log = Array.from({ length: MAX_ENTRIES }, (_, i) => entry(`e${i}`, MAX_ENTRIES - i));
    log = upsertEntry(log, entry('new', MAX_ENTRIES + 1));
    expect(log).toHaveLength(MAX_ENTRIES);
    expect(log[0].id).toBe('new');
    expect(log.some(e => e.id === `e${MAX_ENTRIES - 1}`)).toBe(false);
  });

  it('removes by id', () => {
    expect(removeEntry([entry('a', 1), entry('b', 2)], 'a').map(e => e.id)).toEqual(['b']);
  });

  it.each([
    ['no id', { ...entry('a', 1), id: 3 }],
    ['an unknown type', { ...entry('a', 1), type: 'yoga' }],
    ['a bad span', { ...entry('a', 1), spans: [[5, 2]] }],
    ['non-integer combo ids', { ...entry('a', 1), comboIds: ['x'] }],
    ['a timer without kind', { id: 't', type: 'timer', at: 1, spans: [] }],
    ['null', null],
  ])('rejects a stored entry with %s', (_, e) => {
    expect(isEntry(e)).toBe(false);
  });
});
