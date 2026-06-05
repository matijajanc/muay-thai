import { useState, useRef, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const SESSION_SIZE = 10;
// Ignore a repeated match for the same slot within this window (interim results
// fire the same phrase several times).
const DEDUPE_MS = 2500;

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

// Whole words the recognizer produces when "combo N" is said fast and collapses
// into a single token. Map them straight to a slot number.
const MERGED_WORDS = {
  combine: 9, combined: 9, combines: 9, // "combo nine"
  comborine: 9,
  comba: 8, // "combo eight" -> "comba(te)"
};

// A leading number word (3+ chars) joined to the trigger: build "combo<word>"
// → number, e.g. "comboten", "combofour".
const triggerNumberWords = () => {
  const out = {};
  for (const [word, n] of Object.entries(WORD_TO_NUM)) {
    if (word.length >= 3) out['combo' + word] = n;
  }
  return out;
};
Object.assign(MERGED_WORDS, triggerNumberWords());

const NUM_TOKEN = Object.keys(WORD_TO_NUM).join('|');
// Trigger: "combo" or near-misses starting with "com"/"kom", optional "number",
// then (allowing one filler word) a digit or number word.
const COMBO_RE = new RegExp(
  `\\b(?:com\\w*|kom\\w*|number)\\s+(?:\\w+\\s+){0,1}(\\d{1,2}|${NUM_TOKEN})\\b`
);

// Extract a combo slot number (1–SESSION_SIZE) from a transcript, or null.
export function parseComboNumber(transcript) {
  if (!transcript) return null;
  const text = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  // 1) Merged single words ("combine" = combo nine, "comboten", ...).
  for (const [word, n] of Object.entries(MERGED_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return n;
  }

  // 2) Trigger word followed by a number.
  const match = text.match(COMBO_RE);
  if (!match) return null;
  const token = match[1];
  const n = /^\d+$/.test(token) ? parseInt(token, 10) : WORD_TO_NUM[token];
  if (!n || n < 1 || n > SESSION_SIZE) return null;
  return n;
}

// Scan every alternative the recognizer offers, not just the top guess — the
// correct "combo N" is frequently the 2nd or 3rd alternative.
function parseFromAlternatives(results) {
  if (!Array.isArray(results)) return null;
  for (const alt of results) {
    const n = parseComboNumber(alt?.transcript);
    if (n) return n;
  }
  return null;
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
  ],
};

// onCombo(slotIndex0Based) is called when a valid "combo N" is heard.
const EN_LOCALE = 'en-US';
// Google's on-device speech service (Android System Intelligence) — this is
// where the downloaded offline models actually live. The default recognizer on
// Samsung is often Samsung's own, which reports no Google offline locales.
const GOOGLE_ON_DEVICE = 'com.google.android.as';

export function useVoiceCommands(onCombo) {
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [error, setError] = useState(null);
  const [onDevice, setOnDevice] = useState(false); // offline recognition active?
  const [notice, setNotice] = useState(null);      // non-fatal status message

  // Refs so the long-lived event listeners always see current values.
  const shouldListenRef = useRef(false);
  const lastActedRef = useRef({ slot: null, at: 0 });
  const onDeviceRef = useRef(false);
  const onDeviceServiceRef = useRef(undefined); // which service has the model
  const fellBackRef = useRef(false); // guard against on-device→online loop
  const onComboRef = useRef(onCombo);
  onComboRef.current = onCombo;

  const startRecognition = () => {
    try {
      const opts = {
        ...START_OPTIONS,
        requiresOnDeviceRecognition: onDeviceRef.current,
      };
      // Pin recognition to the service that actually holds the offline model.
      if (onDeviceRef.current && onDeviceServiceRef.current) {
        opts.androidRecognitionServicePackage = onDeviceServiceRef.current;
      }
      ExpoSpeechRecognitionModule.start(opts);
    } catch (e) {
      setError(String(e?.message ?? e));
      setListening(false);
      shouldListenRef.current = false;
    }
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
    setListening(true);
    setError(null);
  });

  // Keep listening until the user explicitly stops: restart whenever the
  // recognizer ends on its own (Android ends sessions on a final result).
  useSpeechRecognitionEvent('end', () => {
    if (shouldListenRef.current) {
      startRecognition();
    } else {
      setListening(false);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event?.results?.[0]?.transcript;
    if (!transcript) return;
    setLastHeard(transcript);
    const n = parseFromAlternatives(event.results);
    if (!n) return;
    const now = Date.now();
    const { slot, at } = lastActedRef.current;
    if (slot === n && now - at < DEDUPE_MS) return; // swallow interim repeats
    lastActedRef.current = { slot: n, at: now };
    onComboRef.current?.(n - 1); // 1-based phrase → 0-based slot index
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event?.error;
    // "no-speech" / "no-match" are expected during pauses — just restart.
    if (code === 'no-speech' || code === 'no-match') {
      return; // the "end" handler will restart
    }
    // Offline model not actually ready → fall back to online once, then the
    // "end" handler restarts using the online recognizer.
    const onDeviceFailed =
      code === 'language-not-supported' ||
      code === 'language-unavailable' ||
      code === 'service-not-allowed';
    if (onDeviceRef.current && !fellBackRef.current && onDeviceFailed) {
      fellBackRef.current = true;
      onDeviceRef.current = false;
      setOnDevice(false);
      setNotice('Offline model not ready yet — using online recognition for now.');
      return;
    }
    setError(`${code}: ${event?.message ?? ''}`.trim());
  });

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      setError('Microphone & speech permission denied');
      return;
    }
    fellBackRef.current = false;
    const useOnDevice = await prepareOnDevice();
    onDeviceRef.current = useOnDevice;
    setOnDevice(useOnDevice);
    shouldListenRef.current = true;
    lastActedRef.current = { slot: null, at: 0 };
    startRecognition();
  }, []);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
    setLastHeard('');
  }, []);

  const toggle = useCallback(() => {
    if (shouldListenRef.current) stop();
    else start();
  }, [start, stop]);

  return { listening, lastHeard, error, notice, onDevice, start, stop, toggle };
}
