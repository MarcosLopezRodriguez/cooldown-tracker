import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const [major, minor, patch] = process.versions.node.split(".").map(Number);
assert.ok(major === 24 && (minor > 22 || (minor === 22 && patch >= 1)),
  "Se requiere Node 24.22.1 o superior dentro de la rama 24 LTS (parches de seguridad del 21/10/2026).");
const npmPath = process.env.npm_execpath;
const npmVersion = npmPath ? execFileSync(process.execPath, [npmPath, "--version"], { encoding: "utf8" }).trim()
  : process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1];
assert.ok(npmVersion?.startsWith("12."), "Se requiere npm 12. Ejecuta este control mediante npm run check:runtime.");
console.log(`Entorno compatible: Node ${process.versions.node}, npm ${npmVersion}.`);
