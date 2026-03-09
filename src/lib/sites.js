const EXPORT_SCHEMA_VERSION = 2;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUrl(input) {
  try {
    const tentative = input.trim();
    const withProto = /^(https?:)?\/\//i.test(tentative) ? tentative : `https://${tentative}`;
    const parsed = new URL(withProto);
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostnameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

function hhmmss(ms) {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const DEFAULT_SETTINGS = {
  defaultDurationMs: 30 * 60 * 1000,
  notificationsOn: true,
  soundOn: true,
};

function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const defaultDurationMs = Number.isFinite(source.defaultDurationMs) && source.defaultDurationMs >= 60000
    ? source.defaultDurationMs
    : DEFAULT_SETTINGS.defaultDurationMs;
  const notificationsOn = typeof source.notificationsOn === "boolean"
    ? source.notificationsOn
    : typeof source.notifications === "boolean"
      ? source.notifications
      : DEFAULT_SETTINGS.notificationsOn;
  const soundOn = typeof source.soundOn === "boolean"
    ? source.soundOn
    : typeof source.sound === "boolean"
      ? source.sound
      : DEFAULT_SETTINGS.soundOn;

  return {
    defaultDurationMs,
    notificationsOn,
    soundOn,
  };
}

function normalizeScope(scope) {
  if (scope === "domain") return "domain";
  if (scope === "exact" || scope === "url") return "exact";
  return "domain";
}

function normalizeSite(input) {
  if (!input || typeof input !== "object") return null;

  const normalizedUrl = normalizeUrl(input.url || "");
  if (!normalizedUrl) return null;

  const now = Date.now();
  const host = hostnameFromUrl(normalizedUrl);
  const createdAt = Number.isFinite(input.createdAt) ? input.createdAt : now;
  const updatedAt = Number.isFinite(input.updatedAt) ? input.updatedAt : createdAt;
  const durationMs = Number.isFinite(input.durationMs) && input.durationMs >= 60000
    ? input.durationMs
    : DEFAULT_SETTINGS.defaultDurationMs;
  const endAt = Number.isFinite(input.endAt) && input.endAt > 0 ? input.endAt : null;
  const lastVisitedAt = Number.isFinite(input.lastVisitedAt) && input.lastVisitedAt > 0
    ? input.lastVisitedAt
    : null;
  const favicon = typeof input.favicon === "string" && input.favicon.trim()
    ? input.favicon
    : `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : uid(),
    url: normalizedUrl,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : host,
    scope: normalizeScope(input.scope),
    durationMs,
    endAt,
    lastVisitedAt,
    createdAt,
    updatedAt,
    favicon,
  };
}

function normalizeSites(input) {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeSite).filter(Boolean);
}

function buildExportPayload(items, settings) {
  return {
    version: EXPORT_SCHEMA_VERSION,
    items: normalizeSites(items),
    settings: normalizeSettings(settings),
    exportedAt: new Date().toISOString(),
  };
}

function parseImportPayload(payload) {
  if (Array.isArray(payload)) {
    const items = normalizeSites(payload);
    if (items.length === 0) {
      throw new Error("No hay sitios validos para importar.");
    }

    return {
      version: 1,
      items,
      settings: null,
    };
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Formato de importacion no valido.");
  }

  const hasItems = Array.isArray(payload.items);
  const hasSettings = !!payload.settings && typeof payload.settings === "object";
  const items = normalizeSites(hasItems ? payload.items : []);
  const settings = hasSettings ? normalizeSettings(payload.settings) : null;

  if (hasItems && items.length === 0 && !hasSettings) {
    throw new Error("No hay sitios validos para importar.");
  }
  if (!hasItems && !hasSettings) {
    throw new Error("Formato de importacion no valido.");
  }

  return {
    version: Number.isFinite(payload.version) ? payload.version : 1,
    items,
    settings,
  };
}

function expireCooldowns(items, now) {
  let changed = false;
  const expired = [];
  const next = items.map((item) => {
    if (item.endAt && item.endAt <= now) {
      changed = true;
      expired.push(item);
      return { ...item, endAt: null, updatedAt: now };
    }
    return item;
  });

  return { changed, expired, next };
}

function deriveVisibleSites(items, { filter = "all", now = Date.now(), query = "" } = {}) {
  const term = query.trim().toLowerCase();
  let list = items.map((item) => ({
    ...item,
    remaining: item.endAt ? Math.max(0, item.endAt - now) : 0,
  }));

  if (filter === "active") {
    list = list.filter((item) => item.endAt && item.endAt > now);
  }
  if (filter === "ready") {
    list = list.filter((item) => !item.endAt);
  }
  if (term) {
    list = list.filter((item) => (
      (item.label && item.label.toLowerCase().includes(term)) ||
      item.url.toLowerCase().includes(term)
    ));
  }

  list.sort((a, b) => {
    const aActive = a.endAt ? 1 : 0;
    const bActive = b.endAt ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return (a.remaining || 0) - (b.remaining || 0);
  });

  return list;
}

export {
  DEFAULT_SETTINGS,
  EXPORT_SCHEMA_VERSION,
  buildExportPayload,
  deriveVisibleSites,
  download,
  expireCooldowns,
  hhmmss,
  hostnameFromUrl,
  normalizeScope,
  normalizeSettings,
  normalizeSite,
  normalizeSites,
  normalizeUrl,
  parseImportPayload,
  uid,
};
