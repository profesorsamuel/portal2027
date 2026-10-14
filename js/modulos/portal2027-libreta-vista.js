/* portal2027-libreta-vista.js — preferencias visuales y anchos locales.
   No modifica notas ni columnas en Supabase. Cargar antes de la libreta. */
(function () {
  'use strict';
  var P = window.portal2027;
  function crear(contexto) {
    var S = contexto.estado;
    var M = contexto.evaluacion;
    var el = contexto.el;
    var nombreEst = contexto.nombreEst;
    var dibujarTabla = contexto.dibujarTabla;
    var document = contexto.documento;
    var localStorage = contexto.almacenamiento;

  // Preferencias visuales locales: nunca modifican notas ni columnas en Supabase.
  var vistaOcultas = {};
  var vistaEstOcultos = {};
  function claveVista() { return 'portal2027-vista-columnas-' + (S.asig ? S.asig.id : '') + '-' + S.trimestreId; }
  function leerVista() {
    try { vistaOcultas = JSON.parse(localStorage.getItem(claveVista()) || '{}') || {}; } catch (_) { vistaOcultas = {}; }
    try { vistaEstOcultos = JSON.parse(localStorage.getItem(claveVista() + '-estudiantes') || '{}') || {}; } catch (_) { vistaEstOcultos = {}; }
  }
  function guardarVista() {
    try { localStorage.setItem(claveVista(), JSON.stringify(vistaOcultas)); localStorage.setItem(claveVista() + '-estudiantes', JSON.stringify(vistaEstOcultos)); } catch (_) {}
  }
  function estaVisible(e) { return !vistaOcultas[e.id] && (!e.oculta || S.verOcultas); }
  function ponerVista(e, visible) { vistaOcultas[e.id] = !visible; guardarVista(); dibujarTabla(); }
  function vistaRapida(modo) {
    S.evals.filter(function(e) { return !e.eliminada_en; }).forEach(function(e) { vistaOcultas[e.id] = modo === 'ninguna'; });
    if (modo === 'todas') { S.verOcultas = true; }
    guardarVista(); dibujarTabla();
  }
  function botonVista(texto, titulo, fn) {
    return el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: texto, title: titulo, onclick: fn });
  }
  function panelColumnas() {
    var box = el('div', { clase: 'libreta-panel-columnas' });
    box.appendChild(el('div', { clase: 'libreta-panel-barra' }, [
      el('strong', { texto: 'Seleccionar estudiantes visibles' }),
      botonVista('Cerrar', 'Cerrar selección de estudiantes', function() { box.hidden = true; })
    ]));
    var listaEst = el('div', { clase: 'libreta-panel-estudiantes' });
    box.appendChild(listaEst);
    function actualizarEstudiantes() {
      listaEst.textContent = '';
      var barraEst = el('div', { clase: 'libreta-panel-barra' }, [
        el('strong', { texto: '✓ = visible · Sin gancho = oculto' }),
        botonVista('✓ Todos', 'Mostrar todos los estudiantes', function() { vistaEstOcultos = {}; guardarVista(); dibujarTabla(); actualizarEstudiantes(); }),
        botonVista('Ninguno', 'Ocultar todos los estudiantes de esta vista', function() { S.mats.forEach(function(m) { vistaEstOcultos[m.id] = true; }); guardarVista(); dibujarTabla(); actualizarEstudiantes(); })
      ]);
      listaEst.appendChild(barraEst);
      var buscarEst = el('input', { type: 'search', placeholder: 'Buscar nombre para seleccionar...', 'aria-label': 'Buscar estudiante en la lista' });
      listaEst.appendChild(buscarEst);
      var rejilla = el('div', { clase: 'libreta-estudiantes-rejilla' }); listaEst.appendChild(rejilla);
      function pintar() {
        rejilla.textContent = '';
        var q = buscarEst.value.toLowerCase().trim();
        S.mats.filter(function(m) { return nombreEst(m.estudiante).toLowerCase().includes(q); }).forEach(function(m) {
          var check = el('input', { type: 'checkbox', checked: !vistaEstOcultos[m.id] });
          check.addEventListener('change', function() { vistaEstOcultos[m.id] = !check.checked; guardarVista(); dibujarTabla(); });
          rejilla.appendChild(el('label', { clase: 'libreta-col-opcion' }, [check, el('span', { texto: nombreEst(m.estudiante) })]));
        });
      }
      buscarEst.addEventListener('input', pintar); pintar();
    }
    actualizarEstudiantes();
    return { elemento: box, actualizar: actualizarEstudiantes };
  }

  // Casillas compactas sobre la tabla: incluso las ocultas permanecen accesibles.
  function barraGanchosColumnas() {
    var barra = el('div', { clase: 'libreta-ganchos-barra' });
    barra.appendChild(el('span', { clase: 'libreta-ganchos-titulo', texto: '✓ Mostrar columnas:' }));
    (S.filtroCat ? [S.filtroCat] : M.CATEGORIAS).forEach(function(c) {
      var evals = S.evals.filter(function(e) { return !e.eliminada_en && e.categoria === c; });
      if (!evals.length) { return; }
      var grupo = el('div', { clase: 'libreta-ganchos-grupo' });
      grupo.appendChild(el('strong', { texto: M.ETIQUETAS[c] + ':' }));
      evals.forEach(function(e, i) {
        var visible = estaVisible(e);
        var nombre = c === 'apreciacion' ? 'A' + (e.semana || i + 1) : c === 'ejercicio_escrito' ? 'E' + (i + 1) : 'Ex' + (i + 1);
        var check = el('input', { type: 'checkbox', checked: visible, 'aria-label': 'Mostrar columna ' + nombre });
        check.addEventListener('change', function() {
          if (check.checked && e.oculta) { S.verOcultas = true; }
          ponerVista(e, check.checked);
        });
        grupo.appendChild(el('label', { clase: 'libreta-gancho' + (visible ? ' activo' : ''), title: (e.tema || nombre) + (visible ? ' · Visible' : ' · Oculta') }, [check, el('span', { texto: nombre })]));
      });
      barra.appendChild(grupo);
    });
    return barra;
  }

  // Anchos independientes por columna; solo se almacenan en este navegador.
  function claveAnchos() { return 'portal2027-anchos-' + (S.asig ? S.asig.id : '') + '-' + S.trimestreId; }
  function leerAnchos() {
    try { return JSON.parse(localStorage.getItem(claveAnchos()) || '{}') || {}; } catch (_) { return {}; }
  }
  function iniciarRedimension(tabla, columnas) {
    var anchos = leerAnchos();
    var predeterminado = Math.max(82, Math.min(350, Number(anchos.__uniforme) || 125));
    var colgroup = document.createElement('colgroup');
    var colNombre = document.createElement('col');
    colNombre.style.width = '185px'; colgroup.appendChild(colNombre);
    var definiciones = [];
    var categorias = S.filtroCat ? [S.filtroCat] : M.CATEGORIAS;
    categorias.forEach(function(cat) {
      columnas.filter(function(ev) { return ev.categoria === cat; }).forEach(function(ev) {
        var id = String(ev.id);
        var col = document.createElement('col');
        var ancho = Math.max(82, Math.min(420, Number(anchos[id]) || predeterminado));
        col.style.width = ancho + 'px';
        colgroup.appendChild(col);
        definiciones.push({ id: id, col: col, ancho: ancho });
      });
      var promedio = document.createElement('col'); promedio.style.width = '80px'; colgroup.appendChild(promedio);
    });
    var finalCol = document.createElement('col'); finalCol.style.width = '80px'; colgroup.appendChild(finalCol);
    tabla.insertBefore(colgroup, tabla.firstChild);
    function aplicar(def, ancho) {
      def.ancho = Math.max(82, Math.min(420, Math.round(ancho)));
      def.col.style.width = def.ancho + 'px';
    }
    var encabezados = Array.from(tabla.querySelectorAll('thead tr:nth-child(2) th.col-eval'));
    encabezados.forEach(function(th, i) {
      var def = definiciones[i]; if (!def) { return; }
      var agarrador = document.createElement('span');
      agarrador.className = 'libreta-col-resize';
      agarrador.title = 'Arrastre a izquierda o derecha para ajustar esta columna';
      agarrador.setAttribute('role', 'separator');
      agarrador.setAttribute('aria-label', 'Cambiar ancho de esta columna');
      th.appendChild(agarrador);
      agarrador.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) { return; }
        e.preventDefault(); e.stopPropagation();
        var inicio = e.clientX, inicial = def.ancho;
        document.body.classList.add('libreta-redimensionando');
        if (agarrador.setPointerCapture) { try { agarrador.setPointerCapture(e.pointerId); } catch (_) {} }
        function mover(evt) { aplicar(def, inicial + evt.clientX - inicio); }
        function terminar(evt) {
          if (evt.type === 'pointerup') { mover(evt); }
          agarrador.removeEventListener('pointermove', mover);
          agarrador.removeEventListener('pointerup', terminar);
          agarrador.removeEventListener('pointercancel', terminar);
          document.body.classList.remove('libreta-redimensionando');
          anchos[def.id] = def.ancho;
          try { localStorage.setItem(claveAnchos(), JSON.stringify(anchos)); } catch (_) {}
        }
        agarrador.addEventListener('pointermove', mover);
        agarrador.addEventListener('pointerup', terminar);
        agarrador.addEventListener('pointercancel', terminar);
      });
    });
    return function igualar(ancho) {
      var valor = Math.max(82, Math.min(350, Number(ancho) || predeterminado));
      definiciones.forEach(function(def) { aplicar(def, valor); delete anchos[def.id]; });
      anchos.__uniforme = valor;
      try { localStorage.setItem(claveAnchos(), JSON.stringify(anchos)); } catch (_) {}
    };
  }

    return Object.freeze({
      leerVista: leerVista, estaVisible: estaVisible, ponerVista: ponerVista,
      vistaRapida: vistaRapida, panelColumnas: panelColumnas,
      barraGanchosColumnas: barraGanchosColumnas,
      leerAnchos: leerAnchos, iniciarRedimension: iniciarRedimension,
      estudianteOculto: function (id) { return !!vistaEstOcultos[id]; }
    });
  }
  P.libretaVista = Object.freeze({ crear: crear });
})();
