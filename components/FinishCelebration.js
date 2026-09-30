import { useEffect, useMemo, useRef } from 'react';
import {
  Modal, View, Text, Pressable, Animated, Easing, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';

const CONFETTI_COUNT = 48;
const CONFETTI_COLORS = [
  colors.accent, colors.begText, colors.intText, colors.typeText, colors.deadText, colors.advText,
];

function makeConfetti(width) {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * width,
    w: 6 + Math.random() * 4,
    h: 10 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    drift: (Math.random() - 0.5) * 140,
    spin: 360 + Math.random() * 720,
    delay: Math.random() * 600,
    duration: 2200 + Math.random() * 1600,
    progress: new Animated.Value(0),
  }));
}

function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  return min < 1 ? 'under a minute' : `${min} min`;
}

// summary: { done, total, durationMs } from useSession().finish(), or null when hidden.
export default function FinishCelebration({ summary, onNewSession, onClose }) {
  const { width, height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  // Fresh confetti every time the celebration opens.
  const confetti = useMemo(() => (summary ? makeConfetti(width) : []), [summary, width]);

  useEffect(() => {
    if (!summary) return;
    pop.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }),
      ...confetti.map(p => Animated.timing(p.progress, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [summary, confetti, pop]);

  if (!summary) return null;
  const { done, total, durationMs } = summary;
  const perfect = total > 0 && done === total;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {confetti.map((p, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: p.x,
                top: 0,
                width: p.w,
                height: p.h,
                borderRadius: 2,
                backgroundColor: p.color,
                opacity: p.progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] }) },
                  { translateX: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                  { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
                ],
              }}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        >
          <Animated.View
            style={{
              transform: [
                { scale: pop },
                { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
              ],
            }}
          >
            <Ionicons name="trophy" size={64} color={colors.accent} />
          </Animated.View>

          <Text style={styles.title}>{perfect ? 'Perfect session!' : 'Session complete'}</Text>
          <Text style={styles.count}>
            {done}<Text style={styles.countTotal}>/{total}</Text>
          </Text>
          <Text style={styles.countLabel}>combos done</Text>
          {durationMs > 0 && (
            <Text style={styles.duration}>Trained for {formatDuration(durationMs)}</Text>
          )}

          <Pressable style={styles.primaryBtn} onPress={onNewSession}>
            <Text style={styles.primaryText}>New session</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryText}>Keep training</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderActive,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.title,
    fontSize: 22,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  count: {
    color: colors.accent,
    fontSize: 48,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  countTotal: { color: colors.textSecondary, fontSize: 28, fontWeight: '500' },
  countLabel: { color: colors.textSecondary, fontSize: fontSize.base },
  duration: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.sm },
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  secondaryBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderActive,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
});
