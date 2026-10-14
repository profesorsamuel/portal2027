const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');
class Nodo{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};this.style={};this.value='';this._texto='';}
 set textContent(t){this._texto=String(t);this.children=[];}get textContent(){return this._texto+this.children.map(n=>n.textContent).join('');}
 get firstChild(){return this.children[0]||null;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='type')this.type=String(v);}getAttribute(k){return this.attrs[k]||'';}
 appendChild(n){this.children.push(n);return n;}insertBefore(n,antes){const i=this.children.indexOf(antes);this.children.splice(i<0?0:i,0,n);return n;}
 addEventListener(k,fn){this.events[k]=fn;}removeEventListener(k,fn){if(this.events[k]===fn)delete this.events[k];}
 querySelectorAll(){return this.encabezados||[];}todos(){return[this,...this.children.flatMap(n=>n.todos())];}
}
const clases=new Set(),document={body:new Nodo('body'),createElement:t=>new Nodo(t),createTextNode:t=>{const n=new Nodo('#text');n.textContent=t;return n;}};
document.body.classList={add:c=>clases.add(c),remove:c=>clases.delete(c)};
const ctx={window:{},document};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-permisos.js'),'utf8'),ctx);
const modulo=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-vista.js'),'utf8');vm.runInContext(modulo,ctx);
const P=ctx.window.portal2027,datos=new Map();let redibujos=0;
const S={asig:{id:'grupo1'},trimestreId:'tr1',verOcultas:false,filtroCat:'',buscar:'',
 evals:[{id:'a',categoria:'ejercicio_escrito'},{id:'b',categoria:'ejercicio_escrito',oculta:true},{id:'pap',categoria:'ejercicio_escrito',eliminada_en:'fecha'}],
 mats:[{id:'m1',estudiante:{codigo:'001',nombres:'Ana'}},{id:'m2',estudiante:{codigo:'002',nombres:'Luis'}}]};
const M={CATEGORIAS:['ejercicio_escrito'],ETIQUETAS:{ejercicio_escrito:'Ejercicios'}};
const servicio={estado:S,evaluacion:M,el:P.el,nombreEst:e=>e.nombres,dibujarTabla:()=>redibujos++,documento:document,
 almacenamiento:{getItem:k=>datos.get(k)||null,setItem:(k,v)=>datos.set(k,v)}};
const vista=P.libretaVista.crear(servicio);
vista.leerVista();assert(vista.estaVisible(S.evals[0]));assert(!vista.estaVisible(S.evals[1]));
vista.ponerVista(S.evals[0],false);assert(!vista.estaVisible(S.evals[0]));assert(JSON.parse(datos.get('portal2027-vista-columnas-grupo1-tr1')).a);assert.equal(redibujos,1);
vista.vistaRapida('todas');assert(vista.estaVisible(S.evals[0]));assert(vista.estaVisible(S.evals[1]));assert(S.verOcultas);
vista.vistaRapida('ninguna');assert(!vista.estaVisible(S.evals[0]));
const barra=vista.barraGanchosColumnas();assert.equal(barra.todos().filter(n=>n.type==='checkbox').length,2,'No incluye papelera');
const gancho=barra.todos().find(n=>n.attrs['aria-label']==='Mostrar columna E2');gancho.checked=true;gancho.events.change();assert(vista.estaVisible(S.evals[1]));
const panel=vista.panelColumnas();const encontrar=t=>panel.elemento.todos().find(n=>n.tag==='button'&&n.textContent===t);
encontrar('Ninguno').events.click();assert(vista.estudianteOculto('m1'));assert(vista.estudianteOculto('m2'));
encontrar('✓ Todos').events.click();assert(!vista.estudianteOculto('m1'),'Reset conserva acceso al estado vivo');
let checks=panel.elemento.todos().filter(n=>n.type==='checkbox');checks[0].checked=false;checks[0].events.change();assert(vista.estudianteOculto('m1'));
const buscar=panel.elemento.todos().find(n=>n.type==='search');buscar.value='Luis';buscar.events.input();assert.equal(panel.elemento.todos().filter(n=>n.type==='checkbox').length,1);
encontrar('Cerrar').events.click();assert(panel.elemento.hidden);
// La lista de la libreta consulta al servicio, sin retener una copia de ocultos.
const fuente=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta.js'),'utf8');
const c={S,vista,nombreEst:servicio.nombreEst};vm.createContext(c);vm.runInContext(fuente.slice(fuente.indexOf('  function matsVisibles()'),fuente.indexOf('  function evalPorId('))+'\nthis.lista=matsVisibles;',c);
assert.equal(c.lista().length,1);encontrar('✓ Todos').events.click();assert.equal(c.lista().length,2);
// Cambiar contexto usa claves distintas; volver restaura las mismas preferencias.
vista.ponerVista(S.evals[0],false);S.asig.id='grupo2';vista.leerVista();assert(vista.estaVisible(S.evals[0]));S.asig.id='grupo1';vista.leerVista();assert(!vista.estaVisible(S.evals[0]));
function tabla(){const t=new Nodo('table');t.encabezados=[new Nodo('th'),new Nodo('th')];return t;}
S.verOcultas=true;let t=tabla(),igualar=vista.iniciarRedimension(t,S.evals.slice(0,2));
assert.equal(t.children[0].children[0].style.width,'185px');assert.equal(t.children[0].children[1].style.width,'125px');
const agarrador=t.encabezados[0].children[0];
const ev=(type,x)=>({type,button:0,clientX:x,pointerId:1,preventDefault(){},stopPropagation(){}});
agarrador.events.pointerdown(ev('pointerdown',100));assert(clases.has('libreta-redimensionando'));agarrador.events.pointermove(ev('pointermove',80));assert.equal(t.children[0].children[1].style.width,'105px');agarrador.events.pointerup(ev('pointerup',20));
assert(!clases.has('libreta-redimensionando'));assert.equal(JSON.parse(datos.get('portal2027-anchos-grupo1-tr1')).a,82,'Límite mínimo conservado');
igualar(200);const guardado=JSON.parse(datos.get('portal2027-anchos-grupo1-tr1'));assert.equal(guardado.__uniforme,200);assert(!('a'in guardado));assert.equal(t.children[0].children[2].style.width,'200px');
t=tabla();igualar=vista.iniciarRedimension(t,S.evals.slice(0,2));assert.equal(t.children[0].children[1].style.width,'200px','Persiste al reconstruir tabla');igualar(999);assert.equal(t.children[0].children[1].style.width,'350px');
S.trimestreId='tr2';t=tabla();vista.iniciarRedimension(t,S.evals.slice(0,2));assert.equal(t.children[0].children[1].style.width,'125px','Anchos independientes por trimestre');
datos.set('portal2027-vista-columnas-grupo1-tr2','JSON roto');datos.set('portal2027-anchos-grupo1-tr2','JSON roto');vista.leerVista();assert(vista.estaVisible(S.evals[0]));assert.equal(Object.keys(vista.leerAnchos()).length,0);
const sinAlmacen=P.libretaVista.crear({...servicio,almacenamiento:{getItem(){throw Error('bloqueado');},setItem(){throw Error('bloqueado');}}});sinAlmacen.leerVista();sinAlmacen.ponerVista(S.evals[0],false);assert(!sinAlmacen.estaVisible(S.evals[0]));
if(process.argv[2]){const anterior=fs.readFileSync(path.resolve(process.argv[2]),'utf8');for(const[a,b]of[['  // Preferencias visuales locales:','  function visibles()'],['  // Casillas compactas sobre la tabla:','  function cabeceraColumna('],['  // Anchos independientes por columna;','  function dibujarTabla()']])assert(modulo.includes(anterior.slice(anterior.indexOf(a),anterior.indexOf(b,anterior.indexOf(a)))),'Bloque visual conservado');}
console.log('OK: ganchos, estudiantes, búsqueda, estado vivo, grupo/trimestre, arrastre, igualar anchos, persistencia y almacenamiento no disponible.');
