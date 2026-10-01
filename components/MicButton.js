import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import { useVoiceContext } from '../contexts/AppContext';
import { VoiceHelpSheet } from './VoiceCommandList';

// The shared mic. Each place passes its own hint (idleText / listeningText);
// the "?" beside it lists every command.
export default function MicButton({
  idleText = 'Tap to listen for voice commands',
  listeningText = 'Listening — "combo 3" / "combo next"',
  reserveStatus = false, // keep the status line's height even when it's empty
  style,
}) {
  const { listening, lastHeard, error, notice, feedback, onDevice, toggle } = useVoiceContext();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Pressable
          onPress={toggle}
          style={[styles.btn, listening ? styles.btnActive : styles.btnIdle]}
        >
          <Ionicons
            name={listening ? 'mic' : 'mic-outline'}
            size={fontSize.lg}
            color={listening ? '#ffffff' : colors.accent}
          />
          <Text style={[styles.label, { color: listening ? '#ffffff' : colors.accent }]}>
            {listening ? listeningText : idleText}
          </Text>
          {listening && onDevice && <Text style={styles.offline}>offline</Text>}
        </Pressable>
        <Pressable
          onPress={() => setHelpOpen(true)}
          style={styles.help}
          hitSlop={6}
          accessibilityLabel="Voice commands"
        >
          <Ionicons name="help" size={fontSize.lg} color={colors.textSecondary} />
        </Pressable>
      </View>

      {feedback ? (
        <Text style={styles.feedback} numberOfLines={1}>{feedback}</Text>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : notice ? (
        <Text style={styles.notice}>{notice}</Text>
      ) : listening && lastHeard ? (
        <Text style={styles.heard} numberOfLines={1}>heard: {lastHeard}</Text>
      ) : reserveStatus ? (
        <Text style={styles.heard}> </Text>
      ) : null}

      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  btnIdle: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
  },
  btnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  help: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderActive,
    borderRadius: radius.md,
  },
  label: { flexShrink: 1, textAlign: 'center', fontSize: fontSize.base, fontWeight: '500' },
  offline: {
    color: '#ffffff',
    opacity: 0.8,
    fontSize: fontSize.xs,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  error: { color: colors.advText, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
  feedback: { color: colors.accent, fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.xs, textAlign: 'center' },
  notice: { color: colors.voiceTitle, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
  heard: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
});
