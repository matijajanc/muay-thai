export const colors = {
  // Backgrounds
  bg: '#111111',
  surface: '#1a1a1a',
  surfaceActive: '#1e1e1e',
  border: '#2a2a2a',
  borderActive: '#333333',

  // Brand
  accent: '#E86C3A',

  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#aaaaaa',
  textMuted: '#555555',

  // Navigation
  tabBar: '#161616',
  tabBarBorder: '#2a2a2a',

  // Difficulty chips
  begBg: '#1a2e14', begText: '#97C459', begBorder: '#3B6D11',
  intBg: '#2e1f00', intText: '#EF9F27', intBorder: '#854F0B',
  advBg: '#2e0f0f', advText: '#F09595', advBorder: '#A32D2D',

  // Type chips (standard)
  typeBg: '#1a1a2e', typeText: '#85B7EB', typeBorder: '#185FA5',

  // Type chips (deadliest)
  deadBg: '#1a0a2e', deadText: '#AFA9EC', deadBorder: '#534AB7',

  // Inactive chip
  chipInactiveBg: '#1a1a1a', chipInactiveText: '#888888', chipInactiveBorder: '#333333',

  // Voice/settings card
  voiceBg: '#1a1a2e', voiceBorder: '#185FA5',
  voiceTitle: '#85B7EB', voiceBody: '#6a8aaa',
  voiceStep: '#185FA5', voiceStepText: '#85B7EB',

  // Done combos
  doneCheck: '#97C459', doneText: '#666666',

  // Misc text
  title: '#ffffff',
  subtitle: '#666666',
  sectionLabel: '#555555',
  comboNumber: '#444444',

  // Round timer phases (reuse the chip hues)
  timerPrep: '#EF9F27',
  timerWork: '#E86C3A',
  timerWarn: '#F0544F',
  timerRest: '#85B7EB',
  timerDone: '#97C459',
  timerPaused: '#5a5a5a',

  // Round timer surfaces
  timerOverlay: 'rgba(12,12,12,.93)', // Center clock on Training
  timerBand: '#151515', // Bottom clock band
  sheet: '#181818',
  scrim: 'rgba(0,0,0,.55)',
  behindDim: 'rgba(17,17,17,.65)', // the screen behind a sheet at 35% (under the scrim)
  dialFace: '#141414',
  dialStroke: '#2e2e2e',
  dialHub: '#0f0f0f',
  ringTrack: '#202020',
  controlBorder: '#3a3a3a', // steppers, mini/nav buttons, grab handle
  dotIdle: '#2c2c2c',
  dotCurrentRing: 'rgba(232,108,58,.25)',
  chipOnBg: 'rgba(232,108,58,.14)',
  optionOnBg: 'rgba(232,108,58,.10)', // clock tiles, voice-changed row
  cuePrepBg: 'rgba(239,159,39,.14)',
  cueWarnBg: 'rgba(240,84,79,.16)',
  doneCircleBg: 'rgba(151,196,89,.14)',
  toggleOff: '#333333', toggleKnobOff: '#888888',

  // Clock-position tiles (schematic mini screens, B3)
  tileBand: '#1f1f1f',
  tileOverlay: 'rgba(12,12,12,.9)',
  tileCard: '#262626',

  // Run-screen phase tints (radial, centered at 50% / 40%)
  tintPrep: 'rgba(239,159,39,.12)',
  tintWarn: 'rgba(240,84,79,.22)',
  tintRest: 'rgba(133,183,235,.12)',

  // Stats (bar tracks use ringTrack, the chart axis border)
  barPast: 'rgba(232,108,58,.35)', // past weeks in the 12-week chart
  chartAvg: '#888888', // average line and its label
  dayDotIdle: '#222222', // streak day dots, history row icons
  historyHeld: '#232323', // a long-pressed history row
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24,
};

export const radius = {
  sm: 6, md: 10, lg: 12, pill: 20,
};

export const fontSize = {
  xs: 10, sm: 11, md: 12, base: 13, lg: 16, xl: 17,
};
