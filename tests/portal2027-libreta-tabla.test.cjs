const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');
class Nodo{constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.value='';this._texto='';}set textContent(t){this._texto=String(t);this.children=[];}get textContent(){return this._texto+this.children.map(n=>n.textContent).join('');}appendChild(n){this.children.push(n);return n;}setAttribute(k,v){this.attrs[k]=String(v);if(k==='type')this.type=String(v);}getAttribute(k){return this.attrs[k]||'';}addEventListener(k,fn){this.events[k]=fn;}todos(){return[this,...this.children.flatMap(n=>n.todos())];}blur(){this.blurred=true;}}
const ctx={window:{},document:{body:new Nodo('body'),createElement:t=>new Nodo(t),createTextNode:t=>{const n=new Nodo('#text');n.textContent=t;return n;}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-permisos.js'),'utf8'),ctx);
const modulo=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-tabla.js'),'utf8');vm.runInContext(modulo,ctx);
const P=ctx.window.portal2027;
const S={cerrado:false,filtroCat:'',planEv:{a:1},notas:{'a|m':{valor:4}},mats:[{id:'m',estudiante:{nombres:'<img onerror=alert(1)>'}}],evals:[{id:'a',categoria:'ejercicio_escrito',tema:'Tema'},{id:'b',categoria:'apreciacion',semana:1},{id:'c',categoria:'ejercicio_escrito',bloqueada:true},{id:'oc',categoria:'ejercicio_escrito'},{id:'pap',categoria:'ejercicio_escrito',eliminada_en:'fecha'}]};
const M={CATEGORIAS:['ejercicio_escrito','apreciacion'],ETIQUETAS:{ejercicio_escrito:'Ejercicios',apreciacion:'Apreciación'}};
const llamadas=[];let textoFinal='Final existente';
const registrar=n=>(...a)=>llamadas.push({n,a});
const api=P.libretaTabla.crear({estado:S,evaluacion:M,el:P.el,clave:(a,b)=>a+'|'+b,nombreEst:e=>e.nombres,
 resultado:()=>({categorias:{ejercicio_escrito:{texto:'Promedio existente'},apreciacion:{texto:'Otro promedio'}},textoFinal}),estaVisible:e=>e.id!=='oc',matsVisibles:()=>S.mats,
 guardarCelda:registrar('guardar'),moverFoco:()=>false,cambiarTema:registrar('tema'),cambiarTipo:registrar('tipo'),numeroEscrito:()=>1,semanaActiva:()=>false,abrirDesglose:registrar('desglose'),alternarBloqueo:registrar('bloqueo'),aviso:registrar('aviso'),textoPlan:()=> 'Ligada a planificación',aPapelera:registrar('papelera'),agregarColumna:registrar('agregar'),iniciarRedimension:()=>registrar('igualar'),leerAnchos:()=>({__uniforme:125}),barraGanchosColumnas:()=>new Nodo('div'),tiposApreciacion:['Tarea']});
const zona=new Nodo('div');api.dibujarTabla(zona);
const todos=()=>zona.todos();const buscar=fn=>todos().find(fn);
assert.equal(todos().filter(n=>n.className==='col-eval').length,3,'Respeta columnas ocultas y papelera');assert(zona.textContent.includes('Promedio existente'));assert(zona.textContent.includes('Final existente'));assert(!todos().some(n=>n.tag==='img'));
const inputs=todos().filter(n=>n.className==='nota-input');assert.equal(inputs.length,3);assert.equal(inputs[0].value,'4');assert(inputs[1].disabled);assert(inputs[2].disabled);assert(!inputs[2].events.change,'Semana automática no escribe directamente');
inputs[0].value='4.5';inputs[0].events.change();assert.equal(llamadas[0].n,'guardar');assert.equal(llamadas[0].a[0].id,'a');assert.equal(llamadas[0].a[1].id,'m');assert.strictEqual(llamadas[0].a[2],inputs[0]);
const tema=buscar(n=>n.className==='tema-input');tema.value='Nuevo tema';tema.events.change();assert.equal(llamadas.at(-1).n,'tema');
buscar(n=>n.tag==='button'&&n.textContent==='Desglose').events.click();assert.equal(llamadas.at(-1).n,'desglose');
buscar(n=>n.tag==='button'&&n.textContent==='🔗').events.click();assert.equal(llamadas.at(-1).n,'aviso');
buscar(n=>n.tag==='button'&&n.textContent==='Igualar columnas').events.click();assert.equal(llamadas.at(-1).n,'igualar');
S.abrirImport=registrar('importar');inputs[0].events.paste({clipboardData:{getData:()=> '4\n5'},preventDefault(){}});assert.equal(llamadas.at(-1).n,'importar');assert.equal(llamadas.at(-1).a[0].evId,'a');assert.equal(llamadas.at(-1).a[0].inicio,0);
textoFinal='Final actualizado';api.actualizarFila('m');assert(zona.textContent.includes('Final actualizado'));api.actualizarFila('no-existe');
const zonaNueva=new Nodo('div');api.dibujarTabla(zonaNueva);textoFinal='Otro valor';api.actualizarFila('m');assert(zonaNueva.textContent.includes('Otro valor'));assert(!zona.textContent.includes('Otro valor'),'Actualizar usa las filas de la tabla actual');
S.filtroCat='apreciacion';api.dibujarTabla(zona);assert.equal(todos().filter(n=>n.className==='col-eval').length,1);assert.equal(todos().filter(n=>n.className==='nota-input').length,1);
S.cerrado=true;api.dibujarTabla(zona);assert(buscar(n=>n.className==='nota-input').disabled);assert(buscar(n=>n.textContent==='+').disabled);
S.mats=[];S.evals=[];api.dibujarTabla(zona);assert(zona.textContent.includes('todavía no tiene estudiantes'));assert(zona.textContent.includes('Aún no hay columnas'));
if(process.argv[2]){const anterior=fs.readFileSync(path.resolve(process.argv[2]),'utf8');for(const[a,b]of[['  function visibles()','  var desglose ='],['  function cabeceraColumna(','  var historial =']])assert(modulo.includes(anterior.slice(anterior.indexOf(a),anterior.indexOf(b,anterior.indexOf(a)))));}
// Arranque del módulo completo: todas las dependencias se inicializan en orden.
const zonaInicio=new Nodo('div');
const docInicio={body:new Nodo('body'),createElement:t=>new Nodo(t),createTextNode:t=>{const n=new Nodo('#text');n.textContent=t;return n;},getElementById:()=>zonaInicio};
const arranque={window:{location:{href:'https://example.test/portal2027/pages/portal2027-libreta.html',search:''}},document:docInicio,URL,URLSearchParams,console};
vm.createContext(arranque);
vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-permisos.js'),'utf8'),arranque);
arranque.window.portal2027.db=null;arranque.window.portal2027.evaluacion=M;arranque.window.portal2027.errorCarga='Conexión de prueba no disponible';
for(const mod of ['importacion','teclado','vista','historial','desglose','tabla'])vm.runInContext(fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-'+mod+'.js'),'utf8'),arranque);
vm.runInContext(fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta.js'),'utf8'),arranque);
assert(zonaInicio.textContent.includes('Conexión de prueba no disponible'),'Inicializa servicios y alcanza la comprobación de conexión');
console.log('OK: tabla, filtros, restricciones, servicios de guardado/cálculo, texto seguro, pegado, anchos y referencias de filas tras redibujar.');
