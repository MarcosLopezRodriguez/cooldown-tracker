import assert from "node:assert/strict";
import test from "node:test";
import { makeStatePatch, mergeSiteEdit } from "../extension/lib/operations.js";
import { harness, rule } from "./helpers/chrome.js";
import { META_KEY } from "../extension/coordinator.js";

test("un formulario antiguo solo modifica los campos que el usuario cambió", () => {
  const original = rule({ label: "Original" });
  const latest = { ...original, label: "Otra ventana", endAt: 2_060_000 };
  const merged = mergeSiteEdit([latest], original, { ...original, durationMs: 180_000 });
  assert.equal(merged.label, "Otra ventana");
  assert.equal(merged.durationMs, 180_000);
  assert.equal(merged.endAt, latest.endAt);
  assert.throws(() => mergeSiteEdit([], original, { ...original, label: "Antigua" }), /staleSite/);
});
test("las operaciones no incluyen campos sin cambios ni recrean reglas ajenas", () => {
  const before = { items: [rule()], settings: { language: "es" } };
  const after = { items: [{ ...rule(), label: "Nueva" }], settings: { language: "es" } };
  const patch = makeStatePatch(before, after);
  assert.deepEqual(patch.upserts, [{ id: "test", create: false, fields: { label: "Nueva" } }]);
  assert.deepEqual(patch.deletes, []);
  assert.deepEqual(patch.settings, {});
});
test("fallar una notificación conserva la entrega pendiente y programa otros temporizadores", async () => {
  const h = harness(true, [rule({ mode: "cooldown", endAt: 1_990_000 }), rule({ id: "future", url: "https://future.test/", mode: "cooldown", endAt: 2_060_000 })]);
  const create = h.chrome.notifications.create;
  h.chrome.notifications.create = async () => { throw Error("temporary failure"); };
  await h.events.startup();
  assert.equal(h.alarms.size, 1);
  assert.equal(Object.keys(h.data[META_KEY].pending).length, 1);
  h.chrome.notifications.create = create;
  await h.events.startup();
  assert.equal(h.calls.notify.length, 1);
  assert.equal(Object.keys(h.data[META_KEY].pending).length, 0);
});
test("metadatos corruptos no se sobrescriben durante el arranque", async () => {
  const h = harness(true);
  h.data[META_KEY] = { completed: "invalid" };
  await h.events.startup();
  assert.equal(h.calls.write.length, 0);
  assert.equal(h.calls.query.length, 0);
  assert.deepEqual(h.data[META_KEY], { completed: "invalid" });
});
test("los duplicados heredados no impiden aceptar ni borrar; no se permiten nuevos", async () => {
  const h = harness(false, [rule(), rule({ id: "legacy-duplicate" })]);
  await h.controller.mutate({ kind: "patch", settings: { privacyAccepted: true } });
  await h.controller.mutate({ kind: "patch", deletes: ["legacy-duplicate"] });
  await assert.rejects(h.controller.mutate({ kind: "patch", upserts: [{ id: "third", create: true, fields: rule() }] }), /duplicateSite/);
});
