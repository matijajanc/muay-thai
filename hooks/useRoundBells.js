import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as RoundBells from '../modules/round-bells';
import { bellPlan } from '../utils/backgroundBells';
import { SOUND_SOURCES } from '../constants/sounds';

// The sound files on disk for the native service, { name: file URI }; resolved
// once (expo-asset copies bundled files to the cache).
let soundFiles = null;
function resolveSoundFiles() {
  soundFiles ??= Promise.all(Object.entries(SOUND_SOURCES).map(async ([name, source]) => {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    return [name, asset.localUri];
  }))
    .then(Object.fromEntries)
    .catch(() => {
      soundFiles = null; // try again next time
      return {};
    });
  return soundFiles;
}

// The round timer keeps ringing with the screen off or the app in the
// background. React Native's timers stop there, so while a run is going a
// native foreground service (modules/round-bells) holds what's left of it and
// rings the cues while the app isn't visible. Its notification shows the phase
// with a countdown. Pausing, stopping and finishing stop the service.
//
// timer: useRoundTimer() — { status, run, clock }.
export function useRoundBells({ status, run, clock }) {
  useEffect(() => {
    if (!RoundBells.isAvailable()) return undefined;
    if (status !== 'running') {
      RoundBells.stop();
      return undefined;
    }
    let current = true;
    resolveSoundFiles().then((sounds) => {
      if (!current) return;
      const plan = bellPlan(run, clock, Date.now());
      if (plan) RoundBells.start({ ...plan, sounds });
    });
    return () => {
      current = false;
    };
  }, [status, run, clock]);

  // Android 13+ shows the countdown notification only with permission: asked
  // when a run starts (Android stops asking after the second "Don't allow").
  const running = status === 'running';
  useEffect(() => {
    if (running && RoundBells.isAvailable() && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
  }, [running]);
}
