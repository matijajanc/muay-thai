import { useState, useEffect, useRef } from 'react';
import {
  BUILT_IN_PRESETS, DEFAULT_TIMER_SETTINGS, PRESET_FIELDS, PRESET_NAME_MAX, matchesPreset,
} from '../data/timerPresets';
import { loadJSON, saveJSON } from '../utils/storage';

const SETTINGS_KEY = '@muaythai_timer_settings';
const PRESETS_KEY = '@muaythai_timer_presets';
// How long a row changed by voice stays highlighted.
const FLASH_MS = 1500;

// A saved preset as read back from storage: rounds may be null (∞).
const isPreset = (p) =>
  !!p && typeof p.id === 'string' && typeof p.name === 'string'
  && PRESET_FIELDS.every(key => (key === 'rounds' && p[key] === null) || Number.isFinite(p[key]));

// Saved round-timer defaults and the user's own presets. Every change is saved
// to the device right away; there's no Save button for defaults.
export function useTimerSettings() {
  const [settings, setSettings] = useState(DEFAULT_TIMER_SETTINGS);
  const [customPresets, setCustomPresets] = useState([]);
  const [flashedField, setFlashedField] = useState(null);
  const flashTimerRef = useRef(null);
  // Nothing is saved until the stored values have loaded, so an early change
  // can't overwrite them with the defaults.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadJSON(SETTINGS_KEY), loadJSON(PRESETS_KEY)]).then(([saved, presets]) => {
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        setSettings({ ...DEFAULT_TIMER_SETTINGS, ...saved });
      }
      if (Array.isArray(presets)) setCustomPresets(presets.filter(isPreset));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveJSON(SETTINGS_KEY, settings);
  }, [settings, loaded]);

  useEffect(() => {
    if (loaded) saveJSON(PRESETS_KEY, customPresets);
  }, [customPresets, loaded]);

  const update = (patch) => setSettings(prev => ({ ...prev, ...patch }));

  const applyPreset = (preset) => {
    const patch = { presetId: preset.id };
    for (const key of PRESET_FIELDS) patch[key] = preset[key];
    update(patch);
  };

  // Saves the current rounds/round/rest under `name`; an existing saved preset
  // with the same name is overwritten.
  const savePreset = (name) => {
    const trimmed = name.trim().slice(0, PRESET_NAME_MAX);
    if (!trimmed) return null;
    const existing = customPresets.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    const preset = { id: existing?.id ?? `custom-${Date.now()}`, name: trimmed };
    for (const key of PRESET_FIELDS) preset[key] = settings[key];
    const next = existing
      ? customPresets.map(p => (p.id === existing.id ? preset : p))
      : [...customPresets, preset];
    setCustomPresets(next);
    update({ presetId: preset.id });
    return preset;
  };

  const deletePreset = (id) => setCustomPresets(prev => prev.filter(p => p.id !== id));

  // Highlight a setup row for a moment (voice edits).
  const flash = (field) => {
    clearTimeout(flashTimerRef.current);
    setFlashedField(field);
    flashTimerRef.current = setTimeout(() => setFlashedField(null), FLASH_MS);
  };
  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const presets = [...BUILT_IN_PRESETS, ...customPresets];
  // Editing any preset value turns the selection into "Custom" (null here).
  const selectedPreset =
    presets.find(p => p.id === settings.presetId && matchesPreset(p, settings)) ?? null;

  return {
    settings, presets, customPresets, selectedPreset, flashedField,
    update, applyPreset, savePreset, deletePreset, flash,
  };
}
