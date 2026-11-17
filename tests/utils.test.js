import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { clampMinutes, buildFaviconUrl } from "../src/lib/utils.js";

afterEach(() => { delete globalThis.chrome; delete globalThis.location; });
test("duraciones: enteros, decimales, cero y valores inválidos", () => {
  assert.equal(clampMinutes("12"), 12);
  assert.equal(clampMinutes(2.9), 2);
  for (const value of [null, undefined, "", "abc", -1, 0, Infinity]) assert.equal(clampMinutes(value, 7), 7);
});
test("favicons: URL válida, entradas inválidas y API local de la extensión", () => {
  assert.equal(buildFaviconUrl("example.com/path"), "https://www.google.com/s2/favicons?domain=example.com&sz=64");
  for (const value of [null, "", "https://[", "javascript:alert(1)", "https://user:pass@example.com"]) assert.equal(buildFaviconUrl(value), null);
  globalThis.location = { protocol: "chrome-extension:" };
  globalThis.chrome = { runtime: { id: "test", getURL: path => `chrome-extension://test${path}` } };
  const favicon = new URL(buildFaviconUrl("https://example.com/a?x=1&y=2"));
  assert.equal(favicon.protocol, "chrome-extension:");
  assert.equal(favicon.searchParams.get("pageUrl"), "https://example.com/a?x=1&y=2");
  assert.equal(favicon.searchParams.get("size"), "64");
});
