import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme';
import TimerIcon from './TimerIcon';

// Small building blocks shared by the Timer tab and its sheets (wireframe
// classes in comments).

// .lbl
export function SectionLabel({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

// .chip / .chip.on / .chip.dash, optionally with a leading icon.
export function Chip({ label, icon, on = false, dashed = false, onPress, onLongPress, style }) {
  const color = on ? colors.accent : colors.chipInactiveText;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, on && styles.chipOn, dashed && styles.chipDashed, style]}
    >
      {icon && <TimerIcon name={icon} size={11} color={color} style={styles.chipIcon} />}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// .btn / .btn.ghost
export function Btn({ label, icon, ghost = false, disabled = false, onPress, style }) {
  const color = ghost ? colors.accent : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, ghost && styles.btnGhost, disabled && styles.btnDisabled, style]}
    >
      {icon && <TimerIcon name={icon} size={16} color={color} />}
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// .tog / .tog.on
export function Toggle({ on }) {
  return (
    <View style={[styles.tog, on && styles.togOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 6,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    backgroundColor: colors.chipInactiveBg,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.chipOnBg },
  chipDashed: { borderStyle: 'dashed' },
  chipIcon: { marginRight: 3 },
  chipText: { fontSize: 11.5 },

  btn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: '600' },

  tog: { width: 30, height: 17, borderRadius: 9, backgroundColor: colors.toggleOff },
  togOn: { backgroundColor: colors.accent },
  knob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.toggleKnobOff,
  },
  knobOn: { left: 15, backgroundColor: '#ffffff' },
});
