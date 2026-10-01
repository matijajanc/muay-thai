import { useState, useEffect, useCallback, useRef } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';

const PREFS_KEY = '@muaythai_prefs';

export const DEFAULT_PREFS = {
  waveGestures: false, // off until switched on in Settings
  weeklyGoal: 3, // training days per week for the streak (1–7)
};

const sanitize = (saved) => {
  const prefs = { ...DEFAULT_PREFS };
  if (typeof saved?.waveGestures === 'boolean') prefs.waveGestures = saved.waveGestures;
  if (Number.isInteger(saved?.weeklyGoal) && saved.weeklyGoal >= 1 && saved.weeklyGoal <= 7) {
    prefs.weeklyGoal = saved.weeklyGoal;
  }
  return prefs;
};

// App preferences outside the timer: wave gestures and the weekly goal.
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
