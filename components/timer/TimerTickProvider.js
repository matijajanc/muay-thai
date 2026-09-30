import { useState, useEffect, useCallback } from 'react';
import { TimerTickContext } from '../../contexts/AppContext';
import { positionAt, elapsedMs } from '../../utils/roundTimer';

const FAST_TICK_MS = 100; // a dial or ring is visible
const SLOW_TICK_MS = 250; // only the tab label

// Re-renders the live timer position on its own, so the ticking stays out of
// App and the screens: only components using useTimerTick() update each tick.
// timer: useRoundTimer().
export default function TimerTickProvider({ timer, children }) {
  const { status, run, clock } = timer;
  const [fastCount, setFastCount] = useState(0);
  const [, setTick] = useState(0);

  const requestFast = useCallback(() => {
    setFastCount(c => c + 1);
    return () => setFastCount(c => c - 1);
  }, []);

  const running = status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(t => t + 1), fastCount > 0 ? FAST_TICK_MS : SLOW_TICK_MS);
    return () => clearInterval(id);
  }, [running, fastCount]);

  const pos = run && clock ? positionAt(run.segments, elapsedMs(clock, Date.now())) : null;
  const value = { run, pos, paused: status === 'paused', requestFast };

  return <TimerTickContext.Provider value={value}>{children}</TimerTickContext.Provider>;
}
