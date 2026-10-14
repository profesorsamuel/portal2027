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
const plan = actual.slice(actual.indexOf(inicioPlan), actual.indexOf(finPlan));
function preparar(funciones) {
  const mats = [
    { id: 'm1', estudiante: { codigo: '001', apellidos: 'Pérez', nombres: 'Ana' } },
    { id: 'm2', estudiante: { codigo: '002', apellidos: 'Díaz', nombres: 'José' } },
    { id: 'm3', estudiante: { codigo: '003', apellidos: 'Pérez', nombres: 'Luis' } }
  ];
  const c = { ...funciones, matsVisibles: () => mats, S: { notas: { 'ev|m1': { valor: 4 } } },
    clave: (e, m) => e + '|' + m, nombreEst: e => e.apellidos + ', ' + e.nombres };
  vm.createContext(c); vm.runInContext(plan + '\nthis.plan = planificar;', c);
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

if (process.argv[2]) {
  const anterior = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
  const a = anterior.indexOf('  function esNum('), b = anterior.indexOf('  // Arma el plan:', a);
  assert(a >= 0 && b > a, 'Indique una versión anterior que aún contenga las funciones extraídas');
  const cuerpos = anterior.slice(a, b);
  assert(modulo.includes(cuerpos), 'Los cuerpos extraídos son idénticos');
  assert.equal(actual.slice(0, actual.indexOf('  // Referencias compartidas:')), anterior.slice(0, a), 'La parte anterior no cambió');
  assert.equal(actual.slice(actual.indexOf('  // Arma el plan:')), anterior.slice(b), 'Vista previa, guardado y resto del módulo no cambiaron');
  const legado = {}; vm.createContext(legado);
  vm.runInContext(cuerpos + '\nthis.funciones = { esNum, aNumero, tokensNombre, claveNombre, filasDeTexto, leerFilas, validar };', legado);
  const viejo = preparar(legado.funciones);
  const casos = ['', '0\n5', '4\n\n4,75\n5', 'Nombre;Nota\nAna Pérez;4,5\nJosé Díaz;3', '001\t4\n002\t3', 'Pérez\t4', 'Luis Pérez\t4.251', 'Ana Pérez 4.5\nAna Pérez 4.75'];
  for (const texto of casos) for (const inicio of [0, 1, 2]) assert.deepEqual(importar(nuevo, texto, inicio), importar(viejo, texto, inicio));
  console.log('Comparación anterior/actual: 24 escenarios idénticos; funciones y resto del módulo conservados.');
}
console.log('OK: números, nombres/acentos, separadores, filas vacías, validación existente y vista previa de importación.');
