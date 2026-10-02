import { parseCommands } from '../comboGrammar';

// Outputs of parseCommands before the grammar split (hooks/useVoiceCommands.js
// at d818588). The split must not change what any phrase parses to.
const BASELINE = [
  ['combo 3', [{ type: 'slot', slot: 3, key: 'slot:3' }]],
  ['combo three', [{ type: 'slot', slot: 3, key: 'slot:3' }]],
  ['combo tree', [{ type: 'slot', slot: 3, key: 'slot:3' }]],
  ['combo for', [{ type: 'slot', slot: 4, key: 'slot:4', tentative: true }]],
  ['combo four', [{ type: 'slot', slot: 4, key: 'slot:4' }]],
  ['combo for three', [{ type: 'slot', slot: 4, key: 'slot:4' }]],
  ['combo favorite', [{ type: 'favorite', key: 'favorite' }]],
  ['combo for it', [{ type: 'slot', slot: 4, key: 'slot:4' }]],
  ['combo next', [{ type: 'next', key: 'next' }]],
  ['combo necks', [{ type: 'next', key: 'next' }]],
  ['combo back', [{ type: 'previous', key: 'previous' }]],
  ['combo previous', [{ type: 'previous', key: 'previous' }]],
  ['combo finish', [{ type: 'finish', key: 'finish' }]],
  ['combo finnish', [{ type: 'finish', key: 'finish' }]],
  ['combo 10', [{ type: 'slot', slot: 10, key: 'slot:10' }]],
  ['combo ten', [{ type: 'slot', slot: 10, key: 'slot:10' }]],
  ['combo then', [{ type: 'slot', slot: 10, key: 'slot:10' }]],
  ['combo 11', []],
  ['combo eleven', []],
  ['combo number 3', [{ type: 'slot', slot: 3, key: 'slot:3' }]],
  ['combo number', []],
  ['comboten', [{ type: 'slot', slot: 10, key: 'slot:10' }]],
  ['combonext', [{ type: 'next', key: 'next' }]],
  ['combo3', [{ type: 'slot', slot: 3, key: 'slot:3' }]],
  ['combine', [{ type: 'slot', slot: 9, key: 'slot:9' }]],
  ['comba', [{ type: 'slot', slot: 8, key: 'slot:8' }]],
  ['combo 2 combo 5', [{ type: 'slot', slot: 2, key: 'slot:2' },{ type: 'slot', slot: 5, key: 'slot:5' }]],
  ['combo to', [{ type: 'slot', slot: 2, key: 'slot:2' }]],
  ['combo seven', [{ type: 'slot', slot: 7, key: 'slot:7' }]],
  ['kombo 6', [{ type: 'slot', slot: 6, key: 'slot:6' }]],
  ['number 4', []], // "number" alone stopped triggering (gym chatter, 2026-10-01)
  ['combo 0', []],
  ['combo zero', []],
  ['combo twenty', []],
  ['combo half', []],
  ['combo 2:30', [{ type: 'slot', slot: 2, key: 'slot:2' }]],
  ['combo far', [{ type: 'slot', slot: 4, key: 'slot:4', tentative: true }]],
  ['combo fore', [{ type: 'slot', slot: 4, key: 'slot:4', tentative: true }]],
  ['combo 9 please', [{ type: 'slot', slot: 9, key: 'slot:9' }]],
  ['hello world', []],
  ['', []],
  ['combo', []],
  ['combo combo 4', [{ type: 'slot', slot: 4, key: 'slot:4' }]],
  ['combo save', [{ type: 'favorite', key: 'favorite' }]],
  ['comboforty', []],
  ['combohalf', []],
  ['combo 1 next', [{ type: 'slot', slot: 1, key: 'slot:1' }]],
  ['set 2 minutes countdown', []],
  ['time workout complete', []],
  ['Combo Five!', [{ type: 'slot', slot: 5, key: 'slot:5' }]],
  ['combo-six', [{ type: 'slot', slot: 6, key: 'slot:6' }]],
];

const strip = ({ pos, ...rest }) => rest;

describe('combo grammar (regression)', () => {
  it.each(BASELINE)('parses %j as before', (transcript, expected) => {
    expect(parseCommands(transcript).map(strip)).toEqual(expected);
  });

  // Song lyrics and coaching cues that start like "combo".
  it.each([
    'come back', 'come to me', 'come next', 'coming for you', 'come on come on', 'comes back to',
    'number one', 'number two', 'complete one more', 'company two', 'commit for it',
  ])('ignores the everyday phrase %j', (transcript) => {
    expect(parseCommands(transcript)).toEqual([]);
  });

  it.each([
    ['kombo 6', 6], ['combos 4', 4], ['compo 3', 3], ['combat 8', 8], ['combo number 2', 2],
  ])('still hears the near-miss %j', (transcript, slot) => {
    expect(parseCommands(transcript).map(c => c.slot)).toEqual([slot]);
  });

  it.each([
    ['next combo', ['next']],
    ['previous combo', ['previous']],
    ['necks combo', ['next']],
    ['ok next combo please', ['next']],
    ['next combo 3', ['slot']], // "next, combo 3": the slot wins
    ['next combo next combo', ['next']],
    ['combo next combo', ['next']],
    ['back combo', []],
    ['next come', []],
    ['next comment', []],
    ['next', []],
  ])('parses the command before the trigger in %j', (transcript, types) => {
    expect(parseCommands(transcript).map(c => c.type)).toEqual(types);
  });

  it('reports where each command starts', () => {
    expect(parseCommands('hey combo 2 and combo next').map(c => c.pos)).toEqual([1, 4]);
    expect(parseCommands('ok next combo').map(c => c.pos)).toEqual([1]);
  });
});
