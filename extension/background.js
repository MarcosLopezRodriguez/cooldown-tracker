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
  return {
    items: Array.isArray(values[ITEMS_KEY]) ? values[ITEMS_KEY] : [],
    settings: values[SETTINGS_KEY] && typeof values[SETTINGS_KEY] === "object" ? values[SETTINGS_KEY] : {},
  };
}

async function syncCooldownAlarms(items) {
  const activeItems = items.filter((item) => isTimedCooldown(item));
  const activeAlarmNames = new Set(activeItems.map(getAlarmName));
  const existingAlarms = await chrome.alarms.getAll();

  await Promise.all(
    existingAlarms
      .filter((alarm) => alarm.name.startsWith(ALARM_PREFIX) && !activeAlarmNames.has(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name)),
  );

  activeItems.forEach((item) => {
    chrome.alarms.create(getAlarmName(item), { when: item.endAt });
  });
}

async function syncStoredCooldownAlarms() {
  const { items } = await readState();
  await syncCooldownAlarms(items);
}

async function showReadyNotification(item, settings) {
  if (!settings.notificationsOn) {
    return;
  }

  await chrome.notifications.create(`cooldown-ready:${item.id}:${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("favicon.ico"),
    title: `Listo para visitar: ${item.label || new URL(item.url).hostname}`,
    message: "El cooldown ha terminado.",
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
  const params = new URLSearchParams({
    label: blockingItem.label || targetUrl.hostname,
    mode: blockingItem.mode === "always" ? "always" : "cooldown",
  });

  if (Number.isFinite(blockingItem.endAt)) {
    params.set("endAt", String(blockingItem.endAt));
  }

  await chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(`blocked.html?${params.toString()}`),
  });
}

async function enforceActiveCooldowns(items) {
  const activeItems = items.filter((item) => isActive(item));
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
  const { items } = await readState();
  const site = items.find((item) => item.id === siteId);
  if (!site) {
    throw new Error("El sitio ya no existe.");
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
  await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
  const tab = await chrome.tabs.create({ url: "about:blank", active: true });
  if (typeof tab.id !== "number") {
    throw new Error("No se pudo crear la pestaña.");
  }

  allowedTabs.set(tab.id, {
    expiresAt: Date.now() + 10_000,
    site,
  });

  try {
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

chrome.runtime.onInstalled.addListener(() => {
  void syncStoredCooldownAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  void syncStoredCooldownAlarms();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[ITEMS_KEY]) {
    const items = Array.isArray(changes[ITEMS_KEY].newValue) ? changes[ITEMS_KEY].newValue : [];
    void syncCooldownAlarms(items);
    void enforceActiveCooldowns(items);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  allowedTabs.delete(tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) {
    return;
  }

  void (async () => {
    const { items, settings } = await readState();
    const item = items.find((candidate) => getAlarmName(candidate) === alarm.name);
    if (!item || item.mode === "always" || !Number.isFinite(item.endAt)) {
      return;
    }

    const now = Date.now();
    const nextItems = items.map((candidate) =>
      candidate.id === item.id && candidate.endAt === item.endAt
        ? { ...candidate, endAt: null, updatedAt: now }
        : candidate,
    );

    await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
    await showReadyNotification(item, settings);
  })();
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  void (async () => {
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

    const { items } = await readState();
    const blockingItem = items.find((item) => isActive(item) && matchesScope(item, targetUrl));
    if (!blockingItem) {
      return;
    }

    await redirectBlockedTab(details.tabId, blockingItem, targetUrl);
  })();
});
