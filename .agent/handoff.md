# Handoff

_Last updated: 2026-09-30. Round timer built (plan tasks 1–8); uncommitted, awaiting review
and a new dev build._

## Where we left off

Branch `main`, last commit 6af3ac9. The whole round timer is in the working tree,
**uncommitted**. `npm test` passes (engine, timer grammar, combo-grammar regression).

Plan: `.agent/plan/260930_185109_boxing-round-timer.md`. See § Decisions log (build
entries) for every call made where the wireframes don't draw a state, and § Execution
status for what was checked on the emulator.

## Build state

- New native deps: expo-audio, expo-speech, react-native-svg (+ jest-expo dev). The user's
  phone needs **one new dev build** (`eas build --profile development`); the old build
  red-screens on the new modules.
- A Metro started before this session doesn't see new files: restart it.
- Sounds: `node scripts/generate-sounds.js` → `assets/sounds/*.wav` (deterministic). Not
  yet listened to by the user: `afplay assets/sounds/bell.wav` etc.
- Emulator workflow used: headless AVD `Medium_Phone_API_36.0`, local `expo run:android`
  (JAVA_HOME = Android Studio jbr), app's `debug_http_host` pref pointed at a second Metro.

## Outstanding

- User: listen to the sounds, make the dev build, then plan task 9 (device QA): drift vs
  stopwatch, bells over music (ducking), no self-triggering from TTS/bells, combo + timer
  voice together, background → return, all four clock positions.
- Emulator pass done (sounds, TTS, ducking focus, voice routing via injected transcripts,
  background catch-up). Still unverified: live mic recognition, real loudness over music.
- Commit once the user has reviewed.

## Suggested next topic

Device QA (task 9) on the new dev build; fix what it finds, then commit.
