/* portal2027-planificacion.js — planificación del trimestre por clases (semanas).
   El profesor anota número, tema y fechas de cada clase. Cada clase crea su «Apreciación semanal» en la libreta
   y filtra la asistencia por sus fechas. El gancho ✓ marca la clase cuya fecha de hoy cae dentro de sus fechas.
   Todo se guarda con funciones de la base (permisos, cierre y versión); la pantalla solo muestra el resultado real. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var contenido = document.getElementById('contenido');

  var S = { info: null, rolPanel: null, asig: null, trimestres: [], trimestreId: null, plan: [], sesiones: [], cerrado: false, editando: null, lote: '', previa: null, hermanas: [], planHermanas: {}, aplicarA: {} };
  var barra = null;

  /* ---------- utilidades ---------- */
  async function consultar(q) {
    var r = await q;
    if (r.error) { throw r.error; }
    return r.data;
  }
  function aviso(texto, tipo) {
    barra.textContent = texto;
    barra.className = 'mensaje estado-panel ' + (tipo || 'info');
    barra.hidden = !texto;
  }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^CONFLICTO/.test(m)) { return m.replace(/^CONFLICTO:\s*/, 'Conflicto: ') + ' Pulse «Recargar».'; }
    if (/^(No tiene permiso|El trimestre|Escriba|Fechas|Las fechas|Ya existe|La clase|El número|Grupo )/.test(m)) { return m.replace(/\s*\(row-level security\)/, ''); }
    if (/portal2027_plan_clases|portal2027_guardar_plan_clase|schema cache/i.test(m)) { return 'Falta instalar la migración 0029 en Supabase. (' + m + ')'; }
    return P.traducirError(e);
  }
  function fechaTexto(f) { if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(String(f))) return 'Sin fecha'; var p = String(f).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function sumarDia(f) {
    var p = f.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function diaSemana(f) { var a = f.split('-').map(Number); return new Date(a[0], a[1]-1, a[2]).getDay(); }
  function moverDias(f, n) { var a = f.split('-').map(Number), d = new Date(a[0], a[1]-1, a[2]+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function lunesSiguiente(f) { var d = diaSemana(f); return moverDias(f, d === 0 ? 1 : 8-d); }
  function viernesDe(f) { return moverDias(f, 5-diaSemana(f)); }
  function fechaConDia(f) { var dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']; return dias[diaSemana(f)]+' '+fechaTexto(f); }
  function validarSemana(ed, ini, fin) {
    var t = trimestre();
    if (!t || ini < t.fecha_inicio || fin > t.fecha_fin) return 'Las fechas deben estar dentro del trimestre.';
    if (diaSemana(ini) !== 1 || diaSemana(fin) !== 5 || (fin !== viernesDe(ini) && fin !== moverDias(ini, 11))) return 'La clase debe durar 1 o 2 semanas completas: desde lunes hasta viernes.';
    var otras = S.plan.filter(function(c){return !ed || c.id !== ed.id;}).sort(function(a,b){return a.fecha_inicio.localeCompare(b.fecha_inicio);});
    if (otras.some(function(c){return ini <= c.fecha_fin && fin >= c.fecha_inicio;})) return 'La semana se cruza con otra clase existente.';
    var todas = otras.concat([{fecha_inicio:ini,fecha_fin:fin}]).sort(function(a,b){return a.fecha_inicio.localeCompare(b.fecha_inicio);});
    for(var i=1;i<todas.length;i++) if(todas[i].fecha_inicio !== lunesSiguiente(todas[i-1].fecha_fin)) return 'Las clases deben seguir semanas consecutivas, sin saltos ni traslapes.';
    return '';
  }
  function trimestre() { return S.trimestres.filter(function (t) { return t.id === S.trimestreId; })[0]; }
  function estadoClase(c) {
    var h = hoy();
    if (h < c.fecha_inicio) { return 'proxima'; }
    if (h > c.fecha_fin) { return 'pasada'; }
    return 'activa';
  }
  function claseActiva() { return S.plan.filter(function (c) { return estadoClase(c) === 'activa'; })[0] || null; }
  function claseProxima() { return S.plan.filter(function (c) { return estadoClase(c) === 'proxima'; })[0] || null; }   // el plan llega ordenado por fecha
  function siguienteNumero() { return 1 + Math.max(0, ...S.plan.map(function (c) { return c.numero; })); }
  function sugerirDesde() {
    var t = trimestre();
    if (S.plan.length) { return lunesSiguiente(S.plan[S.plan.length - 1].fecha_fin); }
    return (t && t.fecha_inicio) || hoy();
  }
  function urlAsistencia(c) { return P.raiz + 'pages/portal2027-asistencia.html?asignacion=' + encodeURIComponent(S.asig.id) + '&trimestre=' + encodeURIComponent(S.trimestreId) + '&clase=' + encodeURIComponent(c.id); }
  function urlApreciacion(c) { return P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(S.asig.id) + '&trimestre=' + encodeURIComponent(S.trimestreId) + '&semana=' + c.numero; }
  function diaFecha(f) { var p = f.split('-').map(Number); return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(p[0],p[1]-1,p[2]).getDay()] + ' ' + fechaTexto(f); }
  function sesionesDe(c) { return S.sesiones.filter(function (s) { return s.fecha >= c.fecha_inicio && s.fecha <= c.fecha_fin; }).length; }

  /* ---------- carga ---------- */
  async function cargar() {
    var a = S.asig.id, t = S.trimestreId;
    var r = await Promise.all([
      consultar(db.from('portal2027_plan_clases').select('id,numero,tema,fecha_inicio,fecha_fin,version,evaluacion_id')
        .eq('asignacion_id', a).eq('trimestre_id', t).is('eliminada_en', null).order('fecha_inicio').order('numero')),
      consultar(db.from('portal2027_sesiones_asistencia').select('fecha').eq('asignacion_id', a).eq('trimestre_id', t).is('eliminada_en', null).limit(1000)),
      consultar(db.from('portal2027_cierres').select('cerrado').eq('asignacion_id', a).eq('trimestre_id', t).maybeSingle())
    ]);
    S.plan = r[0]; S.sesiones = r[1]; S.cerrado = !!(r[2] && r[2].cerrado);
    S.planHermanas = {};
    S.hermanas.forEach(function (h) { S.planHermanas[h.id] = []; });
    if (S.hermanas.length) {
      var ph = await consultar(db.from('portal2027_plan_clases').select('id,asignacion_id,numero,tema,fecha_inicio,fecha_fin,version')
        .in('asignacion_id', S.hermanas.map(function (h) { return h.id; })).eq('trimestre_id', t).is('eliminada_en', null));
      ph.forEach(function (p) { S.planHermanas[p.asignacion_id].push(p); });
    }
  }
  async function recargar(mensaje) {
    aviso('Cargando planificación…', 'info');
    try { await cargar(); dibujar(); aviso(mensaje || '', mensaje ? 'ok' : 'info'); }
    catch (e) { aviso('No se pudo cargar la planificación. ' + textoError(e), 'error'); }
  }

  /* ---------- grupos del mismo nivel (misma materia, mismo grado, mismo profesor) ---------- */
  function destinosExtra() { return S.hermanas; }
  function nombreGrupo(h) { return h.salon.nombre; }
  function planDeHermana(h, numero) { return (S.planHermanas[h.id] || []).filter(function (p) { return p.numero === numero; })[0] || null; }
  function argsGuardar(asigId, id, numero, tema, ini, fin, ver) {
    return { p_id: id, p_asignacion: asigId, p_trimestre: S.trimestreId, p_numero: numero, p_tema: tema, p_inicio: ini, p_fin: fin, p_version: ver };
  }
  async function rpc(nombre, args) {
    var r = await db.rpc(nombre, args);
    if (r.error) { throw r.error; }
    return r.data;
  }
  function textoGrupos(d) {
    var t = '';
    if (d && d.grupos_aplicados) { t += ' También se aplicó en ' + d.grupos_aplicados + ' grupo(s) del mismo nivel.'; }
    if (d && d.grupos_omitidos && d.grupos_omitidos.length) { t += ' No se aplicó en ' + d.grupos_omitidos.join(', ') + ' (trimestre cerrado o sin permiso).'; }
    return t;
  }

  /* ---------- acciones ---------- */
  // Crea (ed = null) o edita una clase. El servidor la repite en los grupos del mismo nivel.
  async function guardarClase(ed, n, tema, ini, fin) {
    aviso('Guardando…', 'info');
    var d;
    try {
      d = await rpc('portal2027_guardar_plan_clase', argsGuardar(S.asig.id, ed ? ed.id : null, ed ? null : n, tema, ini, fin, ed ? ed.version : 0));
    } catch (e) { aviso('No se guardó. ' + textoError(e), 'error'); return false; }
    var extra = d.apreciacion_actualizada === false ? ' Aviso: la apreciación de esa semana está bloqueada en la libreta y no se cambiaron sus fechas.' : '';
    S.editando = null;
    await cargar(); dibujar();
    aviso((ed ? 'Clase ' + d.numero + ' actualizada.' : 'Clase ' + d.numero + ' agregada con su apreciación semanal.') + extra + textoGrupos(d), 'ok');
    return true;
  }

  async function quitar(c) {
    var otros = S.hermanas.map(function (h) { return { h: h, p: planDeHermana(h, c.numero) }; }).filter(function (x) { return x.p; });
    var aviso2 = otros.length ? '\nTambién se quitará en: ' + otros.map(function (x) { return nombreGrupo(x.h); }).join(', ') + '.' : '';
    if (!window.confirm('¿Quitar la Clase ' + c.numero + ' («' + c.tema + '») de la planificación?\nSu apreciación semanal irá a la papelera de la libreta: dejará de contar y podrá restaurarla si se equivocó.' + aviso2)) { return; }
    aviso('Guardando…', 'info');
    var d;
    try { d = await rpc('portal2027_eliminar_plan_clase', { p_id: c.id, p_version: c.version }); }
    catch (e) { aviso('No se quitó. ' + textoError(e), 'error'); return; }
    await cargar(); dibujar();
    aviso('Clase ' + c.numero + ' quitada. ' + (d && d.apreciacion_en_papelera ? 'Su apreciación semanal está en la papelera de la libreta (se puede restaurar).' : 'Su apreciación estaba bloqueada y se quedó en la libreta.') + textoGrupos(d), 'ok');
  }

  // Vuelve a aplicar las clases de este grupo a los grupos del mismo nivel (crea las que faltan y corrige las distintas).
  async function copiarAGrupos() {
    if (!S.hermanas.length) { return; }
    if (!S.plan.length) { aviso('Este grupo todavía no tiene clases que copiar.', 'error'); return; }
    if (!window.confirm('Se copiarán las ' + S.plan.length + ' clases de ' + nombreGrupo({ salon: S.asig.salon }) + ' a: ' + S.hermanas.map(nombreGrupo).join(', ') + '.\nLas que ya existan con el mismo número se corregirán con estos datos. ¿Continuar?')) { return; }
    aviso('Copiando…', 'info');
    var hechas = 0, fallos = [];
    for (var k = 0; k < S.plan.length; k++) {
      var c = S.plan[k];
      try {
        var d = await rpc('portal2027_guardar_plan_clase', argsGuardar(S.asig.id, c.id, null, c.tema, c.fecha_inicio, c.fecha_fin, c.version));
        hechas += d.grupos_aplicados || 0;
        c.version = d.version;
      } catch (e) { fallos.push('Clase ' + c.numero + ': ' + textoError(e)); }
    }
    await cargar(); dibujar();
    var base = 'Listo: ' + hechas + ' clase(s) creadas o corregidas en los otros grupos.';
    aviso(fallos.length ? base + ' No se pudo: ' + fallos.join(' · ') : base, fallos.length ? 'error' : 'ok');
  }

  /* ---------- pegar varias clases ----------
     Formato por línea:  15/5/2026 hasta 25/5/2026 clase 1 tema revisión de cuaderno  (el número es opcional) */
  function aISO(d, m, a) {
    var x = new Date(Number(a), Number(m) - 1, Number(d));
    if (x.getFullYear() !== Number(a) || x.getMonth() !== Number(m) - 1 || x.getDate() !== Number(d)) { return null; }
    return a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function parsearLineas(texto) {
    var re = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(?:hasta|al|a|-|–)\s+(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s*[,;:\-–]?\s*(?:clase|semana)?\s*(\d+)?\s*[,;:\-–]?\s*(?:tema)?\s*[:\-–]?\s*(.*)$/i;
    return texto.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (linea) {
      var m = linea.match(re);
      if (!m) { return { linea: linea, error: 'No entendí la línea. Use: 15/5/2026 hasta 25/5/2026 clase 1 tema revisión de cuaderno' }; }
      var ini = aISO(m[1], m[2], m[3]), fin = aISO(m[4], m[5], m[6]), tema = (m[8] || '').trim();
      if (!ini || !fin) { return { linea: linea, error: 'Alguna fecha no existe.' }; }
      if (ini > fin) { return { linea: linea, error: 'La fecha de inicio es posterior a la final.' }; }
      if (!tema) { return { linea: linea, error: 'Falta el tema.' }; }
      return { linea: linea, numero: m[7] ? Number(m[7]) : null, tema: tema.slice(0, 120), inicio: ini, fin: fin };
    });
  }
  async function crearLote(filas) {
    var ok = 0, fallos = [], aplicadas = 0;
    aviso('Creando clases…', 'info');
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      try {
        var d = await rpc('portal2027_guardar_plan_clase', argsGuardar(S.asig.id, null, f.numero, f.tema, f.inicio, f.fin, 0));
        ok++; aplicadas += d.grupos_aplicados || 0;
      } catch (e) { fallos.push((f.numero ? 'Clase ' + f.numero : fechaTexto(f.inicio)) + ': ' + textoError(e)); }
    }
    S.lote = fallos.length ? S.lote : ''; S.previa = null;
    await cargar(); dibujar();
    var grupos = S.hermanas.length ? ' (y en los grupos del mismo nivel)' : '';
    if (fallos.length) { aviso('Se crearon ' + ok + ' clase(s)' + grupos + '. No se pudo crear: ' + fallos.join(' · '), 'error'); }
    else { aviso('Se crearon ' + ok + ' clase(s)' + grupos + ' con su apreciación semanal.', 'ok'); }
  }

  /* ---------- pantalla ---------- */
  function dibujarGrupos() {
    if (!S.hermanas.length) { return null; }
    return el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Grupos del mismo nivel' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Usted también da ' + S.asig.materia.nombre + ' en ' + S.hermanas.map(nombreGrupo).join(', ') + '. Todo lo que haga aquí (agregar, editar, quitar y pegar varias clases) se aplica también en esos grupos.' }),
      el('div', { clase: 'formulario-fila' }, [
        el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', disabled: S.cerrado || S.plan.length === 0, texto: 'Sincronizar las clases ya creadas con ' + S.hermanas.map(nombreGrupo).join(', '), onclick: copiarAGrupos })
      ])
    ]);
  }

  function dibujarActiva() {
    var a = claseActiva(), p = claseProxima(), sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Semana activa' })]);
    if (a) {
      sec.appendChild(el('div', { clase: 'plan-activa' }, [
        el('span', { clase: 'gancho gancho-activa', texto: 'Clase ' + a.numero }),
        el('strong', { texto: a.tema }),
        el('span', { texto: 'del ' + fechaTexto(a.fecha_inicio) + ' al ' + fechaTexto(a.fecha_fin) }),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton', href: urlAsistencia(a), texto: 'Abrir asistencia' }),
          el('a', { clase: 'boton boton-secundario', href: urlApreciacion(a), texto: 'Abrir apreciación' })
        ])
      ]));
    } else if (S.plan.length === 0) {
      sec.appendChild(el('p', { clase: 'plan-sin-activa', texto: 'Aún no ha planificado clases en este trimestre. Agréguelas abajo.' }));
    } else if (p) {
      sec.appendChild(el('p', { clase: 'plan-sin-activa', texto: 'Hoy no cae dentro de ninguna clase. Próxima: Clase ' + p.numero + ' («' + p.tema + '») desde el ' + fechaTexto(p.fecha_inicio) + '.' }));
    } else {
      sec.appendChild(el('p', { clase: 'plan-sin-activa', texto: 'Todas las clases planificadas de este trimestre ya terminaron.' }));
    }
    return sec;
  }

  function dibujarFormulario() {
    var t = trimestre(), ed = S.editando;
    var lim = { min: t && t.fecha_inicio, max: t && t.fecha_fin };
    var inNum = el('input', { type: 'number', min: '1', max: '60', value: String(ed ? ed.numero : siguienteNumero()), disabled: !!ed || S.cerrado, 'aria-label': 'Número de clase' });
    var inTema = el('input', { type: 'text', clase: 'plan-tema-input', maxlength: '120', placeholder: 'Ej.: La célula', value: ed ? ed.tema : '', disabled: S.cerrado, required: true });
    var inIni = el('input', { type: 'date', min: lim.min, max: lim.max, value: ed ? ed.fecha_inicio : sugerirDesde(), disabled: S.cerrado, required: true });
    var inFin = el('input', { type: 'date', min: lim.min, max: lim.max, value: ed ? ed.fecha_fin : viernesDe(sugerirDesde()), disabled: S.cerrado, required: true });
    var duracion = el('select', { disabled: S.cerrado, 'aria-label': 'Duración de la clase' }, [el('option', { value: '1', texto: '1 semana' }), el('option', { value: '2', texto: '2 semanas' })]);
    duracion.value = ed && ed.fecha_fin === moverDias(ed.fecha_inicio, 11) ? '2' : '1';
    function actualizarFin() { if (inIni.value && diaSemana(inIni.value) === 1) inFin.value = moverDias(inIni.value, duracion.value === '2' ? 11 : 4); }
    inIni.addEventListener('change', actualizarFin);
    duracion.addEventListener('change', actualizarFin);
    var botones = [el('button', { clase: 'boton boton-secundario', type: 'submit', disabled: S.cerrado, texto: ed ? 'Guardar cambios' : 'Agregar clase' })];
    if (ed) { botones.push(el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cancelar', onclick: function () { S.editando = null; dibujar(); } })); }
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      el('label', null, ['Clase Nº', inNum]), el('label', null, ['Tema', inTema]),
      el('label', null, ['Duración', duracion]), el('label', null, ['Desde (lunes)', inIni]), el('label', null, ['Hasta (viernes)', inFin])
    ].concat(botones));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!inTema.value.trim()) { aviso('Escriba el tema de la clase.', 'error'); return; }
      if (!inIni.value || !inFin.value) { aviso('Elija la fecha de inicio y la de fin.', 'error'); return; }
      if (inIni.value > inFin.value) { aviso('La fecha de inicio es posterior a la final.', 'error'); return; }
      var n = Number(inNum.value);
      if (!ed && !(n >= 1 && n <= 60 && Math.floor(n) === n)) { aviso('El número de clase debe ser de 1 a 60.', 'error'); return; }
      var problema = validarSemana(ed, inIni.value, inFin.value);
      if (problema) { aviso(problema, 'error'); return; }
      guardarClase(ed, n, inTema.value, inIni.value, inFin.value);
    });
    var hijos = [el('h2', { texto: ed ? 'Editar Clase ' + ed.numero : 'Agregar clase' }), form];
    if (t && (t.fecha_inicio || t.fecha_fin)) {
      hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Clases de 1 o 2 semanas completas (lunes a viernes), consecutivas y sin traslapes. Trimestre: ' + (t.fecha_inicio ? fechaTexto(t.fecha_inicio) : '…') + ' al ' + (t.fecha_fin ? fechaTexto(t.fecha_fin) : '…') + '.' }));
    }
    return el('section', { clase: 'bloque' }, hijos);
  }

  function dibujarLote() {
    var area = el('textarea', { 'aria-label': 'Clases para pegar', disabled: S.cerrado, placeholder: '15/5/2026 hasta 25/5/2026 clase 1 tema revisión de cuaderno\n28/5/2026 hasta 15/6/2026 clase 2 tema la célula' });
    area.value = S.lote;
    area.addEventListener('input', function () { S.lote = area.value; });
    var zona = el('div');
    function mostrarPrevia() {
      zona.textContent = '';
      if (!S.previa) { return; }
      var buenas = S.previa.filter(function (f) { return !f.error; });
      zona.appendChild(el('ul', { clase: 'plan-vista-previa' }, S.previa.map(function (f) {
        return el('li', { clase: f.error ? 'mal' : 'bien', texto: f.error
          ? f.linea + ' — ' + f.error
          : (f.numero ? 'Clase ' + f.numero : 'Clase (siguiente número)') + ' · ' + f.tema + ' · ' + fechaTexto(f.inicio) + ' al ' + fechaTexto(f.fin) });
      })));
      if (buenas.length && buenas.length === S.previa.length) {
        zona.appendChild(el('div', { clase: 'formulario-fila' }, [el('button', { clase: 'boton', type: 'button', texto: 'Crear ' + buenas.length + (buenas.length === 1 ? ' clase' : ' clases'), onclick: function () { crearLote(buenas); } })]));
      } else if (buenas.length) {
        zona.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Corrija las líneas marcadas con ✗ y vuelva a pulsar «Revisar».' }));
      }
    }
    var revisar = el('button', { clase: 'boton boton-secundario', type: 'button', disabled: S.cerrado, texto: 'Revisar', onclick: function () {
      S.previa = S.lote.trim() ? parsearLineas(S.lote) : null;
      if (!S.previa) { aviso('Pegue al menos una línea.', 'error'); return; }
      aviso('', 'info'); mostrarPrevia();
    } });
    mostrarPrevia();
    return el('section', { clase: 'bloque plan-lote' }, [
      el('h2', { texto: 'Pegar varias clases' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Una clase por línea: fecha de inicio, «hasta», fecha final, «clase», número y «tema». El número es opcional.' }),
      area, el('div', { clase: 'formulario-fila' }, [revisar]), zona
    ]);
  }

  function dibujarCalendario() {
    var t = trimestre();
    var sec = el('section', { clase: 'bloque plan-calendario' }, [el('h2', { texto: 'Calendario de semanas del trimestre' })]);
    if (!t || !t.fecha_inicio || !t.fecha_fin) return sec;
    sec.appendChild(el('p', { clase: 'plan-cal-fechas', texto: 'INICIO: ' + fechaConDia(t.fecha_inicio) + '  |  FINALIZA: ' + fechaConDia(t.fecha_fin) }));
    sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Los colores muestran qué semanas están ocupadas por cada clase. Las semanas grises están disponibles. No se pueden agregar clases después del cierre del trimestre.' }));
    var cuadricula = el('div', { clase: 'plan-cal-grid' });
    var cursor = t.fecha_inicio, dia = diaSemana(cursor);
    if (dia !== 1) cursor = moverDias(cursor, -(dia === 0 ? 6 : dia - 1));
    var n = 0, ocupadas = 0, libres = 0;
    while (cursor <= t.fecha_fin && n < 55) {
      n++;
      var fin = moverDias(cursor, 4);
      var c = S.plan.filter(function (x) { return x.fecha_inicio <= fin && x.fecha_fin >= cursor; })[0];
      var completa = cursor >= t.fecha_inicio && fin <= t.fecha_fin;
      var tipo = !completa ? 'fuera' : (c ? 'ocupada' : 'libre');
      if (completa) { if (c) ocupadas++; else libres++; }
      var tarjeta = el('div', { clase: 'plan-cal-semana plan-cal-' + tipo + (c ? ' plan-cal-color-' + (c.numero % 5) : '') }, [
        el('strong', { texto: 'Semana ' + n }),
        el('span', { texto: fechaTexto(cursor) + ' — ' + fechaTexto(fin) }),
        el('span', { texto: !completa ? 'Fuera del período' : (c ? 'Clase ' + c.numero + ': ' + c.tema : 'Disponible') })
      ]);
      cuadricula.appendChild(tarjeta);
      cursor = moverDias(cursor, 7);
    }
    sec.appendChild(el('p', { clase: 'plan-cal-resumen', texto: ocupadas + ' de ' + (ocupadas + libres) + ' semanas planificadas · ' + libres + ' disponibles' }));
    var progreso = el('div', { clase: 'plan-cal-progreso', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ocupadas + libres), 'aria-valuenow': String(ocupadas) }, [el('div', { clase: 'plan-cal-progreso-barra' })]);
    progreso.firstChild.style.width = (ocupadas + libres ? Math.round(100 * ocupadas / (ocupadas + libres)) : 0) + '%';
    sec.appendChild(progreso);
    sec.appendChild(cuadricula);
    return sec;
  }

  function calendarioSeguro() {
    try { return dibujarCalendario(); }
    catch (e) {
      console.error('Portal2027: error en calendario', e);
      return el('section', { clase: 'bloque plan-calendario' }, [
        el('h2', { texto: 'Calendario del trimestre' }),
        el('p', { clase: 'mensaje error', texto: 'No se pudo dibujar el calendario. Las demás funciones de planificación siguen disponibles.' })
      ]);
    }
  }

  function dibujarTabla() {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Clases del trimestre' })]);
    if (S.plan.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay clases planificadas.' })); return sec; }
    var totalSesiones = S.plan.reduce(function (n,c) { return n + sesionesDe(c); }, 0);
    sec.appendChild(el('p', { clase: 'plan-resumen-sesiones', texto: S.plan.length + ' clases planificadas · ' + totalSesiones + ' sesiones de asistencia registradas. Las sesiones se cuentan por fecha, no por cantidad de estudiantes.' }));
    var filas = S.plan.map(function (c) {
      var est = estadoClase(c);
      var gancho = el('span', { clase: 'gancho gancho-' + est, texto: est === 'activa' ? 'Activa' : (est === 'proxima' ? 'Pendiente' : 'Terminada') });
      return el('tr', { clase: est === 'activa' ? 'fila-activa' : null }, [
        el('td', null, [gancho]),
        el('td', { texto: 'Clase ' + c.numero }),
        el('td', { clase: 'plan-tema', texto: c.tema }),
        el('td', { texto: fechaConDia(c.fecha_inicio) }), el('td', { texto: fechaConDia(c.fecha_fin) }),
        el('td', null, [el('strong', { clase: 'plan-sesiones-numero', texto: String(sesionesDe(c)) }), el('span', { clase: 'plan-sesiones-detalle', texto: sesionesDe(c) === 1 ? ' sesión registrada' : ' sesiones registradas' })]),
        el('td', null, [el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario boton-chico', href: urlAsistencia(c), texto: 'Asistencia' }),
          el('a', { clase: 'boton boton-secundario boton-chico', href: urlApreciacion(c), texto: 'Apreciación' }),
          el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Editar', disabled: S.cerrado, onclick: function () { S.editando = c; dibujar(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }),
          el('button', { clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Quitar', disabled: S.cerrado, onclick: function () { quitar(c); } })
        ])])
      ]);
    });
    sec.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Estado', 'Clase', 'Tema', 'Desde (día y fecha)', 'Hasta (día y fecha)', 'Asistencias registradas', 'Acciones'].map(function (x) { return el('th', { scope: 'col', texto: x }); }))]),
      el('tbody', null, filas)
    ])]));
    sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'El estado se marca solo según la fecha de hoy. Cada sesión es un registro de asistencia en una fecha de esta clase. Use «Asistencia» para registrar una nueva; el conteo se actualizará al recargar. No representa el número de alumnos ni las horas programadas.' }));
    return sec;
  }

  function dibujar() {
    var previo = contenido.querySelector('.plan-cuerpo');
    if (previo) { previo.remove(); }
    var selTrim = el('select', { 'aria-label': 'Trimestre' }, S.trimestres.map(function (t) {
      return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === S.trimestreId });
    }));
    selTrim.addEventListener('change', function () { S.trimestreId = selTrim.value; S.editando = null; S.previa = null; recargar(); });
    var cuerpo = el('div', { clase: 'plan-cuerpo secciones' }, [
      el('section', { clase: 'bloque' }, [el('div', { clase: 'formulario-fila' }, [
        el('label', null, ['Trimestre', selTrim]),
        el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recargar', onclick: function () { recargar('Planificación recargada.'); } })
      ]), S.cerrado ? el('p', { clase: 'mensaje info', texto: 'Este trimestre está cerrado: la planificación no se puede cambiar.' }) : null]),
      calendarioSeguro(), dibujarActiva(), dibujarGrupos(), dibujarFormulario(), dibujarLote(), dibujarTabla()
    ]);
    contenido.appendChild(cuerpo);
  }

  /* ---------- inicio ---------- */
  function errorPantalla(texto) {
    contenido.textContent = '';
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: texto }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }

  async function iniciar() {
    if (!db) { errorPantalla(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { errorPantalla(P.traducirError(e)); return; }
    var rolPanel = info && (info.roles.indexOf('profesor') !== -1 ? 'profesor' : (info.roles.indexOf('administrador') !== -1 ? 'administrador' : null));
    if (!info || !rolPanel) { window.location.replace(P.rutaInicio()); return; }
    db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); } });
    S.info = info; S.rolPanel = rolPanel;

    var params = new URLSearchParams(window.location.search);
    var asigId = params.get('asignacion');
    contenido.textContent = '';
    barra = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });
    try {
      S.asig = asigId ? await consultar(db.from('portal2027_asignaciones')
        .select('id, profesor_id, materia_id, salon:portal2027_salones(id,nombre,grado,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
        .eq('id', asigId).maybeSingle()) : null;
      if (!S.asig) { errorPantalla('No se encontró esta asignación o no tiene acceso a ella.'); return; }
      try {
        S.hermanas = (await consultar(db.from('portal2027_asignaciones').select('id, salon:portal2027_salones!inner(id,nombre,grado,anio_id)')
          .eq('materia_id', S.asig.materia_id).eq('profesor_id', S.asig.profesor_id)
          .eq('salon.grado', S.asig.salon.grado).eq('salon.anio_id', S.asig.salon.anio_id).neq('id', S.asig.id)))
          .sort(function (a, b) { return a.salon.nombre.localeCompare(b.salon.nombre, 'es'); });
      } catch (e) { S.hermanas = []; }
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero,fecha_inicio,fecha_fin').eq('anio_id', S.asig.salon.anio_id).order('numero'));
      var pedido = params.get('trimestre');
      if (pedido && S.trimestres.some(function (t) { return t.id === pedido; })) { S.trimestreId = pedido; }
      else {
        // Sin trimestre pedido: el que contiene la fecha de hoy; si no hay, el primero.
        var h = hoy();
        var actual = S.trimestres.filter(function (t) { return t.fecha_inicio && t.fecha_fin && h >= t.fecha_inicio && h <= t.fecha_fin; })[0];
        S.trimestreId = actual ? actual.id : (S.trimestres[0] ? S.trimestres[0].id : null);
      }
      if (!S.trimestreId) { errorPantalla('Este año no tiene trimestres.'); return; }

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Planificación' }),
          el('h1', { texto: S.asig.materia.nombre + ' · ' + S.asig.salon.nombre }),
          el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + S.asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-asistencia.html?asignacion=' + encodeURIComponent(S.asig.id), texto: 'Asistencia' }),
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(S.asig.id), texto: 'Libreta' }),
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: 'Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(barra);
      await cargar();
      dibujar();
    } catch (e) {
      errorPantalla('No se pudo abrir la planificación. ' + textoError(e));
    }
  }

  iniciar();
})();
