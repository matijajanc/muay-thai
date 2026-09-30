// Round-timer voice commands (wireframe section 6).
//
//   "set 2 minutes countdown" / "countdown 90 seconds" / "set a 2 minute 30 timer"
//       → { type: 'countdown', sec }                          (final result only)
//   "set 5 rounds of 3 minutes"  → { type: 'workout', rounds, roundSec }   (final)
//   "set rest 30 seconds" / "set rounds 6" / "set round 2 minutes" / "set delay 5 seconds"
//       → { type: 'set', field, value }                                    (final)
//   "preset muay thai"           → { type: 'preset', query }               (final)
//   "timer start | pause | resume | skip | stop | reset" (or "start timer", …)
//       → { type: 'start' | 'pause' | 'resume' | 'skip' | 'stop' }       (interim)
//
// A bare "pause" / "stop" is ignored on purpose (gym chatter): controls need
// "timer", durations need countdown / timer / rounds / rest / delay. "set" is
// optional, since it's often misheard as "said" or "sit". None of the timer's
// spoken lines ("Round 2", "Rest", "Ten seconds", …) parse as a command.

import {
  words, parseNumber, parseDuration, isMinuteWord, isSecondWord, AMBIGUOUS_NUMBER_WORDS,
} from './numbers';

// Not "time": "next time", "go time" or "in two minutes time" are everyday speech.
const TIMER_WORDS = new Set(['timer', 'timers', 'tymer', 'timor', 'timar']);
const COUNTDOWN_WORDS = new Set(['countdown', 'countdowns']);
const CONTROL_WORDS = {
  start: 'start', started: 'start', starts: 'start',
  pause: 'pause', paused: 'pause', paws: 'pause', pose: 'pause', pours: 'pause',
  resume: 'resume', resumed: 'resume', resumes: 'resume', presume: 'resume',
  skip: 'skip', skipped: 'skip', skips: 'skip',
  stop: 'stop', stopped: 'stop', stops: 'stop', reset: 'stop',
};
const REST_WORDS = new Set(['rest', 'rests', 'wrest']);
const ROUND_WORDS = new Set(['round']);
const ROUNDS_WORDS = new Set(['rounds']);
const DELAY_WORDS = new Set(['delay', 'delays']);
const PRESET_WORDS = new Set(['preset', 'presets']);
const INFINITE_WORDS = new Set(['infinite', 'infinity', 'unlimited', 'endless', 'forever']);
const OFF_WORDS = new Set(['off', 'none', 'zero']);
// "set" and its mis-hearings, plus glue words between a keyword and its value.
const FILLERS = new Set(['set', 'said', 'sit', 'sat', 'sets', 'the', 'of', 'is', 'at', 'an']);

// Commands that wait for the final result, so "2 minutes… 30 seconds" can finish.
const FINAL_ONLY = new Set(['countdown', 'workout', 'set', 'preset']);

// Join two-word spellings: "count down" → countdown, "pre set" → preset.
function tokens(transcript) {
  const ws = words(transcript);
  const out = [];
  for (let i = 0; i < ws.length; i++) {
    if (ws[i] === 'count' && ws[i + 1] === 'down') {
      out.push({ w: 'countdown', pos: i++ });
    } else if (ws[i] === 'pre' && ws[i + 1] === 'set') {
      out.push({ w: 'preset', pos: i++ });
    } else {
      out.push({ w: ws[i], pos: i });
    }
  }
  return out;
}

export function parseTimerCommands(transcript) {
  const toks = tokens(transcript);
  const ws = toks.map(t => t.w);
  const n = ws.length;

  const startsNumber = (i) => parseNumber(ws, i) != null || (ws[i] === 'a' && isMinuteWord(ws[i + 1]));
  // Skip glue words; an everyday number word ("to", "for") is glue when a
  // number follows it ("rest to 30 seconds").
  const skip = (i) => {
    while (i < n) {
      const w = ws[i];
      if (FILLERS.has(w)) i++;
      else if (w === 'a' && parseNumber(ws, i + 1)) i++;
      else if (AMBIGUOUS_NUMBER_WORDS.has(w) && startsNumber(i + 1)) i++;
      else break;
    }
    return i;
  };
  const durationAt = (i) => parseDuration(ws, skip(i));
  // A count without a unit ("rounds 6", not "round 2 minutes").
  const countAt = (i) => {
    const num = parseNumber(ws, skip(i));
    if (!num || isMinuteWord(ws[num.end]) || isSecondWord(ws[num.end])) return null;
    return num;
  };

  // The command that starts at word i → { cmd, end } or null.
  function matchAt(i) {
    const w = ws[i];
    const next = ws[i + 1];

    // "timer pause" / "pause timer"
    if (TIMER_WORDS.has(w) && CONTROL_WORDS[next]) return { cmd: { type: CONTROL_WORDS[next] }, end: i + 2 };
    if (CONTROL_WORDS[w] && TIMER_WORDS.has(next)) return { cmd: { type: CONTROL_WORDS[w] }, end: i + 2 };

    // "preset muay thai"
    if (PRESET_WORDS.has(w)) {
      const query = ws.slice(i + 1, i + 4).join(' ');
      return query ? { cmd: { type: 'preset', query }, end: n } : null;
    }

    // "countdown 90 seconds" / "timer for 2 minutes"
    if (COUNTDOWN_WORDS.has(w) || TIMER_WORDS.has(w)) {
      const d = durationAt(i + 1);
      if (d) return { cmd: { type: 'countdown', sec: d.sec }, end: d.end };
    }

    // "rest 30 seconds"
    if (REST_WORDS.has(w)) {
      const d = durationAt(i + 1);
      if (d) return { cmd: { type: 'set', field: 'restSec', value: d.sec }, end: d.end };
    }

    // "round 2 minutes" / "round time 3 minutes" (never a bare "round 2")
    if (ROUND_WORDS.has(w)) {
      const d = durationAt(ws[i + 1] === 'time' ? i + 2 : i + 1);
      if (d) return { cmd: { type: 'set', field: 'roundSec', value: d.sec }, end: d.end };
    }

    // "rounds 6" / "rounds infinite"
    if (ROUNDS_WORDS.has(w)) {
      const j = skip(i + 1);
      if (INFINITE_WORDS.has(ws[j])) return { cmd: { type: 'set', field: 'rounds', value: null }, end: j + 1 };
      const c = countAt(i + 1);
      if (c) return { cmd: { type: 'set', field: 'rounds', value: c.value }, end: c.end };
    }

    // "delay 5 seconds" / "delay 5" / "delay off"
    if (DELAY_WORDS.has(w)) {
      const j = skip(i + 1);
      if (OFF_WORDS.has(ws[j])) return { cmd: { type: 'set', field: 'delaySec', value: 0 }, end: j + 1 };
      const d = durationAt(i + 1);
      if (d) return { cmd: { type: 'set', field: 'delaySec', value: d.sec }, end: d.end };
      const c = countAt(i + 1);
      if (c) return { cmd: { type: 'set', field: 'delaySec', value: c.value }, end: c.end };
    }

    // "5 rounds of 3 minutes" / "6 rounds"
    const num = parseNumber(ws, i);
    if (num && ROUNDS_WORDS.has(ws[num.end])) {
      const d = durationAt(num.end + 1);
      if (d) return { cmd: { type: 'workout', rounds: num.value, roundSec: d.sec }, end: d.end };
      return { cmd: { type: 'set', field: 'rounds', value: num.value }, end: num.end + 1 };
    }

    // "2 minutes countdown" / "a 2 minute 30 timer"
    const d = parseDuration(ws, i);
    if (d) {
      const j = skip(d.end);
      if (COUNTDOWN_WORDS.has(ws[j]) || TIMER_WORDS.has(ws[j])) {
        return { cmd: { type: 'countdown', sec: d.sec }, end: j + 1 };
      }
    }
    return null;
  }

  const commands = [];
  for (let i = 0; i < n;) {
    const match = matchAt(i);
    if (!match) {
      i += 1;
      continue;
    }
    const { cmd } = match;
    const key = ['timer', cmd.type, cmd.field, cmd.value ?? cmd.sec ?? cmd.query, cmd.rounds, cmd.roundSec]
      .filter(v => v !== undefined)
      .join(':');
    commands.push({ ...cmd, domain: 'timer', key, final: FINAL_ONLY.has(cmd.type), pos: toks[i].pos });
    i = Math.max(match.end, i + 1);
  }
  return commands;
}
