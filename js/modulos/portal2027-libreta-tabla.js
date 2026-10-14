/* portal2027-libreta-tabla.js — construcción de la tabla principal.
   Usa los servicios existentes; no define reglas de cálculo ni guardado. */
(function () {
  'use strict';
  var P = window.portal2027;
  function crear(contexto) {
    var S = contexto.estado;
    var M = contexto.evaluacion;
    var el = contexto.el;
    var clave = contexto.clave;
    var nombreEst = contexto.nombreEst;
    var resultado = contexto.resultado;
    var estaVisible = contexto.estaVisible;
    var matsVisibles = contexto.matsVisibles;
    var guardarCelda = contexto.guardarCelda;
    var moverFoco = contexto.moverFoco;
    var cambiarTema = contexto.cambiarTema;
    var cambiarTipo = contexto.cambiarTipo;
    var numeroEscrito = contexto.numeroEscrito;
    var semanaActiva = contexto.semanaActiva;
    var abrirDesglose = contexto.abrirDesglose;
    var alternarBloqueo = contexto.alternarBloqueo;
    var aviso = contexto.aviso;
    var textoPlan = contexto.textoPlan;
    var aPapelera = contexto.aPapelera;
    var agregarColumna = contexto.agregarColumna;
    var iniciarRedimension = contexto.iniciarRedimension;
    var leerAnchos = contexto.leerAnchos;
    var barraGanchosColumnas = contexto.barraGanchosColumnas;
    var TIPOS_APRECIACION = contexto.tiposApreciacion;
    var zonaTabla = null;
    var filasEst = {};

  function visibles() {
    return S.evals.filter(function (e) {
      if (e.eliminada_en) { return false; }
      if (!estaVisible(e)) { return false; }
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
      disabled: ev.bloqueada || S.cerrado || !!ev.semana,
      title: ev.semana ? 'Promedio automático: edite las notas en Desglose' : '',
      'aria-label': 'Nota de ' + nombreEst(mat.estudiante) + ' en ' + (ev.tema || M.ETIQUETAS[ev.categoria])
    });
    var td = el('td', { clase: 'celda-nota' }, [input]);
    // La nota semanal se obtiene exclusivamente de sus registros; no se corrige a mano.
    function marca(tipo) { td.className = 'celda-nota' + (tipo ? ' celda-' + tipo : ''); }
    if (!ev.semana) { input.addEventListener('change', function () { guardarCelda(ev, mat, input, marca); }); }
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
      rotulo = ev.semana ? el('div', { clase: 'col-rotulo', texto: 'Apreciación ' + ev.semana + (semanaActiva(ev) ? ' ✓' : ''), title: semanaActiva(ev) ? 'Semana activa: hoy cae dentro de sus fechas' : null }) : sel;
    }
    return el('th', { scope: 'col', clase: 'col-eval' + (ev.oculta ? ' col-oculta' : '') }, [
      rotulo,
      tema,
      el('div', { clase: 'col-acciones' }, [
        ev.semana ? boton('Desglose', 'Ver registros de la semana', function () { abrirDesglose(ev); }) : null,
        boton(ev.bloqueada ? '🔒' : '🔓', ev.bloqueada ? 'Desbloquear columna' : 'Bloquear columna', function () { alternarBloqueo(ev); }),
        (S.planEv && S.planEv[ev.id])
          ? boton('🔗', 'Ligada a la planificación (Clase ' + S.planEv[ev.id] + '): no se puede eliminar aquí', function () { aviso(textoPlan(ev), 'info'); })
          : boton('🗑', 'Enviar a la papelera', function () { aPapelera(ev, true); })
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
      var accionesCat = [M.ETIQUETAS[c] + ' ', mas];
      if (c === 'apreciacion') { accionesCat.push(el('button', { clase: 'mini', type: 'button', texto: 'Suelta', disabled: S.cerrado, title: 'Agregar apreciación suelta: tarea, laboratorio u otro tipo', onclick: function () { return agregarColumna(c, true); } })); }
      fila1.push(el('th', { scope: 'colgroup', colspan: String(delCat.length + 1), clase: 'grupo-cat' }, accionesCat));
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
    var igualarColumnas = iniciarRedimension(tabla, cols);
    var barraAncho = el('div', { clase: 'libreta-ajuste-barra' });
    barraAncho.appendChild(el('span', { texto: '↔ Ancho de columnas:' }));
    var selectorAncho = el('select', { 'aria-label': 'Ancho para igualar columnas' }, [
      el('option', { value: '90', texto: 'Compacto (90 px)' }),
      el('option', { value: '110', texto: 'Pequeño (110 px)' }),
      el('option', { value: '125', texto: 'Normal (125 px)' }),
      el('option', { value: '150', texto: 'Amplio (150 px)' }),
      el('option', { value: '190', texto: 'Grande (190 px)' })
    ]);
    selectorAncho.value = String(leerAnchos().__uniforme || 125);
    barraAncho.appendChild(selectorAncho);
    barraAncho.appendChild(el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Igualar columnas', onclick: function() { igualarColumnas(selectorAncho.value); } }));
    barraAncho.appendChild(el('small', { texto: 'O arrastre ↔ el borde derecho del encabezado de cada columna, como en Excel.' }));
    zonaTabla.appendChild(barraGanchosColumnas());
    zonaTabla.appendChild(barraAncho);
    zonaTabla.appendChild(el('div', { clase: 'libreta-scroll' }, [tabla]));
    S.mats.forEach(function (m) { actualizarFila(m.id); });
    if (S.mats.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este grupo todavía no tiene estudiantes matriculados en el año.' }));
    }
    if (cols.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Aún no hay columnas. Use el botón + de cada categoría.' }));
    }
  }

    return Object.freeze({
      dibujarTabla: function (zona) { zonaTabla = zona; return dibujarTabla(); },
      actualizarFila: actualizarFila
    });
  }
  P.libretaTabla = Object.freeze({ crear: crear });
})();
