import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'timetable_preferences';

interface Preferences {
  excludeHiddenDays: boolean;
  excludeTimeWindow: boolean;
}

interface PreferencesContextValue extends Preferences {
  setExcludeHiddenDays: (v: boolean) => void;
  setExcludeTimeWindow: (v: boolean) => void;
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      return {
        excludeHiddenDays: parsed.excludeHiddenDays ?? true,
        excludeTimeWindow: parsed.excludeTimeWindow ?? true,
      };
    }
  } catch { /* fall back to defaults */ }
  return { excludeHiddenDays: true, excludeTimeWindow: true };
}

function savePreferences(prefs: Preferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  const setExcludeHiddenDays = useCallback((v: boolean) => {
    setPrefs((prev) => { const next = { ...prev, excludeHiddenDays: v }; savePreferences(next); return next; });
  }, []);

  const setExcludeTimeWindow = useCallback((v: boolean) => {
    setPrefs((prev) => { const next = { ...prev, excludeTimeWindow: v }; savePreferences(next); return next; });
  }, []);

  return (
    <PreferencesContext.Provider value={{ ...prefs, setExcludeHiddenDays, setExcludeTimeWindow }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
