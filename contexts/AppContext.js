import { createContext, useContext, useEffect } from 'react';

export const SessionContext = createContext(null);
export const FavoritesContext = createContext(null);
export const VoiceContext = createContext(null);
// Round timer: run state, controls and saved settings (changes rarely).
export const TimerContext = createContext(null);
// Round timer: live position, updated every UI tick (see TimerTickProvider).
export const TimerTickContext = createContext(null);
// Training log (useHistory) and app preferences (usePrefs).
export const HistoryContext = createContext(null);
export const PrefsContext = createContext(null);

export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used within SessionContext.Provider');
  return ctx;
}

export function useFavoritesContext() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavoritesContext must be used within FavoritesContext.Provider');
  return ctx;
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoiceContext must be used within VoiceContext.Provider');
  return ctx;
}

export function useTimerContext() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimerContext must be used within TimerContext.Provider');
  return ctx;
}

export function useHistoryContext() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryContext must be used within HistoryContext.Provider');
  return ctx;
}

export function usePrefsContext() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefsContext must be used within PrefsContext.Provider');
  return ctx;
}

// { run, pos, paused } of the running timer (pos is null when idle). Pass fast=true
// while a dial or ring is on screen to tick every 100 ms instead of 250 ms.
export function useTimerTick(fast = false) {
  const ctx = useContext(TimerTickContext);
  if (!ctx) throw new Error('useTimerTick must be used within TimerTickProvider');
  const { requestFast } = ctx;
  useEffect(() => (fast ? requestFast() : undefined), [fast, requestFast]);
  return ctx;
}
