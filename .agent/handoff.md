# Handoff

_Last updated: 2026-10-02. Wave gestures cut; Stats + training log stay. "next combo" /
"previous combo" voice commands added._

## Where we left off

Branch `main`.

- Wave gestures were removed (plan note at the top of
  `.agent/plan/261001_125643_wave-gestures-and-stats.md`): the user's Galaxy S25 Ultra only
  exposes a virtual "Palm Proximity sensor version 2" that reports "far" once and never changes.
  `modules/` is gone, so the next phone build has no local native modules.
- Voice: "next combo" / "previous combo" parse like "combo next" / "combo previous"; a slot
  after the trigger wins ("next combo 3" → slot 3).
- `npm test`: 319 passing.

## Waiting on the user

- A new phone build (`eas build --profile preview -p android`) to pick up the cut and the
  voice phrases.

## Active plans

| Plan | Status |
|---|---|
| 261001_125643_wave-gestures-and-stats | gestures cut; task 8 (log entries after a real workout) open |
| 260930_185109_boxing-round-timer | built; task 9 (device QA) still with the user |

## Emulator notes

- Headless AVD `Medium_Phone_API_36.0`; build with `npx expo run:android --no-bundler` and
  JAVA_HOME = Android Studio's jbr (gradle directly also needs ANDROID_HOME).
- The debug build reads its bundler from the app's `debug_http_host` pref (no dev-client):
  set it with `run-as com.yourname.muaythaiapp` in `shared_prefs/…_preferences.xml`.
- To screenshot Stats with data, pull `databases/RKStorage` via `run-as`, write
  `@muaythai_history` with host sqlite3, push it back (app stopped).

## Suggested next topic

Device QA on the next build: timer QA (task 9) and log entries after a real workout. Then the
store-readiness review roadmap (`.agent/reviews/261001_store-readiness-review.md`).
