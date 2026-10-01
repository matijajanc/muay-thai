import { useState, useEffect } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';

const FAVORITES_KEY = '@muaythai_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState(new Set());
  // Nothing is saved until the stored list has loaded, so a heart tapped in the
  // first moments can't overwrite it (it's merged in instead).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadJSON(FAVORITES_KEY, []).then(saved => {
      const ids = Array.isArray(saved) ? saved.filter(Number.isInteger) : [];
      setFavorites(prev => new Set([...ids, ...prev]));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveJSON(FAVORITES_KEY, [...favorites]);
  }, [favorites, loaded]);

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Voice "combo favorite": only ever adds, so a repeated command can't undo it.
  const addFavorite = (id) => {
    setFavorites(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  return { favorites, toggleFavorite, addFavorite };
}
