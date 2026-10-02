// The voice command reference shown in Settings and the mic's help sheet.
// Every phrase in `say` must parse (voice/__tests__/commandHelp.test.js), so
// keep this in step with comboGrammar.js and timerGrammar.js.

export const COMMAND_HELP = [
  {
    title: 'Combos',
    note: 'Numbers are the combo’s slot in your current session (1–10). Generate a session first.',
    commands: [
      { say: ['combo 3', 'combo number 3'], does: 'Open that combo for 60 seconds' },
      { say: ['combo next', 'combo back', 'next combo', 'previous combo'], does: 'Open the next / previous combo (starts at combo 1)' },
      { say: ['combo favorite'], does: 'Save the last opened combo to favorites' },
      { say: ['combo finish'], does: 'Finish the session and see your summary' },
    ],
  },
  {
    title: 'Timer controls',
    note: 'Always say “timer” (before or after): a bare “pause” or “stop” is ignored.',
    commands: [
      { say: ['timer start'], does: 'Start your saved rounds (resumes if paused)' },
      { say: ['timer pause', 'timer resume'], does: 'Pause / resume the running timer' },
      { say: ['timer skip'], does: 'Skip to the next round or rest' },
      { say: ['timer stop'], does: 'Stop the timer' },
    ],
  },
  {
    title: 'Quick timers',
    note: 'Start right away while the timer is stopped. Your saved settings don’t change.',
    commands: [
      { say: ['set 2 minutes countdown', 'countdown 90 seconds'], does: 'One-off countdown, up to 60 minutes' },
      { say: ['set 5 rounds of 3 minutes'], does: 'Rounds with your saved rest and bells' },
    ],
  },
  {
    title: 'Timer settings',
    note: 'Only while the timer is stopped. “Set” is optional.',
    commands: [
      { say: ['set round 2 minutes'], does: 'Round time' },
      { say: ['set rest 30 seconds'], does: 'Rest between rounds' },
      { say: ['set rounds 6', 'rounds infinite'], does: 'Number of rounds' },
      { say: ['set delay 5 seconds', 'delay off'], does: 'Start delay' },
      { say: ['preset muay thai', 'preset boxing'], does: 'Load a built-in or saved preset' },
    ],
  },
];
