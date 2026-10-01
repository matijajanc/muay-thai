// "combo …" voice commands.
import { WORD_TO_NUM, words } from './numbers';

const SESSION_SIZE = 10;

// Non-numeric commands and their common mis-hearings.
const ACTION_WORDS = {
  next: 'next', nexts: 'next', necks: 'next', neck: 'next', nest: 'next', text: 'next',
  back: 'previous', previous: 'previous', prev: 'previous',
  favorite: 'favorite', favorites: 'favorite', favourite: 'favorite', favourites: 'favorite',
  favorit: 'favorite', favor: 'favorite', favour: 'favorite', fave: 'favorite', save: 'favorite',
  finish: 'finish', finished: 'finish', finnish: 'finish',
};

const slotCommand = (n) =>
  n >= 1 && n <= SESSION_SIZE ? { type: 'slot', slot: n, key: `slot:${n}` } : null;
const actionCommand = (type) => ({ type, key: type });

// A word that directly follows the trigger → command, or null.
function wordToCommand(word) {
  if (!word) return null;
  if (/^\d{1,2}$/.test(word)) return slotCommand(parseInt(word, 10));
  if (WORD_TO_NUM[word]) return slotCommand(WORD_TO_NUM[word]);
  if (ACTION_WORDS[word]) return actionCommand(ACTION_WORDS[word]);
  return null;
}

// Whole words the recognizer produces when "combo X" is said fast and collapses
// into a single token.
const MERGED_WORDS = {
  combine: slotCommand(9), combined: slotCommand(9), combines: slotCommand(9), // "combo nine"
  comborine: slotCommand(9),
  comba: slotCommand(8), // "combo eight" -> "comba(te)"
};
// "combo" + a command word (3+ chars) → the same command, e.g. "comboten", "combonext".
for (const word of [...Object.keys(WORD_TO_NUM), ...Object.keys(ACTION_WORDS)]) {
  if (word.length >= 3) MERGED_WORDS['combo' + word] = wordToCommand(word);
}

function mergedCommand(word) {
  if (MERGED_WORDS[word]) return MERGED_WORDS[word];
  const digits = word.match(/^combo(\d{1,2})$/); // "combo3"
  return digits ? slotCommand(parseInt(digits[1], 10)) : null;
}

// Everyday words that start like "combo". Songs and coaches say "come back",
// "come to me" and "coming for you" all the time, so these never trigger.
const NOT_TRIGGERS = new Set([
  'come', 'comes', 'coming', 'comin', 'comeback', 'comebacks', 'comedy', 'comic', 'comfort',
  'comfortable', 'command', 'comment', 'comments', 'commercial', 'commit', 'committed', 'common',
  'community', 'company', 'compare', 'compete', 'competition', 'complete', 'completely',
  'computer', 'kommen', 'komm',
]);

// Trigger: "combo" or a near-miss starting with "com"/"kom" that isn't an
// everyday word. ("number" only works after it: "combo number 3".)
const isTrigger = (word) => /^(com|kom)/.test(word) && !NOT_TRIGGERS.has(word);

// Number words that are also how interim results spell the start of "favorite"
// ("combo for…"). As the last word of an interim result they're tentative.
const PREFIX_AMBIGUOUS = new Set(['for', 'far', 'fore', 'faux', 'foe']);

// Every command in a transcript, in spoken order. Each is
// { type: 'slot' | 'next' | 'previous' | 'favorite' | 'finish', slot?, key, tentative?, pos },
// where pos is the index of its first word in words(transcript).
export function parseCommands(transcript) {
  const ws = words(transcript);
  const commands = [];
  for (let i = 0; i < ws.length; i++) {
    const merged = mergedCommand(ws[i]);
    if (merged) {
      commands.push({ ...merged, pos: i });
      continue;
    }
    if (!isTrigger(ws[i])) continue;
    // Allow one filler word between trigger and command ("combo number 3").
    for (const j of [i + 1, i + 2]) {
      const cmd = wordToCommand(ws[j]);
      if (cmd) {
        const tentative = j === ws.length - 1 && PREFIX_AMBIGUOUS.has(ws[j]);
        commands.push(tentative ? { ...cmd, tentative, pos: i } : { ...cmd, pos: i });
        i = j;
        break;
      }
    }
  }
  return commands;
}
