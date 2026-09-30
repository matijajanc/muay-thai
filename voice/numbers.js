// Spoken numbers and durations, shared by the combo and timer grammars.

// Spoken-word → number, including common mis-hearings of the recognizer. The
// short numbers (4, 9, 10) get mangled most, so they have the most spelling
// variants. Tens combine with a following digit word ("forty five").
export const WORD_TO_NUM = {
  zero: 0,
  one: 1, won: 1, want: 1,
  two: 2, to: 2, too: 2,
  three: 3, tree: 3, free: 3,
  four: 4, for: 4, fore: 4, faux: 4, foe: 4, far: 4,
  five: 5, hive: 5,
  six: 6, sex: 6, sicks: 6,
  seven: 7,
  eight: 8, ate: 8, ait: 8,
  nine: 9, nein: 9, non: 9, niner: 9,
  ten: 10, tan: 10, den: 10, then: 10, tin: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

// Mis-hearings that are also everyday words ("rest to 30 seconds"). They only
// count as a number where nothing else fits.
export const AMBIGUOUS_NUMBER_WORDS = new Set([
  'won', 'want', 'to', 'too', 'tree', 'free', 'for', 'fore', 'faux', 'foe', 'far', 'hive',
  'sex', 'sicks', 'ate', 'ait', 'nein', 'non', 'niner', 'tan', 'den', 'then', 'tin',
]);

const DIGIT_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};

// Transcript → lowercase words. "2:30" becomes "2 minutes 30 seconds", and
// punctuation (hyphens included) splits words.
export function words(transcript) {
  if (!transcript) return [];
  return transcript
    .toLowerCase()
    .replace(/(\d{1,2}):(\d{2})/g, '$1 minutes $2 seconds')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Number at ws[i]: digits, a number word, or tens + digit word.
// → { value, end } (end = index after it), or null.
export function parseNumber(ws, i) {
  const w = ws[i];
  if (w == null) return null;
  if (/^\d+$/.test(w)) return { value: parseInt(w, 10), end: i + 1 };
  const value = WORD_TO_NUM[w];
  if (value == null) return null;
  if (value >= 20 && value % 10 === 0 && DIGIT_WORDS[ws[i + 1]]) {
    return { value: value + DIGIT_WORDS[ws[i + 1]], end: i + 2 };
  }
  return { value, end: i + 1 };
}

const MINUTE_WORDS = new Set(['minute', 'minutes', 'min', 'mins', 'minit', 'minits', 'mini', 'minuets']);
const SECOND_WORDS = new Set(['second', 'seconds', 'sec', 'secs', 'seconde', 'segundos']);
export const isMinuteWord = (w) => MINUTE_WORDS.has(w);
export const isSecondWord = (w) => SECOND_WORDS.has(w);

// "and a half" at ws[i] → index after it, or -1.
const andAHalf = (ws, i) =>
  ws[i] === 'and' && (ws[i + 1] === 'a' || ws[i + 1] === 'an') && ws[i + 2] === 'half' ? i + 3 : -1;

// A duration with a unit at ws[i]. → { sec, end } or null.
// "2 minutes", "90 seconds", "2 minutes 30 (seconds)", "2 minute 30",
// "a minute", "a minute and a half", "2 and a half minutes", "half a minute".
export function parseDuration(ws, i) {
  // "half a minute" / "half minute"
  if (ws[i] === 'half') {
    const j = ws[i + 1] === 'a' || ws[i + 1] === 'an' ? i + 2 : i + 1;
    return isMinuteWord(ws[j]) ? { sec: 30, end: j + 1 } : null;
  }

  let num;
  if ((ws[i] === 'a' || ws[i] === 'an') && isMinuteWord(ws[i + 1])) num = { value: 1, end: i + 1 };
  else num = parseNumber(ws, i);
  if (!num) return null;
  let j = num.end;

  // "2 and a half minutes"
  const half = andAHalf(ws, j);
  if (half > 0 && isMinuteWord(ws[half])) return { sec: num.value * 60 + 30, end: half + 1 };

  if (isSecondWord(ws[j])) return { sec: num.value, end: j + 1 };
  if (!isMinuteWord(ws[j])) return null;

  let sec = num.value * 60;
  j += 1;
  // "... and a half"
  const halfAfter = andAHalf(ws, j);
  if (halfAfter > 0) return { sec: sec + 30, end: halfAfter };
  // "... (and) 30 (seconds)"; a bare everyday word ("to") only with "seconds".
  const k = ws[j] === 'and' ? j + 1 : j;
  const extra = parseNumber(ws, k);
  if (extra && extra.value < 60) {
    if (isSecondWord(ws[extra.end])) return { sec: sec + extra.value, end: extra.end + 1 };
    if (!AMBIGUOUS_NUMBER_WORDS.has(ws[k])) return { sec: sec + extra.value, end: extra.end };
  }
  return { sec, end: j };
}
