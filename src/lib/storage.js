import { DEFAULT_SETTINGS, normalizeSettings, normalizeSites } from "./sites";

const LS_KEY = "cooldown_site_timers_v1";
const LS_SETTINGS_KEY = "cooldown_settings_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return normalizeSites(items);
  } catch {
    return [];
  }
}

function saveState(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(normalizeSites(items)));
  } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
    return normalizeSettings(settings);
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {}
}

export { loadSettings, loadState, saveSettings, saveState };
