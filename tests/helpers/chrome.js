import { createCoordinator } from "../../extension/coordinator.js";
import { LS_KEY as ITEMS, LS_SETTINGS_KEY as SETTINGS } from "../../extension/lib/constants.js";

export const rule = (overrides = {}) => ({ id: "test", url: "https://example.com/", label: "Ejemplo", scope: "domain", mode: "always", durationMs: 60_000, endAt: null, ...overrides });
export function harness(accepted = false, items = [rule()]) {
  const events = {}, calls = { query: [], update: [], create: [], alarm: [], clear: [], notify: [], write: [] };
  const data = { [ITEMS]: structuredClone(items), [SETTINGS]: { privacyAccepted: accepted, notificationsOn: true, language: "es" } };
  const event = name => ({ addListener(fn) { events[name] = fn; } });
  const alarms = new Map(), notifications = new Map();
  let time = 2_000_000;
  const chrome = {
    runtime: { id: "test", onMessage: event("message"), onInstalled: event("install"), onStartup: event("startup"), getURL: path => `chrome-extension://test/${path}` },
    storage: { local: {
      get: async () => structuredClone(data),
      set: async values => { calls.write.push(structuredClone(values)); Object.assign(data, structuredClone(values)); },
    }, onChanged: event("change") },
    tabs: { onRemoved: event("removed"), query: async options => { calls.query.push(options); return [{ id: 1, url: "https://example.com/path" }]; }, update: async (...args) => { calls.update.push(args); }, create: async options => { calls.create.push(options); return { id: 2 }; } },
    alarms: { onAlarm: event("alarm"), getAll: async () => Array.from(alarms, ([name, info]) => ({ name, scheduledTime: info.when })), clear: async name => { calls.clear.push(name); alarms.delete(name); }, create: async (name, info) => { calls.alarm.push([name, info]); alarms.set(name, info); } },
    notifications: { create: async (id, options) => { calls.notify.push([id, options]); notifications.set(id, options); } },
    webNavigation: { onBeforeNavigate: event("navigate"), onHistoryStateUpdated: event("history"), onReferenceFragmentUpdated: event("fragment") },
  };
  const controller = createCoordinator(chrome, { now: () => time });
  controller.register();
  return { events, calls, data, chrome, alarms, notifications, controller, setTime: value => { time = value; }, message: message => new Promise(resolve => events.message(message, { id: "test", url: "chrome-extension://test/index.html" }, resolve)) };
}
