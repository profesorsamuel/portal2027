// Configuración, mensajes y formularios de subida con DOM simulado, sin Supabase real.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const raiz = path.resolve(__dirname, '..'), MB = 1024 * 1024;
class Nodo {
  constructor(tag, props = {}, hijos = []) {
    this.tag = tag; Object.assign(this, props); this.children = hijos.filter(Boolean); this.events = {}; this.value = props.value || ''; this.texto = props.texto || '';
  }
  appendChild(n) { this.children.push(n); return n; }
  addEventListener(k, fn) { this.events[k] = fn; }
  set textContent(t) { this.texto = t; this.children = []; }
  todos() { return [this, ...this.children.flatMap(c => typeof c === 'object' ? c.todos() : [])]; }
  click() { this.clicked = true; }
}
const el = (tag, props, hijos) => new Nodo(tag, props || {}, hijos || []);
const logs = [], entradas = [], avisos = [], confirmaciones = [];
let subidas = 0;
const db = { storage: { from: () => ({ upload: async () => { subidas++; return {}; } }) }, rpc: async () => ({}) };
const P = { el, db };
const c = { window: { portal2027: P }, console: { error: (...args) => logs.push(args) },
  document: { createElement: tag => { const n = el(tag); entradas.push(n); return n; } } };
vm.createContext(c);
function cargar(rel) { vm.runInContext(fs.readFileSync(path.join(raiz, rel), 'utf8'), c); }
cargar('js/core/portal2027-archivos.js');
cargar('js/modulos/portal2027-clases-comun.js');
cargar('js/modulos/portal2027-documentos.js');
const F = P.archivos;
const pdf = size => ({ name: 'guia.pdf', type: 'application/pdf', size });
(async () => {
  for (const [uso, esperado] of Object.entries({ fotos: 2, documentos: 5, materiales: 15, entregas: 15, planificacion: 15 })) {
    assert.equal(F.maxMB(uso), esperado);
    assert.equal(F.errorTamano(pdf(esperado * MB), uso), '', 'El límite exacto está permitido');
    assert(F.errorTamano(pdf(esperado * MB + 1), uso), 'Rechaza un byte por encima del límite');
  }
  const sql = fs.readFileSync(path.join(raiz, 'supabase/migrations/0046_portal2027_limites_archivos.sql'), 'utf8');
  for (const limite of Object.values(F.LIMITES)) {
    assert(sql.includes(`('${limite.bucket}', ${limite.maxBytes}::bigint)`), 'SQL coincide con configuración web');
  }
  assert.equal(P.clases.validar(pdf(12 * MB)).tipo, 'application/pdf');
  assert.equal(P.clases.validar(pdf(15 * MB), 'entregas').tipo, 'application/pdf');
  const error = P.clases.validar(pdf(18 * MB)).error;
  assert.equal(error, 'Pesa 18 MB, el máximo es 15 MB. Comprímalo en ilovepdf.com o smallpdf.com y vuelva a subirlo.');
  assert(P.docs.validar(pdf(6 * MB)).error.includes('máximo es 5 MB'));
  assert(P.clases.validar(pdf(0)).error.includes('vacío'));
  const sinModificar = pdf(12 * MB);
  assert.strictEqual(await P.clases.reducirImagen(sinModificar), sinModificar, 'No modifica PDF');
  const detalle = F.detalleArchivo(pdf(18 * MB), 'entregas');
  assert.equal(detalle.todos().filter(n => n.tag === 'a').length, 2);
  const inputPeso = el('input'); const vistaPeso = F.vincularPeso(inputPeso, 'materiales');
  inputPeso.files = [pdf(12 * MB)]; inputPeso.events.change();
  assert(vistaPeso.todos().some(n => /Pesa 12 MB/.test(n.texto)), 'Peso antes de subir');
  inputPeso.files = [pdf(18 * MB)]; inputPeso.events.change();
  assert(vistaPeso.todos().some(n => /máximo es 15 MB/.test(n.texto)));
  const detalleTecnico = { message: 'invalid input syntax for uuid in portal2027_tabla_privada' };
  assert(!F.textoError(detalleTecnico, 'materiales').includes('portal2027_tabla_privada'));
  assert(logs.some(args => args.includes(detalleTecnico)), 'Detalle técnico en console.error');
  assert(F.textoError({ statusCode: 413 }, 'entregas').includes('15 MB'));
  assert(F.textoError({ message: 'Failed to fetch' }, 'entregas').includes('conexión'));

  // Formulario PDF del profesor: el peso aparece al seleccionar y bloquea el exceso.
  Object.assign(c, { P, el, db, C: P.clases, F, S: { tipoMaterial: 'pdf', asig: { id: 'asig' }, trimestreId: 'tr', claseId: 'cl' },
    campo: (t, n) => el('label', null, [t, n]), aviso: t => avisos.push(t), accion: async (a, b, fn) => fn() });
  const clases = fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-clases.js'), 'utf8');
  vm.runInContext(clases.slice(clases.indexOf('  function formMaterial()'), clases.indexOf('  function filaMaterial(')) + '\nthis.material = formMaterial;', c);
  const formulario = c.material();
  const archivo = formulario.todos().find(n => n.type === 'file');
  formulario.todos().find(n => n.type === 'text').value = 'Guía';
  archivo.files = [pdf(18 * MB)]; archivo.events.change();
  await formulario.events.submit({ preventDefault() {} });
  assert.equal(subidas, 0);
  assert(avisos.at(-1).includes('Pesa 18 MB'));
  archivo.files = [pdf(12 * MB)]; archivo.events.change();
  await formulario.events.submit({ preventDefault() {} });
  assert.equal(subidas, 1, 'Sube PDF entre 10 y 15 MB');

  // Planificación: revisar nombre y peso antes de confirmar incluso una primera subida.
  const plan = fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-planificacion.js'), 'utf8');
  c.S = { pdfs: {} };
  c.accionConfirmada = async (...args) => { confirmaciones.push(args); };
  vm.runInContext(plan.slice(plan.indexOf('  function subirPDF('), plan.indexOf('  async function borrarPDF(')) + '\nthis.planPDF = subirPDF;', c);
  c.planPDF({ id: 'cl', numero: 1 });
  let entrada = entradas.at(-1); entrada.files = [pdf(18 * MB)]; await entrada.events.change();
  assert(avisos.at(-1).includes('máximo es 15 MB'));
  assert.equal(confirmaciones.length, 0);
  c.planPDF({ id: 'cl', numero: 1 });
  entrada = entradas.at(-1); entrada.files = [pdf(12 * MB)]; await entrada.events.change();
  assert(confirmaciones[0][2].includes('Pesa 12 MB'));
  assert.equal(confirmaciones[0][5], true);
  console.log('OK: límites web/SQL, límites exactos, PDF intacto, peso previo, exceso bloqueado, errores sin detalle técnico y planificación.');

})().catch(e => { console.error(e); process.exitCode = 1; });
