const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('El login sigue comprobando el cambio obligatorio',()=>{
 const s=read('js/modulos/portal2027-acceso.js');
 assert.match(s,/portal2027_requiere_cambio_clave/);
 assert.match(s,/signInWithPassword/);
 assert.match(s,/No se pudo comprobar su acceso/);
});
test('La compatibilidad con cédula antigua sigue presente y requiere migración planificada',()=>{
 const s=read('js/modulos/portal2027-acceso.js');
 assert.match(s,/normalizarCedula\(clave\)/);
 assert.match(s,/credencialesIncorrectas\(r.error\)/);
});
test('Las funciones de claves existen y se mantienen separadas',()=>{
 for(const p of ['portal2027-crear-accesos','portal2027-cambiar-clave']) {
  const s=read(`supabase/functions/${p}/index.ts`);
  assert.ok(s.length>500,`Falta ${p}`);
 }
});
test('No se activa por accidente el indicador de contraseñas temporales en el frontend',()=>{
 const s=read('js/modulos/portal2027-acceso.js');
 assert.doesNotMatch(s,/localStorage\.setItem\(\s*['"]PORTAL2027_CLAVES_TEMPORALES/);
});
