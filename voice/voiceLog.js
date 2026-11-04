import { loadJSON, saveJSON, removeKey } from '../utils/storage';

// Settings → "Log voice commands": a text log of every phrase the recognizer
// heard and what it did, kept on the phone until it's sent from Settings, to
// tune recognition for real training conditions.

const LOG_KEY = '@muaythai_voice_log';
// Newest phrases kept. With ALT_CHARS this keeps the shared text well under
// Android's limit for text passed to another app.
export const MAX_LOG_LINES = 500;
const ALT_CHARS = 60;

const pad = (n) => String(n).padStart(2, '0');
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "--- 2026-10-29 15:21 mic on · offline (com.google.android.as) · android 36 · samsung SM-S938B · app 1.0.1 (6)"
// The app version says which grammar heard the phrases below it.
export function micOnLine(date, { onDevice, service, platform, os, device, app }) {
  const recognizer = onDevice ? `offline${service ? ` (${service})` : ''}` : 'online';
  return [
    `--- ${day(date)} ${clock(date).slice(0, 5)} mic on`, recognizer, `${platform} ${os}`, device,
    app && `app ${app}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// '15:21:58  "combo tree" | "combo three"  → Combo 3' — every alternative the
// recognizer offered, then what the app did with it.
export function phraseLine(date, { alts = [], did = [], note }) {
  const heard = [...new Set(alts.filter(Boolean))]
    .map(t => `"${t.length > ALT_CHARS ? `${t.slice(0, ALT_CHARS)}…` : t}"`)
    .join(' | ');
  let line = `${clock(date)}  ${heard || '(nothing)'}`;
  if (did.length) line += `  → ${did.join(', ')}`;
  if (note) line += `  (${note})`;
  return line;
}

export const errorLine = (date, code, message) =>
  `${clock(date)}  error ${code}${message ? `: ${message}` : ''}`;

let cache = null; // Promise of the log's lines, loaded on first use

const lines = () => {
  cache ??= loadJSON(LOG_KEY, []).then(saved => (Array.isArray(saved) ? saved : []));
  return cache;
};

export async function appendVoiceLog(line) {
  const log = await lines();
  log.push(line);
  if (log.length > MAX_LOG_LINES) log.splice(0, log.length - MAX_LOG_LINES);
  saveJSON(LOG_KEY, log);
}

export async function readVoiceLog() {
  return [...(await lines())];
}

export async function clearVoiceLog() {
  const log = await lines();
  log.length = 0;
  removeKey(LOG_KEY);
}

// Phrase lines only, not the "mic on" headers or errors.
export const phraseCount = (log) =>
  log.filter(line => !line.startsWith('---') && !/^\S+ {2}error /.test(line)).length;
