export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeUrl(input) {
  try {
    const tentative = String(input || "").trim();
    if (!tentative) {
      return null;
    }

    const withProtocol = /^(https?:)?\/\//i.test(tentative) ? tentative : `https://${tentative}`;
    return new URL(withProtocol).toString();
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

  const host = value.includes("://") ? hostnameFromUrl(value) : value;
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
