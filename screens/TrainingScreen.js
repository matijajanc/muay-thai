import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import FilterChips from '../components/FilterChips';
import ComboCard from '../components/ComboCard';
import MicButton from '../components/MicButton';
import FinishCelebration from '../components/FinishCelebration';
import { useSessionContext, useFavoritesContext } from '../contexts/AppContext';

function toggleInSet(setState, key) {
  setState(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

export default function TrainingScreen() {
  const {
    session, generated, expandedId, timerPercent, jumpTarget, doneIds, summary,
    generate, reset, expandCombo, unmarkDone, finish, dismissSummary,
  } = useSessionContext();
  const { favorites, toggleFavorite } = useFavoritesContext();
  const listRef = useRef(null);

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

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Today's training</Text>
      <Text style={styles.subtitle}>
        {generated ? `${session.length} combos · ${doneIds.size} done` : 'Pick filters, then generate'}
      </Text>
    </View>
  );

  if (!generated) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.body}>
          {header}
          <FilterChips
            selectedDiffs={selectedDiffs}
            selectedTypes={selectedTypes}
            onToggleDiff={k => toggleInSet(setSelectedDiffs, k)}
            onToggleType={k => toggleInSet(setSelectedTypes, k)}
          />
          <Pressable
            style={styles.generateBtn}
            onPress={() => generate(selectedDiffs, selectedTypes)}
          >
            <Text style={styles.generateText}>Generate session</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Pinned so voice status/feedback stays visible while the list scrolls. */}
      <View style={styles.pinned}>
        {header}
        <MicButton />
      </View>
      <FlatList
        ref={listRef}
        data={session}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
        }
        ListHeaderComponent={
          <Pressable style={styles.newSessionBtn} onPress={reset}>
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
      <FinishCelebration summary={summary} onNewSession={reset} onClose={dismissSummary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: spacing.md },
  pinned: { paddingHorizontal: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  header: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '500', color: colors.title },
  subtitle: { fontSize: fontSize.sm, color: colors.subtitle, marginTop: 2 },

  generateBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
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
