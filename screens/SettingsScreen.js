import { View, Text, ScrollView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import VoiceCommandList from '../components/VoiceCommandList';
import WaveGesturesCard from '../components/WaveGesturesCard';

const GETTING_STARTED = [
  'Tap the mic on the Training or Timer tab and allow the microphone the first time. Android may also prompt once to download the small offline voice model.',
  'Say any command below. What was heard, and what it did, shows under the mic.',
  'Combo commands need a generated session; timer commands work any time.',
  'It keeps listening — and keeps the screen on — until you tap the mic again. It pauses while the app is in the background.',
];

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Voice & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WaveGesturesCard />

        <Text style={[styles.sectionLabel, Platform.OS === 'android' && styles.afterGestures]}>
          VOICE COMMANDS
        </Text>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="mic" size={fontSize.lg} color={colors.voiceTitle} />
            <Text style={styles.infoTitle}>Hands-free voice commands</Text>
          </View>
          <Text style={styles.infoBody}>
            Voice commands run inside the app — no Google Assistant or Google Home setup needed.
            Recognition runs on-device (offline) when your phone supports it, so it keeps working
            without Wi-Fi; otherwise your phone's speech service may process the audio online. The
            mic only listens while you have it switched on in the Training or Timer tab.
          </Text>
        </View>

        {/* Getting started steps */}
        <View style={styles.card}>
          {GETTING_STARTED.map((step, i) => (
            <View key={i} style={[styles.stepRow, i === GETTING_STARTED.length - 1 && styles.stepRowLast]}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <VoiceCommandList />

        <Text style={[styles.tip, styles.tipSpaced]}>
          Tip: moving on to another combo marks the previous one done if it was open at least
          5 seconds. Tap the ✓ to undo.
        </Text>

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
  afterGestures: { marginTop: 18 },

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

  tip: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5, marginBottom: spacing.md },
  tipSpaced: { marginTop: spacing.md },

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
