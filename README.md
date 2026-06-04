# Muay Thai Combo Trainer

A personal Android training app built with Expo (React Native, JavaScript). It shows 107
curated Muay Thai combos, filters by difficulty and type, generates a 10-combo training
session, saves favorites, and expands combo details hands-free via Google Assistant voice
commands during training.

## Features

- **107 combos** across beginner / intermediate / advanced and 7 types (punches, kicks,
  elbows, knees, clinch, mixed, deadliest).
- **Filtered sessions** — pick any combination of difficulties and types, generate a fresh
  random 10-combo session. Sessions are never persisted.
- **Hands-free training** — say "Hey Google, combo 3" to expand slot 3 of the current
  session for 60 seconds, then it auto-collapses.
- **Favorites** — tap the heart to save a combo; favorites persist via AsyncStorage.
- **Dark theme only.**

## Setup

```bash
cd muaythai-app
npm install
npx expo start
```

Open in **Expo Go** on Android, or run a development build. The voice/deep-link feature is
Android-only (Google Assistant Routines), though the app itself runs on iOS too.

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

## Google Assistant voice setup (one-time, Android)

Each routine maps a fixed phrase to a fixed deep link. The link points to a **slot position**
(combo 1–10), not a specific combo, so the same 10 routines keep working after every new
session — no reconfiguration needed.

1. Open Google Assistant on your Android phone.
2. Tap your profile photo → **Routines** → **+ Add a routine**.
3. Under **When**: add a voice command, type `combo 1`.
4. Under **Then**: add action → **Communication → Open app**, paste `muaythai://combo/1`.
5. Save the routine.
6. Repeat for `combo 2` through `combo 10` (the Settings screen lists all 10 links with
   copy buttons).
7. In the app: **Favorites → gear icon → Mark "Setup complete"**.

### During training

- Put your phone on a stand where you can see it.
- Generate your session before putting gloves on.
- Say "Hey Google, combo 3" — the app opens to that combo with steps shown.
- Steps auto-hide after 60 seconds. Say it again to re-open.

## Notation

- **Dash (`-`)** = continuous flow within one sequence, no reset
  (e.g. `Jab - Cross - Hook`).
- **Arrow (`→`)** = footwork step, stance reset, or new sequence begins
  (e.g. `Cross - Hook → Step back → Rear kick`).

## Not in v1

Custom combo creation, round/rest timers, workout history, sound/vibration cues, combo
search, on-card difficulty/type badges (removed intentionally for training readability),
and Play Store release config.
