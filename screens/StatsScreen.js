import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../constants/theme';
import { useHistoryContext, usePrefsContext } from '../contexts/AppContext';
import TimerIcon from '../components/timer/TimerIcon';
import { Chip, Btn } from '../components/timer/TimerUI';
import { Sheet } from '../components/timer/TimerSheets';
import {
  weekStreak, weekCompare, weeklyMinutes, techniqueMix, mostDrilled, allTime, startOfDay,
  MIN_MIX_COMBOS,
} from '../utils/stats';
import {
  DAY_LETTERS, weekRange, formatDuration, streakLine, goalChip, goalHint, timeDelta, countDelta,
  dayLabel, clockTime, entryTitle, entryMeta, deleteMessage, monthLabel, longDate,
} from '../utils/statsLabels';

const PAGE = 30; // history rows per "Show older"
const GOALS = [1, 2, 3, 4, 5, 6, 7];
const TYPE_LABELS = {
  punches: 'Punches', kicks: 'Kicks', elbows: 'Elbows', knees: 'Knees', clinch: 'Clinch',
  mixed: 'Mixed', deadliest: 'Deadliest',
};
const DIFFS = {
  beg: { label: 'Beginner', color: colors.begText },
  int: { label: 'Intermediate', color: colors.intText },
  adv: { label: 'Advanced', color: colors.advText },
};

// .lbl, with an optional note on the right (.lbl span).
function Label({ children, note, style }) {
  return (
    <View style={[styles.lbl, style]}>
      <Text style={styles.lblText}>{children}</Text>
      {note ? <Text style={styles.lblNote}>{note}</Text> : null}
    </View>
  );
}

// .streak (S1, S5): streak, best, this week's day dots, goal.
function StreakCard({ streak, goal, onGoal }) {
  const live = streak.current > 0;
  return (
    <View style={styles.streak}>
      <View style={styles.skTop}>
        <TimerIcon name="flame" size={20} color={live ? colors.accent : colors.textMuted} />
        <Text style={[styles.skN, !live && { color: colors.textMuted }]}>{streak.current}</Text>
        <Text style={styles.skL}>week streak</Text>
        {streak.best > 0 && (
          <Text style={styles.skBest}>
            Best <Text style={styles.skBestN}>{streak.best}</Text>
          </Text>
        )}
      </View>
      <View style={styles.wk}>
        {streak.week.map((day, i) => (
          <View key={day.key} style={styles.wkDay}>
            <View
              style={[
                styles.wkDot,
                day.today && styles.wkDotToday,
                day.trained && styles.wkDotOn,
              ]}
            >
              {day.trained && <TimerIcon name="checkBold" size={12} color={colors.bg} />}
            </View>
            <Text style={[styles.wkLetter, day.today && styles.wkLetterToday]}>{DAY_LETTERS[i]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.skFoot}>
        <Text style={styles.skFootText}>{streakLine(streak, goal)}</Text>
        <Pressable onPress={onGoal} hitSlop={8} style={styles.goal}>
          <Text style={styles.goalText}>{goalChip(goal)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// .tile
function Tile({ label, value, delta }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={[styles.tileDelta, delta.up && { color: colors.timerDone }]}>{delta.text}</Text>
    </View>
  );
}

// Wireframe chart geometry (viewBox 0 0 262 118).
const CHART = { W: 262, H: 118, top: 8, base: 96, gap: 6, right: 40 };

// .chartcard: minutes per week, oldest to newest, with the 12-week average.
function WeekChart({ bars }) {
  const [width, setWidth] = useState(0);
  const { W, H, top, base, gap, right } = CHART;
  const values = bars.map(b => b.minutes);
  const n = values.length;
  const max = Math.max(1, ...values) * 1.08;
  const bw = (W - right - gap * (n - 1)) / n;
  const h = (v) => (v / max) * (base - top);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / n);
  const avgY = base - h(avg);
  const last = values[n - 1];

  return (
    <View style={styles.chartCard} onLayout={e => setWidth(e.nativeEvent.layout.width - 20)}>
      {width > 0 && (
        <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
          <Line x1={0} y1={base} x2={W - right} y2={base} stroke={colors.border} strokeWidth={1} />
          {bars.map((bar, i) => {
            const x = i * (bw + gap);
            return (
              <G key={bar.start}>
                {bar.minutes > 0 && (
                  <Rect
                    x={x}
                    y={base - h(bar.minutes)}
                    width={bw}
                    height={h(bar.minutes)}
                    rx={3}
                    fill={i === n - 1 ? colors.accent : colors.barPast}
                  />
                )}
                {bar.month != null && (
                  <SvgText x={x} y={base + 14} fontSize={10} fill={colors.textMuted}>
                    {monthLabel(bar.month)}
                  </SvgText>
                )}
              </G>
            );
          })}
          <Line
            x1={0}
            y1={avgY}
            x2={W - right}
            y2={avgY}
            stroke={colors.chartAvg}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <SvgText x={W - 36} y={avgY + 3} fontSize={10} fill={colors.chartAvg}>{`avg ${avg}`}</SvgText>
          <SvgText
            x={(n - 1) * (bw + gap) + bw / 2}
            y={base - h(last) - 4}
            fontSize={10}
            fontWeight="600"
            fill={colors.accent}
            textAnchor="middle"
          >
            {String(last)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

// .mix: combo types (scaled to the biggest) and the difficulty split.
function MixCard({ mix }) {
  if (mix.total < MIN_MIX_COMBOS) {
    return (
      <View style={styles.mix}>
        <Text style={styles.mixEmpty}>Do a few combos to see your mix.</Text>
      </View>
    );
  }
  const top = Math.max(1, mix.types[0].count);
  return (
    <View style={styles.mix}>
      {mix.types.map(t => (
        <View key={t.type} style={styles.mx}>
          <Text style={styles.mxLabel}>{TYPE_LABELS[t.type]}</Text>
          <View style={styles.mxBar}>
            <View style={[styles.mxFill, { width: `${(t.count / top) * 100}%` }]} />
          </View>
          <Text style={styles.mxPct}>{`${t.pct}%`}</Text>
        </View>
      ))}
      <View style={styles.diff}>
        {mix.diffs.map(d => (d.count > 0 ? (
          <View key={d.diff} style={{ flex: d.count, backgroundColor: DIFFS[d.diff].color }} />
        ) : null))}
      </View>
      <View style={styles.diffLeg}>
        {mix.diffs.map(d => (
          <Text key={d.diff} style={[styles.diffLegText, { color: DIFFS[d.diff].color }]}>
            {`${DIFFS[d.diff].label} ${d.pct}%`}
          </Text>
        ))}
      </View>
      <View style={{ height: 6 }} />
    </View>
  );
}

// .hrow
function HistoryRow({ entry, held, last, onLongPress }) {
  const timer = entry.type === 'timer';
  const meta = entryMeta(entry);
  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.hrow, last && styles.rowLast, held && styles.hrowHeld]}
    >
      <View style={styles.hi}>
        <TimerIcon
          name={timer ? 'timer' : 'barbell'}
          size={15}
          color={timer ? colors.timerWork : colors.accent}
        />
      </View>
      <View style={styles.ht}>
        <Text style={styles.htTitle} numberOfLines={1}>{entryTitle(entry)}</Text>
        <Text style={styles.htMeta}>
          <Text style={styles.htLead}>{meta.lead}</Text>
          {meta.rest.map(part => ` · ${part}`).join('')}
        </Text>
      </View>
      <Text style={styles.htTime}>{clockTime(entry.at)}</Text>
    </Pressable>
  );
}

// S6
function GoalSheet({ visible, goal, onChange, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Weekly goal" meta="training days per week">
      <View style={styles.goalChips}>
        {GOALS.map(n => (
          <Chip key={n} label={String(n)} on={goal === n} onPress={() => onChange(n)} />
        ))}
      </View>
      <Text style={styles.goalHint}>{goalHint(goal)}</Text>
      <Btn label="Done" onPress={onClose} />
    </Sheet>
  );
}

export default function StatsScreen() {
  const { entries, remove } = useHistoryContext();
  const { prefs, update } = usePrefsContext();
  const goal = prefs.weeklyGoal;
  const [now, setNow] = useState(Date.now);
  const [goalOpen, setGoalOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [heldId, setHeldId] = useState(null);

  // The week and "today" move on while the app stays open.
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const stats = useMemo(() => ({
    streak: weekStreak(entries, goal, now),
    compare: weekCompare(entries, now),
    bars: weeklyMinutes(entries, now),
    mix: techniqueMix(entries, now),
    drilled: mostDrilled(entries, now),
    total: allTime(entries),
  }), [entries, goal, now]);

  // History rows grouped by day, newest first.
  const groups = useMemo(() => {
    const out = [];
    for (const entry of entries.slice(0, shown)) {
      const day = startOfDay(entry.at);
      if (out.length === 0 || out[out.length - 1].day !== day) out.push({ day, rows: [] });
      out[out.length - 1].rows.push(entry);
    }
    return out;
  }, [entries, shown]);

  const confirmDelete = (entry) => {
    setHeldId(entry.id);
    const release = () => setHeldId(null);
    Alert.alert('Delete this entry?', deleteMessage(entry, Date.now()), [
      { text: 'Cancel', style: 'cancel', onPress: release },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          release();
          remove(entry.id);
        },
      },
    ], { cancelable: true, onDismiss: release });
  };

  const { streak, compare, bars, mix, drilled, total } = stats;
  const hasOlder = entries.length > shown;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>{weekRange(now)}</Text>
        <StreakCard streak={streak} goal={goal} onGoal={() => setGoalOpen(true)} />

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <TimerIcon name="stats" size={30} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No training logged yet</Text>
            <Text style={styles.emptyText}>
              Finish a timer workout or a combo session and it shows up here.
            </Text>
          </View>
        ) : (
          <>
            <Label>This week</Label>
            <View style={styles.tiles}>
              <View style={styles.tileRow}>
                <Tile
                  label="Training time"
                  value={formatDuration(compare.now.timeMs)}
                  delta={timeDelta(compare.now.timeMs, compare.last.timeMs)}
                />
                <Tile
                  label="Rounds"
                  value={compare.now.rounds}
                  delta={countDelta(compare.now.rounds, compare.last.rounds)}
                />
              </View>
              <View style={styles.tileRow}>
                <Tile
                  label="Combos done"
                  value={compare.now.combos}
                  delta={countDelta(compare.now.combos, compare.last.combos)}
                />
                <Tile
                  label="Sessions"
                  value={compare.now.sessions}
                  delta={countDelta(compare.now.sessions, compare.last.sessions)}
                />
              </View>
            </View>

            <Label note="minutes per week">Last 12 weeks</Label>
            <WeekChart bars={bars} />

            <Label note="combos done · last 30 days">Technique mix</Label>
            <MixCard mix={mix} />

            {drilled.length > 0 && (
              <>
                <Label note="last 30 days">Most drilled</Label>
                <View style={styles.card}>
                  {drilled.map((row, i) => (
                    <View key={row.combo.id} style={[styles.rank, i === drilled.length - 1 && styles.rowLast]}>
                      <Text style={styles.rankN}>{i + 1}</Text>
                      <Text style={styles.rankName} numberOfLines={1}>{row.combo.name}</Text>
                      <Text style={styles.rankCount}>{`×${row.count}`}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Label>History</Label>
            <View style={styles.card}>
              {groups.map((group, g) => (
                <View key={group.day}>
                  <Text style={styles.day}>{dayLabel(group.day, now)}</Text>
                  {group.rows.map((entry, i) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      held={heldId === entry.id}
                      last={!hasOlder && g === groups.length - 1 && i === group.rows.length - 1}
                      onLongPress={() => confirmDelete(entry)}
                    />
                  ))}
                </View>
              ))}
              {hasOlder && (
                <Pressable onPress={() => setShown(n => n + PAGE)} hitSlop={6}>
                  <Text style={styles.more}>Show older</Text>
                </Pressable>
              )}
            </View>

            <Label>All time</Label>
            <View style={styles.card}>
              <TotalRow label="Training time" value={formatDuration(total.timeMs)} />
              <TotalRow label="Sessions" value={total.sessions} />
              <TotalRow label="Rounds" value={total.rounds} />
              <TotalRow label="Combos done" value={total.combos} />
              <TotalRow label="Best week" value={formatDuration(total.bestWeekMs)} />
              <TotalRow label="Logging since" value={longDate(total.since)} last />
            </View>
          </>
        )}
      </ScrollView>

      <GoalSheet
        visible={goalOpen}
        goal={goal}
        onChange={n => update({ weeklyGoal: n })}
        onClose={() => setGoalOpen(false)}
      />
    </SafeAreaView>
  );
}

// .card .r
function TotalRow({ label, value, last = false }) {
  return (
    <View style={[styles.r, last && styles.rowLast]}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={styles.rValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: 6, paddingHorizontal: 12, paddingBottom: 16 },

  title: { fontSize: 17, fontWeight: '500', color: colors.title },
  subtitle: { fontSize: 11, color: colors.subtitle, marginTop: 1 },

  lbl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
    marginBottom: 6,
  },
  lblText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    fontWeight: '500',
  },
  lblNote: { fontSize: 10.5, color: colors.sectionLabel },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  rowLast: { borderBottomWidth: 0 },

  // Streak
  streak: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingTop: 11,
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginTop: 12,
  },
  skTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  skN: {
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.title,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  skL: { fontSize: 12.5, fontWeight: '500', color: colors.textPrimary },
  skBest: { marginLeft: 'auto', fontSize: 11, color: colors.textMuted },
  skBestN: { color: colors.textSecondary, fontWeight: '600' },
  wk: { flexDirection: 'row', marginTop: 10 },
  wkDay: { flex: 1, alignItems: 'center', gap: 4 },
  wkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.dayDotIdle,
    borderWidth: 1,
    borderColor: colors.dotIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wkDotOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  wkDotToday: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: 'transparent' },
  wkLetter: { fontSize: 9.5, color: colors.textMuted },
  wkLetterToday: { color: colors.accent, fontWeight: '700' },
  skFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  skFootText: { flexShrink: 1, fontSize: 11, color: colors.textSecondary },
  goal: {
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  goalText: { fontSize: 10.5, fontWeight: '600', color: colors.textPrimary },

  // This week
  tiles: { gap: 8 },
  tileRow: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tileLabel: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textMuted },
  tileValue: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.title,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  tileDelta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

  // Chart
  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },

  // Technique mix
  mix: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mixEmpty: { fontSize: 11, color: colors.textMuted, paddingVertical: 4 },
  mx: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 21 },
  mxLabel: { width: 62, fontSize: 11, color: colors.textSecondary },
  mxBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.ringTrack, overflow: 'hidden' },
  mxFill: { height: '100%', borderRadius: 3, backgroundColor: colors.typeText },
  mxPct: {
    width: 30,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '500',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  diff: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginTop: 10 },
  diffLeg: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  diffLegText: { fontSize: 10 },

  // Most drilled
  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rankN: { width: 16, fontSize: 12, color: colors.comboNumber, fontVariant: ['tabular-nums'] },
  rankName: { flex: 1, fontSize: 12, color: colors.textPrimary },
  rankCount: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] },

  // History
  day: {
    fontSize: 9.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.sectionLabel,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
  },
  hrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  hrowHeld: { backgroundColor: colors.historyHeld, marginHorizontal: -12, paddingHorizontal: 12 },
  hi: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dayDotIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ht: { flex: 1, minWidth: 0 },
  htTitle: { fontSize: 12, fontWeight: '500', color: colors.textPrimary },
  htMeta: { fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  htLead: { color: colors.textSecondary },
  htTime: { fontSize: 10.5, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  more: {
    textAlign: 'center',
    color: colors.accent,
    fontWeight: '600',
    fontSize: 11.5,
    paddingTop: 10,
    paddingBottom: 2,
  },

  // All time
  r: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rLabel: { fontSize: 12.5, color: colors.textSecondary },
  rValue: { fontSize: 12.5, fontWeight: '500', color: colors.textPrimary, fontVariant: ['tabular-nums'] },

  // Empty
  empty: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 13.5, fontWeight: '500', color: colors.textPrimary, marginTop: 8 },
  emptyText: {
    fontSize: 11.5,
    lineHeight: 11.5 * 1.45,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },

  // Goal sheet
  goalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 8,
  },
  goalHint: { fontSize: 10.5, color: colors.textMuted, textAlign: 'center', marginBottom: 14 },
});
