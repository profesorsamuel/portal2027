const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('acceso: no contiene instrucciones de desactivar JWT en módulo del estudiante', () => {
  const s = fs.readFileSync(path.join(root,'js/modulos/portal2027-acceso.js'),'utf8');
  assert.doesNotMatch(s, /disable\s+jwt|desactivar\s+jwt/i);
});
test('acceso: sigue usando signInWithPassword de Supabase', () => {
  const s = fs.readFileSync(path.join(root,'js/modulos/portal2027-acceso.js'),'utf8');
  assert.match(s,/auth\.signInWithPassword/);
});
test('no se incluye archivo de secretos en este paquete', () => {
  for (const f of ['.env','.env.local']) assert.ok(!fs.existsSync(path.join(__dirname,f)));
});
