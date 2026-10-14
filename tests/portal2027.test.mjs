import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const excluded = new Set(['node_modules', '.git']);
async function files(dir = root) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(target));
    else if (entry.isFile()) result.push(target);
  }
  return result.sort();
}
const all = await files();
const htmlFiles = all.filter((file) => file.endsWith('.html'));
assert.ok(htmlFiles.length, 'No se encontraron páginas HTML');

let jsCount = 0;
for (const file of all.filter((file) => /\.(?:js|mjs|cjs)$/.test(file))) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(check.status, 0, `${path.relative(root, file)}: ${check.stderr || check.error}`);
  jsCount++;
}
console.log(`Sintaxis: ${jsCount} archivos JavaScript correctos`);

let referenceCount = 0;
for (const file of htmlFiles) {
  const document = parse(await readFile(file, 'utf8'));
  async function visit(node) {
    for (const attr of node.attrs || []) {
      if (!['src', 'href'].includes(attr.name)) continue;
      const value = attr.value.trim();
      if (!value || value.startsWith('#') || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) continue;
      const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]);
      if (!pathname) continue;
      const target = pathname.startsWith('/')
        ? path.resolve(root, '.' + pathname)
        : path.resolve(path.dirname(file), pathname);
      assert.ok(target === root || target.startsWith(root + path.sep), `Ruta fuera del proyecto: ${value}`);
      try { await stat(target); }
      catch { assert.fail(`${path.relative(root, file)}: no existe ${attr.name}="${value}"`); }
      referenceCount++;
    }
    for (const child of node.childNodes || []) await visit(child);
    if (node.content) await visit(node.content);
  }
  await visit(document);
}
console.log(`Rutas HTML: ${referenceCount} referencias locales existentes`);

// Solo se comprueba la estructura HTML/CSS. Sin JS no hay consultas a Supabase,
// escrituras ni redirecciones que sustituyan una página privada por el inicio.
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('No encontrado'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  for (const file of htmlFiles) {
    const relative = path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/');
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/${relative}`, { waitUntil: 'load' });
    assert.equal(response.status(), 200, `No se pudo abrir ${relative}`);
    await page.evaluate(() => document.fonts.ready);
    const size = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(size.scroll <= size.width, `${relative}: desbordamiento horizontal ${size.scroll}px > ${size.width}px`);
    console.log(`Móvil: ${relative} (${size.scroll}/${size.width}px)`);
  }
  await context.close();
  console.log(`Correcto: ${htmlFiles.length} páginas a 390 × 844. Contenido dinámico y permisos pendientes de prueba manual.`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
