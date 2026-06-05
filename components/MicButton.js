import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import { useVoiceContext } from '../contexts/AppContext';

export default function MicButton() {
  const { listening, lastHeard, error, notice, onDevice, toggle } = useVoiceContext();

  return (
    <View style={styles.wrap}>
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
          {listening ? 'Listening — say "combo 3"' : 'Tap to listen for voice commands'}
        </Text>
        {listening && onDevice && <Text style={styles.offline}>offline</Text>}
      </Pressable>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : notice ? (
        <Text style={styles.notice}>{notice}</Text>
      ) : listening && lastHeard ? (
        <Text style={styles.heard} numberOfLines={1}>heard: {lastHeard}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  btn: {
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
  label: { fontSize: fontSize.base, fontWeight: '500' },
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
  notice: { color: colors.voiceTitle, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
  heard: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
});
