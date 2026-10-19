import assert from "node:assert/strict";
import test from "node:test";
import { buildExportPayload, parseImportPayload } from "../src/lib/sites.js";
import { MAX_IMPORT_BYTES } from "../src/lib/constants.js";
import { normalizeUrl } from "../src/lib/utils.js";
import { createTranslator } from "../extension/i18n.js";

const site = { id: "a", url: "https://example.com/", durationMs: 60_000 };
const parse = (value, options) => parseImportPayload(JSON.stringify(value), options);

test("una fila inválida rechaza la copia completa sin descartar filas", () => {
  for (const invalid of [null, [], {}, { url: "javascript:alert(1)" }, { ...site, durationMs: -1 }, { ...site, endAt: "100" }, { ...site, scope: "unknown" }, { ...site, mode: "unknown" }]) {
    assert.throws(() => parse({ items: [{ ...site, id: "first" }, invalid] }), /invalidImportItem/);
  }
  assert.throws(() => parse({ items: {} }), /invalidImportFormat/);
});
test("los identificadores repetidos se rechazan con la fila en los ocho idiomas", () => {
  for (const locale of ["es", "en", "fr", "de", "it", "pl", "zh", "ru"]) {
    const t = createTranslator(locale);
    assert.throws(() => parse({ items: [site, site] }, { translate: t }), error => error.message === t("duplicateImportId", { row: 2 }));
  }
  assert.throws(() => parse({ items: [{ ...site, id: " " }] }), /invalidImportItem/);
  const result = parse([{ url: site.url }, { url: "other.test" }]);
  assert.equal(new Set(result.items.map(item => item.id)).size, 2);
});
test("las versiones 1 a 3 y el formato antiguo se aceptan; versiones incorrectas se rechazan", () => {
  for (const version of [1, 2, 3]) assert.equal(parse({ version, items: [site] }).version, version);
  for (const version of [null, 0, -1, 1.5, "3"]) assert.throws(() => parse({ version, items: [] }), /invalidImportFormat/);
  assert.throws(() => parse({ version: 4, items: [] }), /newerImportVersion/);
  assert.equal(parse([site]).items.length, 1);
  assert.throws(() => parse({}), /noImportData/);
});
test("vaciar requiere una lista explícita; una copia de ajustes conserva la lista", () => {
  assert.equal(parse([]).hasItems, true);
  assert.equal(parse({ items: [] }).hasItems, true);
  const partial = parse({ settings: { sound: false } }, { fallbackSettings: { language: "es", notificationsOn: true } });
  assert.equal(partial.hasItems, false);
  assert.equal(partial.settings.language, "es");
  assert.equal(partial.settings.notificationsOn, true);
  assert.equal(partial.settings.soundOn, false);
});
test("ajustes mal tipados no reemplazan preferencias", () => {
  for (const settings of [null, [], { soundOn: "false" }, { language: "xx" }, { defaultDurationMs: 0 }, { privacyAccepted: 1 }]) {
    assert.throws(() => parse({ items: [site], settings }), /invalidImportSettings/);
  }
});
test("la aceptación es local: no se importa ni se exporta", () => {
  for (const local of [true, false]) for (const imported of [true, false]) {
    assert.equal(parse({ items: [site], settings: { privacyAccepted: imported } }, { fallbackSettings: { privacyAccepted: local } }).settings.privacyAccepted, local);
  }
  assert.equal(Object.hasOwn(buildExportPayload([site], { privacyAccepted: true }).settings, "privacyAccepted"), false);
  assert.throws(() => parse({ settings: { privacyAccepted: true } }), /noImportData/);
});
test("el límite de 2 MiB se mide en bytes UTF-8", () => {
  const base = JSON.stringify({ items: [], note: "" });
  const exact = base.replace('"note":""', `"note":"${"a".repeat(MAX_IMPORT_BYTES - Buffer.byteLength(base))}"`);
  assert.equal(Buffer.byteLength(exact), MAX_IMPORT_BYTES);
  assert.equal(parseImportPayload(exact).hasItems, true);
  assert.throws(() => parseImportPayload(`${exact} `), /fileTooLarge/);
  assert.throws(() => parse({ items: [], note: "ñ".repeat(MAX_IMPORT_BYTES / 2) }), /fileTooLarge/);
});
test("solo se admiten enlaces web sin credenciales", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/a", "chrome://settings", "https://user:secret@example.com/"]) assert.equal(normalizeUrl(url), null);
  assert.equal(normalizeUrl("localhost:8080/test"), "https://localhost:8080/test");
  assert.equal(normalizeUrl("//example.com/"), "https://example.com/");
});
