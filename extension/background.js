import { resolveLocale, translate } from "./i18n.js";

const ITEMS_KEY = "cooldown_site_timers_v1";
const SETTINGS_KEY = "cooldown_settings_v1";
const ALARM_PREFIX = "cooldown:";
const allowedTabs = new Map();

function getAlarmName(item) {
  return `${ALARM_PREFIX}${encodeURIComponent(item.id)}:${item.endAt}`;
}

function isActive(item, now = Date.now()) {
  if (item?.mode === "always") {
    return true;
  }

  return Number.isFinite(item?.endAt) && item.endAt > now;
}

function isTimedCooldown(item, now = Date.now()) {
  return item?.mode !== "always" && Number.isFinite(item?.endAt) && item.endAt > now;
}

function matchesScope(item, targetUrl) {
  try {
    const savedUrl = new URL(item.url);
    if (item.scope === "exact") {
      return savedUrl.href === targetUrl.href;
    }

    return targetUrl.hostname === savedUrl.hostname || targetUrl.hostname.endsWith(`.${savedUrl.hostname}`);
  } catch {
    return false;
  }
}

async function readState() {
  const values = await chrome.storage.local.get([ITEMS_KEY, SETTINGS_KEY]);
  if ((values[ITEMS_KEY] !== undefined && !Array.isArray(values[ITEMS_KEY])) ||
      (values[SETTINGS_KEY] !== undefined && (!values[SETTINGS_KEY] || typeof values[SETTINGS_KEY] !== "object" || Array.isArray(values[SETTINGS_KEY])))) {
    throw new Error("Invalid stored data");
  }
  return {
    items: Array.isArray(values[ITEMS_KEY]) ? values[ITEMS_KEY] : [],
    settings: values[SETTINGS_KEY] && typeof values[SETTINGS_KEY] === "object" ? values[SETTINGS_KEY] : {},
  };
}

async function readActiveState() {
  const state = await readState();
  return state.settings.privacyAccepted === true ? state : null;
}

async function syncCooldownAlarms() {
  const state = await readActiveState();
  const activeItems = state ? state.items.filter((item) => isTimedCooldown(item)) : [];
  const activeAlarmNames = new Set(activeItems.map(getAlarmName));
  const existingAlarms = await chrome.alarms.getAll();

  await Promise.all(
    existingAlarms
      .filter((alarm) => alarm.name.startsWith(ALARM_PREFIX) && !activeAlarmNames.has(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name)),
  );

  // Consent can change while an asynchronous Chrome call is pending.
  const latest = await readActiveState();
  if (!latest) {
    allowedTabs.clear();
    const alarms = await chrome.alarms.getAll();
    await Promise.all(alarms.filter(alarm => alarm.name.startsWith(ALARM_PREFIX)).map(alarm => chrome.alarms.clear(alarm.name)));
    return;
  }
  for (const item of latest.items.filter(item => isTimedCooldown(item))) {
    await chrome.alarms.create(getAlarmName(item), { when: item.endAt });
  }
}

async function showReadyNotification(item) {
  const state = await readActiveState();
  if (!state?.settings.notificationsOn) {
    return;
  }

  const { settings } = state;
  const locale = resolveLocale(settings.language);
  const name = item.label || new URL(item.url).hostname;
  await chrome.notifications.create(`cooldown-ready:${item.id}:${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: translate(locale, "notificationTitle", { name }),
    message: translate(locale, "notificationBody"),
    priority: 1,
  });
}

function isAllowedNavigation(details, targetUrl) {
  const allowance = allowedTabs.get(details.tabId);
  if (!allowance) {
    return false;
  }

  if (allowance.expiresAt <= Date.now()) {
    allowedTabs.delete(details.tabId);
    return false;
  }

  return matchesScope(allowance.site, targetUrl);
}

async function redirectBlockedTab(tabId, blockingItem, targetUrl) {
  const latest = await readActiveState();
  const currentItem = latest?.items.find(item => item.id === blockingItem.id && isActive(item) && matchesScope(item, targetUrl));
  if (!currentItem) return;
  blockingItem = currentItem;
  const params = new URLSearchParams({
    label: blockingItem.label || targetUrl.hostname,
    mode: blockingItem.mode === "always" ? "always" : "cooldown",
    target: targetUrl.href,
  });

  if (Number.isFinite(blockingItem.endAt)) {
    params.set("endAt", String(blockingItem.endAt));
  }

  await chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(`blocked.html?${params.toString()}`),
  });
}

async function enforceActiveCooldowns() {
  const state = await readActiveState();
  if (!state) return;
  const activeItems = state.items.filter((item) => isActive(item));
  if (!activeItems.length) {
    return;
  }

  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (typeof tab.id !== "number" || !tab.url) {
        return;
      }

      let targetUrl;
      try {
        targetUrl = new URL(tab.url);
      } catch {
        return;
      }

      if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
        return;
      }

      if (isAllowedNavigation({ tabId: tab.id }, targetUrl)) {
        return;
      }

      const blockingItem = activeItems.find((item) => matchesScope(item, targetUrl));
      if (blockingItem) {
        await redirectBlockedTab(tab.id, blockingItem, targetUrl);
      }
    }),
  );
}

async function openSiteFromApp(siteId) {
  const { items, settings } = await readState();
  const locale = resolveLocale(settings.language);
  if (settings.privacyAccepted !== true) {
    throw new Error(translate(locale, "privacyRequired"));
  }

  const site = items.find((item) => item.id === siteId);
  if (!site) {
    throw new Error(translate(locale, "siteMissing"));
  }

  const now = Date.now();
  const nextItems = items.map((item) =>
    item.id === site.id
      ? {
          ...item,
          lastVisitedAt: now,
          endAt: item.mode === "always" ? null : now + item.durationMs,
          updatedAt: now,
        }
      : item,
  );

  const targetUrl = new URL(site.url).href;
  if (!await readActiveState()) throw new Error(translate(locale, "privacyRequired"));
  await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
  if (!await readActiveState()) throw new Error(translate(locale, "privacyRequired"));
  const tab = await chrome.tabs.create({ url: "about:blank", active: true });
  if (typeof tab.id !== "number") {
    throw new Error(translate(locale, "tabCreateError"));
  }

  allowedTabs.set(tab.id, {
    expiresAt: Date.now() + 10_000,
    site,
  });

  try {
    if (!await readActiveState()) throw new Error(translate(locale, "privacyRequired"));
    await chrome.tabs.update(tab.id, { url: targetUrl });
  } catch (error) {
    allowedTabs.delete(tab.id);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "open-site" || typeof message.siteId !== "string") {
    return undefined;
  }

  openSiteFromApp(message.siteId)
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});

// Serialize reconciliation so revocation also removes alarms from an older run.
let reconciliation = Promise.resolve();
function reconcileProtection() {
  reconciliation = reconciliation.catch(() => {}).then(async () => {
    await syncCooldownAlarms();
    await enforceActiveCooldowns();
  }).catch(() => {
    // A failed read must never enable blocking, create defaults or overwrite data.
    allowedTabs.clear();
  });
  return reconciliation;
}

chrome.runtime.onInstalled.addListener(reconcileProtection);
chrome.runtime.onStartup.addListener(reconcileProtection);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes[ITEMS_KEY] || changes[SETTINGS_KEY])) return reconcileProtection();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  allowedTabs.delete(tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) {
    return;
  }

  void (async () => {
    const state = await readActiveState();
    if (!state) return;
    const { items } = state;
    const item = items.find((candidate) => getAlarmName(candidate) === alarm.name);
    if (!item || item.mode === "always" || !Number.isFinite(item.endAt) || item.endAt > Date.now()) {
      return;
    }

    const now = Date.now();
    const nextItems = items.map((candidate) =>
      candidate.id === item.id && candidate.endAt === item.endAt
        ? { ...candidate, endAt: null, updatedAt: now }
        : candidate,
    );

    if (!await readActiveState()) return;
    await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
    await showReadyNotification(item);
  })().catch(() => {});
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  void (async () => {
    const state = await readActiveState();
    if (!state) return;
    const { items } = state;

    let targetUrl;
    try {
      targetUrl = new URL(details.url);
    } catch {
      return;
    }

    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      return;
    }

    if (isAllowedNavigation(details, targetUrl)) {
      return;
    }

    const blockingItem = items.find((item) => isActive(item) && matchesScope(item, targetUrl));
    if (!blockingItem) {
      return;
    }

    await redirectBlockedTab(details.tabId, blockingItem, targetUrl);
  })().catch(() => {});
});
