import { createWaveDetector } from '../waveGestures';

// A fake clock with timers, so every timing below is exact.
function fakeClock() {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  const setTimer = (fn, ms) => {
    const id = nextId++;
    timers.set(id, { fn, at: time + ms });
    return id;
  };
  const clearTimer = (id) => timers.delete(id);
  // Runs every timer due up to `to`, in order.
  const advanceTo = (to) => {
    for (;;) {
      let due = null;
      for (const [id, t] of timers) if (t.at <= to && (!due || t.at < due[1].at)) due = [id, t];
      if (!due) break;
      timers.delete(due[0]);
      time = due[1].at;
      due[1].fn();
    }
    time = to;
  };
  return { now: () => time, setTimer, clearTimer, advanceTo };
}

// steps: [t, near] readings (ms); a leading far reading at 0 is implied.
// → [[type, start, firedAt]], with the run continued 10 s past the last step.
function run(steps, { first = false } = {}) {
  const clock = fakeClock();
  const events = [];
  const detector = createWaveDetector({
    emit: (e) => events.push([e.type, e.start, clock.now()]),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  if (!first) detector.feed({ near: false, t: 0 });
  for (const [t, near] of steps) {
    clock.advanceTo(t);
    detector.feed({ near, t });
  }
  clock.advanceTo((steps.length ? steps[steps.length - 1][0] : 0) + 10000);
  return events;
}

// Cover from `from` to `to` ms.
const cover = (from, to) => [[from, true], [to, false]];

describe('wave', () => {
  it.each([
    ['a 0.4 s pass', 400],
    ['a quick 50 ms flick', 50],
    ['just under 0.8 s', 799],
  ])('%s fires 0.6 s after release', (_, ms) => {
    expect(run(cover(1000, 1000 + ms))).toEqual([['wave', 1000, 1000 + ms + 600]]);
  });

  it('ignores sensor glitches under 40 ms', () => {
    expect(run(cover(1000, 1039))).toEqual([]);
  });

  it('fires twice for two passes more than 0.6 s apart', () => {
    expect(run([...cover(1000, 1400), ...cover(2100, 2400)])).toEqual([
      ['wave', 1000, 2000],
      ['wave', 2100, 3000],
    ]);
  });
});

describe('double wave', () => {
  it('fires on the second release (wireframe trace)', () => {
    // 0.35 s pass, 0.33 s gap, 0.35 s pass.
    expect(run([...cover(500, 850), ...cover(1175, 1525)])).toEqual([['doubleWave', 500, 1525]]);
  });

  it.each([
    ['starts just inside the window', 599, true],
    ['starts right at the end of the window', 600, false],
  ])('a second pass that %s', (_, gap, isDouble) => {
    const events = run([...cover(1000, 1300), ...cover(1300 + gap, 1300 + gap + 300)]);
    expect(events.map(e => e[0])).toEqual(isDouble ? ['doubleWave'] : ['wave', 'wave']);
  });

  it('keeps the window open across a glitch', () => {
    const events = run([...cover(1000, 1300), ...cover(1500, 1510), ...cover(1800, 2000)]);
    expect(events).toEqual([['doubleWave', 1000, 2000]]);
  });

  it('a glitch alone still lets the first wave fire on time', () => {
    expect(run([...cover(1000, 1300), ...cover(1500, 1510)])).toEqual([['wave', 1000, 1900]]);
  });

  it('ignores a third pass right after (the tail of the same motion)', () => {
    const events = run([...cover(1000, 1300), ...cover(1500, 1800), ...cover(2100, 2300)]);
    expect(events).toEqual([['doubleWave', 1000, 1800]]);
  });

  it('a pass after the cooldown starts a new gesture', () => {
    const events = run([...cover(1000, 1300), ...cover(1500, 1800), ...cover(2500, 2700)]);
    expect(events).toEqual([['doubleWave', 1000, 1800], ['wave', 2500, 3300]]);
  });

  it('a too-long second cover drops the first wave', () => {
    expect(run([...cover(1000, 1300), ...cover(1500, 2500)])).toEqual([]);
  });

  it('a wave then a hold fires only the hold', () => {
    const events = run([...cover(1000, 1300), ...cover(1500, 3500)]);
    expect(events).toEqual([['armed', 1500, 3000], ['hold', 1500, 3500]]);
  });
});

describe('hold', () => {
  it.each([
    ['1.5 s', 1500],
    ['2 s', 2000],
    ['just under 4 s', 3999],
  ])('a cover of %s arms at 1.5 s and fires on release', (_, ms) => {
    expect(run(cover(1000, 1000 + ms))).toEqual([
      ['armed', 1000, 2500],
      ['hold', 1000, 1000 + ms],
    ]);
  });

  it.each([
    ['0.8 s', 800],
    ['1.2 s', 1200],
    ['just under 1.5 s', 1499],
  ])('a cover of %s is neither a wave nor a hold', (_, ms) => {
    expect(run(cover(1000, 1000 + ms))).toEqual([]);
  });

  it.each([
    ['4 s', 4000],
    ['a minute (pocket, face down)', 60000],
  ])('a cover of %s is ignored', (_, ms) => {
    expect(run(cover(1000, 1000 + ms))).toEqual([['armed', 1000, 2500]]);
  });

  it('a wave right after a hold is ignored, a later one fires', () => {
    expect(run([...cover(1000, 3000), ...cover(3300, 3500)]).map(e => e[0])).toEqual(['armed', 'hold']);
    expect(run([...cover(1000, 3000), ...cover(3700, 3900)]).map(e => e[0]))
      .toEqual(['armed', 'hold', 'wave']);
  });
});

describe('readings', () => {
  it('ignores a cover already there on the first reading', () => {
    expect(run([[0, true], [300, false]], { first: true })).toEqual([]);
  });

  it('works normally after that first cover clears', () => {
    expect(run([[0, true], [300, false], ...cover(1000, 1200)], { first: true }))
      .toEqual([['wave', 1000, 1800]]);
  });

  it('ignores repeated readings of the same state', () => {
    expect(run([[1000, true], [1100, true], [1300, false], [1400, false]]))
      .toEqual([['wave', 1000, 1900]]);
  });

  it('takes durations from the reading times, not when they arrive', () => {
    const clock = fakeClock();
    const events = [];
    const detector = createWaveDetector({
      emit: (e) => events.push([e.type, clock.now()]),
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    detector.feed({ near: false, t: 0 });
    clock.advanceTo(1050);
    detector.feed({ near: true, t: 1000 }); // delivered 50 ms late
    clock.advanceTo(1420);
    detector.feed({ near: false, t: 1400 });
    clock.advanceTo(5000);
    expect(events).toEqual([['wave', 2000]]);
  });

  it('reset() drops a pending wave and treats the next reading as the first', () => {
    const clock = fakeClock();
    const events = [];
    const detector = createWaveDetector({
      emit: (e) => events.push(e.type),
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    detector.feed({ near: false, t: 0 });
    detector.feed({ near: true, t: 100 });
    clock.advanceTo(300);
    detector.feed({ near: false, t: 300 });
    detector.reset();
    clock.advanceTo(400);
    detector.feed({ near: true, t: 400 }); // first reading after reset
    clock.advanceTo(600);
    detector.feed({ near: false, t: 600 });
    clock.advanceTo(5000);
    expect(events).toEqual([]);
  });
});
