import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "output", "browser");
await mkdir(output, { recursive: true });
const profile = process.env.COOLDOWN_TEST_PROFILE || await mkdtemp(path.join(tmpdir(), "cooldown-check-"));
const cli = path.join(root, "node_modules", "@playwright", "cli", "playwright-cli.js");
const session = `cooldown-check-${Date.now()}`;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname.replace(/^\/+/, "");
    if (relative.split(/[\\/]/).includes("..")) { response.writeHead(400); response.end(); return; }
    let file = path.join(root, "dist-web", relative || "index.html");
    let body;
    try { body = await readFile(file); } catch { file = "index.html"; body = await readFile(path.join(root, "dist-web", file)); }
    response.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" })[path.extname(file)] || "application/octet-stream");
    response.end(body);
  } catch { response.writeHead(500); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const configFile = path.join(output, "config.json");
await writeFile(configFile, JSON.stringify({ browser: {
  browserName: "chromium", launchOptions: { channel: "chromium", headless: true, args: [`--disable-extensions-except=${path.join(root, "dist")}`, `--load-extension=${path.join(root, "dist")}`, "--no-proxy-server", "--host-resolver-rules=MAP *.cooldown.test 127.0.0.1, MAP cooldown.test 127.0.0.1"] },
  contextOptions: { viewport: { width: 420, height: 700 } },
} }, null, 2));
let sequence = 0;
const results = [];
async function cliCall(args) {
  // Async child execution keeps the fixture HTTP server responsive.
  const { execFile } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [cli, `-s=${session}`, ...args], { cwd: root, timeout: 120_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const failed = stdout.includes("### Error");
      if (error || failed) reject(new Error(`${error?.message || "Browser assertion failed"}\n${stdout}\n${stderr}`));
      else resolve(stdout);
    });
  });
}
async function runCode(source, config = {}) {
  const filename = path.join(output, `step-${++sequence}.js`);
  await writeFile(filename, `async (page) => { const scenario = (${source}); return scenario(page, ${JSON.stringify({ baseUrl, root, output, ...config })}); }`);
  const stdout = await cliCall(["run-code", `--filename=${filename}`]);
  await writeFile(filename.replace(/\.js$/, ".log"), stdout);
  const match = stdout.match(/### Result\r?\n([\s\S]*?)(?:\r?\n###|$)/);
  if (!match) throw new Error(`No se recibió el resultado de ${filename}: ${stdout}`);
  const value = JSON.parse(match[1]);
  return value;
}
async function open() { await cliCall(["open", "about:blank", "--persistent", `--profile=${profile}`, `--config=${configFile}`]); }
try {
  await open();
  const discovered = await runCode(`async page => {
    const worker = page.context().serviceWorkers()[0] || await page.context().waitForEvent('serviceworker');
    return { extensionUrl: worker.url().replace('background.js','index.html'), browser: page.context().browser().version() };
  }`);
  console.log(`Chrome real: ${discovered.browser}; perfil aislado: ${profile}`);
  const config = { extensionUrl: discovered.extensionUrl };
  for (const file of ["web", "extension", "suspension"]) {
    const source = await readFile(path.join(root, "tests", "browser", `${file}.js`), "utf8");
    const result = await runCode(source, config);
    if (result.upload || result.uploadValue) {
      const upload = result.upload || path.join(output, `${file}-import.json`);
      if (result.uploadValue) await writeFile(upload, JSON.stringify(result.uploadValue));
      // Native pickers interrupt a CLI command: open and upload in distinct calls.
      const chooser = await cliCall(["run-code", "async page => { await page.getByRole('button',{name:'Importar datos',exact:true}).focus(); await page.keyboard.press('Enter'); }"]);
      if (!chooser.includes("File chooser")) throw new Error("El activador de importación no abrió el selector por teclado.");
      await cliCall(["upload", upload]);
      const continuation = await runCode(await readFile(path.join(root, "tests", "browser", `${file}-after-import.js`), "utf8"), { ...config, upload, contextData: result.contextData });
      result.passed.push(...continuation.passed);
    }
    results.push({ scenario: file, ...result });
    console.log(`${file}: ${result.passed.length} comprobaciones correctas`);
  }
  const restart = await runCode(await readFile(path.join(root, "tests", "browser", "restart-prepare.js"), "utf8"), config);
  await cliCall(["close"]);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, restart.endAt - Date.now() + 500)));
  await open();
  const resumed = await runCode(await readFile(path.join(root, "tests", "browser", "restart-check.js"), "utf8"), { ...config, endAt: restart.endAt });
  results.push({ scenario: "restart", ...resumed });
  console.log(`restart: ${resumed.passed.length} comprobaciones correctas`);
  await writeFile(path.join(output, "results.json"), JSON.stringify({ date: new Date().toISOString(), browser: discovered.browser, profile, results }, null, 2));
  console.log(`Navegador: ${results.reduce((count, result) => count + result.passed.length, 0)} comprobaciones correctas. Informe: output/browser/results.json`);
} catch (error) {
  const details = await cliCall(["run-code", "async page => ({ progress: await page.evaluate(()=>window.browserTestProgress||[]), pages: await Promise.all(page.context().pages().map(async p=>({url:p.url(),body:await p.locator('body').ariaSnapshot().catch(()=>null)}))) })"]).catch(() => "");
  await writeFile(path.join(output, "failure-details.txt"), details);
  const snapshot = await cliCall(["snapshot"]).catch(() => "");
  await writeFile(path.join(output, "failure-snapshot.txt"), snapshot);
  console.error(snapshot.slice(0, 5000));
  throw error;
} finally {
  await cliCall(["close"]).catch(() => {});
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
