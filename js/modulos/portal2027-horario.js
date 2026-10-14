(()=>{'use strict';const P=window.portal2027,db=P?.db,$=id=>document.getElementById(id),dias=['','Lunes','Martes','Miércoles','Jueves','Viernes'];let user,admin=false,asignaciones=[],horario=[],trimestres=[],exclusiones=[],opciones=[];function msg(t,bad=false){$('estado').textContent=t;$('estado').className='barra-estado '+(bad?'error':'ok')}function esc(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}async function query(q){let r=await q;if(r.error)throw r.error;return r.data}async function rpc(n,args){return query(db.rpc(n,args))}function sel(id,arr,label){$(id).innerHTML=arr.map(x=>`<option value="${esc(x.id)}">${esc(label(x))}</option>`).join('')}function nombre(a){return `${a.salon?.nombre||'?'} · ${a.materia?.nombre||'?'}`}function asigs(){return asignaciones.filter(a=>a.profesor_id===$('profesor').value&&a.salon?.anio_id===$('anio').value)}function syncAsigs(){let a=asigs();sel('asignacion',a,nombre);sel('doble-asignacion',a,nombre);$('asignacion').disabled=!a.length}function dateISO(d){let y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}function parseDate(s){let [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}function formato(f){return f.toLocaleDateString('es-PA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}function validar(filas){if(!Array.isArray(filas)||filas.length>80)throw Error('Se requiere un arreglo de máximo 80 franjas');const a=asigs();let porDia={};return filas.map((f,i)=>{let dia=Number(f.dia),inicio=f.inicio||f.hora_inicio,fin=f.fin||f.hora_fin,tipo=f.tipo,asignacion_id=f.asignacion_id||null;if(!Number.isInteger(dia)||dia<1||dia>5||!/^[0-2]\d:[0-5]\d(?::[0-5]\d)?$/.test(inicio||'')||!/^[0-2]\d:[0-5]\d(?::[0-5]\d)?$/.test(fin||'')||inicio>=fin||!['clase','recreo','consejeria','otro'].includes(tipo))throw Error('Franja '+(i+1)+' inválida');if(tipo==='clase'&&!a.some(x=>x.id===asignacion_id))throw Error('La asignación de la franja '+(i+1)+' no está disponible para este profesor/año. Encontradas: '+a.length+'. Revise el año seleccionado y recargue la página.');if(tipo!=='clase')asignacion_id=null;(porDia[dia]??=[]).push({inicio,fin});return {dia,inicio,fin,tipo,asignacion_id,etiqueta:String(f.etiqueta||'').slice(0,60)}}).sort((a,b)=>a.dia-b.dia||a.inicio.localeCompare(b.inicio)).map((f,i,arr)=>{if(i&&arr[i-1].dia===f.dia&&arr[i-1].fin>f.inicio)throw Error('Hay horarios superpuestos');return f})}function f12(t){let [h,m]=String(t).slice(0,5).split(':').map(Number),x=h%12||12;return `${x}:${String(m).padStart(2,'0')} ${h>=12?'p. m.':'a. m.'}`}
const confirmacionesHorario = new Set();
async function confirmarHorario(llave, titulo, texto, textoBoton, fn) {
  if (confirmacionesHorario.has(llave)) return;
  confirmacionesHorario.add(llave);
  try {
    if (!(await P.confirmar(titulo, texto, textoBoton))) return;
    await fn();
  } finally {
    confirmacionesHorario.delete(llave);
  }
}

function rango(a,b){let [h1,m1]=String(a).slice(0,5).split(':').map(Number),[h2,m2]=String(b).slice(0,5).split(':').map(Number),n=(h,m)=>`${h%12||12}:${String(m).padStart(2,'0')}`,sfx=h=>h>=12?'p.\u00a0m.':'a.\u00a0m.';return (h1>=12)===(h2>=12)?`${n(h1,m1)} – ${n(h2,m2)} ${sfx(h2)}`:`${n(h1,m1)} ${sfx(h1)} – ${n(h2,m2)} ${sfx(h2)}`}
function colorDe(id){let i=asigs().findIndex(a=>a.id===id);return i<0?'':'c'+(i%6)}
function tipoTxt(t){return {clase:'Clase',recreo:'Recreo',consejeria:'Consejería',otro:'Otro'}[t]||t}
function renderFranjas(){let tb=$('franjas');if(!$('anio').value||!$('profesor').value){tb.innerHTML='<tr><td colspan="5">Seleccione año y profesor.</td></tr>';return}
let html='',dia=0;for(let h of horario){if(h.dia!==dia){dia=h.dia;html+=`<tr class="dia-fila"><th colspan="5">${dias[dia]}</th></tr>`}
let a=asignaciones.find(x=>x.id===h.asignacion_id),txt=h.tipo==='clase'?`<span class="grupo-marca ${colorDe(h.asignacion_id)}"></span>${esc(nombre(a||{}))}`:esc(h.etiqueta||tipoTxt(h.tipo));
html+=`<tr><td>${esc(f12(h.hora_inicio))}</td><td>${esc(f12(h.hora_fin))}</td><td><span class="insignia ${esc(h.tipo)}">${esc(tipoTxt(h.tipo))}</span></td><td>${txt}</td><td><button type="button" class="boton" data-editar="${h.id}">Editar</button><button type="button" class="boton" data-borrar="${h.id}">Eliminar</button></td></tr>`}
tb.innerHTML=html||'<tr><td colspan="5">Todavía no hay franjas. Use «Preparar el horario de 2027 con un clic» o agregue una franja.</td></tr>'}
function renderSemana(){let g=$('semana-grid'),res=$('resumen-semana'),hoy=new Date().getDay(),cl=horario.filter(h=>h.tipo==='clase');
if(!horario.length){res.innerHTML='';g.innerHTML='<p class="dia-vacio" style="grid-column:1/-1">Todavía no hay horario guardado. Baje a «Editar horario» y presione «Preparar mis clases».</p>';return}
let conteo={};cl.forEach(h=>conteo[h.asignacion_id]=(conteo[h.asignacion_id]||0)+1);
res.innerHTML=`<div class="ficha total"><b>${cl.length}</b><span>clases por semana</span></div>`+Object.entries(conteo).map(([id,n])=>`<div class="ficha ${colorDe(id)}"><b>${n}</b><span>${esc(nombre(asignaciones.find(a=>a.id===id)||{}))}</span></div>`).join('');
g.innerHTML=[1,2,3,4,5].map(d=>{let hs=horario.filter(h=>h.dia===d);return `<div class="dia-col ${d===hoy?'hoy':''}"><h4>${dias[d]}${d===hoy?'<small>Hoy</small>':''}</h4>`+(hs.map(h=>{let a=asignaciones.find(x=>x.id===h.asignacion_id),hora=`<span class="hora">${esc(rango(h.hora_inicio,h.hora_fin))}</span>`;
if(h.tipo==='clase')return `<div class="franja-tarjeta ${colorDe(h.asignacion_id)}">${hora}<span class="nombre">${esc(a?.salon?.nombre||'?')}<span class="materia">${esc(a?.materia?.nombre||'?')}</span></span></div>`;
return `<div class="franja-tarjeta ${esc(h.tipo)}">${hora}<span class="nombre">${esc(h.etiqueta||tipoTxt(h.tipo))}</span></div>`}).join('')||'<p class="dia-vacio">Sin franjas</p>')+'</div>'}).join('')}
async function cargarHorario(){if(!$('anio').value||!$('profesor').value){horario=[];renderFranjas();renderSemana();generar();return}horario=await query(db.from('portal2027_horario').select('*').eq('anio_id',$('anio').value).eq('profesor_id',$('profesor').value).order('dia').order('hora_inicio'));renderFranjas();renderSemana();$('detalle-facil').open=!horario.length;generar()}
async function cargarCalendario(){if(!$('anio').value){trimestres=[];generar();return}trimestres=await query(db.from('portal2027_trimestres').select('id,numero,fecha_inicio,fecha_fin').eq('anio_id',$('anio').value).order('numero'));sel('trimestre',trimestres,t=>`Trimestre ${t.numero} (${t.fecha_inicio} a ${t.fecha_fin})`);exclusiones=await query(db.from('portal2027_dias_sin_clases').select('*').eq('anio_id',$('anio').value).order('fecha'));opciones=await query(db.from('portal2027_calendario_opciones').select('*'));renderExclusiones();syncDoble();generar()}function fechaCorta(f){return parseDate(f).toLocaleDateString('es-PA',{weekday:'short',day:'numeric',month:'short'})}
function renderExclusiones(){let l=exclusiones.filter(x=>x.profesor_id===null||x.profesor_id===$('profesor').value);$('exclusiones').innerHTML=l.map(x=>`<span class="exclusion">${esc(fechaCorta(x.fecha))} · ${esc(x.motivo)} <em>(${x.profesor_id?'personal':'colegio'})</em><button type="button" class="boton" data-excluir="${x.id}" aria-label="Eliminar día sin clases" title="Eliminar">×</button></span>`).join('')||'<p class="vacio-texto">Todavía no hay días sin clases registrados.</p>'}function syncDoble(){$('doble').value=opciones.find(o=>o.asignacion_id===$('doble-asignacion').value)?.bloque_doble||'una'}let sesionesCalc=[],visibles=40;
function generar(){let t=trimestres.find(x=>x.id===$('trimestre').value);if(!t){sesionesCalc=[];$('resumen').innerHTML='<p class="vacio-texto">Configure las fechas del trimestre en Administración.</p>';renderSesiones();return}
let fuera=new Set(exclusiones.filter(x=>x.profesor_id===null||x.profesor_id===$('profesor').value).map(x=>x.fecha)),salida=[],conteo={};
for(let d=parseDate(t.fecha_inicio),fin=parseDate(t.fecha_fin);d<=fin;d.setDate(d.getDate()+1)){let dow=d.getDay();if(dow<1||dow>5||fuera.has(dateISO(d)))continue;let hs=horario.filter(h=>h.dia===dow&&h.tipo==='clase').sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));let ultimo=null;
for(let h of hs){let a=asignaciones.find(x=>x.id===h.asignacion_id);if(!a)continue;let doble=opciones.find(o=>o.asignacion_id===h.asignacion_id)?.bloque_doble||'una';if(doble==='una'&&ultimo&&ultimo.asignacion_id===h.asignacion_id&&ultimo.hora_fin===h.hora_inicio){ultimo.hora_fin=h.hora_fin;continue}conteo[h.asignacion_id]=(conteo[h.asignacion_id]||0)+1;let item={fecha:dateISO(d),inicio:h.hora_inicio,hora_fin:h.hora_fin,asignacion_id:h.asignacion_id,nombre:nombre(a),numero:conteo[h.asignacion_id]};salida.push(item);ultimo=item}}
sesionesCalc=salida;
$('resumen').innerHTML=salida.length?`<div class="ficha total"><b>${salida.length}</b><span>sesiones en el trimestre</span></div>`+Object.entries(conteo).map(([id,n])=>`<div class="ficha ${colorDe(id)}"><b>${n}</b><span>${esc(nombre(asignaciones.find(a=>a.id===id)||{}))}</span></div>`).join(''):'';
let f=$('filtro-sesiones'),prev=f.value;f.innerHTML='<option value="">Todos los grupos</option>'+Object.keys(conteo).map(id=>`<option value="${esc(id)}">${esc(nombre(asignaciones.find(a=>a.id===id)||{}))}</option>`).join('');f.value=conteo[prev]?prev:'';
visibles=40;renderSesiones()}
function renderSesiones(){let f=$('filtro-sesiones').value,l=sesionesCalc.filter(s=>!f||s.asignacion_id===f),hoy=dateISO(new Date()),vis=l.slice(0,visibles),html='',mes='';
for(let s of vis){let fe=parseDate(s.fecha),m=fe.toLocaleDateString('es-PA',{month:'long',year:'numeric'});if(m!==mes){mes=m;html+=`<tr class="mes-fila"><th colspan="4">${esc(m)}</th></tr>`}
html+=`<tr class="${s.fecha===hoy?'es-hoy':s.fecha<hoy?'ya-paso':''}"><td>${esc(fe.toLocaleDateString('es-PA',{weekday:'short',day:'2-digit',month:'short'}))}</td><td>${esc(rango(s.inicio,s.hora_fin))}</td><td><span class="grupo-marca ${colorDe(s.asignacion_id)}"></span>${esc(s.nombre)}</td><td>${s.numero}</td></tr>`}
$('sesiones').innerHTML=html||'<tr><td colspan="4">No hay clases previstas.</td></tr>';
$('contador-sesiones').textContent=l.length?`Mostrando ${vis.length} de ${l.length} sesiones`:'';
$('ver-mas').hidden=vis.length>=l.length}
$('filtro-sesiones').onchange=()=>{visibles=40;renderSesiones()};
$('ver-mas').onclick=()=>{visibles+=60;renderSesiones()};
async function init(){try{if(!db)throw Error('Sin conexión a Supabase');let ses=await query(db.auth.getUser());user=ses.user;if(!user)throw Error('Debe iniciar sesión');let roles=await query(db.from('portal2027_roles_usuario').select('rol').eq('usuario_id',user.id));admin=roles.some(x=>x.rol==='administrador');if(!admin&&!roles.some(x=>x.rol==='profesor'))throw Error('Acceso exclusivo para docentes y administración');let [anios,profesores,asig]=await Promise.all([query(db.from('portal2027_anios').select('id,anio,activo').order('anio',{ascending:false})),query(db.from('portal2027_roles_usuario').select('usuario_id').eq('rol','profesor')),query(db.from('portal2027_asignaciones').select('id,profesor_id,salon:portal2027_salones(nombre,anio_id),materia:portal2027_materias(nombre)'))]);const ids=[...new Set(profesores.map(x=>x.usuario_id))];if(ids.length){const perfiles=await query(db.from('portal2027_perfiles').select('id,nombres,apellidos').in('id',ids));const mapa=new Map(perfiles.map(p=>[p.id,p]));profesores.forEach(p=>p.perfil=mapa.get(p.usuario_id)||null)}asignaciones=asig;sel('anio',anios,x=>x.anio);let activo=anios.find(x=>x.activo);if(activo)$('anio').value=activo.id;$('profesor').innerHTML=(admin?profesores:profesores.filter(x=>x.usuario_id===user.id)).map(x=>`<option value="${esc(x.usuario_id)}">${esc((x.perfil?.nombres||'')+' '+(x.perfil?.apellidos||''))}</option>`).join('');if(profesores.some(x=>x.usuario_id===user.id))$('profesor').value=user.id;if(!admin)$('profesor').disabled=true;$('global').disabled=!admin;syncAsigs();await cargarHorario();await cargarCalendario();msg('Listo. Arriba ve su semana; más abajo puede editarla.')}catch(e){msg(e.message,true)}}async function cambio(){try{syncAsigs();await cargarHorario();await cargarCalendario();msg('Datos actualizados')}catch(e){msg(e.message,true)}}$('anio').onchange=cambio;$('profesor').onchange=cambio;$('trimestre').onchange=generar;$('doble-asignacion').onchange=syncDoble;$('importar').onclick = async () => {
  try {
    const texto = $('importacion').value.trim();
    if (!texto) throw Error('Primero seleccione un JSON o cargue la plantilla.');
    const res = resolverAsignaciones(JSON.parse(texto));
    if (res.faltantes.length) throw Error('Faltan asignaciones: ' + res.faltantes.join(', '));
    const filas = validar(res.filas), anio = $('anio').value, profesor = $('profesor').value;
    await confirmarHorario('reemplazar|' + anio + '|' + profesor, 'Reemplazar horario completo',
      'Esto reemplazará TODO el horario del profesor para el año seleccionado. ¿Continuar?', 'Reemplazar horario', async () => {
        await rpc('portal2027_reemplazar_horario', { p_anio: anio, p_profesor: profesor, p_filas: filas });
        await cargarHorario();
        msg('Horario importado: ' + filas.length + ' franjas');
      });
  } catch (e) { msg(e.message, true); }
};
$('franja').onsubmit=async e=>{e.preventDefault();try{let f=validar([{dia:Number($('dia').value),inicio:$('inicio').value,fin:$('fin').value,tipo:$('tipo').value,asignacion_id:$('asignacion').value,etiqueta:$('etiqueta').value}])[0];await rpc('portal2027_guardar_horario_franja',{p_id:$('franja-id').value||null,p_anio:$('anio').value,p_profesor:$('profesor').value,p_dia:f.dia,p_inicio:f.inicio,p_fin:f.fin,p_tipo:f.tipo,p_asignacion:f.asignacion_id,p_etiqueta:f.etiqueta});$('franja').reset();$('franja-id').value='';await cargarHorario();msg('Franja guardada')}catch(x){msg(x.message,true)}};$('limpiar').onclick=()=>{$('franja').reset();$('franja-id').value=''};$('franjas').onclick=async e=>{let id=e.target.dataset.editar||e.target.dataset.borrar;if(!id)return;let h=horario.find(x=>x.id===id);if(e.target.dataset.editar){$('franja-id').value=id;$('dia').value=h.dia;$('inicio').value=h.hora_inicio.slice(0,5);$('fin').value=h.hora_fin.slice(0,5);$('tipo').value=h.tipo;$('asignacion').value=h.asignacion_id||'';$('etiqueta').value=h.etiqueta||'';$('franja').scrollIntoView({behavior:'smooth'});return}try{await confirmarHorario('franja|'+id,'Eliminar franja','¿Eliminar esta franja?','Eliminar franja',async()=>{await rpc('portal2027_borrar_horario_franja',{p_id:id});await cargarHorario();msg('Franja eliminada')})}catch(x){msg(x.message,true)}};$('sinclases').onsubmit=async e=>{e.preventDefault();try{await rpc('portal2027_guardar_dias_sin_clases',{p_anio:$('anio').value,p_desde:$('desde').value,p_hasta:$('hasta').value,p_motivo:$('motivo').value,p_global:$('global').checked});await cargarCalendario();msg('Días sin clases registrados')}catch(x){msg(x.message,true)}};$('exclusiones').onclick=async e=>{let id=e.target.dataset.excluir;if(!id)return;try{await confirmarHorario('exclusion|'+id,'Eliminar día sin clases','¿Eliminar día sin clases?','Eliminar día',async()=>{await rpc('portal2027_borrar_dia_sin_clases',{p_id:id});await cargarCalendario();msg('Exclusión eliminada')})}catch(x){msg(x.message,true)}};$('guardar-doble').onclick=async()=>{try{await rpc('portal2027_guardar_opcion_doble',{p_asignacion:$('doble-asignacion').value,p_valor:$('doble').value});await cargarCalendario();msg('Criterio de bloque doble guardado')}catch(e){msg(e.message,true)}};
const plantillaMap={
 'REEMPLAZAR_UUID_9A_NAT':['9A','naturales'], 'PENDIENTE_ID_9A':['9A','naturales'],
 'REEMPLAZAR_UUID_9B_NAT':['9B','naturales'], 'PENDIENTE_ID_9B':['9B','naturales'],
 'REEMPLAZAR_UUID_9C_NAT':['9C','naturales'], 'PENDIENTE_ID_9C':['9C','naturales'],
 'REEMPLAZAR_UUID_8A_NAT':['8A','naturales'], 'PENDIENTE_ID_8A_NATURALES':['8A','naturales'],
 'REEMPLAZAR_UUID_8A_INF':['8A','informatica'], 'PENDIENTE_ID_8A_INFORMATICA':['8A','informatica'],
 'REEMPLAZAR_UUID_8B_INF':['8B','informatica'], 'PENDIENTE_ID_8B_INFORMATICA':['8B','informatica']
};
const normalizar=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function resolverAsignaciones(filas){const faltantes=new Set();const res=filas.map(f=>{
 if(f.tipo!=='clase')return {...f,asignacion_id:null};
 const clave=String(f.asignacion_id||'');const destino=(f.grupo&&f.materia)?[String(f.grupo),normalizar(f.materia).includes('informat')?'informatica':'naturales']:plantillaMap[clave];
 if(!destino)return f;
 const [grupo,materia]=destino;
 const a=asigs().find(x=>normalizar(x.salon?.nombre).replace(/[^a-z0-9]/g,'')===normalizar(grupo)&&normalizar(x.materia?.nombre).includes(materia));
 if(!a){faltantes.add(grupo+' · '+(materia==='naturales'?'Ciencias Naturales':'Informática'));return f}
 return {...f,asignacion_id:a.id};
 });return {filas:res,faltantes:[...faltantes]};}
function mostrarImportacion(filas,origen){const r=resolverAsignaciones(filas);$('importacion').value=JSON.stringify(r.filas,null,2);$('detalle-importar').open=true;
 if(r.faltantes.length)msg(origen+': faltan asignaciones en Administración: '+r.faltantes.join(', ')+'. No guarde todavía.',true);
 else msg(origen+': '+r.filas.length+' franjas preparadas. Revise y guarde cuando esté conforme.');
 return r;}
const zonaArchivo=$('zona-archivo'),inputArchivo=$('archivo-horario'),estadoArchivo=$('archivo-estado');
async function cargarArchivoHorario(archivo){
 if(!archivo)return;
 if(!/\.json$/i.test(archivo.name)){estadoArchivo.textContent='Solo se admiten archivos JSON (.json).';msg('Seleccione un archivo .json; las imágenes JPG y los Excel no se interpretan aquí.',true);return}
 if(archivo.size>1024*1024){msg('El archivo supera 1 MB.',true);return}
 try{const contenido=await archivo.text();const datos=JSON.parse(contenido);if(!Array.isArray(datos))throw Error('El archivo debe contener una lista JSON de franjas');if(datos.length>80)throw Error('Máximo 80 franjas');
 const resultado=mostrarImportacion(datos,'Archivo JSON');
 const pendientes=resultado.filas.filter(f=>f.tipo==='clase'&&(!f.asignacion_id||!asigs().some(a=>a.id===f.asignacion_id)));
 estadoArchivo.textContent=`${archivo.name}: ${datos.length} franjas cargadas para revisar.`;
 if(pendientes.length)msg(`Archivo leído: ${datos.length} franjas, pero ${pendientes.length} clases tienen asignaciones pendientes. No guarde hasta resolverlas.`,true);
 else msg(`Archivo leído: ${datos.length} franjas. Revise antes de guardar.`);
 }catch(e){estadoArchivo.textContent='No se pudo leer el archivo.';msg('Archivo JSON inválido: '+e.message,true)}
}
inputArchivo.addEventListener('change',()=>cargarArchivoHorario(inputArchivo.files?.[0]));
zonaArchivo.addEventListener('dragover',e=>{e.preventDefault();zonaArchivo.classList.add('arrastrando')});
zonaArchivo.addEventListener('dragleave',()=>zonaArchivo.classList.remove('arrastrando'));
zonaArchivo.addEventListener('drop',e=>{e.preventDefault();zonaArchivo.classList.remove('arrastrando');cargarArchivoHorario(e.dataTransfer.files?.[0])});
zonaArchivo.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===zonaArchivo){e.preventDefault();inputArchivo.click()}});
$('cargar-plantilla').onclick=async()=>{try{
 const resp=await fetch('../data/horarios/horario-samuel-2027.json',{cache:'no-store'});
 if(!resp.ok)throw Error('No se encontró la plantilla en data/horarios/');
 const filas=await resp.json();mostrarImportacion(filas,'Plantilla 2027');
}catch(e){msg(e.message,true)}};

let faciles=[];
function opcionesAsignacion(seleccion){return asigs().map(a=>`<option value="${esc(a.id)}" ${a.id===seleccion?'selected':''}>${esc(nombre(a))}</option>`).join('')}
function renderFacil(){const t=$('vista-facil');if(!t)return;t.innerHTML=faciles.map((f,i)=>`<tr><td>${dias[f.dia]}</td><td><input type="time" data-i="${i}" data-k="inicio" value="${esc(f.inicio)}"></td><td><input type="time" data-i="${i}" data-k="fin" value="${esc(f.fin)}"></td><td><span class="insignia ${esc(f.tipo)}">${esc(tipoTxt(f.tipo))}</span></td><td>${f.tipo==='clase'?`<select data-i="${i}" data-k="asignacion_id">${opcionesAsignacion(f.asignacion_id)}</select>`:esc(f.etiqueta||'')}</td></tr>`).join('')}
$('vista-facil').onchange=e=>{let i=Number(e.target.dataset.i),k=e.target.dataset.k;if(Number.isInteger(i)&&faciles[i]&&k)faciles[i][k]=e.target.value};
$('preparar-facil').onclick=async()=>{try{
if(!$('anio').value||!$('profesor').value)throw Error('Seleccione año y profesor');
const r=await fetch('../data/horarios/horario-samuel-2027-facil.json',{cache:'no-store'});if(!r.ok)throw Error('Falta subir data/horarios/horario-samuel-2027-facil.json a GitHub');
const datos=await r.json();const res=resolverAsignaciones(datos);
if(res.faltantes.length)throw Error('Faltan asignaciones: '+res.faltantes.join(', '));
faciles=validar(res.filas);renderFacil();$('panel-facil').hidden=false;msg('Horario preparado: '+faciles.length+' franjas. Revise y presione Guardar horario completo.');
}catch(e){msg(e.message,true)}};
$('guardar-facil').onclick = async () => {
  try {
    const filas = validar(faciles);
    if (!filas.length) throw Error('Primero prepare el horario');
    const anio = $('anio').value, profesor = $('profesor').value;
    await confirmarHorario('reemplazar|' + anio + '|' + profesor, 'Guardar horario completo',
      '¿Reemplazar el horario completo de este profesor y año?', 'Guardar horario', async () => {
        await rpc('portal2027_reemplazar_horario', { p_anio: anio, p_profesor: profesor, p_filas: filas });
        await cargarHorario();
        msg('Horario guardado correctamente: ' + filas.length + ' franjas. Puede editar cada una debajo.');
      });
  } catch (e) { msg('No se pudo guardar: ' + e.message, true); }
};

init()})();