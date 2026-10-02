# Wave Gestures + Stats Screen

## Context

The user asked for two features (2026-10-01):

1. **Wave gestures**, like FightFlow's "wave a glove over the sensor to pause"
   (fightflow.app/features). Only 2 or 3 gestures, so they stay easy to remember.
2. **A statistics screen.**

The store-readiness review (`.agent/reviews/261001_store-readiness-review.md`, Features #6)
already lists "Training history and streaks (sessions + timer rounds)". README "Not in v1"
lists workout history. Today nothing is logged: a finished timer run or combo session leaves
no trace once it's dismissed.

FightFlow's wave works through the **proximity sensor**: the one by the earpiece that turns the
screen off during calls. It's not the camera. Most phones report it as binary near/far at
about 5 cm.

## Scope

In:
- **Gestures** (Android). Three of them, recognised from proximity near/far transitions. They
  run the same commands as voice, so the behaviour and confirmation lines are shared.
- A Settings card with an on/off toggle, the gesture cheat sheet and a live sensor test, so
  the user can find where the sensor is on their phone.
- **A training log**: timer runs and combo sessions, saved in AsyncStorage.
- **A Stats tab**: a weekly streak with a goal, this week vs last week, a 12-week activity
  chart, technique mix, most-drilled combos, history (long-press to delete) and all-time
  totals.

Out (v2 candidates):
- Gestures on iOS. iOS's proximity API blanks the screen while the sensor is covered, so that
  needs its own UX pass. The app is Android-first.
- Camera or hand-pose gestures. They're heavy, drain the battery and need the camera
  permission.
- Accelerometer "tap the phone" gestures.
- Rebinding gestures to other actions.
- Export, sharing or a shareable summary card.
- Heart rate and watch data.
- Reminders and notifications. The weekly goal only drives the streak.
- Backfilling history from before this ships.

## Approach

### 1. Gestures

**Gesture set (user, 2026-10-01: "go simple").**

| Gesture | Motion | Action |
|---|---|---|
| **Wave** | one quick pass, covered < 0.8 s | start the timer: same as voice "timer start" (idle/done → saved workout, paused → resume, running → nothing). It never pauses. |
| **Double wave** | two passes within 1 s | next combo (same as "combo next") |
| **Hold** | cover 1.5–4 s, then lift | open the current combo: the last-opened slot, or combo 1. Its card expands with steps and a fresh 60 s bar, same as "combo N". |

A cover longer than 4 s is ignored: it's a pocket, the phone lying face down, or a hand
resting there. Nothing fires until the sensor reads far again.

**Native: local Expo module `modules/proximity/`.** `expo-sensors` has no proximity sensor
(Context7, Expo docs: Accelerometer, Barometer, DeviceMotion, Gyroscope, LightSensor,
Magnetometer, Pedometer only).
- Scaffold with `npx create-expo-module@latest --local`.
- Kotlin: `SensorManager.getDefaultSensor(TYPE_PROXIMITY)`.
  - `isAvailable()` and `maxRange`.
  - An `onChange { near, t }` event. `near` = value < min(maxRange, 5 cm).
  - The listener is registered in `OnStartObserving` and unregistered in
    `OnStopObserving`, and also on activity pause.
- A non-wakeup listener doesn't turn the screen off, and no permission is needed.
- iOS: a stub where `isAvailable()` returns false, so the iOS build still compiles.
- `android/` is gitignored (CNG), so the module autolinks on prebuild. This needs **one new
  dev build**.

**Detector: pure and tested (`utils/waveGestures.js`).**
- A state machine fed `{near, t}` that emits `wave | doubleWave | hold`.
- Time comes from an injected clock and timers, so the tests are deterministic. The timings
  are constants at the top of the file.
- A single wave waits out the double-wave window (about 0.6 s) before it fires. That's the
  cost of having a double wave.
- Hold gives a short "armed" tick at 1.5 s, so the user knows when to lift, and fires on
  release.

**Hook (`hooks/useWaveGestures.js`).**
- Subscribes only while the setting is on and the app is in the foreground.
- **Touch guard.** The root `View` in `App.js` records `onTouchStartCapture`. A gesture is
  dropped if the screen was touched from 300 ms before the cover until it fires. A hand
  reaching for the mic or header buttons passes over the sensor, and this stops that from
  counting as a wave.
- **Routing.** Gestures map to existing commands and go through `App.js` `onCommand`:
  - wave → `{ domain: 'timer', type: 'start' }`;
  - double wave → `{ domain: 'combo', type: 'next' }`;
  - hold → `{ domain: 'combo', type: 'slot', slot: (activeSlot() ?? 0) + 1 }`.

  So the rules ("Generate a session first", tab switching) stay in one place.
- **Feedback.** The confirmation flashes under the mic, prefixed `✋` ("✋ Timer started"),
  through `useVoiceCommands`'s `flash`. There's also a short `blip.wav`, added to
  `scripts/generate-sounds.js`, and a 40 ms vibration. The blip goes through the echo guard
  (`voice.suppress`).
- The router's line is reused with `✓ ` swapped for `✋ `. Other lines get a `✋ ` prefix.
  `null` (a wave while running) becomes "✋ Timer is already running". Lines that did
  nothing (that `null`, "Generate a session first") are text only: no blip, no buzz. The
  exact copy is in the table in wireframe section 3.
- `App.js` `showTimer` must add `Stats` to the tabs that switch to Timer.
- On a run screen (Timer tab, no mic line), the feedback replaces the run label for 2 s
  (frame F2).

**Settings.** A new "WAVE GESTURES" section at the top of `SettingsScreen`. Gestures recognised
while Settings is open only update the sensor test; they don't control anything:
- a "Wave gestures" toggle, off by default;
- the 3-row cheat sheet;
- a "Sensor test" row: a dot that lights while covered and shows the last gesture it
  recognised;
- if no sensor is available: "This phone has no usable proximity sensor", with the toggle
  disabled.

The setting is saved under `@muaythai_prefs` (`{ waveGestures }`). The mic "?" help sheet
lists the gestures while they're on.

### 2. Training log

**Model (`utils/history.js`: pure builders and validation).** One AsyncStorage key,
`@muaythai_history`, holds an array of entries, newest first, capped at 2,000 entries.
- Timer entry:
  `{ id, type:'timer', at, kind, presetName, roundSec, rounds, roundsDone, workMs, completed, spans }`.
- Combo entry: `{ id, type:'combos', at, comboIds (done), total, spans }`.
- `spans` holds `[start, end]` windows of actual activity, used for time and streaks.
  - Timer spans exclude the lead-in and pauses. `useRoundTimer` records pause intervals.
  - Combo spans are activity windows built from combo activations. A gap longer than 5 min
    closes a window, so a session left open over lunch doesn't count as 2 hours.

**Hook (`hooks/useHistory.js` + `HistoryContext`).**
- Mirrors `useFavorites`, so nothing is written before the load completes.
- `upsert(entry)` by id; `remove(id)`.

**When things are logged:**
- **Timer, done.** A completed entry. Both workouts and countdowns are logged.
- **Timer, stopped early.** A partial entry, only if there was at least 60 s of work.
- **Timer, found finished after the app was killed.** Not logged, because we can't tell
  whether the user trained.
- **Combo session, finished.** The entry is upserted by session id. Finishing again after
  "keep training" updates that entry rather than adding a second one.
- **Combo session, "New session" or the 12 h expiry.** Logged if at least 1 combo was done
  and the session isn't logged yet.

Pure helper: `roundTimer.workSummary(segments, elapsedMs)` → `{ roundsDone, workMs }`.

### 3. Stats (`utils/stats.js`: pure and tested; `screens/StatsScreen.js`)

- **Time.** Training time is the **union** of all spans. Drilling combos during a timer run
  isn't counted twice.
- **Days.** Bucketed in local time (`YYYY-MM-DD`).
- **Screen sections**, top to bottom:
  1. **Week streak.** Weeks run Mon–Sun. A week counts when there were at least *goal*
     training days (default 3, 1–7, set in a sheet). A training day is one with at least
     5 min of union time. An unmet current week doesn't break the streak until it ends.
     The card shows the best streak and this week's day dots.
  2. **This week**, as 2×2 tiles: training time, rounds, combos done, sessions. Each shows a
     "vs last week" delta.
  3. **Last 12 weeks.** Bar chart of minutes per week, drawn with `react-native-svg` (already
     installed, no chart library). The current week is in accent.
  4. **Technique mix.** One bar per combo type (punches, kicks, knees, elbows, clinch, mixed,
     deadliest), in a single hue. A beg/int/adv split uses the existing chip colors.
  5. **Most drilled.** The top 5 combos by times done.
  6. **History.** The last 30 entries, grouped by day, e.g. "Muay Thai · 5 × 3:00 · 5/5
     rounds" or "Combos · 8/10 done · 24 min". Long-press → Alert → delete.
  7. **All time.** Time, sessions, rounds and combos.
- **Empty state:** "No training logged yet — finish a timer workout or a combo session."
- **Tab placement:** Training | Timer | Favorites | **Stats** | Settings, with Ionicons
  `stats-chart-outline`.
- The goal is saved in `@muaythai_prefs` (`{ weeklyGoal }`). Changing it recomputes the whole
  streak, including best.

### Design fidelity

The timer plan's design-fidelity contract was a user requirement. The new UI (the Stats tab
and the Settings gestures card) gets a wireframes file next to this plan **before any UI
code**. The same contract then applies: built UI matches the wireframes exactly, copy is
character-for-character, and only theme tokens are used.

The user restated this on 2026-10-01: the final product must match the approved wireframes
as closely as possible. The rules from `260930_185109_boxing-round-timer.md` § Design
fidelity contract apply here unchanged:
- don't redesign; ask, then update the wireframe first;
- px map 1:1 to dp;
- system font, wireframe weights, `tabular-nums` on numbers;
- wireframe-only artifacts aren't built.

What that means for this feature:
- **Must match:**
  - G1/G2 (gestures card: the off, on and no-sensor states, and the sensor test);
  - F1–F3 feedback placement;
  - the gesture copy table in section 3;
  - S1–S7: the streak card, tiles, chart, technique mix, most drilled, history rows and day
    headers, Show older, all time, the empty state, the goal sheet and the delete Alert;
  - the 5-tab bar order and labels.
- **Approximate (keep the existing code):**
  - the combo cards and MicButton in F1/F3;
  - the run screen in F2, which is timer frame D;
  - the voice cards under the gestures card.
- **Don't build:**
  - section 1 (the sensor explainer);
  - the pins, notes and the logging table;
  - the "Gestures off (for comparison)" card in G2;
  - the `.fade` scroll hints.
- **New theme tokens**, taken from the wireframe literals:
  - past-week bar `rgba(232,108,58,.35)`, using the existing `ringTrack` for bar tracks;
  - chart axis `#2a2a2a` (= `border`), average line and label `#888`;
  - the held history row `#232323`, and the day-dot idle fill `#222`;
  - the alert is the native `Alert`, so it needs no token.
- **Copy rules for derived states**, the ones the wireframes describe only in notes:
  - streak line: "N of G days · K more to keep the streak", "N of G days · goal met ✓" and
    "Train G days this week to start a streak";
  - goal sheet hint: "…when you train on 1 day / on G days";
  - the mix card with fewer than 5 combos: "Do a few combos to see your mix."
- **Verify after each UI task:**
  - take an emulator screenshot of each affected frame in the same state;
  - compare it side by side with the wireframe;
  - run the `wireframe-vs-code` agent;
  - fix every difference, or get the user's sign-off on it.

## Tasks

1. **Wireframes.** `261001_125643_wave-gestures-and-stats.wireframes.html`. Done and
   approved:
   - the sensor explainer;
   - G1–G2 Settings;
   - F1–F3 feedback, plus the gesture copy table;
   - S1–S7 Stats;
   - the logging table.
2. **Native module + sound.**
   - `modules/proximity` (Kotlin + iOS stub), and `blip.wav` in the generator.
   - The user makes **one new dev build**.
3. **Gesture detector + tests.** `utils/waveGestures.js` and the timing tables.
4. **Gestures wired.**
   - `useWaveGestures`, the touch guard and routing through `onCommand`.
   - Prefs, the Settings card and the help-sheet entry.
5. **Training log.**
   - `utils/history.js`, `useHistory` and `HistoryContext`.
   - Logging hooks in `useRoundTimer` (pause intervals, `workSummary`) and `useSession`
     (spans, upsert, reset/expiry), plus tests.
6. **Stats.** `utils/stats.js` and its tests (union, streaks, weeks across DST and year end),
   `StatsScreen`, and the tab. Fidelity check.
7. **Docs.** README features plus "Not in v1"; the Settings "How it works" section.
8. **Device QA.**
   - Gesture hit rate and false triggers: tapping the mic, picking the phone up, pocket,
     face down, a glove over the sensor.
   - Sensor position on the user's phone.
   - Log entries after a real workout.

## Open questions

None. Ready to build from task 2.

## Decisions log

- 2026-10-01: Gestures use the proximity sensor, not the camera. It's cheap, needs no
  permission, and it's what FightFlow does.
- 2026-10-01: Gestures go through the voice command router, so there's one rule set and the
  same confirmation lines.
- 2026-10-01: Gestures are Android-only in v1, and off by default (opt-in in Settings).
- 2026-10-01: A local Expo module rather than an npm proximity package. Those are
  old-architecture and unmaintained, and RN 0.86 is new-arch only.
- 2026-10-01: Training time is the union of activity spans: no double counting, and idle
  gaps are excluded.
- 2026-10-01 (user): Tab order is Training | Timer | Favorites | Stats | Settings.
- 2026-10-01 (user): The streak counts weeks against a training-days goal, not days.
- 2026-10-01 (user): Wireframes come first, under the same fidelity contract as the timer.
- 2026-10-01 (user): Gestures "go simple": wave = start, double wave = next combo, hold =
  open the current combo's details. There's no pause gesture. A wave while running does
  nothing (text-only line). "Combo details" means the expanded card (steps + 60 s bar).
- 2026-10-01 (user): Wireframes approved ("looks ok"), after being updated for the new
  mapping.
- 2026-10-01 (user): today-and-trained day dot is the filled ✓ (wireframe S1 note updated).
- 2026-10-01 (wireframes): the training-day threshold is 5 min. Week-over-week deltas compare
  up to the same weekday. Technique mix and most drilled cover the last 30 days. History
  pages 30 entries at a time.

## Execution status

- 2026-10-01: Task 1 done (wireframes approved). Next is task 2; nothing is built yet.
- 2026-10-01: Tasks 2–7 built and committed; task 8 (device QA) open.
  - Task 2: `modules/proximity` (Kotlin + iOS stub) compiles and autolinks; verified on the
    emulator's virtual sensor. `blip.wav` added; the other sounds regenerate byte for byte.
  - Task 3: `utils/waveGestures.js` + 28 timing tests.
  - Task 4: `useWaveGestures`, touch guard, routing through `onCommand`, prefs, Settings card,
    help-sheet list. F1–F3 checked on the emulator (double wave, hold, wave start/resume/running).
  - Task 5: `utils/history.js`, `useHistory`; logging in `useRoundTimer` and `useSession`.
  - Task 6: `utils/stats.js`, `utils/statsLabels.js` + tests (DST, year end), `StatsScreen`,
    the Stats tab. S1–S7 checked on the emulator with a seeded log.
  - Task 7: README.
  - `wireframe-vs-code` review: fixed a gesture that did nothing on Favorites/Stats showing no
    line (gestures now always go to their tab, per the section 3 note), the gesture line
    hidden by a voice error under the mic, and the day-dot check weight (2.8). G2 checked by
    forcing the no-sensor state.

## Implementation notes

- Gesture timing beyond the plan (tested): covers under 40 ms are sensor glitches; a double
  wave's second pass must start within 0.6 s of the first release; after a double wave or a
  hold, a cover starting within 0.6 s is ignored (a third pass, a hand bouncing as it lifts);
  a wave followed by a too-long cover drops the wave; a cover already there on the first
  reading is ignored until it clears.
- The module listens to every proximity sensor the phone lists and, once one changes between
  near and far, forwards only that one (some phones list a wake-up and a non-wake-up sensor).
  G2's "no sensor" state means none is listed. Until the Settings test sees a cover, the card
  lists each sensor and what it has reported. The earlier "no reading within 3 s = missing"
  rule was dropped: on a Galaxy S25 Ultra it showed "no sensor" (2026-10-01).
- Timer activity is tracked as pieces (wall time ↔ elapsed), so skips and pauses are left out
  of round time and spans. A skipped round isn't counted as done. ∞ runs show "7 rounds".
- Combo spans: each activation counts 60 s; gaps up to 5 min join; finishing cuts the last
  combo short or extends the window to the finish.
- A session is re-logged on "New session"/expiry only if there was activity after its last
  log, so deleting a finished session's entry sticks.
- A day that is both today and trained draws the filled ✓ dot (the wireframe CSS would draw it
  outlined with an invisible check); today's letter stays accent. Approved, wireframe note
  updated.
- Derived copy not in the wireframes: countdown stopped early → "Stopped"; under a minute →
  "<1 min"; day headers add the year when it isn't this year's; "1 day" singular in the streak
  line and goal hint. The 12-week chart labels the oldest week plus the first week starting
  in each month (the note's rule; the sample labels in S1 differ). Technique mix shows all
  seven types, zeros included.
