const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/modulos/portal2027-acceso.js'), 'utf8');
const match = src.match(/function normalizarCedula\(c\)\s*\{\s*return String\(c \|\| ''\)\.replace\(\/\[\^A-Za-z0-9\]\/g, ''\)\.toUpperCase\(\);\s*\}/);
test('normalización de cédula: función esperada presente', () => assert.ok(match));
const normalizar = (v) => String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
test('cédula: quita guiones, espacios y puntos', () => assert.equal(normalizar('8-123-456'), '8123456'));
test('cédula: conserva letras y convierte a mayúsculas', () => assert.equal(normalizar('pe-12-345'), 'PE12345'));
test('cédula: no altera números y tolera vacío', () => { assert.equal(normalizar('1234'), '1234'); assert.equal(normalizar(null), ''); });
test('cédula: implementación de acceso coincide con casos probados', () => {
  assert.ok(src.includes("String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()"));
});
