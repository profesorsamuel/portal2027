const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');let documento;
class Nodo{
 constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.dataset={};this.attrs={};this._texto='';this._valor='';const c=new Set();this.classList={add:k=>c.add(k),remove:k=>c.delete(k)};}
 set value(v){this._valor=String(v);}get value(){return this._valor;}
 set textContent(t){this._texto=String(t);this.children=[];}get textContent(){return this._texto+this.children.map(n=>n.textContent).join('');}
 appendChild(n){this.children.push(n);n.parentNode=this;return n;}append(...h){h.forEach(n=>this.appendChild(typeof n==='string'?Object.assign(new Nodo('#text'),{textContent:n}):n));}
 setAttribute(k,v){this.attrs[k]=String(v);}addEventListener(k,fn){this.events[k]=fn;}dispatchEvent(e){if(this.events[e.type])return this.events[e.type](e);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
 showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent({type:'close'});}focus(){documento.activeElement=this;}blur(){documento.activeElement=null;}select(){this.selected=true;}
 todos(){return[this,...this.children.flatMap(n=>n.todos())];}
 querySelector(s){const m=/input\[data-fila="(\d+)"\]\[data-col="(\d+)"\]/.exec(s);return m?this.todos().find(n=>n.tag==='input'&&n.dataset.fila===m[1]&&n.dataset.col===m[2])||null:null;}
}
const ctx={window:{portal2027:{}},setTimeout,Event:class{constructor(type){this.type=type;}}};vm.createContext(ctx);
const modulo=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-desglose.js'),'utf8');vm.runInContext(modulo,ctx);
const P=ctx.window.portal2027;
function entorno(extra={}){
 documento={body:new Nodo('body'),activeElement:null,createElement:t=>new Nodo(t)};
 const S={asig:{id:'g'},cerrado:false,mats:[{id:'m1',estudiante:{nombres:'Ana'}},{id:'m2',estudiante:{nombres:'Luis'}}],notas:{'e|m1':{valor:4,version:1}},...extra};
 const ev={id:'e',semana:1,semana_inicio:'2026-10-12',semana_fin:'2026-10-16'};
 let registros=[{id:'r1',grupo:'uno',matricula_id:'m1',tipo:'Tarea',descripcion:'Mismo texto',valor:4,version:2},{id:'r2',grupo:'dos',matricula_id:'m1',tipo:'Tarea',descripcion:'Mismo texto',valor:3,version:1}],fallo=false,recargas=0,respuestas=[];
 const llamadas=[],avisos=[];
 P.aviso=(t,tipo)=>avisos.push({t,tipo});P.traducirError=()=> 'Error simulado';P.confirmar=async()=>respuestas.length?respuestas.shift():false;P.pedirTexto=async()=>respuestas.length?respuestas.shift():null;
 const config={base:5,descuento_mal:0.5,descuento_ausencia:0.5,descuento_tardanza:0.25,bono_bien:0,minimo:1};
 const db={from:tabla=>{const q={select(){return q;},eq(){return q;},maybeSingle(){return q;},then(ok,mal){const data=tabla==='portal2027_registros_semana'?registros:tabla==='portal2027_config_conducta_semanal'?config:{valor:4.5,version:3};return Promise.resolve({data}).then(ok,mal);}};return q;},rpc:async(n,a)=>{llamadas.push({n,a});if(fallo)return{error:{message:'CONFLICTO'}};return{data:{id:'nuevo',version:3,creados:0,actualizados:1}};}};
 const api=P.libretaDesglose.crear({estado:S,db,textoError:()=> 'Error simulado',conDialogo:async(k,fn)=>fn(),recargar:async()=>recargas++,nombreEst:e=>e.nombres,clave:(a,b)=>a+'|'+b,documento});
 return{api,S,ev,db,llamadas,avisos,doc:documento,responder:(...r)=>respuestas=r,error:v=>fallo=v,registros:r=>registros=r,recargas:()=>recargas};
}
const esperar=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
const boton=(d,t)=>d.body.todos().find(n=>n.tag==='button'&&n.textContent===t);
const input=(d,f,c)=>d.body.querySelector(`input[data-fila="${f}"][data-col="${c}"]`);
(async()=>{
 let e=entorno();assert(!e.api.semanaActiva({}));assert(e.api.semanaActiva({semana_inicio:'1900-01-01',semana_fin:'2999-12-31'}));
 await e.api.abrirDesglose(e.ev);await esperar();assert.equal(e.doc.body.todos().filter(n=>n.className==='col-registro').length,2,'Registros del mismo tipo/descripción mantienen grupos separados');assert.equal(e.llamadas.length,0);
 let inp=input(e.doc,0,1);assert.equal(inp.type,'text');inp.value='4,5';await inp.events.change();assert.equal(e.llamadas[0].n,'portal2027_guardar_registro_semana');assert.equal(e.llamadas[0].a.p_version,2);assert.equal(e.llamadas[0].a.p_valor,4.5);assert.equal(e.S.notas['e|m1'].valor,4.5);assert.equal(e.recargas(),1);
 await inp.events.change();assert.equal(e.llamadas.length,1,'No duplica un valor ya enviado');inp.value='9';await inp.events.change();assert.equal(e.llamadas.length,1);assert.equal(inp.value,'4.5');assert(e.avisos.at(-1).t.includes('0 y 5'));
 inp=input(e.doc,1,1);inp.value='3.5';await inp.events.change();assert.equal(e.llamadas[1].a.p_id,null);assert.equal(e.llamadas[1].a.p_version,0);assert.equal(e.llamadas[1].a.p_grupo,'uno');
 e.error(true);inp.value='2';await inp.events.change();assert.equal(inp.value,'3.5','Error restaura valor anterior');e.error(false);
 const cerrar=boton(e.doc,'Cerrar y actualizar libreta');cerrar.onclick();assert.equal(e.doc.body.children.length,0);
 e=entorno({cerrado:true});await e.api.abrirDesglose(e.ev);await esperar();assert(input(e.doc,0,0).disabled);assert(boton(e.doc,'+ Agregar registro').disabled);assert(boton(e.doc,'Traer asistencia y comportamiento').disabled);assert(boton(e.doc,'Ajustar descuentos').disabled);
 e=entorno();e.registros([{id:'cond',grupo:'cond',matricula_id:'m1',tipo:'Conducta',descripcion:'',valor:4,version:1}]);await e.api.abrirDesglose(e.ev);await esperar();assert(input(e.doc,0,0).disabled,'Conducta sigue automática');
 e=entorno();await e.api.abrirDesglose({...e.ev,semana_inicio:null,semana_fin:null});await esperar();assert(boton(e.doc,'Traer asistencia y comportamiento').disabled);
 e=entorno();e.registros([]);await e.api.abrirDesglose(e.ev);await esperar();assert(e.doc.body.textContent.includes('todavía no tiene registros'));e.responder(null);await boton(e.doc,'+ Agregar registro').onclick();assert.equal(e.llamadas.length,0,'Cancelar no crea registros');
 e=entorno();await e.api.abrirDescuentos();assert.equal(e.llamadas.length,0);const inputs=e.doc.body.todos().filter(n=>n.tag==='input');assert.equal(inputs.length,6);inputs[0].value='-1';await boton(e.doc,'Guardar cambios').onclick();assert.equal(e.llamadas.length,0);assert(e.doc.body.textContent.includes('Revise'));
 inputs[0].value='0.5';await boton(e.doc,'Guardar cambios').onclick();assert.equal(e.llamadas[0].n,'portal2027_guardar_config_conducta');assert.equal(e.llamadas[0].a.p_asignacion,'g');assert.equal(e.llamadas[0].a.p_base,5);assert(boton(e.doc,'Guardar cambios').hidden);boton(e.doc,'Cerrar').onclick();assert.equal(e.doc.body.children.length,0);
 if(process.argv[2]){const anterior=fs.readFileSync(path.resolve(process.argv[2]),'utf8');const a=anterior.indexOf('  // Identificador para una columna nueva'),b=anterior.indexOf('  function cabeceraColumna(',a);assert(modulo.includes(anterior.slice(a,b)));const fuente=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta.js'),'utf8');assert.equal(fuente.slice(0,fuente.indexOf('  var desglose = P.libretaDesglose')),anterior.slice(0,a));assert.equal(fuente.slice(fuente.indexOf('  function cabeceraColumna(')),anterior.slice(b));}
 console.log('OK: grupos separados, guardado/versiones, duplicación evitada, valor inválido, creación, conflicto, restricciones, cancelación y configuración existente.');
})().catch(e=>{console.error(e);process.exitCode=1;});
