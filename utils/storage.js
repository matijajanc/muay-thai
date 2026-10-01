import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage JSON helpers that never throw: a missing, unreadable or corrupt
// value reads as `fallback`, and a failed write is dropped.

export async function loadJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export function removeKey(key) {
  AsyncStorage.removeItem(key).catch(() => {});
}
