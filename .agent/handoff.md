# Handoff

_Last updated: 2026-10-01. Wave gestures + Stats built and committed (plan tasks 2–7); device
QA (task 8) open._

## Where we left off

Branch `main`: everything for `.agent/plan/261001_125643_wave-gestures-and-stats.md` tasks 2–7
is in one commit. The plan's § Execution status and § Implementation notes list what was built
and the choices made beyond the plan.

- `modules/proximity` (local Expo module, Kotlin + iOS stub) builds and autolinks; verified on
  the emulator's virtual proximity sensor.
- Gestures, training log, Stats tab and Settings card verified on the emulator against
  G1/G2, F1–F3 and S1–S7; `wireframe-vs-code` findings fixed.
- `npm test`: 334 passing (new: waveGestures, history, stats suites).

## Waiting on the user

- One new dev build for the phone: `eas build --profile development` (note: `expo-dev-client`
  isn't in package.json although the profile sets `developmentClient: true`).

## Active plans

| Plan | Status |
|---|---|
| 261001_125643_wave-gestures-and-stats | tasks 1–7 done; task 8 (device QA) open |
| 260930_185109_boxing-round-timer | built; task 9 (device QA) still with the user |

## Emulator notes

- Headless AVD `Medium_Phone_API_36.0`; build with `npx expo run:android --no-bundler` and
  JAVA_HOME = Android Studio's jbr.
- The debug build reads its bundler from the app's `debug_http_host` pref (no dev-client):
  set it with `run-as com.yourname.muaythaiapp` in `shared_prefs/…_preferences.xml`.
- Drive the sensor with `adb emu sensor set proximity 0` (near) / `1` (far).
- To screenshot Stats with data, pull `databases/RKStorage` via `run-as`, write
  `@muaythai_history` with host sqlite3, push it back (app stopped).

## Suggested next topic

Device QA (plan task 8, with timer QA task 9 on the same build): gesture hit rate and false
triggers (mic taps, pick-up, pocket, face down, a glove), sensor position, and log entries
after a real workout. Then the store-readiness review roadmap
(`.agent/reviews/261001_store-readiness-review.md`).
