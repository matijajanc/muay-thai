import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';

const DIFFICULTIES = [
  { key: 'beg', label: 'Beginner', bg: colors.begBg, text: colors.begText, border: colors.begBorder },
  { key: 'int', label: 'Intermediate', bg: colors.intBg, text: colors.intText, border: colors.intBorder },
  { key: 'adv', label: 'Advanced', bg: colors.advBg, text: colors.advText, border: colors.advBorder },
];

const STD = { bg: colors.typeBg, text: colors.typeText, border: colors.typeBorder };
const DEAD = { bg: colors.deadBg, text: colors.deadText, border: colors.deadBorder };
const FAV = { bg: colors.chipOnBg, text: colors.accent, border: colors.accent, icon: 'heart' };

const TYPES = [
  { key: 'punches', label: 'Punches', ...STD },
  { key: 'kicks', label: 'Kicks', ...STD },
  { key: 'elbows', label: 'Elbows', ...STD },
  { key: 'knees', label: 'Knees', ...STD },
  { key: 'clinch', label: 'Clinch', ...STD },
  { key: 'mixed', label: 'Mixed', ...STD },
  { key: 'deadliest', label: 'Deadliest', ...DEAD },
];

function Chip({ option, active, disabled = false, onPress }) {
  const textColor = active ? option.text : colors.chipInactiveText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        active
          ? { backgroundColor: option.bg, borderColor: option.border }
          : { backgroundColor: colors.chipInactiveBg, borderColor: colors.chipInactiveBorder },
        disabled && styles.chipDisabled,
      ]}
    >
      {option.icon && (
        <Ionicons name={active ? option.icon : `${option.icon}-outline`} size={fontSize.md} color={textColor} />
      )}
      <Text style={[styles.chipText, { color: textColor }]}>
        {option.label}
      </Text>
    </Pressable>
  );
}

// favoriteCount: saved favorites; mixFavorites/onToggleFavorites: the
// "mix 2–3 of them into the session" chip (off while there are none).
export default function FilterChips({
  selectedDiffs, selectedTypes, onToggleDiff, onToggleType,
  favoriteCount = 0, mixFavorites = false, onToggleFavorites,
}) {
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

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>FAVORITES</Text>
      <View style={styles.row}>
        <Chip
          option={{ ...FAV, label: favoriteCount > 0 ? `Mix in favorites · ${favoriteCount}` : 'Mix in favorites' }}
          active={mixFavorites && favoriteCount > 0}
          disabled={favoriteCount === 0}
          onPress={onToggleFavorites}
        />
      </View>
      {favoriteCount === 0 && (
        <Text style={styles.hint}>Tap the heart on a combo to save it, then mix favorites into a session.</Text>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  chipDisabled: { opacity: 0.4 },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 6 },
});
