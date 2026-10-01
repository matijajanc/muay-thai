// Local-time math: pin a zone with DST so the week and day tests mean something.
process.env.TZ = 'Europe/Ljubljana';

/* eslint-disable import/first */
import {
  unionSpans, dayTotals, weekStreak, weekCompare, weeklyMinutes, techniqueMix, mostDrilled,
  allTime, weekStart, addDays, dayKey, entryTime,
} from '../stats';
import {
  formatDuration, streakLine, goalHint, timeDelta, countDelta, dayLabel, clockTime, entryTitle,
  entryMeta, deleteMessage, weekRange, longDate,
} from '../statsLabels';

const MIN = 60 * 1000;
// Local wall-clock time.
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

let seq = 0;
function timer(start, minutes, extra = {}) {
  return {
    id: `t${seq++}`, type: 'timer', at: start, kind: 'workout', presetName: 'Muay Thai',
    roundSec: 180, rounds: 5, roundsDone: 5, workMs: 15 * MIN, completed: true,
    spans: [[start, start + minutes * MIN]], ...extra,
  };
}
function combos(start, minutes, comboIds = [1], total = 10) {
  return { id: `c${seq++}`, type: 'combos', at: start, comboIds, total, spans: [[start, start + minutes * MIN]] };
}
// One 30-minute session on each of these local days.
const trainOn = (...days) => days.map(([y, m, d]) => timer(at(y, m, d, 18), 30));

// Thursday 1 Oct 2026, 9:41 (wireframe S1: this week is 28 Sep – 4 Oct).
const NOW = at(2026, 10, 1, 9, 41);

describe('calendar', () => {
  it('weeks start on Monday at local midnight', () => {
    expect(weekStart(NOW)).toBe(at(2026, 9, 28, 0));
    expect(weekStart(at(2026, 10, 4, 23, 59))).toBe(at(2026, 9, 28, 0));
    expect(weekStart(at(2026, 10, 5, 0))).toBe(at(2026, 10, 5, 0));
  });

  it('steps whole days across DST changes', () => {
    // 29 Mar 2026 has 23 hours here, 25 Oct 2026 has 25.
    expect(addDays(at(2026, 3, 28), 1)).toBe(at(2026, 3, 29, 0));
    expect(addDays(at(2026, 3, 29), 1)).toBe(at(2026, 3, 30, 0));
    expect(addDays(at(2026, 10, 25), 1)).toBe(at(2026, 10, 26, 0));
    expect(weekStart(at(2026, 3, 29, 23))).toBe(at(2026, 3, 23, 0));
    expect(weekStart(at(2026, 10, 30))).toBe(at(2026, 10, 26, 0));
  });

  it('weeks cross the year end', () => {
    expect(weekStart(at(2027, 1, 1))).toBe(at(2026, 12, 28, 0));
    expect(dayKey(at(2027, 1, 1))).toBe('2027-01-01');
  });
});

describe('training time', () => {
  it('merges overlapping and touching spans', () => {
    expect(unionSpans([[50, 60], [0, 10], [10, 20], [15, 30], [40, 40]])).toEqual([[0, 30], [50, 60]]);
  });

  it('counts combos drilled during a timer run once', () => {
    const start = at(2026, 9, 30, 18);
    const entries = [timer(start, 23), combos(start + 5 * MIN, 24)];
    expect(weekCompare(entries, NOW).now.timeMs).toBe(29 * MIN);
  });

  it('splits a session over midnight between the two days', () => {
    const totals = dayTotals([timer(at(2026, 9, 29, 23, 50), 30)]);
    expect(totals.get('2026-09-29')).toBe(10 * MIN);
    expect(totals.get('2026-09-30')).toBe(20 * MIN);
  });
});

describe('weekStreak', () => {
  it('counts last week while this week is still open (S1)', () => {
    const entries = trainOn([2026, 9, 21], [2026, 9, 23], [2026, 9, 25], [2026, 9, 28], [2026, 9, 30]);
    const s = weekStreak(entries, 3, NOW);
    expect(s).toMatchObject({ current: 1, best: 1, days: 2, met: false });
    expect(s.week.map(d => d.trained)).toEqual([true, false, true, false, false, false, false]);
    expect(s.week.map(d => d.today)).toEqual([false, false, false, true, false, false, false]);
  });

  it('adds this week once its goal is met', () => {
    const entries = trainOn([2026, 9, 21], [2026, 9, 23], [2026, 9, 25], [2026, 9, 28], [2026, 9, 29], [2026, 9, 30]);
    expect(weekStreak(entries, 3, NOW)).toMatchObject({ current: 2, days: 3, met: true });
  });

  it('a missed week breaks the streak; best keeps the longest', () => {
    const entries = trainOn(
      [2026, 8, 31], [2026, 9, 1], [2026, 9, 2], // met
      [2026, 9, 7], [2026, 9, 8], [2026, 9, 9], // met
      [2026, 9, 14], // missed
      [2026, 9, 21], [2026, 9, 22], [2026, 9, 23], // met
    );
    expect(weekStreak(entries, 3, NOW)).toMatchObject({ current: 1, best: 2 });
  });

  it('an unmet week that has ended breaks it', () => {
    const entries = trainOn([2026, 9, 14], [2026, 9, 15], [2026, 9, 16], [2026, 9, 21]);
    expect(weekStreak(entries, 3, NOW)).toMatchObject({ current: 0, best: 1 });
  });

  it('a day needs 5 minutes of training', () => {
    const short = [at(2026, 9, 21), at(2026, 9, 22), at(2026, 9, 23)].map(t => timer(t, 4));
    expect(weekStreak(short, 3, NOW).current).toBe(0);
    const enough = [at(2026, 9, 21), at(2026, 9, 22), at(2026, 9, 23)].map(t => timer(t, 5));
    expect(weekStreak(enough, 3, NOW).current).toBe(1);
  });

  it('two short sessions on one day add up', () => {
    const entries = [timer(at(2026, 9, 28, 7), 3), combos(at(2026, 9, 28, 19), 3)];
    expect(weekStreak(entries, 1, NOW)).toMatchObject({ current: 1, days: 1, met: true });
  });

  it('recalculates everything, best included, for another goal', () => {
    const entries = trainOn([2026, 9, 7], [2026, 9, 9], [2026, 9, 14], [2026, 9, 16], [2026, 9, 21], [2026, 9, 23]);
    expect(weekStreak(entries, 3, NOW)).toMatchObject({ current: 0, best: 0 });
    expect(weekStreak(entries, 2, NOW)).toMatchObject({ current: 3, best: 3 });
  });

  it('runs across the DST change', () => {
    const entries = trainOn([2026, 3, 23], [2026, 3, 29], [2026, 3, 30], [2026, 4, 5]);
    expect(weekStreak(entries, 2, at(2026, 4, 6))).toMatchObject({ current: 2, best: 2 });
    const autumn = trainOn([2026, 10, 19], [2026, 10, 25], [2026, 10, 26], [2026, 11, 1]);
    expect(weekStreak(autumn, 2, at(2026, 11, 2))).toMatchObject({ current: 2, best: 2 });
  });

  it('runs across the year end', () => {
    const entries = trainOn([2025, 12, 22], [2025, 12, 31], [2026, 1, 1], [2026, 1, 5]);
    expect(weekStreak(entries, 1, at(2026, 1, 6))).toMatchObject({ current: 3, best: 3 });
  });

  it('is zero with an empty log', () => {
    expect(weekStreak([], 3, NOW)).toMatchObject({ current: 0, best: 0, days: 0, met: false });
  });
});

describe('weekCompare', () => {
  it('compares with last week up to the same weekday', () => {
    const entries = [
      timer(at(2026, 9, 29, 18), 30, { roundsDone: 5 }),
      combos(at(2026, 9, 30, 18), 20, [1, 2, 3]),
      timer(at(2026, 9, 22, 18), 10, { roundsDone: 2 }), // last Tuesday: counts
      timer(at(2026, 9, 24, 23, 0), 10, { roundsDone: 3 }), // last Thursday: counts
      timer(at(2026, 9, 25, 7), 60, { roundsDone: 9 }), // last Friday: not yet
    ];
    expect(weekCompare(entries, NOW)).toEqual({
      now: { timeMs: 50 * MIN, rounds: 5, combos: 3, sessions: 2 },
      last: { timeMs: 20 * MIN, rounds: 5, combos: 0, sessions: 2 },
    });
  });
});

describe('weeklyMinutes', () => {
  it('has 12 weeks, oldest first, ending with this week', () => {
    const bars = weeklyMinutes([timer(at(2026, 9, 30), 52), timer(at(2026, 7, 8), 40)], NOW);
    expect(bars).toHaveLength(12);
    expect(bars[11]).toMatchObject({ start: at(2026, 9, 28, 0), minutes: 52 });
    expect(bars[0]).toMatchObject({ start: at(2026, 7, 13, 0), minutes: 0 });
    expect(bars.reduce((n, b) => n + b.minutes, 0)).toBe(52);
  });

  it('labels the oldest week and the first week starting in each month', () => {
    const months = weeklyMinutes([], NOW).map(b => b.month);
    // Mondays: 13, 20, 27 Jul, 3, 10, 17, 24, 31 Aug, 7, 14, 21, 28 Sep.
    expect(months).toEqual([6, null, null, 7, null, null, null, null, 8, null, null, null]);
  });

  it('leaves the oldest week unlabelled when the next starts a new month', () => {
    const months = weeklyMinutes([], at(2026, 10, 14)).map(b => b.month);
    // Mondays: 27 Jul, 3 Aug, …
    expect(months[0]).toBeNull();
    expect(months[1]).toBe(7);
  });
});

describe('techniqueMix', () => {
  it('counts combos done in the last 30 days by type and difficulty', () => {
    const entries = [
      combos(at(2026, 9, 30), 20, [1, 2, 3, 11]), // 3 punches beg, 1 kicks beg
      combos(at(2026, 9, 20), 20, [43, 97]), // elbows int, deadliest adv
      combos(at(2026, 8, 20), 20, [12, 13, 14]), // 42 days ago: left out
    ];
    const mix = techniqueMix(entries, NOW);
    expect(mix.total).toBe(6);
    expect(mix.types.map(t => [t.type, t.count, t.pct])).toEqual([
      ['punches', 3, 50], ['kicks', 1, 17], ['elbows', 1, 17], ['deadliest', 1, 17],
      ['knees', 0, 0], ['clinch', 0, 0], ['mixed', 0, 0],
    ]);
    expect(mix.diffs).toEqual([
      { diff: 'beg', count: 4, pct: 67 }, { diff: 'int', count: 1, pct: 17 }, { diff: 'adv', count: 1, pct: 17 },
    ]);
  });
});

describe('mostDrilled', () => {
  it('ranks by times done, ties to the most recent, top 5', () => {
    const entries = [
      combos(at(2026, 9, 30), 20, [1, 2, 3]),
      combos(at(2026, 9, 29), 20, [1, 4, 5, 6]),
      combos(at(2026, 9, 28), 20, [1, 2, 7]),
    ];
    expect(mostDrilled(entries, NOW).map(r => [r.combo.id, r.count])).toEqual([
      [1, 3], [2, 2], [3, 1], [4, 1], [5, 1],
    ]);
  });

  it('is empty with nothing done in 30 days', () => {
    expect(mostDrilled([combos(at(2026, 8, 1), 20, [1])], NOW)).toEqual([]);
  });
});

describe('allTime', () => {
  it('totals the whole log', () => {
    const entries = [
      timer(at(2026, 9, 30), 60, { roundsDone: 5 }),
      timer(at(2026, 9, 29), 125, { roundsDone: 12 }),
      combos(at(2026, 7, 12), 30, [1, 2, 3]),
    ];
    expect(allTime(entries)).toEqual({
      timeMs: 215 * MIN, sessions: 3, rounds: 17, combos: 3, bestWeekMs: 185 * MIN, since: at(2026, 7, 12),
    });
  });
});

describe('labels', () => {
  it('formats durations', () => {
    expect(formatDuration(52 * MIN)).toBe('52 m');
    expect(formatDuration(185 * MIN)).toBe('3 h 05 m');
    expect(formatDuration((41 * 60 + 20) * MIN)).toBe('41 h 20 m');
  });

  it('writes the streak line for each state', () => {
    expect(streakLine({ current: 6, days: 2, met: false }, 3)).toBe('2 of 3 days · 1 more to keep the streak');
    expect(streakLine({ current: 7, days: 3, met: true }, 3)).toBe('3 of 3 days · goal met ✓');
    expect(streakLine({ current: 0, days: 1, met: false }, 3)).toBe('Train 3 days this week to start a streak');
    expect(streakLine({ current: 0, days: 0, met: false }, 1)).toBe('Train 1 day this week to start a streak');
  });

  it('writes the goal hint', () => {
    expect(goalHint(3)).toBe(
      'A week counts toward your streak when you train on 3 days. A day counts after 5 minutes of training.',
    );
    expect(goalHint(1)).toMatch(/^A week counts toward your streak when you train on 1 day\. /);
  });

  it('writes the deltas', () => {
    expect(timeDelta(52 * MIN, 34 * MIN)).toEqual({ text: '+18 m vs last week', up: true });
    expect(countDelta(8, 11)).toEqual({ text: '−3 vs last week', up: false });
    expect(countDelta(4, 4)).toEqual({ text: 'Same as last week', up: false });
    expect(timeDelta(30 * MIN + 10000, 30 * MIN)).toEqual({ text: 'Same as last week', up: false });
  });

  it('names the days and the week', () => {
    expect(weekRange(NOW)).toBe('This week · 28 Sep – 4 Oct');
    expect(weekRange(at(2026, 12, 31))).toBe('This week · 28 Dec – 3 Jan');
    expect(dayLabel(at(2026, 10, 1, 7), NOW)).toBe('Today');
    expect(dayLabel(at(2026, 9, 30, 23, 59), NOW)).toBe('Yesterday');
    expect(dayLabel(at(2026, 9, 28, 7), NOW)).toBe('Mon 28 Sep');
    expect(dayLabel(at(2025, 12, 30), NOW)).toBe('Tue 30 Dec 2025');
    expect(clockTime(at(2026, 9, 28, 7, 5))).toBe('07:05');
    expect(longDate(at(2026, 7, 12))).toBe('12 Jul 2026');
  });

  it('writes history rows', () => {
    const done = timer(at(2026, 9, 30, 18, 5), 23);
    expect([entryTitle(done), entryMeta(done)]).toEqual([
      'Muay Thai · 5 × 3:00', { lead: '5/5 rounds', rest: ['23 min'] },
    ]);
    const stopped = timer(at(2026, 9, 28), 15, { presetName: 'Boxing', rounds: 12, roundsDone: 4, completed: false });
    expect([entryTitle(stopped), entryMeta(stopped)]).toEqual([
      'Boxing · 12 × 3:00', { lead: '4/12 rounds', rest: ['stopped', '15 min'] },
    ]);
    const countdown = timer(at(2026, 9, 28), 2, { kind: 'countdown', presetName: null, roundSec: 120, rounds: 1 });
    expect([entryTitle(countdown), entryMeta(countdown)]).toEqual([
      'Countdown · 2:00', { lead: 'Done', rest: ['2 min'] },
    ]);
    const endless = timer(at(2026, 9, 28), 30, { rounds: null, roundsDone: 7, completed: false });
    expect(entryMeta(endless)).toEqual({ lead: '7 rounds', rest: ['30 min'] });
    const session = combos(at(2026, 9, 30), 24, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect([entryTitle(session), entryMeta(session)]).toEqual([
      'Combo session', { lead: '8/10 done', rest: ['24 min'] },
    ]);
    expect(entryMeta(timer(at(2026, 9, 28), 0.5, { kind: 'countdown' })).rest).toEqual(['<1 min']);
    expect(entryTime(session)).toBe(24 * MIN);
  });

  it('writes the delete alert', () => {
    const countdown = timer(at(2026, 9, 30, 17, 58), 2, { kind: 'countdown', roundSec: 120 });
    expect(deleteMessage(countdown, NOW)).toBe(
      'Countdown · 2:00, yesterday at 17:58. Your stats will be recalculated without it.',
    );
    expect(deleteMessage(combos(at(2026, 9, 28, 18, 2), 20), NOW)).toBe(
      'Combo session, Mon 28 Sep at 18:02. Your stats will be recalculated without it.',
    );
  });
});
