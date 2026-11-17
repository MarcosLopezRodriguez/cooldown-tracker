const KEY = "cooldown_web_completions_v1";

// Keep delivery history separate from portable backups: restoring a backup must
// not restore permission to notify again for the same finished timer.
export function createWebCompletionLedger(getStorage = () => globalThis.window?.localStorage) {
  const seen = new Set();
  return (item) => {
    const key = JSON.stringify([item.id, item.endAt]);
    let storage;
    try {
      storage = getStorage();
      const saved = JSON.parse(storage?.getItem(KEY) ?? "[]");
      if (Array.isArray(saved)) saved.filter(value => typeof value === "string").forEach(value => seen.add(value));
    } catch { /* Retain in-memory deduplication when storage is unavailable. */ }
    if (seen.has(key)) return false;
    seen.add(key);
    try { storage?.setItem(KEY, JSON.stringify([...seen])); } catch { /* In-memory fallback. */ }
    return true;
  };
}
