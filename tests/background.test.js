import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { resolveLocale, translate } from "../extension/i18n.js";

const source = (await readFile(new URL("../extension/background.js", import.meta.url), "utf8")).replace(/^import[^\n]+\n/, "");
const ITEMS = "cooldown_site_timers_v1", SETTINGS = "cooldown_settings_v1";
const rule = (overrides = {}) => ({ id: "test", url: "https://example.com/", scope: "domain", mode: "always", durationMs: 60_000, endAt: null, ...overrides });
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function harness(accepted = false, items = [rule()]) {
  const events = {}, calls = { query: [], update: [], create: [], alarm: [], clear: [], notify: [], write: [] };
  const data = { [ITEMS]: items, [SETTINGS]: { privacyAccepted: accepted, notificationsOn: true, language: "es" } };
  const event = name => ({ addListener(fn) { events[name] = fn; } });
  const alarms = new Map();
  const chrome = {
    runtime: { onMessage: event("message"), onInstalled: event("install"), onStartup: event("startup"), getURL: path => `chrome-extension://test/${path}` },
    storage: { local: {
      get: async () => structuredClone(data),
      set: async values => { calls.write.push(values); Object.assign(data, values); },
    }, onChanged: event("change") },
    tabs: { onRemoved: event("removed"), query: async options => { calls.query.push(options); return [{ id: 1, url: "https://example.com/path" }]; }, update: async (...args) => { calls.update.push(args); }, create: async options => { calls.create.push(options); return { id: 2 }; } },
    alarms: { onAlarm: event("alarm"), getAll: async () => Array.from(alarms, ([name]) => ({ name })), clear: async name => { calls.clear.push(name); alarms.delete(name); }, create: async (name, info) => { calls.alarm.push([name, info]); alarms.set(name, info); } },
    notifications: { create: async (...args) => calls.notify.push(args) },
    webNavigation: { onBeforeNavigate: event("navigate") },
  };
  vm.runInNewContext(source, { chrome, URL, URLSearchParams, Date, Map, Set, resolveLocale, translate });
  return { events, calls, data, chrome, alarms };
}
test("sin aceptación: instalación, arranque e importación no consultan ni redirigen pestañas", async () => {
  const h = harness(false, [rule(), rule({ id: "timer", mode: "cooldown", endAt: Date.now() + 60_000 })]);
  await h.events.install();
  await h.events.startup();
  await h.events.change({ [ITEMS]: { newValue: h.data[ITEMS] }, [SETTINGS]: { newValue: h.data[SETTINGS] } }, "local");
  h.events.navigate({ frameId: 0, tabId: 1, url: "https://example.com/" });
  const response = await new Promise(resolve => h.events.message({ type: "open-site", siteId: "test" }, {}, resolve));
  await flush();
  assert.equal(response.ok, false);
  for (const key of ["query", "update", "create", "alarm", "notify", "write"]) assert.equal(h.calls[key].length, 0, key);
});
test("una alarma recibida sin aceptación no modifica datos ni notifica", async () => {
  const endAt = Date.now() - 1000;
  const h = harness(false, [rule({ mode: "cooldown", endAt })]);
  h.events.alarm({ name: `cooldown:test:${endAt}` });
  await flush();
  assert.equal(h.calls.write.length, 0);
  assert.equal(h.calls.notify.length, 0);
  assert.equal(h.data[ITEMS][0].endAt, endAt);
});
test("activar programa alarmas y bloquea; revocar limpia solo las alarmas propias", async () => {
  const h = harness(true, [rule(), rule({ id: "timer", mode: "cooldown", endAt: Date.now() + 60_000 })]);
  await h.events.startup();
  assert.equal(h.calls.alarm.length, 1);
  assert.equal(h.calls.query.length, 1);
  assert.ok(h.calls.update[0][1].url.startsWith("chrome-extension://test/blocked.html?"));
  h.alarms.set("unrelated", {});
  h.data[SETTINGS].privacyAccepted = false;
  const count = h.calls.query.length;
  await h.events.change({ [SETTINGS]: { newValue: h.data[SETTINGS] } }, "local");
  assert.equal(h.calls.query.length, count);
  assert.deepEqual(Array.from(h.alarms.keys()), ["unrelated"]);
});
test("revocar durante la consulta de pestañas evita una redirección pendiente", async () => {
  const h = harness(true);
  h.chrome.tabs.query = async () => { h.data[SETTINGS].privacyAccepted = false; return [{ id: 1, url: "https://example.com/" }]; };
  await h.events.startup();
  assert.equal(h.calls.update.length, 0);
});
test("una lectura fallida en background no bloquea ni escribe", async () => {
  const h = harness(true);
  h.chrome.storage.local.get = async () => { throw new Error("storage unavailable"); };
  await h.events.startup();
  h.events.navigate({ frameId: 0, tabId: 1, url: "https://example.com/" });
  await flush();
  assert.equal(h.calls.query.length, 0);
  assert.equal(h.calls.update.length, 0);
  assert.equal(h.calls.write.length, 0);
});
test("activada: navegar bloquea, abrir desde la app concede paso y una alarma vencida avisa", async () => {
  const endAt = Date.now() - 1000;
  const h = harness(true, [rule(), rule({ id: "expired", mode: "cooldown", endAt })]);
  h.events.navigate({ frameId: 0, tabId: 1, url: "https://example.com/path" });
  await flush();
  assert.equal(h.calls.update.length, 1);
  const response = await new Promise(resolve => h.events.message({ type: "open-site", siteId: "test" }, {}, resolve));
  assert.equal(response.ok, true);
  assert.equal(h.calls.create.length, 1);
  assert.equal(h.calls.update.at(-1)[1].url, "https://example.com/");
  h.events.navigate({ frameId: 0, tabId: 2, url: "https://example.com/" });
  await flush();
  assert.equal(h.calls.update.length, 2);
  h.events.alarm({ name: `cooldown:expired:${endAt}` });
  await flush();
  assert.equal(h.data[ITEMS][1].endAt, null);
  assert.equal(h.calls.notify.length, 1);
});
