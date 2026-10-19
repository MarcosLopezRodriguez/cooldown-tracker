import { createTranslator, resolveLocale } from "./i18n.js";
import { LS_KEY, LS_SETTINGS_KEY } from "./lib/constants.js";
import { findMatchingRule } from "./lib/rules.js";
import { normalizeUrl } from "./lib/utils.js";

const target = normalizeUrl(new URLSearchParams(location.search).get("target"));
const elements = Object.fromEntries(["eyebrow", "title", "description", "clock", "back-button", "manage-link"].map(id => [id, document.getElementById(id)]));
let current = null;
let request = 0;
const text = (id, value) => { if (elements[id].textContent !== value) elements[id].textContent = value; };

function render() {
  const locale = resolveLocale(current?.settings?.language);
  const t = createTranslator(locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  text("manage-link", t("manageBlock"));
  if (!current || !target) {
    text("eyebrow", t("storageLoadError"));
    text("title", "Cooldown Tracker");
    text("description", t("storageNotReady"));
    text("clock", "—");
    text("back-button", t("back"));
    return;
  }
  const rule = current.settings.privacyAccepted ? findMatchingRule(current.items, target, { activeOnly: true }) : null;
  if (!rule) {
    text("eyebrow", t("available"));
    text("title", t("cooldownFinished"));
    text("description", t("backToSite"));
    text("clock", "00:00:00");
    text("back-button", t("backToSite"));
    elements.clock.classList.remove("clock-label");
    return;
  }
  const permanent = rule.mode === "always";
  const label = rule.label || new URL(target).hostname;
  text("eyebrow", t(permanent ? "permanentBlock" : "cooldownActive"));
  text("title", t(permanent ? "permanentBlockedTitle" : "cooldownTitle", { name: label }));
  text("description", t(permanent ? "permanentBlockedDescription" : "cooldownBlockedDescription"));
  text("back-button", t("back"));
  elements.clock.classList.toggle("clock-label", permanent);
  const seconds = Math.max(0, Math.ceil((rule.endAt - Date.now()) / 1000));
  text("clock", permanent ? t("blockedLabel") : [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, "0")).join(":"));
}
async function refresh() {
  const version = ++request;
  try {
    const values = await chrome.storage.local.get([LS_KEY, LS_SETTINGS_KEY]);
    if (version !== request) return;
    if (!Array.isArray(values[LS_KEY]) || !values[LS_SETTINGS_KEY]) throw new Error("storageLoadError");
    current = { items: values[LS_KEY], settings: values[LS_SETTINGS_KEY] };
  } catch { if (version === request) current = null; }
  render();
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes[LS_KEY] || changes[LS_SETTINGS_KEY])) void refresh();
});
elements["back-button"].addEventListener("click", async () => {
  await refresh();
  const blocked = current?.settings.privacyAccepted && findMatchingRule(current.items, target, { activeOnly: true });
  if (target && current && !blocked) location.replace(target);
  else history.back();
});
await refresh();
window.setInterval(render, 1000);
