import { parseTimerCommands } from '../timerGrammar';
import { parseCommands } from '../parseCommands';
import { parseDuration, parseNumber, words } from '../numbers';

// Just the parts that matter for routing.
const parse = (t) =>
  parseTimerCommands(t).map(({ type, sec, field, value, rounds, roundSec, query }) =>
    JSON.parse(JSON.stringify({ type, sec, field, value, rounds, roundSec, query })));

describe('numbers', () => {
  it('reads digits, words, mis-hearings and tens compounds', () => {
    expect(parseNumber(['90'], 0)).toEqual({ value: 90, end: 1 });
    expect(parseNumber(['too'], 0)).toEqual({ value: 2, end: 1 });
    expect(parseNumber(['forty', 'five'], 0)).toEqual({ value: 45, end: 2 });
    expect(parseNumber(['twenty', 'to'], 0)).toEqual({ value: 20, end: 1 }); // "to" isn't a digit word
    expect(parseNumber(['hello'], 0)).toBeNull();
  });

  it('expands m:ss and splits hyphens', () => {
    expect(words('Set 2:30 count-down!')).toEqual(['set', '2', 'minutes', '30', 'seconds', 'count', 'down']);
  });

  it.each([
    ['2 minutes', 120],
    ['two minutes', 120],
    ['to minutes', 120],
    ['90 seconds', 90],
    ['ninety seconds', 90],
    ['1 minute 30 seconds', 90],
    ['2 minutes and 30 seconds', 150],
    ['2 minute 30', 150],
    ['a minute', 60],
    ['a minute and a half', 90],
    ['2 and a half minutes', 150],
    ['half a minute', 30],
    ['forty five seconds', 45],
    ['2:30', 150],
    ['3 min', 180],
  ])('parses %j as %d s', (text, sec) => {
    expect(parseDuration(words(text), 0)?.sec).toBe(sec);
  });

  it('needs a unit', () => {
    expect(parseDuration(words('2'), 0)).toBeNull();
    expect(parseDuration(words('round 2'), 1)).toBeNull();
  });

  it("doesn't read an everyday word after the minutes as seconds", () => {
    expect(parseDuration(words('2 minutes to go'), 0)).toEqual({ sec: 120, end: 2 });
  });
});

describe('timer grammar', () => {
  it.each([
    ['set 2 minutes countdown', { type: 'countdown', sec: 120 }],
    ['said 2 minutes countdown', { type: 'countdown', sec: 120 }],
    ['sit two minute countdown', { type: 'countdown', sec: 120 }],
    ['2 minutes countdown', { type: 'countdown', sec: 120 }],
    ['countdown 90 seconds', { type: 'countdown', sec: 90 }],
    ['count down 90 seconds', { type: 'countdown', sec: 90 }],
    ['countdown for 2 minutes', { type: 'countdown', sec: 120 }],
    ['set a 2 minute 30 timer', { type: 'countdown', sec: 150 }],
    ['timer 2 minutes', { type: 'countdown', sec: 120 }],
    ['set a minute and a half timer', { type: 'countdown', sec: 90 }],
    ['set 2:30 countdown', { type: 'countdown', sec: 150 }],
    ['set 5 rounds of 3 minutes', { type: 'workout', rounds: 5, roundSec: 180 }],
    ['five rounds of three minutes', { type: 'workout', rounds: 5, roundSec: 180 }],
    ['set rest 30 seconds', { type: 'set', field: 'restSec', value: 30 }],
    ['set rest to 30 seconds', { type: 'set', field: 'restSec', value: 30 }],
    ['rest a minute', { type: 'set', field: 'restSec', value: 60 }],
    ['set rounds 6', { type: 'set', field: 'rounds', value: 6 }],
    ['set rounds to 6', { type: 'set', field: 'rounds', value: 6 }],
    ['set 6 rounds', { type: 'set', field: 'rounds', value: 6 }],
    ['set rounds infinite', { type: 'set', field: 'rounds', value: null }],
    ['set round 2 minutes', { type: 'set', field: 'roundSec', value: 120 }],
    ['set round time 3 minutes', { type: 'set', field: 'roundSec', value: 180 }],
    ['set delay 5 seconds', { type: 'set', field: 'delaySec', value: 5 }],
    ['set delay 5', { type: 'set', field: 'delaySec', value: 5 }],
    ['start delay 15 seconds', { type: 'set', field: 'delaySec', value: 15 }],
    ['set delay off', { type: 'set', field: 'delaySec', value: 0 }],
    ['preset muay thai', { type: 'preset', query: 'muay thai' }],
    ['preset boxing', { type: 'preset', query: 'boxing' }],
    ['pre-set tabata', { type: 'preset', query: 'tabata' }],
    ['timer start', { type: 'start' }],
    ['start timer', { type: 'start' }],
    ['timer pause', { type: 'pause' }],
    ['timer paws', { type: 'pause' }],
    ['timer resume', { type: 'resume' }],
    ['timer skip', { type: 'skip' }],
    ['timer stop', { type: 'stop' }],
    ['timer reset', { type: 'stop' }],
    ['stop timer', { type: 'stop' }],
  ])('parses %j', (transcript, expected) => {
    expect(parse(transcript)).toEqual([expected]);
  });

  it.each([
    'pause', 'stop', 'start', 'reset', 'rest', 'round 2', 'rounds', 'set rest', 'countdown',
    '2 minutes', 'preset', 'combo 3', 'combo next', 'what time is it', 'let us go',
    'next time', 'hold time', 'go time', 'time stop', 'in two minutes time', 'combo next timer',
  ])('ignores %j', (transcript) => {
    expect(parse(transcript)).toEqual([]);
  });

  // The timer's own TTS lines must never parse as a command.
  it.each([
    'Get ready', 'Round 1', 'Round 2', 'Round 12', 'Last round', 'Rest', 'Five seconds',
    'Ten seconds', 'Fifteen seconds', 'Thirty seconds', 'Time.', 'Time. Workout complete.',
  ])('never triggers on the spoken line %j', (line) => {
    expect(parseCommands(line)).toEqual([]);
  });

  it('marks set/duration commands final-only and controls interim', () => {
    expect(parseTimerCommands('set 2 minutes countdown')[0]).toMatchObject({ final: true, domain: 'timer' });
    expect(parseTimerCommands('set rounds 6')[0].final).toBe(true);
    expect(parseTimerCommands('preset boxing')[0].final).toBe(true);
    expect(parseTimerCommands('timer pause')[0].final).toBe(false);
  });

  it('gives each command a stable key', () => {
    expect(parseTimerCommands('set 2 minutes countdown')[0].key).toBe('timer:countdown:120');
    expect(parseTimerCommands('set rest 30 seconds')[0].key).toBe('timer:set:restSec:30');
    expect(parseTimerCommands('timer stop')[0].key).toBe('timer:stop');
  });

  it('finds several commands in one transcript', () => {
    expect(parse('set rest 30 seconds and then set rounds 6')).toEqual([
      { type: 'set', field: 'restSec', value: 30 },
      { type: 'set', field: 'rounds', value: 6 },
    ]);
  });
});

describe('merged parsing', () => {
  it('keeps combo and timer commands in spoken order', () => {
    const cmds = parseCommands('timer pause combo 3 timer resume');
    expect(cmds.map(c => `${c.domain}:${c.type}`)).toEqual(['timer:pause', 'combo:slot', 'timer:resume']);
  });

  it('tags combo commands with their domain', () => {
    expect(parseCommands('combo next')).toEqual([
      { type: 'next', key: 'next', pos: 0, domain: 'combo' },
    ]);
  });
});
