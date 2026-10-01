import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  buildSegments, buildCues, totalMsOf, positionAt, startClock, elapsedMs, pauseClock,
  resumeClock, seekClock, cueIndexAt, dueCues, openPiece, closePiece,
} from '../utils/roundTimer';
import { runLabel } from '../utils/timerLabels';
import { timerEntry } from '../utils/history';
import { matchesPreset } from '../data/timerPresets';
import { loadJSON, saveJSON, removeKey } from '../utils/storage';

const KEEP_AWAKE_TAG = 'round-timer';
// A run in progress is saved (kind, config and clock) so it survives the app
// being killed; the position is wall-clock time, so it comes back exactly where
// it is now. A run left paused longer than this is dropped instead.
const RUN_KEY = '@muaythai_timer_run';
const PAUSED_TTL_MS = 2 * 60 * 60 * 1000;

function buildRun(kind, config, presetName) {
  const frozen = Object.freeze({ ...config });
  const segments = buildSegments(frozen);
  return {
    kind,
    config: frozen,
    presetName,
    label: runLabel(kind, frozen, presetName),
    segments,
    cues: buildCues(segments, frozen, kind),
    totalMs: totalMsOf(segments),
    doneAt: null,
  };
}

const isNum = (v, min) => Number.isFinite(v) && v >= min;
// A saved run as read back from storage.
const isSavedRun = (s) =>
  !!s && (s.kind === 'workout' || s.kind === 'countdown') && !!s.config && !!s.clock
  && isNum(s.config.roundSec, 1) && isNum(s.config.restSec, 0) && isNum(s.config.delaySec, 0)
  && (s.config.rounds === null || (Number.isInteger(s.config.rounds) && s.config.rounds >= 1))
  && isNum(s.clock.startedAt, 0) && isNum(s.clock.pausedTotal, 0)
  && (s.clock.pausedAt === null || isNum(s.clock.pausedAt, 0));
// Saved activity pieces: all closed but the last, which is open while running.
const isSavedPieces = (pieces, paused) =>
  Array.isArray(pieces) && pieces.length > 0
  && pieces.every((p, i) => !!p && isNum(p.w0, 0) && isNum(p.e0, 0)
    && (i === pieces.length - 1 && !paused ? p.w1 === null : isNum(p.w1, p.w0)));

// Run state of the round timer. The UI derives the live position from `clock`
// (see TimerTickProvider); this hook only re-renders on status changes. Cues fire
// from a timeout aimed at the next cue, re-armed after each fire and on
// pause/resume, so bells stay tight regardless of the UI tick.
//
// Runs are logged through onLog(entry) (utils/history.js timerEntry): at the
// final bell, or when stopped early after enough round time.
//
// timerSettings: useTimerSettings(); cues: useTimerCues(); onLog: useHistory().upsert.
export function useRoundTimer(timerSettings, cues, onLog) {
  const [status, setStatus] = useState('idle'); // idle | running | paused | done
  const [run, setRun] = useState(null);
  const [clock, setClock] = useState(null);

  const runRef = useRef(null);
  const clockRef = useRef(null);
  const cueIndexRef = useRef(0);
  const cueTimerRef = useRef(null);
  const settingsRef = useRef(timerSettings);
  settingsRef.current = timerSettings;
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;
  // Activity of the current run (utils/roundTimer.js pieces), for the log.
  const piecesRef = useRef([]);

  // Saves the run in progress, or clears the saved one when there's none.
  const persist = () => {
    const r = runRef.current;
    const c = clockRef.current;
    if (r && c && !r.doneAt) {
      saveJSON(RUN_KEY, {
        kind: r.kind, config: r.config, presetName: r.presetName, clock: c, pieces: piecesRef.current,
      });
    } else {
      removeKey(RUN_KEY);
    }
  };

  const commitClock = (next) => {
    clockRef.current = next;
    setClock(next);
    persist();
  };

  // Closes the run's activity and logs it (completed, or stopped early).
  const logRun = (completed) => {
    const r = runRef.current;
    if (!r || r.doneAt) return;
    piecesRef.current = closePiece(piecesRef.current, Date.now(), r.totalMs);
    const entry = timerEntry(r, piecesRef.current, completed);
    if (entry) onLogRef.current?.(entry);
  };

  const finish = () => {
    clearTimeout(cueTimerRef.current);
    const r = runRef.current;
    if (r) {
      logRun(true);
      const done = { ...r, doneAt: Date.now() };
      runRef.current = done;
      setRun(done);
    }
    setStatus('done');
    persist();
  };

  // Fire whatever is due, then aim a timeout at the next cue (or the end).
  const schedule = () => {
    clearTimeout(cueTimerRef.current);
    const r = runRef.current;
    const c = clockRef.current;
    if (!r || !c || c.pausedAt != null || r.doneAt) return;
    const e = elapsedMs(c, Date.now());
    const { due, next } = dueCues(r.cues, cueIndexRef.current, e);
    cueIndexRef.current = next;
    due.forEach(cue => cuesRef.current.fire(cue));
    if (e >= r.totalMs) {
      finish();
      return;
    }
    const nextAt = next < r.cues.length ? Math.min(r.cues[next].atMs, r.totalMs) : r.totalMs;
    cueTimerRef.current = setTimeout(schedule, Math.max(0, nextAt - e));
  };
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  const launch = (kind, config, presetName) => {
    clearTimeout(cueTimerRef.current);
    cuesRef.current.stopSpeech();
    logRun(false); // a run still going is replaced
    const next = buildRun(kind, config, presetName);
    const now = Date.now();
    runRef.current = next;
    setRun(next);
    piecesRef.current = openPiece([], now, 0);
    commitClock(startClock(now));
    cueIndexRef.current = 0;
    setStatus('running');
    schedule();
  };

  // override: { kind: 'countdown', roundSec } — one-off single round;
  //           { kind: 'workout', rounds, roundSec } — that workout with saved rest/cues.
  // Without it, runs the saved settings. Saved settings are never changed.
  const start = useCallback((override) => {
    const { settings, presets, selectedPreset } = settingsRef.current;
    if (override?.kind === 'countdown') {
      launch('countdown', { ...settings, rounds: 1, roundSec: override.roundSec, restSec: 0 }, null);
      return;
    }
    const config = override
      ? { ...settings, rounds: override.rounds, roundSec: override.roundSec }
      : { ...settings };
    const preset = selectedPreset && matchesPreset(selectedPreset, config)
      ? selectedPreset
      : presets.find(p => matchesPreset(p, config));
    launch('workout', config, preset?.name ?? 'Custom');
  }, []);

  // "Again" on the done screen: the same run from the top.
  const again = useCallback(() => {
    const r = runRef.current;
    if (r) launch(r.kind, r.config, r.presetName);
  }, []);

  const pause = useCallback(() => {
    const c = clockRef.current;
    if (!c || c.pausedAt != null || runRef.current?.doneAt) return;
    clearTimeout(cueTimerRef.current);
    const now = Date.now();
    piecesRef.current = closePiece(piecesRef.current, now, runRef.current.totalMs);
    commitClock(pauseClock(c, now));
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    const c = clockRef.current;
    if (!c || c.pausedAt == null) return;
    const now = Date.now();
    piecesRef.current = openPiece(piecesRef.current, now, elapsedMs(c, now));
    commitClock(resumeClock(c, now));
    setStatus('running');
    scheduleRef.current();
  }, []);

  // Jump to `targetMs` elapsed. Cues at exactly the target (the next phase's
  // bell) still fire; the ones jumped over don't.
  const seek = (targetMs) => {
    const r = runRef.current;
    const c = clockRef.current;
    if (!r || !c || r.doneAt) return;
    const now = Date.now();
    const pieces = piecesRef.current;
    if (pieces.length > 0 && pieces[pieces.length - 1].w1 == null) {
      piecesRef.current = openPiece(closePiece(pieces, now, r.totalMs), now, targetMs);
    }
    commitClock(seekClock(c, now, targetMs));
    cueIndexRef.current = cueIndexAt(r.cues, targetMs);
    if (clockRef.current.pausedAt == null) scheduleRef.current();
  };

  // Ends the current phase now (lead-in, round or rest).
  const skip = useCallback(() => {
    const r = runRef.current;
    const c = clockRef.current;
    if (!r || !c || r.doneAt) return;
    const pos = positionAt(r.segments, elapsedMs(c, Date.now()));
    if (pos.done) return;
    const target = pos.segment.startMs + pos.segment.durMs;
    if (target >= r.totalMs && c.pausedAt != null) {
      // Skipping the last round while paused ends the run with its end cue.
      commitClock(resumeClock(c, Date.now()));
      setStatus('running');
    }
    seek(target);
  }, []);

  // Resets the current phase to its full length.
  const restartPhase = useCallback(() => {
    const r = runRef.current;
    const c = clockRef.current;
    if (!r || !c || r.doneAt) return;
    const pos = positionAt(r.segments, elapsedMs(c, Date.now()));
    if (!pos.done) seek(pos.segment.startMs);
  }, []);

  const stop = useCallback(() => {
    clearTimeout(cueTimerRef.current);
    cuesRef.current.stopSpeech();
    logRun(false);
    runRef.current = null;
    piecesRef.current = [];
    clockRef.current = null;
    setRun(null);
    setClock(null);
    setStatus('idle');
    persist();
  }, []);

  const dismissDone = useCallback(() => {
    if (runRef.current?.doneAt) stop();
  }, [stop]);

  // Bring back a run the app was killed in the middle of. Nothing to do if one
  // was started meanwhile, if it would have ended by now, or if it sat paused
  // for hours.
  useEffect(() => {
    loadJSON(RUN_KEY).then(saved => {
      if (runRef.current) return;
      const now = Date.now();
      if (!isSavedRun(saved)) {
        removeKey(RUN_KEY);
        return;
      }
      const name = typeof saved.presetName === 'string' ? saved.presetName : 'Custom';
      const r = buildRun(saved.kind, saved.config, saved.kind === 'countdown' ? null : name);
      const c = saved.clock;
      const e = elapsedMs(c, now);
      if (e >= r.totalMs || (c.pausedAt != null && now - c.pausedAt > PAUSED_TTL_MS)) {
        removeKey(RUN_KEY);
        return;
      }
      const paused = c.pausedAt != null;
      runRef.current = r;
      setRun(r);
      // Its activity so far, or (saved before logging existed) from now on.
      piecesRef.current = isSavedPieces(saved.pieces, paused)
        ? saved.pieces
        : paused ? [] : openPiece([], now, e);
      clockRef.current = c;
      setClock(c);
      // Cues already behind us stay silent.
      cueIndexRef.current = cueIndexAt(r.cues, e);
      setStatus(c.pausedAt != null ? 'paused' : 'running');
      if (c.pausedAt == null) scheduleRef.current();
    });
  }, []);

  // Timers don't run in the background: catch up (dropping stale cues) on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleRef.current();
    });
    return () => sub.remove();
  }, []);

  // The screen stays on while a run is going, paused included.
  const awake = status === 'running' || status === 'paused';
  useEffect(() => {
    if (!awake) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [awake]);

  useEffect(() => () => clearTimeout(cueTimerRef.current), []);

  return {
    status, run, clock, start, again, pause, resume, skip, restartPhase, stop, dismissDone,
  };
}
