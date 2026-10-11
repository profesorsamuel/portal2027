/* portal2027-config.js — etapa 4B: configuración académica (solo administración).
   Periodos (fechas de trimestres), pesos por categoría y estados de asistencia y de nota.
   Aquí solo se GUARDA configuración: nada de esto entra todavía en el cálculo de notas ni de asistencia. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var CATS = ['apreciacion', 'ejercicio_escrito', 'examen'];
  var ETQ = { apreciacion: 'Apreciación', ejercicio_escrito: 'Ejercicio escrito', examen: 'Examen' };

  var D = {};
  var zona = null, barra = null, anioPesos = null;

  function aviso(texto, tipo) {
    barra.textContent = texto;
    barra.className = 'mensaje estado-panel ' + (tipo || 'info');
    barra.hidden = !texto;
  }
  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^(Las fechas|Hay sesiones)/.test(m)) { return m; }
    if (/check constraint/i.test(m)) { return 'Algún dato no tiene el formato permitido (revise fechas, pesos de 0 a 100 y abreviaturas de 1 a 3 letras).'; }
    return P.traducirError(e);
  }

  async function cargar() {
    var r = await Promise.all([
      consultar(db.from('portal2027_anios').select('id,anio,activo,trimestres:portal2027_trimestres(id,numero,fecha_inicio,fecha_fin)').order('anio', { ascending: false })),
      consultar(db.from('portal2027_pesos_categoria').select('anio_id,categoria,peso')),
      consultar(db.from('portal2027_estados_asistencia').select('codigo,etiqueta,abreviatura,orden,activo').order('orden').order('codigo')),
      consultar(db.from('portal2027_estados_nota').select('codigo,etiqueta,abreviatura,orden,activo').order('orden').order('codigo'))
    ]);
    D = { anios: r[0], pesos: r[1], estAsis: r[2], estNota: r[3] };
    D.anios.forEach(function (a) { a.trimestres.sort(function (x, y) { return x.numero - y.numero; }); });
    if (!anioPesos || !D.anios.some(function (a) { return a.id === anioPesos; })) {
      var act = D.anios.filter(function (a) { return a.activo; })[0] || D.anios[0];
      anioPesos = act ? act.id : null;
    }
  }

  async function ejecutar(accion, textoOk) {
    aviso('Guardando…', 'info');
    try { await accion(); await cargar(); dibujar(); aviso(textoOk, 'ok'); }
    catch (e) { aviso('No se guardó. ' + textoError(e), 'error'); }
  }

  function tabla(cab, filas, vacio) {
    if (filas.length === 0) { return el('p', { clase: 'vacio-texto', texto: vacio }); }
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }
  function guardarBtn(fn) { return el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Guardar', onclick: fn }); }

  /* ---------- Periodos ---------- */
  function seccionPeriodos() {
    var filas = [];
    D.anios.forEach(function (a) {
      a.trimestres.forEach(function (t) {
        var ini = el('input', { type: 'date', value: t.fecha_inicio || '', 'aria-label': 'Inicio del trimestre ' + t.numero + ' de ' + a.anio });
        var fin = el('input', { type: 'date', value: t.fecha_fin || '', 'aria-label': 'Fin del trimestre ' + t.numero + ' de ' + a.anio });
        filas.push(el('tr', null, [
          el('td', { texto: String(a.anio) + (a.activo ? ' (activo)' : '') }), el('td', { texto: 'Trimestre ' + t.numero }),
          el('td', null, [ini]), el('td', null, [fin]),
          el('td', null, [guardarBtn(function () {
            if (ini.value && fin.value && fin.value < ini.value) { aviso('La fecha de fin no puede ser anterior al inicio.', 'error'); return; }
            ejecutar(async function () {
              var r = await db.from('portal2027_trimestres').update({ fecha_inicio: ini.value || null, fecha_fin: fin.value || null }).eq('id', t.id);
              if (r.error) { throw r.error; }
            }, 'Fechas del trimestre ' + t.numero + ' de ' + a.anio + ' guardadas.');
          })])
        ]));
      });
    });
    return el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Periodos (trimestres)' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Fechas opcionales. Si las define, las sesiones de asistencia deben caer dentro del trimestre. Los trimestres no pueden cruzarse. Dejar vacío quita la restricción.' }),
      tabla(['Año', 'Trimestre', 'Inicio', 'Fin', ''], filas, 'Todavía no hay años lectivos.')
    ]);
  }

  /* ---------- Pesos ---------- */
  function seccionPesos() {
    var hijos = [el('h2', { texto: 'Pesos por categoría' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Guarde aquí los pesos cuando los defina. Vacío = sin definir. Por ahora NO se usan en ningún cálculo: el final sigue siendo el promedio simple de las categorías con nota.' })];
    if (!anioPesos) { hijos.push(el('p', { clase: 'vacio-texto', texto: 'Cree primero un año lectivo.' })); return el('section', { clase: 'bloque' }, hijos); }

    var selAnio = el('select', { 'aria-label': 'Año de los pesos' }, D.anios.map(function (a) {
      return el('option', { value: a.id, texto: String(a.anio) + (a.activo ? ' (activo)' : ''), selected: a.id === anioPesos });
    }));
    selAnio.addEventListener('change', function () { anioPesos = selAnio.value; dibujar(); });

    var inputs = {};
    var suma = el('p', { clase: 'bloque-ayuda' });
    function pesoActual(c) {
      var f = D.pesos.filter(function (p) { return p.anio_id === anioPesos && p.categoria === c; })[0];
      return f && f.peso !== null ? String(Number(f.peso)) : '';
    }
    function actualizarSuma() {
      var t = 0, n = 0;
      CATS.forEach(function (c) { var v = inputs[c].value.trim().replace(',', '.'); if (v !== '' && isFinite(Number(v))) { t += Number(v); n += 1; } });
      suma.textContent = n === 0 ? 'Ningún peso definido.' : 'Suma de los pesos definidos: ' + (Math.round(t * 100) / 100) + (n === CATS.length && Math.round(t * 100) / 100 !== 100 ? ' (no suma 100; se puede guardar igual).' : '.');
    }
    var filas = CATS.map(function (c) {
      var inp = el('input', { type: 'text', inputmode: 'decimal', maxlength: '6', value: pesoActual(c), placeholder: 'sin definir', 'aria-label': 'Peso de ' + ETQ[c] });
      inp.addEventListener('input', actualizarSuma);
      inputs[c] = inp;
      return el('tr', null, [el('td', { texto: ETQ[c] }), el('td', null, [inp, ' %'])]);
    });
    actualizarSuma();

    var btn = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Guardar pesos', onclick: function () {
      var filasDb = [];
      for (var i = 0; i < CATS.length; i++) {
        var crudo = inputs[CATS[i]].value.trim().replace(',', '.');
        var v = crudo === '' ? null : Number(crudo);
        if (v !== null && (!isFinite(v) || v < 0 || v > 100 || Math.round(v * 100) / 100 !== v)) {
          aviso('El peso de ' + ETQ[CATS[i]] + ' debe ser un número de 0 a 100 (hasta 2 decimales) o quedar vacío.', 'error'); return;
        }
        filasDb.push({ anio_id: anioPesos, categoria: CATS[i], peso: v });
      }
      ejecutar(async function () {
        var r = await db.from('portal2027_pesos_categoria').upsert(filasDb, { onConflict: 'anio_id,categoria' });
        if (r.error) { throw r.error; }
      }, 'Pesos guardados. Todavía no se usan en el cálculo.');
    } });

    hijos.push(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Año', selAnio])]));
    hijos.push(tabla(['Categoría', 'Peso'], filas, ''));
    hijos.push(suma, btn);
    return el('section', { clase: 'bloque' }, hijos);
  }

  /* ---------- Estados (asistencia y nota) ---------- */
  function codigoDe(etiqueta) {
    return etiqueta.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
  }
  function seccionEstados(titulo, ayuda, tablaDb, lista, extraCab, extraCelda) {
    var filas = lista.map(function (e) {
      var etq = el('input', { type: 'text', value: e.etiqueta, maxlength: '40', 'aria-label': 'Nombre del estado ' + e.codigo });
      var abr = el('input', { type: 'text', value: e.abreviatura, maxlength: '3', size: '3', 'aria-label': 'Abreviatura de ' + e.codigo });
      var ord = el('input', { type: 'number', value: String(e.orden), 'aria-label': 'Orden de ' + e.codigo });
      var act = el('input', { type: 'checkbox', checked: e.activo, 'aria-label': 'Activo: ' + e.codigo });
      var celdas = [el('td', { texto: e.codigo }), el('td', null, [etq]), el('td', null, [abr]), el('td', null, [ord]), el('td', { clase: 'centro' }, [act])];
      if (extraCelda) { celdas.push(extraCelda()); }
      celdas.push(el('td', null, [guardarBtn(function () {
        var n = parseInt(ord.value, 10);
        if (!etq.value.trim() || !abr.value.trim() || isNaN(n)) { aviso('Complete nombre, abreviatura (1 a 3 letras) y orden.', 'error'); return; }
        ejecutar(async function () {
          var r = await db.from(tablaDb).update({ etiqueta: etq.value.trim(), abreviatura: abr.value.trim(), orden: n, activo: act.checked }).eq('codigo', e.codigo);
          if (r.error) { throw r.error; }
        }, 'Estado «' + etq.value.trim() + '» guardado.');
      })]));
      return el('tr', null, celdas);
    });

    var nEtq = el('input', { type: 'text', maxlength: '40', placeholder: 'Nombre del estado' });
    var nAbr = el('input', { type: 'text', maxlength: '3', size: '3', placeholder: 'Abrev.' });
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      el('label', null, ['Nuevo estado', nEtq]), el('label', null, ['Abreviatura', nAbr]),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Agregar estado' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var cod = codigoDe(nEtq.value);
      if (!cod || !nAbr.value.trim()) { aviso('Escriba el nombre (con letras) y la abreviatura.', 'error'); return; }
      if (lista.some(function (x) { return x.codigo === cod; })) { aviso('Ya existe un estado con ese nombre.', 'error'); return; }
      var orden = lista.reduce(function (m, x) { return Math.max(m, x.orden); }, 0) + 1;
      ejecutar(async function () {
        var r = await db.from(tablaDb).insert({ codigo: cod, etiqueta: nEtq.value.trim(), abreviatura: nAbr.value.trim(), orden: orden });
        if (r.error) { throw r.error; }
      }, 'Estado agregado.');
    });

    var cab = ['Código', 'Nombre', 'Abrev.', 'Orden', 'Activo'].concat(extraCab ? [extraCab] : []).concat(['']);
    return el('section', { clase: 'bloque' }, [el('h2', { texto: titulo }), el('p', { clase: 'bloque-ayuda', texto: ayuda }), tabla(cab, filas, 'No hay estados.'), form]);
  }

  function dibujar() {
    var previo = zona.querySelector('.secciones-config');
    if (previo) { previo.remove(); }
    zona.appendChild(el('div', { clase: 'secciones secciones-config' }, [
      el('h2', { texto: 'Configuración académica' }),
      seccionPeriodos(),
      seccionPesos(),
      seccionEstados('Estados de asistencia', 'Los estados que aparecen en cada casilla de asistencia. El código no se cambia; un estado desactivado deja de ofrecerse pero se conserva donde ya se usó. No hay cálculo de porcentaje todavía.',
        'portal2027_estados_asistencia', D.estAsis),
      seccionEstados('Estados de nota (pendiente / exento)', 'Catálogo de estados para notas. Su efecto en el cálculo está sin definir y por eso todavía no se pueden marcar en la libreta.',
        'portal2027_estados_nota', D.estNota, 'Efecto', function () { return el('td', { texto: 'Sin definir' }); })
    ]));
  }

  P.renderConfigAdmin = async function (contenedor) {
    zona = contenedor;
    barra = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });
    zona.appendChild(barra);
    await cargar();
    dibujar();
  };
})();
