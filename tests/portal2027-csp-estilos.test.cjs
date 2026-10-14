'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const raiz=path.resolve(__dirname,'..');
for(const archivo of ['index.html',...fs.readdirSync(path.join(raiz,'pages')).filter(f=>f.endsWith('.html')).map(f=>'pages/'+f),...fs.readdirSync(path.join(raiz,'pages/ejercicios')).filter(f=>f.endsWith('.html')).map(f=>'pages/ejercicios/'+f)]){
 test('CSP sin estilos inline: '+archivo,()=>{const html=fs.readFileSync(path.join(raiz,archivo),'utf8');assert.doesNotMatch(html,/<style\b|\sstyle\s*=/i);for(const m of html.matchAll(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi))assert.doesNotMatch(m[0],/unsafe-inline/i);});
}
