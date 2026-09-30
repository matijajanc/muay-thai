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
import TimerScreen from './screens/TimerScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import SettingsScreen from './screens/SettingsScreen';
import TimerTickProvider from './components/timer/TimerTickProvider';
import { TimerTabLabel, TimerTabIcon } from './components/timer/TimerTab';
import {
  SessionContext, FavoritesContext, VoiceContext, TimerContext,
} from './contexts/AppContext';
import { useSession } from './hooks/useSession';
import { useFavorites } from './hooks/useFavorites';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useTimerSettings } from './hooks/useTimerSettings';
import { useTimerCues } from './hooks/useTimerCues';
import { useRoundTimer } from './hooks/useRoundTimer';
import { formatClock, isInfinite } from './utils/roundTimer';
import { optionLabel } from './utils/timerLabels';
import { LIMITS } from './data/timerPresets';
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

const clamp = (v, [min, max]) => Math.max(min, Math.min(max, v));
// A voice countdown can be longer than a saved round.
const COUNTDOWN_LIMITS = [5, 3600];

const compact = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
// Common mis-hearings of the built-in preset names.
const PRESET_ALIASES = {
  muaythai: ['moythai', 'muythai', 'mythai', 'muaytie', 'maithai', 'thai'],
  mma: ['emma', 'mmma', 'emmaa'],
  tabata: ['tabatha', 'tobata', 'thebata'],
  bag: ['back', 'bags', 'bagwork'],
};

// "preset boxing" → the matching built-in or saved preset, or undefined.
function findPreset(presets, query) {
  const q = compact(query);
  if (!q) return undefined;
  return presets.find(p => {
    const name = compact(p.name);
    return name === q || name.startsWith(q) || q.startsWith(name)
      || (PRESET_ALIASES[p.id] ?? []).some(alias => q.startsWith(alias));
  });
}

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
  const timerSettings = useTimerSettings();

  // Keep the latest session/favorites/timer API reachable from listeners that
  // are registered once and would otherwise capture a stale, empty session.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const timerSettingsRef = useRef(timerSettings);
  timerSettingsRef.current = timerSettings;
  const timerRef = useRef(null);

  // Timer commands stay put on Training (its clock shows the timer) and on the
  // Timer tab; from Favorites they switch to the Timer tab.
  const showTimer = useCallback(() => {
    if (!navigationRef.isReady()) return;
    const route = navigationRef.getCurrentRoute()?.name;
    if (route === 'FavoritesList' || route === 'Settings') navigationRef.navigate('Timer');
  }, [navigationRef]);

  // Voice timer commands (voice/timerGrammar.js). Returns the confirmation line;
  // a command that did something ("✓ …") also brings up the timer.
  const onTimerCommand = useCallback((command) => {
    const message = runTimerCommand(command);
    if (message?.startsWith('✓')) showTimer();
    return message;
  }, [showTimer]);

  const runTimerCommand = (command) => {
    const timer = timerRef.current;
    const { presets, update, applyPreset, flash } = timerSettingsRef.current;
    const running = timer.status === 'running' || timer.status === 'paused';

    switch (command.type) {
      case 'countdown': {
        const sec = clamp(command.sec, COUNTDOWN_LIMITS);
        timer.start({ kind: 'countdown', roundSec: sec });
        return `✓ ${formatClock(sec)} countdown`;
      }
      case 'workout': {
        const rounds = clamp(command.rounds, LIMITS.rounds);
        const roundSec = clamp(command.roundSec, LIMITS.roundSec);
        timer.start({ kind: 'workout', rounds, roundSec });
        return `✓ ${rounds} × ${formatClock(roundSec)}`;
      }
      case 'set': {
        // Settings only change while the timer is idle.
        if (running) return 'Stop the timer first';
        const { field } = command;
        const value = command.value == null ? null : clamp(command.value, LIMITS[field]);
        update({ [field]: value });
        flash(field);
        if (field === 'restSec') return `✓ Rest ${formatClock(value)}`;
        if (field === 'roundSec') return `✓ Round time ${formatClock(value)}`;
        if (field === 'delaySec') return `✓ Start delay ${optionLabel(value)}`;
        return `✓ Rounds ${isInfinite(value) ? '∞' : value}`;
      }
      case 'preset': {
        if (running) return 'Stop the timer first';
        const preset = findPreset(presets, command.query);
        if (!preset) return `No preset “${command.query}”`;
        applyPreset(preset);
        return `✓ ${preset.name} preset`;
      }
      case 'start':
        if (timer.status === 'paused') {
          timer.resume();
          return '✓ Timer resumed';
        }
        if (timer.status === 'running') return null;
        timer.start();
        return '✓ Timer started';
      case 'pause':
        if (timer.status !== 'running') return null;
        timer.pause();
        return '✓ Timer paused';
      case 'resume':
        if (timer.status !== 'paused') return null;
        timer.resume();
        return '✓ Timer resumed';
      case 'skip':
        if (!running) return null;
        timer.skip();
        return '✓ Skipped';
      case 'stop':
        if (timer.status === 'idle') return null;
        timer.stop();
        return '✓ Timer stopped';
      default:
        return null;
    }
  };

  // In-app voice: run the heard command. Combo commands go to the Training
  // tab. The returned text is flashed under the mic button as confirmation.
  const onCommand = useCallback((command) => {
    if (command.domain === 'timer') return onTimerCommand(command);
    const s = sessionRef.current;
    if (!s.generated) return 'Generate a session first';
    if (navigationRef.isReady()) navigationRef.navigate('Training');
    // Any other command means training goes on: close the celebration.
    if (command.type !== 'finish') s.dismissSummary();

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
      case 'finish':
        s.finish();
        return 'Session finished';
      default:
        return null;
    }
  }, [navigationRef, onTimerCommand]);
  const voice = useVoiceCommands(onCommand);

  // Round timer: cues feed the recognizer's echo guard so bells and our own
  // TTS never trigger commands.
  const cues = useTimerCues(voice.suppress);
  const timer = useRoundTimer(timerSettings, cues);
  timerRef.current = timer;
  const timerContext = { ...timer, ...timerSettings, testCue: cues.test };

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
          <TimerContext.Provider value={timerContext}>
          <TimerTickProvider timer={timer}>
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
                name="Timer"
                component={TimerScreen}
                options={{
                  tabBarLabel: ({ focused, color }) => <TimerTabLabel focused={focused} color={color} />,
                  tabBarIcon: ({ focused, color, size }) => (
                    <TimerTabIcon focused={focused} color={color} size={size} />
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
          </TimerTickProvider>
          </TimerContext.Provider>
          </VoiceContext.Provider>
        </FavoritesContext.Provider>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}
