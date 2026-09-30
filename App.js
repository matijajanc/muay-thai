import { useEffect, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  useNavigationContainerRef,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TrainingScreen from './screens/TrainingScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import SettingsScreen from './screens/SettingsScreen';
import { SessionContext, FavoritesContext, VoiceContext } from './contexts/AppContext';
import { useSession } from './hooks/useSession';
import { useFavorites } from './hooks/useFavorites';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { colors } from './constants/theme';

const Tab = createBottomTabNavigator();
const FavStack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.tabBar,
    border: colors.tabBarBorder,
    primary: colors.accent,
    text: colors.textPrimary,
  },
};

function FavoritesStack() {
  return (
    <FavStack.Navigator screenOptions={{ headerShown: false }}>
      <FavStack.Screen name="FavoritesList" component={FavoritesScreen} />
      <FavStack.Screen name="Settings" component={SettingsScreen} />
    </FavStack.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const session = useSession();
  const favorites = useFavorites();

  // Keep the latest session/favorites API reachable from listeners that are
  // registered once and would otherwise capture a stale, empty session.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  // In-app voice: run the heard command on the Training tab. The returned text
  // is flashed under the mic button as confirmation.
  const onCommand = useCallback((command) => {
    const s = sessionRef.current;
    if (!s.generated) return 'Generate a session first';
    if (navigationRef.isReady()) navigationRef.navigate('Training');

    switch (command.type) {
      case 'slot': {
        const slot = s.expandBySlot(command.slot - 1); // 1-based phrase → 0-based index
        return slot == null ? `No combo ${command.slot} in this session` : `Combo ${command.slot}`;
      }
      case 'next':
      case 'previous': {
        const slot = command.type === 'next' ? s.expandNext() : s.expandPrevious();
        return slot == null ? null : `Combo ${slot + 1}`;
      }
      case 'favorite': {
        const slot = s.activeSlot();
        const combo = slot == null ? null : s.session[slot];
        if (!combo) return 'Open a combo first';
        const { favorites: favs, addFavorite } = favoritesRef.current;
        if (favs.has(combo.id)) return `Combo ${slot + 1} is already a favorite`;
        addFavorite(combo.id);
        return `♥ Combo ${slot + 1} saved to favorites`;
      }
      default:
        return null;
    }
  }, [navigationRef]);
  const voice = useVoiceCommands(onCommand);

  useEffect(() => {
    const handleUrl = ({ url }) => {
      if (!url) return;
      const match = url.match(/muaythai:\/\/combo\/(\d+)/);
      if (!match) return;
      const slotIndex = parseInt(match[1], 10) - 1; // 1-based phrase → 0-based index
      if (navigationRef.isReady()) navigationRef.navigate('Training');
      sessionRef.current.expandBySlot(slotIndex);
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [navigationRef]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionContext.Provider value={session}>
        <FavoritesContext.Provider value={favorites}>
          <VoiceContext.Provider value={voice}>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder },
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.textMuted,
              }}
            >
              <Tab.Screen
                name="Training"
                component={TrainingScreen}
                options={{
                  tabBarLabel: 'Training',
                  tabBarIcon: ({ color, size }) => (
                    <Ionicons name="barbell-outline" color={color} size={size} />
                  ),
                }}
              />
              <Tab.Screen
                name="Favorites"
                component={FavoritesStack}
                options={{
                  tabBarLabel: 'Favorites',
                  tabBarIcon: ({ color, size }) => (
                    <Ionicons name="heart-outline" color={color} size={size} />
                  ),
                }}
              />
            </Tab.Navigator>
          </NavigationContainer>
          </VoiceContext.Provider>
        </FavoritesContext.Provider>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}
