const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..');
const ctx={window:{portal2027:{}}};vm.createContext(ctx);
const modulo=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-teclado.js'),'utf8');vm.runInContext(modulo,ctx);
const mover=ctx.window.portal2027.libretaTeclado.moverFoco;
function tabla(){
 let activo=null, cambios=[];
 const filas=Array.from({length:4},(_,f)=>({f,celdas:[],querySelectorAll(){return this.celdas;}}));
 filas.forEach((tr,f)=>{
   tr.nextElementSibling=filas[f+1]||null;tr.previousElementSibling=filas[f-1]||null;
   tr.celdas=Array.from({length:3},(_,c)=>{
     const td={parentNode:tr,querySelector(){return this.input;}};
     td.input={id:f+':'+c,disabled:false,value:'4.5',selectionStart:0,selectionEnd:3,
       closest(){return td;},focus(){if(activo&&activo!==this)cambios.push(activo.id);activo=this;},select(){this.seleccionado=true;},blur(){this.blurred=true;}};return td;
   });
 });
 return {filas,input:(f,c)=>filas[f].celdas[c].input,cambios,activar(i){activo=i;},actual:()=>activo};
}
let t=tabla();t.activar(t.input(0,1));assert(mover(t.input(0,1),1,0));assert.equal(t.actual().id,'1:1');assert(t.actual().seleccionado);assert.deepEqual(t.cambios,['0:1']);
t=tabla();t.input(1,1).disabled=true;t.activar(t.input(0,1));assert(mover(t.input(0,1),1,0));assert.equal(t.actual().id,'2:1','Salta celdas deshabilitadas');
assert(mover(t.input(2,1),-1,0));assert.equal(t.actual().id,'0:1');
t=tabla();t.input(0,1).disabled=true;t.activar(t.input(0,0));assert(mover(t.input(0,0),0,1));assert.equal(t.actual().id,'0:2');assert(mover(t.input(0,2),0,-1));assert.equal(t.actual().id,'0:0');
assert.equal(mover(t.input(0,0),-1,0),false);assert.equal(mover(t.input(0,0),0,-1),false);assert.equal(mover(t.input(3,2),1,0),false);assert.equal(mover(t.input(3,2),0,1),false);
// Los eventos reales de celdaNota conservan sus reglas y usan el servicio extraído.
const fuenteEventos=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta-tabla.js'),'utf8');
const fuente=fs.readFileSync(path.join(raiz,'js/modulos/portal2027-libreta.js'),'utf8');
const ini=fuenteEventos.indexOf("    input.addEventListener('keydown'");const fin=fuenteEventos.indexOf('\n    });',ini)+8;
function evento(input,key,shiftKey=false){let listener,prevenido=false;input.addEventListener=(n,fn)=>{listener=fn;};const c={input,moverFoco:mover};vm.createContext(c);vm.runInContext(fuenteEventos.slice(ini,fin),c);listener({key,shiftKey,preventDefault(){prevenido=true;}});return prevenido;}
t=tabla();t.activar(t.input(0,0));assert(evento(t.input(0,0),'Enter'));assert.equal(t.actual().id,'1:0');assert(evento(t.input(1,0),'Enter',true));assert.equal(t.actual().id,'0:0');
assert(evento(t.input(0,0),'ArrowDown'));assert.equal(t.actual().id,'1:0');assert(evento(t.input(1,0),'ArrowUp'));assert.equal(t.actual().id,'0:0');
const input=t.input(0,0);input.selectionEnd=1;assert.equal(evento(input,'ArrowRight'),false);input.selectionEnd=input.value.length;assert(evento(input,'ArrowRight'));assert.equal(t.actual().id,'0:1');
t.input(0,1).selectionStart=1;assert.equal(evento(t.input(0,1),'ArrowLeft'),false);t.input(0,1).selectionStart=0;assert(evento(t.input(0,1),'ArrowLeft'));assert.equal(t.actual().id,'0:0');
assert.equal(evento(input,'a'),false);assert(evento(t.input(3,0),'Enter'));assert(t.input(3,0).blurred,'Enter al final conserva blur');
if(process.argv[2]){
 const anterior=fs.readFileSync(path.resolve(process.argv[2]),'utf8');const a=anterior.indexOf('  function inputDeFila('),b=anterior.indexOf('  /* ---------- cargar notas',a);
 assert(modulo.includes(anterior.slice(a,b)),'Funciones idénticas');
 assert.equal(fuente.slice(0,fuente.indexOf('  var moverFoco = P.libretaTeclado')),anterior.slice(0,a));
 assert.equal(fuente.slice(fuente.indexOf('  /* ---------- cargar notas')),anterior.slice(b));
}
console.log('OK: Enter/Shift+Enter, flechas, límites del texto/tabla, celdas deshabilitadas, selección y salida de celda.');
