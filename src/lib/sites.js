import { DEFAULT_SETTINGS, EXPORT_SCHEMA_VERSION } from "./constants.js";
import { asTimestamp, buildFaviconUrl, hostnameFromUrl, normalizeUrl, uid } from "./utils.js";

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

function sanitizeLabel(value, fallback) {
  const label = typeof value === "string" ? value.trim() : "";
  return label ? label.slice(0, 30) : fallback;
}

export function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
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

  if (endAt !== null && endAt <= now) {
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
    durationMs,
    endAt,
    lastVisitedAt,
    createdAt,
    updatedAt,
    favicon:
      typeof input.favicon === "string" && input.favicon.trim() ? input.favicon : buildFaviconUrl(host),
  };
}

export function normalizeSites(items, options = {}) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => normalizeSite(item, options)).filter(Boolean);
}

export function buildExportPayload(items, settings, exportedAt = new Date().toISOString()) {
  const normalizedSettings = normalizeSettings(settings);
  return {
    version: EXPORT_SCHEMA_VERSION,
    items: normalizeSites(items, {
      defaultDurationMs: normalizedSettings.defaultDurationMs,
    }),
    settings: normalizedSettings,
    exportedAt,
  };
}

export function parseImportPayload(text, options = {}) {
  const now = options.now ?? Date.now();
  const fallbackSettings = normalizeSettings(options.fallbackSettings);
  let rawPayload;

  try {
    rawPayload = JSON.parse(text);
  } catch {
    throw new Error("El archivo no contiene JSON valido.");
  }

  const payload = Array.isArray(rawPayload) ? { version: 1, items: rawPayload } : rawPayload;
  if (!payload || typeof payload !== "object") {
    throw new Error("El archivo no tiene un formato importable.");
  }

  const settings = payload.settings ? normalizeSettings(payload.settings) : null;
  const effectiveSettings = settings ?? fallbackSettings;
  const items = normalizeSites(payload.items, {
    now,
    defaultDurationMs: effectiveSettings.defaultDurationMs,
  });

  if (!items.length && !settings) {
    throw new Error("No se encontraron sitios ni ajustes validos para importar.");
  }

  return {
    version: Number(payload.version) || 1,
    hasItems: Array.isArray(payload.items),
    items,
    settings,
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
          endAt: now + item.durationMs,
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
          endAt: null,
          updatedAt: now,
        }
      : item,
  );
}

export function resolveExpiredCooldowns(items, now = Date.now()) {
  const completed = [];
  const nextItems = items.map((item) => {
    if (!item.endAt || item.endAt > now) {
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
  const remaining = item.endAt ? Math.max(0, item.endAt - now) : 0;
  const ready = !item.endAt || item.endAt <= now;
  const total = item.durationMs;
  const elapsed =
    item.endAt && item.lastVisitedAt ? Math.min(total, Math.max(0, now - item.lastVisitedAt)) : 0;
  const progress = ready ? 100 : Math.round((elapsed / total) * 100);

  return {
    host,
    remaining,
    ready,
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
    .map((item) => ({ ...item, remaining: item.endAt ? Math.max(0, item.endAt - now) : 0 }))
    .filter((item) => {
      if (filter === "active") {
        return Boolean(item.endAt && item.endAt > now);
      }

      if (filter === "ready") {
        return !item.endAt || item.endAt <= now;
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
    const leftActive = left.endAt ? 1 : 0;
    const rightActive = right.endAt ? 1 : 0;
    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    return left.remaining - right.remaining;
  });

  return visibleItems;
}
