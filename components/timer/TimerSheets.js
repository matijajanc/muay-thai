import { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, Animated, Easing, Keyboard, Dimensions, Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';
import { formatClock } from '../../utils/roundTimer';
import { optionLabel } from '../../utils/timerLabels';
import { LIMITS, OPTION_SECONDS, PRESET_NAME_MAX } from '../../data/timerPresets';
import { Chip, Btn } from './TimerUI';

// ---- Shell: scrim + bottom sheet (.scrim / .sheet / .grab / .sheet-t) ----

export function Sheet({ visible, onClose, title, meta, children }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [keyboard, setKeyboard] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  useEffect(() => {
    // The modal covers the whole screen (edge to edge), so lift the sheet to the
    // keyboard's top edge; endCoordinates.height leaves out the navigation bar.
    // iOS announces the keyboard before it slides in, so the sheet moves with it.
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e =>
      setKeyboard(Math.max(0, Dimensions.get('screen').height - e.endCoordinates.screenY)));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!mounted) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.behindDim }]} />
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            bottom: keyboard,
            paddingBottom: 16 + (keyboard ? 0 : insets.bottom),
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }],
          },
        ]}
      >
        <View style={styles.grab} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

// Press-and-hold repeats, faster the longer it's held.
function useRepeat(step) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const timerRef = useRef(null);
  const stopRepeat = () => clearTimeout(timerRef.current);
  const startRepeat = () => {
    stopRepeat();
    stepRef.current();
    let count = 0;
    const tick = () => {
      stepRef.current();
      count += 1;
      timerRef.current = setTimeout(tick, count > 8 ? 50 : 110);
    };
    timerRef.current = setTimeout(tick, 400);
  };
  useEffect(() => stopRepeat, []);
  return { onPressIn: startRepeat, onPressOut: stopRepeat };
}

function Stepper({ label, onStep }) {
  const repeat = useRepeat(onStep);
  return (
    <Pressable style={styles.stepBtn} {...repeat}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

// ---- B: round time / rest ----

const DURATION = {
  round: { title: 'Round time', chips: [30, 60, 120, 180, 300], range: LIMITS.roundSec },
  rest: { title: 'Rest', chips: [10, 30, 60, 90, 120], range: LIMITS.restSec },
};

export function DurationSheet({ visible, kind, value, onChange, onClose }) {
  const { title, chips, range } = DURATION[kind] ?? DURATION.round;
  const [min, max] = range;
  const valueRef = useRef(value);
  valueRef.current = value;
  const change = (delta) => {
    const next = Math.max(min, Math.min(max, valueRef.current + delta));
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChange(next);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      meta={`${formatClock(min)} – ${formatClock(max)}`}
    >
      <View style={styles.editor}>
        <View style={styles.col}>
          <Stepper label="+" onStep={() => change(60)} />
          <Text style={styles.n}>{Math.floor(value / 60)}</Text>
          <Stepper label="−" onStep={() => change(-60)} />
          <Text style={styles.small}>min</Text>
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.col}>
          <Stepper label="+" onStep={() => change(5)} />
          <Text style={styles.n}>{String(value % 60).padStart(2, '0')}</Text>
          <Stepper label="−" onStep={() => change(-5)} />
          <Text style={styles.small}>sec · ±5</Text>
        </View>
      </View>
      <View style={[styles.chips, styles.durationChips]}>
        {chips.map(sec => (
          <Chip key={sec} label={formatClock(sec)} on={value === sec} onPress={() => onChange(sec)} />
        ))}
      </View>
      <Btn label="Done" onPress={onClose} />
    </Sheet>
  );
}

// ---- B2: round-end warning / rest-end warning / start delay ----

// hint(value) → the line under the chips. options: the values to pick from
// (the timer's warning/delay seconds by default); label(value) → chip text.
export function OptionSheet({
  visible, title, meta, value, hint, onChange, onClose,
  options = OPTION_SECONDS, label = optionLabel,
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} meta={meta}>
      <View style={[styles.chips, styles.optionChips]}>
        {options.map(v => (
          <Chip key={v} label={label(v)} on={value === v} onPress={() => onChange(v)} />
        ))}
      </View>
      <Text style={[styles.hint, styles.optionHint]}>{hint(value)}</Text>
      <Btn label="Done" onPress={onClose} />
    </Sheet>
  );
}

// ---- B3: clock position ----

// Schematic mini screens of K / L / M, and Off (.mini-scr i / b / u).
const Bar = ({ style }) => <View style={[tile.bar, style]} />;
const Dot = ({ style }) => <View style={[tile.dot, style]} />;
const Band = ({ style }) => <View style={[tile.band, style]} />;

const TILE_SCREENS = {
  center: (
    <>
      <Bar style={{ top: 8 }} />
      <Bar style={{ top: 17, right: 20 }} />
      <Bar style={{ top: 28 }} />
      <Bar style={{ top: 37 }} />
      <Band style={{ top: 24, bottom: 0, height: undefined, backgroundColor: colors.tileOverlay }} />
      <Dot style={{ left: 14, top: 30, width: 24, height: 24 }} />
      <Bar style={{ top: 62, height: 14, backgroundColor: colors.tileCard, borderWidth: 1, borderColor: colors.controlBorder }} />
    </>
  ),
  top: (
    <>
      <Band style={{ top: 0, borderBottomWidth: 1 }} />
      <Dot style={{ left: 5, top: 3, width: 16, height: 16 }} />
      <Bar style={{ top: 8, left: 26, right: 6, backgroundColor: colors.controlBorder }} />
      <Bar style={{ top: 30 }} />
      <Bar style={{ top: 39 }} />
      <Bar style={{ top: 48 }} />
      <Bar style={{ top: 57 }} />
    </>
  ),
  bottom: (
    <>
      <Bar style={{ top: 8 }} />
      <Bar style={{ top: 17, right: 20 }} />
      <Bar style={{ top: 28 }} />
      <Bar style={{ top: 37 }} />
      <Bar style={{ top: 46 }} />
      <Band style={{ bottom: 0, borderTopWidth: 1 }} />
      <Dot style={{ left: 5, bottom: 3, width: 16, height: 16 }} />
      <Bar style={{ bottom: 10, left: 26, right: 6, backgroundColor: colors.controlBorder }} />
    </>
  ),
  off: (
    <>
      {[8, 17, 28, 37, 46, 55, 64].map((top, i) => (
        <Bar key={top} style={{ top, right: i === 1 ? 20 : 6 }} />
      ))}
    </>
  ),
};

export const CLOCK_POSITIONS = [
  { key: 'center', label: 'Center' },
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'off', label: 'Off' },
];

export function ClockPositionSheet({ visible, value, onChange, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Clock on Training" meta="while a timer runs">
      <View style={styles.opts}>
        {CLOCK_POSITIONS.map(({ key, label }) => {
          const on = value === key;
          return (
            <Pressable key={key} style={[styles.opt, on && styles.optOn]} onPress={() => onChange(key)}>
              <View style={tile.screen}>{TILE_SCREENS[key]}</View>
              <Text style={[styles.optText, on && styles.optTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Btn label="Done" onPress={onClose} />
    </Sheet>
  );
}

// ---- B4: save preset ----

// reservedNames: built-in preset names, which can't be saved over.
export function SavePresetSheet({ visible, meta, reservedNames = [], onSave, onClose }) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (visible) setName('');
  }, [visible]);
  const trimmed = name.trim();
  const canSave = !!trimmed && !reservedNames.some(n => n.toLowerCase() === trimmed.toLowerCase());

  return (
    <Sheet visible={visible} onClose={onClose} title="Save preset" meta={meta}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={PRESET_NAME_MAX}
        autoFocus
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        returnKeyType="done"
        onSubmitEditing={() => canSave && onSave(trimmed)}
      />
      <Text style={[styles.hint, styles.inputHint]}>
        Up to 20 characters. It appears after the built-in presets.
      </Text>
      <Btn label="Save" disabled={!canSave} onPress={() => onSave(trimmed)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.sheet,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  grab: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.controlBorder,
    alignSelf: 'center',
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 15, fontWeight: '600', color: colors.title },
  meta: { fontSize: 11, color: colors.textMuted },

  editor: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 6,
  },
  col: { alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 40,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.accent, fontSize: 18 },
  n: {
    fontSize: 52,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    color: colors.title,
    lineHeight: 52 * 1.05,
    includeFontPadding: false,
  },
  small: { fontSize: 10, color: colors.textMuted },
  colon: { fontSize: 48, fontWeight: '200', color: colors.textSecondary, marginTop: -18 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  durationChips: { marginTop: 10, marginBottom: 14 },
  optionChips: { marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 10.5, color: colors.textMuted, textAlign: 'center' },
  optionHint: { marginBottom: 14 },

  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 14 },
  opt: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    borderRadius: 12,
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 6,
  },
  optOn: { borderColor: colors.accent, backgroundColor: colors.optionOnBg },
  optText: { fontSize: 11.5, color: colors.textSecondary },
  optTextOn: { color: colors.accent, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.title,
    marginTop: 14,
  },
  inputHint: { textAlign: 'left', marginTop: 6, marginBottom: 12 },
});

const tile = StyleSheet.create({
  screen: {
    width: 52,
    height: 84,
    borderWidth: 1.5,
    borderColor: colors.controlBorder,
    borderRadius: 9,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 5,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dot: { position: 'absolute', borderRadius: 12, backgroundColor: colors.accent },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: colors.tileBand,
    borderColor: colors.chipInactiveBorder,
  },
});
