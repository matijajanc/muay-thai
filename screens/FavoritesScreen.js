import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing } from '../constants/theme';
import { COMBOS } from '../data/combos';
import ComboCard from '../components/ComboCard';
import { useFavoritesContext } from '../contexts/AppContext';
import { useSetupDone } from '../hooks/useSetupDone';

export default function FavoritesScreen({ navigation }) {
  const { favorites, toggleFavorite } = useFavoritesContext();
  const { done, loaded } = useSetupDone();

  const favoriteCombos = COMBOS.filter(c => favorites.has(c.id));
  const showBanner = loaded && !done;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Favorites</Text>
          <Text style={styles.subtitle}>{favoriteCombos.length} saved combos</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {showBanner && (
        <Pressable style={styles.banner} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.bannerText}>Set up voice commands to use hands-free training</Text>
          <Ionicons name="arrow-forward" size={fontSize.lg} color={colors.voiceTitle} />
        </Pressable>
      )}

      {favoriteCombos.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={56} color={colors.borderActive} />
          <Text style={styles.emptyText}>
            No favorites yet.{'\n'}Generate a session and tap the heart.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteCombos}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <ComboCard
              combo={item}
              index={index + 1}
              isFavorite={true}
              expandable={false}
              onToggleFavorite={toggleFavorite}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '500', color: colors.title },
  subtitle: { fontSize: fontSize.sm, color: colors.subtitle, marginTop: 2 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.voiceBg,
    borderWidth: 1,
    borderColor: colors.voiceBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  bannerText: { flex: 1, color: colors.voiceTitle, fontSize: fontSize.md, fontWeight: '500' },

  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: fontSize.base * 1.5,
  },
});
