/* Etapa 7C: cuadro estadístico. Lectura exclusiva, respeta RLS y motor único. */
(function(){'use strict';
const P=window.portal2027, db=P.db, M=P.evaluacion, root=document.getElementById('contenido');
const $=(tag,txt,cls)=>{let e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
const fmt=n=>n.toFixed(2)+'%';
async function get(q){const r=await q;if(r.error)throw r.error;return r.data;}
async function all(factory){let out=[],offset=0;while(true){let v=await get(factory().range(offset,offset+999));out.push(...v);if(v.length<1000)return out;offset+=1000;}}
function sel(label,items){let wrap=$('label',label),s=$('select');items.forEach(([v,t])=>{let o=$('option',t);o.value=v;s.append(o);});wrap.append(s);return [wrap,s];}
function line(row,values,head){values.forEach(v=>row.append($((head?'th':'td'),String(v))));}
function key(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
async function main(){try{
 if(!db)throw Error('No se pudo conectar con Supabase.');
 const ses=await P.cargarSesion();if(!ses||!ses.roles.some(r=>['profesor','administrador'].includes(r)))throw Error('No tiene acceso al cuadro.');
 const assignments=await all(()=>db.from('portal2027_asignaciones').select('id,materia_id,salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)),materia:portal2027_materias(nombre)').order('id'));
 const valid=assignments.filter(a=>a.salon&&a.materia&&a.salon.anio);
 const years=[...new Set(valid.map(a=>String(a.salon.anio.anio)))].sort().reverse();
 root.replaceChildren();root.append($('h1','Cuadro de estudiantes aprobados y reprobados'));
 root.append($('p','Seleccione año, asignatura, trimestre y grupos. Los resultados de trimestres abiertos son provisionales.','bloque-ayuda'));
 let bar=$('div',undefined,'formulario-fila no-imprimir');root.append(bar);
 let [yw,ys]=sel('Año lectivo',years.map(y=>[y,y]));bar.append(yw);
 let [mw,ms]=sel('Asignatura',[]);bar.append(mw);
 let [tw,ts]=sel('Trimestre',[]);bar.append(tw);
 let groups=$('div',undefined,'aprobados-grupos no-imprimir');root.append(groups);
 let actions=$('div',undefined,'aprobados-acciones no-imprimir');root.append(actions);
 let generate=$('button','Generar cuadro','boton'),print=$('button','Imprimir / guardar PDF','boton boton-secundario');
 let back=$('a','Regresar a Docente','boton boton-secundario');back.href=P.rutaInicio();actions.append(generate,print,back);
 let output=$('div');root.append(output);print.onclick=()=>window.print();
 function updateMat(){let old=ms.value;ms.replaceChildren();let names=[...new Set(valid.filter(a=>String(a.salon.anio.anio)===ys.value).map(a=>a.materia.nombre))].sort();names.forEach(n=>{let o=$('option',n);o.value=n;ms.append(o);});if(names.includes(old))ms.value=old;updateGroups();}
 function updateGroups(){groups.replaceChildren();let matches=valid.filter(a=>String(a.salon.anio.anio)===ys.value&&a.materia.nombre===ms.value);matches.forEach(a=>{let lab=$('label'),check=$('input');check.type='checkbox';check.checked=true;check.value=a.id;lab.append(check,document.createTextNode(' '+a.salon.nombre));groups.append(lab);});}
 async function updateTr(){ts.replaceChildren();let a=valid.find(a=>String(a.salon.anio.anio)===ys.value);if(!a)return;let rows=await get(db.from('portal2027_trimestres').select('id,numero').eq('anio_id',a.salon.anio_id).order('numero'));rows.forEach(t=>{let o=$('option','Trimestre '+t.numero);o.value=t.id;ts.append(o);});}
 async function refresh(){updateMat();await updateTr();}ys.onchange=()=>refresh().catch(showError);ms.onchange=updateGroups;
 function showError(e){output.replaceChildren($('p','Error: '+(e.message||e),'mensaje error'));}
 async function build(){generate.disabled=true;output.replaceChildren($('p','Calculando cuadro…'));
 try{let ids=[...groups.querySelectorAll('input:checked')].map(c=>c.value),chosen=valid.filter(a=>ids.includes(a.id));if(!chosen.length)throw Error('Seleccione al menos un grupo.');if(!ts.value)throw Error('Seleccione un trimestre.');
 let summaries=[],pending=[],warnings=[];
 for(let a of chosen){
 const [ev,mat,notas,cierre]=await Promise.all([
 all(()=>db.from('portal2027_evaluaciones').select('id,categoria,eliminada_en').eq('asignacion_id',a.id).eq('trimestre_id',ts.value).is('eliminada_en',null).order('id')),
 all(()=>db.from('portal2027_matriculas').select('id,estado,estudiante:portal2027_estudiantes(nombres,apellidos,sexo)').eq('salon_id',a.salon.id).eq('anio_id',a.salon.anio_id).order('id')),
 all(()=>db.from('portal2027_notas').select('evaluacion_id,matricula_id,valor,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id,eliminada_en)').eq('evaluacion.asignacion_id',a.id).eq('evaluacion.trimestre_id',ts.value).is('evaluacion.eliminada_en',null).order('id')),
 get(db.from('portal2027_cierres').select('cerrado').eq('asignacion_id',a.id).eq('trimestre_id',ts.value).maybeSingle())]);
 let nmap={};notas.forEach(n=>{if(n.valor!==null)(nmap[n.matricula_id]??={})[n.evaluacion_id]=Number(n.valor);});
 let counts={ap:{M:0,F:0,X:0},rep:{M:0,F:0,X:0},sin:{M:0,F:0,X:0},ret:{M:0,F:0,X:0}},active=0;
 mat.forEach(m=>{if(!m.estudiante)return;let e=m.estudiante,sex=['M','F'].includes(e.sexo)?e.sexo:'X';if(sex==='X')warnings.push(a.salon.nombre+': '+e.nombres+' '+e.apellidos+' sin sexo registrado');
 let retired=/retir|traslad|baja/.test(key(m.estado));if(retired){counts.ret[sex]++;return;}active++;
 let result=M.calcular(ev,nmap[m.id]||{}),cat=result.categorias;
 let typ=result.final===null?'sin':M.redondear1(result.final)>=3?'ap':'rep';counts[typ][sex]++;
 if(typ==='ap'&&cat.examen.cantidad===0&&cat.apreciacion.promedio!==null&&cat.ejercicio_escrito.promedio!==null){let need=9-cat.apreciacion.promedio-cat.ejercicio_escrito.promedio;pending.push(a.salon.nombre+' — '+e.apellidos+', '+e.nombres+' — examen mínimo: '+Math.max(0,need).toFixed(2));}
 });summaries.push({group:a.salon.nombre,counts,active,closed:!!(cierre&&cierre.cerrado)});
 }
 const total=c=>c.M+c.F+c.X,percent=(n,d)=>fmt(d?100*n/d:0);
 let sheet=$('section',undefined,'aprobados-hoja');sheet.append($('h3','MINISTERIO DE EDUCACIÓN – DIRECCIÓN REGIONAL DE COLÓN – C.E.B.G. EL JIRAL'));
 sheet.append($('h2','CUADRO DE ESTUDIANTES APROBADOS Y REPROBADOS'));
 sheet.append($('p','NOMBRE DEL PROFESOR: '+(P.nombreCompleto(ses.perfil)||'________________')));
 sheet.append($('p','ASIGNATURA: '+ms.value+'  |  NIVELES: '+summaries.map(s=>s.group).join(', ')+'  |  TRIMESTRE: '+ts.selectedOptions[0].text+'  |  AÑO LECTIVO: '+ys.value));
 sheet.append($('p',summaries.every(s=>s.closed)?'Trimestre cerrado (cálculo con datos actuales; verificar contra copia de cierre).':'RESULTADOS PROVISIONALES: el trimestre no está cerrado o falta cerrar algún grupo.','aprobados-aviso'));
 let table=$('table',undefined,'aprobados-tabla'),thead=$('thead'),h1=$('tr'),h2=$('tr');
 [['GRADO',1,2],['MATRÍCULA',1,2],['APROBADOS',4,1],['REPROBADOS HASTA LA FECHA',4,1],['SIN CALIFICACIONES',4,1],['RETIRADOS',3,1]].forEach(([t,cs,rs])=>{let th=$('th',t);th.colSpan=cs;th.rowSpan=rs;h1.append(th);});
 ['M','F','TOTAL','%','M','F','TOTAL','%','H','M','TOTAL','%','H','M','SIN DATO'].forEach(t=>h2.append($('th',t)));thead.append(h1,h2);table.append(thead);
 let body=$('tbody');let overall={active:0,counts:{ap:{M:0,F:0,X:0},rep:{M:0,F:0,X:0},sin:{M:0,F:0,X:0},ret:{M:0,F:0,X:0}}};
 function values(s){let c=s.counts;return [s.group,s.active,c.ap.M,c.ap.F,total(c.ap),percent(total(c.ap),s.active),c.rep.M,c.rep.F,total(c.rep),percent(total(c.rep),s.active),c.sin.M,c.sin.F,total(c.sin),percent(total(c.sin),s.active),c.ret.M,c.ret.F,c.ret.X];}
 summaries.forEach(s=>{let tr=$('tr');line(tr,values(s));body.append(tr);overall.active+=s.active;Object.keys(overall.counts).forEach(k=>Object.keys(overall.counts[k]).forEach(sex=>overall.counts[k][sex]+=s.counts[k][sex]));});
 let tr=$('tr');line(tr,values({group:'TOTALES',active:overall.active,counts:overall.counts}));tr.className='aprobados-total';body.append(tr);table.append(body);let scroll=$('div',undefined,'aprobados-scroll');scroll.append(table);sheet.append(scroll);
 sheet.append($('h4','Estudiantes que deben cuidar su nota de Examen'));
 sheet.append($('p',pending.length?pending.join(' | '):'No hay estudiantes aprobados a la espera de nota de Examen en los grados seleccionados.'));
 sheet.append($('h4','CAUSAS DEL RETIRO DEL ALUMNO SIN CALIFICACIONES:'));
 let notes=$('textarea');notes.placeholder='Observaciones para este documento (no se guardan en Supabase)';notes.rows=2;notes.className='aprobados-notas';sheet.append(notes);
 sheet.append($('p','NOTA: 1- Haga el % de cada nivel y por asignatura. 2- Remitir a Dirección 1 original y 1 copia. 3- El profesor y la dirección conservarán una copia. 4- En reprobados anotar la cantidad hasta la fecha.','aprobados-pie'));
 let signs=$('div',undefined,'aprobados-firmas');signs.append($('span','____________________________\nFIRMA DEL PROFESOR'),$('span','____________________________\nFIRMA DEL DIRECTOR'));sheet.append(signs);
 output.replaceChildren(sheet);
 if(warnings.length){let warn=$('p','Advertencia: '+warnings.join('; '),'mensaje error no-imprimir');output.prepend(warn);}
 }catch(e){showError(e);}finally{generate.disabled=false;}}
 generate.onclick=build;await refresh();const param=new URLSearchParams(location.search).get('asignacion');if(param){let a=valid.find(x=>x.id===param);if(a){ys.value=String(a.salon.anio.anio);await refresh();ms.value=a.materia.nombre;updateGroups();groups.querySelectorAll('input').forEach(c=>c.checked=c.value===param);}};
 }catch(e){root.replaceChildren($('p','No se pudo abrir el cuadro: '+(e.message||e),'mensaje error'));}}
main();
})();
