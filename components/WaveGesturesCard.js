import { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '../constants/theme';
import { usePrefsContext } from '../contexts/AppContext';
import { isAvailable, addProximityListener } from '../modules/proximity';
import { createWaveDetector } from '../utils/waveGestures';
import { GESTURE_HELP } from '../voice/commandHelp';
import { Toggle } from './timer/TimerUI';

// A sensor that sends nothing this long after we start listening only runs
// during calls (some "virtual" sensors do): treat it as missing.
const SILENT_MS = 3000;
const GESTURE_NAMES = { wave: 'wave', doubleWave: 'double wave', hold: 'hold' };

// .sense: Covered (accent dot with a ring) / Clear (grey dot).
function Sense({ near }) {
  return (
    <View style={styles.sense}>
      <View style={styles.senseDotWrap}>
        {near && <View style={styles.senseRing} />}
        <View style={[styles.senseDot, near && styles.senseDotNear]} />
      </View>
      <Text style={[styles.senseText, near && { color: colors.accent }]}>{near ? 'Covered' : 'Clear'}</Text>
    </View>
  );
}

// Settings "Wave gestures" (G1, G2): the on/off toggle, the gesture cheat
// sheet and a live sensor test. Android only. Gestures recognised here only
// show in the test; App ignores them while Settings is open.
export default function WaveGesturesCard() {
  const { prefs, update } = usePrefsContext();
  const [available] = useState(isAvailable);
  const focused = useIsFocused();
  const [near, setNear] = useState(false);
  const [last, setLast] = useState(null);
  const [silent, setSilent] = useState(false);

  useEffect(() => {
    if (!available || !focused) return undefined;
    let heard = false;
    const detector = createWaveDetector({
      emit: ({ type }) => {
        if (type !== 'armed') setLast(type);
      },
    });
    const sub = addProximityListener((reading) => {
      heard = true;
      setSilent(false);
      setNear(reading.near);
      detector.feed(reading);
    });
    const timer = setTimeout(() => {
      if (!heard) setSilent(true);
    }, SILENT_MS);
    return () => {
      clearTimeout(timer);
      sub.remove();
      detector.reset();
      setNear(false);
    };
  }, [available, focused]);

  if (Platform.OS !== 'android') return null;

  const on = prefs.waveGestures;
  const usable = available && !silent;

  return (
    <>
      <Text style={styles.label}>Wave gestures</Text>
      {usable ? (
        <>
          <View style={styles.card}>
            <Pressable style={[styles.r, styles.rTall]} onPress={() => update({ waveGestures: !on })}>
              <Text style={styles.toggleLabel}>Wave gestures</Text>
              <Toggle on={on} />
            </Pressable>
            {GESTURE_HELP.map(row => (
              <View key={row.gesture} style={styles.gx}>
                <View style={styles.say}>
                  <View style={[styles.pill, !on && styles.dim]}>
                    <Text style={styles.pillText}>{row.gesture}</Text>
                  </View>
                </View>
                <Text style={[styles.does, !on && styles.dim]}>{row.does}</Text>
              </View>
            ))}
            <View style={[styles.r, styles.rTall, styles.rLast]}>
              <Text style={styles.rLabel}>
                Sensor test
                {last && <Text style={styles.small}>{` · last: ${GESTURE_NAMES[last]}`}</Text>}
              </Text>
              <Sense near={near} />
            </View>
          </View>
          <Text style={styles.tip}>
            Wave a hand or glove about 5 cm over the top of the screen, next to the front camera.
            Covering the sensor longer than 4 s does nothing, so a pocket or a face-down phone won’t
            set anything off.
          </Text>
        </>
      ) : (
        <View style={styles.card}>
          <View style={[styles.r, styles.rTall]}>
            <Text style={[styles.toggleLabel, { color: colors.textMuted }]}>Wave gestures</Text>
            <View style={styles.toggleDisabled}>
              <Toggle on={false} />
            </View>
          </View>
          <Text style={styles.noSensor}>
            This phone has no proximity sensor the app can use. Voice commands still work hands-free.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  r: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rTall: { minHeight: 40 },
  rLast: { borderBottomWidth: 0 },
  rLabel: { flexShrink: 1, fontSize: 12.5, color: colors.textSecondary },
  toggleLabel: { fontSize: 12.5, color: colors.textPrimary },
  toggleDisabled: { opacity: 0.35 },
  small: { fontSize: 10.5, color: colors.textMuted },

  gx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  say: { width: 92, flexDirection: 'row' },
  pill: {
    backgroundColor: colors.chipOnBg,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  pillText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  does: { flex: 1, color: colors.textSecondary, fontSize: 11.5, lineHeight: 11.5 * 1.35 },
  dim: { opacity: 0.45 },

  sense: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  senseDotWrap: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  senseRing: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: colors.dotCurrentRing,
  },
  senseDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.dotIdle,
    borderWidth: 1,
    borderColor: colors.controlBorder,
  },
  senseDotNear: { backgroundColor: colors.accent, borderColor: colors.accent },
  senseText: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary },

  tip: { fontSize: 11, lineHeight: 11 * 1.5, color: colors.textMuted, marginTop: 8 },
  noSensor: {
    paddingVertical: 10,
    fontSize: 11.5,
    lineHeight: 11.5 * 1.45,
    color: colors.textSecondary,
  },
});
