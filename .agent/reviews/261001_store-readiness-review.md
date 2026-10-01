# Store-readiness review — 2026-10-01

Scope: full read of every source file (App, hooks, screens, components, timer
engine, voice grammars, data), `npm test` (4 suites, 200 tests — all pass),
parser probes with gym-chatter phrases, `expo-doctor`, the generated Android
manifest, app icons and EAS/app config. Nothing was changed in the code.

**Verdict:** the core is in good shape — the timer engine (wall-clock based, pure,
well tested) and the voice grammar are the strongest parts. It is not
store-ready yet: a handful of config blockers, two voice behaviours that will
misfire in a real gym with music, an iOS audio story that has never been run on
an iPhone, and a timer that goes silent when the screen locks.

**Status (2026-10-01, later):** bugs fixed — #8–#16, plus the bug parts of
#2 (deduped `expo-asset`/`expo-constants`, SDK-56 patch versions), #4 (iOS
`iosCategory`, Android-only offline-model code gated), #5 (Settings wording) and
#7 (dark splash + root background). Still open: #1, #3, #6, the rest of #7, P2.

Legend: **verified** = reproduced or read directly in code/config; **likely** =
from library docs/behaviour, needs a device to confirm.

---

## P0 — fix before submitting

### 1. Placeholder / missing app identifiers (verified)
- `app.json:14` — Android package is `com.yourname.muaythaiapp`. It is permanent
  after the first Play upload.
- iOS has no `bundleIdentifier` (`app.json:10-12`).
- App name "Muay Thai" must be unique on the App Store and is almost certainly
  taken; `scheme: "muaythai"` is generic enough to collide with other apps.
- Fix: pick the brand name now, then set `android.package` and
  `ios.bundleIdentifier` to the same reverse-DNS id.

### 2. Duplicate native modules + SDK health (verified, `expo-doctor`)
- `expo-audio@56.0.13` pulls `expo-asset@57.0.18` (SDK 57) next to
  `expo-asset@56.0.15`; same for `expo-constants` 56/57. A native build may only
  contain one version of a native module — expect build errors or odd runtime
  behaviour.
- `expo@56.0.8` ships a Hermes V1 build with a known memory regression (fixed in
  SDK 57, `expo@57.0.9+`).
- Patch mismatches: `expo` 56.0.23, `expo-font`, `expo-linking`,
  `react-native-screens` 4.26.
- Fix: upgrade to SDK 57 now (`npx expo install expo@^57.0.9 --fix`), before
  release QA rather than after. At minimum pin `expo-asset`/`expo-constants`
  with `npx expo install`.

### 3. Timer goes silent when the screen locks or the app backgrounds (verified, by design)
- `useRoundTimer.js:188-194` only catches up on return; README says
  "foreground only". Users lock the phone or switch to Spotify mid-round. For a
  round timer on the store this is the most likely 1-star review.
- Fix (cross-platform, no background-mode review risk): when the app goes to the
  background with a run in progress, schedule local notifications
  (`expo-notifications`) with the bell sounds at every remaining phase boundary
  (the cue list in `run.cues` already has the times); cancel them on return.
  Optional later: Android foreground service / iOS Live Activity with the live
  round clock.

### 4. iOS has never run — audio session conflicts (likely)
- `expo-speech-recognition` on iOS switches the shared audio session to
  `playAndRecord` + `defaultToSpeaker` + `allowBluetooth`, mode `measurement`
  unless `iosCategory` is passed (its README, "iosCategory"). No `mixWithOthers`
  → turning the mic on will most likely **pause the user's music**, and every
  auto-restart in the `end` handler re-interrupts it. `allowBluetooth` (HFP)
  drops AirPods into call-quality audio.
- `useTimerCues.js:35` sets expo-audio to `playback` + `duckOthers`; the two
  libraries will keep overriding each other's category.
- Fix: pass an explicit `iosCategory` in `START_OPTIONS`
  (`useVoiceCommands.js:33`), e.g. `playAndRecord` with `defaultToSpeaker`,
  `mixWithOthers` (or `duckOthers`), `allowBluetoothA2DP`, mode `default`, and
  make the expo-audio mode agree. Then QA on a real iPhone: music + AirPods +
  mic on + bells + TTS.
- Also iOS: `prepareOnDevice` calls the Android-only
  `androidTriggerOfflineModelDownload` (`useVoiceCommands.js:159`) — gate with
  `Platform.OS`. Prefer on-device recognition on iOS: Apple's server
  recognizer has per-request (~1 min) and per-day limits, and this app restarts
  recognition all session long.

### 5. Privacy claims and policy (verified)
- `SettingsScreen.js:28` says "Hands-free, fully on-device", but the code falls
  back to online recognition (`useVoiceCommands.js:156-162`, `:229-234`), i.e.
  audio can go to Google's/Apple's servers. Reword ("on-device when available").
- Both stores require a privacy policy URL for microphone use; fill Play
  **Data safety** and Apple **App Privacy** consistently with that wording.

### 6. Placeholder settings (verified)
- `SettingsScreen.js:57-67`: "Auto-hide timer 1 min" and "Combos per session 10"
  look like settings but aren't tappable. App Review flags incomplete features
  (guideline 2.1). Make them real (see Features) or remove the section.

### 7. Config polish that reviewers / users see (verified)
- **White splash flash**: no splash config, so the generated
  `splashscreen_background` is `#FFFFFF` on a dark app. Add the
  `expo-splash-screen` plugin with `backgroundColor: "#111111"` and
  `assets/splash-icon.png`.
- **Unneeded Android permissions** in the generated manifest:
  `READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`. Add
  `android.blockedPermissions` for them.
- **iPad**: `supportsTablet: true` (`app.json:11`) means iPad screenshots are
  required and the app is reviewed on iPad. Everything scales by `width/286`
  (≈690 px timer ring on an 11" iPad) and it was never tested there. Set
  `false` for v1.
- **Export compliance**: add `ios.config.usesNonExemptEncryption: false` to skip
  the encryption question on every upload.

---

## P1 — functional bugs

### 8. Impossible filter mix silently returns the whole library (verified)
- `useSession.js:59`: an empty pool falls back to all 107 combos. There are no
  combos for Beginner+Elbows/Knees/Clinch/Deadliest, Intermediate+Deadliest or
  Advanced+Mixed, so a beginner who picks "Beginner + Elbows" gets advanced
  spinning attacks with no message.
- Fix: compute the matching count live, show it on Generate
  ("Generate · 6 combos"), disable Generate at 0 (or dim impossible chips).

### 9. Voice: chatter can replace a running workout (verified)
- `App.js:109-119`: `countdown` and `workout` start immediately even while a run
  is going (only `set`/`preset` check `running`).
- Probes that parse as commands: "the timer is 3 minutes" → 3:00 countdown;
  "I did 5 rounds of 3 minutes" → new workout; while idle, "I need a rest for two
  minutes" → saved rest = 2:00, "I did 5 rounds yesterday" → saved rounds = 5.
- Fix: while running/paused, answer "Stop the timer first" for
  countdown/workout too; for settings require the keyword at the start of the
  utterance (or "set"), not anywhere in a sentence.

### 10. Voice: combo trigger is too loose for a gym with music (verified)
- `comboGrammar.js:47` accepts any word starting with `com`/`kom`, or "number".
  Probes: "come back" → previous combo, "come to" → combo 2, "come next" → next,
  "number two" → combo 2, "commit for…" → combo 4. Song lyrics and coaches say
  these all the time; the echo guard only covers the app's own cues.
- Fix: whitelist actual mis-hearings of "combo" (combo, combos, kombo, compo,
  comber, …) instead of a prefix; keep the merged forms ("comboten").

### 11. Favorites can't be opened (verified)
- `FavoritesScreen.js:41` passes `expandable={false}`, so saved combos show
  only their name — the steps are unreachable. Allow expand (no timer), and add
  "Train favorites".

### 12. "New session" wipes progress with one tap (verified)
- `TrainingScreen.js:148`, top of the list where a scrolling thumb lands. Confirm
  when anything is done/opened.

### 13. Session and running timer are lost if the OS kills the app (verified)
- Session state and the timer run live only in memory. Android kills background
  apps on low-memory phones (e.g. while picking a song). Persist the session
  (ids, doneIds, startedAt) and the run (config + clock) to AsyncStorage; the
  wall-clock engine makes restoring a run trivial.

### 14. Duplicate combo (verified)
- "Teep - Teep → High kick → Spinning heel kick" is both id 76 (adv/kicks,
  `data/combos.js:866`) and id 100 (adv/deadliest, `:1149`); an advanced
  session can show it twice.

### 15. Storage robustness (verified, low)
- `JSON.parse` without try/catch (`useFavorites.js:11`,
  `useTimerSettings.js:22,25`): one corrupt value = unhandled rejection and the
  data never loads.
- A favorite toggled before the initial load finishes writes a one-item list
  over the stored favorites (`useFavorites.js:20`). Track a `loaded` flag.

### 16. Small ones
- Custom preset names with no Latin letters (Cyrillic, emoji) compact to `""`
  and then match every "preset …" query (`App.js:51,66`).
- `Vibration` patterns are ignored on iOS (`useTimerCues.js:23`); use
  `expo-haptics` for a consistent feel.
- Shuffle `sort(() => Math.random() - 0.5)` is biased (`useSession.js:60`);
  use Fisher–Yates and avoid repeating the previous session.
- `SavePresetSheet` lifts on `keyboardDidShow` (`TimerSheets.js:35`) — on iOS the
  sheet jumps after the keyboard is already up; use `keyboardWillShow` there.

---

## P2 — quality, performance, ops

- **Re-render storm.** `useSession`'s 1 s combo countdown and every interim
  voice result (`lastHeard`) are state in `App`, and every context value is a
  fresh object each render (`App.js:211`, plus `session`, `favorites`, `voice`).
  So every mounted screen and every `ComboCard` re-renders once a second while a
  combo is open and several times a second while someone talks — competing with
  the 100 ms dial on low-end Android. Memoize context values, split a
  `VoiceStatus` context, move the combo countdown into its own context,
  `React.memo(ComboCard)`.
- **Crash visibility.** No error boundary (a render error = blank app). Add one,
  plus Sentry: voice behaves differently per OEM and you need field data.
  Add `expo-updates` (EAS Update) so voice/grammar fixes ship without review.
- **Accessibility.** Icon buttons (heart, ✓, timer controls, steppers, mic pill)
  have no `accessibilityLabel`/`Role`. Muted text `#555` on `#111` is ≈2.5:1 and
  subtitles `#666` ≈3.3:1 (AA needs 4.5:1). Many fonts are 9.5–11 pt, timer rows
  are a fixed 34 px (`TimerScreen.js:276`) and will clip at large system font
  sizes, steppers are 22 px — small for gloved hands at arm's length.
- **Tests/tooling.** Logic coverage is good. Add `useSession` tests (done
  marking, finish) and move `runTimerCommand`/`onCommand` out of `App.js` into a
  pure module so the chatter cases above become regression tests. No ESLint
  config — add `eslint-config-expo` + `react-hooks`.
- **Voice language** is hard-coded `en-US`.

---

## Store checklist

**Both:** unique name, icon (1024 px, opaque — OK), privacy policy URL, support
URL, screenshots, description/keywords, age-rating questionnaire (martial-arts
instruction, a "Deadliest" category), and an in-app safety disclaimer ("consult a
doctor, train under qualified supervision").

**Google Play:** final package id, AAB (the production profile already builds
one), blocked permissions, Data safety, content rating, feature graphic
(1024×500). If the developer account is a *personal* one, production access
needs a closed test with 12+ testers for 14 days — start that early; it gates
the launch date.

**App Store:** bundle id, `supportsTablet: false`, export-compliance flag, App
Privacy, TestFlight pass on real iPhones (audio + voice, see #4), 6.9" iPhone
screenshots. No login means no account-deletion requirement.

---

## Features

**Worth adding for launch** (high value, mostly reuses what exists):
1. **Coach mode / combo call-outs** — during timer rounds, TTS calls the
   session's combos every N seconds and the Training card follows. It joins the
   two halves of the app (timer + combos + TTS + echo guard already exist) and is
   the main reason people install shadowboxing apps.
2. **Background-safe bells** (P0 #3).
3. **Library** — browse/search all 107 combos with the same filters; expandable
   favorites; "Train favorites".
4. **Real session settings** — combos per session (5/10/15/20), combo hold time
   (30/60/90 s/off).
5. **Onboarding** (what it does, a voice demo, why the mic) and an
   `expo-store-review` prompt after the 3rd finished session.

**After launch:**
6. Training history and streaks (sessions + timer rounds), shareable summary.
7. Custom combos.
8. Southpaw toggle.
9. Technique media (GIF/video per strike) — the biggest content lift.
10. Lock-screen/Live Activity round clock; watch haptics.
11. Localization (UI + voice language).

---

## Recommended order

1. **Week 1 — config & bugs:** identifiers + name, SDK 57 + dedupe, splash,
   blocked permissions, `supportsTablet: false`, export flag, Settings copy and
   placeholders, #8–#12, #14. Open the Play closed test as soon as a build exists.
2. **Week 2 — iOS + resilience:** iPhone audio-session QA and fixes (#4),
   background notifications (#3), persistence (#13), error boundary + Sentry +
   EAS Update.
3. **Then:** coach mode, library, onboarding — and submit.
