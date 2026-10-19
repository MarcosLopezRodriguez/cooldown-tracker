import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportPayload, clearCooldown, getSiteView, getVisibleSites, normalizeSettings,
  normalizeSite, parseImportPayload, removeSite, resetCooldown, resolveExpiredCooldowns,
  setPermanentBlock, startCooldown, upsertSite,
} from "../src/lib/sites.js";
import { formatClock, normalizeUrl } from "../src/lib/utils.js";
import { createTranslator, resolveLocale } from "../extension/i18n.js";

const now = 2_000_000;
const site = (overrides = {}) => normalizeSite({
  id: "example", url: "https://example.com/", durationMs: 60_000, createdAt: now, ...overrides,
}, { now });

test("las URLs válidas se normalizan y las vacías se rechazan", () => {
  assert.equal(normalizeUrl(" example.com/path "), "https://example.com/path");
  assert.equal(normalizeUrl(""), null);
  assert.equal(normalizeUrl("https://["), null);
});
test("las duraciones mantienen un mínimo de un minuto", () => {
  assert.equal(site({ durationMs: 1 }).durationMs, 60_000);
  assert.equal(site({ scope: "url" }).scope, "exact");
});
test("los ajustes antiguos se migran sin perder las preferencias", () => {
  const settings = normalizeSettings({ notifications: true, sound: false, language: "es" });
  assert.equal(settings.notificationsOn, true);
  assert.equal(settings.soundOn, false);
  assert.equal(settings.language, "es");
  assert.equal(settings.privacyAccepted, false);
});
test("añadir y editar conservan una única regla por identificador", () => {
  const added = upsertSite([], site(), now);
  const edited = upsertSite(added, { ...added[0], label: "Ejemplo" }, now + 1);
  assert.equal(edited.length, 1);
  assert.equal(edited[0].label, "Ejemplo");
  assert.equal(edited[0].createdAt, now);
  assert.equal(edited[0].updatedAt, now + 1);
  assert.deepEqual(removeSite(edited, "example"), []);
});
test("visitar, reiniciar y liberar actualizan el cooldown", () => {
  let items = startCooldown([site()], "example", now);
  assert.equal(items[0].endAt, now + 60_000);
  items = resetCooldown(items, "example", now + 10_000);
  assert.equal(items[0].endAt, now + 70_000);
  items = clearCooldown(items, "example", now + 20_000);
  assert.equal(items[0].endAt, null);
  assert.equal(getSiteView(items[0], now).ready, true);
});
test("el bloqueo permanente no caduca y puede liberarse", () => {
  const blocked = setPermanentBlock([site()], "example", now);
  assert.equal(getSiteView(blocked[0], now + 1_000_000).permanent, true);
  assert.equal(resolveExpiredCooldowns(blocked, now + 1_000_000).completed.length, 0);
  assert.equal(getSiteView(clearCooldown(blocked, "example")[0], now).ready, true);
});
test("la expiración se resuelve una sola vez por temporizador", () => {
  const active = startCooldown([site()], "example", now);
  const before = resolveExpiredCooldowns(active, now + 59_999);
  assert.equal(before.items, active);
  const after = resolveExpiredCooldowns(active, now + 60_000);
  assert.equal(after.completed.length, 1);
  assert.equal(after.items[0].endAt, null);
  assert.equal(resolveExpiredCooldowns(after.items, now + 61_000).completed.length, 0);
});
test("búsqueda y filtros distinguen reglas disponibles y bloqueadas", () => {
  const active = startCooldown([site()], "example", now);
  const items = [...active, site({ id: "other", url: "https://other.test/", label: "Libre" })];
  assert.deepEqual(getVisibleSites(items, { now, filter: "active" }).map((s) => s.id), ["example"]);
  assert.deepEqual(getVisibleSites(items, { now, filter: "ready" }).map((s) => s.id), ["other"]);
  assert.equal(getVisibleSites(items, { now, query: "LIBRE" }).length, 1);
});
test("exportar e importar conserva reglas, alcance y preferencias", () => {
  const items = [site({ scope: "exact", label: "Página exacta" }), site({ id: "permanent", mode: "always" })];
  const payload = buildExportPayload(items, { language: "pl", soundOn: false });
  const parsed = parseImportPayload(JSON.stringify(payload));
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].scope, "exact");
  assert.equal(parsed.items[1].mode, "always");
  assert.equal(parsed.settings.language, "pl");
  assert.equal(parsed.settings.soundOn, false);
});
test("la importación rechaza JSON inválido y esquemas futuros", () => {
  assert.throws(() => parseImportPayload("{"), /invalidJson/);
  assert.throws(() => parseImportPayload('{"version":999,"items":[]}'), /newerImportVersion/);
});
test("se pueden importar copias antiguas en formato array", () => {
  const parsed = parseImportPayload(JSON.stringify([site()]));
  assert.equal(parsed.version, 1);
  assert.equal(parsed.items.length, 1);
});
test("el reloj representa correctamente los límites y las horas", () => {
  assert.equal(formatClock(-1), "00:00:00");
  assert.equal(formatClock(3_661_000), "01:01:01");
});
test("los ocho idiomas resuelven textos e interpolaciones", () => {
  for (const locale of ["es", "en", "fr", "de", "it", "pl", "zh", "ru"]) {
    assert.equal(resolveLocale(locale), locale);
    const t = createTranslator(locale);
    assert.notEqual(t("newSite"), "newSite");
    assert.ok(t("notificationTitle", { name: "Ejemplo" }).includes("Ejemplo"));
  }
});
