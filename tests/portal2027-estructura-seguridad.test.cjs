'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
for (const name of ['portal2027-buscar-estudiante','portal2027-cambiar-clave','portal2027-crear-accesos','portal2027-importar-profesores']) {
  test('Edge Function presente: '+name, () => assert.ok(fs.existsSync(path.join(root,'supabase/functions',name,'index.ts'))));
}
for (const num of ['0048','0049']) {
  test('Migración '+num+' presente en carpeta principal', () => {
    assert.ok(fs.readdirSync(path.join(root,'supabase/migrations')).some(f=>f.startsWith(num+'_') && f.endsWith('.sql')));
  });
}
test('Migración 0047 localizada (no demuestra instalación en Supabase)', () => {
  const main=path.join(root,'supabase/migrations');
  const nested=path.join(root,'portal2027-seguridad-etapa2-0047/supabase/migrations');
  assert.ok([main,nested].some(dir=>fs.existsSync(dir)&&fs.readdirSync(dir).some(f=>f.startsWith('0047_'))));
});
test('No incluir archivos .env ni respaldos en Git', () => {
  const ignore=read('.gitignore');
  for(const rule of ['.env','respaldos/','*.dump']) assert.ok(ignore.split(/\r?\n/).includes(rule),'Falta '+rule);
});
