import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTimerTick } from '../../contexts/AppContext';
import { phaseColor, tabLabel } from '../../utils/timerLabels';

// Live while a run is going (not after it's done).
const isLive = (pos) => !!pos && !pos.done;

// Timer tab label: "Timer", or the live time in the phase color.
export function TimerTabLabel({ focused, color }) {
  const { run, pos, paused } = useTimerTick();
  if (!isLive(pos)) return <Text style={[styles.label, { color }]}>Timer</Text>;
  // On the Timer tab the lead-in keeps the active tab color (frame D).
  const tint = focused && pos.phase === 'prep' ? color : phaseColor(pos);
  return (
    <Text style={[styles.label, styles.live, { color: tint }]}>
      {tabLabel(run, pos, paused, focused)}
    </Text>
  );
}

// Timer tab icon: takes the phase color on other tabs while a run is going.
export function TimerTabIcon({ focused, color, size }) {
  const { pos } = useTimerTick();
  const tint = isLive(pos) && !focused ? phaseColor(pos) : color;
  return <Ionicons name="timer-outline" color={tint} size={size} />;
}

const styles = StyleSheet.create({
  label: { fontSize: 10 },
  live: { fontVariant: ['tabular-nums'], fontWeight: '600' },
});
