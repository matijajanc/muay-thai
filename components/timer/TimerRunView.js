import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';
import {
  useTimerContext, useTimerTick, useVoiceContext, useGestureContext,
} from '../../contexts/AppContext';
import { isInfinite, secondsPhrase } from '../../utils/roundTimer';
import {
  phaseColor, phaseLabel, phaseDigits, ringUnder, nextLabel, workoutLeft, restHint, doneTitle,
  doneLine, doneSay,
} from '../../utils/timerLabels';
import TimerRing from './TimerRing';
import TimerIcon from './TimerIcon';
import TimerTint from './TimerTint';
import { Btn } from './TimerUI';

// Wireframe phone content width; the ring scales with the real screen width.
const WIREFRAME_W = 286;

// .runtop: run label + mic pill (tap toggles the shared mic). A wave gesture's
// line takes the label's place for 2 s (.gfb, gestures frame F2).
function RunTop({ label }) {
  const { listening, toggle } = useVoiceContext();
  const { feedback } = useGestureContext();
  return (
    <View style={styles.runtop}>
      <Text style={[styles.runLabel, feedback && styles.gestureLine]} numberOfLines={1}>
        {feedback ?? label}
      </Text>
      <Pressable onPress={toggle} hitSlop={8} style={[styles.pill, !listening && styles.pillIdle]}>
        <View style={[styles.pillDot, !listening && styles.pillDotIdle]} />
        <Text style={[styles.pillText, !listening && styles.pillTextIdle]}>
          {listening ? 'listening' : 'mic off'}
        </Text>
      </Pressable>
    </View>
  );
}

// .say: the spoken line, “Get ready”.
function Say({ text, style }) {
  return (
    <View style={[styles.say, style]}>
      <TimerIcon name="speak" size={12} color={colors.textSecondary} />
      <Text style={styles.sayText}>{text}</Text>
    </View>
  );
}

// .cue chip
function Cue({ color, bg, children }) {
  return <View style={[styles.cue, { backgroundColor: bg }]}>{children(color)}</View>;
}

// .dots: rounds done, the current round, rounds to come. ∞ → "Round 7".
function Dots({ run, done, current }) {
  if (isInfinite(run.config.rounds)) {
    return <Text style={styles.counter}>{`Round ${current ?? done}`}</Text>;
  }
  return (
    <View style={styles.dots}>
      {Array.from({ length: run.config.rounds }, (_, i) => {
        const n = i + 1;
        if (n === current) {
          return (
            <View key={n} style={styles.dot}>
              <View style={styles.dotRing} />
              <View style={[StyleSheet.absoluteFill, styles.dotFill, { backgroundColor: colors.timerWork }]} />
            </View>
          );
        }
        return <View key={n} style={[styles.dot, n <= done && { backgroundColor: colors.timerDone }]} />;
      })}
    </View>
  );
}

// .meta cards
function Meta({ run, pos }) {
  return (
    <View style={styles.meta}>
      <View style={styles.metaCard}>
        <Text style={styles.metaLabel}>Next</Text>
        <Text style={styles.metaValue}>{nextLabel(run, pos)}</Text>
      </View>
      <View style={styles.metaCard}>
        <Text style={styles.metaLabel}>Workout left</Text>
        <Text style={styles.metaValue}>{workoutLeft(run, pos)}</Text>
      </View>
    </View>
  );
}

// .cb / .cb.big with its label under it (.cb em).
function Control({ icon, label, big = false, bg, onPress, onLongPress }) {
  const size = big ? 78 : 54;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      style={[styles.cb, big && styles.cbBig, bg && { backgroundColor: bg }]}
    >
      <TimerIcon name={icon} size={big ? 30 : 20} color={big ? colors.bg : colors.textPrimary} />
      <Text
        numberOfLines={1}
        style={[styles.cbLabel, { top: size + 4, left: (size - CB_LABEL_W) / 2 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const CB_LABEL_W = 120;

// Timer tab while a run is going (D, E, E2, F, G, H).
export function TimerRunView() {
  const { run, pause, resume, skip, restartPhase, stop } = useTimerContext();
  const { pos, paused } = useTimerTick(true);
  const { width } = useWindowDimensions();
  if (!run || !pos) return <View style={styles.safeFill} />;
  // The last tick can land a moment before the run is marked done.
  if (pos.done) return <TimerDoneView />;

  const s = width / WIREFRAME_W;
  const workout = run.kind === 'workout';
  const color = paused ? colors.timerPaused : phaseColor(pos);
  const labelColor = paused ? colors.textSecondary : phaseColor(pos);
  const prep = pos.phase === 'prep';
  const rest = pos.phase === 'rest';
  const warn = pos.warn && pos.phase === 'work';
  // White digits in a round, phase-colored otherwise.
  const digitColor = paused || (pos.phase === 'work' && !warn) ? colors.title : phaseColor(pos);
  const tint = paused ? null : prep ? colors.tintPrep : warn ? colors.tintWarn : rest ? colors.tintRest : null;

  // Rounds done / current round for the dots.
  const doneRounds = pos.phase === 'work' ? pos.round - 1 : rest ? pos.round : 0;
  const currentRound = pos.phase === 'work' ? pos.round : null;

  let below = null;
  if (paused) {
    below = (
      <>
        {workout && <Dots run={run} done={doneRounds} current={currentRound} />}
        <Text style={[styles.hint, { marginTop: 10 }]}>Say “timer resume” · “timer stop”</Text>
      </>
    );
  } else if (prep) {
    below = (
      <>
        {run.config.beeps && (
          <Cue color={colors.timerPrep} bg={colors.cuePrepBg}>
            {(c) => (
              <>
                <TimerIcon name="beep" size={13} color={c} />
                <Text style={[styles.cueText, { color: c }]}>beep · beep · beep at 3-2-1, then</Text>
                <TimerIcon name="bell" size={13} color={c} />
              </>
            )}
          </Cue>
        )}
        {run.config.voice && <Say text="“Get ready”" />}
      </>
    );
  } else if (warn) {
    const sec = pos.segment.warnMs / 1000;
    below = (
      <>
        <Cue color={colors.timerWarn} bg={colors.cueWarnBg}>
          {(c) => (
            <>
              <TimerIcon name="clap" size={13} color={c} />
              <Text style={[styles.cueText, { color: c }]}>{`clap · ${sec} s left`}</Text>
            </>
          )}
        </Cue>
        {run.config.voice && <Say text={`“${secondsPhrase(sec)}”`} />}
      </>
    );
  } else if (!workout) {
    below = <Text style={[styles.hint, { marginTop: 18 }]}>Say “timer stop” to cancel</Text>;
  } else {
    below = (
      <>
        <Dots run={run} done={doneRounds} current={currentRound} />
        <Meta run={run} pos={pos} />
        {rest && <Text style={[styles.hint, { marginTop: 10 }]}>{restHint(run, pos)}</Text>}
      </>
    );
  }

  const restartLabel = rest ? 'restart rest' : prep ? 'restart' : 'restart round';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {tint && <TimerTint color={tint} />}
      <View style={styles.run}>
        <RunTop label={run.label} />
        <Text style={[styles.phase, { color: labelColor }]}>{phaseLabel(run, pos)}</Text>
        <View style={{ marginTop: 10 }}>
          <TimerRing size={236 * s} color={color} fraction={pos.remainingMs / pos.segment.durMs}>
            <Text
              style={[
                styles.digits,
                prep
                  ? { fontSize: 104 * s, lineHeight: 104 * s, fontWeight: '200' }
                  : { fontSize: 66 * s, lineHeight: 66 * s },
                { letterSpacing: -1 * s, color: digitColor },
                paused && styles.dim,
              ]}
            >
              {phaseDigits(pos)}
            </Text>
            <Text style={[styles.under, { fontSize: 11 * s, marginTop: 6 * s }]}>
              {ringUnder(run, pos, paused)}
            </Text>
          </TimerRing>
          {paused && (
            <View style={[styles.badgeWrap, { top: 34 * s }]} pointerEvents="none">
              <Text
                style={[
                  styles.badge,
                  {
                    fontSize: 10 * s,
                    letterSpacing: 1.6 * s,
                    paddingVertical: 3 * s,
                    paddingHorizontal: 9 * s,
                    borderRadius: 6 * s,
                  },
                ]}
              >
                PAUSED
              </Text>
            </View>
          )}
        </View>
        {below}
        <View style={styles.ctrls}>
          {paused ? (
            <>
              <Control icon="restart" label={restartLabel} onPress={restartPhase} />
              <Control icon="play" label="resume" big bg={colors.accent} onPress={resume} />
              <Control icon="stop" label="stop" onPress={stop} />
            </>
          ) : (
            <>
              {/* A glove brushing the screen mustn't end the workout. */}
              <Control icon="stop" label="hold to stop" onLongPress={stop} />
              <Control icon="pause" label="pause" big bg={color} onPress={pause} />
              <Control icon="skip" label={rest ? 'skip rest' : 'skip'} onPress={skip} />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Timer tab after the final bell (I).
export function TimerDoneView() {
  const { run, again, dismissDone } = useTimerContext();
  if (!run) return <View style={styles.safeFill} />;
  const line = doneLine(run);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.run}>
        <RunTop label={run.label} />
        <View style={styles.doneCircle}>
          <TimerIcon name="check" size={46} color={colors.timerDone} />
        </View>
        <Text style={styles.doneTitle}>{doneTitle(run)}</Text>
        {line && <Text style={styles.doneLine}>{line}</Text>}
        {run.config.voice && <Say text={doneSay(run)} style={{ marginTop: 14 }} />}
        <View style={styles.doneBtns}>
          <Btn label="Again" icon="restart" onPress={again} />
          <Btn label="Back to setup" ghost onPress={dismissDone} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  safeFill: { flex: 1, backgroundColor: colors.bg },
  run: { flex: 1, alignItems: 'center', paddingTop: 6, paddingHorizontal: 16 },

  runtop: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  runLabel: { flexShrink: 1, fontSize: 11, color: colors.textSecondary, marginRight: 8 },
  gestureLine: { color: colors.accent, fontWeight: '600' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillIdle: { borderColor: colors.chipInactiveBorder },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  pillDotIdle: { backgroundColor: colors.textMuted },
  pillText: { fontSize: 10.5, fontWeight: '600', color: colors.accent },
  pillTextIdle: { color: colors.textMuted },

  phase: { marginTop: 18, fontSize: 12, letterSpacing: 2.4, fontWeight: '700' },
  digits: {
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textAlign: 'center',
  },
  dim: { opacity: 0.35 },
  under: { color: colors.textSecondary },
  badgeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  badge: {
    backgroundColor: colors.border,
    color: colors.textPrimary,
    fontWeight: '700',
    overflow: 'hidden',
  },

  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dotIdle },
  dotRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.dotCurrentRing,
  },
  dotFill: { borderRadius: 4 },
  counter: { marginTop: 14, fontSize: 11, color: colors.textSecondary },

  meta: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 14 },
  metaCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  metaLabel: {
    fontSize: 9.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },

  cue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  cueText: { fontSize: 11, fontWeight: '600' },
  say: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  sayText: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic' },
  hint: { fontSize: 10.5, color: colors.textMuted, textAlign: 'center' },

  ctrls: {
    marginTop: 'auto',
    paddingTop: 12,
    paddingBottom: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  cb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbBig: { width: 78, height: 78, borderRadius: 39, borderWidth: 0 },
  cbLabel: {
    position: 'absolute',
    width: CB_LABEL_W,
    textAlign: 'center',
    fontSize: 9.5,
    color: colors.textMuted,
  },

  doneCircle: {
    marginTop: 70,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.doneCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 20, fontWeight: '600', color: colors.title, marginTop: 18 },
  doneLine: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4 },
  doneBtns: { marginTop: 'auto', width: '100%', gap: 10, paddingBottom: 16 },
});
