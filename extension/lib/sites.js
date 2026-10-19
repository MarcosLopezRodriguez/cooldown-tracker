import { DEFAULT_SETTINGS, EXPORT_SCHEMA_VERSION, MAX_IMPORT_BYTES, SITE_MODES } from "./constants.js";
import { asTimestamp, buildFaviconUrl, hostnameFromUrl, isExtensionContext, normalizeUrl, uid } from "./utils.js";
import { findDuplicateRules, ruleIdentity } from "./rules.js";

function normalizeDurationMs(value, fallback = DEFAULT_SETTINGS.defaultDurationMs) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(60_000, Math.round(parsed));
}

function normalizeScope(value) {
  if (value === "url" || value === "exact") {
    return "exact";
  }

  return "domain";
}

function normalizeMode(value) {
  return value === SITE_MODES.ALWAYS || value === "permanent" ? SITE_MODES.ALWAYS : SITE_MODES.COOLDOWN;
}

function sanitizeLabel(value, fallback) {
  const label = typeof value === "string" ? value.trim() : "";
  return label ? label.slice(0, 30) : fallback;
}

function normalizeLanguage(value) {
  return ["auto", "es", "en", "fr", "de", "it", "pl", "zh", "ru"].includes(value) ? value : "auto";
}

export function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    defaultDurationMs: normalizeDurationMs(source.defaultDurationMs, DEFAULT_SETTINGS.defaultDurationMs),
    notificationsOn:
      typeof source.notificationsOn === "boolean"
        ? source.notificationsOn
        : typeof source.notifications === "boolean"
          ? source.notifications
          : DEFAULT_SETTINGS.notificationsOn,
    soundOn:
      typeof source.soundOn === "boolean"
        ? source.soundOn
        : typeof source.sound === "boolean"
          ? source.sound
          : DEFAULT_SETTINGS.soundOn,
    privacyAccepted: source.privacyAccepted === true,
    language: normalizeLanguage(source.language),
  };
}

export function normalizeSite(input, options = {}) {
  const now = options.now ?? Date.now();
  const fallbackDurationMs = options.defaultDurationMs ?? DEFAULT_SETTINGS.defaultDurationMs;
  if (!input || typeof input !== "object") {
    return null;
  }

  const url = normalizeUrl(input.url);
  if (!url) {
    return null;
  }

  const host = hostnameFromUrl(url);
  const createdAt = asTimestamp(input.createdAt, now);
  let updatedAt = asTimestamp(input.updatedAt, createdAt);
  let lastVisitedAt = asTimestamp(input.lastVisitedAt, null);
  let endAt = asTimestamp(input.endAt, null);
  const durationMs = normalizeDurationMs(input.durationMs, fallbackDurationMs);
  const mode = normalizeMode(input.mode);

  if (mode === SITE_MODES.ALWAYS || (!options.preserveExpired && endAt !== null && endAt <= now)) {
    endAt = null;
  }

  if (endAt !== null && lastVisitedAt === null) {
    lastVisitedAt = Math.max(createdAt, endAt - durationMs);
  }

  if (updatedAt < createdAt) {
    updatedAt = createdAt;
  }

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : uid(),
    url,
    label: sanitizeLabel(input.label, host),
    scope: normalizeScope(input.scope),
    mode,
    durationMs,
    endAt,
    lastVisitedAt,
    createdAt,
    updatedAt,
    favicon:
      !isExtensionContext() && typeof input.favicon === "string" && input.favicon.trim()
        ? input.favicon
        : buildFaviconUrl(host),
  };
}

export function normalizeSites(items, options = {}) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => normalizeSite(item, options)).filter(Boolean);
}

export function validateSiteRecords(items) {
  if (!Array.isArray(items)) return { key: "invalidImportFormat" };
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    const invalid = { key: "invalidImportItem", row: index + 1 };
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.url !== "string" || !normalizeUrl(item.url)) return invalid;
    if (item.id !== undefined && (typeof item.id !== "string" || !item.id.trim())) return invalid;
    if (item.id && ids.has(item.id)) return { key: "duplicateImportId", row: index + 1 };
    if (item.id) ids.add(item.id);
    if (item.durationMs !== undefined && (!Number.isSafeInteger(item.durationMs) || item.durationMs <= 0 || item.durationMs > 8_640_000_000_000_000 - Date.now())) return invalid;
    if (item.mode !== undefined && !["always", "permanent", "cooldown"].includes(item.mode)) return invalid;
    if (item.scope !== undefined && !["domain", "exact", "url"].includes(item.scope)) return invalid;
    for (const key of ["createdAt", "updatedAt", "endAt", "lastVisitedAt"]) {
      if (item[key] !== undefined && item[key] !== null && (!Number.isSafeInteger(item[key]) || item[key] < 0 || item[key] > 8_640_000_000_000_000)) return invalid;
    }
  }
  return null;
}

export function validSettingsRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  for (const key of ["notificationsOn", "notifications", "soundOn", "sound", "privacyAccepted"]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean") return false;
  }
  if (input.defaultDurationMs !== undefined && (!Number.isSafeInteger(input.defaultDurationMs) || input.defaultDurationMs <= 0 || input.defaultDurationMs > 8_640_000_000_000_000 - Date.now())) return false;
  return input.language === undefined || ["auto", "es", "en", "fr", "de", "it", "pl", "zh", "ru"].includes(input.language);
}

export function buildExportPayload(items, settings, exportedAt = new Date().toISOString()) {
  const normalizedSettings = normalizeSettings(settings);
  // Consent belongs to this installation, never to a transferable backup.
  const portableSettings = { ...normalizedSettings };
  delete portableSettings.privacyAccepted;
  return {
    version: EXPORT_SCHEMA_VERSION,
    items: normalizeSites(items, {
      defaultDurationMs: normalizedSettings.defaultDurationMs,
    }),
    settings: portableSettings,
    exportedAt,
  };
}

export function parseImportPayload(text, options = {}) {
  const now = options.now ?? Date.now();
  const fallbackSettings = normalizeSettings(options.fallbackSettings);
  const translate = options.translate || ((key) => key);
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error(translate("fileTooLarge"));
  let rawPayload;

  try {
    rawPayload = JSON.parse(text);
  } catch {
    throw new Error(translate("invalidJson"));
  }

  const payload = Array.isArray(rawPayload) ? { version: 1, items: rawPayload } : rawPayload;
  if (!payload || typeof payload !== "object") {
    throw new Error(translate("invalidImportFormat"));
  }

  const version = Object.hasOwn(payload, "version") ? payload.version : 1;
  if (!Number.isInteger(version) || version < 1) throw new Error(translate("invalidImportFormat"));
  if (version > EXPORT_SCHEMA_VERSION) {
    throw new Error(translate("newerImportVersion"));
  }

  const hasItems = Object.hasOwn(payload, "items");
  if (hasItems) {
    const invalid = validateSiteRecords(payload.items);
    if (invalid) throw new Error(translate(invalid.key, { row: invalid.row }));
  }
  if (payload.settings !== undefined && !validSettingsRecord(payload.settings)) throw new Error(translate("invalidImportSettings"));
  const importedSettings = payload.settings;
  const settings = importedSettings ? normalizeSettings({
    ...fallbackSettings,
    ...importedSettings,
    notificationsOn: importedSettings.notificationsOn ?? importedSettings.notifications ?? fallbackSettings.notificationsOn,
    soundOn: importedSettings.soundOn ?? importedSettings.sound ?? fallbackSettings.soundOn,
    privacyAccepted: fallbackSettings.privacyAccepted,
  }) : null;
  const effectiveSettings = settings ?? fallbackSettings;
  const usedIds = new Set((payload.items ?? []).map(item => item.id).filter(Boolean));
  const preparedItems = payload.items?.map(item => {
    if (item.id) return item;
    const base = uid();
    let id = base;
    let suffix = 1;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return { ...item, id };
  });
  const items = normalizeSites(preparedItems, {
    now,
    defaultDurationMs: effectiveSettings.defaultDurationMs,
    preserveExpired: isExtensionContext(),
  });
  const duplicateRow = findDuplicateRules(items);
  if (duplicateRow) throw new Error(translate("duplicateImportRule", { row: duplicateRow }));

  if (!hasItems && (!importedSettings || !Object.keys(importedSettings).some(key => ["language", "soundOn", "sound", "notificationsOn", "notifications", "defaultDurationMs"].includes(key)))) {
    throw new Error(translate("noImportData"));
  }

  return {
    version,
    hasItems,
    items,
    settings,
    settingsPatch: importedSettings ? Object.fromEntries(Object.entries(settings).filter(([key]) =>
      key !== "privacyAccepted" && (Object.hasOwn(importedSettings, key) ||
        (key === "notificationsOn" && Object.hasOwn(importedSettings, "notifications")) ||
        (key === "soundOn" && Object.hasOwn(importedSettings, "sound"))),
    )) : null,
  };
}

export function upsertSite(items, draft, now = Date.now()) {
  const normalizedDraft = normalizeSite(
    {
      ...draft,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    },
    {
      now,
      defaultDurationMs: draft.durationMs,
    },
  );

  if (!normalizedDraft) {
    return items;
  }
  const previous = items.find(item => item.id === normalizedDraft.id);
  if ((!previous || ruleIdentity(previous) !== ruleIdentity(normalizedDraft)) && items.some(item => item.id !== normalizedDraft.id && ruleIdentity(item) === ruleIdentity(normalizedDraft))) {
    throw new Error("duplicateSite");
  }

  const exists = items.some((item) => item.id === normalizedDraft.id);
  if (!exists) {
    return [...items, normalizedDraft];
  }

  return items.map((item) => (item.id === normalizedDraft.id ? normalizedDraft : item));
}

export function removeSite(items, id) {
  return items.filter((item) => item.id !== id);
}

export function startCooldown(items, id, now = Date.now()) {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          mode: SITE_MODES.COOLDOWN,
          lastVisitedAt: now,
          endAt: now + item.durationMs,
          updatedAt: now,
        }
      : item,
  );
}

export function resetCooldown(items, id, now = Date.now()) {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          mode: SITE_MODES.COOLDOWN,
          lastVisitedAt: now,
          endAt: now + item.durationMs,
          updatedAt: now,
        }
      : item,
  );
}

export function setPermanentBlock(items, id, now = Date.now()) {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          mode: SITE_MODES.ALWAYS,
          endAt: null,
          updatedAt: now,
        }
      : item,
  );
}

export function clearCooldown(items, id, now = Date.now()) {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          mode: SITE_MODES.COOLDOWN,
          endAt: null,
          updatedAt: now,
        }
      : item,
  );
}

export function resolveExpiredCooldowns(items, now = Date.now()) {
  const completed = [];
  const nextItems = items.map((item) => {
    if (item.mode === SITE_MODES.ALWAYS || !item.endAt || item.endAt > now) {
      return item;
    }

    completed.push(item);
    return {
      ...item,
      endAt: null,
      updatedAt: now,
    };
  });

  return {
    items: completed.length ? nextItems : items,
    completed,
  };
}

export function getSiteView(item, now = Date.now()) {
  const host = hostnameFromUrl(item.url);
  const permanent = item.mode === SITE_MODES.ALWAYS;
  const remaining = permanent ? 0 : item.endAt ? Math.max(0, item.endAt - now) : 0;
  const ready = !permanent && (!item.endAt || item.endAt <= now);
  const total = item.durationMs;
  const elapsed =
    !permanent && item.endAt && item.lastVisitedAt ? Math.min(total, Math.max(0, now - item.lastVisitedAt)) : 0;
  const progress = permanent || ready ? 100 : Math.round((elapsed / total) * 100);

  return {
    host,
    remaining,
    permanent,
    ready,
    blocked: permanent || !ready,
    progress,
  };
}

export function getVisibleSites(items, options = {}) {
  const now = options.now ?? Date.now();
  const filter = options.filter ?? "all";
  const query = String(options.query ?? "")
    .trim()
    .toLowerCase();

  let visibleItems = items
    .map((item) => ({
      ...item,
      blocked: item.mode === SITE_MODES.ALWAYS || Boolean(item.endAt && item.endAt > now),
      remaining: item.endAt ? Math.max(0, item.endAt - now) : 0,
    }))
    .filter((item) => {
      if (filter === "active") {
        return item.blocked;
      }

      if (filter === "ready") {
        return !item.blocked;
      }

      return true;
    });

  if (query) {
    visibleItems = visibleItems.filter((item) => {
      const label = (item.label || "").toLowerCase();
      return label.includes(query) || item.url.toLowerCase().includes(query);
    });
  }

  visibleItems.sort((left, right) => {
    const leftActive = left.blocked ? 1 : 0;
    const rightActive = right.blocked ? 1 : 0;
    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    return left.remaining - right.remaining;
  });

  return visibleItems;
}
