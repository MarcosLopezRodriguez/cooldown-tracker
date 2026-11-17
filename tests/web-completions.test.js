import assert from "node:assert/strict";
import test from "node:test";
import { createWebCompletionLedger } from "../src/lib/web-completions.js";

test("avisos web: re-render, otra interfaz y restaurar una copia no repiten el mismo vencimiento", () => {
  let saved = null;
  const storage = { getItem: () => saved, setItem: (key, value) => { saved = value; } };
  const claim = createWebCompletionLedger(() => storage);
  const item = { id: "one", endAt: 123 };
  assert.equal(claim(item), true);
  assert.equal(claim({ ...item }), false);
  assert.equal(createWebCompletionLedger(() => storage)(JSON.parse(JSON.stringify(item))), false);
  assert.equal(claim({ ...item, endAt: 456 }), true);
  assert.equal(claim({ ...item, id: "two" }), true);
});

test("avisos web: historial corrupto, almacenamiento bloqueado y ausencia de window", () => {
  for (const getter of [() => ({ getItem: () => "{", setItem: () => { throw Error(); } }), () => { throw Error(); }, () => undefined]) {
    const claim = createWebCompletionLedger(getter);
    assert.equal(claim({ id: "one", endAt: 123 }), true);
    assert.equal(claim({ id: "one", endAt: 123 }), false);
  }
});
