/* portal2027-libreta.js — etapa 3, parte B: libreta por año/grupo/materia/trimestre.
   Todos los cálculos salen del motor único (portal2027.evaluacion). Todo cambio se guarda con las
   funciones de la base (permisos, bloqueo, versión e historial); aquí solo se muestra el resultado real. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var M = P.evaluacion;
  var contenido = document.getElementById('contenido');

  var S = {
    info: null, asig: null, trimestres: [], trimestreId: null,
    evals: [], mats: [], notas: {},            // notas: clave evalId|matId -> {valor, version}
    filtroCat: '', verOcultas: false, verPapelera: false, buscar: '', historial: null, publicada: false, cerrado: false, abrirHistorial: false
  };
  var estado = null;
  var zonaTabla = null;

  var dialogosPendientes = new Set();
  async function conDialogo(llave, fn) {
    if (dialogosPendientes.has(llave)) { return; }
    dialogosPendientes.add(llave);
    try { return await fn(); }
    catch (e) { aviso('No se guardó. ' + textoError(e), 'error'); }
    finally { dialogosPendientes.delete(llave); }
  }

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
    estado.textContent = texto;
    estado.className = 'mensaje estado-panel ' + (tipo || 'info');
    estado.hidden = !texto;
  }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^CONFLICTO/.test(m)) { return m.replace(/^CONFLICTO:\s*/, 'Conflicto: ') + ' Pulse «Recargar».'; }
    if (/ya existe|bloqueada|papelera|motivo|entre 0 y 5|No tiene permiso|no pertenece|trimestre está cerrado/i.test(m) && !/duplicate key/i.test(m)) {
      return m.replace(/\s*\(row-level security\)/, '');
    }
    return P.traducirError(e);
  }
  function clave(e, m) { return e + '|' + m; }
  // Apellido y nombre para mostrar y ordenar. Si el estudiante tiene todo en «nombres» (sin apellidos),
  // se toma la última palabra como apellido. Lo correcto es corregirlo en Administración > Estudiantes.
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
  function matsVisibles() {
    var q = S.buscar.trim().toLowerCase();
    return S.mats.filter(function (m) { return !vista.estudianteOculto(m.id) && (!q || (m.estudiante.codigo + ' ' + nombreEst(m.estudiante)).toLowerCase().indexOf(q) !== -1); });
  }
  function evalPorId(id) { return S.evals.filter(function (e) { return e.id === id; })[0]; }
  function trimestreActual() { return S.trimestres.filter(function (t) { return t.id === S.trimestreId; })[0]; }

  function notasDe(matId) {
    var o = {};
    S.evals.forEach(function (e) {
      var n = S.notas[clave(e.id, matId)];
      if (n && n.valor !== null && n.valor !== undefined) { o[e.id] = n.valor; }
    });
    return o;
  }
  function resultado(matId) { return M.calcular(S.evals, notasDe(matId)); }

  /* ---------- carga ---------- */
  async function cargarAsignacion(id) {
    var d = await consultar(db.from('portal2027_asignaciones')
      .select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
      .eq('id', id).maybeSingle());
    return d;
  }

  async function cargarLibreta() {
    var asigId = S.asig.id, trId = S.trimestreId;
    // Sincroniza promedios heredados antes de leer la libreta. No modifica trimestres cerrados.
    {
      var sync = await db.rpc('portal2027_sincronizar_apreciaciones', { p_asignacion: asigId, p_trimestre: trId });
      if (sync.error) { throw sync.error; }
    }
    // Cada clase de la planificación debe tener su columna de apreciación (la restaura o la crea si falta).
    {
      var asg = await db.rpc('portal2027_asegurar_semanas_plan', { p_asignacion: asigId, p_trimestre: trId });
      if (asg.error) { console.warn('No se pudieron asegurar las semanas de la planificación (¿falta ejecutar 0041/0042?):', asg.error.message); }
    }
    var r = await Promise.all([
      todas(function () {
        return db.from('portal2027_evaluaciones')
          .select('id,categoria,tema,tipo,orden,bloqueada,oculta,eliminada_en,version,semana,semana_inicio,semana_fin')
          .eq('asignacion_id', asigId).eq('trimestre_id', trId).order('orden').order('id');
      }),
      todas(function () {
        return db.from('portal2027_matriculas')
          .select('id,estado,estudiante:portal2027_estudiantes(codigo,nombres,apellidos)')
          .eq('salon_id', S.asig.salon.id).eq('anio_id', S.asig.salon.anio_id).order('id');
      }),
      todas(function () {
        return db.from('portal2027_notas')
          .select('evaluacion_id,matricula_id,valor,version,nota_manual,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id)')
          .eq('evaluacion.asignacion_id', asigId).eq('evaluacion.trimestre_id', trId).order('id');
      }),
      consultar(db.from('portal2027_publicaciones').select('publicada').eq('asignacion_id', asigId).eq('trimestre_id', trId).maybeSingle()),
      consultar(db.from('portal2027_cierres').select('cerrado').eq('asignacion_id', asigId).eq('trimestre_id', trId).maybeSingle())
    ]);
    S.publicada = !!(r[3] && r[3].publicada);
    S.cerrado = !!(r[4] && r[4].cerrado);
    S.evals = r[0];
    // Las apreciaciones semanales siempre en orden de semana (1, 2, 3, ...), sin mover las demás columnas.
    {
      var posiciones = [], semanales = [];
      S.evals.forEach(function (e, i) { if (e.categoria === 'apreciacion' && e.semana !== null && e.semana !== undefined) { posiciones.push(i); semanales.push(e); } });
      semanales.sort(function (a, b) { return (a.semana - b.semana) || (a.eliminada_en ? 1 : 0) - (b.eliminada_en ? 1 : 0); });
      posiciones.forEach(function (pos, k) { S.evals[pos] = semanales[k]; });
    }
    // Semanas ligadas a la planificación: sus columnas no se pueden eliminar desde la libreta.
    S.planEv = {};
    try {
      var pl = await todas(function () { return db.from('portal2027_plan_clases').select('evaluacion_id,numero').eq('asignacion_id', asigId).eq('trimestre_id', trId).is('eliminada_en', null).order('id'); });
      pl.forEach(function (p) { if (p.evaluacion_id) { S.planEv[p.evaluacion_id] = p.numero; } });
    } catch (e) { /* si la planificación no está instalada, no hay columnas ligadas */ }
    S.mats = r[1].filter(function (m) { return m.estudiante; }).sort(function (a, b) { return comparaEst(a.estudiante, b.estudiante); });
    S.notas = {};
    r[2].forEach(function (n) { S.notas[clave(n.evaluacion_id, n.matricula_id)] = { valor: n.valor === null ? null : Number(n.valor), version: n.version, nota_manual: !!n.nota_manual }; });
    S.historial = null;
  }

  async function recargar(mensaje) {
    aviso('Cargando libreta…', 'info');
    try {
      await cargarLibreta();
      dibujar();
      aviso(mensaje || '', mensaje ? 'ok' : 'info');
    } catch (e) { aviso('No se pudo cargar la libreta. ' + textoError(e), 'error'); }
  }

  /* ---------- acciones sobre columnas ---------- */
  async function llamar(nombre, args, textoOk) {
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc(nombre, args);
      if (r.error) { throw r.error; }
      await cargarLibreta();
      dibujar();
      aviso(textoOk, 'ok');
    } catch (e) {
      aviso('No se guardó. ' + textoError(e), 'error');
    }
  }

  // De qué se trata cada nota de apreciación (el estudiante lo ve junto a su nota).
  var TIPOS_APRECIACION = ['Ejercicio virtual', 'Laboratorio', 'Participación', 'Trabajo en clase', 'Tarea', 'Otro'];
  // Los ejercicios escritos se numeran solos por orden (Ejercicio 1, Ejercicio 2…); el tema lo escribe el profesor.
  function numeroEscrito(ev) {
    var n = 0;
    for (var i = 0; i < S.evals.length; i++) {
      var e = S.evals[i];
      if (e.eliminada_en || e.categoria !== 'ejercicio_escrito') { continue; }
      n++;
      if (e.id === ev.id) { return n; }
    }
    return n;
  }

  // Ventana con calendarios para elegir el inicio y el final de la semana. Devuelve {inicio, fin} (AAAA-MM-DD) o null si se cancela.
  function pedirSemana(numero) {
    return new Promise(function (resolver) {
      function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
      function sumar(texto, dias) { var p = texto.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + dias); return iso(d); }
      var hoy = new Date(), lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
      var dlg = document.createElement('dialog'); dlg.className = 'portal2027-semana';
      var h = document.createElement('h3'); h.textContent = 'Semana ' + numero;
      function campo(rotulo, valor) {
        var l = document.createElement('label'), i = document.createElement('input');
        i.type = 'date'; i.required = true; i.value = valor;
        l.append(rotulo, i); i.addEventListener('click', function () { if (typeof i.showPicker === 'function') { try { i.showPicker(); } catch (_) {} } }); return { l: l, i: i };
      }
      var a = campo('Comienza el', iso(lunes)), b = campo('Termina el', sumar(iso(lunes), 4));
      b.i.min = a.i.value;
      a.i.addEventListener('change', function () {
        if (!a.i.value) { return; }
        b.i.min = a.i.value;
        if (!b.i.value || b.i.value < a.i.value) { b.i.value = sumar(a.i.value, 4); }
      });
      var msg = document.createElement('p'); msg.className = 'semana-error'; msg.setAttribute('role', 'alert');
      var ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Crear semana';
      var no = document.createElement('button'); no.type = 'button'; no.textContent = 'Cancelar';
      var acciones = document.createElement('div'); acciones.className = 'semana-acciones'; acciones.append(no, ok);
      var resultado = null;
      ok.onclick = function () {
        if (!a.i.value || !b.i.value) { msg.textContent = 'Elija las dos fechas.'; return; }
        if (b.i.value < a.i.value) { msg.textContent = 'La fecha final no puede ser antes de la inicial.'; return; }
        resultado = { inicio: a.i.value, fin: b.i.value }; dlg.close();
      };
      no.onclick = function () { dlg.close(); };
      dlg.addEventListener('close', function () { dlg.remove(); resolver(resultado); });
      dlg.append(h, a.l, b.l, msg, acciones);
      document.body.appendChild(dlg); dlg.showModal(); a.i.focus();
    });
  }

  async function agregarColumna(cat, suelta) {
    return conDialogo('agregar|' + cat, async function () {
      if (S.cerrado) { aviso('El trimestre está cerrado: no se pueden agregar columnas.', 'error'); return; }
      var tipo = '';
      if (cat === 'apreciacion' && !suelta) {
        if (!(await P.confirmar('Crear apreciación semanal', 'Se elegirán las fechas de la semana. Para una apreciación individual use el botón «Suelta».', 'Crear semanal'))) { return; }
        var siguiente = 1 + Math.max(0, ...S.evals.filter(function(e){return e.categoria==='apreciacion' && e.semana;}).map(function(e){return e.semana;}));
        var f = await pedirSemana(siguiente);
        if (!f) { return; }
        await llamar('portal2027_crear_apreciacion_semanal', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_inicio: f.inicio, p_fin: f.fin }, 'Apreciación semanal creada.');
        return;
      }
      if (cat === 'apreciacion') {
        var lista = TIPOS_APRECIACION.map(function (t, i) { return (i + 1) + ' = ' + t; }).join('\n');
        var r = await P.pedirTexto('Tipo de apreciación', 'Escriba el número:\n' + lista, '1');
        if (r === null) { return; }
        var idx = parseInt(r, 10);
        if (!(idx >= 1 && idx <= TIPOS_APRECIACION.length)) { aviso('Escriba un número de la lista (1 a ' + TIPOS_APRECIACION.length + ').', 'error'); return; }
        tipo = TIPOS_APRECIACION[idx - 1];
      }
      var pista = cat === 'ejercicio_escrito' ? 'Tema del ejercicio escrito (por ejemplo: Tema 1):' : 'Tema o detalle de la nueva columna de ' + M.ETIQUETAS[cat].toLowerCase() + ' (puede dejarlo vacío):';
      var tema = await P.pedirTexto('Nueva columna de notas', pista, '');
      if (tema === null) { return; }
      await llamar('portal2027_crear_evaluacion', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_categoria: cat, p_tema: tema, p_tipo: tipo }, 'Columna agregada.');
    });
  }
  function cambiarTipo(ev, select) {
    if (select.value === (ev.tipo || '')) { return; }
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: null, p_oculta: null, p_bloqueada: null, p_tipo: select.value },
      'Tipo guardado.');
  }
  function cambiarTema(ev, input) {
    if (input.value.trim() === (ev.tema || '')) { return; }
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: input.value, p_oculta: null, p_bloqueada: null }, 'Tema guardado.');
  }
  function alternarBloqueo(ev) {
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: null, p_oculta: null, p_bloqueada: !ev.bloqueada },
      ev.bloqueada ? 'Columna desbloqueada.' : 'Columna bloqueada.');
  }
  function alternarOculta(ev) {
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: null, p_oculta: !ev.oculta, p_bloqueada: null },
      ev.oculta ? 'Columna visible otra vez. El cálculo no cambia.' : 'Columna oculta. Sigue contando en el cálculo.');
  }
  function textoPlan(ev) { return 'Esta columna pertenece a la Clase ' + S.planEv[ev.id] + ' de la planificación y no se puede eliminar desde la libreta. Para quitarla, quite la clase en Planificación.'; }
  async function aPapelera(ev, si) {
    return conDialogo('papelera|' + ev.id, async function () {
      if (si && S.planEv && S.planEv[ev.id]) { aviso(textoPlan(ev), 'info'); return; }
      if (si && !(await P.confirmar('Enviar columna a la papelera', '¿Enviar esta columna a la papelera? Dejará de contar en el cálculo y podrá restaurarla.', 'Enviar a la papelera'))) { return; }
      await llamar('portal2027_papelera_evaluacion', { p_id: ev.id, p_version: ev.version, p_a_papelera: si }, si ? 'Columna enviada a la papelera.' : 'Columna restaurada.');
    });
  }

  /* ---------- guardar una nota ---------- */
  async function guardarCelda(ev, mat, input, marca) {
    return conDialogo('nota|' + ev.id + '|' + mat.id, async function () {
      var k = clave(ev.id, mat.id);
      var previa = S.notas[k] || { valor: null, version: 0 };
      var crudo = input.value.trim().replace(',', '.');
      var valor = crudo === '' ? null : Number(crudo);
      if (valor !== null && (!isFinite(valor) || valor < 0 || valor > 5 || Math.round(valor * 100) / 100 !== valor)) {
        aviso('La nota debe ser un número de 0 a 5 (hasta 2 decimales).', 'error');
        input.value = previa.valor === null ? '' : String(previa.valor);
        return;
      }
      if (valor === previa.valor) { return; }
      var motivo = null;
      if (previa.valor !== null) {
        motivo = await P.pedirTexto('Cambiar nota existente', 'Esta nota ya estaba escrita (' + previa.valor + '). Motivo del cambio:', '');
        if (motivo === null || motivo.trim() === '') {
          aviso('No se cambió la nota: falta el motivo.', 'info');
          input.value = String(previa.valor);
          return;
        }
      }
      marca('guardando');
      aviso('Guardando…', 'info');
      try {
        var r = await db.rpc(ev.semana ? 'portal2027_guardar_nota_semanal_manual' : 'portal2027_guardar_nota', {
          p_evaluacion: ev.id, p_matricula: mat.id, p_valor: valor, p_version: previa.version, p_motivo: motivo || (ev.semana ? 'Corrección manual de la semana' : null)
        });
        if (r.error) { throw r.error; }
        var d = r.data;
        S.notas[k] = { valor: d.valor === null ? null : Number(d.valor), version: d.version, nota_manual: !!ev.semana };
        S.historial = null;
        marca('ok');
        actualizarFila(mat.id);
        aviso('Nota guardada.', 'ok');
      } catch (e) {
        marca('error');
        aviso('NO se guardó la nota de ' + nombreEst(mat.estudiante) + '. ' + textoError(e), 'error');
      }
    });
  }

  /* ---------- dibujo ---------- */
  // Estado visual privado del módulo, con referencias al grupo/trimestre actual.
  var vista = P.libretaVista.crear({
    estado: S, evaluacion: M, el: el, nombreEst: nombreEst,
    dibujarTabla: dibujarTabla, documento: document,
    almacenamiento: {
      getItem: function (k) { return localStorage.getItem(k); },
      setItem: function (k, v) { return localStorage.setItem(k, v); }
    }
  });
  var leerVista = vista.leerVista;
  var estaVisible = vista.estaVisible;
  var panelColumnas = vista.panelColumnas;
  var barraGanchosColumnas = vista.barraGanchosColumnas;
  var leerAnchos = vista.leerAnchos;
  var iniciarRedimension = vista.iniciarRedimension;

  var desglose = P.libretaDesglose.crear({
    estado: S, db: db, textoError: textoError, conDialogo: conDialogo,
    recargar: recargar, nombreEst: nombreEst, clave: clave, documento: document
  });
  var abrirDescuentos = desglose.abrirDescuentos;
  var abrirDesglose = desglose.abrirDesglose;
  var semanaActiva = desglose.semanaActiva;

  var tablaLibreta = P.libretaTabla.crear({
    estado: S, evaluacion: M, el: el, clave: clave, nombreEst: nombreEst,
    resultado: resultado, estaVisible: estaVisible, matsVisibles: matsVisibles,
    guardarCelda: guardarCelda, moverFoco: P.libretaTeclado.moverFoco,
    cambiarTema: cambiarTema, cambiarTipo: cambiarTipo, numeroEscrito: numeroEscrito,
    semanaActiva: semanaActiva, abrirDesglose: abrirDesglose, alternarBloqueo: alternarBloqueo,
    aviso: aviso, textoPlan: textoPlan, aPapelera: aPapelera, agregarColumna: agregarColumna,
    iniciarRedimension: iniciarRedimension, leerAnchos: leerAnchos,
    barraGanchosColumnas: barraGanchosColumnas, tiposApreciacion: TIPOS_APRECIACION
  });
  function dibujarTabla() { return tablaLibreta.dibujarTabla(zonaTabla); }
  function actualizarFila(matId) { return tablaLibreta.actualizarFila(matId); }

  var historial = P.libretaHistorial.crear({
    estado: S, evaluacion: M, el: el, db: db, clave: clave,
    aPapelera: aPapelera, conDialogo: conDialogo, aviso: aviso,
    cargarLibreta: cargarLibreta, dibujar: dibujar, textoError: textoError,
    consultar: consultar, evalPorId: evalPorId, nombreEst: nombreEst
  });
  var dibujarPapelera = historial.dibujarPapelera;
  var dibujarHistorial = historial.dibujarHistorial;

  function dibujar() {
    var previo = contenido.querySelector('.libreta-cuerpo');
    if (previo) { previo.remove(); }
    var tr = trimestreActual();

    var selTrim = el('select', { 'aria-label': 'Trimestre' }, S.trimestres.map(function (t) {
      return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === S.trimestreId });
    }));
    selTrim.addEventListener('change', function () { S.trimestreId = selTrim.value; recargar(); });

    var selCat = el('select', { 'aria-label': 'Filtrar por categoría' }, [el('option', { value: '', texto: 'Todas las categorías' })]
      .concat(M.CATEGORIAS.map(function (c) { return el('option', { value: c, texto: M.ETIQUETAS[c], selected: S.filtroCat === c }); })));
    selCat.addEventListener('change', function () { S.filtroCat = selCat.value; dibujarTabla(); });

    var buscar = el('input', { type: 'search', placeholder: 'Buscar estudiante', value: S.buscar, 'aria-label': 'Buscar estudiante' });
    buscar.addEventListener('input', function () { S.buscar = buscar.value; dibujarTabla(); });

    var ocultas = S.evals.filter(function (e) { return e.oculta && !e.eliminada_en; }).length;
    leerVista();
    var cbOc = el('input', { type: 'checkbox', checked: S.verOcultas });
    cbOc.addEventListener('change', function () { S.verOcultas = cbOc.checked; dibujarTabla(); });

    var btnHist = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Historial de notas' });
    var btnPap = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Papelera' });
    var btnPub = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: S.publicada ? 'Retirar publicación' : 'Publicar a estudiantes', onclick: async function () {
      return conDialogo('publicar|' + S.asig.id + '|' + S.trimestreId, async function () {
        var txt = S.publicada ? '¿Retirar la publicación? Los estudiantes dejarán de ver las notas de esta materia en este trimestre.'
          : '¿Publicar las notas de este trimestre? Cada estudiante verá solo sus propias notas, y los cambios que haga después también se verán.';
        if (!(await P.confirmar('Publicación de notas', txt, S.publicada ? 'Retirar publicación' : 'Publicar notas'))) { return; }
        await llamar('portal2027_publicar_notas', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_publicar: !S.publicada },
          S.publicada ? 'Publicación retirada.' : 'Notas publicadas a los estudiantes.');
      });
    } });
    var btnRec = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recargar', onclick: function () { recargar('Libreta recargada.'); } });

    zonaTabla = el('div', { clase: 'libreta-tabla-zona' });
    var zonaExtra = el('div');
    var zonaCierre = el('div');
    S.abrirImport = function (pre) { abrirImportacion(zonaExtra, pre || {}); };
    var btnImp = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Cargar notas (Excel o pegar)', disabled: S.cerrado, onclick: function () { S.abrirImport({}); } });
    function mostrarHistorial() { zonaExtra.textContent = ''; var c = el('div'); zonaExtra.appendChild(el('section', { clase: 'bloque' }, [el('h3', { texto: 'Historial de notas' }), c])); dibujarHistorial(c); }
    btnHist.addEventListener('click', mostrarHistorial);
    btnPap.addEventListener('click', function () { zonaExtra.textContent = ''; zonaExtra.appendChild(dibujarPapelera()); });

    var panelVista = panelColumnas();
    panelVista.elemento.hidden = true;
    var btnVista = el('button', { type: 'button', clase: 'boton boton-secundario boton-chico', texto: '☑ Estudiantes', onclick: function() { panelVista.elemento.hidden = !panelVista.elemento.hidden; if (!panelVista.elemento.hidden) { panelVista.actualizar(); } } });
    var cuerpo = el('div', { clase: 'libreta-cuerpo secciones' }, [
      el('section', { clase: 'bloque' }, [
        el('div', { clase: 'formulario-fila' }, [
          el('label', null, ['Trimestre', selTrim]), el('label', null, ['Categoría', selCat]), el('label', null, ['Estudiante', buscar]),
          btnVista,
          btnImp, btnHist, btnPap, btnRec, btnPub
        ]),
        el('p', { clase: S.cerrado ? 'mensaje ok' : 'bloque-ayuda', texto: S.cerrado ? 'Trimestre CERRADO: la libreta está en solo lectura (columnas, notas y asistencia bloqueadas por la base).' : 'Trimestre abierto.' }),
        el('p', { clase: 'bloque-ayuda', texto: S.publicada ? 'Estado: notas PUBLICADAS a los estudiantes en este trimestre.' : 'Estado: notas no publicadas (los estudiantes no las ven).' }),
        el('p', { clase: 'bloque-ayuda', texto: 'Escriba la nota y pulse Enter (baja a la casilla de abajo) o use las flechas del teclado para moverse. Puede pegar una columna de Excel. Vacío no es cero. Promedio por categoría con las notas existentes; Final = promedio de las categorías con nota. Las columnas ocultas siguen contando.' }),
        panelVista.elemento,
        zonaTabla
      ]),
      zonaExtra,
      zonaCierre
    ]);
    contenido.appendChild(cuerpo);
    P.cierre.dibujar(zonaCierre, {
      asignacionId: S.asig.id, trimestreId: S.trimestreId, trimestreNumero: tr ? tr.numero : '', cerrado: S.cerrado,
      esAdmin: S.info.roles.indexOf('administrador') !== -1, alCambiar: function (m, tipo) { recargar(m); }
    });
    dibujarTabla();
    if (S.abrirHistorial) { S.abrirHistorial = false; mostrarHistorial(); }
    if (!tr) { aviso('Este año no tiene trimestres.', 'error'); }
  }

  /* ---------- moverse entre casillas con el teclado ---------- */
  var moverFoco = P.libretaTeclado.moverFoco;

  /* ---------- cargar notas desde Excel o pegando ---------- */
  // El módulo de importación recibe los mismos servicios y el estado actual.
  var abrirImportacion = P.libretaImportacion.crearInterfaz({
    estado: S, evaluacion: M, el: el, aviso: aviso,
    numeroEscrito: numeroEscrito, matsVisibles: matsVisibles, nombreEst: nombreEst,
    clave: clave, cargarExcel: P.cargarExcel, evalPorId: evalPorId,
    guardarImportacion: guardarImportacion
  });

  async function guardarImportacion(lista, ev, boton, mensaje, alTerminar) {
    return conDialogo('importar|' + ev.id, async function () {
      var motivo = null;
      if (lista.some(function (it) { return it.estado === 'cambia'; })) {
        motivo = await P.pedirTexto('Importar cambios de notas', 'Algunas notas ya estaban escritas y van a cambiar. Motivo del cambio:', 'Corrección desde Excel');
        if (motivo === null || motivo.trim() === '') { mensaje('No se guardó: falta el motivo del cambio.', 'info'); return; }
      }
      boton.disabled = true;
      var ok = 0, fallas = [];
      for (var i = 0; i < lista.length; i++) {
        var it = lista[i], k = clave(ev.id, it.mat.id);
        var previa = S.notas[k] || { valor: null, version: 0 };
        mensaje('Guardando ' + (i + 1) + ' de ' + lista.length + '…', 'info');
        try {
          var r = await db.rpc('portal2027_guardar_nota', {
            p_evaluacion: ev.id, p_matricula: it.mat.id, p_valor: it.valor, p_version: previa.version, p_motivo: previa.valor !== null ? motivo : null
          });
          if (r.error) { throw r.error; }
          S.notas[k] = { valor: r.data.valor === null ? null : Number(r.data.valor), version: r.data.version };
          ok++;
        } catch (e) { fallas.push(it.etiqueta + ' (' + textoError(e) + ')'); }
      }
      S.historial = null;
      dibujarTabla();
      alTerminar();
      if (fallas.length === 0) { mensaje('Se guardaron ' + ok + ' nota(s).', 'ok'); }
      else { mensaje('Se guardaron ' + ok + ' nota(s). NO se guardaron ' + fallas.length + ': ' + fallas.join('; ') + '.', 'error'); }
    });
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
    contenido.textContent = '';
    estado = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });

    try {
      S.asig = asigId ? await cargarAsignacion(asigId) : null;
      if (!S.asig) { errorPantalla('No se encontró esta libreta o no tiene acceso a ella.'); return; }
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', S.asig.salon.anio_id).order('numero'));
      S.trimestreId = (params.get('trimestre') && S.trimestres.some(function (t) { return t.id === params.get('trimestre'); }))
        ? params.get('trimestre') : (S.trimestres[0] ? S.trimestres[0].id : null);
      if (!S.trimestreId) { errorPantalla('Este año no tiene trimestres.'); return; }

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Libreta' }),
          el('h1', { texto: S.asig.materia.nombre + ' · ' + S.asig.salon.nombre }),
          el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + S.asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-planificacion.html?asignacion=' + encodeURIComponent(S.asig.id) + '&trimestre=' + encodeURIComponent(S.trimestreId), texto: 'Planificación' }),
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: 'Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(estado);
      await cargarLibreta();
      dibujar();
      // Desde la Planificación: abre directamente el desglose de la semana pedida.
      var semPedida = Number(params.get('semana'));
      if (semPedida) {
        var evSem = S.evals.filter(function (e) { return e.categoria === 'apreciacion' && e.semana === semPedida && !e.eliminada_en; })[0];
        if (evSem) { abrirDesglose(evSem); }
        else { aviso('La apreciación de la Clase ' + semPedida + ' no está en esta libreta.', 'error'); }
      }
    } catch (e) {
      errorPantalla('No se pudo abrir la libreta. ' + textoError(e));
    }
  }

  iniciar();
})();
