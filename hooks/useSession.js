import { useState, useRef, useEffect } from 'react';
import { COMBOS } from '../data/combos';

const SESSION_SIZE = 10;
const TIMER_SECONDS = 60;

export function useSession() {
  const [session, setSession] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [timerSec, setTimerSec] = useState(TIMER_SECONDS);
  // Bumped whenever a slot is opened hands-free, so the list can scroll to it.
  const [jumpTarget, setJumpTarget] = useState(null);
  const intervalRef = useRef(null);
  // Last opened slot index. Outlives the auto-collapse so "next" and "favorite"
  // still know where the user is. A ref so back-to-back commands see it at once.
  const activeSlotRef = useRef(null);

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
    activeSlotRef.current = null;
    setJumpTarget(null);
    setSession(newSession);
    setGenerated(true);
    setExpandedId(null);
  };

  const reset = () => {
    clearActiveTimer();
    activeSlotRef.current = null;
    setJumpTarget(null);
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
    activeSlotRef.current = session.findIndex(c => c.id === id);
    setExpandedId(id);
    startTimer();
  };

  // Voice / deep link: always (re)open the targeted slot with a fresh timer.
  // Returns the opened slot index, or null if the slot doesn't exist.
  const expandBySlot = (slotIndex) => {
    const combo = session[slotIndex];
    if (!combo) return null;
    activeSlotRef.current = slotIndex;
    setExpandedId(combo.id);
    setJumpTarget(prev => ({ index: slotIndex, seq: (prev?.seq ?? 0) + 1 }));
    startTimer();
    return slotIndex;
  };

  // Step from the last opened slot, wrapping around; start at slot 1 if none yet.
  const expandRelative = (step) => {
    if (session.length === 0) return null;
    const current = activeSlotRef.current;
    const next = current == null ? 0 : (current + step + session.length) % session.length;
    return expandBySlot(next);
  };
  const expandNext = () => expandRelative(1);
  const expandPrevious = () => expandRelative(-1);

  const activeSlot = () => activeSlotRef.current;

  const timerPercent = (timerSec / TIMER_SECONDS) * 100;

  return {
    session,
    generated,
    expandedId,
    timerSec,
    timerPercent,
    jumpTarget,
    generate,
    reset,
    expandCombo,
    expandBySlot,
    expandNext,
    expandPrevious,
    activeSlot,
  };
}
