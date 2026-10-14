const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');
const sri='sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
const vendor=fs.readFileSync(path.join(raiz,'js/vendor/xlsx-0.20.3.full.min.js'));
assert.equal('sha384-'+crypto.createHash('sha384').update(vendor).digest('base64'),sri);
const biblioteca={};biblioteca.window=biblioteca;
vm.createContext(biblioteca);vm.runInContext(vendor.toString(),biblioteca);
assert.equal(biblioteca.XLSX.version,'0.20.3');
const wb=biblioteca.XLSX.utils.book_new();
biblioteca.XLSX.utils.book_append_sheet(wb,biblioteca.XLSX.utils.aoa_to_sheet([['Nota'],[4.5]]),'Importar');
const bytes=biblioteca.XLSX.write(wb,{type:'array',bookType:'xlsx'});
const leido=biblioteca.XLSX.read(bytes,{type:'array'});
assert.equal(biblioteca.XLSX.utils.sheet_to_json(leido.Sheets.Importar,{header:1})[1][0],4.5);
const scripts=[],timers=new Map();let id=0;
const ctx={window:{portal2027:{}},URL,console:{error(){}},
 setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i),
 document:{currentScript:{src:'https://example.test/portal2027/js/core/portal2027-excel.js'},
 createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:sc=>scripts.push(sc)}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-excel.js'),'utf8'),ctx);
const tick=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
(async()=>{
 const cargar=ctx.window.portal2027.cargarExcel;
 const uno=cargar(), dos=cargar();assert.strictEqual(uno,dos,'Comparte una carga concurrente');
 assert(scripts[0].src.startsWith('https://cdn.sheetjs.com/xlsx-0.20.3/'));
 assert.equal(scripts[0].integrity,sri);assert.equal(scripts[0].crossOrigin,'anonymous');
 scripts[0].onerror();await tick();assert.equal(scripts.length,2);
 assert.equal(scripts[1].src,'https://example.test/portal2027/js/vendor/xlsx-0.20.3.full.min.js?v=20261014');
 assert.equal(scripts[1].integrity,sri);
 ctx.window.XLSX={version:'0.20.3',read(){},utils:{}};scripts[1].onload();
 assert.strictEqual(await uno,ctx.window.XLSX);assert.strictEqual(await cargar(),ctx.window.XLSX);
 delete ctx.window.XLSX;
 // Nueva carga: simular versión inválida seguida de timeout de copia local.
 // El cargador existente conserva su promesa exitosa: reiniciar refleja una página nueva.
 vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-excel.js'),'utf8'),ctx);
 const nuevo=ctx.window.portal2027.cargarExcel();nuevo.catch(()=>{});
 ctx.window.XLSX={version:'otra',read(){},utils:{}};scripts[2].onload();await tick();
 assert.equal(scripts.length,4);delete ctx.window.XLSX;
 [...timers.values()].at(-1)();
 await assert.rejects(nuevo,/No se pudo abrir Excel/);
 await tick();const reintento=ctx.window.portal2027.cargarExcel();reintento.catch(()=>{});assert.equal(scripts.length,5);
 scripts[4].onerror();await tick();scripts[5].onerror();await assert.rejects(reintento);
 console.log('OK: SRI de copia local, Excel real de ida/vuelta, CDN fijo, fallback, concurrencia, timeout y reintento.');
})().catch(e=>{console.error(e);process.exitCode=1;});
