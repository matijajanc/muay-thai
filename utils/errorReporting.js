import * as Sentry from '@sentry/react-native';

// Crash and error reports go to Sentry from release builds only: no personal
// data, no performance tracing, no replays (see docs/privacy.md). Sentry
// project: janclab/glove-mode (EU region, IP addresses not stored).
const SENTRY_DSN = 'https://0d022945bcab9e4aaacf237f3ab568a5@o4512062042603520.ingest.de.sentry.io/4512253755588688';

export function initErrorReporting() {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: !__DEV__,
    sendDefaultPii: false,
    // Errors only: no "app opened" session pings.
    enableAutoSessionTracking: false,
  });
}

// Voice recognition differs per phone and speech service, and its failures
// don't crash the app, so they're reported separately: each error code once
// per app run, with the recognizer setup it happened under.
const reportedVoiceErrors = new Set();

export function reportVoiceError(code, message, setup) {
  if (reportedVoiceErrors.has(code)) return;
  reportedVoiceErrors.add(code);
  Sentry.captureMessage(`Voice recognition error: ${code}`, {
    level: 'warning',
    tags: { voiceError: code, voiceOnDevice: String(!!setup?.onDevice) },
    extra: { message, service: setup?.service ?? 'default' },
  });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
export const wrapRoot = Sentry.wrap;
