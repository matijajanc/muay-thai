import { useState, useRef, useEffect } from 'react';
import { COMBOS } from '../data/combos';

const SESSION_SIZE = 10;
const TIMER_SECONDS = 60;

export function useSession() {
  const [session, setSession] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [timerSec, setTimerSec] = useState(TIMER_SECONDS);
  const intervalRef = useRef(null);

  const clearActiveTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Clean up the interval if the component using the hook unmounts.
  useEffect(() => clearActiveTimer, []);

  const startTimer = () => {
    clearActiveTimer();
    setTimerSec(TIMER_SECONDS);
    intervalRef.current = setInterval(() => {
      setTimerSec(prev => {
        if (prev <= 1) {
          clearActiveTimer();
          setExpandedId(null);
          return TIMER_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const generate = (selectedDiffs, selectedTypes) => {
    let pool = [...COMBOS];
    if (selectedDiffs.size > 0) pool = pool.filter(c => selectedDiffs.has(c.diff));
    if (selectedTypes.size > 0) pool = pool.filter(c => selectedTypes.has(c.type));
    if (pool.length === 0) pool = [...COMBOS];
    pool.sort(() => Math.random() - 0.5);
    const newSession = pool.slice(0, Math.min(SESSION_SIZE, pool.length));
    clearActiveTimer();
    setSession(newSession);
    setGenerated(true);
    setExpandedId(null);
  };

  const reset = () => {
    clearActiveTimer();
    setGenerated(false);
    setSession([]);
    setExpandedId(null);
  };

  // Manual tap: tapping the open card again collapses it.
  const expandCombo = (id) => {
    if (expandedId === id) {
      clearActiveTimer();
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    startTimer();
  };

  // Voice deep link: always (re)open the targeted slot with a fresh timer.
  const expandBySlot = (slotIndex) => {
    const combo = session[slotIndex];
    if (!combo) return;
    setExpandedId(combo.id);
    startTimer();
  };

  const timerPercent = (timerSec / TIMER_SECONDS) * 100;

  return {
    session,
    generated,
    expandedId,
    timerSec,
    timerPercent,
    generate,
    reset,
    expandCombo,
    expandBySlot,
  };
}
