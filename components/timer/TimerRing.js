import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors } from '../../constants/theme';

const CIRCUMFERENCE = 628.3; // 2π × 100

// Timer-tab run face (D–I): a ring that shows the time left in the current
// phase, starting at 12 o'clock, with the digits laid over it (children).
// fraction: time left / phase length, 0–1.
export default function TimerRing({ size, color, fraction, children }) {
  const left = Math.max(0, Math.min(1, fraction));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 220 220">
        <G transform="rotate(-90 110 110)">
          <Circle cx="110" cy="110" r="100" fill="none" stroke={colors.ringTrack} strokeWidth="12" />
          {left > 0 && (
            <Circle
              cx="110"
              cy="110"
              r="100"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE * (1 - left)}
            />
          )}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
