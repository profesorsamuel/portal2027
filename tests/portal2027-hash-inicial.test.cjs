'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const raiz = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m => ({ attrs: m[1], cuerpo: m[2].trim() }));

test('index.html no tiene scripts en línea', () => {
  const enLinea = scripts.filter(s => !/\bsrc=/.test(s.attrs));
  assert.equal(enLinea.length, 0, 'Hay un <script> en línea; la CSP no puede usar unsafe-inline');
});

test('portal2027-hash-inicial.js se carga primero, sin defer/async, y antes de supabase-js', () => {
  const i = scripts.findIndex(s => /portal2027-hash-inicial\.js/.test(s.attrs));
  const j = scripts.findIndex(s => /supabase-js/.test(s.attrs));
  assert.ok(i >= 0, 'Falta cargar portal2027-hash-inicial.js');
  assert.equal(i, 0, 'Debe ser el primer script de la página');
  assert.ok(j > i, 'Debe cargarse antes que supabase-js');
  assert.ok(!/\b(defer|async|type=["']module["'])/i.test(scripts[i].attrs), 'No debe llevar defer, async ni type=module');
});

test('portal2027-hash-inicial.js guarda el fragmento tal cual', () => {
  const codigo = fs.readFileSync(path.join(raiz, 'js/core/portal2027-hash-inicial.js'), 'utf8');
  const ventana = { location: { hash: '#access_token=abc&type=recovery' } };
  vm.runInNewContext(codigo, { window: ventana });
  assert.equal(ventana.portal2027_hashInicial, '#access_token=abc&type=recovery');
  const vacia = { location: { hash: '' } };
  vm.runInNewContext(codigo, { window: vacia });
  assert.equal(vacia.portal2027_hashInicial, '');
});

test('acceso.js sigue leyendo portal2027_hashInicial', () => {
  assert.match(fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-acceso.js'), 'utf8'), /window\.portal2027_hashInicial/);
});
