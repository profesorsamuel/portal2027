const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pages = ['index.html',...fs.readdirSync(path.join(__dirname,'../pages')).filter(x=>x.endsWith('.html')).map(x=>'pages/'+x),'pages/ejercicios/portal2027-ejemplo-suma.html'];
for (const file of pages) test('CSP: '+file,()=>{
 const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
 assert.ok(head,'head presente');
 const meta=head.match(/^\s*<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
 assert.ok(meta,'CSP debe ser primera etiqueta');
 const policy=meta[1]; const scripts=policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]||'';
 assert.ok(!scripts.includes("'unsafe-inline'")&&!scripts.includes("'unsafe-eval'"));
 assert.ok(scripts.includes("'self'"));
 assert.equal(scripts.includes('https://cdn.jsdelivr.net'),!file.includes('prompt-planificacion'));
 assert.equal(scripts.includes('https://cdn.sheetjs.com'),/portal2027-(admin|libreta)\.html/.test(file));
 assert.equal(policy.includes('connect-src \'self\' https://gwxghgpsgvaletrqmwcn.supabase.co'),!file.includes('prompt-planificacion'));
 assert.equal(/img-src[^;]*https:\/\/gwxghgpsgvaletrqmwcn.supabase.co/.test(policy),/portal2027-(admin|clases|estudiante|profesor)\.html/.test(file));
});
