import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/theme';

// percent: 0–100, drives width of the orange fill
export default function TimerBar({ percent }) {
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: radius.xs ?? 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
});
