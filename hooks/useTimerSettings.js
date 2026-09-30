import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useRef } from 'react';
import {
  BUILT_IN_PRESETS, DEFAULT_TIMER_SETTINGS, PRESET_FIELDS, PRESET_NAME_MAX, matchesPreset,
} from '../data/timerPresets';

const SETTINGS_KEY = '@muaythai_timer_settings';
const PRESETS_KEY = '@muaythai_timer_presets';
// How long a row changed by voice stays highlighted.
const FLASH_MS = 1500;

// Saved round-timer defaults and the user's own presets. Every change is saved
// to the device right away; there's no Save button for defaults.
export function useTimerSettings() {
  const [settings, setSettings] = useState(DEFAULT_TIMER_SETTINGS);
  const [customPresets, setCustomPresets] = useState([]);
  const [flashedField, setFlashedField] = useState(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) setSettings({ ...DEFAULT_TIMER_SETTINGS, ...JSON.parse(raw) });
    });
    AsyncStorage.getItem(PRESETS_KEY).then(raw => {
      if (raw) setCustomPresets(JSON.parse(raw));
    });
  }, []);

  const update = (patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

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
    AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    update({ presetId: preset.id });
    return preset;
  };

  const deletePreset = (id) => {
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  };

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
