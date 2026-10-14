'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');

function htmls(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name === 'node_modules' || e.name === '.git') return [];
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return htmls(ruta);
    return e.name.endsWith('.html') ? [ruta] : [];
  });
}

const archivos = [...htmls(raiz), path.join(raiz, 'js/core/portal2027-excel.js')];
const encontradas = new Set();
for (const archivo of archivos) {
  const texto = fs.readFileSync(archivo, 'utf8');
  for (const m of texto.match(/\?v=[^"'\s)]+/g) || []) encontradas.add(m);
}

test('Todas las versiones de caché tienen el formato ?v=AAAAMMDD, sin parámetros extra', () => {
  for (const v of encontradas) assert.match(v, /^\?v=\d{8}$/, 'Formato no permitido: ' + v);
});

test('Hay una sola versión de caché en todo el portal', () => {
  assert.equal(encontradas.size, 1, 'Versiones mezcladas: ' + [...encontradas].join(', '));
});
