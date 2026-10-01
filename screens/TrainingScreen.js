import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, FlatList, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import FilterChips from '../components/FilterChips';
import ComboCard from '../components/ComboCard';
import MicButton from '../components/MicButton';
import FinishCelebration from '../components/FinishCelebration';
import TimerIcon from '../components/timer/TimerIcon';
import TrainingClock, { useTrainingClockVisible } from '../components/timer/TrainingClock';
import { useSessionContext, useFavoritesContext, useTimerContext } from '../contexts/AppContext';
import { filterCombos } from '../utils/sessionPicker';
import { pillLabel } from '../utils/timerLabels';

function toggleInSet(setState, key) {
  setState(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

// Header timer pill (J): tap starts the saved workout, long-press opens Timer setup.
function TimerPill({ onOpenTimer }) {
  const { settings, start } = useTimerContext();
  return (
    <Pressable style={styles.tpill} onPress={() => start()} onLongPress={onOpenTimer} hitSlop={6}>
      <TimerIcon name="timer" size={13} color={colors.accent} />
      <Text style={styles.tpillText}>{pillLabel(settings)}</Text>
    </Pressable>
  );
}

export default function TrainingScreen({ navigation }) {
  const {
    session, generated, expandedId, timerPercent, jumpTarget, doneIds, summary, activeIndex,
    generate, reset, expandCombo, unmarkDone, finish, dismissSummary,
  } = useSessionContext();
  const { favorites, toggleFavorite } = useFavoritesContext();
  const { settings: timerSettings } = useTimerContext();
  const listRef = useRef(null);

  // Round-timer clock: hidden until a timer runs; where it shows is a setting.
  const clockVisible = useTrainingClockVisible();
  const clockPosition = timerSettings.trainingClock;
  const topBand = clockVisible && clockPosition === 'top';
  const [pinnedHeight, setPinnedHeight] = useState(0);
  // On the filter screen the Center clock starts below Generate, so a session
  // can still be generated while a timer runs.
  const [generateBottom, setGenerateBottom] = useState(0);
  const [bottomBandHeight, setBottomBandHeight] = useState(0);
  const openTimer = () => navigation.navigate('Timer');

  // A combo opened hands-free may be off-screen: bring it to the top of the list.
  // Wait a beat so a card collapsing above it has re-laid out first.
  useEffect(() => {
    if (!jumpTarget) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: jumpTarget.index, animated: true });
    }, 100);
    return () => clearTimeout(t);
  }, [jumpTarget]);

  // Chip selection lives here so it is preserved across "New session".
  const [selectedDiffs, setSelectedDiffs] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  // Some mixes have no combos (e.g. Beginner + Elbows): say so instead of generating.
  const matching = filterCombos(selectedDiffs, selectedTypes).length;

  // One tap at the top of the list mustn't throw away a session in progress.
  const confirmNewSession = () => {
    if (doneIds.size === 0 && activeIndex == null) {
      reset();
      return;
    }
    Alert.alert('Start a new session?', 'Progress in this session will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New session', style: 'destructive', onPress: reset },
    ]);
  };

  const subtitle = generated ? `${session.length} combos · ${doneIds.size} done` : 'Pick filters, then generate';
  // The Top clock band replaces the title while a timer runs (L).
  const header = topBand ? (
    <>
      <TrainingClock position="top" />
      <Text style={[styles.subtitle, styles.bandSubtitle]}>{`Today's training · ${subtitle}`}</Text>
    </>
  ) : (
    <View style={[styles.header, styles.titleRow]}>
      <View>
        <Text style={styles.title}>Today's training</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {!clockVisible && <TimerPill onOpenTimer={openTimer} />}
    </View>
  );

  // Pinned so voice status/feedback stays visible while the list scrolls; the
  // Center clock starts right below it.
  const pinned = (
    <View onLayout={e => setPinnedHeight(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
      {header}
      <MicButton
        reserveStatus={clockVisible && clockPosition === 'center'}
        listeningText={
          clockVisible ? 'Listening: “combo 3” / “combo next”' : 'Listening: “combo 3” / “set 2 min countdown”'
        }
      />
    </View>
  );

  const floatingClock = clockPosition === 'center' || clockPosition === 'bottom' ? (
    <TrainingClock
      position={clockPosition}
      top={generated ? pinnedHeight : generateBottom + spacing.md}
      withCombo={generated}
      onLayout={e => setBottomBandHeight(e.nativeEvent.layout.height)}
    />
  ) : null;
  const bottomPadding = clockVisible && clockPosition === 'bottom' ? bottomBandHeight : 0;

  if (!generated) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.body}>
          {pinned}
          <FilterChips
            selectedDiffs={selectedDiffs}
            selectedTypes={selectedTypes}
            onToggleDiff={k => toggleInSet(setSelectedDiffs, k)}
            onToggleType={k => toggleInSet(setSelectedTypes, k)}
          />
          <Text style={[styles.matchCount, matching === 0 && styles.matchNone]}>
            {matching === 0
              ? 'No combos match — try another difficulty or type'
              : `${matching} ${matching === 1 ? 'combo matches' : 'combos match'}`}
          </Text>
          <Pressable
            style={[styles.generateBtn, matching === 0 && styles.generateDisabled]}
            disabled={matching === 0}
            onPress={() => generate(selectedDiffs, selectedTypes)}
            onLayout={e => setGenerateBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            <Text style={styles.generateText}>Generate session</Text>
          </Pressable>
          {floatingClock}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.fill}>
        <View style={styles.pinned}>{pinned}</View>
        <FlatList
          ref={listRef}
          data={session}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + bottomPadding }]}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index, averageItemLength }) =>
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
          }
          ListHeaderComponent={
            <Pressable style={styles.newSessionBtn} onPress={confirmNewSession}>
              <Text style={styles.newSessionText}>New session</Text>
            </Pressable>
          }
          ListFooterComponent={
            <Pressable style={styles.finishBtn} onPress={finish}>
              <Ionicons name="flag" size={fontSize.lg} color="#ffffff" />
              <Text style={styles.finishText}>Finish session</Text>
            </Pressable>
          }
          renderItem={({ item, index }) => (
            <ComboCard
              combo={item}
              index={index + 1}
              isFavorite={favorites.has(item.id)}
              isDone={doneIds.has(item.id)}
              isExpanded={expandedId === item.id}
              timerPercent={timerPercent}
              onExpand={expandCombo}
              onToggleFavorite={toggleFavorite}
              onUndone={unmarkDone}
            />
          )}
        />
        {floatingClock}
      </View>
      <FinishCelebration summary={summary} onNewSession={reset} onClose={dismissSummary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.md },
  pinned: { paddingHorizontal: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  header: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: fontSize.xl, fontWeight: '500', color: colors.title },
  subtitle: { fontSize: fontSize.sm, color: colors.subtitle, marginTop: 2 },
  bandSubtitle: { marginTop: 0, marginBottom: spacing.md },

  tpill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  tpillText: { color: colors.accent, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },

  matchCount: { marginTop: spacing.xl, fontSize: fontSize.sm, color: colors.textSecondary },
  matchNone: { color: colors.advText },
  generateBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  generateDisabled: { opacity: 0.4 },
  generateText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },

  newSessionBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  newSessionText: { color: colors.accent, fontSize: fontSize.base, fontWeight: '500' },

  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  finishText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
});
