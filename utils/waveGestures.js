// Wave-gesture detector: pure state machine, no React, no native code.
//
// The proximity sensor only says near/far, so the three gestures are told
// apart by timing alone (wireframe section 1):
//   wave        one pass, covered < 0.8 s; fires 0.6 s after release, once no
//               second pass has started
//   doubleWave  a second pass starting within 0.6 s of the first release;
//               fires on the second release
//   hold        covered 1.5–4 s; 'armed' at 1.5 s (the cue to lift), fires on
//               release
// A cover of 0.8–1.5 s does nothing, and one past 4 s (a pocket, the phone face
// down) is ignored until the sensor reads far again. So is a cover that's
// already there on the first reading: we can't know when it started.

export const WAVE_MIN_MS = 40; // shorter "covers" are sensor glitches
export const WAVE_MAX_MS = 800;
export const DOUBLE_GAP_MS = 600; // release → next cover, for a double wave
export const HOLD_ARM_MS = 1500;
export const HOLD_MAX_MS = 4000;
// After a double wave or a hold, a cover starting this soon is the tail of the
// same motion (a third pass, a hand bouncing as it lifts), not a new gesture.
export const COOLDOWN_MS = 600;

// emit({ type, start }): type is 'wave' | 'doubleWave' | 'hold' | 'armed';
// start is when the gesture's first cover began (epoch ms), for the touch guard.
// Times come from the readings ({ near, t }) and the injected clock and timers,
// so tests are deterministic.
export function createWaveDetector({
  emit, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  let near = null; // last reading; null before the first
  let coverStart = 0;
  let ignored = false; // the current cover can't make a gesture
  let pending = null; // { start, end } of a wave that may get a second pass
  let cooldownUntil = 0;
  let armTimer = null;
  let maxTimer = null;
  let waveTimer = null;

  const clearCoverTimers = () => {
    clearTimer(armTimer);
    clearTimer(maxTimer);
    armTimer = maxTimer = null;
  };

  // Fires the pending wave once its double-wave window has passed.
  const schedulePendingWave = () => {
    clearTimer(waveTimer);
    const delay = Math.max(0, pending.end + DOUBLE_GAP_MS - now());
    waveTimer = setTimer(() => {
      waveTimer = null;
      const { start } = pending;
      pending = null;
      emit({ type: 'wave', start });
    }, delay);
  };

  const onCover = (t, first) => {
    coverStart = t;
    ignored = first || t < cooldownUntil;
    if (ignored) return;
    if (pending) {
      clearTimer(waveTimer);
      waveTimer = null;
    }
    const elapsed = Math.max(0, now() - t);
    armTimer = setTimer(() => {
      armTimer = null;
      emit({ type: 'armed', start: coverStart });
    }, Math.max(0, HOLD_ARM_MS - elapsed));
    maxTimer = setTimer(() => {
      maxTimer = null;
      ignored = true;
      pending = null;
    }, Math.max(0, HOLD_MAX_MS - elapsed));
  };

  const onRelease = (t) => {
    clearCoverTimers();
    if (ignored) {
      ignored = false;
      return;
    }
    const covered = t - coverStart;
    if (covered < WAVE_MIN_MS) {
      if (pending) schedulePendingWave(); // a glitch doesn't end the window
      return;
    }
    if (covered < WAVE_MAX_MS) {
      if (pending) {
        const { start } = pending;
        pending = null;
        cooldownUntil = t + COOLDOWN_MS;
        emit({ type: 'doubleWave', start });
        return;
      }
      pending = { start: coverStart, end: t };
      schedulePendingWave();
      return;
    }
    // Too long for a pass: a wave before it is dropped, and the cover counts
    // on its own.
    pending = null;
    if (covered >= HOLD_ARM_MS) {
      cooldownUntil = t + COOLDOWN_MS;
      emit({ type: 'hold', start: coverStart });
    }
  };

  // reading: { near, t } from the proximity module (t in epoch ms).
  const feed = ({ near: next, t }) => {
    if (next === near) return;
    const first = near === null;
    near = next;
    if (next) onCover(t, first);
    else if (!first) onRelease(t);
  };

  // Forget everything (unsubscribing): the next reading counts as the first.
  const reset = () => {
    clearCoverTimers();
    clearTimer(waveTimer);
    waveTimer = null;
    near = null;
    ignored = false;
    pending = null;
    cooldownUntil = 0;
  };

  return { feed, reset };
}
