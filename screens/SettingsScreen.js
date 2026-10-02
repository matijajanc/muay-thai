import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import { PRIVACY_POLICY_URL } from '../constants/links';
import VoiceCommandList from '../components/VoiceCommandList';
import TimerIcon from '../components/timer/TimerIcon';
import { OptionSheet } from '../components/timer/TimerSheets';
import { usePrefsContext } from '../contexts/AppContext';
import { COMBO_HOLD_SECONDS } from '../hooks/usePrefs';
import { SESSION_SIZES } from '../utils/sessionPicker';

const GETTING_STARTED = [
  'Tap the mic on the Training or Timer tab and allow the microphone the first time. Android may also prompt once to download the small offline voice model.',
  'Say any command below. What was heard, and what it did, shows under the mic.',
  'Combo commands need a generated session; timer commands work any time.',
  'It keeps listening — and keeps the screen on — until you tap the mic again. It pauses while the app is in the background.',
];

// 0 → "Until closed", 60 → "1 min", 90 → "90 s".
const holdLabel = (sec) => {
  if (!sec) return 'Until closed';
  return sec % 60 === 0 ? `${sec / 60} min` : `${sec} s`;
};

const sizeHint = (n) =>
  `Generate picks ${n} combos (fewer if your filters match fewer). Applies to the next session.`;
const holdHint = (sec) => (sec
  ? `A combo you open, by tap or voice, collapses after ${holdLabel(sec)}.`
  : 'A combo you open stays open until you tap it again or open another one.');

// .card .r: label + value + chevron, opens a sheet.
function PrefRow({ label, value, onPress, last = false }) {
  return (
    <Pressable style={[styles.prefRow, last && styles.prefRowLast]} onPress={onPress}>
      <Text style={styles.prefLabel}>{label}</Text>
      <View style={styles.prefValueWrap}>
        <Text style={styles.prefValue}>{value}</Text>
        <TimerIcon name="chev" size={12} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { prefs, update } = usePrefsContext();
  // Which sheet is open: 'size' | 'hold'.
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Voice & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>VOICE COMMANDS</Text>

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
          <PrefRow
            label="Combos per session"
            value={String(prefs.sessionSize)}
            onPress={() => setSheet('size')}
          />
          <PrefRow
            label="Open combo hides after"
            value={holdLabel(prefs.comboHoldSec)}
            onPress={() => setSheet('hold')}
            last
          />
        </View>

        {/* Safety + privacy */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.aboutText}>
            Train safely. Warm up first, stop if you feel pain or dizziness, and check with a doctor
            before starting a new training program. Elbows, knees, clinch and the “deadliest” combos
            are for shadowboxing, pads and bags — drill them on a partner only under a qualified
            coach.
          </Text>
          <Pressable
            style={[styles.prefRow, styles.prefRowLast]}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          >
            <Text style={styles.prefLabel}>Privacy policy</Text>
            <Ionicons name="open-outline" size={fontSize.md} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <OptionSheet
        visible={sheet === 'size'}
        title="Combos per session"
        meta="Generate"
        options={SESSION_SIZES}
        label={String}
        value={prefs.sessionSize}
        hint={sizeHint}
        onChange={v => update({ sessionSize: v })}
        onClose={close}
      />
      <OptionSheet
        visible={sheet === 'hold'}
        title="Open combo hides after"
        meta="Training"
        options={COMBO_HOLD_SECONDS}
        label={holdLabel}
        value={prefs.comboHoldSec}
        hint={holdHint}
        onChange={v => update({ comboHoldSec: v })}
        onClose={close}
      />
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
  prefValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  prefValue: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: '500' },
  aboutText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.45,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
});
