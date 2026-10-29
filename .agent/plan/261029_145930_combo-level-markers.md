# Combo Level Markers

## Context

A combo card showed only its number, name and heart, so the user couldn't tell a combo's level
or spot the Deadliest ones. They asked for a small icon (a skull) on Deadliest combos, or a better
way to show Beginner / Intermediate / Advanced too. Wireframes:
`261029_145930_combo-level-markers.wireframes.html` (options A–D, Deadliest icon picks).

## Scope

- **Combo cards** (Training and Favorites, `components/ComboCard.js`): 1, 2 or 3 bars between the
  number and the name, in the difficulty chip colours. Deadliest combos (all Advanced) show a
  purple Ionicons `skull` in the same slot. A done combo's marker dims with its name.
- **Filter chips** (`components/FilterChips.js`): the Difficulty chips show the same bars and the
  Deadliest chip shows the skull, so the filters double as the legend. Chips that are off tint
  the marker grey like their label.

Out: the optional "Intermediate · Kicks" line on an open combo (wireframe section 4, note 3), and
the Stats session sheet, which already names each combo's level in words.

## Approach

- `components/LevelMarker.js` draws the bars (3 px wide, 6/9/12 tall) or the skull in one
  fixed-width slot, so names line up. Unlit bars use the new `colors.levelBarIdle`.
- A chip passes its text colour as the marker tint; on a card the marker uses the level colour.
- The card's number column grew from 18 to 22 so "10"–"20" don't touch the marker.

## Decisions log

- 2026-10-29: The user picked option A (level bars + skull) over an edge stripe, a coloured
  number badge and a label under the name. Bars can be read without colour (count them), which
  matters for red–green colour blindness, and cards keep their height.
- 2026-10-29: Filled skull over skull-outline (fuzzy at 14 px), flame (already the Stats streak
  icon) and lightning (reads as "fast").

## Execution status

- [x] LevelMarker component + theme token
- [x] ComboCard and FilterChips use it
- [x] Data test: every combo has a known difficulty, every Deadliest combo is Advanced
- [x] Emulator check (debug build + Metro): filter chips on/off, session list with all four
  markers, an open Deadliest combo, a done one (dimmed skull), Favorites
