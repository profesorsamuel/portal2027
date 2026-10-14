// Pruebas de regresión de código: NO sustituyen pruebas en Supabase real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const leer = p => fs.readFileSync(path.join(base,p),'utf8');
test('existen las cuatro Edge Functions esperadas', () => {
  for (const n of ['portal2027-crear-accesos','portal2027-cambiar-clave','portal2027-buscar-estudiante','portal2027-invitar-estudiante']) {
    assert.ok(fs.existsSync(path.join(base,'supabase/functions',n,'index.ts')), n);
  }
});
test('no se habilita por accidente la bandera de claves temporales en código de configuración', () => {
  for (const p of ['index.html','js/modulos/portal2027-acceso.js']) {
    assert.doesNotMatch(leer(p), /PORTAL2027_CLAVES_TEMPORALES\s*[:=]\s*['"]?(?:true|1|on)\b/i);
  }
});
test('el código de creación conserva los lotes de 200 entradas', () => {
  assert.match(leer('js/modulos/portal2027-estudiantes.js'), /filas\.slice\(d,\s*d\s*\+\s*200\)/);
});
test('el proyecto mantiene un motor separado de aprobados', () => {
  const s=leer('js/core/portal2027-aprobados-core.js');
  assert.match(s,/calcularGrupo/);
  assert.match(s,/htmlCuadro/);
});
