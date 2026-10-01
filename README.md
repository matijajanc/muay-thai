# Muay Thai Combo Trainer

A personal Android training app built with Expo (React Native, JavaScript). It shows 107
curated Muay Thai combos, filters by difficulty and type, generates a 10-combo training
session, saves favorites, runs a boxing round timer with bells, and expands combo details
hands-free via in-app voice commands during training.

## Features

- **107 combos** across beginner / intermediate / advanced and 7 types (punches, kicks,
  elbows, knees, clinch, mixed, deadliest).
- **Filtered sessions** — pick any combination of difficulties and types, generate a fresh
  random 10-combo session. Sessions are never persisted.
- **Hands-free training** — say "combo 3", "combo next" or "combo favorite" while the mic
  is on (see [Voice commands](#voice-commands)).
- **Progress** — combos you move on from are ticked off; **Finish session** shows a summary
  with a little celebration.
- **Favorites** — tap the heart to save a combo; favorites persist via AsyncStorage.
- **Round timer** — a Timer tab with presets (Muay Thai, Boxing, MMA, Tabata, Bag, plus your
  own), editable round time, rest, rounds (1–20 or ∞) and start delay, and cues: start bell,
  3× end bell, a clap before the round ends, a double beep before the rest ends, 3-2-1 beeps,
  spoken announcements and optional vibration. While it runs, the Training tab shows a clock
  (center, top or bottom band, or off — a setting) and the Timer tab label shows the live
  time. Foreground only: the screen stays on while a timer runs.
- **Dark theme only.**

## Setup

```bash
cd muaythai-app
npm install
npx expo start
```

Voice commands need a development build (`eas build --profile development`) — the speech
recognition module isn't in Expo Go. The `muaythai://combo/N` deep link still works too.

```bash
npm test                          # engine + voice grammar unit tests (jest-expo)
node scripts/generate-sounds.js   # regenerate the timer sounds in assets/sounds/
```

## Project structure

```
App.js                 Navigation, voice command router, deep-link handler, context providers
app.json               Expo config + muaythai:// deep-link scheme
data/combos.js         All 107 combos (single source of truth)
data/timerPresets.js   Round-timer presets and defaults
constants/theme.js     Colors (incl. timer phase colors), spacing, radius, font sizes
contexts/AppContext.js Session, Favorites, Voice and Timer contexts
hooks/                 useSession, useFavorites, useVoiceCommands, useTimerSettings,
                       useRoundTimer (run state), useTimerCues (bells, TTS, vibration)
utils/roundTimer.js    Pure timer engine: segments, cue timeline, wall-clock position
utils/timerLabels.js   All derived timer copy (phase labels, tab label, hints)
voice/                 numbers, comboGrammar, timerGrammar, commandHelp (+ tests)
components/            ComboCard, FilterChips, TimerBar, MicButton, FinishCelebration
components/timer/      TimerRing, TimerDial, TrainingClock, sheets, run/done views, icons
screens/               TrainingScreen, TimerScreen, FavoritesScreen, SettingsScreen
scripts/               generate-sounds.js (writes assets/sounds/*.wav, no dependencies)
```

## Voice commands

Voice runs inside the app (`expo-speech-recognition`), on-device when the offline English
model is available. One shared mic works from the Training and Timer tabs: tap the mic
button (or the "listening" pill on a running timer). The **?** next to the mic (and the Settings tab)
lists every command from `voice/commandHelp.js`; a test checks each listed phrase parses.

| Say | Does |
| --- | --- |
| `combo 3` | Open slot 3 of the current session for 60 seconds |
| `combo next` / `combo back` | Open the next / previous slot (wraps; starts at slot 1) |
| `combo favorite` | Save the last opened combo to favorites (never removes) |
| `combo finish` | Finish the session (same as the **Finish session** button) |
| `set 2 minutes countdown` / `countdown 90 seconds` | One-off countdown after the lead-in; saved settings don't change |
| `set 5 rounds of 3 minutes` | Run that workout with the saved rest and cues |
| `set rest 30 seconds` / `set rounds 6` / `rounds infinite` / `set round 2 minutes` / `set delay 5 seconds` / `delay off` | Change one saved setting (timer idle only) |
| `preset boxing` | Load a built-in or saved preset (timer idle only) |
| `timer start` / `pause` / `resume` / `skip` / `stop` | Control the running timer |

Timer controls need the word "timer" — a bare "pause" or "stop" is ignored. Setting and
duration commands act on the final result, so "2 minutes… 30 seconds" can finish. The
timer's own bells and spoken lines never trigger commands.

While listening, the screen stays on and the opened combo scrolls into view; the mic pauses
when the app goes to the background and resumes when it returns.

Moving on to another combo marks the previous one done (✓) if it was open at least 5 seconds —
shorter counts as skipped. Tap the ✓ to undo. **Finish session** (end of the list) counts the
combo in progress and shows a summary: combos done and time trained.

## Notation

- **Dash (`-`)** = continuous flow within one sequence, no reset
  (e.g. `Jab - Cross - Hook`).
- **Arrow (`→`)** = footwork step, stance reset, or new sequence begins
  (e.g. `Cross - Hook → Step back → Rear kick`).

## Not in v1

Custom combo creation, workout history, timer bells with the screen locked or the app in the
background, custom timer sounds, combo search, on-card difficulty/type badges (removed
intentionally for training readability), and Play Store release config.
