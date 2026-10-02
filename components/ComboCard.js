import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import TimerBar from './TimerBar';

const HEART_UNFAVORITED = '#444444';

export default function ComboCard({
  combo,
  index,
  isFavorite,
  isDone = false,
  isExpanded = false,
  timerPercent = 100,
  showTimer = true, // the countdown bar under an open combo (training only)
  expandable = true,
  onToggleFavorite,
  onExpand,
  onUndone,
}) {
  // Done styling steps aside while the combo is open again.
  const showDone = isDone && !isExpanded;

  const handleNamePress = () => {
    if (expandable && onExpand) onExpand(combo.id);
  };

  return (
    <View style={[styles.card, isExpanded && styles.cardExpanded]}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.namePress}
          onPress={handleNamePress}
          disabled={!expandable}
          hitSlop={4}
        >
          <Text style={styles.number}>{index}</Text>
          <Text style={[styles.name, showDone && styles.nameDone]}>{combo.name}</Text>
        </Pressable>

        {showDone && (
          <Pressable
            onPress={() => onUndone && onUndone(combo.id)}
            hitSlop={8}
            style={styles.donePress}
          >
            <Ionicons name="checkmark-circle" size={fontSize.xl} color={colors.doneCheck} />
          </Pressable>
        )}

        <Pressable
          onPress={() => onToggleFavorite && onToggleFavorite(combo.id)}
          hitSlop={10}
          style={styles.heartPress}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={fontSize.xl}
            color={isFavorite ? colors.accent : HEART_UNFAVORITED}
          />
        </Pressable>
      </View>

      {isExpanded && (
        <View style={styles.expandedBody}>
          {combo.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          {showTimer && timerPercent != null && (
            <View style={styles.timerWrap}>
              <TimerBar percent={timerPercent} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    marginBottom: 6,
  },
  cardExpanded: {
    backgroundColor: colors.surfaceActive,
    borderColor: colors.borderActive,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  namePress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  number: {
    color: colors.comboNumber,
    fontSize: fontSize.base,
    fontWeight: '500',
    minWidth: 18,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: '500',
    lineHeight: fontSize.base * 1.35,
  },
  nameDone: {
    color: colors.doneText,
  },
  donePress: {
    paddingLeft: spacing.sm,
  },
  heartPress: {
    paddingLeft: spacing.sm,
  },
  expandedBody: {
    marginTop: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  stepNumber: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '500',
    width: 18,
    lineHeight: fontSize.md * 1.5,
  },
  stepText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
  },
  timerWrap: {
    marginTop: spacing.sm,
  },
});
