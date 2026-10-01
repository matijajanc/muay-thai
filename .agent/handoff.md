# Handoff

_Last updated: 2026-10-01. Wave gestures + Stats tab planned and wireframed (approved); nothing
built yet._

## Where we left off

Branch `main`. The plan `.agent/plan/261001_125643_wave-gestures-and-stats.md` and its approved
wireframes (`….wireframes.html`, next to it) are committed. The next
session implements the plan from **task 2**. The user wants the finished app to match the
wireframes **as closely as possible**: see the plan's § Design fidelity.

## This session's arc

- FightFlow's "wave to pause" uses the **proximity sensor**, not the camera. It only reports
  near/far, so gestures are told apart by timing. `expo-sensors` has no proximity sensor, so
  the plan uses a local Expo module.
- User decisions on gestures (Android only, off by default):
  - wave = timer start (never pauses);
  - double wave = next combo;
  - hold 1.5–4 s = open the current combo's details.
- User decisions on Stats:
  - tab order Training | Timer | Favorites | Stats | Settings;
  - a **weekly** streak against a training-days goal (default 3).
- The wireframes cover the gestures card (G1–G2), feedback (F1–F3 plus the copy table), and
  Stats (S1–S7). The user approved them.

## Active plans

| Plan | Status |
|---|---|
| 261001_125643_wave-gestures-and-stats | task 1 (wireframes) done; tasks 2–8 open |
| 260930_185109_boxing-round-timer | built; task 9 (device QA) still with the user |

## Build state

- **Task 2 adds native code** (`modules/proximity`, Kotlin, plus an iOS stub). The user's
  phone then needs one new dev build (`eas build --profile development`). Everything after
  task 2 is JS.
- `android/` is gitignored (CNG), so the local module autolinks on prebuild.
- Restart Metro after adding files.
- Emulator used before: headless AVD `Medium_Phone_API_36.0`, `expo run:android` with
  JAVA_HOME set to Android Studio's jbr. Drive proximity from Extended controls → Virtual
  sensors.

## Outstanding

- Plan open items: none. Execute tasks 2–8 in order, and update § Execution status as you go.
- The timer device QA (old plan task 9) can share the new dev build with gesture QA.
- `.agent/reviews/261001_store-readiness-review.md`: its roadmap items are still open.

## Suggested next topic

Build plan task 2 (proximity module + `blip.wav`), then hand the user the dev-build command.
While that builds, do tasks 3, 5 and 6, which are pure JS and tested:
- the gesture detector;
- the training log;
- stats math and the Stats screen.

Then task 4 (gesture wiring and the Settings card) once the module is on a device or
emulator.

After each UI task:
- take an emulator screenshot of every affected frame;
- compare it side by side with the wireframe;
- run the `wireframe-vs-code` agent;
- fix every difference, or get the user's sign-off.

Copy is character-for-character, and only theme tokens are used.
