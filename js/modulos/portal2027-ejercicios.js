/* portal2027-ejercicios.js — ejercicios virtuales (guía, etapa 6, parte B): pantalla del profesor y administración.
   Periodos (semanal/quincenal) ligados a una columna de apreciación, ejercicios, equipos y consolidación.
   Todo cambio pasa por funciones de la base (permisos, trimestre cerrado, versión e historial); aquí solo se muestra
   el resultado real. Aquí no se calcula ninguna nota: la consolidación la hace la base con el guardado común. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var contenido = document.getElementById('contenido');

  var S = {
    asig: null, trimestres: [], trimestreId: null, cerrado: false, config: null,
    evals: [], periodos: [], ejercicios: [], equipos: [], intentos: {}, consolidaciones: [], mats: [],
    verPapelera: false, abierto: null                       // abierto = id del ejercicio con su panel de equipos desplegado
  };
  var estado = null;
  var zona = null;

  /* ---------- utilidades ---------- */
  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
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
    if (/duplicate key|violates check constraint/i.test(m)) { return P.traducirError(e); }
    if (/periodo|trimestre|Falta definir|equipo|columna|apreciación|papelera|individual|No tiene permiso|bloqueada|fechas|estudiante|CONFLICTO|motivo/i.test(m)) {
      return m.replace(/\s*\(row-level security\)/, '');
    }
    return P.traducirError(e);
  }
  function errorPantalla(texto) {
    contenido.textContent = '';
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: texto }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }
  function nombreEst(m) {
    var e = m.estudiante || {};
    return ((e.apellidos || '') + ', ' + (e.nombres || '')).replace(/^, |, $/g, '');
  }
  function fecha(d) { var p = String(d).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
  function dias(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function boton(texto, fn, extra) { return el('button', { clase: 'boton boton-secundario boton-chico' + (extra ? ' ' + extra : ''), type: 'button', texto: texto, onclick: fn }); }
  function chip(t) { return el('span', { clase: 'etiqueta-chica', texto: t }); }
  function evalPorId(id) { return S.evals.filter(function (e) { return e.id === id; })[0]; }
  function etiquetaCol(e) { return e ? 'Apreciación' + (e.tema ? ' — ' + e.tema : ' (sin tema)') : '(columna no disponible)'; }
  function matPorId(id) { return S.mats.filter(function (m) { return m.id === id; })[0]; }

  async function accion(ocupado, ok, fn) {
    aviso(ocupado, 'info');
    try { var r = await fn(); await cargar(); dibujar(); aviso(typeof ok === 'function' ? ok(r) : ok, 'ok'); }
    catch (e) { aviso('No se guardó. ' + textoError(e), 'error'); }
  }
  async function rpc(nombre, args) {
    var r = await db.rpc(nombre, args);
    if (r.error) { throw r.error; }
    return r.data;
  }

  /* ---------- carga ---------- */
  async function cargar() {
    var asigId = S.asig.id, tr = S.trimestreId;
    var r = await Promise.all([
      consultar(db.from('portal2027_evaluaciones').select('id,tema,orden,eliminada_en').eq('asignacion_id', asigId).eq('trimestre_id', tr)
        .eq('categoria', 'apreciacion').order('orden').order('id')),
      consultar(db.from('portal2027_periodos_ejercicio').select('id,tipo,fecha_inicio,fecha_fin,evaluacion_id,cerrado_en')
        .eq('asignacion_id', asigId).eq('trimestre_id', tr).order('fecha_inicio').order('id')),
      todas(function () {
        return db.from('portal2027_matriculas').select('id,estudiante:portal2027_estudiantes(codigo,nombres,apellidos)')
          .eq('salon_id', S.asig.salon.id).eq('anio_id', S.asig.salon.anio_id).order('id');
      }),
      consultar(db.from('portal2027_config_ejercicios').select('metodo,faltantes').eq('anio_id', S.asig.salon.anio_id).maybeSingle()),
      consultar(db.from('portal2027_cierres').select('cerrado').eq('asignacion_id', asigId).eq('trimestre_id', tr).maybeSingle())
    ]);
    S.evals = r[0]; S.periodos = r[1];
    S.mats = r[2].filter(function (m) { return m.estudiante; }).sort(function (a, b) {
      return a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es') || a.estudiante.nombres.localeCompare(b.estudiante.nombres, 'es');
    });
    S.config = r[3]; S.cerrado = !!(r[4] && r[4].cerrado);

    var perIds = S.periodos.map(function (p) { return p.id; });
    S.ejercicios = []; S.equipos = []; S.intentos = {}; S.consolidaciones = [];
    if (perIds.length === 0) { return; }
    S.ejercicios = await consultar(db.from('portal2027_ejercicios')
      .select('id,periodo_id,titulo,juego,modo,participacion,tamano_equipo,eliminado_en').in('periodo_id', perIds).order('creado_en').order('id'));
    var ejIds = S.ejercicios.map(function (e) { return e.id; });
    var r2 = await Promise.all([
      ejIds.length ? consultar(db.from('portal2027_equipos_ejercicio')
        .select('id,ejercicio_id,integrantes:portal2027_equipo_integrantes(matricula_id,confirmado_en)').in('ejercicio_id', ejIds).order('creado_en')) : [],
      ejIds.length ? todas(function () { return db.from('portal2027_intentos').select('ejercicio_id').in('ejercicio_id', ejIds).order('id'); }) : [],
      consultar(db.from('portal2027_consolidaciones').select('periodo_id,matricula_id,valor,detalle,consolidado_en').in('periodo_id', perIds))
    ]);
    S.equipos = r2[0];
    r2[1].forEach(function (i) { S.intentos[i.ejercicio_id] = (S.intentos[i.ejercicio_id] || 0) + 1; });
    S.consolidaciones = r2[2];
  }

  /* ---------- dibujo ---------- */
  function mensajeConfig() {
    var c = S.config;
    if (!c || c.metodo === 'sin_definir' || c.faltantes === 'sin_definir') {
      return el('p', { clase: 'mensaje error', texto: 'Consolidación BLOQUEADA: administración aún no define cómo se combinan los ejercicios ni qué pasa con los faltantes. Puede crear periodos, ejercicios y equipos; los intentos se guardan, pero no pasan a la libreta.' });
    }
    return el('p', { clase: 'mensaje ok', texto: 'Regla del año: promedio de la mejor nota de cada ejercicio obligatorio; un ejercicio sin intentos no cuenta (no es cero). La práctica nunca da nota.' });
  }

  function formPeriodo() {
    var usadas = {};
    S.periodos.forEach(function (p) { usadas[p.evaluacion_id] = true; });
    var libres = S.evals.filter(function (e) { return !e.eliminada_en && !usadas[e.id]; });
    var caja = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Nuevo periodo' })]);
    if (libres.length === 0) {
      caja.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay columnas de Apreciación libres en este trimestre. Cree una en la libreta; cada periodo alimenta una columna distinta.' }));
      return caja;
    }
    var tipo = el('select', { 'aria-label': 'Tipo de periodo' }, [el('option', { value: 'semanal', texto: 'Semanal' }), el('option', { value: 'quincenal', texto: 'Quincenal' })]);
    var ini = el('input', { type: 'date', required: true });
    var fin = el('input', { type: 'date', required: true });
    var col = el('select', { 'aria-label': 'Columna de apreciación' }, libres.map(function (e) { return el('option', { value: e.id, texto: etiquetaCol(e) }); }));
    var form = el('form', { clase: 'formulario-fila' }, [
      el('label', null, ['Tipo', tipo]), el('label', null, ['Desde', ini]), el('label', null, ['Hasta', fin]),
      el('label', null, ['Columna que alimenta', col]),
      el('button', { clase: 'boton', type: 'submit', disabled: S.cerrado, texto: 'Crear periodo' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!ini.value || !fin.value) { aviso('Indique las dos fechas.', 'error'); return; }
      if (fin.value < ini.value) { aviso('La fecha final no puede ser anterior a la inicial.', 'error'); return; }
      if (dias(ini.value, fin.value) > 14) { aviso('Un periodo dura como máximo 15 días.', 'error'); return; }
      accion('Guardando…', 'Periodo creado.', function () {
        return rpc('portal2027_crear_periodo_ejercicio', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_tipo: tipo.value,
          p_inicio: ini.value, p_fin: fin.value, p_evaluacion: col.value });
      });
    });
    caja.appendChild(form);
    return caja;
  }

  function formEjercicio(p) {
    var titulo = el('input', { type: 'text', maxlength: '120', required: true, placeholder: 'Título' });
    var juego = el('input', { type: 'text', maxlength: '60', pattern: '[a-z0-9\\-]*', placeholder: 'ejemplo-suma', list: 'portal2027-juegos' });
    var modo = el('select', { 'aria-label': 'Modo' }, [el('option', { value: 'obligatorio', texto: 'Obligatorio (da nota)' }), el('option', { value: 'practica', texto: 'Práctica (sin nota)' })]);
    var part = el('select', { 'aria-label': 'Participación' }, [el('option', { value: 'individual', texto: 'Individual' }), el('option', { value: 'equipo', texto: 'En equipo' })]);
    var tam = el('select', { 'aria-label': 'Tamaño del equipo', disabled: true }, [2, 3, 4].map(function (n) { return el('option', { value: String(n), texto: n + ' estudiantes' }); }));
    part.addEventListener('change', function () { tam.disabled = part.value !== 'equipo'; });
    var form = el('form', { clase: 'formulario-fila' }, [
      el('label', null, ['Título', titulo]), el('label', null, ['Juego (página)', juego]), el('label', null, ['Modo', modo]),
      el('label', null, ['Participación', part]), el('label', null, ['Equipo de', tam]),
      el('button', { clase: 'boton boton-secundario boton-chico', type: 'submit', disabled: !!p.cerrado_en || S.cerrado, texto: 'Agregar ejercicio' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      accion('Guardando…', 'Ejercicio agregado.', function () {
        return rpc('portal2027_crear_ejercicio', { p_periodo: p.id, p_titulo: titulo.value, p_juego: juego.value, p_modo: modo.value,
          p_participacion: part.value, p_tamano: part.value === 'equipo' ? Number(tam.value) : null });
      });
    });
    return form;
  }

  function panelEquipos(ej, p) {
    var equipos = S.equipos.filter(function (q) { return q.ejercicio_id === ej.id; });
    var enEquipo = {};
    equipos.forEach(function (q) { q.integrantes.forEach(function (i) { enEquipo[i.matricula_id] = true; }); });
    var cont = el('div', { clase: 'tarjeta-clase tarjeta-columna' }, [el('h4', { texto: 'Equipos de ' + ej.tamano_equipo + ' — ' + ej.titulo })]);

    if (equipos.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay equipos.' })); }
    equipos.forEach(function (q, n) {
      var conf = q.integrantes.filter(function (i) { return i.confirmado_en; }).length;
      var completo = q.integrantes.length === ej.tamano_equipo && conf === ej.tamano_equipo;
      var nombres = q.integrantes.map(function (i) {
        var m = matPorId(i.matricula_id);
        return (m ? nombreEst(m) : '(estudiante)') + (i.confirmado_en ? ' ✔' : ' (sin confirmar)');
      }).join('; ');
      cont.appendChild(el('div', { clase: 'tarjeta-cabecera' }, [
        el('div', null, [el('strong', { texto: 'Equipo ' + (n + 1) + ' ' }), chip(completo ? 'Confirmado' : 'Faltan confirmaciones (' + conf + ' de ' + ej.tamano_equipo + ')'),
          el('p', { clase: 'bloque-ayuda', texto: nombres })]),
        boton('Disolver', function () {
          if (!window.confirm('¿Disolver este equipo? Solo es posible si todavía no tiene intentos.')) { return; }
          accion('Guardando…', 'Equipo disuelto.', function () { return rpc('portal2027_disolver_equipo', { p_equipo: q.id }); });
        })
      ]));
    });

    var libres = S.mats.filter(function (m) { return !enEquipo[m.id]; });
    if (libres.length >= ej.tamano_equipo && !p.cerrado_en) {
      var marcas = libres.map(function (m) { return { m: m, cb: el('input', { type: 'checkbox' }) }; });
      var form = el('form', { clase: 'formulario-clases' }, [
        el('p', { clase: 'bloque-ayuda', texto: 'Elija exactamente ' + ej.tamano_equipo + ' estudiantes. Cada uno debe confirmar desde su cuenta.' }),
        el('div', { clase: 'lista-marcas' }, marcas.map(function (x) { return el('label', { clase: 'etiqueta-check' }, [x.cb, ' ' + nombreEst(x.m)]); })),
        el('button', { clase: 'boton-principal-chico', type: 'submit', disabled: S.cerrado, texto: 'Crear equipo' })
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var elegidos = marcas.filter(function (x) { return x.cb.checked; }).map(function (x) { return x.m.id; });
        if (elegidos.length !== ej.tamano_equipo) { aviso('Marque exactamente ' + ej.tamano_equipo + ' estudiantes.', 'error'); return; }
        accion('Guardando…', 'Equipo creado; falta que cada integrante confirme.', function () { return rpc('portal2027_crear_equipo', { p_ejercicio: ej.id, p_matriculas: elegidos }); });
      });
      cont.appendChild(form);
    } else if (!p.cerrado_en) {
      cont.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'No quedan estudiantes sin equipo suficientes para formar otro.' }));
    }
    return cont;
  }

  function tablaConsolidacion(p) {
    var filas = S.consolidaciones.filter(function (c) { return c.periodo_id === p.id; });
    if (filas.length === 0) { return el('p', { clase: 'bloque-ayuda', texto: 'Este periodo todavía no se ha consolidado.' }); }
    var ordenadas = filas.map(function (c) { return { c: c, m: matPorId(c.matricula_id) }; }).filter(function (x) { return x.m; })
      .sort(function (a, b) { return nombreEst(a.m).localeCompare(nombreEst(b.m), 'es'); });
    var ultima = filas.reduce(function (a, c) { return c.consolidado_en > a ? c.consolidado_en : a; }, '');
    return el('div', null, [
      el('p', { clase: 'bloque-ayuda', texto: 'Última consolidación: ' + new Date(ultima).toLocaleString('es-PA') + '. «—» = sin ejercicios con nota (no se escribió nada, no es cero).' }),
      el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Estudiante', 'Nota escrita', 'Mejor nota por ejercicio'].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
        el('tbody', null, ordenadas.map(function (x) {
          var det = ((x.c.detalle && x.c.detalle.ejercicios) || []).map(function (d) { return d.titulo + ': ' + (d.mejor === null || d.mejor === undefined ? '—' : Number(d.mejor)); }).join(' · ');
          return el('tr', null, [el('td', { texto: nombreEst(x.m) }), el('td', { texto: x.c.valor === null ? '—' : String(Number(x.c.valor)) }), el('td', { texto: det })]);
        }))
      ])])
    ]);
  }

  function tarjetaPeriodo(p) {
    var col = evalPorId(p.evaluacion_id);
    var cerrado = !!p.cerrado_en;
    var ejs = S.ejercicios.filter(function (e) { return e.periodo_id === p.id && (S.verPapelera || !e.eliminado_en); });
    var bloqueada = !S.config || S.config.metodo === 'sin_definir' || S.config.faltantes === 'sin_definir';

    var tarjeta = el('section', { clase: 'bloque' }, [
      el('div', { clase: 'tarjeta-cabecera' }, [
        el('div', null, [
          el('h3', { texto: (p.tipo === 'semanal' ? 'Semana' : 'Quincena') + ' del ' + fecha(p.fecha_inicio) + ' al ' + fecha(p.fecha_fin) }),
          el('p', { clase: 'bloque-ayuda', texto: 'Alimenta: ' + etiquetaCol(col) }),
          chip(cerrado ? 'Cerrado: no recibe intentos' : 'Abierto')
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          boton(cerrado ? 'Reabrir' : 'Cerrar periodo', function () {
            var txt = cerrado ? '¿Reabrir el periodo? Los estudiantes podrán guardar intentos otra vez.'
              : '¿Cerrar el periodo? Los estudiantes ya no podrán guardar intentos nuevos.';
            if (!window.confirm(txt)) { return; }
            accion('Guardando…', cerrado ? 'Periodo reabierto.' : 'Periodo cerrado.', function () {
              return rpc('portal2027_cerrar_periodo_ejercicio', { p_periodo: p.id, p_cerrar: !cerrado });
            });
          }),
          el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', disabled: bloqueada || S.cerrado,
            title: bloqueada ? 'Administración debe definir cómo se combinan los ejercicios' : 'Escribir las notas en la columna',
            texto: 'Consolidar a la libreta', onclick: function () {
              if (!window.confirm('Se escribirá en la columna «' + etiquetaCol(col) + '» la nota de cada estudiante calculada con sus mejores intentos. Si ya había una nota, se reemplaza y queda en el historial con motivo. ¿Continuar?')) { return; }
              accion('Consolidando…', function (r) {
                return 'Consolidado: ' + r.notas_escritas + ' notas escritas, ' + r.sin_cambio + ' sin cambio, ' + r.sin_ejercicios_con_nota + ' estudiantes sin ejercicios con nota.';
              }, function () { return rpc('portal2027_consolidar_periodo', { p_periodo: p.id }); });
            } })
        ])
      ])
    ]);

    var lista = el('ul', { clase: 'lista-clases' });
    if (ejs.length === 0) { lista.appendChild(el('li', null, [el('span', { clase: 'vacio-texto', texto: 'Este periodo no tiene ejercicios.' })])); }
    ejs.forEach(function (ej) {
      var enPap = !!ej.eliminado_en;
      var item = el('li', { clase: 'tarjeta-clase' }, [
        el('div', null, [
          el('strong', { texto: ej.titulo + ' ' }),
          chip(ej.modo === 'obligatorio' ? 'Obligatorio' : 'Práctica (sin nota)'),
          chip(ej.participacion === 'equipo' ? 'Equipo de ' + ej.tamano_equipo : 'Individual'),
          ej.juego ? chip('Juego: ' + ej.juego) : chip('Sin juego asignado'),
          chip((S.intentos[ej.id] || 0) + ' intentos'),
          enPap ? chip('En papelera') : null
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          ej.participacion === 'equipo' && !enPap ? boton(S.abierto === ej.id ? 'Ocultar equipos' : 'Equipos', function () { S.abierto = S.abierto === ej.id ? null : ej.id; dibujar(); }) : null,
          boton(enPap ? 'Restaurar' : 'A la papelera', function () {
            accion('Guardando…', enPap ? 'Ejercicio restaurado.' : 'Ejercicio en la papelera (los intentos se conservan).', function () {
              return rpc('portal2027_papelera_ejercicio', { p_ejercicio: ej.id, p_a_papelera: !enPap });
            });
          })
        ])
      ]);
      lista.appendChild(item);
      if (S.abierto === ej.id && !enPap) { lista.appendChild(el('li', null, [panelEquipos(ej, p)])); }
    });
    tarjeta.appendChild(lista);
    tarjeta.appendChild(formEjercicio(p));
    tarjeta.appendChild(el('h4', { texto: 'Resultado de la consolidación' }));
    tarjeta.appendChild(tablaConsolidacion(p));
    return tarjeta;
  }

  function dibujar() {
    zona.textContent = '';
    var selTrim = el('select', { 'aria-label': 'Trimestre' }, S.trimestres.map(function (t) { return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === S.trimestreId }); }));
    selTrim.addEventListener('change', async function () {
      S.trimestreId = selTrim.value; S.abierto = null;
      aviso('Cargando…', 'info');
      try { await cargar(); dibujar(); aviso('', 'info'); } catch (e) { aviso('No se pudo cargar. ' + textoError(e), 'error'); }
    });
    var cbPap = el('input', { type: 'checkbox', checked: S.verPapelera });
    cbPap.addEventListener('change', function () { S.verPapelera = cbPap.checked; dibujar(); });

    zona.appendChild(el('section', { clase: 'bloque' }, [
      el('div', { clase: 'formulario-fila' }, [
        el('label', null, ['Trimestre', selTrim]),
        el('label', { clase: 'etiqueta-check' }, [cbPap, ' Mostrar ejercicios en la papelera']),
        boton('Recargar', async function () {
          aviso('Cargando…', 'info');
          try { await cargar(); dibujar(); aviso('Datos al día.', 'ok'); } catch (e) { aviso('No se pudo recargar. ' + textoError(e), 'error'); }
        })
      ]),
      el('p', { clase: S.cerrado ? 'mensaje ok' : 'bloque-ayuda', texto: S.cerrado ? 'Trimestre CERRADO: todo está en solo lectura (la base rechaza cambios).' : 'Trimestre abierto.' }),
      mensajeConfig(),
      el('p', { clase: 'bloque-ayuda', texto: 'La nota de cada intento la calcula la página del juego en el navegador. Revise el resultado de cada consolidación antes de publicar las notas.' }),
      el('datalist', { id: 'portal2027-juegos' }, [el('option', { value: 'ejemplo-suma' })])
    ]));
    zona.appendChild(formPeriodo());
    if (S.periodos.length === 0) {
      zona.appendChild(el('section', { clase: 'bloque' }, [el('p', { clase: 'vacio-texto', texto: 'Todavía no hay periodos en este trimestre.' })]));
    }
    S.periodos.forEach(function (p) { zona.appendChild(tarjetaPeriodo(p)); });
  }

  /* ---------- inicio ---------- */
  async function iniciar() {
    if (!db) { errorPantalla(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { errorPantalla(P.traducirError(e)); return; }
    var rolPanel = info && (info.roles.indexOf('profesor') !== -1 ? 'profesor' : (info.roles.indexOf('administrador') !== -1 ? 'administrador' : null));
    if (!info || !rolPanel) { window.location.replace(P.rutaInicio()); return; }
    db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); } });

    var asigId = new URLSearchParams(window.location.search).get('asignacion');
    contenido.textContent = '';
    estado = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });
    try {
      S.asig = asigId ? await consultar(db.from('portal2027_asignaciones')
        .select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
        .eq('id', asigId).maybeSingle()) : null;
      if (!S.asig) { errorPantalla('No se encontró esta clase o no tiene acceso a ella.'); return; }
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', S.asig.salon.anio_id).order('numero'));
      S.trimestreId = S.trimestres[0] ? S.trimestres[0].id : null;
      if (!S.trimestreId) { errorPantalla('Este año no tiene trimestres.'); return; }

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Ejercicios virtuales' }),
          el('h1', { texto: S.asig.materia.nombre + ' · ' + S.asig.salon.nombre }),
          el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + S.asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(S.asig.id), texto: 'Libreta' }),
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: 'Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(estado);
      zona = el('div', { clase: 'secciones' });
      contenido.appendChild(zona);
      await cargar();
      dibujar();
    } catch (e) {
      errorPantalla('No se pudo abrir la pantalla. ' + textoError(e) + ' (¿ejecutó la migración 0016?)');
    }
  }

  iniciar();
})();
