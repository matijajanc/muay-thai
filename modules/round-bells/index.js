import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Local Expo module (android/…/RoundBellsService.kt). Android only: on iOS, and
// on a build made before the module was added, these do nothing.
const Native = Platform.OS === 'android' ? requireOptionalNativeModule('RoundBells') : null;

export const isAvailable = () => !!Native;

// plan: utils/backgroundBells.js bellPlan() plus { sounds: { name: file URI } }.
// → false if the service couldn't start (Android allows it from the foreground only).
export function start(plan) {
  try {
    return !!Native && Native.start(JSON.stringify(plan));
  } catch {
    return false;
  }
}

export function stop() {
  try {
    Native?.stop();
  } catch {
    // nothing running
  }
}
