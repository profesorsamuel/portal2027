// Lectura de importaciones y misma vista previa antes/después de la extracción.
// Comparación opcional: node tests/portal2027-libreta-importacion.test.cjs RUTA_LIBRETA_ANTERIOR
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const raiz = path.resolve(__dirname, '..');
const contexto = { window: { portal2027: {} } };
vm.createContext(contexto);
const modulo = fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-libreta-importacion.js'), 'utf8');
vm.runInContext(modulo, contexto);
const I = contexto.window.portal2027.libretaImportacion;
const json = valor => JSON.parse(JSON.stringify(valor));
assert(Object.isFrozen(I));
for (const valor of [0, 5, 4.25, '4,5', ' 4.50 ', '001']) assert(I.esNum(valor));
for (const valor of ['', '   ', 'Ana', '4 puntos', '-1', '1e3', null, undefined, NaN, Infinity]) assert(!I.esNum(valor));
assert.equal(I.aNumero('4,5'), 4.5);
assert.equal(I.aNumero(' 4.25 '), 4.25);
assert.deepEqual(json(I.tokensNombre('  PÉREZ, Ana-María  ')), ['perez', 'ana', 'maria']);
assert.equal(I.claveNombre('María Pérez Ana'), I.claveNombre('ANA MARÍA PÉREZ'));
assert.deepEqual(json(I.filasDeTexto('4,5\n\n3\r\n\n')), [['4,5'], [''], ['3']]);
assert.deepEqual(json(I.filasDeTexto('Ana Pérez\t4,5\nJosé Díaz;3.25\nLuis Pérez 4.75')), [['Ana Pérez', '4,5'], ['José Díaz', '3.25'], ['Luis Pérez', '4.75']]);
assert.deepEqual(json(I.leerFilas([['Nombre', 'Nota'], ['Ana', 4.5], ['', null], ['José', '4,25'], ['']])), [
  { texto: 'Ana', nums: [4.5] }, { texto: '', nums: [] }, { texto: 'José', nums: ['4,25'] }
]);
for (const n of [0, 1, 4.25, 5]) assert.equal(I.validar(n), '');
for (const n of [-0.01, 5.01, Infinity, NaN]) assert.equal(I.validar(n), 'Debe estar entre 0 y 5');
assert.equal(I.validar(4.251), 'Máximo 2 decimales');

const actual = fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-libreta.js'), 'utf8');
const inicioPlan = '  function planificar(', finPlan = '  var TEXTO_ESTADO';
function preparar(funciones, fuentePlan) {
  const mats = [
    { id: 'm1', estudiante: { codigo: '001', apellidos: 'Pérez', nombres: 'Ana' } },
    { id: 'm2', estudiante: { codigo: '002', apellidos: 'Díaz', nombres: 'José' } },
    { id: 'm3', estudiante: { codigo: '003', apellidos: 'Pérez', nombres: 'Luis' } }
  ];
  const c = { ...funciones, matsVisibles: () => mats, S: { notas: { 'ev|m1': { valor: 4 } } },
    clave: (e, m) => e + '|' + m, nombreEst: e => e.apellidos + ', ' + e.nombres };
  if (fuentePlan) {
    const plan = fuentePlan.slice(fuentePlan.indexOf(inicioPlan), fuentePlan.indexOf(finPlan));
    vm.createContext(c); vm.runInContext(plan + '\nthis.plan = planificar;', c);
  } else {
    c.plan = funciones.crearPlanificador({ estado: c.S, matsVisibles: c.matsVisibles, clave: c.clave, nombreEst: c.nombreEst });
  }
  return c;
}
const nuevo = preparar(I);
function importar(c, texto, inicio = 0) { return json(c.plan(c.leerFilas(c.filasDeTexto(texto)), { id: 'ev' }, inicio)); }
const notas = importar(nuevo, '4\n\n4,75\n5');
assert.equal(notas.porNombres, false);
assert.deepEqual(notas.items.map(x => x.estado), ['igual', 'vacia', 'nueva', 'sobra']);
const nombres = importar(nuevo, 'Nombre\tNota\nAna Pérez\t4\nJosé Díaz\t4,5\nNo Existe\t3\nPérez\t5\nAna Pérez\t4,5\nLuis Pérez\t8');
assert.deepEqual(nombres.items.map(x => x.estado), ['igual', 'nueva', 'noencontrado', 'noencontrado', 'repetido', 'invalida']);
assert.equal(nombres.items[3].detalle, 'Coincide con varios estudiantes');
const codigos = importar(nuevo, '001\t4,5\n002\t3');
assert.deepEqual(codigos.items.map(x => x.mat.id), ['m1', 'm2']);
assert.deepEqual(codigos.items.map(x => x.estado), ['cambia', 'nueva']);
assert.equal(importar(nuevo, '4,25', 1).items[0].mat.id, 'm2');

// El planificador conserva referencias vivas y no escribe en las notas.
const estadoAntes = JSON.stringify(nuevo.S);
importar(nuevo, '001\t4,5'); assert.equal(JSON.stringify(nuevo.S), estadoAntes);
nuevo.S.notas = { 'ev|m1': { valor: 4.5 } };
assert.equal(importar(nuevo, '001\t4,5').items[0].estado, 'igual', 'Lee el estado actual, sin copia de notas');
const independiente = preparar(I);
assert.equal(importar(independiente, '001\t4,5').items[0].estado, 'cambia', 'Contextos independientes');
nuevo.S.notas = { 'ev|m1': { valor: 4 } };

if (process.argv[2]) {
  const rutaAnterior = path.resolve(process.argv[2]);
  const anterior = fs.readFileSync(rutaAnterior, 'utf8');
  assert(anterior.includes(inicioPlan), 'Indique una versión anterior que aún tenga planificar');
  const a = anterior.indexOf('  function esNum('), b = anterior.indexOf('  // Arma el plan:');
  const legado = {}; vm.createContext(legado);
  if (a >= 0) {
    const cuerpos = anterior.slice(a, b);
    assert(modulo.includes(cuerpos), 'Las funciones puras originales están conservadas');
    vm.runInContext(cuerpos + '\nthis.funciones = { esNum, aNumero, tokensNombre, claveNombre, filasDeTexto, leerFilas, validar };', legado);
  } else {
    legado.window = { portal2027: {} };
    vm.runInContext(fs.readFileSync(path.join(path.dirname(rutaAnterior), 'portal2027-libreta-importacion.js'), 'utf8'), legado);
    legado.funciones = legado.window.portal2027.libretaImportacion;
  }
  const bloquePlan = anterior.slice(b, anterior.indexOf(finPlan));
  assert(modulo.includes(bloquePlan), 'El cuerpo del planificador es idéntico');
  assert.equal(actual.slice(actual.indexOf('  async function guardarImportacion')), anterior.slice(anterior.indexOf('  async function guardarImportacion')), 'Guardado y resto del módulo sin cambios');
  assert(modulo.includes(anterior.slice(anterior.indexOf(finPlan), anterior.indexOf('  async function guardarImportacion'))), 'Interfaz conservada');
  const viejo = preparar(legado.funciones, anterior);
  const casos = ['', '0\n5', '4\n\n4,75\n5', 'Nombre;Nota\nAna Pérez;4,5\nJosé Díaz;3', '001\t4\n002\t3', 'Pérez\t4', 'Luis Pérez\t4.251', 'Ana Pérez 4.5\nAna Pérez 4.75'];
  for (const texto of casos) for (const inicio of [0, 1, 2]) assert.deepEqual(importar(nuevo, texto, inicio), importar(viejo, texto, inicio));
  console.log('Comparación anterior/actual: 24 escenarios idénticos; planificador, interfaz y guardado conservados.');
}
console.log('OK: números, nombres/acentos, separadores, filas vacías, validación existente y vista previa de importación.');
