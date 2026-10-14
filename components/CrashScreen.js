import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';

// Shown instead of a blank screen when rendering crashes. The crash itself is
// already reported (utils/errorReporting.js); "Try again" re-renders the app.
export default function CrashScreen({ onRetry }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.accent} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        The error was reported. Your favorites, training log and settings are safe.
      </Text>
      <Pressable onPress={onRetry} style={styles.btn}>
        <Text style={styles.btnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  title: { color: colors.title, fontSize: fontSize.xl, fontWeight: '600' },
  body: { color: colors.textSecondary, fontSize: fontSize.base, textAlign: 'center' },
  btn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  btnText: { color: colors.accent, fontSize: fontSize.base, fontWeight: '600' },
});
