import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

const FAVORITES_KEY = '@muaythai_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState(new Set());

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(raw => {
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    });
  }, []);

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Voice "combo favorite": only ever adds, so a repeated command can't undo it.
  const addFavorite = (id) => {
    setFavorites(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return { favorites, toggleFavorite, addFavorite };
}
