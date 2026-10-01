# Muay Thai Combo Trainer

A personal Android training app built with Expo (React Native, JavaScript). It shows 107
curated Muay Thai combos, filters by difficulty and type, generates a 10-combo training
session, saves favorites, runs a boxing round timer with bells, expands combo details
hands-free via in-app voice commands or wave gestures during training, and keeps a training
log with weekly streaks and stats.

## Features

- **107 combos** across beginner / intermediate / advanced and 7 types (punches, kicks,
  elbows, knees, clinch, mixed, deadliest).
- **Filtered sessions** — pick any combination of difficulties and types (the screen shows
  how many combos match; a mix with none can't be generated), generate a fresh random
  10-combo session that avoids the previous one's combos. **Mix in favorites** swaps 2–3 of
  your saved favorites (any difficulty or type) into it — still 10 combos. The current session survives the
  app being closed for 12 hours.
- **Hands-free training** — say "combo 3", "combo next" or "combo favorite" while the mic
  is on (see [Voice commands](#voice-commands)).
- **Progress** — combos you move on from are ticked off; **Finish session** shows a summary
  with a little celebration.
- **Favorites** — tap the heart to save a combo; favorites persist via AsyncStorage. Tap a
  favorite's name to read its steps.
- **Round timer** — a Timer tab with presets (Muay Thai, Boxing, MMA, Tabata, Bag, plus your
  own), editable round time, rest, rounds (1–20 or ∞) and start delay, and cues: start bell,
  3× end bell, a clap before the round ends, a double beep before the rest ends, 3-2-1 beeps,
  spoken announcements and optional vibration. While it runs, the Training tab shows a clock
  (center, top or bottom band, or off — a setting) and the Timer tab label shows the live
  time. Foreground only: the screen stays on while a timer runs. A run in progress survives
  the app being killed and comes back at its real position (dropped if paused over 2 hours).
- **Wave gestures** (Android, off by default — Settings) — wave a hand or glove over the
  proximity sensor by the front camera: **wave** starts the timer (or resumes it), **double
  wave** opens the next combo, **hold** about 2 s opens the current combo again. They run the
  same commands as voice, with a "✋ …" line, a blip and a short buzz. Covers longer than 4 s
  (a pocket, the phone face down) and passes right after a screen touch are ignored. Settings
  has a live sensor test to find the sensor on your phone.
- **Stats** — every finished timer run (and one stopped after at least a minute of rounds) and
  every combo session with a combo done is logged on the device. The Stats tab shows a weekly
  streak against a training-days goal (default 3; a day counts after 5 minutes), this week vs
  last week, a 12-week chart, technique mix and most drilled combos (last 30 days), the history
  (long-press to delete) and all-time totals. Training time leaves out lead-ins, pauses and
  idle gaps, and overlapping timer and combo time counts once.
- **Dark theme only.**

## Setup

```bash
cd muaythai-app
npm install
npx expo start
```

Voice commands and wave gestures need a development build (`eas build --profile development`)
— the speech recognition module and the local proximity module (`modules/proximity`) aren't
in Expo Go. The `muaythai://combo/N` deep link still works too.

```bash
npm test                          # engine, gestures, log, stats + voice grammar tests (jest-expo)
node scripts/generate-sounds.js   # regenerate the timer sounds and gesture blip in assets/sounds/
```

## Project structure

```
App.js                 Navigation, voice command router, deep-link handler, context providers
app.json               Expo config + muaythai:// deep-link scheme
data/combos.js         All 107 combos (single source of truth)
data/timerPresets.js   Round-timer presets and defaults
constants/theme.js     Colors (incl. timer phase colors), spacing, radius, font sizes
contexts/AppContext.js Session, Favorites, Voice, Timer, History, Prefs and Gesture contexts
hooks/                 useSession, useFavorites, useVoiceCommands, useTimerSettings,
                       useRoundTimer (run state), useTimerCues (bells, TTS, vibration),
                       useHistory (training log), usePrefs, useWaveGestures
modules/proximity/     Local Expo module: proximity sensor near/far (Kotlin; iOS stub)
utils/roundTimer.js    Pure timer engine: segments, cue timeline, wall-clock position
utils/timerLabels.js   All derived timer copy (phase labels, tab label, hints)
utils/waveGestures.js  Wave / double wave / hold detector from near/far timing (pure, tested)
utils/history.js       Training-log entries: builders, validation, activity spans (pure, tested)
utils/stats.js         Streaks, weeks, chart, technique mix, totals (pure, tested)
utils/statsLabels.js   All Stats copy
utils/sessionPicker.js Filtering and picking a session (pure, tested)
utils/storage.js       AsyncStorage JSON helpers that never throw
voice/                 numbers, comboGrammar, timerGrammar, commandHelp (+ tests)
components/            ComboCard, FilterChips, TimerBar, MicButton, FinishCelebration,
                       WaveGesturesCard
components/timer/      TimerRing, TimerDial, TrainingClock, sheets, run/done views, icons
screens/               TrainingScreen, TimerScreen, FavoritesScreen, StatsScreen, SettingsScreen
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
duration commands act on the final result, so "2 minutes… 30 seconds" can finish. They must
open the sentence (after "set", "okay", "hey" and the like, or right after another command),
so "I need a rest for two minutes" changes nothing, and quick timers don't replace a run in
progress. A combo command needs "combo" (or a close mis-hearing) — everyday words such as
"come back" or "number two" are ignored. The timer's own bells and spoken lines never
trigger commands.

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

Custom combo creation, timer bells with the screen locked or the app in the background,
custom timer sounds, combo search, on-card difficulty/type badges (removed intentionally for
training readability), and Play Store release config. Wave gestures on iOS, camera or
"tap the phone" gestures and rebinding gestures. Exporting or sharing stats, heart rate and
watch data, training reminders, and history from before the log existed.
