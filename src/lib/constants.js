export const LS_KEY = "cooldown_site_timers_v1";
export const LS_SETTINGS_KEY = "cooldown_settings_v1";
export const EXPORT_SCHEMA_VERSION = 3;

export const SITE_MODES = Object.freeze({
  COOLDOWN: "cooldown",
  ALWAYS: "always",
});

export const DEFAULT_SETTINGS = Object.freeze({
  defaultDurationMs: 30 * 60 * 1000,
  notificationsOn: false,
  soundOn: true,
  privacyAccepted: false,
  language: "auto",
});

export const FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Bloqueados" },
  { value: "ready", label: "Libres" },
];

export const DURATION_PRESETS = [5, 10, 15, 30, 60];
