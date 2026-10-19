import assert from "node:assert/strict";
import { access, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const manifest = await readJson(path.join(dist, "manifest.json"));
const pkg = await readJson(path.join(root, "package.json"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version, "Las versiones del paquete y del manifiesto deben coincidir");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
const required = new Set([manifest.action.default_popup, manifest.background.service_worker, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon), "blocked.html", "blocked.js", "blocked.css", "i18n.js", "coordinator.js"]);
async function checkFile(file) {
  assert.ok(file && !path.isAbsolute(file) && !file.split(/[\\/]/).includes(".."), `Ruta no válida: ${file}`);
  await access(path.join(dist, file));
}
for (const file of required) await checkFile(file);
async function walk(directory, base = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.posix.join(base, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), name));
    else files.push(name);
  }
  return files.sort();
}
const files = await walk(dist);
for (const file of files) {
  if (file.endsWith(".html")) {
    const html = await readFile(path.join(dist, file), "utf8");
    const assets = [...html.matchAll(/(?:src|href)="([^"?#]+)"/g)].map(match => match[1]);
    if (file === manifest.action.default_popup) {
      assert.ok(assets.some(asset => asset.endsWith(".js")), "Falta JavaScript del popup");
      assert.ok(assets.some(asset => asset.endsWith(".css")), "Falta CSS del popup");
    }
    for (const asset of assets) await checkFile(path.posix.join(path.posix.dirname(file), asset));
  }
  if (file.endsWith(".js")) {
    const code = await readFile(path.join(dist, file), "utf8");
    for (const match of code.matchAll(/(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g)) {
      assert.ok(match[1].startsWith("."), `Módulo externo sin empaquetar: ${file} -> ${match[1]}`);
      await checkFile(path.posix.join(path.posix.dirname(file), match[1]));
    }
  }
}
for (const [size, file] of Object.entries(manifest.icons)) {
  const png = await readFile(path.join(dist, file));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
}
const locales = (await readdir(path.join(dist, "_locales"))).sort();
assert.deepEqual(locales, ["de", "en", "es", "fr", "it", "pl", "ru", "zh_CN"]);
assert.ok(locales.includes(manifest.default_locale));
for (const locale of locales) {
  const catalog = await readJson(path.join(dist, "_locales", locale, "messages.json"));
  for (const value of [manifest.name, manifest.description, manifest.action.default_title]) {
    const key = value.match(/^__MSG_(.+)__$/)?.[1];
    assert.ok(key && catalog[key]?.message, `${locale}: falta ${key}`);
  }
}
const inventory = [];
for (const file of files) {
  const bytes = await readFile(path.join(dist, file));
  inventory.push({ file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
const fingerprint = createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
await mkdir(path.join(root, "artifacts"), { recursive: true });
await writeFile(path.join(root, "artifacts", `extension-${manifest.version}.json`), JSON.stringify({ version: manifest.version, fingerprint, files: inventory }, null, 2));
console.log(`Paquete válido: ${files.length} archivos, ${locales.length} idiomas, versión ${manifest.version}. SHA-256 ${fingerprint}`);
