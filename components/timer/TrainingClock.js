import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import {
  useTimerContext, useTimerTick, useSessionContext, useFavoritesContext,
} from '../../contexts/AppContext';
import { phaseColor, phaseLabel, phaseDigits, hubLine, bandLine } from '../../utils/timerLabels';
import TimerDial from './TimerDial';
import TimerIcon from './TimerIcon';

const WIREFRAME_W = 286;
const LINGER_MS = 2000; // the clock stays this long after the final bell
const FADE_IN_MS = 200;
const FADE_OUT_MS = 300;

// Whether the Training clock shows: while a timer runs or is paused, and for
// 2 s after the final bell. Stopping hides it at once.
export function useTrainingClockVisible() {
  const { status, run } = useTimerContext();
  const doneAt = status === 'done' ? run?.doneAt : null;
  const [lingering, setLingering] = useState(false);
  useEffect(() => {
    if (!doneAt) {
      setLingering(false);
      return;
    }
    const left = LINGER_MS - (Date.now() - doneAt);
    if (left <= 0) {
      setLingering(false);
      return;
    }
    setLingering(true);
    const t = setTimeout(() => setLingering(false), left);
    return () => clearTimeout(t);
  }, [doneAt]);
  return status === 'running' || status === 'paused' || lingering;
}

// Fades in on show; fades out after the final bell, but vanishes at once on stop.
function useFade(visible) {
  const { status } = useTimerContext();
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }).start();
    } else if (status === 'idle') {
      opacity.setValue(0);
      setMounted(false);
    } else {
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true })
        .start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, status, opacity]);
  return { mounted, opacity };
}

// .fctl: pause/resume, skip, stop. Stop needs a long-press while running.
function MiniControls({ style }) {
  const { status, pause, resume, skip, stop } = useTimerContext();
  const paused = status === 'paused';
  const done = status === 'done';
  return (
    <View style={[styles.fctl, style]}>
      <Pressable style={styles.mini} onPress={paused ? resume : pause} disabled={done} hitSlop={4}>
        <TimerIcon name={paused ? 'play' : 'pause'} size={13} color={colors.textPrimary} />
      </Pressable>
      <Pressable style={styles.mini} onPress={skip} disabled={done} hitSlop={4}>
        <TimerIcon name="skip" size={13} color={colors.textPrimary} />
      </Pressable>
      <Pressable
        style={styles.mini}
        onPress={paused || done ? stop : undefined}
        onLongPress={stop}
        delayLongPress={600}
        hitSlop={4}
      >
        <TimerIcon name="stop" size={13} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

// Everything the three layouts need from the live position.
function useClockFace() {
  const { run, pos, paused } = useTimerTick(true);
  if (!run || !pos) return null;
  const segment = pos.segment ?? run.segments[run.segments.length - 1];
  const warn = pos.warn && pos.phase === 'work';
  return {
    run,
    pos,
    paused,
    label: phaseLabel(run, pos),
    labelColor: paused ? colors.textSecondary : phaseColor(pos),
    color: paused ? colors.timerPaused : phaseColor(pos),
    digits: pos.done ? '0:00' : phaseDigits(pos),
    digitColor: paused || (pos.phase === 'work' && !warn) ? colors.title : phaseColor(pos),
    totalSec: segment.durMs / 1000,
    leftSec: pos.remainingMs / 1000,
    warnSec: pos.done ? 0 : segment.warnMs / 1000,
    pulse: warn ? `warn:${pos.index}` : null,
  };
}

// .nowcard: the combo you opened last, pinned under the Center clock.
function NowCard({ onLayout }) {
  const {
    session, activeIndex, expandedId, timerPercent, expandNext, expandPrevious,
  } = useSessionContext();
  const { favorites, toggleFavorite } = useFavoritesContext();
  const index = activeIndex ?? 0;
  const combo = session[index];
  if (!combo) return null;
  const favorite = favorites.has(combo.id);
  const label = activeIndex == null
    ? `NEXT UP · COMBO ${index + 1} OF ${session.length}`
    : `NOW · COMBO ${index + 1} OF ${session.length}`;
  const percent = expandedId === combo.id ? timerPercent : 0;

  return (
    <View style={styles.nowcard} onLayout={onLayout}>
      <View style={styles.nowtop}>
        <Text style={styles.nowlbl}>{label}</Text>
        <Pressable onPress={() => toggleFavorite(combo.id)} hitSlop={10}>
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={14}
            color={favorite ? colors.accent : colors.comboNumber}
          />
        </Pressable>
      </View>
      <Text style={styles.nowname}>{combo.name}</Text>
      <Text style={styles.nowdesc}>{combo.steps.join('\n')}</Text>
      <View style={styles.nowfoot}>
        <Pressable style={styles.navb} onPress={expandPrevious} hitSlop={6}>
          <Text style={styles.navbText}>‹</Text>
        </Pressable>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
        </View>
        <Pressable style={styles.navb} onPress={expandNext} hitSlop={6}>
          <Text style={styles.navbText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Height of the Center overlay's content other than the dial and the card:
// paddings, phase label, gaps and the mini controls.
const CENTER_CHROME = 8 + 2 + 17 + 6 + 7 + 34 + 12;
const CARD_GAP = 8;

// K: overlay below the pinned header and mic, above the tab bar. The dial is
// 188·W/286, shrunk only if the overlay is too short to fit it.
function CenterClock({ withCombo }) {
  const face = useClockFace();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  if (!face) return null;
  const { run, pos, paused } = face;
  const room = height - CENTER_CHROME - (withCombo ? cardHeight + CARD_GAP : 0);
  const dialSize = Math.max(0, height ? Math.min(188 * (width / WIREFRAME_W), room) : 0);
  return (
    <View style={styles.overlay} onLayout={e => setHeight(e.nativeEvent.layout.height)}>
      <Text style={[styles.phase, { color: face.labelColor }]}>{face.label}</Text>
      <View style={styles.centerDial}>
        <TimerDial
          size={dialSize}
          totalSec={face.totalSec}
          leftSec={face.leftSec}
          color={face.color}
          warnSec={face.warnSec}
          digits={face.digits}
          sub={hubLine(run, pos, paused)}
          pulse={face.pulse}
        />
      </View>
      <MiniControls />
      {withCombo && <NowCard onLayout={e => setCardHeight(e.nativeEvent.layout.height)} />}
    </View>
  );
}

// L / M: dial + big digits side by side.
function BandBody({ face, dialSize, digitSize, controlsTop }) {
  const { run, pos, paused } = face;
  return (
    <>
      <TimerDial
        size={dialSize}
        totalSec={face.totalSec}
        leftSec={face.leftSec}
        color={face.color}
        warnSec={face.warnSec}
        hub={26}
        pulse={face.pulse}
      />
      <View style={styles.bandText}>
        <Text style={[styles.bandLabel, { color: face.labelColor }]}>{face.label}</Text>
        <Text
          style={[
            styles.bandDigits,
            { fontSize: digitSize, lineHeight: digitSize * 1.05, color: face.digitColor },
            paused && styles.dim,
          ]}
        >
          {face.digits}
        </Text>
        <Text style={styles.bandLine}>{bandLine(run, pos, paused)}</Text>
        <MiniControls style={[styles.bandControls, { marginTop: controlsTop }]} />
      </View>
    </>
  );
}

function TopBand() {
  const face = useClockFace();
  if (!face) return null;
  return (
    <View style={styles.topBand}>
      <BandBody face={face} dialSize={112} digitSize={46} controlsTop={8} />
    </View>
  );
}

function BottomBand({ onLayout }) {
  const face = useClockFace();
  if (!face) return null;
  return (
    <View style={styles.bottomBand} onLayout={onLayout}>
      <BandBody face={face} dialSize={104} digitSize={44} controlsTop={6} />
    </View>
  );
}

// The round timer on the Training screen (J–M). Rendered by TrainingScreen in
// both of its states; `position` comes from the "Clock on Training" setting.
// center: top = where the overlay starts (below the pinned header and mic);
// withCombo: show the current-combo card (session view only).
// bottom: onLayout reports the band's height so the list can pad for it.
export default function TrainingClock({ position, top = 0, withCombo = false, onLayout }) {
  const visible = useTrainingClockVisible();
  const { mounted, opacity } = useFade(visible);
  if (!mounted || position === 'off') return null;

  let body = null;
  if (position === 'center') body = <CenterClock withCombo={withCombo} />;
  else if (position === 'top') body = <TopBand />;
  else if (position === 'bottom') body = <BottomBand onLayout={onLayout} />;

  const floating = position === 'center' || position === 'bottom';
  return (
    <Animated.View
      style={[
        floating && styles.floating,
        position === 'center' && { top },
        position === 'bottom' && styles.floatingBottom,
        { opacity },
      ]}
      pointerEvents="box-none"
    >
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3 },
  floatingBottom: { top: undefined },

  overlay: {
    flex: 1,
    backgroundColor: colors.timerOverlay,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  phase: { marginTop: 2, fontSize: 12, letterSpacing: 2.4, fontWeight: '700' },
  centerDial: { marginTop: 6 },

  fctl: { flexDirection: 'row', gap: 10, marginTop: 7, justifyContent: 'center' },
  mini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nowcard: {
    width: '100%',
    marginTop: 'auto',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    borderRadius: 12,
    paddingTop: 9,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  nowtop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nowlbl: { fontSize: 9.5, letterSpacing: 1.3, color: colors.accent, fontWeight: '700' },
  nowname: { fontSize: 14, fontWeight: '600', color: colors.title, marginTop: 3 },
  nowdesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 11 * 1.45, marginTop: 3 },
  nowfoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  navb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbText: { color: colors.textPrimary, fontSize: 16, lineHeight: 16, includeFontPadding: false },
  bar: { flex: 1, height: 2, backgroundColor: colors.border, borderRadius: 2 },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },

  topBand: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomBand: {
    backgroundColor: colors.timerBand,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bandText: { flex: 1, minWidth: 0 },
  bandLabel: { fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  bandDigits: { fontWeight: '300', fontVariant: ['tabular-nums'], includeFontPadding: false },
  bandLine: { fontSize: 11, color: colors.textSecondary },
  bandControls: { justifyContent: 'flex-start' },
  dim: { opacity: 0.35 },
});
