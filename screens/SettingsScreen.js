import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import { useSetupDone } from '../hooks/useSetupDone';

const SETUP_STEPS = [
  'Open Google Assistant → Routines',
  'Create a routine. Set trigger phrase to "combo 1"',
  'Add action — Open app — paste the deep link below',
  'Repeat for combos 2–10. One-time setup only.',
];

const SLOTS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function SettingsScreen({ navigation }) {
  const { done, markDone } = useSetupDone();
  const [copiedSlot, setCopiedSlot] = useState(null);
  const copyTimeout = useRef(null);

  useEffect(() => () => { if (copyTimeout.current) clearTimeout(copyTimeout.current); }, []);

  const copyLink = async (slot) => {
    await Clipboard.setStringAsync(`muaythai://combo/${slot}`);
    setCopiedSlot(slot);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopiedSlot(null), 1500);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Voice & Settings</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>VOICE COMMANDS</Text>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="mic" size={fontSize.lg} color={colors.voiceTitle} />
            <Text style={styles.infoTitle}>How it works</Text>
          </View>
          <Text style={styles.infoBody}>
            Say "Hey Google, combo 3" to expand that combo during training. Steps show for 1 minute
            then auto-hide.
          </Text>
        </View>

        {/* Setup steps */}
        <View style={styles.card}>
          {SETUP_STEPS.map((step, i) => (
            <View key={i} style={[styles.stepRow, i === SETUP_STEPS.length - 1 && styles.stepRowLast]}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Deep links */}
        <View style={styles.card}>
          {SLOTS.map((slot, i) => {
            const copied = copiedSlot === slot;
            return (
              <View key={slot} style={[styles.linkRow, i === SLOTS.length - 1 && styles.linkRowLast]}>
                <Text style={styles.linkLabel}>combo {slot}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>muaythai://combo/{slot}</Text>
                <Pressable onPress={() => copyLink(slot)} style={[styles.copyBtn, copied && styles.copyBtnActive]}>
                  <Text style={[styles.copyText, copied && styles.copyTextActive]}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Setup complete */}
        <View style={styles.completeRow}>
          <View style={styles.completeTextWrap}>
            <Text style={styles.completeLabel}>Setup complete</Text>
            <Text style={styles.completeSub}>Mark when routines are configured</Text>
          </View>
          {done ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={fontSize.lg} color={colors.begText} />
              <Text style={styles.doneBadgeText}>Done</Text>
            </View>
          ) : (
            <Pressable onPress={markDone} style={styles.markBtn}>
              <Text style={styles.markBtnText}>Mark done</Text>
            </Pressable>
          )}
        </View>

        {/* Session preferences */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>SESSION PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Auto-hide timer</Text>
            <Text style={styles.prefValue}>1 min</Text>
          </View>
          <View style={[styles.prefRow, styles.prefRowLast]}>
            <Text style={styles.prefLabel}>Combos per session</Text>
            <Text style={styles.prefValue}>10</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '500', color: colors.title },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  sectionLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    marginBottom: 6,
    fontWeight: '500',
  },
  sectionLabelSpaced: { marginTop: spacing.xl },

  infoCard: {
    backgroundColor: colors.voiceBg,
    borderWidth: 1,
    borderColor: colors.voiceBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  infoTitle: { color: colors.voiceTitle, fontSize: fontSize.base, fontWeight: '600' },
  infoBody: { color: colors.voiceBody, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  stepRowLast: { borderBottomWidth: 0 },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.voiceStep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: { color: colors.voiceStepText, fontSize: fontSize.xs, fontWeight: '700' },
  stepText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.md, lineHeight: fontSize.md * 1.4 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  linkRowLast: { borderBottomWidth: 0 },
  linkLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500', width: 58 },
  linkUrl: { flex: 1, color: colors.textMuted, fontSize: fontSize.sm, fontFamily: 'monospace' },
  copyBtn: {
    borderWidth: 1,
    borderColor: colors.borderActive,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  copyBtnActive: { borderColor: colors.begBorder, backgroundColor: colors.begBg },
  copyText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  copyTextActive: { color: colors.begText },

  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  completeTextWrap: { flex: 1, paddingRight: spacing.md },
  completeLabel: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: '500' },
  completeSub: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  markBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderActive,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  markBtnText: { color: colors.textSecondary, fontSize: fontSize.base, fontWeight: '500' },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.begBg,
    borderWidth: 1,
    borderColor: colors.begBorder,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneBadgeText: { color: colors.begText, fontSize: fontSize.base, fontWeight: '600' },

  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  prefRowLast: { borderBottomWidth: 0 },
  prefLabel: { color: colors.textSecondary, fontSize: fontSize.base },
  prefValue: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: '500' },
});
