const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = {portal2027:{evaluacion:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/core/portal2027-aprobados-core.js'),'utf8'),ctx);
const core = ctx.portal2027.aprobadosCore;
test('normaliza mayúsculas y acentos para comparar etiquetas',()=>{
 assert.equal(core.llave('  MATEMÁTICA  '),'matematica');
});
test('reconoce estados retirados sin importar acentos o mayúsculas',()=>{
 assert.equal(core.esRetirado('RETIRADO'),true);
 assert.equal(core.esRetirado('Trasladado'),true);
 assert.equal(core.esRetirado('Activo'),false);
});
test('porcentaje con y sin estudiantes',()=>{
 assert.equal(core.pct(1,4),'25.00%');
 assert.equal(core.pct(0,0),'0.00%');
});
test('totales por sexo',()=>{
 assert.equal(core.tot({M:2,F:3,X:1}),6);
});
