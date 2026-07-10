import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "extension");
const outputDir = path.join(rootDir, "dist");

await mkdir(outputDir, { recursive: true });

const entries = await readdir(sourceDir, { withFileTypes: true });
await Promise.all(
  entries
    .filter((entry) => entry.isFile())
    .map((entry) => copyFile(path.join(sourceDir, entry.name), path.join(outputDir, entry.name))),
);
