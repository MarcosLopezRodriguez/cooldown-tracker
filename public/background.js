const APP_URL = chrome.runtime.getURL("index.html");

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((tab) => tab.url === APP_URL);

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (typeof existingTab.windowId === "number") {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: APP_URL, active: true });
});
