import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Local Expo module (android/…/ProximityModule.kt). Android only: on iOS, and
// on a build made before the module was added, the sensor reads as missing.
const Native = Platform.OS === 'android' ? requireOptionalNativeModule('Proximity') : null;

export function isAvailable() {
  try {
    return !!Native && Native.isAvailable();
  } catch {
    return false;
  }
}

// Every proximity sensor the phone lists, with what it has reported so far
// (Settings diagnostics): [{ name, wakeUp, maxRange, readings, value, chosen }].
export function sensorDetails() {
  try {
    return Native?.sensors?.() ?? [];
  } catch {
    return [];
  }
}

// listener({ near, t }): t is epoch ms. → a subscription with remove().
export function addProximityListener(listener) {
  if (!Native) return { remove() {} };
  return Native.addListener('onChange', listener);
}
