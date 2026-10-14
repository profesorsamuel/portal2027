// Unifica la versión de caché (?v=AAAAMMDD) en todos los HTML y en el cargador de Excel.
// Uso:  node scripts/portal2027-version.mjs 20261015
// Sin argumento, solo muestra las versiones encontradas.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const patron = /\?v=[0-9A-Za-z_-]+(?:&(?:amp;)?[a-z]+=[0-9A-Za-z_-]+)*/g;

async function archivos(dir) {
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...await archivos(ruta));
    else if (e.name.endsWith('.html')) salida.push(ruta);
  }
  return salida;
}

const lista = [...await archivos(raiz), path.join(raiz, 'js/core/portal2027-excel.js')];
const nueva = process.argv[2];
if (nueva && !/^\d{8}$/.test(nueva)) {
  console.error('La versión debe tener 8 dígitos, por ejemplo 20261015.');
  process.exit(1);
}

const encontradas = new Map();
let cambiados = 0;
for (const archivo of lista) {
  const texto = await readFile(archivo, 'utf8');
  for (const m of texto.match(patron) || []) encontradas.set(m, (encontradas.get(m) || 0) + 1);
  if (!nueva) continue;
  const nuevo = texto.replace(patron, '?v=' + nueva);
  if (nuevo !== texto) { await writeFile(archivo, nuevo); cambiados++; }
}

console.log('Versiones encontradas:');
for (const [v, n] of [...encontradas].sort()) console.log('  ' + v + '  (' + n + ')');
if (nueva) console.log('Todas pasaron a ?v=' + nueva + ' en ' + cambiados + ' archivos.');
