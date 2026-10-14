const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const raiz = path.resolve(__dirname, '..');
class Nodo {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.style = {}; this.dataset = {}; this.value = ''; this._texto = ''; }
  set textContent(v) { this._texto = String(v); this.children = []; }
  get textContent() { return this._texto + this.children.map(n => n.textContent).join(''); }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v); }
  getAttribute(k) { return this.attrs[k] || ''; }
  addEventListener() {}
  todos() { return [this, ...this.children.flatMap(n => n.todos())]; }
  set innerHTML(v) { throw new Error('No se permite innerHTML en este test'); }
}
const nodos = new Map();
const obtener = id => { if (!nodos.has(id)) nodos.set(id, new Nodo('div')); return nodos.get(id); };
const ctx = { window: {}, document: { body: new Nodo('body'), createElement: tag => new Nodo(tag),
  createTextNode: texto => { const n = new Nodo('#text'); n.textContent = texto; return n; }, getElementById: obtener } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, 'js/core/portal2027-permisos.js'), 'utf8'), ctx);
const fuente = fs.readFileSync(path.join(raiz, 'js/modulos/portal2027-horario.js'), 'utf8');
assert(!fuente.includes('innerHTML'));
const prefix = fuente.slice(0, fuente.indexOf("  $('filtro-sesiones').onchange"));
const facil = fuente.slice(fuente.indexOf('  let faciles = [];'), fuente.indexOf("  $('vista-facil').onchange"));
vm.runInContext(prefix + facil + `
  window.pruebaHorario = { sel, renderFranjas, renderSemana, renderExclusiones, renderFacil, generar,
    estado(d) { asignaciones=d.asignaciones; horario=d.horario; exclusiones=d.exclusiones; faciles=d.faciles;
      trimestres=d.trimestres; opciones=d.opciones || []; }, sesiones() { return sesionesCalc; } };
})();`, ctx);
const api = ctx.window.pruebaHorario;
const ataque = '\"><img src=x onerror=alert(1)><svg onload=alert(2)>';
obtener('anio').value='anio'; obtener('profesor').value='pro'; obtener('trimestre').value='tr';
const datos = {
  asignaciones: [{ id: 'a', profesor_id:'pro', salon: { anio_id:'anio', nombre:ataque }, materia:{ nombre:ataque } }],
  horario: [{ id:ataque, dia:1, tipo:'clase', asignacion_id:'a', hora_inicio:'08:00', hora_fin:'09:00' },
    { id:ataque+'2', dia:1, tipo:'otro', etiqueta:ataque, hora_inicio:'09:00', hora_fin:'10:00' }],
  exclusiones: [{ id:ataque, fecha:'2026-10-13', motivo:ataque, profesor_id:null }],
  faciles: [{ dia:1, inicio:'08:00', fin:'09:00', tipo:'clase', asignacion_id:'a' },
    { dia:2, inicio:'08:00', fin:'09:00', tipo:'otro', etiqueta:ataque }],
  trimestres: [{ id:'tr', fecha_inicio:'2026-10-12', fecha_fin:'2026-10-16' }]
};
api.estado(datos); api.renderFranjas(); api.renderSemana(); api.renderExclusiones(); api.renderFacil(); api.generar();
let todos=[...nodos.values()].flatMap(n=>n.todos());
assert(!todos.some(n=>['img','svg','script'].includes(n.tag)), 'Las etiquetas maliciosas se muestran como texto');
assert(todos.some(n=>n.dataset.editar===ataque));
assert(todos.some(n=>n.dataset.borrar===ataque));
assert(todos.some(n=>n.dataset.excluir===ataque));
assert(todos.some(n=>n.tag==='option'&&n.textContent.includes(ataque)));
assert.equal(api.sesiones().length,1);
assert.equal(api.sesiones()[0].nombre,ataque+' · '+ataque);
assert.equal(obtener('semana-grid').children.length,5);
assert(obtener('sesiones').textContent.includes(ataque));
const dos = { ...datos, horario: [datos.horario[0], { ...datos.horario[0], id:'segundo', hora_inicio:'09:00', hora_fin:'10:00' }] };
api.estado(dos); api.generar(); assert.equal(api.sesiones().length,1,'Bloque doble conserva agrupación previa');
api.estado({ ...dos, opciones:[{ asignacion_id:'a', bloque_doble:'dos' }] }); api.generar(); assert.equal(api.sesiones().length,2);
api.estado({ ...datos, horario:[], exclusiones:[], faciles:[] }); api.renderFranjas(); api.renderSemana(); api.renderExclusiones(); api.renderFacil();
assert(obtener('franjas').textContent.includes('Todavía no hay franjas'));
console.log('OK: horario sin innerHTML; textos y data-* seguros; semana, sesiones, bloques dobles, edición fácil y vacíos.');
