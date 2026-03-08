import { DEFAULT_SETTINGS, LS_KEY, LS_SETTINGS_KEY } from "./constants.js";
import { normalizeSettings, normalizeSites } from "./sites.js";

function readJson(key, fallback) {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

export function loadStoredItems(now = Date.now()) {
  return normalizeSites(readJson(LS_KEY, []), { now });
}

export function saveStoredItems(items) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // Ignore persistence failures.
  }
}

export function loadStoredSettings() {
  return normalizeSettings(readJson(LS_SETTINGS_KEY, DEFAULT_SETTINGS));
}

export function saveStoredSettings(settings) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // Ignore persistence failures.
  }
}
