const ITEMS_KEY = "cooldown_site_timers_v1";
const SETTINGS_KEY = "cooldown_settings_v1";
const ALARM_PREFIX = "cooldown:";
const pendingOpenUrls = new Map();
const allowedTabs = new Map();

function getAlarmName(item) {
  return `${ALARM_PREFIX}${encodeURIComponent(item.id)}:${item.endAt}`;
}

function isActive(item, now = Date.now()) {
  return Number.isFinite(item?.endAt) && item.endAt > now;
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
  const activeItems = items.filter((item) => isActive(item));
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

function allowNextNavigation(url) {
  const expiresAt = Date.now() + 10_000;
  pendingOpenUrls.set(url, expiresAt);
  return expiresAt;
}

function isAllowedNavigation(details, targetUrl) {
  const allowedUntil = allowedTabs.get(details.tabId);
  if (allowedUntil && allowedUntil > Date.now()) {
    return true;
  }

  if (allowedUntil) {
    allowedTabs.delete(details.tabId);
  }

  const pendingUntil = pendingOpenUrls.get(targetUrl.href);
  if (!pendingUntil) {
    return false;
  }

  pendingOpenUrls.delete(targetUrl.href);
  return pendingUntil > Date.now();
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
          endAt: now + item.durationMs,
          updatedAt: now,
        }
      : item,
  );

  const targetUrl = new URL(site.url).href;
  const expiresAt = allowNextNavigation(targetUrl);
  await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
  const tab = await chrome.tabs.create({ url: site.url, active: true });
  if (typeof tab.id === "number") {
    allowedTabs.set(tab.id, expiresAt);
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
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) {
    return;
  }

  void (async () => {
    const { items, settings } = await readState();
    const item = items.find((candidate) => getAlarmName(candidate) === alarm.name);
    if (!item || !Number.isFinite(item.endAt)) {
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

    const params = new URLSearchParams({
      label: blockingItem.label || targetUrl.hostname,
      endAt: String(blockingItem.endAt),
    });
    await chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL(`blocked.html?${params.toString()}`),
    });
  })();
});
