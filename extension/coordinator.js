import { resolveLocale, translate } from "./i18n.js";
import { LS_KEY, LS_SETTINGS_KEY } from "./lib/constants.js";
import { normalizeSettings, normalizeSites, validateSiteRecords, validSettingsRecord } from "./lib/sites.js";
import { applyStateCommand } from "./lib/operations.js";
import { findMatchingRule, isActiveRule, matchesRule } from "./lib/rules.js";

export const META_KEY = "cooldown_coordinator_v1";
const ALARM_PREFIX = "cooldown:";
const alarmName = item => `${ALARM_PREFIX}${encodeURIComponent(item.id)}:${item.endAt}`;
const completionKey = item => `${item.id}:${item.endAt}`;

export function createCoordinator(api, { now = () => Date.now() } = {}) {
  let tail = Promise.resolve();
  const allowedTabs = new Map();
  const pendingRedirects = new Map();
  function enqueue(operation) {
    const result = tail.catch(() => {}).then(operation);
    tail = result;
    return result;
  }
  async function read() {
    const raw = await api.storage.local.get([LS_KEY, LS_SETTINGS_KEY, META_KEY]);
    const items = raw[LS_KEY] === undefined ? [] : raw[LS_KEY];
    const settings = raw[LS_SETTINGS_KEY] === undefined ? {} : raw[LS_SETTINGS_KEY];
    if (validateSiteRecords(items) || !validSettingsRecord(settings)) throw new Error("storageLoadError");
    const meta = raw[META_KEY] === undefined ? {} : raw[META_KEY];
    if (!meta || typeof meta !== "object" || Array.isArray(meta) ||
        (meta.revision !== undefined && (!Number.isSafeInteger(meta.revision) || meta.revision < 0)) ||
        ["completed", "requests"].some(key => meta[key] !== undefined && (!Array.isArray(meta[key]) || meta[key].some(value => typeof value !== "string"))) ||
        (meta.pending !== undefined && (!meta.pending || typeof meta.pending !== "object" || Array.isArray(meta.pending) || Object.values(meta.pending).some(item => validateSiteRecords([item]))))) {
      throw new Error("storageLoadError");
    }
    return {
      items: normalizeSites(items, { now: now(), preserveExpired: true }), settings: normalizeSettings(settings),
      meta: { revision: meta.revision ?? 0, completed: meta.completed ?? [], pending: meta.pending ?? {}, requests: meta.requests ?? [] },
    };
  }
  async function write(state) {
    state.meta.revision += 1;
    await api.storage.local.set({ [LS_KEY]: state.items, [LS_SETTINGS_KEY]: state.settings, [META_KEY]: state.meta });
  }
  async function finishDue(state) {
    if (!state.settings.privacyAccepted) return;
    let changed = false;
    state.items = state.items.map(item => {
      if (item.mode === "always" || !Number.isFinite(item.endAt) || item.endAt > now()) return item;
      const key = completionKey(item);
      if (!state.meta.completed.includes(key)) {
        state.meta.completed.push(key);
        if (state.settings.notificationsOn) state.meta.pending[key] = item;
      }
      changed = true;
      return { ...item, endAt: null, updatedAt: now() };
    });
    if (changed) {
      state.meta.completed = state.meta.completed.slice(-500);
      await write(state);
    }
    for (const [key, item] of Object.entries(state.meta.pending)) {
      if (state.settings.privacyAccepted && state.settings.notificationsOn) {
        const locale = resolveLocale(state.settings.language);
        // Replaying an interrupted delivery updates this same notification ID.
        try {
          await api.notifications.create(`cooldown-ready:${key}`, {
            type: "basic", iconUrl: api.runtime.getURL("icons/icon128.png"),
            title: translate(locale, "notificationTitle", { name: item.label || new URL(item.url).hostname }),
            message: translate(locale, "notificationBody"), priority: 1,
          });
        } catch { continue; }
      }
      delete state.meta.pending[key];
      await write(state);
    }
  }
  async function syncAlarms(state) {
    const wanted = new Map(state.settings.privacyAccepted ? state.items.filter(item => item.mode !== "always" && item.endAt > now()).map(item => [alarmName(item), item.endAt]) : []);
    const existing = await api.alarms.getAll();
    for (const alarm of existing) if (alarm.name.startsWith(ALARM_PREFIX) && !wanted.has(alarm.name)) await api.alarms.clear(alarm.name);
    for (const [name, when] of wanted) if (!existing.some(alarm => alarm.name === name && alarm.scheduledTime === when)) await api.alarms.create(name, { when });
    if (!state.settings.privacyAccepted) allowedTabs.clear();
  }
  function isAllowed(tabId, url) {
    const allowance = allowedTabs.get(tabId);
    if (!allowance) return false;
    if (allowance.expiresAt <= now()) { allowedTabs.delete(tabId); return false; }
    return matchesRule(allowance.site, url);
  }
  async function redirect(state, tabId, target) {
    if (!state.settings.privacyAccepted || isAllowed(tabId, target)) return;
    const rule = findMatchingRule(state.items, target, { activeOnly: true, now: now() });
    if (!rule) return;
    const params = new URLSearchParams({ ruleId: rule.id, target });
    const destination = api.runtime.getURL(`blocked.html?${params}`);
    if (pendingRedirects.get(tabId) === destination) return;
    pendingRedirects.set(tabId, destination);
    try { await api.tabs.update(tabId, { url: destination }); }
    catch (error) { pendingRedirects.delete(tabId); throw error; }
  }
  async function enforce(state) {
    if (!state.settings.privacyAccepted || !state.items.some(item => isActiveRule(item, now()))) return;
    const tabs = await api.tabs.query({});
    // Revocation can also arrive from a direct Chrome storage change.
    const latest = await read();
    for (const tab of tabs) if (typeof tab.id === "number" && /^https?:\/\//i.test(tab.url)) await redirect(latest, tab.id, tab.url);
  }
  async function reconcile() {
    const state = await read();
    await finishDue(state);
    await syncAlarms(state);
    await enforce(state);
    return state;
  }
  function mutate(command, requestId) {
    return enqueue(async () => {
      const state = await read();
      if (requestId && state.meta.requests.includes(requestId)) return state;
      const next = applyStateCommand(state, command, now());
      state.items = next.items; state.settings = next.settings;
      if (requestId) state.meta.requests = [...state.meta.requests, requestId].slice(-100);
      await write(state);
      // Once committed, a secondary API failure must not report a failed import.
      try {
        await finishDue(state);
        await syncAlarms(state);
        await enforce(state);
      } catch { return read(); }
      return state;
    });
  }
  async function open(siteId) {
    const state = await read();
    if (!state.settings.privacyAccepted) throw new Error("privacyRequired");
    const site = state.items.find(item => item.id === siteId);
    if (!site) throw new Error("siteMissing");
    const stamp = now();
    state.items = state.items.map(item => item.id === siteId ? { ...item, lastVisitedAt: stamp, endAt: item.mode === "always" ? null : stamp + item.durationMs, updatedAt: stamp } : item);
    await write(state);
    await syncAlarms(state);
    const tab = await api.tabs.create({ url: "about:blank", active: true });
    if (typeof tab.id !== "number") throw new Error("tabCreateError");
    allowedTabs.set(tab.id, { site, expiresAt: now() + 10_000 });
    try { await api.tabs.update(tab.id, { url: site.url }); }
    catch (error) { allowedTabs.delete(tab.id); throw error; }
    return state;
  }
  function register() {
    const safely = fn => (...args) => enqueue(() => fn(...args)).catch(() => {});
    api.runtime.onInstalled.addListener(safely(reconcile));
    api.runtime.onStartup.addListener(safely(reconcile));
    api.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes[LS_KEY] || changes[LS_SETTINGS_KEY])) return enqueue(reconcile).catch(() => {});
    });
    api.tabs.onRemoved.addListener(id => { allowedTabs.delete(id); pendingRedirects.delete(id); });
    const committed = details => { if (details.frameId === 0) pendingRedirects.delete(details.tabId); };
    api.webNavigation.onCommitted?.addListener(committed);
    api.webNavigation.onErrorOccurred?.addListener(committed);
    api.alarms.onAlarm.addListener(alarm => alarm.name.startsWith(ALARM_PREFIX) ? enqueue(reconcile).catch(() => {}) : undefined);
    const navigate = safely(async details => {
      if (details.frameId !== 0 || !/^https?:\/\//i.test(details.url)) return;
      const state = await read();
      if (!state.settings.privacyAccepted) return;
      await finishDue(state);
      await redirect(state, details.tabId, details.url);
    });
    api.webNavigation.onBeforeNavigate.addListener(navigate);
    api.webNavigation.onHistoryStateUpdated.addListener(navigate);
    api.webNavigation.onReferenceFragmentUpdated.addListener(navigate);
    api.runtime.onMessage.addListener((message, sender, respond) => {
      if (!["state-mutate", "state-read", "open-site"].includes(message?.type)) return undefined;
      // Only this extension's own pages can change its state.
      if (sender.id && sender.id !== api.runtime.id) return undefined;
      if (sender.url && !sender.url.startsWith(api.runtime.getURL(""))) return undefined;
      const operation = message.type === "state-mutate" ? mutate(message.command, message.requestId)
        : enqueue(message.type === "open-site" ? () => open(message.siteId) : reconcile);
      operation.then(state => respond({ ok: true, state })).catch(error => respond({ ok: false, error: error.message }));
      return true;
    });
  }
  return { register, mutate, read: () => enqueue(read), reconcile: () => enqueue(reconcile), idle: () => tail.catch(() => {}) };
}
