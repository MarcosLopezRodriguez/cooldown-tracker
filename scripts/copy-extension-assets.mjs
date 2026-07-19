import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "extension");
const outputDir = path.join(rootDir, "dist");

await mkdir(outputDir, { recursive: true });

await cp(sourceDir, outputDir, { recursive: true, force: true });
