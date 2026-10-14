// Pruebas del módulo real con DOM y Supabase simulados. No modifican una base real.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Elemento {
  constructor(tag, props = {}, hijos = []) {
    this.tag = tag; Object.assign(this, props); this.children = hijos.filter(Boolean);
    this.events = {}; this.disabled = !!props.disabled; this.value = props.value || ''; this.texto = props.texto || '';
  }
  addEventListener(nombre, fn) { this.events[nombre] = fn; }
  appendChild(hijo) { this.children.push(hijo); hijo.parentNode = this; return hijo; }
  set textContent(texto) { this.texto = texto; this.children = []; }
  get textContent() { return this.texto; }
  todos() { return [this, ...this.children.flatMap(h => typeof h === 'object' ? h.todos() : [])]; }
  querySelectorAll() { return this.todos().filter(h => ['button', 'input', 'select', 'textarea'].includes(h.tag)); }
}
const el = (t, p, h) => new Elemento(t, p || {}, h || []);
const raiz = path.resolve(__dirname, '..');
async function entorno(entrega = null) {
  const registro = { uploads: [], rpc: [], errores: [], reducir: [] };
  let falla = true, guardada = entrega;
  const tarea = { id: 'tarea', titulo: '<img src=x onerror=alert(1)>', entrega: guardada };
  const zona = el('div');
  const db = {
    from(tabla) {
      const datos = tabla === 'portal2027_matriculas' ? [{ anio_id: 'a', anio: { anio: 2027 } }] : [{ id: 'tr', numero: 1 }];
      const q = { select() { return q; }, eq() { return q; }, order() { return q; }, then(ok, mal) { return Promise.resolve({ data: datos }).then(ok, mal); } }; return q;
    },
    storage: { from() { return {
      async upload(ruta, archivo) {
        registro.uploads.push({ ruta, nombre: archivo.name });
        return archivo.name === 'b.jpg' && falla ? { error: { message: 'sin conexión' } } : {};
      },
      async createSignedUrl() { return { error: { message: 'no existe' } }; }
    }; } },
    async rpc(nombre, args) {
      if (nombre === 'portal2027_mis_clases') {
        return { data: { matricula_id: 'mat', materias: [{ materia: 'Ciencias', materiales: [], tareas: [{ ...tarea, entrega: guardada }] }] } };
      }
      registro.rpc.push({ nombre, args });
      guardada = { id: 'en', archivos: args.p_archivos, version: (args.p_version || 0) + 1, estado: 'entregada' };
      return { data: { version: guardada.version, tardia: false } };
    }
  };
  const C = {
    BUCKET_ENTREGAS: 'entregas', ACEPTAR: '.jpg,.jpeg,.png,.pdf',
    reducirImagen: async archivo => { registro.reducir.push(archivo.name); return archivo; },
    validar: a => !a || a.size > 10485760 ? { error: 'Tamaño' } : { tipo: a.type },
    nombreSeguro: s => s, fechaHora: () => '', abrir: async () => {}
  };
  const contexto = { window: { portal2027: { el, db, clases: C }, crypto: { randomUUID: () => String(registro.uploads.length) } },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL() {} },
    console: { error: (...x) => registro.errores.push(x) } };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-clases-estudiante.js'), 'utf8'), contexto);
  await contexto.window.portal2027.renderEstudianteClases(zona);
  const buscar = fn => zona.todos().find(fn);
  return { zona, registro, buscar, conectar: () => { falla = false; } };
}
const foto = nombre => ({ name: nombre, type: 'image/jpeg', size: 500000 });
const esperar = async () => { for (let i = 0; i < 25; i++) await new Promise(r => setImmediate(r)); };
(async () => {
  let e = await entorno({ version: 7, estado: 'entregada', archivo_ruta: 'antigua', archivo_nombre: 'original.jpg' });
  assert(e.buscar(x => x.texto === 'Abrir original.jpg'), 'Compatibilidad con entrega antigua');
  let archivo = e.buscar(x => x.type === 'file'), form = e.buscar(x => x.tag === 'form');
  assert.equal(archivo.multiple, true);
  archivo.files = [foto('a.jpg'), foto('b.jpg'), foto('c.jpg')];
  await archivo.events.change();
  await form.events.submit({ preventDefault() {} });
  assert.equal(e.registro.uploads.length, 3, 'Continúa tras fallo de subida');
  assert.equal(e.registro.rpc.length, 0, 'No registra una tanda incompleta');
  e.conectar(); await form.events.submit({ preventDefault() {} });
  assert.deepEqual(e.registro.uploads.map(x => x.nombre), ['a.jpg', 'b.jpg', 'c.jpg', 'b.jpg']);
  assert.equal(e.registro.rpc.length, 1);
  assert.equal(e.registro.rpc[0].args.p_archivos.length, 3);
  assert.equal(e.registro.rpc[0].args.p_version, 7);
  assert.equal(e.zona.todos().filter(x => x.tag === 'button' && /^Abrir /.test(x.texto)).length, 3);

  e = await entorno(); archivo = e.buscar(x => x.type === 'file');
  archivo.files = Array.from({ length: 16 }, (_, i) => foto(i + '.jpg')); await archivo.events.change();
  assert.equal(e.registro.reducir.length, 0, 'Rechaza 16 fotos antes de preparar');
  archivo.files = [foto('a.jpg'), { name: 'guia.pdf', type: 'application/pdf', size: 200 }]; await archivo.events.change();
  assert.equal(e.registro.reducir.length, 0, 'Rechaza mezcla de documento y fotos');
  const pdf = { name: 'guia.pdf', type: 'application/pdf', size: 200 };
  archivo.files = [pdf]; await archivo.events.change();
  await e.buscar(x => x.tag === 'form').events.submit({ preventDefault() {} });
  assert.equal(e.registro.rpc[0].args.p_archivos[0].nombre, 'guia.pdf');
  assert.equal(e.registro.rpc[0].args.p_version, null);

  e = await entorno({ version: 2, estado: 'revisada', archivos: [{ ruta: 'uno', nombre: 'a.jpg' }, { ruta: 'dos', nombre: 'b.jpg' }] });
  assert.equal(e.buscar(x => x.tag === 'form'), undefined, 'No modifica una entrega revisada');
  assert.equal(e.zona.todos().filter(x => x.tag === 'button' && /^Abrir /.test(x.texto)).length, 2);
  const profesor = { el, S: { notas: {} }, C: { fechaHora: () => '', abrir: async () => {} },
    nombreEst: () => 'Alumno', campo: (texto, control) => el('label', {}, [control]),
    boton: (texto, onclick) => el('button', { texto, onclick }), console, aviso() {} };
  const fuenteProfesor = fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-clases.js'), 'utf8');
  vm.createContext(profesor);
  vm.runInContext(fuenteProfesor.slice(fuenteProfesor.indexOf('  function formRevision('), fuenteProfesor.indexOf('  /* ---------- pantalla ---------- */')) + '\nthis.revisar = formRevision;', profesor);
  const revision = profesor.revisar({}, { id: 'mat' }, { estado: 'entregada', archivos: [{ ruta: 'uno', nombre: 'a.jpg' }, { ruta: 'dos', nombre: 'b.jpg' }] });
  assert.equal(revision.todos().filter(x => x.tag === 'button' && /^Abrir /.test(x.texto)).length, 2, 'Profesor abre todos los adjuntos');
  const antigua = profesor.revisar({}, { id: 'mat' }, { estado: 'entregada', archivo_ruta: 'uno', archivo_nombre: 'antigua.jpg' });
  assert(antigua.todos().some(x => x.texto === 'Abrir antigua.jpg'));
  await esperar();
  console.log('OK: tanda incompleta, reintento sin duplicación, versión, adjuntos antiguos, límite, PDF individual y entrega revisada.');
})().catch(e => { console.error(e); process.exitCode = 1; });
