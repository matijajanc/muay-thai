# Handoff

_Last updated: 2026-10-02. Tester readiness built (uncommitted): Settings rows, background bells
service, privacy policy, safety note. Plan: `.agent/plan/261002_101000_tester-readiness.md`._

## Where we left off

Branch `main`.

- Wave gestures were removed (plan note at the top of
  `.agent/plan/261001_125643_wave-gestures-and-stats.md`): the user's Galaxy S25 Ultra only
  exposes a virtual "Palm Proximity sensor version 2" that reports "far" once and never changes.
- Voice: "next combo" / "previous combo" parse like "combo next" / "combo previous"; a slot
  after the trigger wins ("next combo 3" → slot 3). Slots go up to 20 (session size setting).
- New local module `modules/round-bells` (foreground service): bells with the screen off,
  verified on the emulator. Scheduled notifications were tried first and dropped (Android 16
  silences them; see the plan's decisions log).
- `npm test`: 331 passing.

## Waiting on the user

- Package id + store name (suggested: `com.matijajanc.nakmuay`, "Nak Muay: Combos & Round Timer").
- GitHub Pages on for `main` /docs, so the privacy URL in `constants/links.js` resolves.
- A new phone build, then: lock the phone mid-round (bells + countdown notification).
- Play Console: foreground-service declaration (mediaPlayback) with a short video.

## Active plans

| Plan | Status |
|---|---|
| 261002_101000_tester-readiness | built; device check + Pages + package id open |
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
