'use strict';
// Guardas para poder mantener una CSP sin 'unsafe-inline' en script-src.
// Los estilos en línea son deuda documentada (docs/CSP_INVENTARIO_5A.md): solo pueden bajar, no subir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');

function listar(dir, ext, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'vendor'].includes(e.name)) continue;
    const r = path.join(dir, e.name);
    if (e.isDirectory()) listar(r, ext, acc); else if (e.name.endsWith(ext)) acc.push(r);
  }
  return acc;
}
const rel = (f) => path.relative(raiz, f).split(path.sep).join('/');
const paginas = listar(raiz, '.html');
const scriptsJs = listar(path.join(raiz, 'js'), '.js');

test('Hay 15 páginas HTML (si cambia, revise la CSP de la página nueva)', () => {
  assert.equal(paginas.length, 15, paginas.map(rel).join(', '));
});

test('Ninguna página tiene <script> en línea', () => {
  for (const p of paginas) {
    const malos = [...fs.readFileSync(p, 'utf8').matchAll(/<script\b([^>]*)>/gi)].filter(m => !/\bsrc\s*=/.test(m[1]));
    assert.equal(malos.length, 0, rel(p) + ' tiene un <script> en línea');
  }
});

test('Ninguna página usa manejadores on*= ni URLs javascript:', () => {
  for (const p of paginas) {
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(t), rel(p) + ' tiene un atributo on*=');
    assert.ok(!/javascript:/i.test(t), rel(p) + ' tiene una URL javascript:');
  }
});

test('El JavaScript no usa eval, new Function ni on*=/style= dentro de cadenas HTML', () => {
  for (const f of scriptsJs) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(!/\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/.test(t), rel(f) + ' usa eval/new Function/document.write');
    assert.ok(!/set(?:Timeout|Interval)\s*\(\s*["'`]/.test(t), rel(f) + ' usa setTimeout/setInterval con texto');
    assert.ok(!/\bon(?:click|change|input|submit|load|error|keydown|keyup|focus|blur)\s*=\s*\\?["']/.test(t), rel(f) + ' genera un on*= en HTML');
    assert.ok(!/setAttribute\(\s*['"]style['"]|\.style\.cssText|[\s"']style\s*=\s*\\?["']/.test(t), rel(f) + ' genera estilos en línea');
  }
});

test('Deuda de estilos en línea: no puede aumentar', () => {
  const tope = {
    'pages/portal2027-estudiante.html': { bloques: 0, atributos: 0 },
    'pages/portal2027-prompt-planificacion.html': { bloques: 0, atributos: 0 },
    'pages/portal2027-planificacion.html': { bloques: 0, atributos: 0 },
  };
  for (const p of paginas) {
    const t = fs.readFileSync(p, 'utf8'), r = rel(p), m = tope[r] || { bloques: 0, atributos: 0 };
    assert.ok((t.match(/<style\b/gi) || []).length <= m.bloques, r + ': más bloques <style> que el tope');
    assert.ok((t.match(/\sstyle\s*=/gi) || []).length <= m.atributos, r + ': más atributos style="" que el tope');
  }
});
