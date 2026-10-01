import { useState, useRef, useEffect } from 'react';
import { COMBOS } from '../data/combos';
import { loadJSON, saveJSON, removeKey } from '../utils/storage';
import { filterCombos, pickSession, favoriteMixCount } from '../utils/sessionPicker';

const TIMER_SECONDS = 60;
// A combo open for less than this before moving on counts as skipped (or a
// misheard command), not done.
const MIN_DONE_MS = 5000;
// The current session is saved so it survives the app being closed or killed;
// one left untouched this long is "today's training" no more.
const SESSION_KEY = '@muaythai_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const COMBO_BY_ID = new Map(COMBOS.map(c => [c.id, c]));

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
  // The same slot as state, for UI that shows the last-opened combo (the
  // Training clock's current-combo card).
  const [activeIndex, setActiveIndex] = useState(null);
  const openedAtRef = useRef(0);       // when the active slot was opened
  const startedAtRef = useRef(null);   // when the first combo was opened
  const [doneIds, setDoneIds] = useState(new Set());
  // Non-null while the "session complete" celebration is showing.
  const [summary, setSummary] = useState(null);
  // Combo ids of the last session, so the next one can avoid repeating them.
  const previousIdsRef = useRef(new Set());
  // Nothing is saved until the stored session has been read back.
  const [loaded, setLoaded] = useState(false);
  // Set once the user generates or resets, so a slow restore can't replace that.
  const touchedRef = useRef(false);

  useEffect(() => {
    loadJSON(SESSION_KEY).then(saved => {
      if (!touchedRef.current) restore(saved);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!generated) {
      removeKey(SESSION_KEY);
      return;
    }
    saveJSON(SESSION_KEY, {
      ids: session.map(c => c.id),
      doneIds: [...doneIds],
      activeIndex,
      startedAt: startedAtRef.current,
      savedAt: Date.now(),
    });
  }, [loaded, generated, session, doneIds, activeIndex]);

  // Brings back a saved session (no combo is open, and no celebration).
  const restore = (saved) => {
    if (!saved || !Array.isArray(saved.ids)) return;
    if (!(Date.now() - saved.savedAt < SESSION_TTL_MS)) return;
    const combos = saved.ids.map(id => COMBO_BY_ID.get(id)).filter(Boolean);
    if (combos.length === 0) return;
    const ids = new Set(combos.map(c => c.id));
    const slot = Number.isInteger(saved.activeIndex) && saved.activeIndex < combos.length
      ? saved.activeIndex
      : null;
    activeSlotRef.current = slot;
    openedAtRef.current = Date.now();
    startedAtRef.current = Number.isFinite(saved.startedAt) ? saved.startedAt : null;
    setActiveIndex(slot);
    setDoneIds(new Set((saved.doneIds ?? []).filter(id => ids.has(id))));
    setSession(combos);
    setGenerated(true);
  };

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

  // mixIn: saved favorite combos, 2–3 of which go into the session (any
  // difficulty or type) without making it longer.
  // Returns false, and changes nothing, when no combo matches the filters.
  const generate = (selectedDiffs, selectedTypes, mixIn = []) => {
    const pool = filterCombos(selectedDiffs, selectedTypes);
    if (pool.length === 0) return false;
    touchedRef.current = true;
    clearProgress();
    setSession(pickSession(pool, previousIdsRef.current, mixIn, favoriteMixCount(mixIn.length)));
    setGenerated(true);
    return true;
  };

  const reset = () => {
    touchedRef.current = true;
    if (session.length > 0) previousIdsRef.current = new Set(session.map(c => c.id));
    clearProgress();
    setGenerated(false);
    setSession([]);
  };

  const clearProgress = () => {
    clearActiveTimer();
    activeSlotRef.current = null;
    setActiveIndex(null);
    startedAtRef.current = null;
    setJumpTarget(null);
    setExpandedId(null);
    setDoneIds(new Set());
    setSummary(null);
  };

  // The active combo counts as done once it was open long enough.
  const activeDoneCombo = () => {
    const combo = session[activeSlotRef.current];
    return combo && Date.now() - openedAtRef.current >= MIN_DONE_MS ? combo : null;
  };

  const markDone = (id) => setDoneIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)));

  const unmarkDone = (id) => setDoneIds(prev => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev);
    next.delete(id);
    return next;
  });

  // Moving on to a different slot marks the one we're leaving as done.
  const activate = (slotIndex) => {
    if (slotIndex !== activeSlotRef.current) {
      const finished = activeDoneCombo();
      if (finished) markDone(finished.id);
      openedAtRef.current = Date.now();
    }
    activeSlotRef.current = slotIndex;
    setActiveIndex(slotIndex);
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
  };

  // Manual tap: tapping the open card again collapses it.
  const expandCombo = (id) => {
    if (expandedId === id) {
      clearActiveTimer();
      setExpandedId(null);
      return;
    }
    activate(session.findIndex(c => c.id === id));
    setExpandedId(id);
    startTimer();
  };

  // Voice / deep link: always (re)open the targeted slot with a fresh timer.
  // Returns the opened slot index, or null if the slot doesn't exist.
  const expandBySlot = (slotIndex) => {
    const combo = session[slotIndex];
    if (!combo) return null;
    activate(slotIndex);
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

  // End of training: count the combo in progress and show the celebration.
  const finish = () => {
    clearActiveTimer();
    setExpandedId(null);
    const done = new Set(doneIds);
    const last = activeDoneCombo();
    if (last) done.add(last.id);
    setDoneIds(done);
    setSummary({
      done: done.size,
      total: session.length,
      durationMs: startedAtRef.current == null ? 0 : Date.now() - startedAtRef.current,
    });
  };

  const dismissSummary = () => setSummary(null);

  const timerPercent = (timerSec / TIMER_SECONDS) * 100;

  return {
    session,
    generated,
    expandedId,
    timerSec,
    timerPercent,
    jumpTarget,
    activeIndex,
    doneIds,
    summary,
    generate,
    reset,
    expandCombo,
    expandBySlot,
    expandNext,
    expandPrevious,
    activeSlot,
    unmarkDone,
    finish,
    dismissSummary,
  };
}
