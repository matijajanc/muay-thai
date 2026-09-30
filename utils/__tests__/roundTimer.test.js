import {
  buildSegments, buildCues, positionAt, totalMsOf, startClock, elapsedMs, pauseClock,
  resumeClock, seekClock, cueIndexAt, dueCues, workoutTotalSec, formatClock, ceilSec,
  secondsPhrase,
} from '../roundTimer';

const MUAY_THAI = {
  rounds: 5, roundSec: 180, restSec: 120, delaySec: 10,
  roundWarnSec: 10, restWarnSec: 10, beeps: true, voice: true, vibrate: false,
};

describe('buildSegments', () => {
  it('builds lead-in, rounds and rests with no rest after the last round', () => {
    const segs = buildSegments(MUAY_THAI);
    expect(segs.map(s => `${s.kind}${s.round}`)).toEqual([
      'prep1', 'work1', 'rest1', 'work2', 'rest2', 'work3', 'rest3', 'work4', 'rest4', 'work5',
    ]);
    expect(segs[0]).toEqual({ kind: 'prep', round: 1, startMs: 0, durMs: 10000, warnMs: 0 });
    expect(segs[1]).toEqual({ kind: 'work', round: 1, startMs: 10000, durMs: 180000, warnMs: 10000 });
    expect(segs[2]).toEqual({ kind: 'rest', round: 1, startMs: 190000, durMs: 120000, warnMs: 10000 });
    expect(totalMsOf(segs)).toBe(1390000); // 23:10
  });

  it('skips the lead-in when the start delay is off', () => {
    const segs = buildSegments({ ...MUAY_THAI, delaySec: 0 });
    expect(segs[0].kind).toBe('work');
    expect(segs[0].startMs).toBe(0);
  });

  it('runs rounds back to back when rest is 0', () => {
    const segs = buildSegments({ ...MUAY_THAI, restSec: 0, rounds: 3 });
    expect(segs.map(s => s.kind)).toEqual(['prep', 'work', 'work', 'work']);
  });

  it('caps ∞ rounds at 99', () => {
    const segs = buildSegments({ ...MUAY_THAI, rounds: null });
    expect(segs.filter(s => s.kind === 'work')).toHaveLength(99);
  });

  it('drops the warning window when the phase is shorter than twice the window', () => {
    const tabata = { ...MUAY_THAI, rounds: 2, roundSec: 20, restSec: 10, roundWarnSec: 10 };
    const [, work, rest] = buildSegments(tabata);
    expect(work.warnMs).toBe(10000); // 20 s ≥ 2 × 10 s
    expect(rest.warnMs).toBe(0); // 10 s < 2 × 10 s
    expect(buildSegments({ ...tabata, roundSec: 19 })[1].warnMs).toBe(0);
  });

  it('has no warning when the warning is off', () => {
    const segs = buildSegments({ ...MUAY_THAI, roundWarnSec: 0, restWarnSec: 0 });
    expect(segs.every(s => s.warnMs === 0)).toBe(true);
  });
});

describe('buildCues', () => {
  const cuesAt = (cues, atMs) => cues.filter(c => c.atMs === atMs);

  it('follows the section 4 timeline for the lead-in, a round and a rest', () => {
    const cues = buildCues(buildSegments(MUAY_THAI), MUAY_THAI);
    expect(cuesAt(cues, 0)).toEqual([{ atMs: 0, say: 'Get ready' }]);
    expect(cues.slice(1, 4)).toEqual([
      { atMs: 7000, sound: 'beep' }, { atMs: 8000, sound: 'beep' }, { atMs: 9000, sound: 'beep' },
    ]);
    expect(cuesAt(cues, 10000)).toEqual([{ atMs: 10000, sound: 'bell', vibrate: false, say: 'Round 1' }]);
    expect(cuesAt(cues, 180000)).toEqual([{ atMs: 180000, sound: 'clap', say: 'Ten seconds' }]);
    expect(cuesAt(cues, 190000)).toEqual([{ atMs: 190000, sound: 'bell-x3', vibrate: false, say: 'Rest' }]);
    expect(cuesAt(cues, 300000)).toEqual([{ atMs: 300000, sound: 'rest-warn', say: 'Ten seconds' }]);
    expect(cuesAt(cues, 307000)).toEqual([{ atMs: 307000, sound: 'beep' }]);
    expect(cuesAt(cues, 310000)).toEqual([{ atMs: 310000, sound: 'bell', vibrate: false, say: 'Round 2' }]);
  });

  it('says "Last round" before the final round and ends with the workout line', () => {
    const cues = buildCues(buildSegments(MUAY_THAI), MUAY_THAI);
    const lastStart = 10000 + 4 * 300000;
    expect(cuesAt(cues, lastStart)[0].say).toBe('Last round');
    expect(cues[cues.length - 1]).toEqual({
      atMs: 1390000, sound: 'bell-x3', vibrate: false, say: 'Time. Workout complete.',
    });
  });

  it('says "Round 1" for a single-round workout', () => {
    const one = { ...MUAY_THAI, rounds: 1 };
    const cues = buildCues(buildSegments(one), one);
    expect(cuesAt(cues, 10000)[0].say).toBe('Round 1');
  });

  it('countdowns ring the bells without round lines', () => {
    const cfg = { ...MUAY_THAI, rounds: 1, roundSec: 120 };
    const cues = buildCues(buildSegments(cfg), cfg, 'countdown');
    expect(cuesAt(cues, 10000)).toEqual([{ atMs: 10000, sound: 'bell', vibrate: false }]);
    expect(cues[cues.length - 1]).toEqual({ atMs: 130000, sound: 'bell-x3', vibrate: false, say: 'Time.' });
  });

  it('drops spoken lines when voice announcements are off', () => {
    const cfg = { ...MUAY_THAI, voice: false };
    const cues = buildCues(buildSegments(cfg), cfg);
    expect(cues.some(c => 'say' in c)).toBe(false);
    expect(cues[0]).toEqual({ atMs: 7000, sound: 'beep' }); // "Get ready" cue is gone entirely
  });

  it('drops the 3-2-1 beeps when they are off', () => {
    const cfg = { ...MUAY_THAI, beeps: false };
    expect(buildCues(buildSegments(cfg), cfg).some(c => c.sound === 'beep')).toBe(false);
  });

  it('vibrates on bells only', () => {
    const cfg = { ...MUAY_THAI, vibrate: true };
    const cues = buildCues(buildSegments(cfg), cfg);
    expect(cues.filter(c => c.vibrate).every(c => c.sound.startsWith('bell'))).toBe(true);
    expect(cues.filter(c => c.sound?.startsWith('bell')).every(c => c.vibrate)).toBe(true);
  });

  it('rings no end bell between back-to-back rounds', () => {
    const cfg = { ...MUAY_THAI, restSec: 0, rounds: 2 };
    const cues = buildCues(buildSegments(cfg), cfg);
    expect(cuesAt(cues, 190000)).toEqual([{ atMs: 190000, sound: 'bell', vibrate: false, say: 'Last round' }]);
  });

  it('uses the warning length in the spoken line', () => {
    expect(secondsPhrase(5)).toBe('Five seconds');
    expect(secondsPhrase(30)).toBe('Thirty seconds');
    const cfg = { ...MUAY_THAI, roundWarnSec: 30 };
    const cues = buildCues(buildSegments(cfg), cfg);
    expect(cuesAt(cues, 160000)).toEqual([{ atMs: 160000, sound: 'clap', say: 'Thirty seconds' }]);
  });
});

describe('positionAt', () => {
  const segs = buildSegments(MUAY_THAI);

  it('reports the lead-in', () => {
    const pos = positionAt(segs, 3000);
    expect(pos).toMatchObject({ phase: 'prep', index: 0, remainingMs: 7000, round: 1, warn: false });
    expect(pos.progress).toBeCloseTo(0.3);
    expect(pos.next.kind).toBe('work');
    expect(pos.totalLeftMs).toBe(1387000);
  });

  it('reports a round and its warning window', () => {
    // Round 2 starts at 310 s. Frame E: 2:47 left.
    expect(positionAt(segs, 310000 + 13000)).toMatchObject({
      phase: 'work', round: 2, remainingMs: 167000, warn: false, totalLeftMs: 1067000,
    });
    // Frame F: 0:08 left.
    expect(positionAt(segs, 310000 + 172000)).toMatchObject({ phase: 'work', remainingMs: 8000, warn: true });
    expect(positionAt(segs, 310000 + 170000).warn).toBe(true); // exactly 10 s left
  });

  it('reports rest, with the round just finished', () => {
    expect(positionAt(segs, 490000 + 78000)).toMatchObject({ phase: 'rest', round: 2, remainingMs: 42000 });
  });

  it('is done at and after the end', () => {
    expect(positionAt(segs, 1390000)).toMatchObject({ done: true, phase: 'done', totalLeftMs: 0 });
    expect(positionAt(segs, 5e6).done).toBe(true);
  });

  it('treats a negative elapsed time as the start', () => {
    expect(positionAt(segs, -50)).toMatchObject({ index: 0, remainingMs: 10000 });
  });
});

describe('clock', () => {
  it('measures wall-clock elapsed time', () => {
    const c = startClock(1000);
    expect(elapsedMs(c, 1000)).toBe(0);
    expect(elapsedMs(c, 61000)).toBe(60000);
  });

  it('freezes while paused and never counts the pause', () => {
    let c = startClock(0);
    c = pauseClock(c, 10000);
    expect(elapsedMs(c, 10000)).toBe(10000);
    expect(elapsedMs(c, 99000)).toBe(10000);
    c = resumeClock(c, 30000);
    expect(elapsedMs(c, 30000)).toBe(10000);
    expect(elapsedMs(c, 35000)).toBe(15000);
    c = pauseClock(c, 40000);
    c = resumeClock(c, 50000);
    expect(elapsedMs(c, 50000)).toBe(20000);
    expect(c.pausedTotal).toBe(30000);
  });

  it('ignores a double pause or resume', () => {
    const c = pauseClock(startClock(0), 5000);
    expect(pauseClock(c, 9000)).toBe(c);
    const r = resumeClock(c, 7000);
    expect(resumeClock(r, 9000)).toBe(r);
  });

  it('seeks while running or paused', () => {
    const running = seekClock(startClock(0), 50000, 12000);
    expect(elapsedMs(running, 50000)).toBe(12000);
    expect(elapsedMs(running, 51000)).toBe(13000);
    const paused = seekClock(pauseClock(startClock(0), 40000), 50000, 12000);
    expect(elapsedMs(paused, 50000)).toBe(12000);
    expect(elapsedMs(paused, 90000)).toBe(12000);
    expect(elapsedMs(resumeClock(paused, 60000), 61000)).toBe(13000);
  });
});

describe('cue scheduling', () => {
  const cues = [{ atMs: 0 }, { atMs: 1000 }, { atMs: 1000 }, { atMs: 5000 }];

  it('finds where to resume after a seek', () => {
    expect(cueIndexAt(cues, 0)).toBe(0);
    expect(cueIndexAt(cues, 1000)).toBe(1);
    expect(cueIndexAt(cues, 1001)).toBe(3);
    expect(cueIndexAt(cues, 9000)).toBe(4);
  });

  it('returns every cue that is due, once', () => {
    expect(dueCues(cues, 0, 0)).toEqual({ due: [cues[0]], next: 1 });
    expect(dueCues(cues, 1, 999)).toEqual({ due: [], next: 1 });
    expect(dueCues(cues, 1, 1200)).toEqual({ due: [cues[1], cues[2]], next: 3 });
  });

  it('drops cues that are more than 1.5 s late', () => {
    expect(dueCues(cues, 0, 2400)).toEqual({ due: [cues[1], cues[2]], next: 3 });
    expect(dueCues(cues, 0, 2600)).toEqual({ due: [], next: 3 });
  });

  it('plays only the latest moment when catching up', () => {
    const beeps = [{ atMs: 7000 }, { atMs: 8000 }, { atMs: 9000 }, { atMs: 10000 }];
    expect(dueCues(beeps, 0, 8500)).toEqual({ due: [beeps[1]], next: 2 });
  });
});

describe('totals and formatting', () => {
  it('totals the workout including the lead-in', () => {
    expect(workoutTotalSec(MUAY_THAI)).toBe(1390);
    expect(workoutTotalSec({ ...MUAY_THAI, rounds: 6, restSec: 30 })).toBe(1240); // frame C: 20:40
    expect(workoutTotalSec({ ...MUAY_THAI, rounds: null })).toBeNull();
  });

  it('formats clock times', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(42)).toBe('0:42');
    expect(formatClock(1390)).toBe('23:10');
  });

  it('rounds the countdown up', () => {
    expect(ceilSec(167000)).toBe(167);
    expect(ceilSec(166001)).toBe(167);
    expect(ceilSec(1)).toBe(1);
    expect(ceilSec(0)).toBe(0);
    expect(ceilSec(-20)).toBe(0);
  });
});
