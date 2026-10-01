import { useState, useEffect, useCallback } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { isEntry, upsertEntry, removeEntry } from '../utils/history';

const HISTORY_KEY = '@muaythai_history';

// The training log (utils/history.js), kept on the device.
export function useHistory() {
  const [entries, setEntries] = useState([]);
  // Nothing is saved until the stored log has loaded, so an entry logged in the
  // first moments can't overwrite it (it's merged in instead).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadJSON(HISTORY_KEY, []).then(saved => {
      const stored = Array.isArray(saved) ? saved.filter(isEntry) : [];
      setEntries(prev => prev.reduce(upsertEntry, stored));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveJSON(HISTORY_KEY, entries);
  }, [entries, loaded]);

  // Adds an entry, or replaces the one with the same id.
  const upsert = useCallback((entry) => setEntries(prev => upsertEntry(prev, entry)), []);
  const remove = useCallback((id) => setEntries(prev => removeEntry(prev, id)), []);

  return { entries, loaded, upsert, remove };
}
