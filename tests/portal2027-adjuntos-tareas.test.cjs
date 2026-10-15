'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const leer = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const sql = leer('supabase/migrations/0050_portal2027_adjuntos_tareas.sql');
const js = leer('js/modulos/portal2027-clases.js');
const jsEst = leer('js/modulos/portal2027-clases-estudiante.js');

test('0050 crea la tabla de adjuntos con RLS y sin escritura directa', () => {
  assert.match(sql, /create table if not exists public\.portal2027_tareas_adjuntos/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on public\.portal2027_tareas_adjuntos from authenticated/);
});

test('0050 limita a 10 adjuntos y exige rutas dentro de la carpeta de la tarea', () => {
  assert.match(sql, />= 10 then/);
  assert.match(sql, /\/tareas\/' \|\| p_tarea::text/);
});

test('Las RPC que llama la web existen en la migración', () => {
  for (const fn of ['portal2027_agregar_adjunto_tarea', 'portal2027_quitar_adjunto_tarea', 'portal2027_mis_clases']) {
    assert.ok(sql.includes('function public.' + fn + '('), 'Falta ' + fn);
    assert.ok(js.includes(fn) || jsEst.includes(fn), 'La web no usa ' + fn);
  }
});

test('Los adjuntos de tareas no se pueden abrir sin ser del grupo ni del profesor', () => {
  assert.match(sql, /portal2027_puede_leer_material\(p_ruta text\)[\s\S]*portal2027_tareas_adjuntos[\s\S]*t\.publicada/);
});

test('La lista de alumnos se copia con numeración y sin inventar datos', () => {
  assert.match(js, /function listaAlumnosTexto\(\)/);
  assert.match(js, /\(i \+ 1\) \+ '\. ' \+ nombreEst\(m\)/);
});

test('La página del profesor carga el módulo de confirmaciones', () => {
  assert.ok(leer('pages/portal2027-clases.html').includes('portal2027-dialogos.js'));
});

test('La web no usa scripts en línea ni estilos en línea en los adjuntos', () => {
  assert.ok(!/\bstyle\s*:/.test(js.slice(js.indexOf('function bloqueAdjuntos'), js.indexOf('function formTarea'))));
  assert.ok(!/innerHTML/.test(js + jsEst));
});
