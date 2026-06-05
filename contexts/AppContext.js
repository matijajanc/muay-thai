import { createContext, useContext } from 'react';

export const SessionContext = createContext(null);
export const FavoritesContext = createContext(null);
export const VoiceContext = createContext(null);

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
