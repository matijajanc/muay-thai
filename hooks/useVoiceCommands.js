import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const SESSION_SIZE = 10;
// Safety net against the recognizer delivering the same phrase twice (e.g. once
// at the end of one segment and again at the start of the next).
const REPEAT_GUARD_MS = 1500;
// How long the "✓ combo 4" confirmation stays under the mic button.
const FEEDBACK_MS = 2500;
// Transient errors restart with exponential backoff; give up after this many in a row.
const MAX_ERROR_STREAK = 6;
const MAX_BACKOFF_MS = 4000;
const KEEP_AWAKE_TAG = 'voice-commands';

// Spoken-word → digit, including common mis-hearings of the recognizer. The short
// numbers (4, 9, 10) get mangled most, so they have the most spelling variants.
const WORD_TO_NUM = {
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
};

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

// Trigger: "combo" or near-misses starting with "com"/"kom", or "number".
const isTrigger = (word) => /^(com|kom)/.test(word) || word === 'number';

// Number words that are also how interim results spell the start of "favorite"
// ("combo for…"). As the last word of an interim result they're tentative.
const PREFIX_AMBIGUOUS = new Set(['for', 'far', 'fore', 'faux', 'foe']);

// Every command in a transcript, in spoken order. Each is
// { type: 'slot' | 'next' | 'previous' | 'favorite' | 'finish', slot?, key, tentative? }.
export function parseCommands(transcript) {
  if (!transcript) return [];
  const words = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const commands = [];
  for (let i = 0; i < words.length; i++) {
    const merged = mergedCommand(words[i]);
    if (merged) {
      commands.push(merged);
      continue;
    }
    if (!isTrigger(words[i])) continue;
    // Allow one filler word between trigger and command ("combo number 3").
    for (const j of [i + 1, i + 2]) {
      const cmd = wordToCommand(words[j]);
      if (cmd) {
        const tentative = j === words.length - 1 && PREFIX_AMBIGUOUS.has(words[j]);
        commands.push(tentative ? { ...cmd, tentative } : cmd);
        i = j;
        break;
      }
    }
  }
  return commands;
}

// Scan every alternative the recognizer offers, not just the top guess — the
// correct "combo N" is frequently the 2nd or 3rd alternative. Prefer the one
// that contains the most commands (earliest alternative wins ties).
function parseFromAlternatives(results) {
  if (!Array.isArray(results)) return [];
  let best = [];
  for (const alt of results) {
    const commands = parseCommands(alt?.transcript);
    if (commands.length > best.length) best = commands;
  }
  return best;
}

const START_OPTIONS = {
  lang: 'en-US',
  interimResults: true,
  continuous: true,
  // Return several alternatives so we can find "combo N" even when it isn't the
  // recognizer's top pick.
  maxAlternatives: 5,
  // Bias the recognizer toward the words we care about.
  contextualStrings: [
    'combo', 'combo one', 'combo two', 'combo three', 'combo four', 'combo five',
    'combo six', 'combo seven', 'combo eight', 'combo nine', 'combo ten',
    'combo next', 'combo back', 'combo previous', 'combo favorite', 'combo finish',
  ],
};

// Silence and our own abort() are expected — the "end" handler just restarts.
const BENIGN_ERRORS = new Set(['no-speech', 'speech-timeout', 'aborted']);
// Nothing a restart can fix.
const FATAL_ERRORS = new Set(['not-allowed']);
// The offline model isn't usable — worth one fallback to online recognition.
const ON_DEVICE_ERRORS = new Set(['language-not-supported', 'service-not-allowed']);

const EN_LOCALE = 'en-US';
// Google's on-device speech service (Android System Intelligence) — this is
// where the downloaded offline models actually live. The default recognizer on
// Samsung is often Samsung's own, which reports no Google offline locales.
const GOOGLE_ON_DEVICE = 'com.google.android.as';

// onCommand(command) is called for every recognized command and may return a
// short confirmation string to flash under the mic button.
export function useVoiceCommands(onCommand) {
  const [listening, setListening] = useState(false); // user wants the mic on
  const [lastHeard, setLastHeard] = useState('');
  const [error, setError] = useState(null);
  const [onDevice, setOnDevice] = useState(false); // offline recognition active?
  const [notice, setNotice] = useState(null);      // non-fatal status message
  const [feedback, setFeedback] = useState(null);  // confirmation of the last command

  // Refs so the long-lived event listeners always see current values.
  const shouldListenRef = useRef(false);
  const runningRef = useRef(false); // a recognition session is in flight
  const segmentRef = useRef([]); // command keys already acted on in this segment
  const lastFiredRef = useRef({ key: null, at: 0 });
  const errorStreakRef = useRef(0);
  const restartTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const onDeviceRef = useRef(false);
  const onDeviceServiceRef = useRef(undefined); // which service has the model
  const fellBackRef = useRef(false); // guard against on-device→online loop
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const startRecognition = () => {
    if (!shouldListenRef.current || runningRef.current) return;
    // The mic can't be used from the background; resume when the app returns.
    if (AppState.currentState !== 'active') return;
    try {
      const opts = {
        ...START_OPTIONS,
        requiresOnDeviceRecognition: onDeviceRef.current,
      };
      // Pin recognition to the service that actually holds the offline model.
      if (onDeviceRef.current && onDeviceServiceRef.current) {
        opts.androidRecognitionServicePackage = onDeviceServiceRef.current;
      }
      runningRef.current = true;
      segmentRef.current = [];
      ExpoSpeechRecognitionModule.start(opts);
    } catch (e) {
      runningRef.current = false;
      halt(String(e?.message ?? e));
    }
  };

  // Stop listening for good (user tap, or an error a restart can't fix).
  const halt = (errorMessage) => {
    shouldListenRef.current = false;
    clearTimeout(restartTimerRef.current);
    ExpoSpeechRecognitionModule.abort();
    setListening(false);
    setLastHeard('');
    if (errorMessage) setError(errorMessage);
  };

  const flash = (message) => {
    clearTimeout(feedbackTimerRef.current);
    setFeedback(message);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
  };

  const fire = (command) => {
    const now = Date.now();
    const last = lastFiredRef.current;
    if (last.key === command.key && now - last.at < REPEAT_GUARD_MS) return;
    lastFiredRef.current = { key: command.key, at: now };
    const message = onCommandRef.current?.(command);
    if (message) flash(message);
  };

  // Decide whether to use offline recognition. Look for the installed English
  // model under Google's on-device service first (then the default), because the
  // default recognizer on Samsung often can't see Google's offline models. Only
  // trigger a download if it's genuinely not installed anywhere we can see.
  const prepareOnDevice = async () => {
    try {
      if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) return false;

      for (const pkg of [GOOGLE_ON_DEVICE, undefined]) {
        const opts = pkg ? { androidRecognitionServicePackage: pkg } : undefined;
        const { installedLocales = [] } = await ExpoSpeechRecognitionModule
          .getSupportedLocales(opts)
          .catch(() => ({ installedLocales: [] }));
        if (installedLocales.some(l => l.toLowerCase().startsWith('en'))) {
          onDeviceServiceRef.current = pkg; // undefined = device default
          return true;
        }
      }

      // Genuinely not installed — trigger the one-time system download and use
      // online recognition in the meantime.
      onDeviceServiceRef.current = undefined;
      ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: EN_LOCALE })
        .catch(() => {});
      setNotice('Downloading offline voice model — using online recognition until it finishes.');
      return false;
    } catch {
      return false;
    }
  };

  useSpeechRecognitionEvent('start', () => {
    setError(null);
  });

  // Keep listening until the user explicitly stops: restart whenever the
  // recognizer ends on its own (Android ends sessions on a final result).
  // After errors, back off so a persistent failure doesn't spin.
  useSpeechRecognitionEvent('end', () => {
    runningRef.current = false;
    if (!shouldListenRef.current) return;
    const streak = errorStreakRef.current;
    if (streak === 0) {
      startRecognition();
      return;
    }
    const delay = Math.min(250 * 2 ** (streak - 1), MAX_BACKOFF_MS);
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(startRecognition, delay);
  });

  // Interim results repeat (and grow) as the phrase is spoken, and a continuous
  // session can hold several commands. Act on each command position in the
  // current segment once; a later revision of an earlier position only re-fires
  // if it became a different slot number ("combo to" → "combo seven"). A
  // tentative command waits for the next word or the final result.
  useSpeechRecognitionEvent('result', (event) => {
    if (!shouldListenRef.current) return;
    const transcript = event?.results?.[0]?.transcript;
    if (!transcript) return;
    errorStreakRef.current = 0;
    setLastHeard(transcript);

    const handled = segmentRef.current;
    parseFromAlternatives(event.results).forEach((command, i) => {
      if (command.tentative && !event.isFinal) return;
      if (i < handled.length && (handled[i] === command.key || command.type !== 'slot')) return;
      handled[i] = command.key;
      fire(command);
    });
    if (event.isFinal) segmentRef.current = [];
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event?.error;
    if (BENIGN_ERRORS.has(code)) {
      errorStreakRef.current = 0; // the recognizer works, it just heard nothing
      return; // the "end" handler will restart
    }
    if (FATAL_ERRORS.has(code)) {
      halt('Microphone & speech permission denied');
      return;
    }
    // Offline model not actually ready → fall back to online once, then the
    // "end" handler restarts using the online recognizer.
    if (ON_DEVICE_ERRORS.has(code) && onDeviceRef.current && !fellBackRef.current) {
      fellBackRef.current = true;
      onDeviceRef.current = false;
      setOnDevice(false);
      setNotice('Offline model not ready yet — using online recognition for now.');
      return;
    }
    const message = `${code}: ${event?.message ?? ''}`.trim();
    errorStreakRef.current += 1;
    if (errorStreakRef.current >= MAX_ERROR_STREAK) {
      halt(`Voice stopped — ${message}`);
      return;
    }
    setError(message);
  });

  // Pause while the app is in the background, pick up again when it's back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!shouldListenRef.current) return;
      if (state === 'active') startRecognition();
      else if (state === 'background') {
        clearTimeout(restartTimerRef.current);
        ExpoSpeechRecognitionModule.abort();
      }
    });
    return () => sub.remove();
  }, []);

  // A phone on a stand would otherwise dim and lock mid-session, which kills the mic.
  useEffect(() => {
    if (!listening) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [listening]);

  useEffect(() => () => {
    clearTimeout(restartTimerRef.current);
    clearTimeout(feedbackTimerRef.current);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    shouldListenRef.current = true;
    setListening(true);
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      halt('Microphone & speech permission denied');
      return;
    }
    fellBackRef.current = false;
    const useOnDevice = await prepareOnDevice();
    if (!shouldListenRef.current) return; // stopped while we were preparing
    onDeviceRef.current = useOnDevice;
    setOnDevice(useOnDevice);
    errorStreakRef.current = 0;
    lastFiredRef.current = { key: null, at: 0 };
    startRecognition();
  }, []);

  const stop = useCallback(() => halt(), []);

  const toggle = useCallback(() => {
    if (shouldListenRef.current) stop();
    else start();
  }, [start, stop]);

  return { listening, lastHeard, error, notice, feedback, onDevice, start, stop, toggle };
}
