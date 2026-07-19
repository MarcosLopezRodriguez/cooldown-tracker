import { createTranslator, resolveLocale } from "./i18n.js";

const SETTINGS_KEY = "cooldown_settings_v1";
const storedValues = await chrome.storage.local.get(SETTINGS_KEY);
const locale = resolveLocale(storedValues[SETTINGS_KEY]?.language);
const t = createTranslator(locale);
const parameters = new URLSearchParams(window.location.search);
const eyebrow = document.querySelector("#eyebrow");
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const clock = document.querySelector("#clock");
const endAt = Number(parameters.get("endAt"));
const label = parameters.get("label") || "Cooldown Tracker";
const target = parameters.get("target");
const permanent = parameters.get("mode") === "always" || !Number.isFinite(endAt) || endAt <= 0;
const backButton = document.querySelector("#back-button");
let cooldownFinished = false;

document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
eyebrow.textContent = permanent ? t("permanentBlock") : t("cooldownActive");
title.textContent = permanent ? t("permanentBlockedTitle", { name: label }) : t("cooldownTitle", { name: label });
description.textContent = permanent ? t("permanentBlockedDescription") : t("cooldownBlockedDescription");
backButton.textContent = t("back");
document.querySelector("#manage-link").textContent = t("manageBlock");

if (permanent) {
  clock.textContent = t("blockedLabel");
  clock.classList.add("clock-label");
}

function updateClock() {
  if (permanent) {
    return;
  }

  const remaining = Math.max(0, endAt - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  clock.textContent = `${hours}:${minutes}:${seconds}`;

  if (remaining === 0) {
    cooldownFinished = true;
    description.textContent = t("cooldownFinished");
    backButton.textContent = t("backToSite");
  }
}

updateClock();
if (!permanent) {
  window.setInterval(updateClock, 1000);
}

backButton.addEventListener("click", () => {
  if (cooldownFinished && target) {
    window.location.replace(target);
    return;
  }

  window.history.back();
});
