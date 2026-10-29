import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

// A combo's level at a glance: 1–3 bars for Beginner / Intermediate / Advanced,
// in the difficulty chip colours. The bar count reads without colour too.
// Deadliest combos are all Advanced, so their skull takes the bars' place.
const LEVELS = {
  beg: { bars: 1, color: colors.begText },
  int: { bars: 2, color: colors.intText },
  adv: { bars: 3, color: colors.advText },
};
const BAR_HEIGHTS = [6, 9, 12];
const SKULL_SIZE = 14;

// color: one tint for the lit bars or the skull (a filter chip passes its text
// colour); defaults to the level's own colour.
export default function LevelMarker({ diff, deadliest = false, color, style }) {
  if (deadliest) {
    return (
      <View style={[styles.slot, style]}>
        <Ionicons name="skull" size={SKULL_SIZE} color={color ?? colors.deadText} />
      </View>
    );
  }
  const level = LEVELS[diff];
  const tint = color ?? level.color;
  return (
    <View style={[styles.slot, styles.bars, style]}>
      {BAR_HEIGHTS.map((height, i) => (
        <View
          key={height}
          style={[styles.bar, { height, backgroundColor: i < level.bars ? tint : colors.levelBarIdle }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same width for bars and skull, so combo names line up.
  slot: {
    width: SKULL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: BAR_HEIGHTS[BAR_HEIGHTS.length - 1],
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
});
