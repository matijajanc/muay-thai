# Promo video

The 28-second Glove Mode promo for Facebook and Instagram. It shows the app in a phone
mockup cycling through filters, a session, voice commands, the round timer, and stats. Each
scene has a Slovenian headline with an English line under it. It ends on "Piši mi za beta
verzijo / DM me for the beta".

| File | Use |
| --- | --- |
| `videos/glove-mode-reel-9x16.mp4` | 1080×1920. Reels, Stories, TikTok |
| `videos/glove-mode-feed-4x5.mp4` | 1080×1350. Feed posts |

## How it works

`index.html` is a deterministic animation: `renderAt(t)` draws the frame at `t` seconds. The
app screens are rebuilt in HTML/CSS from the screens' styles (`constants/theme.js` colors,
Ionicons from `@expo/vector-icons`). The combos and the filter counts come from
`data/combos.js`. The streak, minutes, and other stats numbers are demo values.

`render.mjs` has no dependencies. It serves the app folder on 127.0.0.1 and drives the
installed Google Chrome over `--remote-debugging-pipe`. Each PNG frame goes to ffmpeg (H.264
High, BT.709, 30 fps, AAC). The soundtrack is mixed from `assets/sounds/`: the opening
bell, 3-2-1 beeps, the round bell, and the closing triple bell.

## Regenerate

Needs Google Chrome (or `CHROME=/path/to/chrome`), `ffmpeg` on the PATH, `npm install` (for
the Ionicons font), and network access (Google Fonts).

```bash
node promo/render.mjs reel                 # → promo/videos/glove-mode-reel-9x16.mp4 (~4 min)
node promo/render.mjs feed                 # → promo/videos/glove-mode-feed-4x5.mp4
node promo/render.mjs reel --stills 3,12   # PNG stills of a few moments (temp dir)
node promo/render.mjs serve                # preview URL with play/scrub (?t=12.5 freezes)
```

## Changing it

Everything to edit is at the top of the script in `index.html`:

- `CAPTIONS`: headline lines (`<em>` marks the orange words), the English line, and each
  caption's start/end time.
- `CTA`: the closing call to action.
- `T`: the timeline (taps, voice commands, the round bell, the outro).
- `SESSION`, `DRILLED`, `WEEKS`: which combos the session and stats show, and the demo
  chart minutes.
- `AUDIO`: sound cues, by file in `assets/sounds/`.
- `LAYOUTS`: per-format sizes and positions (phone scale, caption size, bubble, outro).
