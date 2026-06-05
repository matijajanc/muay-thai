import { useState, useRef, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Spoken-word → digit, including common mis-hearings of the speech recognizer.
const WORD_TO_NUM = {
  one: 1, won: 1,
  two: 2, to: 2, too: 2,
  three: 3, tree: 3,
  four: 4, for: 4, fore: 4,
  five: 5,
  six: 6, sex: 6,
  seven: 7,
  eight: 8, ate: 8,
  nine: 9,
  ten: 10,
};

const SESSION_SIZE = 10;
// Ignore a repeated match for the same slot within this window (interim results
// fire the same phrase several times).
const DEDUPE_MS = 2500;

// Extract a combo slot number (1–SESSION_SIZE) from a transcript, or null.
export function parseComboNumber(transcript) {
  if (!transcript) return null;
  const text = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  // Look for "combo" (optionally "number"), then a digit or number word.
  const match = text.match(/combo\s+(?:number\s+)?(\d{1,2}|[a-z]+)/);
  if (!match) return null;
  const token = match[1];
  let n = /^\d+$/.test(token) ? parseInt(token, 10) : WORD_TO_NUM[token];
  if (!n || n < 1 || n > SESSION_SIZE) return null;
  return n;
}

const START_OPTIONS = {
  lang: 'en-US',
  interimResults: true,
  continuous: true,
  maxAlternatives: 1,
  // Bias the recognizer toward the words we care about.
  contextualStrings: [
    'combo', 'combo one', 'combo two', 'combo three', 'combo four', 'combo five',
    'combo six', 'combo seven', 'combo eight', 'combo nine', 'combo ten',
  ],
};

// onCombo(slotIndex0Based) is called when a valid "combo N" is heard.
export function useVoiceCommands(onCombo) {
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [error, setError] = useState(null);

  // Refs so the long-lived event listeners always see current values.
  const shouldListenRef = useRef(false);
  const lastActedRef = useRef({ slot: null, at: 0 });
  const onComboRef = useRef(onCombo);
  onComboRef.current = onCombo;

  const startRecognition = () => {
    try {
      ExpoSpeechRecognitionModule.start(START_OPTIONS);
    } catch (e) {
      setError(String(e?.message ?? e));
      setListening(false);
      shouldListenRef.current = false;
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
    const n = parseComboNumber(transcript);
    if (!n) return;
    const now = Date.now();
    const { slot, at } = lastActedRef.current;
    if (slot === n && now - at < DEDUPE_MS) return; // swallow interim repeats
    lastActedRef.current = { slot: n, at: now };
    onComboRef.current?.(n - 1); // 1-based phrase → 0-based slot index
  });

  useSpeechRecognitionEvent('error', (event) => {
    // "no-speech" / "no-match" are expected during pauses — just restart.
    if (event?.error === 'no-speech' || event?.error === 'no-match') {
      return; // the "end" handler will restart
    }
    setError(`${event?.error}: ${event?.message ?? ''}`.trim());
  });

  const start = useCallback(async () => {
    setError(null);
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      setError('Microphone & speech permission denied');
      return;
    }
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

  return { listening, lastHeard, error, start, stop, toggle };
}
