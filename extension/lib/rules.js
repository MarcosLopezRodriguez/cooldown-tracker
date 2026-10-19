import { normalizeUrl } from "./utils.js";

export function matchesRule(rule, target) {
  try {
    const saved = new URL(rule.url);
    const url = target instanceof URL ? target : new URL(target);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (rule.scope === "exact" || rule.scope === "url") return saved.href === url.href;
    // Domain rules intentionally cover all protocols and ports of this host.
    return url.hostname === saved.hostname || url.hostname.endsWith(`.${saved.hostname}`);
  } catch { return false; }
}

export function isActiveRule(rule, now = Date.now()) {
  return rule.mode === "always" || (Number.isFinite(rule.endAt) && rule.endAt > now);
}

export function findMatchingRule(items, target, { activeOnly = false, now = Date.now() } = {}) {
  return items.filter(rule => (!activeOnly || isActiveRule(rule, now)) && matchesRule(rule, target))
    .sort((a, b) => {
      const exact = Number(["exact", "url"].includes(b.scope)) - Number(["exact", "url"].includes(a.scope));
      if (exact) return exact;
      const specific = new URL(b.url).hostname.length - new URL(a.url).hostname.length;
      return specific || a.id.localeCompare(b.id);
    })[0] ?? null;
}

export function ruleIdentity(rule) {
  const url = new URL(normalizeUrl(rule.url));
  return rule.scope === "exact" || rule.scope === "url" ? `exact:${url.href}` : `domain:${url.hostname}`;
}

export function findDuplicateRules(items) {
  const identities = new Set();
  for (const [index, rule] of items.entries()) {
    const identity = ruleIdentity(rule);
    if (identities.has(identity)) return index + 1;
    identities.add(identity);
  }
  return null;
}
