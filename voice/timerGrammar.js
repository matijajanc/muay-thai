// Round-timer voice commands (wireframe section 6).
//
//   "set 2 minutes countdown" / "countdown 90 seconds" / "set a 2 minute 30 timer"
//       → { type: 'countdown', sec }                          (final result only)
//       ("counter" / "count" work like "countdown": "set the 2 minutes counter")
//   "set 5 rounds of 3 minutes"  → { type: 'workout', rounds, roundSec }   (final)
//   "set rest 30 seconds" / "set rounds 6" / "set round 2 minutes" / "set delay 5 seconds"
//       → { type: 'set', field, value }                                    (final)
//   "preset muay thai"           → { type: 'preset', query }               (final)
//   "timer start | pause | resume | skip | stop | reset" (or "start timer", …)
//       → { type: 'start' | 'pause' | 'resume' | 'skip' | 'stop' }       (interim)
//
// A bare "pause" / "stop" is ignored on purpose (gym chatter): controls need
// "timer", durations need countdown / timer / rounds / rest / delay. "set" is
// optional, since it's often misheard as "said" or "sit". Set/duration commands
// must open the utterance (or follow another command), so "I need a rest for two
// minutes" or "I did 5 rounds yesterday" change nothing. None of the timer's
// spoken lines ("Round 2", "Rest", "Ten seconds", …) parse as a command.
//
// No extra commands, just more ways to say these: "the" / "a" / "my" after
// "set" or "start" ("start the timer", "set the rest time to 30 seconds",
// "start a 2 minute timer"), "time" / "length" / "period" / "duration" after
// the field, "number of rounds", and "load" / "use" before a preset.

import {
  words, parseNumber, parseDuration, isMinuteWord, isSecondWord, AMBIGUOUS_NUMBER_WORDS,
} from './numbers';

// Not "time": "next time", "go time" or "in two minutes time" are everyday speech.
const TIMER_WORDS = new Set(['timer', 'timers', 'tymer', 'timor', 'timar']);
const COUNTDOWN_WORDS = new Set(['countdown', 'countdowns', 'counter', 'counters', 'count']);
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
// "rest time 30 seconds", "round length 2 minutes": skipped after the field word.
const FIELD_NOUNS = new Set(['time', 'length', 'period', 'duration']);
const PRESET_WORDS = new Set(['preset', 'presets']);
const INFINITE_WORDS = new Set(['infinite', 'infinity', 'unlimited', 'endless', 'forever']);
const OFF_WORDS = new Set(['off', 'none', 'zero']);
// "set" and its mis-hearings, plus glue words between a keyword and its value.
const SET_WORDS = new Set(['set', 'said', 'sit', 'sat', 'sets']);
const FILLERS = new Set([...SET_WORDS, 'the', 'of', 'is', 'at', 'an']);

// Commands that wait for the final result, so "2 minutes… 30 seconds" can finish.
const FINAL_ONLY = new Set(['countdown', 'workout', 'set', 'preset']);

// What may come before a set/duration command: "set", a short lead-in, the
// glue between two commands, "start" ("start delay …", "start a 2 minute
// timer") and "load" / "use" ("load preset boxing").
const LEAD_WORDS = new Set([
  ...SET_WORDS, 'ok', 'okay', 'hey', 'um', 'uh', 'so', 'now', 'and', 'then', 'also', 'please', 'start',
  'load', 'use',
]);
// "set the …", "start a …", "set up a …", "set my …"; only right after these
// words, so a sentence like "the timer is 3 minutes" stays conversation.
const ARTICLES = new Set(['a', 'an', 'the', 'my']);
const ARTICLE_LEADS = new Set([...SET_WORDS, 'start', 'load', 'use', 'up']);

// Join multi-word spellings: "count down" → countdown, "pre set" → preset,
// "countdown timer" → countdown, "number of rounds" → rounds.
function tokens(transcript) {
  const ws = words(transcript);
  const out = [];
  for (let i = 0; i < ws.length; i++) {
    const pos = i;
    if (ws[i] === 'count' && ws[i + 1] === 'down') {
      i += 1;
      if (TIMER_WORDS.has(ws[i + 1])) i += 1;
      out.push({ w: 'countdown', pos });
    } else if (COUNTDOWN_WORDS.has(ws[i]) && TIMER_WORDS.has(ws[i + 1])) {
      out.push({ w: 'countdown', pos: i++ });
    } else if (ws[i] === 'pre' && ws[i + 1] === 'set') {
      out.push({ w: 'preset', pos: i++ });
    } else if (ws[i] === 'number' && ws[i + 1] === 'of' && ROUNDS_WORDS.has(ws[i + 2])) {
      out.push({ w: 'rounds', pos });
      i += 2;
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
  // number or a word value follows it ("rest to 30 seconds", "rounds to infinite").
  const startsValue = (i) => startsNumber(i) || INFINITE_WORDS.has(ws[i]) || OFF_WORDS.has(ws[i]);
  const skip = (i) => {
    while (i < n) {
      const w = ws[i];
      if (FILLERS.has(w)) i++;
      else if (w === 'a' && parseNumber(ws, i + 1)) i++;
      else if (AMBIGUOUS_NUMBER_WORDS.has(w) && startsValue(i + 1)) i++;
      else break;
    }
    return i;
  };
  // Past the field word and an optional "time" / "length" / … after it.
  const afterField = (i) => (FIELD_NOUNS.has(ws[i + 1]) ? i + 2 : i + 1);
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

    // "timer pause" / "pause timer" / "pause the timer", but "start a timer for
    // 2 minutes" is a countdown (matched at "timer").
    if (TIMER_WORDS.has(w) && CONTROL_WORDS[next]) return { cmd: { type: CONTROL_WORDS[next] }, end: i + 2 };
    if (CONTROL_WORDS[w]) {
      const t = ARTICLES.has(next) ? i + 2 : i + 1;
      if (TIMER_WORDS.has(ws[t]) && !durationAt(t + 1)) return { cmd: { type: CONTROL_WORDS[w] }, end: t + 1 };
    }

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

    // "rest 30 seconds" / "rest time 30 seconds"
    if (REST_WORDS.has(w)) {
      const d = durationAt(afterField(i));
      if (d) return { cmd: { type: 'set', field: 'restSec', value: d.sec }, end: d.end };
    }

    // "round 2 minutes" / "round time 3 minutes" (never a bare "round 2")
    if (ROUND_WORDS.has(w)) {
      const d = durationAt(afterField(i));
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
      const k = afterField(i);
      const j = skip(k);
      if (OFF_WORDS.has(ws[j])) return { cmd: { type: 'set', field: 'delaySec', value: 0 }, end: j + 1 };
      const d = durationAt(k);
      if (d) return { cmd: { type: 'set', field: 'delaySec', value: d.sec }, end: d.end };
      const c = countAt(k);
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

  // Only lead words between `from` and `to`.
  const leadOnly = (from, to) => {
    for (let k = from; k < to; k++) {
      const w = ws[k];
      const prev = k > from ? ws[k - 1] : null;
      if (LEAD_WORDS.has(w)) continue;
      if (ARTICLES.has(w) && ARTICLE_LEADS.has(prev)) continue;
      if (w === 'up' && SET_WORDS.has(prev)) continue; // "set up a 2 minute timer"
      return false;
    }
    return true;
  };

  const commands = [];
  let anchor = 0; // where the previous command ended
  for (let i = 0; i < n;) {
    const match = matchAt(i);
    if (!match || (FINAL_ONLY.has(match.cmd.type) && !leadOnly(anchor, i))) {
      i += 1;
      continue;
    }
    const { cmd } = match;
    const key = ['timer', cmd.type, cmd.field, cmd.value ?? cmd.sec ?? cmd.query, cmd.rounds, cmd.roundSec]
      .filter(v => v !== undefined)
      .join(':');
    commands.push({ ...cmd, domain: 'timer', key, final: FINAL_ONLY.has(cmd.type), pos: toks[i].pos });
    i = Math.max(match.end, i + 1);
    anchor = i;
  }
  return commands;
}
