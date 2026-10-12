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
  var filasEst = {};                            // matId -> { celdasFinal(), }

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
    return S.mats.filter(function (m) { return !q || (m.estudiante.codigo + ' ' + nombreEst(m.estudiante)).toLowerCase().indexOf(q) !== -1; });
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

  function agregarColumna(cat) {
    if (S.cerrado) { aviso('El trimestre está cerrado: no se pueden agregar columnas.', 'error'); return; }
    var tipo = '';
    if (cat === 'apreciacion' && window.confirm('¿Crear apreciación SEMANAL? Aceptar = semanal; Cancelar = suelta.')) {
      var siguiente = 1 + Math.max(0, ...S.evals.filter(function(e){return e.categoria==='apreciacion' && e.semana;}).map(function(e){return e.semana;}));
      pedirSemana(siguiente).then(function (f) {
        if (!f) { return; }
        llamar('portal2027_crear_apreciacion_semanal', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_inicio: f.inicio, p_fin: f.fin }, 'Apreciación semanal creada.');
      });
      return;
    }
    if (cat === 'apreciacion') {
      var lista = TIPOS_APRECIACION.map(function (t, i) { return (i + 1) + ' = ' + t; }).join('\n');
      var r = window.prompt('¿De qué se trata esta nota de apreciación? Escriba el número:\n' + lista, '1');
      if (r === null) { return; }
      var idx = parseInt(r, 10);
      if (!(idx >= 1 && idx <= TIPOS_APRECIACION.length)) { aviso('Escriba un número de la lista (1 a ' + TIPOS_APRECIACION.length + ').', 'error'); return; }
      tipo = TIPOS_APRECIACION[idx - 1];
    }
    var pista = cat === 'ejercicio_escrito' ? 'Tema del ejercicio escrito (por ejemplo: Tema 1):' : 'Tema o detalle de la nueva columna de ' + M.ETIQUETAS[cat].toLowerCase() + ' (puede dejarlo vacío):';
    var tema = window.prompt(pista, '');
    if (tema === null) { return; }
    llamar('portal2027_crear_evaluacion', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_categoria: cat, p_tema: tema, p_tipo: tipo }, 'Columna agregada.');
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
  function aPapelera(ev, si) {
    if (si && !window.confirm('¿Enviar esta columna a la papelera? Dejará de contar en el cálculo y podrá restaurarla.')) { return; }
    llamar('portal2027_papelera_evaluacion', { p_id: ev.id, p_version: ev.version, p_a_papelera: si }, si ? 'Columna enviada a la papelera.' : 'Columna restaurada.');
  }

  /* ---------- guardar una nota ---------- */
  async function guardarCelda(ev, mat, input, marca) {
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
      motivo = window.prompt('Esta nota ya estaba escrita (' + previa.valor + '). Motivo del cambio:', '');
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
  }

  /* ---------- dibujo ---------- */
  function visibles() {
    return S.evals.filter(function (e) {
      if (e.eliminada_en) { return false; }
      if (e.oculta && !S.verOcultas) { return false; }
      if (S.filtroCat && e.categoria !== S.filtroCat) { return false; }
      return true;
    });
  }

  function actualizarFila(matId) {
    var f = filasEst[matId];
    if (!f) { return; }
    var r = resultado(matId);
    M.CATEGORIAS.forEach(function (c) { if (f.cat[c]) { f.cat[c].textContent = r.categorias[c].texto || '—'; } });
    f.final.textContent = r.textoFinal;
  }

  function celdaNota(ev, mat) {
    var n = S.notas[clave(ev.id, mat.id)];
    var input = el('input', {
      type: 'text', inputmode: 'decimal', clase: 'nota-input', maxlength: '4',
      value: n && n.valor !== null ? String(n.valor) : '',
      disabled: ev.bloqueada || S.cerrado,
      'aria-label': 'Nota de ' + nombreEst(mat.estudiante) + ' en ' + (ev.tema || M.ETIQUETAS[ev.categoria])
    });
    var td = el('td', { clase: 'celda-nota' }, [input]);
    if (ev.semana && n && n.nota_manual) {
      td.appendChild(el('span', { clase: 'nota-manual-marca', texto: '✎', title: 'Nota semanal corregida manualmente' }));
      var auto = boton('↻ Auto', 'Quitar la corrección manual y recalcular el promedio de los registros de esta semana', async function () {
        if (!window.confirm('¿Restaurar el promedio automático de ' + nombreEst(mat.estudiante) + '? Se quitará la corrección manual.')) { return; }
        auto.disabled = true;
        try {
          var q = await db.rpc('portal2027_restaurar_nota_semanal', {
            p_evaluacion: ev.id, p_matricula: mat.id, p_version: n.version
          });
          if (q.error) { throw q.error; }
          await recargar();
          aviso('Promedio semanal automático restaurado.', 'ok');
        } catch (err) {
          auto.disabled = false;
          aviso('No se pudo restaurar el promedio: ' + textoError(err), 'error');
        }
      });
      auto.type = 'button'; auto.disabled = ev.bloqueada || S.cerrado;
      td.appendChild(auto);
    }
    function marca(tipo) { td.className = 'celda-nota' + (tipo ? ' celda-' + tipo : ''); }
    input.addEventListener('change', function () { guardarCelda(ev, mat, input, marca); });
    input.addEventListener('keydown', function (k) {
      if (k.key === 'Enter') { k.preventDefault(); if (!moverFoco(input, k.shiftKey ? -1 : 1, 0)) { input.blur(); } }
      else if (k.key === 'ArrowDown') { k.preventDefault(); moverFoco(input, 1, 0); }
      else if (k.key === 'ArrowUp') { k.preventDefault(); moverFoco(input, -1, 0); }
      else if (k.key === 'ArrowRight' && input.selectionEnd === input.value.length) { k.preventDefault(); moverFoco(input, 0, 1); }
      else if (k.key === 'ArrowLeft' && input.selectionStart === 0) { k.preventDefault(); moverFoco(input, 0, -1); }
    });
    // Pegar varias filas desde Excel: se abre la carga de notas empezando en este estudiante.
    input.addEventListener('paste', function (k) {
      var txt = (k.clipboardData && k.clipboardData.getData('text')) || '';
      if (/[\r\n\t]/.test(txt.replace(/[\r\n\t]+$/, '')) && S.abrirImport) {
        k.preventDefault();
        S.abrirImport({ texto: txt, evId: ev.id, inicio: Math.max(matsVisibles().indexOf(mat), 0) });
      }
    });
    return td;
  }

  // Identificador para una columna nueva de registros (dos «Tarea» sin descripción son columnas distintas).
  function nuevoGrupoId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') { return window.crypto.randomUUID(); }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  async function abrirDesglose(ev) {
    var ventana = document.createElement('dialog');
    ventana.className = 'portal2027-desglose';
    var bloqueado = S.cerrado || ev.bloqueada;

    var titulo = document.createElement('h3');
    titulo.textContent = 'Desglose · Apreciación ' + ev.semana;
    var cerrar = document.createElement('button');
    cerrar.type = 'button'; cerrar.textContent = 'Cerrar y actualizar libreta';
    cerrar.onclick = function () { ventana.close(); };
    var info = document.createElement('p');
    info.textContent = 'Cada registro tiene una nota de 0 a 5; vacío no cuenta. La nota semanal es su promedio.';
    var contenido = document.createElement('div');
    ventana.append(titulo, cerrar, info, contenido);

    // Se cierre con el botón, con la tecla Esc o de cualquier otra forma: siempre se quita el diálogo y se actualiza la libreta.
    ventana.addEventListener('close', function () { ventana.remove(); recargar(); });
    document.body.appendChild(ventana);
    ventana.showModal();

    async function pintar() {
      contenido.textContent = '';
      try {
        var r = await db.from('portal2027_registros_semana')
          .select('id,evaluacion_id,matricula_id,tipo,descripcion,valor,version,grupo').eq('evaluacion_id', ev.id);
        if (r.error) { throw r.error; }

        // Una columna por grupo (no por tipo + descripción): así dos registros iguales se ven por separado.
        var grupos = [], porGrupo = {};
        (r.data || []).forEach(function (x) {
          if (!porGrupo[x.grupo]) {
            porGrupo[x.grupo] = { grupo: x.grupo, tipo: x.tipo, descripcion: x.descripcion, porMat: {} };
            grupos.push(porGrupo[x.grupo]);
          }
          porGrupo[x.grupo].porMat[x.matricula_id] = x;
        });
        grupos.sort(function (a, b) {
          return a.tipo.localeCompare(b.tipo, 'es') || a.descripcion.localeCompare(b.descripcion, 'es') || (a.grupo < b.grupo ? -1 : 1);
        });

        var botonAgregar = document.createElement('button');
        botonAgregar.type = 'button'; botonAgregar.textContent = '+ Agregar registro'; botonAgregar.disabled = bloqueado;
        botonAgregar.onclick = async function () {
          var tipo = window.prompt('Tipo de registro (ejemplo: Tarea, Laboratorio):', 'Tarea');
          if (tipo === null || tipo.trim() === '') { return; }
          var descripcion = window.prompt('Descripción del registro (puede dejarla vacía):', '') || '';
          tipo = tipo.trim();
          if (tipo.length > 40 || descripcion.length > 120) { window.alert('Texto demasiado largo (tipo: máx. 40; descripción: máx. 120).'); return; }
          botonAgregar.disabled = true;
          var grupoId = nuevoGrupoId();
          // Una sola llamada: la base crea la columna completa (una celda vacía por estudiante) o no crea nada.
          var g = await db.rpc('portal2027_crear_columna_registro_semana', {
            p_evaluacion: ev.id, p_tipo: tipo, p_descripcion: descripcion, p_grupo: grupoId
          });
          if (g.error) { window.alert(P.traducirError(g.error)); }
          pintar();
        };
        contenido.appendChild(botonAgregar);

        if (grupos.length === 0) {
          var vacio = document.createElement('p');
          vacio.textContent = 'Esta semana todavía no tiene registros. Use «+ Agregar registro».';
          contenido.appendChild(vacio);
          return;
        }

        var tabla = document.createElement('table'); tabla.className = 'tabla-datos';
        var thead = document.createElement('thead'), fila = document.createElement('tr');
        var thEst = document.createElement('th'); thEst.textContent = 'Estudiante'; fila.appendChild(thEst);
        grupos.forEach(function (g) {
          var th = document.createElement('th');
          th.textContent = g.tipo + (g.descripcion ? ' · ' + g.descripcion : '');
          fila.appendChild(th);
        });
        thead.appendChild(fila); tabla.appendChild(thead);

        var body = document.createElement('tbody');
        S.mats.forEach(function (mat) {
          var tr = document.createElement('tr'), nom = document.createElement('th');
          nom.textContent = nombreEst(mat.estudiante); tr.appendChild(nom);
          grupos.forEach(function (g) { tr.appendChild(celdaRegistro(g, mat)); });
          body.appendChild(tr);
        });
        tabla.appendChild(body); contenido.appendChild(tabla);
      } catch (e) {
        var p = document.createElement('p'); p.textContent = 'Error al cargar el desglose: ' + textoError(e);
        contenido.appendChild(p);
      }
    }

    // Celda de un estudiante en una columna de registros. Si el estudiante aún no tiene su registro, se crea al escribir la nota.
    function celdaRegistro(g, mat) {
      var td = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.max = '5'; inp.step = '0.01'; inp.className = 'nota-input'; inp.disabled = bloqueado;
      inp.setAttribute('aria-label', 'Nota de ' + nombreEst(mat.estudiante) + ' en ' + g.tipo + (g.descripcion ? ' ' + g.descripcion : ''));
      var reg = g.porMat[mat.id] || null;
      inp.value = reg && reg.valor !== null ? reg.valor : '';
      td.appendChild(inp);

      var borrar = null;
      if (reg) { td.appendChild(botonBorrar()); }

      function botonBorrar() {
        borrar = document.createElement('button');
        borrar.type = 'button'; borrar.textContent = '×'; borrar.title = 'Eliminar este registro'; borrar.disabled = bloqueado;
        borrar.onclick = async function () {
          if (!window.confirm('¿Eliminar este registro de ' + nombreEst(mat.estudiante) + '?')) { return; }
          var q = await db.rpc('portal2027_eliminar_registro_semana', { p_id: reg.id, p_version: reg.version });
          if (q.error) { window.alert(P.traducirError(q.error)); } else { pintar(); }
        };
        return borrar;
      }

      inp.onchange = async function () {
        var texto = inp.value.trim();
        var v = texto === '' ? null : Number(texto.replace(',', '.'));
        var anterior = reg && reg.valor !== null ? reg.valor : '';
        if (v !== null && (!Number.isFinite(v) || v < 0 || v > 5)) {
          window.alert('La nota debe estar entre 0 y 5.'); inp.value = anterior; return;
        }
        if (!reg && v === null) { return; }
        var q = await db.rpc('portal2027_guardar_registro_semana', {
          p_id: reg ? reg.id : null, p_evaluacion: ev.id, p_matricula: mat.id, p_tipo: g.tipo, p_descripcion: g.descripcion,
          p_valor: v, p_version: reg ? reg.version : 0, p_grupo: g.grupo
        });
        if (q.error) { window.alert(P.traducirError(q.error)); inp.value = anterior; return; }
        if (reg) { reg.version = q.data.version; reg.valor = v; }
        else {
          reg = { id: q.data.id, version: q.data.version, valor: v };
          g.porMat[mat.id] = reg;
          td.appendChild(botonBorrar());
        }
      };
      return td;
    }

    pintar();
  }

  function cabeceraColumna(ev) {
    var tema = el('input', { type: 'text', clase: 'tema-input', value: ev.tema || '', placeholder: 'Tema', maxlength: '120', disabled: ev.bloqueada || S.cerrado, 'aria-label': 'Tema de la columna' });
    tema.addEventListener('change', function () { cambiarTema(ev, tema); });
    function boton(texto, titulo, fn) { return el('button', { clase: 'mini', type: 'button', texto: texto, title: titulo, 'aria-label': titulo, disabled: S.cerrado, onclick: fn }); }
    var rotulo = null;
    if (ev.categoria === 'ejercicio_escrito') {
      rotulo = el('div', { clase: 'col-rotulo', texto: 'Ejercicio ' + numeroEscrito(ev) });
    } else if (ev.categoria === 'apreciacion') {
      var opciones = [el('option', { value: '', texto: 'Tipo…' })].concat(TIPOS_APRECIACION.map(function (t) { return el('option', { value: t, texto: t }); }));
      if (ev.tipo && TIPOS_APRECIACION.indexOf(ev.tipo) === -1) { opciones.push(el('option', { value: ev.tipo, texto: ev.tipo })); }
      var sel = el('select', { clase: 'tipo-select', 'aria-label': 'Tipo de nota de apreciación', disabled: ev.bloqueada || S.cerrado }, opciones);
      sel.value = ev.tipo || '';
      sel.addEventListener('change', function () { cambiarTipo(ev, sel); });
      rotulo = ev.semana ? el('div', { clase: 'col-rotulo', texto: 'Apreciación ' + ev.semana }) : sel;
    }
    return el('th', { scope: 'col', clase: 'col-eval' + (ev.oculta ? ' col-oculta' : '') }, [
      rotulo,
      tema,
      el('div', { clase: 'col-acciones' }, [
        ev.semana ? boton('Desglose', 'Ver registros de la semana', function () { abrirDesglose(ev); }) : null,
        boton(ev.bloqueada ? '🔒' : '🔓', ev.bloqueada ? 'Desbloquear columna' : 'Bloquear columna', function () { alternarBloqueo(ev); }),
        boton(ev.oculta ? '👁' : '🙈', ev.oculta ? 'Mostrar columna' : 'Ocultar columna (sigue contando)', function () { alternarOculta(ev); }),
        boton('🗑', 'Enviar a la papelera', function () { aPapelera(ev, true); })
      ])
    ]);
  }

  function dibujarTabla() {
    zonaTabla.textContent = '';
    filasEst = {};
    var cols = visibles();
    var cats = S.filtroCat ? [S.filtroCat] : M.CATEGORIAS;

    // Primera fila: grupos por categoría con botón +. Segunda: columnas.
    var fila1 = [el('th', { scope: 'col', rowspan: '2', clase: 'col-nombre', texto: 'Estudiante' })];
    var fila2 = [];
    cats.forEach(function (c) {
      var delCat = cols.filter(function (e) { return e.categoria === c; });
      var mas = el('button', { clase: 'mini mas', type: 'button', disabled: S.cerrado, texto: '+', title: 'Agregar columna de ' + M.ETIQUETAS[c].toLowerCase(), 'aria-label': 'Agregar columna de ' + M.ETIQUETAS[c].toLowerCase(), onclick: function () { agregarColumna(c); } });
      fila1.push(el('th', { scope: 'colgroup', colspan: String(delCat.length + 1), clase: 'grupo-cat' }, [M.ETIQUETAS[c] + ' ', mas]));
      delCat.forEach(function (e) { fila2.push(cabeceraColumna(e)); });
      fila2.push(el('th', { scope: 'col', clase: 'col-prom', texto: 'Prom.' }));
    });
    fila1.push(el('th', { scope: 'col', rowspan: '2', clase: 'col-final', texto: 'Final' }));

    var mats = matsVisibles();

    var cuerpo = mats.map(function (m) {
      var celdas = [el('th', { scope: 'row', clase: 'col-nombre' }, [nombreEst(m.estudiante), m.estado && m.estado !== 'activo' ? el('small', { texto: ' (' + m.estado + ')' }) : null])];
      var f = { cat: {}, final: null };
      cats.forEach(function (c) {
        cols.filter(function (e) { return e.categoria === c; }).forEach(function (e) { celdas.push(celdaNota(e, m)); });
        var tdP = el('td', { clase: 'col-prom' });
        f.cat[c] = tdP;
        celdas.push(tdP);
      });
      f.final = el('td', { clase: 'col-final' });
      celdas.push(f.final);
      filasEst[m.id] = f;
      return el('tr', null, celdas);
    });

    var tabla = el('table', { clase: 'tabla-libreta' }, [
      el('thead', null, [el('tr', null, fila1), el('tr', null, fila2)]),
      el('tbody', null, cuerpo)
    ]);
    zonaTabla.appendChild(el('div', { clase: 'libreta-scroll' }, [tabla]));
    S.mats.forEach(function (m) { actualizarFila(m.id); });
    if (S.mats.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este grupo todavía no tiene estudiantes matriculados en el año.' }));
    }
    if (cols.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Aún no hay columnas. Use el botón + de cada categoría.' }));
    }
  }

  function dibujarPapelera() {
    var lista = S.evals.filter(function (e) { return e.eliminada_en; });
    var sec = el('section', { clase: 'bloque' }, [el('h3', { texto: 'Papelera (' + lista.length + ')' })]);
    if (lista.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'La papelera está vacía.' })); return sec; }
    sec.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Categoría', 'Tema', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, lista.map(function (e) {
        return el('tr', null, [el('td', { texto: M.ETIQUETAS[e.categoria] }), el('td', { texto: e.tema || '(sin tema)' }),
          el('td', null, [el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', disabled: S.cerrado, texto: 'Restaurar', onclick: function () { aPapelera(e, false); } })])]);
      }))
    ])]));
    return sec;
  }

  /* Recuperar una nota: devuelve la celda al valor que tenía ANTES del cambio elegido.
     Usa portal2027_recuperar_nota (guardado común): la base valida permisos, columna bloqueada o en papelera,
     trimestre cerrado y versión, y deja una fila nueva en el historial (el historial anterior no se toca). */
  function botonRecuperar(x, ev, contenedor) {
    var actual = S.notas[clave(x.evaluacion_id, x.matricula_id)];
    var motivoNoPosible = S.cerrado ? 'El trimestre está cerrado.'
      : (!ev ? 'La columna ya no está disponible.'
        : (ev.eliminada_en ? 'La columna está en la papelera.'
          : (ev.bloqueada ? 'La columna está bloqueada.'
            : (!actual ? 'La nota ya no existe.' : ''))));
    var b = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recuperar', disabled: !!motivoNoPosible,
      title: motivoNoPosible || 'Volver al valor anterior a este cambio' });
    b.addEventListener('click', function () {
      var antes = x.valor_anterior === null ? '(vacía)' : String(Number(x.valor_anterior));
      var motivo = window.prompt('La nota volverá a ' + antes + '. Escriba el motivo de la recuperación:', '');
      if (motivo === null) { return; }
      if (!motivo.trim()) { aviso('No se guardó. Escriba el motivo de la recuperación.', 'error'); return; }
      recuperar(x, actual.version, motivo.trim());
    });
    return b;
  }

  async function recuperar(x, version, motivo) {
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc('portal2027_recuperar_nota', { p_historial: x.id, p_version: version, p_motivo: motivo });
      if (r.error) { throw r.error; }
      await cargarLibreta();
      S.abrirHistorial = true;
      dibujar();
      aviso('Nota recuperada. El cambio quedó anotado en el historial.', 'ok');
    } catch (e) {
      aviso('No se recuperó la nota. ' + textoError(e), 'error');
    }
  }

  async function dibujarHistorial(contenedor) {
    contenedor.textContent = '';
    contenedor.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando historial…' }));
    try {
      var h = await consultar(db.from('portal2027_historial_notas')
        .select('id,matricula_id,evaluacion_id,valor_anterior,valor_nuevo,version,motivo,creado_en,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id)')
        .eq('evaluacion.asignacion_id', S.asig.id).eq('evaluacion.trimestre_id', S.trimestreId)
        .order('creado_en', { ascending: false }).limit(100));
      contenedor.textContent = '';
      if (h.length === 0) { contenedor.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay cambios de notas en este trimestre.' })); return; }
      var porMat = {};
      S.mats.forEach(function (m) { porMat[m.id] = m; });
      contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Últimos ' + h.length + ' cambios (máximo 100).' }));
      contenedor.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Fecha', 'Estudiante', 'Columna', 'Antes', 'Ahora', 'Versión', 'Motivo', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
        el('tbody', null, h.map(function (x) {
          var e = evalPorId(x.evaluacion_id), m = porMat[x.matricula_id];
          return el('tr', null, [
            el('td', { texto: new Date(x.creado_en).toLocaleString('es-PA') }),
            el('td', { texto: m ? nombreEst(m.estudiante) : '' }),
            el('td', { texto: e ? M.ETIQUETAS[e.categoria] + (e.tema ? ': ' + e.tema : '') : '' }),
            el('td', { texto: x.valor_anterior === null ? '—' : String(Number(x.valor_anterior)) }),
            el('td', { texto: x.valor_nuevo === null ? '(vacía)' : String(Number(x.valor_nuevo)) }),
            el('td', { texto: String(x.version) }), el('td', { texto: x.motivo || '' }),
            el('td', null, [botonRecuperar(x, e, contenedor)])
          ]);
        }))
      ])]));
    } catch (e) {
      contenedor.textContent = '';
      contenedor.appendChild(el('p', { clase: 'mensaje error', texto: 'No se pudo cargar el historial. ' + textoError(e) }));
    }
  }

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
    var cbOc = el('input', { type: 'checkbox', checked: S.verOcultas });
    cbOc.addEventListener('change', function () { S.verOcultas = cbOc.checked; dibujarTabla(); });

    var btnHist = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Historial de notas' });
    var btnPap = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Papelera' });
    var btnPub = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: S.publicada ? 'Retirar publicación' : 'Publicar a estudiantes', onclick: function () {
      var txt = S.publicada ? '¿Retirar la publicación? Los estudiantes dejarán de ver las notas de esta materia en este trimestre.'
        : '¿Publicar las notas de este trimestre? Cada estudiante verá solo sus propias notas, y los cambios que haga después también se verán.';
      if (!window.confirm(txt)) { return; }
      llamar('portal2027_publicar_notas', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_publicar: !S.publicada },
        S.publicada ? 'Publicación retirada.' : 'Notas publicadas a los estudiantes.');
    } });
    var btnRec = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recargar', onclick: function () { recargar('Libreta recargada.'); } });

    zonaTabla = el('div');
    var zonaExtra = el('div');
    var zonaCierre = el('div');
    S.abrirImport = function (pre) { abrirImportacion(zonaExtra, pre || {}); };
    var btnImp = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Cargar notas (Excel o pegar)', disabled: S.cerrado, onclick: function () { S.abrirImport({}); } });
    function mostrarHistorial() { zonaExtra.textContent = ''; var c = el('div'); zonaExtra.appendChild(el('section', { clase: 'bloque' }, [el('h3', { texto: 'Historial de notas' }), c])); dibujarHistorial(c); }
    btnHist.addEventListener('click', mostrarHistorial);
    btnPap.addEventListener('click', function () { zonaExtra.textContent = ''; zonaExtra.appendChild(dibujarPapelera()); });

    var cuerpo = el('div', { clase: 'libreta-cuerpo secciones' }, [
      el('section', { clase: 'bloque' }, [
        el('div', { clase: 'formulario-fila' }, [
          el('label', null, ['Trimestre', selTrim]), el('label', null, ['Categoría', selCat]), el('label', null, ['Estudiante', buscar]),
          el('label', { clase: 'etiqueta-check' }, [cbOc, ' Mostrar ocultas (' + ocultas + ')']),
          btnImp, btnHist, btnPap, btnRec, btnPub
        ]),
        el('p', { clase: S.cerrado ? 'mensaje ok' : 'bloque-ayuda', texto: S.cerrado ? 'Trimestre CERRADO: la libreta está en solo lectura (columnas, notas y asistencia bloqueadas por la base).' : 'Trimestre abierto.' }),
        el('p', { clase: 'bloque-ayuda', texto: S.publicada ? 'Estado: notas PUBLICADAS a los estudiantes en este trimestre.' : 'Estado: notas no publicadas (los estudiantes no las ven).' }),
        el('p', { clase: 'bloque-ayuda', texto: 'Escriba la nota y pulse Enter (baja a la casilla de abajo) o use las flechas del teclado para moverse. Puede pegar una columna de Excel. Vacío no es cero. Promedio por categoría con las notas existentes; Final = promedio de las categorías con nota. Las columnas ocultas siguen contando.' }),
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
  function inputDeFila(fila, i) {
    var c = fila && fila.querySelectorAll('td.celda-nota')[i];
    var inp = c && c.querySelector('input');
    return inp && !inp.disabled ? inp : null;
  }
  function celdaVecina(input, df, dc) {
    var td = input.closest('td'), tr = td.parentNode;
    var celdas = Array.prototype.slice.call(tr.querySelectorAll('td.celda-nota'));
    var idx = celdas.indexOf(td);
    if (df) {
      var f = df > 0 ? tr.nextElementSibling : tr.previousElementSibling;
      while (f) {
        var x = inputDeFila(f, idx);
        if (x) { return x; }
        f = df > 0 ? f.nextElementSibling : f.previousElementSibling;
      }
      return null;
    }
    for (var i = idx + dc; i >= 0 && i < celdas.length; i += dc) {
      var y = inputDeFila(tr, i);
      if (y) { return y; }
    }
    return null;
  }
  function moverFoco(input, df, dc) {
    var v = celdaVecina(input, df, dc);
    if (!v) { return false; }
    v.focus(); v.select();   // al salir de la casilla anterior se guarda sola (evento change)
    return true;
  }

  /* ---------- cargar notas desde Excel o pegando ---------- */
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  function cargarXlsx() {
    return new Promise(function (ok, fallo) {
      if (window.XLSX) { ok(window.XLSX); return; }
      var sc = document.createElement('script');
      sc.src = XLSX_URL;
      sc.onload = function () { ok(window.XLSX); };
      sc.onerror = function () { fallo(new Error('No se pudo cargar el lector de Excel. Revise su internet o pegue las notas copiadas de Excel.')); };
      document.head.appendChild(sc);
    });
  }
  function esNum(c) { return (typeof c === 'number' && isFinite(c)) || (typeof c === 'string' && /^\d+([.,]\d+)?$/.test(c.trim())); }
  function aNumero(c) { return typeof c === 'number' ? c : Number(String(c).trim().replace(',', '.')); }
  function tokensNombre(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function claveNombre(s) { return tokensNombre(s).sort().join(' '); }

  // Texto pegado (Excel copia con tabuladores) -> filas de celdas. Las filas vacías conservan su lugar.
  function filasDeTexto(t) {
    var l = String(t).replace(/\r/g, '').split('\n');
    while (l.length && l[l.length - 1].trim() === '') { l.pop(); }
    return l.map(function (x) {
      var z = x.trim();
      if (z === '' || /^\d+([.,]\d+)?$/.test(z)) { return [z]; }
      var d = x.indexOf('\t') !== -1 ? '\t' : (x.indexOf(';') !== -1 ? ';' : null);
      if (d) { return x.split(d).map(function (c) { return c.trim(); }); }
      var m = /^(.*\S)\s+(\d+(?:[.,]\d+)?)$/.exec(z);   // «Diaz Wilton 4.5» sin tabulador
      return m ? [m[1], m[2]] : [z];
    });
  }
  function leerFilas(filas) {
    var f = filas.map(function (cells) {
      var t = [], n = [];
      cells.forEach(function (c) {
        if (c === '' || c === null || c === undefined) { return; }
        if (esNum(c)) { n.push(c); } else { t.push(String(c).trim()); }
      });
      return { texto: t.join(' '), nums: n };
    });
    if (f.length && f[0].nums.length === 0 && /nombre|apellido|estudiante|nota|c[oó]digo|virtual|ejercicio/i.test(f[0].texto)) { f.shift(); }
    while (f.length && !f[f.length - 1].texto && f[f.length - 1].nums.length === 0) { f.pop(); }
    return f;
  }

  function validar(v) {
    if (!isFinite(v) || v < 0 || v > 5) { return 'Debe estar entre 0 y 5'; }
    if (Math.round(v * 100) / 100 !== v) { return 'Máximo 2 decimales'; }
    return '';
  }

  // Arma el plan: a quién va cada nota y qué pasaría. No guarda nada.
  function planificar(filas, ev, inicio) {
    var mats = matsVisibles();
    var porCodigo = {}, porClave = {};
    mats.forEach(function (m) {
      if (m.estudiante.codigo) { porCodigo[String(m.estudiante.codigo).trim()] = m; }
      porClave[claveNombre((m.estudiante.apellidos || '') + ' ' + (m.estudiante.nombres || ''))] = m;
    });
    var porNombres = filas.some(function (r) { return r.texto; }) ||
      filas.some(function (r) { return r.nums.length > 1 && porCodigo[String(r.nums[0]).trim()]; });
    var items = [], usados = {};

    function item(mat, etiqueta, valor, error) {
      var it = { mat: mat, etiqueta: etiqueta, valor: valor, previa: null, estado: '', detalle: '' };
      if (error) { it.estado = error.estado; it.detalle = error.detalle; return it; }
      if (valor === null) { it.estado = 'vacia'; it.detalle = 'Sin nota en el archivo'; return it; }
      var bad = validar(valor);
      if (bad) { it.estado = 'invalida'; it.detalle = bad; return it; }
      if (usados[mat.id]) { it.estado = 'repetido'; it.detalle = 'Este estudiante ya aparece antes'; return it; }
      usados[mat.id] = true;
      var n = S.notas[clave(ev.id, mat.id)];
      it.previa = n && n.valor !== null ? n.valor : null;
      it.estado = it.previa === null ? 'nueva' : (it.previa === valor ? 'igual' : 'cambia');
      return it;
    }

    if (porNombres) {
      filas.forEach(function (r) {
        if (!r.texto && r.nums.length === 0) { return; }
        var mat = null, nums = r.nums.slice(), amb = false;
        for (var i = 0; i < nums.length && !mat; i++) {
          var cm = porCodigo[String(nums[i]).trim()];
          if (cm && (r.texto || nums.length > 1)) { mat = cm; nums.splice(i, 1); }
        }
        if (!mat && r.texto) {
          var k = claveNombre(r.texto);
          mat = porClave[k] || null;
          if (!mat) {
            var tk = tokensNombre(r.texto);
            var cand = mats.filter(function (m) {
              var st = tokensNombre((m.estudiante.apellidos || '') + ' ' + (m.estudiante.nombres || ''));
              return tk.length > 0 && tk.every(function (t) { return st.indexOf(t) !== -1; });
            });
            if (cand.length === 1) { mat = cand[0]; } else if (cand.length > 1) { amb = true; }
          }
        }
        var etiqueta = r.texto || String(r.nums[0]);
        if (!mat) { items.push(item(null, etiqueta, null, { estado: 'noencontrado', detalle: amb ? 'Coincide con varios estudiantes' : 'No se encontró en esta lista' })); return; }
        items.push(item(mat, nombreEst(mat.estudiante), nums.length ? aNumero(nums[nums.length - 1]) : null, null));
      });
    } else {
      filas.forEach(function (r, i) {
        var mat = mats[inicio + i];
        if (!mat) { items.push(item(null, 'Fila ' + (i + 1), null, { estado: 'sobra', detalle: 'No hay más estudiantes en la lista' })); return; }
        items.push(item(mat, nombreEst(mat.estudiante), r.nums.length ? aNumero(r.nums[r.nums.length - 1]) : null, null));
      });
    }
    return { porNombres: porNombres, items: items };
  }

  var TEXTO_ESTADO = { nueva: 'Nueva', cambia: 'Cambia', igual: 'Sin cambio', vacia: 'Vacía', invalida: 'No válida', noencontrado: 'No encontrado', repetido: 'Repetido', sobra: 'Sobra' };

  function abrirImportacion(zona, pre) {
    if (S.cerrado) { aviso('El trimestre está cerrado: no se pueden cargar notas.', 'error'); return; }
    var cols = S.evals.filter(function (e) { return !e.eliminada_en && !e.bloqueada; });
    zona.textContent = '';
    if (cols.length === 0) {
      zona.appendChild(el('section', { clase: 'bloque' }, [el('h3', { texto: 'Cargar notas' }), el('p', { clase: 'vacio-texto', texto: 'Primero cree una columna (botón + de la categoría) y que no esté bloqueada.' })]));
      return;
    }
    function rotuloCol(e) {
      var base = e.categoria === 'ejercicio_escrito' ? 'Ejercicio ' + numeroEscrito(e) : (e.tipo || M.ETIQUETAS[e.categoria]);
      return M.ETIQUETAS[e.categoria] + ' · ' + base + (e.tema ? ' · ' + e.tema : '');
    }
    var selCol = el('select', { 'aria-label': 'Columna destino' }, cols.map(function (e) { return el('option', { value: e.id, texto: rotuloCol(e), selected: e.id === pre.evId }); }));
    var mats = matsVisibles();
    var selIni = el('select', { 'aria-label': 'Empezar en' }, mats.map(function (m, i) { return el('option', { value: String(i), texto: (i + 1) + '. ' + nombreEst(m.estudiante), selected: i === (pre.inicio || 0) }); }));
    var area = el('textarea', { rows: '8', clase: 'importar-texto', 'aria-label': 'Notas copiadas de Excel', placeholder: 'Pegue aquí la columna de notas copiada de Excel.\nO filas con nombre y nota (Apellido Nombre [Tab] Nota).' });
    area.value = pre.texto || '';
    var archivo = el('input', { type: 'file', accept: '.xlsx,.xls,.csv,.tsv,.txt', 'aria-label': 'Archivo de Excel o CSV' });
    var msg = el('p', { clase: 'mensaje', role: 'status', hidden: true });
    var zonaPrev = el('div');
    function mensaje(t, tipo) { msg.textContent = t; msg.className = 'mensaje ' + (tipo || 'info'); msg.hidden = !t; }

    archivo.addEventListener('change', async function () {
      var f = archivo.files && archivo.files[0];
      if (!f) { return; }
      mensaje('Leyendo el archivo…', 'info');
      try {
        var texto;
        if (/\.(tsv|txt)$/i.test(f.name)) { texto = await f.text(); }
        else {
          var X = await cargarXlsx();
          var buf = await f.arrayBuffer();
          var libro = X.read(buf, { type: 'array' });
          var hoja = libro.Sheets[libro.SheetNames[0]];
          var filas = X.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '' });
          texto = filas.map(function (r) { return r.join('\t'); }).join('\n');
        }
        area.value = texto;
        mensaje('Archivo leído (primera hoja). Revise la vista previa y guarde.', 'ok');
        revisar();
      } catch (e) { mensaje('No se pudo leer el archivo. ' + ((e && e.message) || ''), 'error'); }
    });

    function revisar() {
      zonaPrev.textContent = '';
      var ev = evalPorId(selCol.value);
      var filas = leerFilas(filasDeTexto(area.value));
      if (filas.length === 0) { mensaje('No hay notas para revisar. Pegue o suba un archivo.', 'error'); return; }
      var plan = planificar(filas, ev, Number(selIni.value) || 0);
      var cuenta = {};
      plan.items.forEach(function (it) { cuenta[it.estado] = (cuenta[it.estado] || 0) + 1; });
      var aGuardar = plan.items.filter(function (it) { return it.estado === 'nueva' || it.estado === 'cambia'; });
      var problemas = plan.items.filter(function (it) { return ['invalida', 'noencontrado', 'repetido', 'sobra'].indexOf(it.estado) !== -1; }).length;
      mensaje('', 'info');
      zonaPrev.appendChild(el('p', { clase: 'bloque-ayuda', texto: (plan.porNombres ? 'Se buscó a cada estudiante por su nombre o código.' : 'Solo hay números: se asignan en el orden de la lista, desde «Empezar en».') +
        ' Nuevas: ' + (cuenta.nueva || 0) + ' · Cambian: ' + (cuenta.cambia || 0) + ' · Sin cambio: ' + (cuenta.igual || 0) + ' · Con problema: ' + problemas + '.' }));
      zonaPrev.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Estudiante', 'Nota actual', 'Nota nueva', 'Resultado'].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
        el('tbody', null, plan.items.map(function (it) {
          var malo = ['invalida', 'noencontrado', 'repetido', 'sobra'].indexOf(it.estado) !== -1;
          return el('tr', { clase: malo ? 'fila-problema' : (it.estado === 'cambia' ? 'fila-cambia' : '') }, [
            el('td', { texto: it.etiqueta }),
            el('td', { texto: it.previa === null ? '—' : String(it.previa) }),
            el('td', { texto: it.valor === null ? '—' : String(it.valor) }),
            el('td', { texto: TEXTO_ESTADO[it.estado] + (it.detalle ? ': ' + it.detalle : '') })]);
        }))
      ])]));
      var btnGuardar = el('button', { clase: 'boton', type: 'button', disabled: aGuardar.length === 0, texto: 'Guardar ' + aGuardar.length + ' nota(s)' });
      btnGuardar.addEventListener('click', function () { guardarImportacion(aGuardar, ev, btnGuardar, mensaje, function () { zonaPrev.textContent = ''; }); });
      zonaPrev.appendChild(el('div', { clase: 'cabecera-acciones' }, [btnGuardar]));
      if (problemas > 0) { zonaPrev.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Las filas con problema no se guardan; corríjalas en el texto y vuelva a pulsar «Revisar».' })); }
    }

    var btnRev = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Revisar', onclick: revisar });
    var btnCerrar = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar', onclick: function () { zona.textContent = ''; } });
    zona.appendChild(el('section', { clase: 'bloque importar' }, [
      el('h3', { texto: 'Cargar notas desde Excel' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Copie en Excel la columna de notas y péguela aquí, o suba el archivo (.xlsx, .csv). Si solo trae números, se asignan en el orden de esta lista (apellido, nombre). Si trae nombres o códigos, se busca a cada estudiante. Nada se guarda hasta que revise la vista previa.' }),
      el('div', { clase: 'formulario-fila' }, [el('label', null, ['Columna destino', selCol]), el('label', null, ['Empezar en (solo si pega números)', selIni]), el('label', null, ['Archivo de Excel', archivo])]),
      area, msg,
      el('div', { clase: 'cabecera-acciones' }, [btnRev, btnCerrar]),
      zonaPrev
    ]));
    zona.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (area.value) { revisar(); } else { area.focus(); }
  }

  async function guardarImportacion(lista, ev, boton, mensaje, alTerminar) {
    var motivo = null;
    if (lista.some(function (it) { return it.estado === 'cambia'; })) {
      motivo = window.prompt('Algunas notas ya estaban escritas y van a cambiar. Motivo del cambio:', 'Corrección desde Excel');
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
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: 'Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(estado);
      await cargarLibreta();
      dibujar();
    } catch (e) {
      errorPantalla('No se pudo abrir la libreta. ' + textoError(e));
    }
  }

  iniciar();
})();
