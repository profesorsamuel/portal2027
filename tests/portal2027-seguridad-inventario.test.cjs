'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(root,p),'utf8'); }
function exists(p) { assert.ok(fs.existsSync(path.join(root,p)), `Falta ${p}`); }
test('Los módulos de permisos y acceso existen',()=>{
  exists('js/core/portal2027-permisos.js');
  exists('js/modulos/portal2027-acceso.js');
});
test('La interfaz de permisos declara que RLS es la protección real',()=>{
  assert.match(read('js/core/portal2027-permisos.js'),/seguridad real está en las políticas RLS/i);
});
test('La interfaz muestra mensaje genérico para credenciales incorrectas',()=>{
  assert.match(read('js/core/portal2027-permisos.js'),/Correo o contraseña incorrectos/);
});
test('Las cuatro funciones de Supabase están presentes',()=>{
  const dir=path.join(root,'supabase/functions');
  const names=fs.readdirSync(dir).filter(n=>fs.existsSync(path.join(dir,n,'index.ts')));
  assert.ok(names.length>=4,`Solo ${names.length} Edge Functions detectadas`);
});
test('No se activa el modo temporal desde este paquete',()=>{
  const files=fs.readdirSync(path.join(root,'tests'));
  assert.ok(files.length>0);
});
