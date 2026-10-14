const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');
class Nodo{constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this._texto='';}set textContent(t){this._texto=String(t);this.children=[];}get textContent(){return this._texto+this.children.map(n=>n.textContent).join('');}appendChild(n){this.children.push(n);return n;}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]||'';}addEventListener(k,fn){this.events[k]=fn;}todos(){return[this,...this.children.flatMap(n=>n.todos())];}}
const ctx={window:{},document:{body:new Nodo('body'),createElement:t=>new Nodo(t),createTextNode:t=>{const n=new Nodo('#text');n.textContent=t;return n;}}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-permisos.js'),'utf8'),ctx);
const modulo=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-historial.js'),'utf8');vm.runInContext(modulo,ctx);
const P=ctx.window.portal2027;
const cambio={id:'h',matricula_id:'m',evaluacion_id:'e',valor_anterior:3.5,valor_nuevo:4,version:6,motivo:'<img onerror=alert(1)>',creado_en:'2026-10-14T12:00:00Z'};
function entorno(extra={}){
 const S={asig:{id:'g'},trimestreId:'tr',cerrado:false,notas:{'e|m':{valor:4,version:7}},mats:[{id:'m',estudiante:{nombres:'Ana'}}],evals:[{id:'e',categoria:'ejercicio',tema:'Prueba'},{id:'pap',categoria:'ejercicio',eliminada_en:'fecha'}],...extra};
 const rpcs=[],restauraciones=[],avisos=[],consulta=[];let recargas=0,dibujos=0,motivo='  corrección  ',errorRPC=null,filas=[cambio],errorConsulta=null;
 P.pedirTexto=async()=>motivo;
 const db={rpc:async(n,a)=>{rpcs.push({n,a});return errorRPC?{error:errorRPC}:{data:{}};},from:tabla=>{
  const q={select(s){consulta.push(['select',tabla,s]);return q;},eq(k,v){consulta.push(['eq',k,v]);return q;},order(k,v){consulta.push(['order',k,v]);return q;},limit(n){consulta.push(['limit',n]);return q;},then(ok,mal){return Promise.resolve(errorConsulta?{error:errorConsulta}:{data:filas}).then(ok,mal);}};return q;}};
 const servicio={estado:S,evaluacion:{ETIQUETAS:{ejercicio:'Ejercicio'}},el:P.el,db,clave:(a,b)=>a+'|'+b,aPapelera:(e,si)=>restauraciones.push({e,si}),
 conDialogo:async(k,fn)=>fn(),aviso:(t,tipo)=>avisos.push({t,tipo}),cargarLibreta:async()=>recargas++,dibujar:()=>dibujos++,textoError:()=> 'Datos cambiaron; recargue.',
 consultar:async q=>{const r=await q;if(r.error)throw r.error;return r.data;},evalPorId:id=>S.evals.find(e=>e.id===id),nombreEst:e=>e.nombres};
 const api=P.libretaHistorial.crear(servicio);
 return {S,api,rpcs,avisos,consulta,restauraciones,motivo:v=>motivo=v,error:v=>errorRPC=v,filas:v=>filas=v,errorConsulta:v=>errorConsulta=v,contadores:()=>({recargas,dibujos})};
}
async function boton(e){const zona=new Nodo('div');await e.api.dibujarHistorial(zona);return{zona,b:zona.todos().find(n=>n.tag==='button'&&n.textContent==='Recuperar')};}
(async()=>{
 let e=entorno();let papelera=e.api.dibujarPapelera();assert(papelera.textContent.includes('Papelera (1)'));papelera.todos().find(n=>n.tag==='button').events.click();assert.equal(e.restauraciones[0].si,false);assert.equal(e.restauraciones[0].e.id,'pap');
 e=entorno({cerrado:true});assert(e.api.dibujarPapelera().todos().find(n=>n.tag==='button').disabled);e=entorno({evals:[]});assert(e.api.dibujarPapelera().textContent.includes('vacía'));
 for(const estado of [{cerrado:true},{evals:[]},{evals:[{id:'e',eliminada_en:'fecha'}]},{evals:[{id:'e',bloqueada:true}]},{notas:{}}]){e=entorno(estado);assert((await boton(e)).b.disabled,'Restricción conserva botón deshabilitado');}
 e=entorno();let {zona,b}=await boton(e);assert(!b.disabled);assert(!zona.todos().some(n=>n.tag==='img'));assert(zona.textContent.includes(cambio.motivo));assert(e.consulta.some(x=>x[0]==='eq'&&x[1]==='evaluacion.asignacion_id'&&x[2]==='g'));assert(e.consulta.some(x=>x[0]==='limit'&&x[1]===100));
 e.motivo(null);await b.events.click();assert.equal(e.rpcs.length,0);e.motivo('  ');await b.events.click();assert.equal(e.rpcs.length,0);assert(e.avisos.at(-1).t.includes('motivo'));
 e.motivo('  corrección  ');await b.events.click();assert.equal(e.rpcs[0].n,'portal2027_recuperar_nota');assert.deepEqual(JSON.parse(JSON.stringify(e.rpcs[0].a)),{p_historial:'h',p_version:7,p_motivo:'corrección'});assert.deepEqual(e.contadores(),{recargas:1,dibujos:1});assert(e.S.abrirHistorial);assert.equal(e.avisos.at(-1).tipo,'ok');
 e=entorno();({b}=await boton(e));e.error({message:'CONFLICTO'});await b.events.click();assert.deepEqual(e.contadores(),{recargas:0,dibujos:0});assert.equal(e.avisos.at(-1).tipo,'error');assert(!e.S.abrirHistorial);
 e=entorno();e.filas([]);({zona}=await boton(e));assert(zona.textContent.includes('Todavía no hay cambios'));
 e.errorConsulta({message:'fallo'});({zona}=await boton(e));assert(zona.textContent.includes('No se pudo cargar el historial'));
 e=entorno();e.S.asig.id='otro';e.S.trimestreId='tr2';await boton(e);assert(e.consulta.some(x=>x[0]==='eq'&&x[2]==='otro'));assert(e.consulta.some(x=>x[0]==='eq'&&x[2]==='tr2'));
 if(process.argv[2]){const anterior=fs.readFileSync(path.resolve(process.argv[2]),'utf8');const a=anterior.indexOf('  function dibujarPapelera()'),b=anterior.indexOf('  function dibujar() {',a);assert(modulo.includes(anterior.slice(a,b)));const fuente=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta.js'),'utf8');assert.equal(fuente.slice(0,fuente.indexOf('  var historial = P.libretaHistorial')),anterior.slice(0,a));assert.equal(fuente.slice(fuente.indexOf('  function dibujar() {')),anterior.slice(b));}
 console.log('OK: papelera, restricciones, motivos, versión enviada, recuperación, error/conflicto, filtros del historial y texto seguro.');
})().catch(e=>{console.error(e);process.exitCode=1;});
