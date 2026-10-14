'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const leer = (r) => fs.readFileSync(path.join(raiz, r), 'utf8');

// Enlaces markdown locales [texto](ruta) de un archivo; ignora http(s), mailto y #ancla.
function enlacesLocales(rutaMd) {
  const base = path.dirname(path.join(raiz, rutaMd));
  const out = [];
  for (const m of leer(rutaMd).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const destino = m[1].split('#')[0];
    if (!destino || /^(https?:|mailto:)/.test(m[1])) continue;
    out.push({ destino, existe: fs.existsSync(path.resolve(base, decodeURIComponent(destino))) });
  }
  return out;
}

test('docs/INDICE.md lista todos los documentos de docs/ y ninguno inexistente', () => {
  const indice = leer('docs/INDICE.md');
  const reales = fs.readdirSync(path.join(raiz, 'docs')).filter(f => f !== 'INDICE.md');
  const listados = [...indice.matchAll(/^\| \[([^\]]+)\]\(([^)]+)\)/gm)].map(m => m[2]);
  for (const f of reales) assert.ok(listados.includes(f), 'Falta en el índice: ' + f);
  for (const f of listados) assert.ok(reales.includes(f), 'El índice menciona un archivo inexistente: ' + f);
  assert.equal(new Set(listados).size, listados.length, 'Hay documentos repetidos en el índice');
});

test('Los enlaces locales del README y del índice existen', () => {
  for (const md of ['README.md', 'docs/INDICE.md']) {
    for (const e of enlacesLocales(md)) assert.ok(e.existe, md + ': enlace roto → ' + e.destino);
  }
});

test('Los documentos renombrados no conservan su nombre antiguo', () => {
  assert.ok(!fs.existsSync(path.join(raiz, 'docs/LEER_PRIMERO.md')));
  assert.ok(!fs.existsSync(path.join(raiz, 'docs/LEER-ANTES-DE-INSTALAR.md')));
});

test('El README mantiene las 5 Edge Functions y no usa --no-verify-jwt', () => {
  const readme = leer('README.md');
  const funciones = fs.readdirSync(path.join(raiz, 'supabase/functions'), { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== '_shared').map(e => e.name);
  assert.equal(funciones.length, 5);
  for (const f of funciones) assert.ok(readme.includes('supabase functions deploy ' + f), 'README sin despliegue de ' + f);
  assert.ok(!/--no-verify-jwt/.test(readme.replace(/`--no-verify-jwt`[^\n]*/g, '')),
    'No ordene desplegar con --no-verify-jwt: anula supabase/config.toml');
});

test('El README documenta cada secreto que leen las Edge Functions (solo nombres)', () => {
  const readme = leer('README.md');
  const nombres = new Set();
  const dirs = fs.readdirSync(path.join(raiz, 'supabase/functions'), { withFileTypes: true }).filter(e => e.isDirectory());
  for (const d of dirs) {
    const carpeta = path.join(raiz, 'supabase/functions', d.name);
    for (const f of fs.readdirSync(carpeta).filter(x => x.endsWith('.ts'))) {
      for (const m of fs.readFileSync(path.join(carpeta, f), 'utf8').matchAll(/Deno\.env\.get\(['"]([A-Z0-9_]+)['"]\)/g)) nombres.add(m[1]);
    }
  }
  for (const n of nombres) assert.ok(readme.includes(n), 'README no menciona el secreto/variable ' + n);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sb_secret_|postgres(ql)?:\/\/[^\s'.]+:[^\s'@]+@/.test(readme), 'El README parece contener un valor secreto');
});

test('El README mantiene los números de las migraciones específicas fuera del orden general', () => {
  const readme = leer('README.md');
  const esp = fs.readdirSync(path.join(raiz, 'supabase/especificas')).map(f => f.slice(0, 4)).sort();
  for (const n of esp) assert.ok(readme.includes(n), 'README no menciona ' + n);
  const gen = fs.readdirSync(path.join(raiz, 'supabase/migrations')).filter(f => /^\d{4}_/.test(f)).map(f => f.slice(0, 4));
  for (const n of esp) assert.ok(!gen.includes(n), n + ' no debe estar también en migrations/');
  assert.equal(gen[gen.length - 1], '0049', 'Actualice el README si se añade una migración nueva');
});
