const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = { portal2027: { evaluacion: {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/core/portal2027-aprobados-core.js'), 'utf8'), ctx);
const esc = ctx.portal2027.aprobadosCore.esc;
test('escapa caracteres peligrosos en HTML y atributos', () => {
 assert.equal(esc(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
 assert.equal(esc(null), '');
});
test('impide cerrar atributos con comillas simples', () => {
 assert.equal(esc("' onmouseover='alert(1)"), '&#39; onmouseover=&#39;alert(1)');
});
