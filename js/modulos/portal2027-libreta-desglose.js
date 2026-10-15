/* portal2027-libreta-desglose.js — registros semanales y ventana de descuentos.
   Bloque extraído sin cambiar sus reglas, RPC, eventos ni cálculos existentes. */
(function () {
  'use strict';
  var P = window.portal2027;
  function crear(contexto) {
    var S = contexto.estado;
    var db = contexto.db;
    var textoError = contexto.textoError;
    var conDialogo = contexto.conDialogo;
    var recargar = contexto.recargar;
    var nombreEst = contexto.nombreEst;
    var clave = contexto.clave;
    var document = contexto.documento;

  // Identificador para una columna nueva de registros (dos «Tarea» sin descripción son columnas distintas).
  function nuevoGrupoId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') { return window.crypto.randomUUID(); }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  // Ventana para cambiar los descuentos de conducta de esta asignación (portal2027_guardar_config_conducta).
  async function abrirDescuentos() {
    var POR_DEFECTO = { base: 5, descuento_mal: 0.5, descuento_ausencia: 0.5, descuento_tardanza: 0.25, bono_bien: 0, minimo: 1 };
    var CAMPOS = [
      ['base', 'Puntaje base (máximo 5)'],
      ['descuento_mal', 'Baja por cada «Mal»'],
      ['descuento_ausencia', 'Baja por cada ausencia'],
      ['descuento_tardanza', 'Baja por cada tardanza'],
      ['bono_bien', 'Sube por cada «Bien» (0 = no sube)'],
      ['minimo', 'Puntaje mínimo']
    ];
    var actual = {};
    Object.keys(POR_DEFECTO).forEach(function (k) { actual[k] = POR_DEFECTO[k]; });
    try {
      var c = await db.from('portal2027_config_conducta_semanal').select('*').eq('asignacion_id', S.asig.id).maybeSingle();
      if (c.error) { throw c.error; }
      if (c.data) { Object.keys(POR_DEFECTO).forEach(function (k) { actual[k] = Number(c.data[k]); }); }
    } catch (e) { P.aviso('No se pudieron cargar los descuentos. ' + textoError(e), 'error'); return; }

    // Cada campo: [clave, título, explicación corta, grupo]
    var GRUPOS = [
      { titulo: 'Lo que baja la nota', campos: [
        ['descuento_mal', 'Cada «Mal»', 'Puntos que se restan por cada registro de conducta «Mal»'],
        ['descuento_ausencia', 'Cada ausencia', 'La ausencia justificada no descuenta'],
        ['descuento_tardanza', 'Cada tardanza', 'Puntos que se restan por llegar tarde']
      ] },
      { titulo: 'Límites y bono', campos: [
        ['base', 'Puntaje base', 'Nota de partida de la semana (máximo 5)'],
        ['minimo', 'Puntaje mínimo', 'La nota semanal nunca baja de este valor'],
        ['bono_bien', 'Cada «Bien»', 'Puntos que suben por cada «Bien» (0 = no sube)']
      ] }
    ];
    function el(tag, clase, texto) { var e = document.createElement(tag); if (clase) { e.className = clase; } if (texto) { e.textContent = texto; } return e; }

    var v = el('dialog', 'portal2027-descuentos');
    v.setAttribute('aria-labelledby', 'desc-titulo');

    var cab = el('header', 'desc-cabecera');
    var h = el('h3', '', 'Descuentos de conducta'); h.id = 'desc-titulo';
    var sub = el('p', '', 'Defina cuántos puntos suma o resta cada registro en la nota semanal de conducta.');
    cab.append(h, sub);

    var cuerpo = el('div', 'desc-cuerpo');
    var cajas = {};
    GRUPOS.forEach(function (g) {
      var sec = el('section', 'desc-grupo');
      sec.appendChild(el('h4', '', g.titulo));
      g.campos.forEach(function (par) {
        var fila = el('label', 'desc-fila');
        var txt = el('span', 'desc-texto');
        txt.append(el('strong', '', par[1]), el('small', '', par[2]));
        var caja = el('span', 'desc-caja');
        var inp = document.createElement('input');
        inp.type = 'text'; inp.setAttribute('inputmode', 'decimal'); inp.setAttribute('autocomplete', 'off'); inp.maxLength = 5;
        inp.value = String(actual[par[0]]);
        caja.append(inp, el('span', 'desc-unidad', 'pts'));
        cajas[par[0]] = inp; fila.append(txt, caja); sec.appendChild(fila);
      });
      cuerpo.appendChild(sec);
    });

    // Vista previa: calcula un caso de ejemplo con los valores escritos.
    var previa = el('div', 'desc-previa');
    previa.setAttribute('aria-live', 'polite');
    function leer(k) { var x = Number(String(cajas[k].value).replace(',', '.')); return (cajas[k].value.trim() === '' || !isFinite(x) || x < 0) ? null : x; }
    function actualizarPrevia() {
      var d = {}, ok = true;
      Object.keys(POR_DEFECTO).forEach(function (k) { d[k] = leer(k); if (d[k] === null) { ok = false; } });
      previa.textContent = '';
      var t = el('span', 'desc-previa-titulo', 'Ejemplo');
      var f = el('span', 'desc-previa-texto');
      if (!ok) { f.textContent = 'Escriba números válidos para ver el ejemplo.'; previa.append(t, f); return; }
      var r = Math.min(d.base, Math.max(d.minimo, d.base - 2 * d.descuento_mal - d.descuento_ausencia - d.descuento_tardanza + d.bono_bien));
      r = Math.round(r * 100) / 100;
      f.textContent = '2 «Mal», 1 ausencia, 1 tardanza y 1 «Bien» dan ';
      f.appendChild(el('b', '', String(r) + ' de ' + d.base));
      previa.append(t, f);
    }
    Object.keys(cajas).forEach(function (k) { cajas[k].addEventListener('input', actualizarPrevia); });
    actualizarPrevia();
    cuerpo.appendChild(previa);
    cuerpo.appendChild(el('p', 'desc-nota', 'Después de guardar, pulse «Traer asistencia y comportamiento» en cada semana para aplicar los cambios.'));

    var pie = el('footer', 'desc-pie');
    var msg = el('p', 'desc-msg'); msg.setAttribute('role', 'alert');
    var botones = el('div', 'desc-botones');
    var restablecer = el('button', 'desc-btn desc-btn-texto', 'Restablecer valores'); restablecer.type = 'button';
    var cancelar = el('button', 'desc-btn desc-btn-sec', 'Cancelar'); cancelar.type = 'button';
    var guardar = el('button', 'desc-btn desc-btn-prin', 'Guardar cambios'); guardar.type = 'button';
    botones.append(restablecer, cancelar, guardar);
    pie.append(msg, botones);
    v.append(cab, cuerpo, pie);

    function aviso(texto, tipo) { msg.textContent = texto; msg.className = 'desc-msg' + (tipo ? ' ' + tipo : ''); }
    restablecer.onclick = function () { Object.keys(POR_DEFECTO).forEach(function (k) { cajas[k].value = String(POR_DEFECTO[k]); }); actualizarPrevia(); aviso('Valores por defecto puestos. Pulse «Guardar cambios» para aplicarlos.', ''); };
    cancelar.onclick = function () { v.close(); };
    guardar.onclick = async function () {
      var n = {}, nombres = {};
      GRUPOS.forEach(function (g) { g.campos.forEach(function (c) { nombres[c[0]] = c[1]; }); });
      var claves = Object.keys(POR_DEFECTO);
      for (var i = 0; i < claves.length; i++) {
        var k = claves[i], x = Number(String(cajas[k].value).replace(',', '.'));
        if (cajas[k].value.trim() === '' || !isFinite(x) || x < 0) { aviso('Revise «' + nombres[k] + '»: escriba un número desde 0.', 'error'); cajas[k].focus(); return; }
        n[k] = x;
      }
      if (n.base <= 0 || n.base > 5) { aviso('El puntaje base debe ser mayor que 0 y no pasar de 5.', 'error'); cajas.base.focus(); return; }
      if (n.minimo > n.base) { aviso('El mínimo no puede ser mayor que la base.', 'error'); cajas.minimo.focus(); return; }
      guardar.disabled = true; aviso('Guardando…', '');
      var r = await db.rpc('portal2027_guardar_config_conducta', {
        p_asignacion: S.asig.id, p_base: n.base, p_mal: n.descuento_mal, p_ausencia: n.descuento_ausencia,
        p_tardanza: n.descuento_tardanza, p_bono: n.bono_bien, p_minimo: n.minimo
      });
      if (r.error) { aviso('No se guardó. ' + P.traducirError(r.error), 'error'); guardar.disabled = false; return; }
      aviso('Descuentos guardados. Pulse «Traer asistencia y comportamiento» en cada semana para aplicarlos.', 'ok');
      guardar.hidden = true; restablecer.hidden = true; cancelar.textContent = 'Cerrar';
    };
    v.addEventListener('close', function () { v.remove(); });
    document.body.appendChild(v);
    v.showModal();
  }

  // Gancho de la semana activa: hoy cae entre el inicio y el fin de la semana (fechas que fija la Planificación).
  function semanaActiva(ev) {
    if (!ev.semana_inicio || !ev.semana_fin) { return false; }
    var d = new Date(), h = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return h >= ev.semana_inicio && h <= ev.semana_fin;
  }

  async function abrirDesglose(ev) {
    var ventana = document.createElement('dialog');
    ventana.className = 'portal2027-desglose';
    var bloqueado = S.cerrado || ev.bloqueada;

    var encabezado = document.createElement('header'); encabezado.className = 'desglose-encabezado';
    var bloqueTitulo = document.createElement('div'); bloqueTitulo.className = 'desglose-titulos';
    var titulo = document.createElement('h3');
    titulo.textContent = 'Desglose · Apreciación ' + ev.semana;
    var info = document.createElement('p'); info.className = 'desglose-info';
    info.textContent = 'Cada registro tiene una nota de 0 a 5; vacío no cuenta. La nota semanal es su promedio.';
    bloqueTitulo.append(titulo, info);
    var acciones = document.createElement('div'); acciones.className = 'desglose-acciones';
    var cerrar = document.createElement('button');
    cerrar.type = 'button'; cerrar.textContent = 'Cerrar y actualizar libreta'; cerrar.className = 'desglose-cerrar';
    cerrar.onclick = function () { ventana.close(); };
    // El botón «+ Agregar registro» se coloca aquí cuando se pinta la tabla.
    var zonaAgregar = document.createElement('div'); zonaAgregar.className = 'desglose-agregar';
    acciones.append(zonaAgregar, cerrar);
    encabezado.append(bloqueTitulo, acciones);
    var contenido = document.createElement('div'); contenido.className = 'desglose-cuerpo';
    ventana.append(encabezado, contenido);

    // Se cierre con el botón, con la tecla Esc o de cualquier otra forma: siempre se quita el diálogo y se actualiza la libreta.
    ventana.addEventListener('close', function () { ventana.remove(); recargar(); });
    document.body.appendChild(ventana);
    ventana.showModal();

    // Seguridad extra: si por cualquier motivo una casilla fuera numérica, la rueda del mouse no debe cambiarle el valor.
    ventana.addEventListener('wheel', function () {
      var a = document.activeElement;
      if (a && a.tagName === 'INPUT' && a.type === 'number') { a.blur(); }
    }, { passive: true });

    // Guardados en orden (uno tras otro) y una sola recarga de la libreta cuando la cola queda vacía.
    var cola = Promise.resolve(), pendientes = 0, celdasPromedio = {};
    function encolar(tarea) {
      pendientes++;
      cola = cola.then(tarea).catch(function () {}).then(function () {
        pendientes--;
        if (pendientes === 0) { return recargar(); }
      });
      return cola;
    }
    function textoPromedio(matId) {
      var n = S.notas[clave(ev.id, matId)];
      return n && n.valor !== null && n.valor !== undefined ? String(n.valor) : '—';
    }
    // Mueve el foco a otra casilla de notas (fila = estudiante, col = registro). Devuelve false si no existe.
    function moverCelda(inp, df, dc) {
      var f = Number(inp.dataset.fila) + df, c = Number(inp.dataset.col) + dc;
      var dest = contenido.querySelector('input[data-fila="' + f + '"][data-col="' + c + '"]');
      if (!dest || dest.disabled) { return false; }
      dest.focus();
      return true;
    }

    async function pintar() {
      contenido.textContent = ''; zonaAgregar.textContent = '';
      try {
        var r = await db.from('portal2027_registros_semana')
          .select('id,evaluacion_id,matricula_id,tipo,descripcion,valor,version,grupo').eq('evaluacion_id', ev.id);
        if (r.error) { throw r.error; }

        // Numeración de tareas vinculadas (Tarea 1, Tarea 2…) por orden de creación; requiere la migración 0056.
        var infoTarea = {};
        var rt = await db.rpc('portal2027_tareas_de_semana', { p_evaluacion: ev.id });
        if (!rt.error) { (rt.data || []).forEach(function (t) { infoTarea[t.grupo] = t; }); }

        // Una columna por grupo (no por tipo + descripción): así dos registros iguales se ven por separado.
        var grupos = [], porGrupo = {};
        (r.data || []).forEach(function (x) {
          if (!porGrupo[x.grupo]) {
            var it = infoTarea[x.grupo];
            porGrupo[x.grupo] = { grupo: x.grupo, tipo: x.tipo, descripcion: x.descripcion, porMat: {},
              numero: it ? it.numero : null, etiqueta: it ? 'Tarea ' + it.numero : null, subtitulo: it ? it.titulo : null };
            grupos.push(porGrupo[x.grupo]);
          }
          porGrupo[x.grupo].porMat[x.matricula_id] = x;
        });
        grupos.sort(function (a, b) {
          if (a.numero !== null || b.numero !== null) {
            if (a.numero === null) { return 1; }
            if (b.numero === null) { return -1; }
            return a.numero - b.numero;
          }
          return a.tipo.localeCompare(b.tipo, 'es') || a.descripcion.localeCompare(b.descripcion, 'es') || (a.grupo < b.grupo ? -1 : 1);
        });

        var botonAgregar = document.createElement('button');
        botonAgregar.type = 'button'; botonAgregar.className = 'desglose-agregar-btn'; botonAgregar.textContent = '+ Agregar registro'; botonAgregar.disabled = bloqueado;
        botonAgregar.onclick = async function () {
          return conDialogo('registro-nuevo|' + ev.id, async function () {
            var tipo = await P.pedirTexto('Agregar registro semanal', 'Tipo de registro (ejemplo: Tarea, Laboratorio):', 'Tarea');
            if (tipo === null || tipo.trim() === '') { return; }
            var descripcion = await P.pedirTexto('Descripción del registro', 'Descripción del registro (puede dejarla vacía):', '');
            if (descripcion === null) { return; }
            tipo = tipo.trim();
            if (tipo.length > 40 || descripcion.length > 120) { P.aviso('Texto demasiado largo (tipo: máx. 40; descripción: máx. 120).', 'error'); return; }
            botonAgregar.disabled = true;
            var grupoId = nuevoGrupoId();
            // Una sola llamada: la base crea la columna completa (una celda vacía por estudiante) o no crea nada.
            var g = await db.rpc('portal2027_crear_columna_registro_semana', {
              p_evaluacion: ev.id, p_tipo: tipo, p_descripcion: descripcion, p_grupo: grupoId
            });
            if (g.error) { P.aviso(P.traducirError(g.error), 'error'); }
            pintar();
          });
        };
        zonaAgregar.appendChild(botonAgregar);

        // Conducta de la semana: suma asistencia y comportamiento entre las fechas de la semana y la agrega como registro «Conducta».
        var botonConducta = document.createElement('button');
        botonConducta.type = 'button'; botonConducta.className = 'desglose-agregar-btn'; botonConducta.textContent = 'Traer asistencia y comportamiento';
        botonConducta.disabled = bloqueado || !ev.semana_inicio || !ev.semana_fin;
        botonConducta.title = (ev.semana_inicio && ev.semana_fin)
          ? 'Calcula la conducta de ' + ev.semana_inicio + ' a ' + ev.semana_fin + ' y la agrega como registro «Conducta». Puede repetirlo cuando cambie la asistencia.'
          : 'Esta semana no tiene fechas de inicio y fin.';
        botonConducta.onclick = async function () {
          botonConducta.disabled = true;
          try {
            var q = await db.rpc('portal2027_aplicar_conducta_semana', { p_evaluacion: ev.id });
            if (q.error) { throw q.error; }
            var d = q.data || {};
            P.aviso('Conducta actualizada. Nuevos: ' + (d.creados || 0) + ' · Cambiados: ' + (d.actualizados || 0) + ' · Sin cambio: ' + (d.sin_cambio || 0) + '.', 'ok');
            await recargar();
          } catch (e) {
            P.aviso(P.traducirError(e), 'error');
          }
          pintar();
        };
        zonaAgregar.appendChild(botonConducta);

        // Descuentos de la conducta (por materia y grupo): cuánto baja cada «Mal», ausencia o tardanza.
        var botonDescuentos = document.createElement('button');
        botonDescuentos.type = 'button'; botonDescuentos.className = 'desglose-agregar-btn'; botonDescuentos.textContent = 'Ajustar descuentos';
        botonDescuentos.title = 'Cuántos puntos baja cada «Mal», ausencia o tardanza en la conducta de la semana';
        botonDescuentos.disabled = S.cerrado;
        botonDescuentos.onclick = function () { abrirDescuentos(); };
        zonaAgregar.appendChild(botonDescuentos);

        if (grupos.length === 0) {
          var vacio = document.createElement('p');
          vacio.className = 'desglose-vacio';
          vacio.textContent = 'Esta semana todavía no tiene registros. Use «+ Agregar registro».';
          contenido.appendChild(vacio);
          return;
        }

        var tabla = document.createElement('table'); tabla.className = 'tabla-desglose';
        var thead = document.createElement('thead'), fila = document.createElement('tr');
        var thEst = document.createElement('th'); thEst.textContent = 'Estudiante'; thEst.className = 'col-est'; fila.appendChild(thEst);
        grupos.forEach(function (g) {
          var th = document.createElement('th'); th.className = 'col-registro';
          var nombreCol = g.etiqueta ? g.etiqueta + ' · ' + g.subtitulo : g.tipo + (g.descripcion ? ' · ' + g.descripcion : '');
          var rotulo = document.createElement('span'); rotulo.className = 'col-registro-titulo';
          rotulo.textContent = g.etiqueta ? g.etiqueta : nombreCol;
          if (g.etiqueta) { rotulo.title = g.subtitulo; }
          var btnCol = document.createElement('button');
          btnCol.type = 'button'; btnCol.className = 'desglose-col-borrar'; btnCol.textContent = 'Eliminar columna';
          btnCol.title = 'Borra esta columna completa (los registros de todos los estudiantes)';
          btnCol.setAttribute('aria-label', 'Eliminar la columna ' + nombreCol);
          btnCol.disabled = bloqueado;
          btnCol.onclick = async function () {
            return conDialogo('borrar-columna|' + ev.id + '|' + g.grupo, async function () {
              var regs = Object.keys(g.porMat).map(function (k) { return g.porMat[k]; }).filter(Boolean);
              if (regs.length === 0) { P.aviso('Esta columna no tiene registros.', 'info'); return; }
              if (!(await P.confirmar('Eliminar columna semanal', '¿Eliminar la columna «' + nombreCol + '» completa?\n\nSe borrarán ' + regs.length + ' registro(s) de todos los estudiantes y el promedio semanal se recalculará.', 'Eliminar columna'))) { return; }
              btnCol.disabled = true; btnCol.textContent = 'Eliminando…';
              await cola; // primero terminan las notas que aún se estén guardando
              var fallos = 0, ultimoError = null;
              for (var i = 0; i < regs.length; i++) {
                var q = await db.rpc('portal2027_eliminar_registro_semana', { p_id: regs[i].id, p_version: regs[i].version });
                if (q.error) { fallos++; ultimoError = q.error; }
              }
              if (fallos > 0) { P.aviso('No se pudieron eliminar ' + fallos + ' de ' + regs.length + ' registros. ' + P.traducirError(ultimoError), 'error'); }
              await recargar(); pintar();
            });
          };
          if (g.etiqueta) {
            var sub = document.createElement('span'); sub.className = 'col-registro-subtitulo'; sub.textContent = g.subtitulo;
            sub.style.display = 'block'; sub.style.fontWeight = 'normal'; sub.style.fontSize = '.8em';
            th.append(rotulo, sub, btnCol);
          } else { th.append(rotulo, btnCol); }
          fila.appendChild(th);
        });
        var thProm = document.createElement('th'); thProm.textContent = 'Promedio semanal'; thProm.className = 'col-prom-sem'; fila.appendChild(thProm);
        thead.appendChild(fila); tabla.appendChild(thead);

        var body = document.createElement('tbody');
        celdasPromedio = {};
        S.mats.forEach(function (mat, i) {
          var tr = document.createElement('tr'), nom = document.createElement('th');
          nom.textContent = nombreEst(mat.estudiante); nom.className = 'col-est'; tr.appendChild(nom);
          grupos.forEach(function (g, j) { tr.appendChild(celdaRegistro(g, mat, i, j)); });
          var tdProm = document.createElement('td'); tdProm.className = 'col-prom-sem';
          tdProm.textContent = textoPromedio(mat.id); celdasPromedio[mat.id] = tdProm; tr.appendChild(tdProm);
          body.appendChild(tr);
        });
        tabla.appendChild(body); contenido.appendChild(tabla);
      } catch (e) {
        var p = document.createElement('p'); p.textContent = 'Error al cargar el desglose: ' + textoError(e);
        contenido.appendChild(p);
      }
    }

    // Celda de un estudiante en una columna de registros. Si el estudiante aún no tiene su registro, se crea al escribir la nota.
    function celdaRegistro(g, mat, fila, col) {
      var td = document.createElement('td');
      var caja = document.createElement('div'); caja.className = 'desglose-celda'; td.appendChild(caja);
      var inp = document.createElement('input');
      // Texto con teclado decimal (no «number»): así la rueda del mouse y las flechas nunca cambian la nota.
      inp.type = 'text'; inp.setAttribute('inputmode', 'decimal'); inp.setAttribute('autocomplete', 'off'); inp.maxLength = 4;
      inp.className = 'nota-input'; inp.disabled = bloqueado || g.tipo === 'Conducta';
      if (g.tipo === 'Conducta') { inp.title = 'Automática: use «Traer asistencia y comportamiento»'; }
      inp.dataset.fila = String(fila); inp.dataset.col = String(col);
      inp.setAttribute('aria-label', 'Nota de ' + nombreEst(mat.estudiante) + ' en ' + (g.etiqueta ? g.etiqueta + ' ' + g.subtitulo : g.tipo + (g.descripcion ? ' ' + g.descripcion : '')));
      var reg = g.porMat[mat.id] || null;
      inp.value = reg && reg.valor !== null ? reg.valor : '';
      caja.appendChild(inp);

      var borrar = null;
      if (reg) { caja.appendChild(botonBorrar()); }

      function botonBorrar() {
        borrar = document.createElement('button');
        borrar.type = 'button'; borrar.className = 'desglose-borrar'; borrar.setAttribute('aria-label', 'Eliminar registro'); borrar.textContent = '×'; borrar.title = 'Eliminar este registro'; borrar.disabled = bloqueado;
        borrar.onclick = async function () {
          return conDialogo('borrar-registro|' + reg.id, async function () {
            if (!(await P.confirmar('Eliminar registro semanal', '¿Eliminar este registro de ' + nombreEst(mat.estudiante) + '?', 'Eliminar registro'))) { return; }
            var q = await db.rpc('portal2027_eliminar_registro_semana', { p_id: reg.id, p_version: reg.version });
            if (q.error) { P.aviso(P.traducirError(q.error), 'error'); } else { await recargar(); pintar(); }
          });
        };
        return borrar;
      }

      function valorActual() { return reg && reg.valor !== null ? reg.valor : null; }
      // Último valor ya enviado al servidor: evita guardar dos veces (Enter + salida de la casilla).
      var enviado = valorActual();

      // Lee y valida lo escrito. Devuelve {ok, v}; si no es válido avisa y devuelve la casilla a su valor anterior.
      function leer() {
        var texto = inp.value.trim();
        var v = texto === '' ? null : Number(texto.replace(',', '.'));
        if (v !== null && (!Number.isFinite(v) || v < 0 || v > 5)) {
          P.aviso('La nota debe estar entre 0 y 5.', 'error');
          var ant = valorActual(); inp.value = ant === null ? '' : ant;
          return { ok: false };
        }
        return { ok: true, v: v };
      }

      function guardar() {
        var l = leer();
        if (!l.ok) { return Promise.resolve(false); }
        var v = l.v;
        // Sin cambios (o casilla vacía de un estudiante sin registro): no hay nada que guardar.
        if (v === enviado || (!reg && v === null)) { return Promise.resolve(true); }
        enviado = v;
        return encolar(async function () {
          var anterior = valorActual();
          td.classList.add('celda-guardando');
          var q = await db.rpc('portal2027_guardar_registro_semana', {
            p_id: reg ? reg.id : null, p_evaluacion: ev.id, p_matricula: mat.id, p_tipo: g.tipo, p_descripcion: g.descripcion,
            p_valor: v, p_version: reg ? reg.version : 0, p_grupo: g.grupo
          });
          td.classList.remove('celda-guardando');
          if (q.error) { P.aviso(P.traducirError(q.error), 'error'); inp.value = anterior === null ? '' : anterior; enviado = anterior; return; }
          if (reg) { reg.version = q.data.version; reg.valor = v; }
          else {
            reg = { id: q.data.id, version: q.data.version, valor: v };
            g.porMat[mat.id] = reg;
            caja.appendChild(botonBorrar());
          }
          // El servidor recalcula la apreciación semanal al guardar: se muestra enseguida, sin pulsar ningún botón.
          var nuevaNota = await db.from('portal2027_notas').select('valor,version,nota_manual').eq('evaluacion_id', ev.id).eq('matricula_id', mat.id).maybeSingle();
          if (!nuevaNota.error) {
            var dato = nuevaNota.data;
            S.notas[clave(ev.id, mat.id)] = dato ? { valor: dato.valor === null ? null : Number(dato.valor), version: dato.version, nota_manual: false } : { valor: null, version: 0, nota_manual: false };
            if (celdasPromedio[mat.id]) { celdasPromedio[mat.id].textContent = textoPromedio(mat.id); }
          }
        });
      }

      // Al salir de la casilla por cualquier medio (clic, Tab) también se guarda.
      inp.addEventListener('change', guardar);
      inp.addEventListener('focus', function () { setTimeout(function () { if (document.activeElement === inp) { inp.select(); } }, 0); });
      inp.addEventListener('keydown', function (k) {
        if (k.key === 'Enter') {
          k.preventDefault();
          var l = leer();
          if (!l.ok) { return; }
          guardar();
          if (!moverCelda(inp, k.shiftKey ? -1 : 1, 0)) { inp.blur(); }
        }
        else if (k.key === 'ArrowDown') { k.preventDefault(); moverCelda(inp, 1, 0); }
        else if (k.key === 'ArrowUp') { k.preventDefault(); moverCelda(inp, -1, 0); }
        else if (k.key === 'ArrowRight' && inp.selectionEnd === inp.value.length) { k.preventDefault(); moverCelda(inp, 0, 1); }
        else if (k.key === 'ArrowLeft' && inp.selectionStart === 0) { k.preventDefault(); moverCelda(inp, 0, -1); }
      });

      // Pegar notas copiadas de Excel: una columna (o varias) hacia abajo desde esta casilla; cada nota se guarda como si se hubiera escrito a mano.
      inp.addEventListener('paste', async function (k) {
        var txt = ((k.clipboardData && k.clipboardData.getData('text')) || '').replace(/[\r\n]+$/, '');
        if (!/[\r\n\t]/.test(txt)) { return; } // una sola nota: se pega normal
        k.preventDefault();
        return conDialogo('pegar|' + ev.id, async function () {
          if (bloqueado) { return; }
          var f0 = Number(inp.dataset.fila), c0 = Number(inp.dataset.col);
          var destinos = [], invalidas = [], sinCasilla = 0;
          txt.split(/\r?\n/).forEach(function (linea, a) {
            linea.split('\t').forEach(function (t, b) {
              t = t.trim();
              if (t === '') { return; } // celda vacía: no se toca
              var v = Number(t.replace(',', '.'));
              var est = S.mats[f0 + a];
              if (!Number.isFinite(v) || v < 0 || v > 5) { invalidas.push('«' + t + '»' + (est ? ' (' + nombreEst(est.estudiante) + ')' : '')); return; }
              var dest = contenido.querySelector('input[data-fila="' + (f0 + a) + '"][data-col="' + (c0 + b) + '"]');
              if (!dest || dest.disabled) { sinCasilla++; return; }
              destinos.push({ dest: dest, v: Math.round(v * 100) / 100, est: est });
            });
          });
          if (invalidas.length > 0) {
            P.aviso('No se pegó nada. Estos valores no son notas de 0 a 5:\n\n' + invalidas.slice(0, 8).join('\n') + (invalidas.length > 8 ? '\n…' : ''), 'error');
            return;
          }
          if (destinos.length === 0) { P.aviso('No hay notas para pegar en esta posición.', 'info'); return; }
          var primero = destinos[0].est, ultimo = destinos[destinos.length - 1].est;
          var msg = 'Se pegarán ' + destinos.length + ' nota(s)' + (primero && ultimo ? ', de ' + nombreEst(primero.estudiante) + ' a ' + nombreEst(ultimo.estudiante) : '') + '.';
          if (sinCasilla > 0) { msg += '\n\n' + sinCasilla + ' valor(es) sobraban (no hay más estudiantes o columnas) y se omitirán.'; }
          if (!(await P.confirmar('Pegar notas desde Excel', msg + '\n\n¿Continuar?', 'Pegar notas'))) { return; }
          destinos.forEach(function (d) {
            d.dest.value = String(d.v);
            d.dest.dispatchEvent(new Event('change')); // usa el mismo guardado de una nota escrita a mano
          });
        });
      });
      return td;
    }

    pintar();
  }

    return Object.freeze({ abrirDescuentos: abrirDescuentos, abrirDesglose: abrirDesglose, semanaActiva: semanaActiva });
  }
  P.libretaDesglose = Object.freeze({ crear: crear });
})();
