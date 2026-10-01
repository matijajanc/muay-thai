import { useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { addProximityListener } from '../modules/proximity';
import { createWaveDetector } from '../utils/waveGestures';

// A hand reaching for the screen passes over the sensor: a gesture is dropped
// if the screen was touched from this long before its cover until it fires.
export const TOUCH_GUARD_MS = 300;
const ARMED_BUZZ_MS = 15; // the hold's "lift now" tick

// Proximity readings → wave gestures (utils/waveGestures.js), while `enabled`
// and the app is in the foreground.
//
// onGesture('wave' | 'doubleWave' | 'hold') runs each gesture; ignore() → true
// drops gestures for now (Settings has its own sensor test). lastTouchRef holds
// the time of the last screen touch (App's root view).
export function useWaveGestures({ enabled, onGesture, ignore, lastTouchRef }) {
  const [active, setActive] = useState(AppState.currentState === 'active');
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;
  const ignoreRef = useRef(ignore);
  ignoreRef.current = ignore;

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !active) return undefined;
    const touched = (start) => lastTouchRef.current >= start - TOUCH_GUARD_MS;
    const detector = createWaveDetector({
      emit: ({ type, start }) => {
        if (ignoreRef.current?.() || touched(start)) return;
        if (type === 'armed') Vibration.vibrate(ARMED_BUZZ_MS);
        else onGestureRef.current?.(type);
      },
    });
    const sub = addProximityListener(detector.feed);
    return () => {
      sub.remove();
      detector.reset();
    };
  }, [enabled, active, lastTouchRef]);
}
