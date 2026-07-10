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
    return Promise.resolve(false);
  }

  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items));
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function loadStoredSettings() {
  return normalizeSettings(readJson(LS_SETTINGS_KEY, DEFAULT_SETTINGS));
}

export function saveStoredSettings(settings) {
  if (typeof window === "undefined" || !window.localStorage) {
    return Promise.resolve(false);
  }

  try {
    window.localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

export function subscribeToStoredState(onChange) {
  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {};
  }

  const listener = (event) => {
    if (event.storageArea === window.localStorage && (event.key === LS_KEY || event.key === LS_SETTINGS_KEY)) {
      onChange({
        itemsChanged: event.key === LS_KEY,
        settingsChanged: event.key === LS_SETTINGS_KEY,
      });
    }
  };

  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
