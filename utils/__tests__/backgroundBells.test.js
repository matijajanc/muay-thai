import {
  buildSegments, buildCues, totalMsOf, startClock, pauseClock,
} from '../roundTimer';
import { bellPlan, MAX_PLAN_CUES } from '../backgroundBells';

const MUAY_THAI = {
  rounds: 2, roundSec: 180, restSec: 120, delaySec: 10,
  roundWarnSec: 10, restWarnSec: 10, beeps: true, voice: true, vibrate: true,
};

const makeRun = (config, kind = 'workout') => {
  const segments = buildSegments(config);
  return {
    kind, config, label: 'Muay Thai · 2 × 3:00', segments,
    cues: buildCues(segments, config, kind), totalMs: totalMsOf(segments), doneAt: null,
  };
};

const T0 = 1_000_000;

describe('bellPlan', () => {
  it('lists the phases and sound cues ahead at wall-clock times', () => {
    const plan = bellPlan(makeRun(MUAY_THAI), startClock(T0), T0 + 5000);
    expect(plan.label).toBe('Muay Thai · 2 × 3:00');
    expect(plan.endAt).toBe(T0 + 490000);
    expect(plan.phases.map(p => [p.at - T0, p.until - T0, p.title])).toEqual([
      [0, 10000, 'Get ready'],
      [10000, 190000, 'Round 1 of 2'],
      [190000, 310000, 'Rest · round 2 next'],
      [310000, 490000, 'Round 2 of 2'],
    ]);
    expect(plan.cues.map(c => [c.at - T0, c.sound, c.vibrate])).toEqual([
      [7000, 'beep', false], [8000, 'beep', false], [9000, 'beep', false],
      [10000, 'bell', true],
      [180000, 'clap', false],
      [190000, 'bell-x3', true],
      [300000, 'rest-warn', false],
      [307000, 'beep', false], [308000, 'beep', false], [309000, 'beep', false],
      [310000, 'bell', true],
      [480000, 'clap', false],
      [490000, 'bell-x3', true],
    ]);
  });

  it('starts where the run is now; a cue due right now is left to the app', () => {
    const plan = bellPlan(makeRun(MUAY_THAI), startClock(T0), T0 + 190000);
    expect(plan.phases[0].title).toBe('Rest · round 2 next');
    expect(plan.cues[0]).toMatchObject({ at: T0 + 300000, sound: 'rest-warn' });
  });

  it('keeps the times right after a pause', () => {
    const clock = { startedAt: T0, pausedAt: null, pausedTotal: 60000 }; // paused a minute
    const plan = bellPlan(makeRun(MUAY_THAI), clock, T0 + 65000);
    expect(plan.cues.find(c => c.sound === 'bell').at).toBe(T0 + 70000);
  });

  it('is null while paused, when done or with nothing running', () => {
    const run = makeRun(MUAY_THAI);
    expect(bellPlan(run, pauseClock(startClock(T0), T0 + 1000), T0 + 2000)).toBeNull();
    expect(bellPlan({ ...run, doneAt: T0 }, startClock(T0), T0)).toBeNull();
    expect(bellPlan(run, startClock(T0), T0 + run.totalMs)).toBeNull();
    expect(bellPlan(null, null, T0)).toBeNull();
  });

  it('caps the cues for ∞ rounds and titles its rounds without a total', () => {
    const plan = bellPlan(makeRun({ ...MUAY_THAI, rounds: null }), startClock(T0), T0);
    expect(plan.cues).toHaveLength(MAX_PLAN_CUES);
    expect(plan.phases[1].title).toBe('Round 1');
  });

  it('titles a countdown', () => {
    const run = makeRun({ ...MUAY_THAI, rounds: 1, restSec: 0, delaySec: 0 }, 'countdown');
    expect(bellPlan(run, startClock(T0), T0 + 1000).phases.map(p => p.title)).toEqual(['Countdown']);
  });
});
