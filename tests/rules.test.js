import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingRule, matchesRule } from "../extension/lib/rules.js";
import { normalizeSite, parseImportPayload, upsertSite } from "../src/lib/sites.js";

const domain = { id: "domain", scope: "domain", url: "https://example.com/", mode: "always" };
test("el dominio padre cubre subdominios, protocolos y puertos sin confundir sufijos", () => {
  for (const url of ["https://example.com/", "http://sub.example.com:8080/path", "https://deep.sub.example.com:8443/"]) assert.equal(matchesRule(domain, url), true);
  for (const url of ["https://notexample.com/", "https://example.com.evil.test/", "chrome-extension://example.com/"]) assert.equal(matchesRule(domain, url), false);
});
test("URL exacta distingue puerto, query, fragmento y protocolo; normaliza puerto por defecto", () => {
  const exact = { ...domain, scope: "exact", url: "https://example.com/path?q=1#one" };
  assert.equal(matchesRule(exact, "https://example.com:443/path?q=1#one"), true);
  for (const url of ["https://example.com:8443/path?q=1#one", "https://example.com/path?q=2#one", "https://example.com/path?q=1#two", "http://example.com/path?q=1#one"]) assert.equal(matchesRule(exact, url), false);
});
test("la precedencia es URL exacta y después dominio más específico entre reglas activas", () => {
  const child = { ...domain, id: "child", url: "https://sub.example.com/" };
  const exact = { ...child, id: "exact", scope: "exact", url: "https://sub.example.com/path" };
  assert.equal(findMatchingRule([domain, child, exact], exact.url).id, "exact");
  assert.equal(findMatchingRule([domain, child, { ...exact, scope: "url" }], exact.url).id, "exact");
  assert.equal(findMatchingRule([domain, child], exact.url).id, "child");
  assert.equal(findMatchingRule([domain, { ...exact, mode: "cooldown", endAt: null }], exact.url, { activeOnly: true }).id, "domain");
});
test("añadir, editar e importar rechazan duplicados semánticos", () => {
  const item = normalizeSite(domain);
  assert.throws(() => upsertSite([item], { ...domain, id: "new", url: "http://example.com:8080/elsewhere" }), /duplicateSite/);
  const other = normalizeSite({ ...domain, id: "other", url: "https://other.test/" });
  assert.throws(() => upsertSite([item, other], { ...other, url: domain.url }), /duplicateSite/);
  assert.throws(() => parseImportPayload(JSON.stringify({ items: [domain, { ...domain, id: "new", url: "http://example.com:8080/" }] })), /duplicateImportRule/);
});
test("leer un temporizador vencido en extensión conserva la información pendiente de finalizar", () => {
  const item = { ...domain, mode: "cooldown", endAt: 10 };
  assert.equal(normalizeSite(item, { now: 20, preserveExpired: true }).endAt, 10);
  assert.equal(normalizeSite(item, { now: 20 }).endAt, null);
});
