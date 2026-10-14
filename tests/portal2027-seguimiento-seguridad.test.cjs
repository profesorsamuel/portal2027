const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/modulos/portal2027-seguimiento.js'), 'utf8');
test('seguimiento usa creación de nodos para tablas con datos', () => {
  assert.match(src, /function td\(t, c\) \{ return el\('td', \{ clase: c \|\| '', texto: t \}\); \}/);
});
test('la única inserción HTML en seguimiento proviene del generador del cuadro', () => {
  const matches = [...src.matchAll(/\.innerHTML\s*=/g)];
  assert.equal(matches.length, 1, 'Revisar cada nueva asignación innerHTML antes de aprobarla');
  assert.match(src, /hoja\.innerHTML\s*=\s*C\.htmlCuadro\(/);
});
test('no usa document.write ni eval', () => {
  assert.doesNotMatch(src, /\bdocument\.write\s*\(|\beval\s*\(/);
});
