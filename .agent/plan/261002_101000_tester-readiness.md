# Tester Readiness (before the Play closed test)

## Context

Before inviting testers to the Play closed test (2026-10-02), the user asked to finish what the
store-readiness review (`.agent/reviews/261001_store-readiness-review.md`) still had open. Their
answers: make the two placeholder Settings rows work, host a privacy policy from the public repo
(GitHub Pages), fix the timer going silent in the background before testers start, and suggest a
package id and store name.

## Scope

- **Settings rows (review #6).** "Combos per session" (5/10/15/20, default 10) and "Open combo hides
  after" (30 s/1 min/90 s/2 min/until closed, default 1 min), saved in `@muaythai_prefs`.
- **Background bells (review #3), Android.** Bells, warnings and 3-2-1 beeps keep ringing on time
  with the screen locked or the app in the background, plus a lock-screen notification with the
  phase and a live countdown. Spoken lines stay in the app.
- **Privacy policy** at `docs/privacy.md` (GitHub Pages), linked from Settings.
- **Safety note** in Settings (review store checklist).
- **Blocked permissions** (review #7): storage and draw-over-other-apps.

Out: iOS background bells (iOS stub), package id/name (waiting on the user), Sentry/EAS Update,
review P2.

## Approach

- Session size goes through `pickSession(…, size)`; voice slots accept 1–20 (an out-of-range slot
  already answers "No combo N in this session"). The hold time is read when a combo opens; "until
  closed" means no countdown bar.
- Background bells: a local Expo module `modules/round-bells` (Kotlin foreground service, type
  `mediaPlayback`). JS sends it what's left of the run (`utils/backgroundBells.js` `bellPlan`,
  wall-clock times) whenever the run starts, resumes or jumps; pause/stop/done stop it. It rings
  the cues with SoundPool only while the app isn't visible (the app rings them itself otherwise),
  holds a partial wake lock for exact timing with the screen off (a foreground service's wake lock
  also holds in Doze), ducks other audio, and updates its notification at each phase change.
  Sound files come from expo-asset (`downloadAsync` copies bundled files to the cache).

## Decisions log

- 2026-10-02: Scheduled local notifications (expo-notifications + exact alarms) were built first
  and dropped after the emulator test (Android 16): only the first bell of a run made a sound.
  Android 16 force-groups an app's notifications and later ones went silent, and its default-on
  notification cooldown quiets an app's alerts that come less than a minute apart (a warning and
  its bell are 10 s apart). A foreground service plays its own audio, so neither applies.
- 2026-10-02: `mediaPlayback` foreground-service type: the service plays audio. Play Console needs a
  foreground-service declaration (with a short video) for it.
- 2026-10-02: Bells use the media stream, like the in-app ones (same volume, ducks music).

## Execution status

- 2026-10-02: Built. Settings rows, safety note, privacy link checked on the emulator (5-combo
  session generated; "until closed" keeps a combo open without a bar). Background bells checked
  on the emulator: with the app in the background and with the screen off, the service's player
  started at each cue's second (dumpsys audio) and wasn't muted; nothing from the service while
  the app was visible; the notification showed "Rest · round 3 next" with a countdown.
- Open: device check on the S25 Ultra (lock the phone mid-round; music app on top), GitHub Pages
  enabled for `docs/`, package id + name.
