import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const manifest = await readJson(path.join(dist, "manifest.json"));
const pkg = await readJson(path.join(root, "package.json"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
const required = new Set([
  manifest.action.default_popup,
  manifest.background.service_worker,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  "blocked.html", "blocked.js", "blocked.css", "i18n.js",
]);
for (const file of required) {
  assert.ok(file && !path.isAbsolute(file) && !file.split(/[\\/]/).includes(".."));
  await access(path.join(dist, file));
}
const html = await readFile(path.join(dist, manifest.action.default_popup), "utf8");
const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map((match) => match[1]);
assert.ok(assets.some((file) => file.endsWith(".js")), "El popup debe cargar JavaScript empaquetado");
assert.ok(assets.some((file) => file.endsWith(".css")), "El popup debe cargar CSS empaquetado");
for (const file of assets) await access(path.join(dist, file));
const locales = await readdir(path.join(dist, "_locales"));
assert.ok(locales.includes(manifest.default_locale));
for (const locale of locales) {
  const catalog = await readJson(path.join(dist, "_locales", locale, "messages.json"));
  for (const value of [manifest.name, manifest.description, manifest.action.default_title]) {
    const key = value.match(/^__MSG_(.+)__$/)?.[1];
    assert.ok(key && catalog[key]?.message, `${locale}: falta ${key}`);
  }
}
console.log(`Paquete válido: ${required.size} recursos, ${assets.length} entradas y ${locales.length} idiomas.`);
