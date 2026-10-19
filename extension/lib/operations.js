import { normalizeSettings, normalizeSites, validateSiteRecords, validSettingsRecord } from "./sites.js";
import { findDuplicateRules, ruleIdentity } from "./rules.js";

const ITEM_FIELDS = ["url", "label", "scope", "mode", "durationMs", "endAt", "lastVisitedAt", "createdAt"];

export function mergeSiteEdit(items, original, draft) {
  if (!original) return draft;
  const current = items.find(item => item.id === original.id);
  if (!current) throw new Error("staleSite");
  const fields = ["url", "label", "scope", "mode", "durationMs"];
  return { ...current, ...Object.fromEntries(fields.filter(key => draft[key] !== original[key]).map(key => [key, draft[key]])) };
}

export function makeStatePatch(before, after, changed = { items: true, settings: true }) {
  const command = { kind: "patch", upserts: [], deletes: [], settings: {} };
  if (changed.items) {
    command.deletes = before.items.filter(item => !after.items.some(next => next.id === item.id)).map(item => item.id);
    for (const item of after.items) {
      const previous = before.items.find(old => old.id === item.id);
      const fields = Object.fromEntries(ITEM_FIELDS.filter(key => !previous || previous[key] !== item[key]).map(key => [key, item[key]]));
      if (Object.keys(fields).length) command.upserts.push({ id: item.id, create: !previous, fields });
    }
  }
  if (changed.settings) command.settings = Object.fromEntries(Object.entries(after.settings).filter(([key, value]) => before.settings[key] !== value));
  return command;
}

export function applyStateCommand(state, command, now = Date.now()) {
  let items = structuredClone(state.items);
  let settings = { ...state.settings };
  if (command.kind === "import") {
    if (command.hasItems) items = command.items;
    const portable = { ...command.settings };
    delete portable.privacyAccepted;
    settings = { ...settings, ...portable };
  } else if (command.kind === "patch") {
    const deletes = new Set(command.deletes ?? []);
    items = items.filter(item => !deletes.has(item.id));
    for (const change of command.upserts ?? []) {
      const index = items.findIndex(item => item.id === change.id);
      if (index < 0 && !change.create) throw new Error("staleSite");
      const fields = Object.fromEntries(Object.entries(change.fields ?? {}).filter(([key]) => ITEM_FIELDS.includes(key)));
      const next = { ...(index < 0 ? {} : items[index]), ...fields, id: change.id, updatedAt: now };
      // An edit from a stale form cannot resurrect an already completed timer.
      if (next.endAt !== null && next.endAt <= now) next.endAt = null;
      if (index < 0) items.push(next); else items[index] = next;
    }
    settings = { ...settings, ...command.settings };
  } else throw new Error("invalidOperation");
  const invalid = validateSiteRecords(items);
  if (invalid || !validSettingsRecord(settings)) throw new Error(invalid?.key ?? "invalidImportSettings");
  if (command.kind === "import" && command.hasItems && findDuplicateRules(items)) throw new Error("duplicateSite");
  if (command.kind === "patch") {
    const counts = values => values.reduce((map, item) => { const key = ruleIdentity(item); map.set(key, (map.get(key) ?? 0) + 1); return map; }, new Map());
    const before = counts(state.items), after = counts(items);
    if ([...after].some(([key, count]) => count > 1 && count > (before.get(key) ?? 0))) throw new Error("duplicateSite");
  }
  return { items: normalizeSites(items, { now, preserveExpired: true }), settings: normalizeSettings(settings) };
}
