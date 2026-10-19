import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { loadStoredState, saveStoredState, importStoredState, discardPendingRecovery, StorageReadError } from "../src/lib/storage.js";
import { LS_KEY, LS_SETTINGS_KEY } from "../src/lib/constants.js";

afterEach(() => { discardPendingRecovery(); delete globalThis.window; delete globalThis.chrome; delete globalThis.location; });
const original = { id: "original", url: "https://example.com/", durationMs: 60_000 };
function web(items = [original], settings = { language: "es" }) {
  const data = new Map([[LS_KEY, JSON.stringify(items)], [LS_SETTINGS_KEY, JSON.stringify(settings)]]);
  const writes = [];
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes.push(key); data.set(key, value); }, removeItem: key => data.delete(key) };
  globalThis.window = { localStorage: storage };
  return { data, writes, storage };
}
test("JSON corrupto conserva los dos originales exactos y no escribe defaults", async () => {
  const { data, writes } = web();
  data.set(LS_KEY, "{roto");
  await assert.rejects(loadStoredState(), error => {
    assert.ok(error instanceof StorageReadError);
    assert.equal(JSON.parse(error.backup).raw[LS_KEY], "{roto");
    assert.equal(JSON.parse(error.backup).raw[LS_SETTINGS_KEY], '{"language":"es"}');
    return true;
  });
  assert.deepEqual(writes, []);
  assert.equal(data.get(LS_KEY), "{roto");
});
test("null, formatos incorrectos y duplicados guardados se tratan como error de lectura", async () => {
  for (const value of [null, {}, [original, original], [{ url: "javascript:alert(1)" }]]) {
    const { writes } = web(value);
    await assert.rejects(loadStoredState(), StorageReadError);
    assert.deepEqual(writes, []);
  }
});
test("localStorage bloqueado da un error recuperable incluso si falla su getter", async () => {
  globalThis.window = Object.defineProperty({}, "localStorage", { get() { throw new Error("SecurityError"); } });
  await assert.rejects(loadStoredState(), StorageReadError);
  await assert.rejects(saveStoredState({ items: [], settings: {} }), /storageSaveError/);
});
test("un fallo parcial de guardado restaura ambas claves y permite reintentar", async () => {
  const { data, storage } = web();
  const before = new Map(data);
  const set = storage.setItem;
  let fail = true;
  storage.setItem = (key, value) => {
    if (key === LS_SETTINGS_KEY && fail) { fail = false; throw new Error("QuotaExceededError"); }
    set(key, value);
  };
  await assert.rejects(saveStoredState({ items: [], settings: { language: "en" } }), error => {
    assert.equal(JSON.parse(error.backup).raw[LS_KEY], before.get(LS_KEY));
    return true;
  });
  assert.deepEqual(data, before);
  assert.equal(await saveStoredState({ items: [], settings: { language: "en" } }), true);
  assert.deepEqual(JSON.parse(data.get(LS_KEY)), []);
});
test("chrome.storage con lastError no escribe defaults y se recupera tras reintentar", async () => {
  globalThis.location = { protocol: "chrome-extension:" };
  const writes = [];
  const runtime = { id: "test", sendMessage: (_message, callback) => callback({ ok: true, state: { items: [original], settings: { language: "es" } } }) };
  let failed = true;
  globalThis.chrome = { runtime, storage: { local: {
    get: (_keys, callback) => {
      if (failed) runtime.lastError = { message: "read failed" };
      callback({ [LS_KEY]: [original], [LS_SETTINGS_KEY]: { language: "es" } });
      delete runtime.lastError;
    },
    set: (values, callback) => { writes.push(values); callback(); },
  } } };
  await assert.rejects(loadStoredState(), StorageReadError);
  assert.equal(writes.length, 0);
  failed = false;
  assert.equal((await loadStoredState()).items[0].id, "original");
});
test("la importación se envía al coordinador después del autoguardado y no escribe snapshots", async () => {
  globalThis.location = { protocol: "chrome-extension:" };
  const calls = [];
  let release;
  globalThis.chrome = { runtime: { id: "test", sendMessage: (message, callback) => {
    calls.push(message); const ack = () => callback({ ok: true, state: { items: [], settings: { language: "en" } } });
    if (calls.length === 1) release = ack; else ack();
  } }, storage: { local: { set: () => { throw new Error("La interfaz no debe escribir directamente"); } } } };
  const first = saveStoredState({ items: [original], settings: { language: "es" } });
  const second = importStoredState({ items: [], settings: { language: "en" } }, { hasItems: true, items: [], settingsPatch: { language: "en" } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].type, "state-mutate");
  assert.equal(calls[1].command.kind, "import");
  assert.deepEqual(calls[1].command.items, []);
});
test("guardar solo ajustes conserva reglas actualizadas por el proceso de fondo", async () => {
  const { data } = web();
  const latest = [{ ...original, id: "newer-worker-rule" }];
  data.set(LS_KEY, JSON.stringify(latest));
  await saveStoredState({ items: [original], settings: { language: "en" } }, { settings: true });
  assert.deepEqual(JSON.parse(data.get(LS_KEY)), latest);
  assert.equal(JSON.parse(data.get(LS_SETTINGS_KEY)).language, "en");
});
