const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/core/portal2027-aprobados-core.js'), 'utf8');
const ctx = { portal2027: { evaluacion: { redondear1: x => Math.round(x * 10) / 10 } } };
vm.runInNewContext(source, ctx);
const core = ctx.portal2027.aprobadosCore;
test('Escapa caracteres HTML peligrosos, incluida comilla simple', () => {
  assert.equal(core.esc(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});
test('Escapa nombres maliciosos en cuadro imprimible', () => {
  const grupo = core.calcularGrupo('9C<script>', [{ nombre: `<img src=x onerror='alert(1)'>`, sexo:'F', final: 4, cat: null }]);
  const html = core.htmlCuadro({ institucion: `<script>alert(1)</script>`, profesor:'Profe', asignatura:'Ciencias', nivelesTxt:'9', trimestre:'III', anio:2027, jornada:'AM', resumenes:[grupo], mostrarExamen:false });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('9C&lt;script&gt;'));
});
test('No cambia clasificación de aprobados, reprobados y sin nota', () => {
  const r = core.calcularGrupo('9C', [
    {nombre:'A',sexo:'M',final:3,cat:null},
    {nombre:'B',sexo:'F',final:2.9,cat:null},
    {nombre:'C',sexo:'F',final:null,cat:null},
    {nombre:'D',sexo:'M',final:4,retirado:true,cat:null}
  ]);
  assert.equal(r.ap.M,1); assert.equal(r.rep.F,1); assert.equal(r.sin.F,1);
  assert.equal(r.ret.M,1); assert.equal(r.activos,3);
});
test('Escapa nombres y valores numéricos inyectados en las celdas', () => {
  const grupo = core.calcularGrupo('<img src=x onerror=alert(1)>', [{nombre:'Alumno', sexo:'M', final:4, cat:null}]);
  grupo.activos = '<b>1</b>';
  grupo.ap.M = '<b>1</b>';
  const html = core.htmlCuadro({institucion:'Escuela',profesor:'P',asignatura:'C',nivelesTxt:'9',trimestre:'1',anio:2027,jornada:'AM',resumenes:[grupo],mostrarExamen:false});
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;b&gt;1&lt;/b&gt;'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(!html.includes('<td><b>1</b></td>'));
});
