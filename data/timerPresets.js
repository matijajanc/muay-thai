// Round-timer presets and defaults. A preset is rounds × round time + rest;
// start delay, cues and display settings are not part of it.

export const BUILT_IN_PRESETS = [
  { id: 'muaythai', name: 'Muay Thai', rounds: 5, roundSec: 180, restSec: 120 },
  { id: 'boxing', name: 'Boxing', rounds: 12, roundSec: 180, restSec: 60 },
  { id: 'mma', name: 'MMA', rounds: 3, roundSec: 300, restSec: 60 },
  { id: 'tabata', name: 'Tabata', rounds: 8, roundSec: 20, restSec: 10 },
  { id: 'bag', name: 'Bag 6×2', rounds: 6, roundSec: 120, restSec: 30 },
];

export const PRESET_FIELDS = ['rounds', 'roundSec', 'restSec'];

export const matchesPreset = (preset, settings) =>
  PRESET_FIELDS.every(key => preset[key] === settings[key]);

export const DEFAULT_TIMER_SETTINGS = {
  presetId: 'muaythai',
  rounds: 5, // 1–20, or null for ∞
  roundSec: 180,
  restSec: 120,
  delaySec: 10,
  roundWarnSec: 10, // clap
  restWarnSec: 10, // double beep
  beeps: true, // 3-2-1
  voice: true, // TTS announcements
  vibrate: false,
  trainingClock: 'center', // 'center' | 'top' | 'bottom' | 'off'
};

// Chips of the option sheet (B2): warnings and start delay. 0 is "Off".
export const OPTION_SECONDS = [0, 5, 10, 15, 30];

export const LIMITS = {
  roundSec: [10, 1200], // 0:10 – 20:00
  restSec: [0, 600], // 0:00 – 10:00
  rounds: [1, 20], // + past 20 gives ∞
  delaySec: [0, 60],
};

export const PRESET_NAME_MAX = 20;
