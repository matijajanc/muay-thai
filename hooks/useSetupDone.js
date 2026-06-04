import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

const SETUP_DONE_KEY = '@muaythai_setup_done';

export function useSetupDone() {
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Re-read whenever the screen using this hook regains focus, so marking
  // setup complete on the Settings screen reflects on the Favorites banner.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(SETUP_DONE_KEY).then(raw => {
        if (active) {
          setDone(raw === 'true');
          setLoaded(true);
        }
      });
      return () => { active = false; };
    }, [])
  );

  const markDone = () => {
    setDone(true);
    AsyncStorage.setItem(SETUP_DONE_KEY, 'true');
  };

  return { done, loaded, markDone };
}
