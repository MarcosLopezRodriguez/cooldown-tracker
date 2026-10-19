import { DEFAULT_SETTINGS, LS_KEY, LS_SETTINGS_KEY } from "./constants.js";
import { normalizeSettings, normalizeSites, validateSiteRecords, validSettingsRecord } from "./sites.js";
import { isExtensionContext } from "./utils.js";

function getExtensionStorage() {
  return isExtensionContext() ? globalThis.chrome?.storage?.local : null;
}

export class StorageReadError extends Error {
  constructor(cause, values, backend) {
    super("storageLoadError", { cause });
    this.name = "StorageReadError";
    this.backup = values ? JSON.stringify({ backend, raw: values }, null, 2) : null;
  }
}

function readExtensionStorage(keys) {
  const storage = getExtensionStorage();
  if (!storage) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    storage.get(keys, values => {
      const error = globalThis.chrome?.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(values);
    });
  });
}

function writeExtensionStorage(values) {
  const storage = getExtensionStorage();
  if (!storage) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    storage.set(values, () => {
      const error = globalThis.chrome?.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve(true);
    });
  });
}

function decodeState(values, now) {
  const items = values[LS_KEY] === undefined ? [] : values[LS_KEY];
  const settings = values[LS_SETTINGS_KEY] === undefined ? DEFAULT_SETTINGS : values[LS_SETTINGS_KEY];
  if (validateSiteRecords(items) || !validSettingsRecord(settings)) throw new Error("Invalid stored data");
  return { items: normalizeSites(items, { now }), settings: normalizeSettings(settings) };
}

function readWebState(now) {
  let raw;
  try {
    if (typeof window === "undefined") return decodeState({}, now);
    const storage = window.localStorage;
    raw = { [LS_KEY]: storage.getItem(LS_KEY), [LS_SETTINGS_KEY]: storage.getItem(LS_SETTINGS_KEY) };
    return decodeState(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value === null ? undefined : JSON.parse(value)])), now);
  } catch (error) {
    throw new StorageReadError(error, raw, "web");
  }
}

export function loadStoredItems(now = Date.now()) {
  return readWebState(now).items;
}

export function loadStoredSettings() {
  return readWebState(Date.now()).settings;
}

export async function loadExtensionState(now = Date.now()) {
  let values;
  try {
    values = await readExtensionStorage([LS_KEY, LS_SETTINGS_KEY]);
    return values ? decodeState(values, now) : null;
  } catch (error) {
    throw new StorageReadError(error, values, "extension");
  }
}

export async function loadStoredState(now = Date.now()) {
  return usesExtensionStorage() ? loadExtensionState(now) : readWebState(now);
}

function saveWebValues(values) {
  let storage;
  let previous;
  try {
    if (typeof window === "undefined") return false;
    storage = window.localStorage;
    previous = Object.fromEntries(Object.keys(values).map(key => [key, storage.getItem(key)]));
    for (const [key, value] of Object.entries(values)) storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (storage && previous) {
      // Restore both keys if an import fails partway through a write.
      for (const [key, value] of Object.entries(previous)) {
        try {
          if (value === null) storage.removeItem(key);
          else storage.setItem(key, value);
        } catch {
          // The exact original values remain available in the recovery download.
        }
      }
    }
    const failure = new Error("storageSaveError", { cause: error });
    failure.backup = previous ? JSON.stringify({ backend: "web", raw: previous }, null, 2) : null;
    throw failure;
  }
}

let pendingWrite = Promise.resolve();

export function saveStoredState({ items, settings }, changed = { items: true, settings: true }) {
  const values = structuredClone({
    ...(changed.items ? { [LS_KEY]: items } : {}),
    ...(changed.settings ? { [LS_SETTINGS_KEY]: normalizeSettings(settings) } : {}),
  });
  // An import must follow any autosave that was already in flight in this view.
  const operation = pendingWrite.catch(() => {}).then(() =>
    getExtensionStorage() ? writeExtensionStorage(values) : saveWebValues(values),
  );
  pendingWrite = operation;
  return operation;
}

export async function saveStoredItems(items) {
  return getExtensionStorage() ? writeExtensionStorage({ [LS_KEY]: items }) : saveWebValues({ [LS_KEY]: items });
}

export async function saveStoredSettings(settings) {
  const values = { [LS_SETTINGS_KEY]: normalizeSettings(settings) };
  return getExtensionStorage() ? writeExtensionStorage(values) : saveWebValues(values);
}

export function usesExtensionStorage() {
  return Boolean(getExtensionStorage());
}

export function subscribeToExtensionState(onChange) {
  if (!getExtensionStorage() || !globalThis.chrome?.storage?.onChanged) return () => {};
  const listener = (changes, areaName) => {
    if (areaName === "local" && (changes[LS_KEY] || changes[LS_SETTINGS_KEY])) onChange();
  };
  globalThis.chrome.storage.onChanged.addListener(listener);
  return () => globalThis.chrome.storage.onChanged.removeListener(listener);
}
