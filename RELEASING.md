# Releasing

How Glove Mode versions are numbered and how one reaches Google Play testers.

## Version numbers

Every build carries two numbers, shown together as `1.0.1 (6)` in Settings → About → Version and
on every "mic on" line of the voice log:

| Number | Example | Where it lives | Who sets it |
|---|---|---|---|
| Version name | `1.0.1` | `app.json` `expo.version`, mirrored in `package.json` | you, once per release: `npm run set-version` |
| Build number | `6` | Android versionCode, kept on EAS (`appVersionSource: remote`) | EAS: +1 on every production build |

Sentry names each release `com.matijajanc.glovemode@1.0.1+6`, so crash reports point at one build.

The version name is semver:

- **patch** (`1.0.1`): fixes and tweaks, such as more ways to say a voice command.
- **minor** (`1.1.0`): a new feature or screen.
- **major** (`2.0.0`): the public launch, or a change that drops saved data.

Every release that reaches testers gets a new version name. A rebuild of the same code (a failed
build or upload) keeps the name and just gets the next build number.

## Release steps

1. Start on `main` with a clean tree and green tests: `npm test`.
2. Bump the version name: `npm run set-version -- patch` (or `minor`, `major`, `1.2.3`). It
   updates `app.json`, `package.json` and `package-lock.json` together.
3. Add `## <version> — <yyyy-mm-dd>` at the top of [CHANGELOG.md](CHANGELOG.md): bullets for
   testers, en-US, 500 characters at most. `npm test` checks the heading and the length.
4. Commit: `release <version>`.
5. Build: `eas build --platform android --profile production`. The free-tier queue can take
   about an hour. The build page shows the build number EAS gave it and links the `.aab`.
6. Tag the built commit with both numbers, then push `main` and the tag:
   `git tag -a v1.0.1 -m "1.0.1 (6)"`, `git push origin main v1.0.1`.
7. Upload to Play by hand (there's no Play service account key on EAS, so `eas submit` can't):
   Play Console → Glove Mode → Testing → Closed testing (Zaprto preizkušanje) → Alpha →
   Create new release (Ustvari novo izdajo) → upload the `.aab`. The release name fills in as
   `6 (1.0.1)`. Paste the changelog bullets into the en-US notes (`<en-US>…</en-US>`) → Next →
   Save → Publishing overview → Send changes for review (Pošlji spremembe v pregled). Managed
   publishing is off, so testers get it as soon as Google's review passes.
8. Once installed, check Settings → About → Version on a phone shows the new numbers.
