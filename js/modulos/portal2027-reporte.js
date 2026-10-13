/* portal2027-reporte.js — etapa 7, parte B: reporte del trimestre por materia y grupo (profesor y administración).
   Si el trimestre está cerrado muestra la COPIA guardada al cerrar; si no, los datos actuales de la libreta (marcado como no definitivo).
   Todos los promedios salen del motor único (portal2027.evaluacion), igual que la libreta. No hay promedio anual ni criterios de honor. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var M = P.evaluacion;
  var contenido = document.getElementById('contenido');

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
  function nombreEst(e) { return ((e.apellidos || '') + ', ' + (e.nombres || '')).replace(/^, |, $/g, ''); }
  function nombreNormal(e) { return ((e.nombres || '') + ' ' + (e.apellidos || '')).trim(); }
  function fecha(t) { return new Date(t).toLocaleString('es-PA'); }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^(No tiene permiso|El trimestre)/.test(m)) { return m.replace(/\s*\(row-level security\)/, ''); }
    return P.traducirError(e);
  }
  function errorPantalla(texto) {
    contenido.textContent = '';
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: texto }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }

  /* ---------- datos ---------- */
  function desdeCopia(d, fila) {
    var notas = {};
    (d.notas || []).forEach(function (n) { (notas[n.matricula_id] = notas[n.matricula_id] || {})[n.evaluacion_id] = Number(n.valor); });
    var conteos = {};
    ((d.asistencia && d.asistencia.conteos) || []).forEach(function (c) { (conteos[c.matricula_id] = conteos[c.matricula_id] || {})[c.estado] = Number(c.cantidad); });
    return {
      origen: 'copia', version: fila.version, fecha: d.cerrado_en || fila.creado_en,
      evaluaciones: d.evaluaciones || [],
      estudiantes: (d.estudiantes || []).map(function (e) { return { id: e.matricula_id, codigo: e.codigo, nombres: e.nombres, apellidos: e.apellidos }; }),
      notas: notas, sesiones: (d.asistencia && d.asistencia.sesiones) || 0, conteos: conteos
    };
  }

  async function datosActuales(asig, trId) {
    var r = await Promise.all([
      todas(function () {
        return db.from('portal2027_evaluaciones').select('id,categoria,tema,orden,oculta')
          .eq('asignacion_id', asig.id).eq('trimestre_id', trId).is('eliminada_en', null).order('orden').order('id');
      }),
      todas(function () {
        return db.from('portal2027_matriculas').select('id,estudiante:portal2027_estudiantes(codigo,nombres,apellidos)')
          .eq('salon_id', asig.salon.id).eq('anio_id', asig.salon.anio_id).order('id');
      }),
      todas(function () {
        return db.from('portal2027_notas')
          .select('evaluacion_id,matricula_id,valor,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id,eliminada_en)')
          .eq('evaluacion.asignacion_id', asig.id).eq('evaluacion.trimestre_id', trId).is('evaluacion.eliminada_en', null).order('id');
      }),
      todas(function () {
        return db.from('portal2027_asistencia')
          .select('matricula_id,estado,sesion:portal2027_sesiones_asistencia!inner(asignacion_id,trimestre_id,eliminada_en)')
          .eq('sesion.asignacion_id', asig.id).eq('sesion.trimestre_id', trId).is('sesion.eliminada_en', null).not('estado', 'is', null).order('id');
      }),
      db.from('portal2027_sesiones_asistencia').select('id', { count: 'exact', head: true })
        .eq('asignacion_id', asig.id).eq('trimestre_id', trId).is('eliminada_en', null)
    ]);
    if (r[4].error) { throw r[4].error; }
    var notas = {};
    r[2].forEach(function (n) { if (n.valor !== null) { (notas[n.matricula_id] = notas[n.matricula_id] || {})[n.evaluacion_id] = Number(n.valor); } });
    var conteos = {};
    r[3].forEach(function (a) { var c = (conteos[a.matricula_id] = conteos[a.matricula_id] || {}); c[a.estado] = (c[a.estado] || 0) + 1; });
    return {
      origen: 'actual', version: null, fecha: new Date().toISOString(), evaluaciones: r[0],
      estudiantes: r[1].filter(function (m) { return m.estudiante; }).map(function (m) { return { id: m.id, codigo: m.estudiante.codigo, nombres: m.estudiante.nombres, apellidos: m.estudiante.apellidos }; }),
      notas: notas, sesiones: r[4].count || 0, conteos: conteos
    };
  }

  /* ---------- cálculo (solo el motor único) ---------- */
  function filaDe(est, D) {
    var notas = D.notas[est.id] || {};
    var res = M.calcular(D.evaluaciones, notas);
    var faltan = D.evaluaciones.filter(function (e) { return !M.esNota(notas[e.id]); });
    return { est: est, res: res, faltan: faltan, asis: D.conteos[est.id] || {} };
  }
  function etiquetaEval(e) { return M.ETIQUETAS[e.categoria] + (e.tema ? ' «' + e.tema + '»' : ''); }
  function textoAsistencia(f, D, estados) {
    var marcadas = 0, partes = [];
    estados.forEach(function (s) { var n = f.asis[s.codigo] || 0; marcadas += n; if (n) { partes.push(s.etiqueta + ' ' + n); } });
    Object.keys(f.asis).forEach(function (c) {
      if (!estados.some(function (s) { return s.codigo === c; })) { marcadas += f.asis[c]; partes.push(c + ' ' + f.asis[c]); }
    });
    var sin = Math.max(D.sesiones - marcadas, 0);
    return (partes.length ? partes.join(', ') : 'sin marcas registradas') + (sin ? ' (sin marcar: ' + sin + ')' : '');
  }

  /* ---------- borradores de avisos ---------- */
  function borradores(tipo, filas, D, estados, ctx) {
    var cierre = D.origen === 'copia'
      ? 'Datos de la copia de cierre (versión ' + D.version + ', ' + fecha(D.fecha) + ').'
      : 'Datos al ' + fecha(D.fecha) + ': el trimestre aún no está cerrado y las notas pueden cambiar.';
    var firma = '\nAtentamente,\n' + ctx.firma;
    var encabezado = ctx.materia + ' · ' + ctx.grupo + ' · trimestre ' + ctx.trimestre;
    if (tipo === 'pendientes') {
      return filas.filter(function (f) { return f.faltan.length > 0; }).map(function (f) {
        return { titulo: nombreEst(f.est) + ' — notas pendientes', texto:
          'Estimado(a) acudiente de ' + nombreNormal(f.est) + ':\n\nEn ' + encabezado + ', todavía no tenemos registrada la nota de su acudido en:\n' +
          f.faltan.map(function (e) { return '- ' + etiquetaEval(e); }).join('\n') +
          '\n\nSi corresponde, le pedimos ponerse en contacto con el docente para aclararlo.\n' + cierre + '\n' + firma };
      });
    }
    return filas.map(function (f) {
      var cats = M.CATEGORIAS.map(function (c) { return '- ' + M.ETIQUETAS[c] + ': ' + (f.res.categorias[c].texto || 'sin notas todavía'); }).join('\n');
      return { titulo: nombreEst(f.est) + ' — resumen del trimestre', texto:
        'Estimado(a) acudiente de ' + nombreNormal(f.est) + ':\n\nLe compartimos el resumen de ' + encabezado + ':\n' + cats +
        '\n- Nota final del trimestre: ' + f.res.textoFinal + '\n\nAsistencia registrada: ' + textoAsistencia(f, D, estados) + '.\n\n' +
        cierre + '\nEste resumen es informativo; no incluye promedio anual.\n' + firma };
    });
  }

  /* ---------- pantalla ---------- */
  function dibujarReporte(D, estados, ctx) {
    var filas = D.estudiantes.slice().sort(function (a, b) {
      return (a.apellidos || '').localeCompare(b.apellidos || '', 'es') || (a.nombres || '').localeCompare(b.nombres || '', 'es');
    }).map(function (e) { return filaDe(e, D); });

    var usados = {};
    filas.forEach(function (f) { Object.keys(f.asis).forEach(function (c) { usados[c] = true; }); });
    var cols = estados.filter(function (s) { return s.activo || usados[s.codigo]; });

    var cab = ['Estudiante', 'Código'].concat(M.CATEGORIAS.map(function (c) { return M.ETIQUETAS[c]; }), ['Final', 'Casillas sin nota'],
      cols.map(function (s) { return s.abreviatura; }), ['Sin marcar']);
    var cuerpo = filas.map(function (f) {
      var marcadas = 0;
      var celdas = [el('td', { texto: nombreEst(f.est) }), el('td', { texto: f.est.codigo || '' })];
      M.CATEGORIAS.forEach(function (c) { celdas.push(el('td', { clase: 'centro', texto: f.res.categorias[c].texto || '—' })); });
      celdas.push(el('td', { clase: 'final', texto: f.res.textoFinal }));
      celdas.push(el('td', { clase: 'centro', texto: String(f.faltan.length) }));
      cols.forEach(function (s) { var n = f.asis[s.codigo] || 0; marcadas += n; celdas.push(el('td', { clase: 'centro', texto: String(n) })); });
      celdas.push(el('td', { clase: 'centro', texto: String(Math.max(D.sesiones - marcadas, 0)) }));
      return el('tr', null, celdas);
    });

    var zona = el('div');
    zona.appendChild(el('p', { clase: 'reporte-origen ' + (D.origen === 'copia' ? 'copia' : ''), texto: D.origen === 'copia'
      ? 'Copia de cierre, versión ' + D.version + ' (' + fecha(D.fecha) + '). Estos datos ya no cambian.'
      : 'Datos actuales de la libreta (' + fecha(D.fecha) + '). El trimestre NO está cerrado: esto no es el resultado definitivo y puede cambiar.' }));
    zona.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Estudiantes: ' + filas.length + ' · columnas de evaluación: ' + D.evaluaciones.length + ' · sesiones de asistencia: ' + D.sesiones +
      '. Vacío no es cero: sin notas no hay promedio. Este reporte no incluye promedio anual ni criterios de honor.' }));
    if (filas.length === 0) { zona.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay estudiantes en este reporte.' })); return { zona: zona, filas: filas }; }
    zona.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos reporte-tabla' }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, cuerpo)
    ])]));
    if (cols.length) {
      zona.appendChild(el('p', { clase: 'bloque-ayuda', texto: cols.map(function (s) { return s.abreviatura + ' = ' + s.etiqueta; }).join(' · ') }));
    }
    return { zona: zona, filas: filas };
  }

  async function iniciar() {
    if (!db) { errorPantalla(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { errorPantalla(P.traducirError(e)); return; }
    var rolPanel = info && (info.roles.indexOf('profesor') !== -1 ? 'profesor' : (info.roles.indexOf('administrador') !== -1 ? 'administrador' : null));
    if (!info || !rolPanel) { window.location.replace(P.rutaInicio()); return; }
    db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); } });

    var params = new URLSearchParams(window.location.search);
    contenido.textContent = '';
    try {
      var asig = params.get('asignacion') ? await consultar(db.from('portal2027_asignaciones')
        .select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
        .eq('id', params.get('asignacion')).maybeSingle()) : null;
      if (!asig) { errorPantalla('No se encontró este reporte o no tiene acceso a él.'); return; }
      var trims = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', asig.salon.anio_id).order('numero'));
      var tr = trims.filter(function (t) { return t.id === params.get('trimestre'); })[0] || trims[0];
      if (!tr) { errorPantalla('Este año no tiene trimestres.'); return; }

      var r = await Promise.all([
        consultar(db.from('portal2027_cierres').select('cerrado').eq('asignacion_id', asig.id).eq('trimestre_id', tr.id).maybeSingle()),
        consultar(db.from('portal2027_resultados_cierre').select('version,creado_en').eq('asignacion_id', asig.id).eq('trimestre_id', tr.id).order('version', { ascending: false })),
        consultar(db.from('portal2027_estados_asistencia').select('codigo,etiqueta,abreviatura,orden,activo').order('orden').order('codigo'))
      ]);
      var cerrado = !!(r[0] && r[0].cerrado), versiones = r[1], estados = r[2];

      // Qué mostrar: ?version=N (una copia), ?version=actual (libreta ahora) o, por defecto, la última copia si está cerrado.
      var pedida = params.get('version');
      var verCopia = null;
      if (pedida && pedida !== 'actual') { verCopia = versiones.filter(function (v) { return String(v.version) === pedida; })[0] || null; }
      else if (!pedida && cerrado && versiones.length) { verCopia = versiones[0]; }
      var D;
      if (verCopia) {
        var fila = await consultar(db.from('portal2027_resultados_cierre').select('version,creado_en,datos')
          .eq('asignacion_id', asig.id).eq('trimestre_id', tr.id).eq('version', verCopia.version).maybeSingle());
        if (!fila) { errorPantalla('No se encontró esa copia de cierre.'); return; }
        D = desdeCopia(fila.datos, fila);
      } else {
        D = await datosActuales(asig, tr.id);
      }

      var urlBase = 'portal2027-reporte.html?asignacion=' + encodeURIComponent(asig.id);
      var selTr = el('select', { 'aria-label': 'Trimestre' }, trims.map(function (t) { return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === tr.id }); }));
      selTr.addEventListener('change', function () { window.location.href = urlBase + '&trimestre=' + encodeURIComponent(selTr.value); });
      var opciones = [el('option', { value: 'actual', texto: 'Datos actuales de la libreta', selected: D.origen === 'actual' })].concat(versiones.map(function (v) {
        return el('option', { value: String(v.version), texto: 'Copia de cierre, versión ' + v.version + ' (' + fecha(v.creado_en) + ')', selected: D.origen === 'copia' && D.version === v.version });
      }));
      var selVer = el('select', { 'aria-label': 'Origen de los datos' }, opciones);
      selVer.addEventListener('change', function () { window.location.href = urlBase + '&trimestre=' + encodeURIComponent(tr.id) + '&version=' + encodeURIComponent(selVer.value); });

      var ctx = { materia: asig.materia.nombre, grupo: asig.salon.nombre, trimestre: tr.numero, firma: P.nombreCompleto(info.perfil) || '[Su nombre]' };

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Reporte del trimestre' }),
          el('h1', { texto: asig.materia.nombre + ' · ' + asig.salon.nombre + ' · Trimestre ' + tr.numero }),
          el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(asig.id) + '&trimestre=' + encodeURIComponent(tr.id), texto: 'Volver a la libreta' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Imprimir / guardar PDF', onclick: function () { window.print(); } }),
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-aprobados.html?asignacion=' + encodeURIComponent(asig.id), texto: 'Cuadro de aprobados y reprobados' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(el('div', { clase: 'formulario-fila no-imprimir' }, [el('label', null, ['Trimestre', selTr]), el('label', null, ['Datos', selVer])]));

      var rep = dibujarReporte(D, estados, ctx);
      contenido.appendChild(rep.zona);

      // Avisos en borrador (no se envía nada)
      var selTipo = el('select', { 'aria-label': 'Tipo de aviso' }, [
        el('option', { value: 'resumen', texto: 'Resumen de notas por estudiante' }),
        el('option', { value: 'pendientes', texto: 'Aviso de notas pendientes (solo estudiantes con casillas sin nota)' })
      ]);
      var zonaAv = el('div');
      function pintarAvisos() { P.avisos.dibujar(zonaAv, borradores(selTipo.value, rep.filas, D, estados, ctx)); }
      selTipo.addEventListener('change', pintarAvisos);
      contenido.appendChild(el('section', { clase: 'bloque no-imprimir' }, [
        el('h2', { texto: 'Avisos a acudientes (borradores)' }),
        el('div', { clase: 'formulario-fila' }, [el('label', null, ['Tipo de aviso', selTipo])]), zonaAv
      ]));
      pintarAvisos();
    } catch (e) {
      errorPantalla('No se pudo abrir el reporte. ' + textoError(e));
    }
  }

  iniciar();
})();
