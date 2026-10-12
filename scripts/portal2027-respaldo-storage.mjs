// portal2027-respaldo-storage.mjs — descarga los archivos de los buckets privados a una carpeta LOCAL.
// La copia de la base NO incluye los archivos de Storage: se respaldan por separado con este script.
// Las claves van en variables de entorno, nunca escritas aquí. La clave de servicio (secret) NO va en el navegador
// ni en GitHub: solo en su equipo.
//
// Uso:  export SUPABASE_URL='https://xxxx.supabase.co'
//       export SUPABASE_SERVICE_KEY='(clave secret del proyecto)'
//       node portal2027-respaldo-storage.mjs [carpeta_destino]
// Requiere Node 18 o superior (usa fetch integrado). No borra nada en Supabase: solo lee.
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const CLAVE = process.env.SUPABASE_SERVICE_KEY || '';
if (!URL_BASE || !CLAVE) { console.error('Defina SUPABASE_URL y SUPABASE_SERVICE_KEY'); process.exit(2); }
const BUCKETS = ['portal2027-fotos', 'portal2027-documentos', 'portal2027-entregas', 'portal2027-materiales'];
const fecha = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const destino = path.join(process.argv[2] || './respaldos', `portal2027-storage-${fecha}`);
const H = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` };

async function listar(bucket, prefijo, salida) {
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefijo, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
    });
    if (!r.ok) throw new Error(`Listar ${bucket}/${prefijo}: HTTP ${r.status}`);
    const items = await r.json();
    for (const it of items) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
      if (it.id === null) await listar(bucket, ruta, salida);   // carpeta
      else salida.push(ruta);
    }
    if (items.length < 100) break;
  }
}

const resumen = { fecha: new Date().toISOString(), buckets: {}, errores: [] };
for (const b of BUCKETS) {
  const rutas = [];
  try { await listar(b, '', rutas); } catch (e) { resumen.errores.push(String(e.message)); resumen.buckets[b] = { esperados: 0, copiados: 0 }; continue; }
  let ok = 0;
  for (const ruta of rutas) {
    try {
      const r = await fetch(`${URL_BASE}/storage/v1/object/authenticated/${b}/${ruta.split('/').map(encodeURIComponent).join('/')}`, { headers: H });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const datos = Buffer.from(await r.arrayBuffer());
      const archivo = path.join(destino, b, ...ruta.split('/'));
      await mkdir(path.dirname(archivo), { recursive: true });
      await writeFile(archivo, datos, { mode: 0o600 });
      const esperado = (await stat(archivo)).size;            // se verifica lo escrito en disco
      if (esperado !== datos.length) throw new Error('tamaño distinto al escribir');
      resumen.buckets[b] = resumen.buckets[b] || { esperados: rutas.length, copiados: 0, sha256: {} };
      resumen.buckets[b].sha256[ruta] = createHash('sha256').update(datos).digest('hex');
      ok++; resumen.buckets[b].copiados = ok;
    } catch (e) { resumen.errores.push(`${b}/${ruta}: ${e.message}`); }
  }
  resumen.buckets[b] = resumen.buckets[b] || { esperados: rutas.length, copiados: 0 };
  resumen.buckets[b].esperados = rutas.length;
}
await mkdir(destino, { recursive: true });
await writeFile(path.join(destino, 'resumen.json'), JSON.stringify(resumen, null, 1), { mode: 0o600 });
const falta = Object.values(resumen.buckets).some(x => x.copiados !== x.esperados) || resumen.errores.length > 0;
for (const [b, x] of Object.entries(resumen.buckets)) console.log(`${b}: ${x.copiados} de ${x.esperados} archivos`);
if (falta) { console.error(`PARCIAL O FALLIDO: ${resumen.errores.length} error(es). Vea resumen.json en ${destino}`); process.exit(1); }
console.log(`LISTO: ${destino}. Anótelo en el portal (Respaldos) con el resultado REAL.`);
