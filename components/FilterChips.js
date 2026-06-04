import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, fontSize, spacing } from '../constants/theme';

const DIFFICULTIES = [
  { key: 'beg', label: 'Beginner', bg: colors.begBg, text: colors.begText, border: colors.begBorder },
  { key: 'int', label: 'Intermediate', bg: colors.intBg, text: colors.intText, border: colors.intBorder },
  { key: 'adv', label: 'Advanced', bg: colors.advBg, text: colors.advText, border: colors.advBorder },
];

const STD = { bg: colors.typeBg, text: colors.typeText, border: colors.typeBorder };
const DEAD = { bg: colors.deadBg, text: colors.deadText, border: colors.deadBorder };

const TYPES = [
  { key: 'punches', label: 'Punches', ...STD },
  { key: 'kicks', label: 'Kicks', ...STD },
  { key: 'elbows', label: 'Elbows', ...STD },
  { key: 'knees', label: 'Knees', ...STD },
  { key: 'clinch', label: 'Clinch', ...STD },
  { key: 'mixed', label: 'Mixed', ...STD },
  { key: 'deadliest', label: 'Deadliest', ...DEAD },
];

function Chip({ option, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: option.bg, borderColor: option.border }
          : { backgroundColor: colors.chipInactiveBg, borderColor: colors.chipInactiveBorder },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? option.text : colors.chipInactiveText }]}>
        {option.label}
      </Text>
    </Pressable>
  );
}

export default function FilterChips({ selectedDiffs, selectedTypes, onToggleDiff, onToggleType }) {
  return (
    <View>
      <Text style={styles.sectionLabel}>DIFFICULTY</Text>
      <View style={styles.row}>
        {DIFFICULTIES.map(d => (
          <Chip key={d.key} option={d} active={selectedDiffs.has(d.key)} onPress={() => onToggleDiff(d.key)} />
        ))}
      </View>

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>TYPE</Text>
      <View style={styles.row}>
        {TYPES.map(t => (
          <Chip key={t.key} option={t} active={selectedTypes.has(t.key)} onPress={() => onToggleType(t.key)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    marginBottom: 6,
    fontWeight: '500',
  },
  sectionLabelSpaced: {
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
});
