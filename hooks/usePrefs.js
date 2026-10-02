import { useState, useEffect, useCallback, useRef } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { SESSION_SIZES } from '../utils/sessionPicker';

const PREFS_KEY = '@muaythai_prefs';

// How long an opened combo stays open before it collapses; 0 = until closed.
export const COMBO_HOLD_SECONDS = [30, 60, 90, 120, 0];

export const DEFAULT_PREFS = {
  weeklyGoal: 3, // training days per week for the streak (1–7)
  sessionSize: 10, // combos per generated session (SESSION_SIZES)
  comboHoldSec: 60, // COMBO_HOLD_SECONDS
};

const sanitize = (saved) => {
  const prefs = { ...DEFAULT_PREFS };
  if (Number.isInteger(saved?.weeklyGoal) && saved.weeklyGoal >= 1 && saved.weeklyGoal <= 7) {
    prefs.weeklyGoal = saved.weeklyGoal;
  }
  if (SESSION_SIZES.includes(saved?.sessionSize)) prefs.sessionSize = saved.sessionSize;
  if (COMBO_HOLD_SECONDS.includes(saved?.comboHoldSec)) prefs.comboHoldSec = saved.comboHoldSec;
  return prefs;
};

// App preferences outside the timer: the weekly goal, session size and how long
// an opened combo stays open.
export function usePrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  // Nothing is saved until the stored values have loaded; a value changed
  // before then wins over the stored one.
  const [loaded, setLoaded] = useState(false);
  const changedRef = useRef(new Set());

  useEffect(() => {
    loadJSON(PREFS_KEY).then(saved => {
      setPrefs(prev => {
        const next = sanitize(saved);
        for (const key of changedRef.current) next[key] = prev[key];
        return next;
      });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveJSON(PREFS_KEY, prefs);
  }, [prefs, loaded]);

  const update = useCallback((patch) => {
    Object.keys(patch).forEach(key => changedRef.current.add(key));
    setPrefs(prev => ({ ...prev, ...patch }));
  }, []);

  return { prefs, update };
}
