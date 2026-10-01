import { View, Text, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import { COMMAND_HELP, GESTURE_HELP } from '../voice/commandHelp';
import { usePrefsContext } from '../contexts/AppContext';
import { isAvailable as hasProximitySensor } from '../modules/proximity';
import { Sheet } from './timer/TimerSheets';
import { Btn } from './timer/TimerUI';

// Every voice command, grouped (Settings and the mic's help sheet).
export default function VoiceCommandList() {
  return COMMAND_HELP.map(section => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionLabel}>{section.title}</Text>
      <Text style={styles.note}>{section.note}</Text>
      <View style={styles.card}>
        {section.commands.map((command, i) => (
          <View
            key={command.say[0]}
            style={[styles.row, i === section.commands.length - 1 && styles.rowLast]}
          >
            <View style={styles.phrases}>
              {command.say.map(say => (
                <View key={say} style={styles.phrase}>
                  <Text style={styles.phraseText}>“{say}”</Text>
                </View>
              ))}
            </View>
            <Text style={styles.does}>{command.does}</Text>
          </View>
        ))}
      </View>
    </View>
  ));
}

// The wave gestures, listed in the help sheet while they're on.
function GestureList() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Wave gestures</Text>
      <View style={styles.card}>
        {GESTURE_HELP.map((row, i) => (
          <View key={row.gesture} style={[styles.row, i === GESTURE_HELP.length - 1 && styles.rowLast]}>
            <View style={styles.phrases}>
              <View style={styles.phrase}>
                <Text style={styles.phraseText}>{row.gesture}</Text>
              </View>
            </View>
            <Text style={styles.does}>{row.does}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// The "?" next to the mic opens this.
export function VoiceHelpSheet({ visible, onClose }) {
  const { height } = useWindowDimensions();
  const { prefs } = usePrefsContext();
  const gestures = prefs.waveGestures && hasProximitySensor();
  return (
    <Sheet visible={visible} onClose={onClose} title="Voice commands" meta="Tap the mic, then say…">
      <ScrollView style={{ maxHeight: height * 0.65 }} showsVerticalScrollIndicator={false}>
        {gestures && <GestureList />}
        <VoiceCommandList />
      </ScrollView>
      <Btn label="Done" onPress={onClose} style={styles.done} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md },
  sectionLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    fontWeight: '500',
    marginBottom: 2,
  },
  note: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4, marginBottom: 6 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 6,
  },
  rowLast: { borderBottomWidth: 0 },
  phrases: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  phrase: {
    backgroundColor: colors.chipOnBg,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  phraseText: { color: colors.accent, fontSize: fontSize.base, fontWeight: '600' },
  does: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: fontSize.md * 1.4 },
  done: { marginTop: spacing.md },
});
