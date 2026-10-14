const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/modulos/portal2027-acceso.js'), 'utf8');
test('compatibilidad limitada a cédulas con separadores', () => {
  assert.match(src, /var formatoCedula = \/\^\[A-Za-z0-9\]/);
  assert.match(src, /credencialesIncorrectas\(r.error\) && formatoCedula/);
});
test('borra contraseña del formulario ante fallo de estudiante', () => {
  assert.match(src, /if \(!entro\) \{ form.cedula.value = '';/);
});
test('no activa claves temporales desde el navegador', () => {
  assert.doesNotMatch(src, /PORTAL2027_CLAVES_TEMPORALES\s*=/);
});
