// Interfaz real de importación con DOM simulado; guardado sustituido por un espía.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');
class Nodo {
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.value='';this._texto='';}
  set textContent(t){this._texto=String(t);this.children=[];}
  get textContent(){return this._texto+this.children.map(x=>x.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='type')this.type=String(v);}
  getAttribute(k){return this.attrs[k]||'';}
  appendChild(n){this.children.push(n);if(this.tag==='select'&&(n.selected||this.children.length===1))this.value=n.value;return n;}
  addEventListener(k,fn){this.events[k]=fn;}
  scrollIntoView(){this.scrolled=true;}
  focus(){this.focused=true;}
  todos(){return[this,...this.children.flatMap(x=>x.todos())];}
  set innerHTML(t){throw Error('No se permite interpretar datos como HTML');}
}
const ctx={window:{},document:{body:new Nodo('body'),createElement:t=>new Nodo(t),createTextNode:t=>{const n=new Nodo('#text');n.textContent=t;return n;}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz,'js/core/portal2027-permisos.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-importacion.js'),'utf8'),ctx);
const P=ctx.window.portal2027,I=P.libretaImportacion;
const excel={};excel.window=excel;vm.createContext(excel);vm.runInContext(fs.readFileSync(path.join(raiz,'js/vendor/xlsx-0.20.3.full.min.js'),'utf8'),excel);
const libro=excel.XLSX.utils.book_new();excel.XLSX.utils.book_append_sheet(libro,excel.XLSX.utils.aoa_to_sheet([['Nombre','Nota'],['Ana Pérez',4.5]]),'Primera');excel.XLSX.utils.book_append_sheet(libro,excel.XLSX.utils.aoa_to_sheet([['Otra'],[1]]),'Segunda');
const bytes=excel.XLSX.write(libro,{type:'array',bookType:'xlsx'});
function entorno(estadoExtra={}){
 const mats=[{id:'m1',estudiante:{codigo:'001',nombres:'Ana',apellidos:'Pérez'}},{id:'m2',estudiante:{codigo:'002',nombres:'Luis',apellidos:'Díaz'}},{id:'m3',estudiante:{codigo:'003',nombres:'<img onerror=alert(1)>',apellidos:'Texto'}}];
 const S={cerrado:false,evals:[{id:'e',categoria:'ejercicio_escrito'},{id:'bloq',bloqueada:true},{id:'pap',eliminada_en:'fecha'}],notas:{'e|m1':{valor:4}},...estadoExtra};
 const avisos=[],guardados=[];
 const contexto={estado:S,evaluacion:{ETIQUETAS:{ejercicio_escrito:'Ejercicio'}},el:P.el,aviso:t=>avisos.push(t),numeroEscrito:()=>1,matsVisibles:()=>mats,
 nombreEst:e=>e.apellidos+', '+e.nombres,clave:(a,b)=>a+'|'+b,evalPorId:id=>S.evals.find(x=>x.id===id),cargarExcel:async()=>excel.XLSX,
 guardarImportacion:(items,ev,boton,mensaje,final)=>guardados.push({items,ev,final})};
 const zona=new Nodo('div'),abrir=I.crearInterfaz(contexto);return{zona,abrir,S,contexto,avisos,guardados,buscar:fn=>zona.todos().find(fn)};
}
(async()=>{
 let e=entorno({cerrado:true});e.abrir(e.zona,{});assert.equal(e.zona.children.length,0);assert(e.avisos[0].includes('cerrado'));
 e=entorno({evals:[]});e.abrir(e.zona,{});assert(e.zona.textContent.includes('Primero cree una columna'));assert(!e.buscar(n=>n.type==='file'));
 e=entorno();e.abrir(e.zona,{evId:'e',texto:'4\n5\n8'});
 assert.equal(e.buscar(n=>n.attrs['aria-label']==='Columna destino').children.length,1,'Oculta columnas bloqueadas o eliminadas');
 assert(e.zona.scrolled);assert(e.zona.textContent.includes('Con problema: 1'));
 assert(!e.zona.todos().some(n=>n.tag==='img'),'Nombre con etiquetas es texto');
 assert.equal(e.guardados.length,0,'Revisar no guarda');
 const guardar=e.buscar(n=>n.tag==='button'&&n.textContent==='Guardar 1 nota(s)');guardar.events.click();
 assert.equal(e.guardados.length,1);assert.equal(e.guardados[0].items[0].mat.id,'m2');assert.equal(e.guardados[0].items[0].valor,5);
 e.buscar(n=>n.tag==='button'&&n.textContent==='Cerrar').events.click();assert.equal(e.zona.children.length,0);
 e=entorno();e.abrir(e.zona,{evId:'e'});let area=e.buscar(n=>n.tag==='textarea');assert(area.focused);
 let archivo=e.buscar(n=>n.type==='file');archivo.files=[{name:'notas.txt',text:async()=> '001\t4,5\n002\t3'}];await archivo.events.change();
 assert.equal(area.value,'001\t4,5\n002\t3');assert(e.zona.textContent.includes('Guardar 2 nota(s)'));assert.equal(e.guardados.length,0);
 archivo.files=[{name:'notas.xlsx',arrayBuffer:async()=>bytes}];await archivo.events.change();
 assert(area.value.includes('Ana Pérez\t4.5'));assert(!area.value.includes('Otra'),'Solo primera hoja, como antes');assert.equal(e.guardados.length,0);
 e.contexto.cargarExcel=async()=>{throw Error('simulado');}; // El contexto conserva el servicio inicial; crear nueva interfaz para simular el error.
 const abrirError=I.crearInterfaz(e.contexto);abrirError(e.zona,{evId:'e'});archivo=e.buscar(n=>n.type==='file');archivo.files=[{name:'notas.xlsx',arrayBuffer:async()=>bytes}];await archivo.events.change();
 assert(e.zona.textContent.includes('No se pudo leer el archivo'));assert.equal(e.guardados.length,0);
 // Vista previa con notas iguales: no ofrece escritura.
 e=entorno();e.abrir(e.zona,{evId:'e',texto:'4'});assert(e.buscar(n=>n.tag==='button'&&n.textContent==='Guardar 0 nota(s)').disabled);
 console.log('OK: cierre, columnas disponibles, texto seguro, revisión sin guardar, servicio de guardado, TXT, XLSX real, error de lectura y notas iguales.');
})().catch(err=>{console.error(err);process.exitCode=1;});
