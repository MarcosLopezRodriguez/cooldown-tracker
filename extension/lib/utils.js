export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isExtensionContext() {
  return Boolean(globalThis.chrome?.runtime?.id && globalThis.location?.protocol === "chrome-extension:");
}

export function normalizeUrl(input) {
  try {
    const tentative = String(input || "").trim();
    if (!tentative) {
      return null;
    }

    const withProtocol = tentative.startsWith("//")
      ? `https:${tentative}`
      : /^[a-z][a-z\d+.-]*:/i.test(tentative) && !/^[^/:]+:\d+(?:\/|$)/.test(tentative)
        ? tentative
        : `https://${tentative}`;
    const url = new URL(withProtocol);
    return ["http:", "https:"].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return String(url || "");
  }
}

export function formatClock(ms) {
  if (ms <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatMinutesLabel(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

export function clampMinutes(value, fallback = 1) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildFaviconUrl(value) {
  if (!value) {
    return null;
  }

  const pageUrl = value.includes("://") ? value : `https://${value}`;
  if (isExtensionContext() && globalThis.chrome?.runtime?.getURL) {
    const faviconUrl = new URL(globalThis.chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", pageUrl);
    faviconUrl.searchParams.set("size", "64");
    return faviconUrl.toString();
  }

  const host = hostnameFromUrl(pageUrl);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : null;
}

export function downloadJsonFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function asTimestamp(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
