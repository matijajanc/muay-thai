import { useEffect, useRef } from 'react';
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
import { SessionContext, FavoritesContext } from './contexts/AppContext';
import { useSession } from './hooks/useSession';
import { useFavorites } from './hooks/useFavorites';
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

  // Keep the latest session API reachable from the URL listener, which is
  // registered once and would otherwise capture a stale, empty session.
  const sessionRef = useRef(session);
  sessionRef.current = session;

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
        </FavoritesContext.Provider>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}
