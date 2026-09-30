# Muay Thai Combo Trainer

A personal Android training app built with Expo (React Native, JavaScript). It shows 107
curated Muay Thai combos, filters by difficulty and type, generates a 10-combo training
session, saves favorites, and expands combo details hands-free via in-app voice commands
during training.

## Features

- **107 combos** across beginner / intermediate / advanced and 7 types (punches, kicks,
  elbows, knees, clinch, mixed, deadliest).
- **Filtered sessions** — pick any combination of difficulties and types, generate a fresh
  random 10-combo session. Sessions are never persisted.
- **Hands-free training** — say "combo 3", "combo next" or "combo favorite" while the mic
  is on (see [Voice commands](#voice-commands)).
- **Favorites** — tap the heart to save a combo; favorites persist via AsyncStorage.
- **Dark theme only.**

## Setup

```bash
cd muaythai-app
npm install
npx expo start
```

Voice commands need a development build (`eas build --profile development`) — the speech
recognition module isn't in Expo Go. The `muaythai://combo/N` deep link still works too.

## Project structure

```
App.js                 Navigation, deep-link handler, context providers
app.json               Expo config + muaythai:// deep-link scheme
data/combos.js         All 107 combos (single source of truth)
constants/theme.js     Colors, spacing, radius, font sizes
contexts/AppContext.js Session + Favorites contexts
hooks/                 useSession, useFavorites, useSetupDone
components/            ComboCard, FilterChips, TimerBar
screens/               TrainingScreen, FavoritesScreen, SettingsScreen
```

## Voice commands

Voice runs inside the app (`expo-speech-recognition`), on-device when the offline English
model is available. Tap **Tap to listen for voice commands** on the Training tab once the
session is generated.

| Say | Does |
| --- | --- |
| `combo 3` | Open slot 3 of the current session for 60 seconds |
| `combo next` / `combo back` | Open the next / previous slot (wraps; starts at slot 1) |
| `combo favorite` | Save the last opened combo to favorites (never removes) |

While listening, the screen stays on and the opened combo scrolls into view; the mic pauses
when the app goes to the background and resumes when it returns.

## Notation

- **Dash (`-`)** = continuous flow within one sequence, no reset
  (e.g. `Jab - Cross - Hook`).
- **Arrow (`→`)** = footwork step, stance reset, or new sequence begins
  (e.g. `Cross - Hook → Step back → Rear kick`).

## Not in v1

Custom combo creation, round/rest timers, workout history, sound/vibration cues, combo
search, on-card difficulty/type badges (removed intentionally for training readability),
and Play Store release config.
