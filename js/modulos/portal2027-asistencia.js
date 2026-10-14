/* portal2027-asistencia.js — etapa 4, parte A: asistencia por sesión.
   Aquí solo se registra y se cuenta (conteo por estado). NO se calcula ningún porcentaje, peso ni
   estado pendiente/exento: eso se define en la parte B. Todo cambio se guarda con funciones de la base
   (permisos, bloqueo, versión e historial); la pantalla solo muestra el resultado real. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var contenido = document.getElementById('contenido');

  var S = {
    info: null, asig: null, trimestres: [], trimestreId: null,
    estados: [], sesiones: [], mats: [], asist: {},   // asist: sesionId|matId -> {estado, version}
    buscar: '', plan: [], claseSel: null, horarioDias: [], horarioAviso: '', calendarioSemana: null
  };
  var barra = null;
  var zonaTabla = null;
  var filasEst = {};                                   // matId -> { celdas: {codigo: td}, sin: td }
  var resumenes = {};                                  // sesionId -> span

  /* ---------- utilidades ---------- */
  async function consultar(q) {
    var r = await q;
    if (r.error) { throw r.error; }
    return r.data;
  }
  async function todas(fabrica) {
    var salida = [], desde = 0;
    for (;;) {
      var lote = await consultar(fabrica().range(desde, desde + 999));
      salida = salida.concat(lote);
      if (lote.length < 1000) { return salida; }
      desde += 1000;
    }
  }
  function aviso(texto, tipo) {
    barra.textContent = texto;
    barra.className = 'mensaje estado-panel ' + (tipo || 'info');
    barra.hidden = !texto;
  }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^CONFLICTO/.test(m)) { return m.replace(/^CONFLICTO:\s*/, 'Conflicto: ') + ' Pulse «Recargar».'; }
    if (/^(No tiene permiso|La sesión|El estudiante|El estado|Ya existe|Elija|La fecha|El trimestre)/.test(m)) {
      return m.replace(/\s*\(row-level security\)/, '');
    }
    return P.traducirError(e);
  }
  function clave(s, m) { return s + '|' + m; }
  // Apellido y nombre; si falta el apellido se toma la última palabra del nombre (corregir en Administración > Estudiantes).
  function partesNombre(e) {
    var ap = String(e.apellidos || '').trim(), no = String(e.nombres || '').trim();
    if (!ap && no.indexOf(' ') !== -1) { var w = no.split(/\s+/); ap = w.pop(); no = w.join(' '); }
    return { ap: ap, no: no };
  }
  function nombreEst(e) { var p = partesNombre(e); return (p.ap + ', ' + p.no).replace(/^, |, $/g, ''); }
  function comparaEst(a, b) {
    var x = partesNombre(a), y = partesNombre(b);
    return x.ap.localeCompare(y.ap, 'es', { sensitivity: 'base' }) || x.no.localeCompare(y.no, 'es', { sensitivity: 'base' });
  }
  function sesionPorId(id) { return S.sesiones.filter(function (s) { return s.id === id; })[0]; }
  function estadoPorCodigo(c) { return S.estados.filter(function (e) { return e.codigo === c; })[0]; }
  // Con una clase de la planificación elegida solo cuentan las sesiones cuya fecha cae dentro de sus fechas.
  function claseDePlan(id) { return S.plan.filter(function (c) { return c.id === id; })[0] || null; }
  function claseSeleccionada() { return claseDePlan(S.claseSel); }
  function claseDeHoy() { var h = hoy(); return S.plan.filter(function (c) { return h >= c.fecha_inicio && h <= c.fecha_fin; })[0] || null; }
  function activas() {
    var c = claseSeleccionada();
    return S.sesiones.filter(function (s) { return !s.eliminada_en && (!c || (s.fecha >= c.fecha_inicio && s.fecha <= c.fecha_fin)); });
  }
  function fechaTexto(f) {          // 'AAAA-MM-DD' sin pasar por zonas horarias
    var p = String(f).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function diaSemana(f) {
    var p = String(f).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('es-PA', { weekday: 'short' });
  }
  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- carga ---------- */
  async function cargarAsignacion(id) {
    return consultar(db.from('portal2027_asignaciones')
      .select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
      .eq('id', id).maybeSingle());
  }

  async function cargarAsistencia() {
    var asigId = S.asig.id, trId = S.trimestreId;
    var r = await Promise.all([
      consultar(db.from('portal2027_estados_asistencia').select('codigo,etiqueta,abreviatura,orden,activo').order('orden').order('codigo')),
      todas(function () {
        return db.from('portal2027_sesiones_asistencia')
          .select('id,fecha,bloque,descripcion,bloqueada,eliminada_en,version')
          .eq('asignacion_id', asigId).eq('trimestre_id', trId).order('fecha').order('bloque').order('id');
      }),
      todas(function () {
        return db.from('portal2027_matriculas')
          .select('id,estado,estudiante:portal2027_estudiantes(codigo,nombres,apellidos)')
          .eq('salon_id', S.asig.salon.id).eq('anio_id', S.asig.salon.anio_id).order('id');
      }),
      todas(function () {
        return db.from('portal2027_asistencia')
          .select('sesion_id,matricula_id,estado,version,sesion:portal2027_sesiones_asistencia!inner(asignacion_id,trimestre_id)')
          .eq('sesion.asignacion_id', asigId).eq('sesion.trimestre_id', trId).order('id');
      })
    ]);
    S.estados = r[0];
    S.sesiones = r[1];
    S.mats = r[2].filter(function (m) { return m.estudiante; }).sort(function (a, b) { return comparaEst(a.estudiante, b.estudiante); });
    S.asist = {};
    r[3].forEach(function (a) { S.asist[clave(a.sesion_id, a.matricula_id)] = { estado: a.estado, version: a.version }; });
    await cargarComportamiento();
    await cargarPlan();
    await cargarDiasHorario();
  }

  /* ---------- planificación: la clase activa se abre sola (migración 0029) ---------- */
  async function cargarPlan() {
    S.plan = [];
    try {
      S.plan = await consultar(db.from('portal2027_plan_clases').select('id,numero,tema,fecha_inicio,fecha_fin')
        .eq('asignacion_id', S.asig.id).eq('trimestre_id', S.trimestreId).is('eliminada_en', null).order('fecha_inicio').order('numero'));
    } catch (e) { S.plan = []; }   // sin la migración 0029 la asistencia funciona completa, sin filtro por clase
    if (S.claseSel !== 'todo' && !claseDePlan(S.claseSel)) {
      var hoyC = claseDeHoy();
      S.claseSel = hoyC ? hoyC.id : 'todo';
    }
  }

  async function cargarDiasHorario() {
    S.horarioDias = []; S.horarioAviso = '';
    try {
      var filas = await consultar(db.from('portal2027_horario').select('dia,hora_inicio,asignacion_id')
        .eq('anio_id', S.asig.salon.anio_id).eq('asignacion_id', S.asig.id).eq('tipo', 'clase').order('dia').order('hora_inicio'));
      S.horarioDias = filas;
      if (!filas.length) S.horarioAviso = 'No hay días asignados a esta materia y grupo en el horario. Revise Horario.';
    } catch (e) { S.horarioAviso = 'No se pudo consultar el horario; la asistencia sigue disponible.'; }
  }
  function sumarDias(fecha, dias) {
    var p = fecha.split('-').map(Number), d = new Date(p[0], p[1]-1, p[2]+dias);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function lunesDe(fecha) { var p=fecha.split('-').map(Number), d=new Date(p[0],p[1]-1,p[2]); return sumarDias(fecha,-((d.getDay()+6)%7)); }
  function crearCalendarioAsistencia(inputFecha, clase) {
    var caja = el('section', { clase:'asis-calendario' });
    var titulo = el('strong', { texto:'Calendario de asistencia · días de la materia' });
    var subtitulo = el('p', { clase:'asis-cal-ayuda', texto:S.horarioAviso || 'Seleccione un día de clase para completar la fecha de la nueva sesión. No se guarda hasta pulsar Agregar sesión.' });
    var semana = S.calendarioSemana || lunesDe(hoy());
    var dias = el('div', { clase:'asis-cal-dias' });
    var rango = el('span');
    var anterior = el('button',{type:'button',clase:'boton boton-secundario boton-chico',texto:'← Anterior',onclick:function(){semana=sumarDias(semana,-7);S.calendarioSemana=semana;pintar();}});
    var siguiente = el('button',{type:'button',clase:'boton boton-secundario boton-chico',texto:'Siguiente →',onclick:function(){semana=sumarDias(semana,7);S.calendarioSemana=semana;pintar();}});
    var botonHoy = el('button',{type:'button',clase:'boton boton-secundario boton-chico',texto:'Hoy',onclick:function(){semana=lunesDe(hoy());S.calendarioSemana=semana;pintar();}});
    function pintar() {
      dias.textContent=''; rango.textContent=fechaTexto(semana)+' al '+fechaTexto(sumarDias(semana,4));
      ['Lunes','Martes','Miércoles','Jueves','Viernes'].forEach(function(nombre,i){
        var fecha=sumarDias(semana,i), bloques=S.horarioDias.filter(function(h){return Number(h.dia)===i+1;});
        var sesiones=S.sesiones.filter(function(s){return !s.eliminada_en && s.fecha===fecha;});
        var enClase=!clase || (fecha>=clase.fecha_inicio && fecha<=clase.fecha_fin);
        var estado=!bloques.length?'libre':sesiones.length?'registrada':fecha===hoy()?'hoy':fecha<hoy()?'atrasada':'pendiente';
        var btn=el('button',{type:'button',clase:'asis-cal-dia asis-cal-'+estado,disabled:!bloques.length||!enClase,
          title:!enClase?'Fuera de las fechas de la clase':nombre+' '+fechaTexto(fecha),
          onclick:function(){inputFecha.value=fecha;inputFecha.dispatchEvent(new Event('change'));dias.querySelectorAll('.asis-cal-elegida').forEach(function(x){x.classList.remove('asis-cal-elegida');});btn.classList.add('asis-cal-elegida');}});
        btn.appendChild(el('span',{texto:nombre}));btn.appendChild(el('strong',{texto:fechaTexto(fecha).slice(0,5)}));
        btn.appendChild(el('small',{texto:!bloques.length?'Sin clase':sesiones.length?sesiones.length+' registrada(s)':fecha===hoy()?'Hoy · pendiente':fecha<hoy()?'Sin registrar':bloques.length+' bloque(s)'}));
        if(inputFecha.value===fecha)btn.classList.add('asis-cal-elegida');
        dias.appendChild(btn);
      });
    }
    caja.appendChild(el('div',{clase:'asis-cal-cabecera'},[titulo,anterior,botonHoy,siguiente,rango]));
    caja.appendChild(subtitulo);caja.appendChild(dias);
    caja.appendChild(el('p',{clase:'asis-cal-ayuda',texto:'Verde: registrada · Azul: hoy · Rojo: fecha anterior sin registrar · Gris: sin materia. Los registros se verifican por fecha.'}));
    pintar(); return caja;
  }

  /* ---------- comportamiento diario (Bien / Mal por cada sesión de clase) ---------- */
  var filasComp = {}, resumenesComp = {};
  async function cargarComportamiento() {
    S.comp = {}; S.compError = '';
    try {
      var d = await todas(function () {
        return db.from('portal2027_comportamiento')
          .select('sesion_id,matricula_id,estado,version,sesion:portal2027_sesiones_asistencia!inner(asignacion_id,trimestre_id)')
          .eq('sesion.asignacion_id', S.asig.id).eq('sesion.trimestre_id', S.trimestreId).order('id');
      });
      d.forEach(function (c) { S.comp[clave(c.sesion_id, c.matricula_id)] = { estado: c.estado, version: c.version }; });
    } catch (e) {
      S.compError = 'No se pudo cargar el comportamiento. ' + textoError(e) + ' (Verifique que la migración 0024 esté instalada.)';
    }
  }
  function contarComp(matId) {
    var bien = 0, mal = 0, ses = activas();
    ses.forEach(function (x) {
      var c = S.comp[clave(x.id, matId)];
      if (c && c.estado === 'bien') { bien++; } else if (c && c.estado === 'mal') { mal++; }
    });
    return { bien: bien, mal: mal, sin: ses.length - bien - mal };
  }
  function actualizarFilaComp(matId) {
    var f = filasComp[matId];
    if (!f) { return; }
    var c = contarComp(matId);
    f.bien.textContent = String(c.bien); f.mal.textContent = String(c.mal); f.sin.textContent = String(c.sin);
  }
  function actualizarResumenComp(sesId) {
    var span = resumenesComp[sesId];
    if (!span) { return; }
    var n = S.mats.filter(function (m) { var c = S.comp[clave(sesId, m.id)]; return c && c.estado; }).length;
    span.textContent = n + ' de ' + S.mats.length + ' evaluados';
  }
  // Guarda el comportamiento elegido. Devuelve { ok, estado }: el estado que quedó guardado (el anterior si falló).
  async function guardarComp(ses, mat, nuevo, marca) {
    var k = clave(ses.id, mat.id);
    var previa = S.comp[k] || { estado: null, version: 0 };
    if (nuevo === previa.estado) { return { ok: true, estado: previa.estado }; }
    marca('guardando');
    try {
      var r = await db.rpc('portal2027_guardar_comportamiento', { p_sesion: ses.id, p_matricula: mat.id, p_estado: nuevo, p_version: previa.version });
      if (r.error) { throw r.error; }
      S.comp[k] = { estado: r.data.estado, version: r.data.version };
      marca('ok');
      actualizarFilaComp(mat.id); actualizarResumenComp(ses.id);
      aviso('Comportamiento guardado.', 'ok');
      return { ok: true, estado: r.data.estado };
    } catch (e) {
      marca('error');
      aviso('NO se guardó el comportamiento de ' + nombreEst(mat.estudiante) + '. ' + textoError(e), 'error');
      return { ok: false, estado: previa.estado };
    }
  }
  function moverComp(boton, df, dc) {
    var f = Number(boton.dataset.fila) + df, c = Number(boton.dataset.col) + dc;
    var dest = zonaTabla.querySelector('button[data-fila="' + f + '"][data-col="' + c + '"]');
    if (!dest || dest.disabled) { return false; }
    dest.focus();
    return true;
  }
  // Casilla de comportamiento: toque o teclado. Toque: — → Bien → Mal → —. Teclas: B = Bien, M = Mal, Supr = vaciar;
  // Enter baja al siguiente estudiante; flechas se mueven entre casillas. Se guarda sola a los instantes.
  function celdaComp(ses, mat, fila, col) {
    var previa = S.comp[clave(ses.id, mat.id)] || { estado: null, version: 0 };
    var deseado = previa.estado, temporizador = null, ocupado = false;
    var boton = el('button', { type: 'button', clase: 'asis-toque', disabled: ses.bloqueada });
    boton.dataset.fila = String(fila); boton.dataset.col = String(col);
    var td = el('div', { clase: 'celda-asis' }, [boton]);
    function marca(tipo) { td.className = 'celda-asis' + (tipo ? ' asis-' + tipo : ''); }
    function pintar() {
      var texto = deseado === 'bien' ? 'Bien' : (deseado === 'mal' ? 'Mal' : null);
      boton.textContent = texto || '—';
      boton.className = 'asis-toque ' + (deseado ? 'est-' + deseado : 'est-vacio');
      boton.title = texto || 'Sin evaluar';
      boton.setAttribute('aria-label', 'Comportamiento de ' + nombreEst(mat.estudiante) + ' el ' + fechaTexto(ses.fecha) + ': ' + (texto || 'sin evaluar') + '.');
    }
    async function enviar() {
      if (ocupado) { return; }
      ocupado = true;
      var r = await guardarComp(ses, mat, deseado, marca);
      ocupado = false;
      if (!r.ok) { deseado = r.estado; pintar(); return; }
      if (deseado !== r.estado && temporizador === null) { enviar(); }
    }
    function poner(e) {
      deseado = e; pintar();
      if (temporizador) { clearTimeout(temporizador); }
      temporizador = setTimeout(function () { temporizador = null; enviar(); }, 450);
    }
    boton.addEventListener('click', function () { poner(deseado === null ? 'bien' : (deseado === 'bien' ? 'mal' : null)); });
    boton.addEventListener('keydown', function (k) {
      var t = k.key;
      if (t === 'b' || t === 'B') { k.preventDefault(); poner('bien'); moverComp(boton, 1, 0); }
      else if (t === 'm' || t === 'M') { k.preventDefault(); poner('mal'); moverComp(boton, 1, 0); }
      else if (t === 'Delete' || t === 'Backspace') { k.preventDefault(); poner(null); }
      else if (t === 'Enter') { k.preventDefault(); moverComp(boton, k.shiftKey ? -1 : 1, 0); }
      else if (t === 'ArrowDown') { k.preventDefault(); moverComp(boton, 1, 0); }
      else if (t === 'ArrowUp') { k.preventDefault(); moverComp(boton, -1, 0); }
      else if (t === 'ArrowRight') { k.preventDefault(); moverComp(boton, 0, 1); }
      else if (t === 'ArrowLeft') { k.preventDefault(); moverComp(boton, 0, -1); }
    });
    pintar();
    return td;
  }
  async function recargar(mensaje) {
    aviso('Cargando asistencia…', 'info');
    try {
      await cargarAsistencia();
      dibujar();
      aviso(mensaje || '', mensaje ? 'ok' : 'info');
    } catch (e) { aviso('No se pudo cargar la asistencia. ' + textoError(e), 'error'); }
  }

  /* ---------- acciones sobre sesiones ---------- */
  async function llamar(nombre, args, textoOk) {
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc(nombre, args);
      if (r.error) { throw r.error; }
      await cargarAsistencia();
      dibujar();
      aviso(typeof textoOk === 'function' ? textoOk(r.data) : textoOk, 'ok');
    } catch (e) {
      aviso('No se guardó. ' + textoError(e), 'error');
    }
  }
  function cambiarDescripcion(s, input) {
    if (input.value.trim() === (s.descripcion || '')) { return; }
    llamar('portal2027_actualizar_sesion', { p_id: s.id, p_version: s.version, p_descripcion: input.value, p_bloqueada: null }, 'Descripción guardada.');
  }
  function alternarBloqueo(s) {
    llamar('portal2027_actualizar_sesion', { p_id: s.id, p_version: s.version, p_descripcion: null, p_bloqueada: !s.bloqueada },
      s.bloqueada ? 'Sesión desbloqueada.' : 'Sesión bloqueada: ya no se puede cambiar la asistencia.');
  }
  var confirmacionesSesion = new Set();
  async function confirmarAccionSesion(llave, titulo, mensaje, textoBoton, nombre, args, textoOk) {
    if (confirmacionesSesion.has(llave)) { return; }
    confirmacionesSesion.add(llave);
    try {
      if (!(await P.confirmar(titulo, mensaje, textoBoton))) { return; }
      await llamar(nombre, args, textoOk);
    } catch (e) {
      aviso('No se guardó. ' + textoError(e), 'error');
    } finally {
      confirmacionesSesion.delete(llave);
    }
  }
  async function aPapelera(s, si) {
    var args = { p_id: s.id, p_version: s.version, p_a_papelera: si };
    if (si) {
      await confirmarAccionSesion('papelera|' + s.id, 'Enviar sesión a la papelera',
        '¿Enviar esta sesión a la papelera? Sus marcas se conservan y podrá restaurarla.', 'Enviar a la papelera',
        'portal2027_papelera_sesion', args, 'Sesión enviada a la papelera.');
    } else {
      await llamar('portal2027_papelera_sesion', args, 'Sesión restaurada.');
    }
  }
  // Al abrir una fecha nueva se asume que todos llegaron: quedan en «Presente» y el profesor solo toca a quien faltó.
  async function crearSesionConPresentes(args) {
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc('portal2027_crear_sesion', args);
      if (r.error) { throw r.error; }
      var texto = 'Sesión agregada.', tipo = 'ok';
      if (estadoPorCodigo('presente') && estadoPorCodigo('presente').activo) {
        var m = await db.rpc('portal2027_marcar_pendientes', { p_sesion: r.data, p_estado: 'presente' });
        if (m.error) { texto = 'Sesión agregada, pero NO se marcó «Presente» a todos. ' + textoError(m.error) + ' Use «Todos presentes» en la fecha.'; tipo = 'error'; }
        else { texto = 'Sesión agregada: ' + m.data + ' estudiante(s) quedaron como Presente. Toque la casilla de quien faltó.'; }
      }
      // Comportamiento: todos empiezan en «Bien»; el profesor solo cambia a «Mal» a quien se porte mal.
      var b = await db.rpc('portal2027_marcar_bien_pendientes', { p_sesion: r.data });
      if (b.error) { texto += ' OJO: no se pudo poner «Bien» a todos. ' + textoError(b.error); tipo = 'error'; }
      else { texto += ' Comportamiento: ' + b.data + ' en «Bien».'; }
      await cargarAsistencia();
      dibujar();
      aviso(texto, tipo);
    } catch (e) {
      aviso('No se guardó. ' + textoError(e), 'error');
    }
  }

  async function marcarPendientes(sesionId, codigo) {
    var s = sesionPorId(sesionId), e = estadoPorCodigo(codigo);
    if (!s || !e) { aviso('Elija la sesión y el estado.', 'error'); return; }
    await confirmarAccionSesion('asistencia|' + sesionId, 'Marcar asistencia sin registro',
      'Se marcará «' + e.etiqueta + '» a todos los estudiantes sin registro de la sesión del ' + fechaTexto(s.fecha) +
      '. Los ya marcados no cambian. ¿Continuar?', 'Marcar sin registro',
      'portal2027_marcar_pendientes', { p_sesion: sesionId, p_estado: codigo }, function (n) {
        return n + (n === 1 ? ' estudiante marcado.' : ' estudiantes marcados.');
      });
  }

  /* ---------- guardar una marca ---------- */
  // Guarda el estado elegido. Devuelve { ok, estado }: el estado que quedó guardado (el anterior si falló).
  async function guardarMarca(ses, mat, nuevo, marca) {
    var k = clave(ses.id, mat.id);
    var previa = S.asist[k] || { estado: null, version: 0 };
    if (nuevo === previa.estado) { return { ok: true, estado: previa.estado }; }
    marca('guardando');
    try {
      var r = await db.rpc('portal2027_guardar_asistencia', { p_sesion: ses.id, p_matricula: mat.id, p_estado: nuevo, p_version: previa.version });
      if (r.error) { throw r.error; }
      S.asist[k] = { estado: r.data.estado, version: r.data.version };
      marca('ok');
      actualizarFila(mat.id);
      actualizarResumen(ses.id);
      aviso('Asistencia guardada.', 'ok');
      return { ok: true, estado: r.data.estado };
    } catch (e) {
      marca('error');
      aviso('NO se guardó la asistencia de ' + nombreEst(mat.estudiante) + '. ' + textoError(e), 'error');
      return { ok: false, estado: previa.estado };
    }
  }

  function estadosColumnas() {
    var usados = {};
    Object.keys(S.asist).forEach(function (k) { if (S.asist[k].estado) { usados[S.asist[k].estado] = true; } });
    return S.estados.filter(function (e) { return e.activo || usados[e.codigo]; });
  }

  function contar(matId) {
    var cuenta = {}, marcadas = 0, ses = activas();
    ses.forEach(function (s) {
      var a = S.asist[clave(s.id, matId)];
      if (a && a.estado) { cuenta[a.estado] = (cuenta[a.estado] || 0) + 1; marcadas += 1; }
    });
    return { cuenta: cuenta, sin: ses.length - marcadas };
  }

  function actualizarFila(matId) {
    var f = filasEst[matId];
    if (!f) { return; }
    var c = contar(matId);
    Object.keys(f.celdas).forEach(function (cod) { f.celdas[cod].textContent = String(c.cuenta[cod] || 0); });
    f.sin.textContent = String(c.sin);
  }

  function actualizarResumen(sesId) {
    var span = resumenes[sesId];
    if (!span) { return; }
    var marcadas = S.mats.filter(function (m) { var a = S.asist[clave(sesId, m.id)]; return a && a.estado; }).length;
    span.textContent = marcadas + ' de ' + S.mats.length + ' marcados';
  }

  // Casilla de toque: cada toque pasa al siguiente estado (P -> A -> T -> J -> P…). Se guarda al dejar de tocar.
  function celdaAsistencia(ses, mat) {
    var k = clave(ses.id, mat.id);
    var reg = S.asist[k];
    var deseado = reg ? reg.estado : null;
    var ciclo = S.estados.filter(function (e) { return e.activo; }).map(function (e) { return e.codigo; });
    var boton = el('button', { type: 'button', clase: 'asis-toque', disabled: ses.bloqueada });
    var td = el('div', { clase: 'celda-asis' }, [boton]);
    var temporizador = null, ocupado = false;
    function marca(tipo) { td.className = 'celda-asis' + (tipo ? ' asis-' + tipo : ''); }
    function pintar() {
      var e = deseado ? estadoPorCodigo(deseado) : null;
      boton.textContent = e ? e.abreviatura : '—';
      boton.className = 'asis-toque ' + (deseado ? 'est-' + deseado : 'est-vacio');
      boton.title = e ? e.etiqueta : 'Sin marcar';
      boton.setAttribute('aria-label', 'Asistencia de ' + nombreEst(mat.estudiante) + ' el ' + fechaTexto(ses.fecha) + ': ' + (e ? e.etiqueta : 'sin marcar') + '. Toque para cambiar.');
    }
    function siguiente(c) {
      var i = ciclo.indexOf(c);
      return ciclo.length === 0 ? c : ciclo[(i + 1) % ciclo.length];   // sin marcar (i = -1) pasa al primero
    }
    async function enviar() {
      if (ocupado) { return; }
      ocupado = true;
      var r = await guardarMarca(ses, mat, deseado, marca);
      ocupado = false;
      if (!r.ok) { deseado = r.estado; pintar(); return; }      // falló: vuelve a lo que estaba guardado
      if (deseado !== r.estado && temporizador === null) { enviar(); }   // hubo toques mientras guardaba: guarda el último
    }
    boton.addEventListener('click', function () {
      deseado = siguiente(deseado);
      pintar();
      if (temporizador) { clearTimeout(temporizador); }
      temporizador = setTimeout(function () { temporizador = null; enviar(); }, 450);
    });
    pintar();
    return td;
  }

  function cabeceraSesion(ses) {
    var desc = el('input', { type: 'text', clase: 'tema-input', value: ses.descripcion || '', placeholder: 'Descripción', maxlength: '120', disabled: ses.bloqueada, 'aria-label': 'Descripción de la sesión' });
    desc.addEventListener('change', function () { cambiarDescripcion(ses, desc); });
    function boton(texto, titulo, fn) { return el('button', { clase: 'mini', type: 'button', texto: texto, title: titulo, 'aria-label': titulo, onclick: fn }); }
    var resumen = el('span', { clase: 'sesion-meta' });
    resumenes[ses.id] = resumen;
    var resumenC = el('span', { clase: 'sesion-meta' });
    resumenesComp[ses.id] = resumenC;
    return el('th', { scope: 'col', clase: 'col-sesion' }, [
      el('div', { clase: 'sesion-fecha', texto: diaSemana(ses.fecha) + ' ' + fechaTexto(ses.fecha) }),
      el('span', { clase: 'sesion-meta', texto: 'Bloque ' + ses.bloque }),
      desc, resumen,
      S.compError ? null : resumenC,
      S.compError ? null : el('div', { clase: 'sub-doble' }, [el('span', { texto: 'Asistencia' }), el('span', { texto: 'Conducta' })]),
      el('div', { clase: 'col-acciones' }, [
        ses.bloqueada ? null : boton('✓', 'Todos presentes (a quienes no tienen marca)', function () { return marcarPendientes(ses.id, 'presente'); }),
        boton(ses.bloqueada ? '🔒' : '🔓', ses.bloqueada ? 'Desbloquear sesión' : 'Bloquear sesión', function () { alternarBloqueo(ses); }),
        boton('🗑', 'Enviar a la papelera', function () { return aPapelera(ses, true); })
      ])
    ]);
  }

  function dibujarTabla() {
    zonaTabla.textContent = '';
    filasEst = {};
    resumenes = {};
    filasComp = {}; resumenesComp = {};
    var ses = activas();
    var cols = estadosColumnas();

    var cab = [el('th', { scope: 'col', clase: 'col-nombre', texto: 'Estudiante' })];
    ses.forEach(function (s) { cab.push(cabeceraSesion(s)); });
    cols.forEach(function (e) { cab.push(el('th', { scope: 'col', clase: 'col-conteo', title: e.etiqueta, texto: e.abreviatura })); });
    cab.push(el('th', { scope: 'col', clase: 'col-conteo', title: 'Sesiones sin marcar', texto: 'Sin' }));
    if (!S.compError) {
      cab.push(el('th', { scope: 'col', clase: 'col-conteo col-comp', title: 'Sesiones con comportamiento Bien', texto: 'Bien' }));
      cab.push(el('th', { scope: 'col', clase: 'col-conteo col-comp', title: 'Sesiones con comportamiento Mal', texto: 'Mal' }));
      cab.push(el('th', { scope: 'col', clase: 'col-conteo col-comp', title: 'Sesiones sin evaluar el comportamiento', texto: 'Sin ev.' }));
    }

    var q = S.buscar.trim().toLowerCase();
    var mats = S.mats.filter(function (m) {
      return !q || (m.estudiante.codigo + ' ' + nombreEst(m.estudiante)).toLowerCase().indexOf(q) !== -1;
    });

    var cuerpo = mats.map(function (m, i) {
      var celdas = [el('th', { scope: 'row', clase: 'col-nombre' }, [nombreEst(m.estudiante), m.estado && m.estado !== 'activo' ? el('small', { texto: ' (' + m.estado + ')' }) : null])];
      ses.forEach(function (s, j) {
        var partes = [celdaAsistencia(s, m)];
        if (!S.compError) { partes.push(celdaComp(s, m, i, j)); }
        celdas.push(el('td', { clase: 'celda-doble' }, partes));
      });
      var f = { celdas: {}, sin: null };
      cols.forEach(function (e) { var td = el('td', { clase: 'col-conteo' }); f.celdas[e.codigo] = td; celdas.push(td); });
      f.sin = el('td', { clase: 'col-conteo' });
      celdas.push(f.sin);
      if (!S.compError) {
        var fc = { bien: el('td', { clase: 'col-conteo col-comp' }), mal: el('td', { clase: 'col-conteo col-comp' }), sin: el('td', { clase: 'col-conteo col-comp' }) };
        celdas.push(fc.bien, fc.mal, fc.sin);
        filasComp[m.id] = fc;
      }
      filasEst[m.id] = f;
      return el('tr', null, celdas);
    });

    zonaTabla.appendChild(el('div', { clase: 'libreta-scroll' }, [el('table', { clase: 'tabla-libreta' }, [
      el('thead', null, [el('tr', null, cab)]),
      el('tbody', null, cuerpo)
    ])]));
    S.mats.forEach(function (m) { actualizarFila(m.id); actualizarFilaComp(m.id); });
    ses.forEach(function (s) { actualizarResumen(s.id); actualizarResumenComp(s.id); });
    if (S.compError) { zonaTabla.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: S.compError })); }
    if (S.mats.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este grupo todavía no tiene estudiantes matriculados en el año.' }));
    }
    if (ses.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Aún no hay sesiones en este trimestre. Agregue la primera con el formulario de arriba.' }));
    }
  }

  function dibujarPapelera() {
    var lista = S.sesiones.filter(function (s) { return s.eliminada_en; });
    var sec = el('section', { clase: 'bloque' }, [el('h3', { texto: 'Papelera (' + lista.length + ')' })]);
    if (lista.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'La papelera está vacía.' })); return sec; }
    sec.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Fecha', 'Bloque', 'Descripción', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, lista.map(function (s) {
        return el('tr', null, [el('td', { texto: fechaTexto(s.fecha) }), el('td', { texto: String(s.bloque) }), el('td', { texto: s.descripcion || '(sin descripción)' }),
          el('td', null, [el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Restaurar', onclick: function () { return aPapelera(s, false); } })])]);
      }))
    ])]));
    return sec;
  }

  async function dibujarHistorial(contenedor) {
    contenedor.textContent = '';
    contenedor.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando historial…' }));
    try {
      var h = await consultar(db.from('portal2027_historial_asistencia')
        .select('matricula_id,sesion_id,estado_anterior,estado_nuevo,version,creado_en,sesion:portal2027_sesiones_asistencia!inner(asignacion_id,trimestre_id,fecha,bloque)')
        .eq('sesion.asignacion_id', S.asig.id).eq('sesion.trimestre_id', S.trimestreId)
        .order('creado_en', { ascending: false }).limit(100));
      contenedor.textContent = '';
      if (h.length === 0) { contenedor.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay cambios de asistencia en este trimestre.' })); return; }
      var porMat = {};
      S.mats.forEach(function (m) { porMat[m.id] = m; });
      function etiqueta(c) { var e = c ? estadoPorCodigo(c) : null; return c ? (e ? e.etiqueta : c) : '(sin marcar)'; }
      contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Últimos ' + h.length + ' cambios (máximo 100).' }));
      contenedor.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Cuándo', 'Estudiante', 'Sesión', 'Antes', 'Ahora', 'Versión'].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
        el('tbody', null, h.map(function (x) {
          var m = porMat[x.matricula_id];
          return el('tr', null, [
            el('td', { texto: new Date(x.creado_en).toLocaleString('es-PA') }),
            el('td', { texto: m ? nombreEst(m.estudiante) : '' }),
            el('td', { texto: fechaTexto(x.sesion.fecha) + ' · bloque ' + x.sesion.bloque }),
            el('td', { texto: etiqueta(x.estado_anterior) }), el('td', { texto: etiqueta(x.estado_nuevo) }), el('td', { texto: String(x.version) })
          ]);
        }))
      ])]));
    } catch (e) {
      contenedor.textContent = '';
      contenedor.appendChild(el('p', { clase: 'mensaje error', texto: 'No se pudo cargar el historial. ' + textoError(e) }));
    }
  }

  function dibujar() {
    var previo = contenido.querySelector('.asistencia-cuerpo');
    if (previo) { previo.remove(); }

    var selTrim = el('select', { 'aria-label': 'Trimestre' }, S.trimestres.map(function (t) {
      return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === S.trimestreId });
    }));
    selTrim.addEventListener('change', function () { S.trimestreId = selTrim.value; S.claseSel = null; recargar(); });
    var trimestreActual = S.trimestres.find(function (t) { return t.id === S.trimestreId; });
    var textoPeriodo = trimestreActual && trimestreActual.fecha_inicio && trimestreActual.fecha_fin
      ? 'Trimestre ' + trimestreActual.numero + ' · Comienza: ' + fechaTexto(trimestreActual.fecha_inicio) + ' · Termina: ' + fechaTexto(trimestreActual.fecha_fin)
      : 'Este trimestre todavía no tiene fechas de inicio y finalización configuradas.';
    var avisoPeriodo = el('div', { clase: 'asistencia-periodo-trimestre', role: 'status' }, [
      el('strong', { texto: '📅 Fechas del trimestre' }),
      el('span', { texto: textoPeriodo })
    ]);


    var buscar = el('input', { type: 'search', placeholder: 'Buscar estudiante', value: S.buscar, 'aria-label': 'Buscar estudiante' });
    buscar.addEventListener('input', function () { S.buscar = buscar.value; dibujarTabla(); });

    // Clase de la planificación (filtra las sesiones por sus fechas)
    var cSel = claseSeleccionada();
    var hoyTxt = hoy();
    var selClase = el('select', { 'aria-label': 'Clase' }, [el('option', { value: 'todo', texto: 'Todo el trimestre', selected: !cSel })].concat(S.plan.map(function (c) {
      var act = hoyTxt >= c.fecha_inicio && hoyTxt <= c.fecha_fin;
      return el('option', { value: c.id, selected: !!cSel && cSel.id === c.id,
        texto: (act ? '✓ ' : '') + 'Clase ' + c.numero + ' · ' + c.tema + ' (' + fechaTexto(c.fecha_inicio).slice(0, 5) + ' al ' + fechaTexto(c.fecha_fin).slice(0, 5) + ')' });
    })));
    selClase.addEventListener('change', function () { S.claseSel = selClase.value; dibujar(); });
    var banner = null;
    if (cSel) {
      var esActiva = hoyTxt >= cSel.fecha_inicio && hoyTxt <= cSel.fecha_fin;
      var totalSes = S.sesiones.filter(function (s) { return !s.eliminada_en; }).length;
      banner = el('p', { clase: 'mensaje ok' }, [
        (esActiva ? '✓ ' : '') + 'Clase ' + cSel.numero + ' · ' + cSel.tema + ' · del ' + fechaTexto(cSel.fecha_inicio) + ' al ' + fechaTexto(cSel.fecha_fin) +
          '. Se muestran ' + activas().length + ' de ' + totalSes + ' sesiones y los conteos son solo de esta clase. ',
        el('a', { href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(S.asig.id) + '&trimestre=' + encodeURIComponent(S.trimestreId) + '&semana=' + cSel.numero, texto: 'Apreciación de esta semana' }),
        ' · ',
        el('a', { href: P.raiz + 'pages/portal2027-planificacion.html?asignacion=' + encodeURIComponent(S.asig.id) + '&trimestre=' + encodeURIComponent(S.trimestreId), texto: 'Planificación' })
      ]);
    } else if (S.plan.length) {
      banner = el('p', { clase: 'mensaje info', texto: 'Se muestran todas las sesiones del trimestre. Elija una clase para ver solo su semana.' });
    }

    // Nueva sesión
    var fechaIni = hoyTxt;
    if (cSel && !(hoyTxt >= cSel.fecha_inicio && hoyTxt <= cSel.fecha_fin)) { fechaIni = cSel.fecha_inicio; }
    var inFecha = el('input', { type: 'date', value: fechaIni, min: cSel && cSel.fecha_inicio, max: cSel && cSel.fecha_fin, required: true });
    var inBloque = el('input', { type: 'number', min: '1', max: '12', value: '1', 'aria-label': 'Bloque' });
    var inDesc = el('input', { type: 'text', maxlength: '120', placeholder: 'Descripción (opcional)', value: cSel ? cSel.tema : '' });
    var formNueva = el('form', { clase: 'formulario-fila', novalidate: true }, [
      el('label', null, ['Fecha', inFecha]), el('label', null, ['Bloque', inBloque]), el('label', null, ['Descripción', inDesc]),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Agregar sesión' })
    ]);
    formNueva.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bloque = Number(inBloque.value);
      if (!inFecha.value) { aviso('Elija la fecha de la sesión.', 'error'); return; }
      if (cSel && (inFecha.value < cSel.fecha_inicio || inFecha.value > cSel.fecha_fin)) {
        aviso('La fecha debe estar dentro de la Clase ' + cSel.numero + ' (' + fechaTexto(cSel.fecha_inicio) + ' al ' + fechaTexto(cSel.fecha_fin) + '). Para otras fechas elija «Todo el trimestre».', 'error'); return;
      }
      if (!(bloque >= 1 && bloque <= 12) || Math.floor(bloque) !== bloque) { aviso('El bloque debe ser un número de 1 a 12.', 'error'); return; }
      crearSesionConPresentes({ p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_fecha: inFecha.value, p_bloque: bloque, p_descripcion: inDesc.value });
    });

    // Marcar pendientes
    var abiertas = activas().filter(function (s) { return !s.bloqueada; });
    var selSes = el('select', { 'aria-label': 'Sesión' }, abiertas.map(function (s) {
      return el('option', { value: s.id, texto: fechaTexto(s.fecha) + ' · bloque ' + s.bloque });
    }));
    var selEst = el('select', { 'aria-label': 'Estado' }, S.estados.filter(function (e) { return e.activo; }).map(function (e) {
      return el('option', { value: e.codigo, texto: e.etiqueta });
    }));
    var btnMarcar = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Marcar sin registro', disabled: abiertas.length === 0 || S.estados.length === 0,
      onclick: function () { return marcarPendientes(selSes.value, selEst.value); } });

    var btnBien = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Bien a los sin evaluar', disabled: abiertas.length === 0,
      title: 'Pone «Bien» en el comportamiento de quienes aún no tienen Bien ni Mal en la sesión elegida',
      onclick: async function () {
        var s = sesionPorId(selSes.value);
        if (!s) { aviso('Elija la sesión.', 'error'); return; }
        await confirmarAccionSesion('conducta|' + s.id, 'Marcar comportamiento pendiente',
          'Se pondrá «Bien» a quienes no tienen comportamiento en la sesión del ' + fechaTexto(s.fecha) + '. Los que ya tienen Bien o Mal no cambian. ¿Continuar?', 'Marcar Bien',
          'portal2027_marcar_bien_pendientes', { p_sesion: s.id }, function (n) {
            return n + (n === 1 ? ' estudiante quedó en «Bien».' : ' estudiantes quedaron en «Bien».');
          });
      } });

    var btnHist = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Historial' });
    var btnPap = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Papelera' });
    var btnRec = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recargar', onclick: function () { recargar('Asistencia recargada.'); } });

    zonaTabla = el('div');
    var zonaExtra = el('div');
    btnHist.addEventListener('click', function () { zonaExtra.textContent = ''; var c = el('div'); zonaExtra.appendChild(el('section', { clase: 'bloque' }, [el('h3', { texto: 'Historial de asistencia' }), c])); dibujarHistorial(c); });
    btnPap.addEventListener('click', function () { zonaExtra.textContent = ''; zonaExtra.appendChild(dibujarPapelera()); });

    var leyenda = el('p', { clase: 'leyenda-asis' }, S.estados.filter(function (e) { return e.activo; }).map(function (e) {
      return el('span', null, [el('strong', { texto: e.abreviatura }), ' = ' + e.etiqueta]);
    }));

    leyenda.appendChild(el('span', { clase: 'leyenda-toque', texto: 'Casilla izquierda = asistencia (toque: P → A → T → J → P). Casilla derecha = comportamiento (toque: — → Bien → Mal → —; teclado: B, M, Supr, Enter baja, flechas). Las fechas nuevas empiezan con todos Presente y todos en Bien: solo toque a quien se porte mal.' }));

    var cuerpo = el('div', { clase: 'asistencia-cuerpo secciones' }, [
      el('section', { clase: 'bloque' }, [
        el('h2', { texto: 'Nueva sesión' }),
        el('div', { clase: 'formulario-fila' }, [el('label', null, ['Trimestre', selTrim]), el('label', null, ['Clase', selClase]), el('label', null, ['Estudiante', buscar]), btnHist, btnPap, btnRec]),
        avisoPeriodo,
        banner,
        crearCalendarioAsistencia(inFecha, cSel),
        formNueva
      ]),
      el('section', { clase: 'bloque' }, [
        el('h2', { texto: 'Asistencia y comportamiento' }),
        el('div', { clase: 'formulario-fila' }, [el('label', null, ['Sesión', selSes]), el('label', null, ['Estado', selEst]), btnMarcar, btnBien]),
        el('p', { clase: 'bloque-ayuda', texto: 'Elija el estado en cada casilla; se guarda al instante. Una casilla vacía significa «sin marcar» (no cuenta como ausencia). Las columnas de la derecha solo cuentan sesiones por estado: aún no hay porcentajes ni pesos.' }),
        leyenda,
        zonaTabla
      ]),
      zonaExtra
    ]);
    contenido.appendChild(cuerpo);
    dibujarTabla();
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
    S.info = info;

    var params = new URLSearchParams(window.location.search);
    var asigId = params.get('asignacion');
    S.claseSel = params.get('clase');
    contenido.textContent = '';
    barra = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });

    try {
      S.asig = asigId ? await cargarAsignacion(asigId) : null;
      if (!S.asig) { errorPantalla('No se encontró esta asistencia o no tiene acceso a ella.'); return; }
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero,fecha_inicio,fecha_fin').eq('anio_id', S.asig.salon.anio_id).order('numero'));
      var pedido = params.get('trimestre');
      S.trimestreId = (pedido && S.trimestres.some(function (t) { return t.id === pedido; })) ? pedido : (S.trimestres[0] ? S.trimestres[0].id : null);
      if (!S.trimestreId) { errorPantalla('Este año no tiene trimestres.'); return; }

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Asistencia' }),
          el('h1', { texto: S.asig.materia.nombre + ' · ' + S.asig.salon.nombre }),
          el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + S.asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-planificacion.html?asignacion=' + encodeURIComponent(S.asig.id) + '&trimestre=' + encodeURIComponent(S.trimestreId), texto: 'Planificación' }),
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(S.asig.id), texto: 'Ir a la libreta' }),
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: 'Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(barra);
      await cargarAsistencia();
      dibujar();
    } catch (e) {
      errorPantalla('No se pudo abrir la asistencia. ' + textoError(e));
    }
  }

  iniciar();
})();
