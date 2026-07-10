import { DEFAULT_SETTINGS, LS_KEY, LS_SETTINGS_KEY } from "./constants.js";
import { normalizeSettings, normalizeSites } from "./sites.js";
import { isExtensionContext } from "./utils.js";

function getExtensionStorage() {
  return isExtensionContext() ? globalThis.chrome?.storage?.local : null;
}

function readExtensionStorage(keys) {
  const storage = getExtensionStorage();
  if (!storage) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    storage.get(keys, (values) => {
      const error = globalThis.chrome?.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(values);
    });
  });
}

function writeExtensionStorage(values) {
  const storage = getExtensionStorage();
  if (!storage) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    storage.set(values, () => {
      const error = globalThis.chrome?.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(true);
    });
  });
}

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
  if (getExtensionStorage()) {
    return writeExtensionStorage({ [LS_KEY]: items });
  }

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
  if (getExtensionStorage()) {
    return writeExtensionStorage({ [LS_SETTINGS_KEY]: normalizeSettings(settings) });
  }

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

export function usesExtensionStorage() {
  return Boolean(getExtensionStorage());
}

export async function loadExtensionState(now = Date.now()) {
  const values = await readExtensionStorage([LS_KEY, LS_SETTINGS_KEY]);
  if (!values) {
    return null;
  }

  return {
    items: normalizeSites(values[LS_KEY], { now }),
    settings: normalizeSettings(values[LS_SETTINGS_KEY]),
  };
}

export function subscribeToExtensionState(onChange) {
  if (!getExtensionStorage() || !globalThis.chrome?.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes, areaName) => {
    if (areaName === "local" && (changes[LS_KEY] || changes[LS_SETTINGS_KEY])) {
      onChange();
    }
  };

  globalThis.chrome.storage.onChanged.addListener(listener);
  return () => globalThis.chrome.storage.onChanged.removeListener(listener);
}
