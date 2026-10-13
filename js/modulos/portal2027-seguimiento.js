/* portal2027-seguimiento.js — seguimiento académico por asignación (grupo + materia): estudiantes en riesgo,
   notas trimestrales (planilla tipo MEDUCA con ausencias y tardanzas) y cuadro de fracaso escolar.
   Solo LEE la base y calcula con el motor único (portal2027.evaluacion). No escribe nada. No envía nada:
   los avisos son borradores y el botón WhatsApp solo abre el chat con el texto escrito (la persona lo envía). */
(function () {
  'use strict';

  var P = window.portal2027, el = P.el, db = P.db, M = P.evaluacion;
  var contenido = document.getElementById('contenido');
  var MIN = 3.0, TOPE = 5.0, META_FRACASO = 28;

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
  function errorPantalla(t) {
    contenido.textContent = '';
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: t }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }

  /* ---------- reglas (una sola vez, aquí) ---------- */
  // Se compara el valor REDONDEADO a 1 decimal (lo que se ve en pantalla): 2.96 se muestra 3.0 y no es riesgo.
  function reprueba(n) { var r = M.redondear1(n); return r !== null && r < MIN; }
  function fmt(n) { return M.formatear(n) || '—'; }
  // Final anual de la planilla MEDUCA = promedio de los trimestres que ya tienen nota (se calcula con M.promedio).
  function finalAnual(f) { return M.promedio(f.tri.map(function (t) { return t.final; })); }
  // Nota mínima en el examen para llegar a MIN, cuando aún no hay examen (se redondea hacia arriba a 1 decimal).
  function minimoExamen(res) {
    var c = res.categorias;
    if (c.examen.promedio !== null) { return { aplica: false }; }
    var otros = [c.apreciacion.promedio, c.ejercicio_escrito.promedio].filter(function (v) { return v !== null; });
    var nec = Math.ceil((MIN * (otros.length + 1) - otros.reduce(function (a, b) { return a + b; }, 0)) * 10 - 1e-9) / 10;
    return { aplica: true, nota: Math.max(nec, 0), imposible: nec > TOPE };
  }
  function nivel(m) {
    if (!m.aplica) { return { t: 'Examen ya registrado', c: 'medio' }; }
    if (m.imposible) { return { t: 'Crítico: no alcanza ni con 5.0', c: 'critico' }; }
    if (m.nota > 4) { return { t: 'Muy comprometido (> 4.0)', c: 'alto' }; }
    if (m.nota > 3.5) { return { t: 'Comprometido (> 3.5)', c: 'medio' }; }
    return { t: 'Leve', c: 'ok' };
  }

  /* ---------- datos de UNA asignación, todos los trimestres ---------- */
  async function cargar(asig, trims) {
    var r = await Promise.all([
      todas(function () { return db.from('portal2027_evaluaciones').select('id,categoria,trimestre_id').eq('asignacion_id', asig.id).is('eliminada_en', null).order('id'); }),
      todas(function () { return db.from('portal2027_matriculas').select('id,estudiante:portal2027_estudiantes(codigo,nombres,apellidos,nombre_acudiente,telefono_acudiente)').eq('salon_id', asig.salon.id).eq('anio_id', asig.salon.anio_id).order('id'); }),
      todas(function () {
        return db.from('portal2027_notas').select('evaluacion_id,matricula_id,valor,evaluacion:portal2027_evaluaciones!inner(asignacion_id,eliminada_en)')
          .eq('evaluacion.asignacion_id', asig.id).is('evaluacion.eliminada_en', null).order('id');
      }),
      todas(function () {
        return db.from('portal2027_asistencia').select('matricula_id,estado,sesion:portal2027_sesiones_asistencia!inner(asignacion_id,trimestre_id,eliminada_en)')
          .eq('sesion.asignacion_id', asig.id).is('sesion.eliminada_en', null).not('estado', 'is', null).order('id');
      })
    ]);
    var notas = {};
    r[2].forEach(function (n) { if (n.valor !== null) { (notas[n.matricula_id] = notas[n.matricula_id] || {})[n.evaluacion_id] = Number(n.valor); } });
    var asis = {};
    r[3].forEach(function (a) {
      var k = a.matricula_id + '|' + a.sesion.trimestre_id, c = (asis[k] = asis[k] || { ausente: 0, tardanza: 0 });
      if (a.estado === 'ausente') { c.ausente++; } else if (a.estado === 'tardanza') { c.tardanza++; }   // «justificada» no cuenta como ausencia
    });
    return r[1].filter(function (m) { return m.estudiante; }).map(function (m) {
      return {
        asig: asig, est: m.estudiante,
        tri: trims.map(function (t) {
          var ev = r[0].filter(function (e) { return e.trimestre_id === t.id; });
          var res = M.calcular(ev, notas[m.id] || {});
          var a = asis[m.id + '|' + t.id] || { ausente: 0, tardanza: 0 };
          return { res: res, final: res.final, aus: a.ausente, tar: a.tardanza };
        })
      };
    }).sort(function (a, b) { return nombreEst(a.est).localeCompare(nombreEst(b.est), 'es'); });
  }

  /* ---------- utilidades de pantalla ---------- */
  function tabla(cab, filas, extra) {
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos seg-tabla ' + (extra || '') }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }
  function td(t, c) { return el('td', { clase: c || '', texto: t }); }
  function notaTd(n) { return td(fmt(n), 'c' + (reprueba(n) ? ' rojo' : '')); }
  function kpis(lista) { return el('div', { clase: 'seg-kpis no-imprimir' }, lista.map(function (k) { return el('div', { clase: 'seg-kpi' }, [el('b', { texto: String(k[0]) }), el('span', { texto: k[1] })]); })); }
  function campo(txt, ctl) { return el('label', null, [txt, ctl]); }
  function opcion(v, t, sel) { return el('option', { value: v, texto: t, selected: sel }); }
  function numeroWa(t) { var d = String(t || '').replace(/\D/g, ''); return !d ? '' : (d.indexOf('507') === 0 && d.length >= 11 ? d : '507' + d); }

  /* ---------- 1) EN RIESGO ---------- */
  function vistaRiesgo(filas, trims, ctx) {
    var zona = el('div'), res = el('div');
    var selModo = el('select', null, [opcion('tri', 'Un trimestre (nota menor que la meta)', true), opcion('acum', 'Acumulado T1+T2 → qué necesita en T3')]);
    var selTr = el('select', null, trims.map(function (t, i) { return opcion(String(i), 'Trimestre ' + t.numero, i === trims.length - 1); }));
    var inMeta = el('input', { type: 'number', step: '0.1', min: '1', max: '5', value: String(MIN), style: 'width:5rem' });
    var inBus = el('input', { type: 'search', placeholder: 'Nombre…' });

    function pintar() {
      var modo = selModo.value, ti = +selTr.value, meta = Number(inMeta.value) || MIN, q = inBus.value.trim().toLowerCase();
      selTr.disabled = modo === 'acum';
      var lista = [];
      filas.forEach(function (f) {
        if (q && nombreEst(f.est).toLowerCase().indexOf(q) === -1) { return; }
        if (modo === 'tri') {
          var t = f.tri[ti];
          if (t && t.final !== null && M.redondear1(t.final) < meta) { lista.push({ f: f, act: t.final, m: minimoExamen(t.res), res: t.res }); }
        } else if (f.tri[0] && f.tri[1] && f.tri[0].final !== null && f.tri[1].final !== null) {
          var prom = (f.tri[0].final + f.tri[1].final) / 2;
          if (M.redondear1(prom) < meta) { lista.push({ f: f, act: prom, nec: M.redondear1(3 * meta - f.tri[0].final - f.tri[1].final) }); }
        }
      });
      lista.sort(function (a, b) { return a.act - b.act; });
      res.textContent = '';
      res.appendChild(kpis([[lista.length, 'en riesgo'], [filas.length, 'matrícula'],
        [modo === 'acum' ? lista.filter(function (x) { return x.nec > TOPE; }).length : lista.filter(function (x) { return x.m && x.m.imposible; }).length, 'ya no alcanzan (> 5.0)']]));
      if (!lista.length) { res.appendChild(el('p', { clase: 'vacio-texto', texto: 'Ningún estudiante en riesgo con estos filtros.' })); return; }
      var cab = ['#', 'Estudiante'].concat(trims.map(function (t) { return 'T' + t.numero; }), [modo === 'tri' ? 'Nota' : 'Prom. actual', modo === 'tri' ? 'Mínimo en examen' : 'Necesita en T3', 'Nivel']);
      var cuerpo = lista.map(function (x, i) {
        var nec, niv;
        if (modo === 'tri') {
          nec = !x.m.aplica ? 'ya hay examen' : (x.m.imposible ? 'no alcanza' : x.m.nota.toFixed(1)); niv = nivel(x.m);
        } else {
          nec = x.nec > TOPE ? 'ya no puede' : Math.max(1, x.nec).toFixed(1);
          niv = x.nec > TOPE ? { t: 'Crítico: no alcanza ni con 5.0', c: 'critico' } : (x.nec > 4 ? { t: 'Muy comprometido (> 4.0)', c: 'alto' } : (x.nec > 3.5 ? { t: 'Comprometido (> 3.5)', c: 'medio' } : { t: 'Leve', c: 'ok' }));
        }
        return el('tr', null, [td(String(i + 1), 'c'), td(nombreEst(x.f.est)), ].concat(x.f.tri.map(function (t) { return notaTd(t.final); }),
          [td(fmt(x.act), 'c rojo'), td(nec, 'c final'), el('td', null, [el('span', { clase: 'seg-etq ' + niv.c, texto: niv.t })])]));
      });
      res.appendChild(tabla(cab, cuerpo));
      res.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Mínimo en examen = nota que falta en el examen para llegar a ' + meta.toFixed(1) + ' (promedio simple de categorías con nota). Niveles: Leve ≤ 3.5, Comprometido > 3.5, Muy comprometido > 4.0, Crítico > 5.0.' }));

      // Avisos: borradores editables + enlace a WhatsApp (la persona lo envía).
      var zonaAv = el('div'), items = lista.map(function (x) {
        var trTxt = modo === 'tri' ? 'Trimestre ' + trims[ti].numero : 'el acumulado de los trimestres 1 y 2';
        var extra = modo === 'tri' && x.m.aplica && !x.m.imposible ? ' Para llegar a ' + meta.toFixed(1) + ' necesita como mínimo ' + x.m.nota.toFixed(1) + ' en el examen.' : '';
        var nombre = ((x.f.est.nombres || '') + ' ' + (x.f.est.apellidos || '')).trim();
        return { titulo: nombreEst(x.f.est) + ' — bajo rendimiento', tel: x.f.est.telefono_acudiente, texto:
          'Estimado(a) acudiente de ' + nombre + ':\n\nLe informamos que su acudido(a) presenta bajo rendimiento en ' + ctx.materia + ' (' + ctx.grupo + ') en ' + trTxt + ', con promedio ' + fmt(x.act) + ' (mínimo para aprobar: ' + meta.toFixed(1) + ').' + extra +
          '\nLe pedimos apoyar el estudio en casa y comunicarse con el docente si tiene dudas.\n\nAtentamente,\n' + ctx.firma };
      });
      P.avisos.dibujar(zonaAv, items, 'Cada borrador se puede abrir en WhatsApp con el texto ya escrito; usted decide si lo envía.');
      zonaAv.querySelectorAll('.aviso-borrador').forEach(function (caja, i) {
        var n = numeroWa(items[i].tel);
        if (!n) { return; }
        var area = caja.querySelector('textarea');
        caja.querySelector('.cabecera-acciones').appendChild(el('a', { clase: 'boton boton-secundario boton-chico', target: '_blank', rel: 'noopener', texto: 'Abrir en WhatsApp',
          href: 'https://wa.me/' + n, onclick: function (ev) { ev.currentTarget.href = 'https://wa.me/' + n + '?text=' + encodeURIComponent(area.value); } }));
      });
      var sec = el('section', { clase: 'bloque no-imprimir' }, [el('h2', { texto: 'Avisos a acudientes (borradores)' }), zonaAv]);
      res.appendChild(sec);
    }
    [selModo, selTr, inMeta].forEach(function (c) { c.addEventListener('change', pintar); });
    inBus.addEventListener('input', pintar);
    zona.appendChild(el('div', { clase: 'formulario-fila no-imprimir' }, [campo('Modo', selModo), campo('Trimestre', selTr), campo('Nota para aprobar', inMeta), campo('Buscar', inBus)]));
    zona.appendChild(res);
    pintar();
    return zona;
  }

  /* ---------- 2) NOTAS TRIMESTRALES (planilla) ---------- */
  function vistaPlanilla(filas, trims, ctx) {
    var zona = el('div');
    zona.appendChild(el('div', { clase: 'cabecera-acciones no-imprimir' }, [el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Imprimir / guardar PDF', onclick: function () { window.print(); } })]));
    zona.appendChild(el('p', { clase: 'bloque-ayuda no-imprimir', texto: 'Cada trimestre sale del motor único. La nota final es el promedio de los trimestres con nota; en rojo, lo menor a ' + MIN.toFixed(1) + '. Ausencias (A) y tardanzas (T) vienen de la asistencia; la ausencia justificada no cuenta.' }));
    zona.appendChild(el('div', { clase: 'solo-impresion', style: 'text-align:center;font-weight:700' }, [el('div', { texto: 'MINISTERIO DE EDUCACIÓN' }), el('div', { texto: 'NOTAS TRIMESTRALES, AUSENCIAS Y TARDANZAS' })]));
    zona.appendChild(el('p', { texto: 'PLANTEL: C.E.B.G. EL JIRAL · ASIGNATURA: ' + ctx.materia.toUpperCase() + ' · AÑO LEC. ' + ctx.anio + ' · GRUPO ' + ctx.grupo }));
    var cab = ['N°', 'Estudiante'].concat(trims.map(function (t) { return 'T' + t.numero; }), ['Final']);
    trims.forEach(function (t) { cab.push('A T' + t.numero, 'T T' + t.numero); });
    cab.push('A total', 'T total');
    var cuerpo = filas.map(function (f, i) {
      var fin = finalAnual(f), a = 0, t = 0, c = [td(String(i + 1), 'c'), td(nombreEst(f.est))];
      f.tri.forEach(function (x) { c.push(notaTd(x.final)); a += x.aus; t += x.tar; });
      c.push(el('td', { clase: 'c final' + (reprueba(fin) ? ' rojo' : ''), texto: fmt(fin) }));
      f.tri.forEach(function (x) { c.push(td(x.aus ? String(x.aus) : '', 'c'), td(x.tar ? String(x.tar) : '', 'c')); });
      c.push(td(a ? String(a) : '', 'c'), td(t ? String(t) : '', 'c'));
      return el('tr', null, c);
    });
    zona.appendChild(tabla(cab, cuerpo));
    zona.appendChild(el('div', { clase: 'seg-firma' }, [el('div', { texto: 'PROFESOR: ______________________________' }), el('strong', { texto: ctx.firma })]));
    return zona;
  }

  /* ---------- 3) CUADRO DE FRACASO ---------- */
  function vistaFracaso(filas, trims, ctx) {
    var zona = el('div'), res = el('div');
    var selTr = el('select', null, trims.map(function (t, i) { return opcion(String(i), 'Trimestre ' + t.numero, false); }).concat([opcion('f', 'Nota final (promedio de trimestres)', true)]));
    var inMeta = el('input', { type: 'number', min: '0', max: '100', step: '0.5', value: String(META_FRACASO), style: 'width:5rem' });
    function pintar() {
      var meta = Number(inMeta.value) || 0, k = selTr.value;
      var val = function (f) { return k === 'f' ? finalAnual(f) : (f.tri[+k] ? f.tri[+k].final : null); };
      var con = filas.filter(function (f) { return val(f) !== null; });
      var rep = con.filter(function (f) { return reprueba(val(f)); });
      var mat = filas.length, pct = mat ? rep.length / mat * 100 : 0, tope = Math.floor(mat * meta / 100 + 1e-9), faltan = Math.max(0, rep.length - tope), ok = pct <= meta;
      res.textContent = '';
      res.appendChild(kpis([[meta.toFixed(2) + '%', 'meta permitida'], [pct.toFixed(2) + '%', ok ? 'fracaso actual (dentro de meta)' : 'fracaso actual (SOBRE la meta)'], [rep.length + ' / ' + mat, 'reprobados / matrícula'], [faltan || '—', 'faltan por aprobar']]));
      res.appendChild(tabla(['Grupo', 'Matrícula', 'Aprobados', 'Reprobados', 'Sin calif.', '% fracaso', 'Estado', 'Tope', 'Faltan'], [el('tr', null, [
        td(ctx.grupo, 'c'), td(String(mat), 'c'), td(String(con.length - rep.length), 'c'), td(String(rep.length), 'c'), td(String(mat - con.length), 'c'),
        el('td', { clase: 'c final' + (ok ? '' : ' rojo'), texto: pct.toFixed(2) + '%' }), td(ok ? 'Dentro de meta' : 'Sobre la meta', 'c'), td(String(tope), 'c'), td(faltan ? String(faltan) : '—', 'c')])]));
      res.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Reprobados: ' + (rep.map(function (f) { return nombreEst(f.est) + ' (' + fmt(val(f)) + ')'; }).join(' · ') || 'ninguno') + '.' }));
      res.appendChild(el('p', { clase: 'bloque-ayuda', texto: '% de fracaso = reprobados ÷ matrícula total (los «sin calificación» cuentan en la matrícula, no como reprobados). Tope = máximo de reprobados que cabe en la meta. Faltan = reprobados que deben subir a ' + MIN.toFixed(1) + ' para llegar a la meta.' }));
    }
    selTr.addEventListener('change', pintar); inMeta.addEventListener('change', pintar);
    zona.appendChild(el('div', { clase: 'formulario-fila no-imprimir' }, [campo('Periodo', selTr), campo('Meta de fracaso (%)', inMeta), el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Imprimir / guardar PDF', onclick: function () { window.print(); } })]));
    zona.appendChild(res);
    pintar();
    return zona;
  }

  /* ---------- inicio ---------- */
  async function iniciar() {
    if (!db) { errorPantalla(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { errorPantalla(P.traducirError(e)); return; }
    var ok = info && (info.roles.indexOf('profesor') !== -1 || info.roles.indexOf('administrador') !== -1);
    if (!ok) { window.location.replace(P.rutaInicio()); return; }
    db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); } });
    var id = new URLSearchParams(window.location.search).get('asignacion');
    contenido.textContent = '';
    try {
      var asig = id ? await consultar(db.from('portal2027_asignaciones').select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)').eq('id', id).maybeSingle()) : null;
      if (!asig) { errorPantalla('No se encontró esta asignación o no tiene acceso a ella.'); return; }
      var trims = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', asig.salon.anio_id).order('numero'));
      var filas = await cargar(asig, trims);
      var ctx = { materia: asig.materia.nombre, grupo: asig.salon.nombre, anio: asig.salon.anio.anio, firma: P.nombreCompleto(info.perfil) || '[Su nombre]' };

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Seguimiento académico' }), el('h1', { texto: ctx.materia + ' · ' + ctx.grupo }), el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + ctx.anio + ' · ' + filas.length + ' estudiantes' })]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(asig.id), texto: 'Volver a la libreta' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })])
      ]));
      contenido.appendChild(el('p', { clase: 'mensaje info no-imprimir', texto: 'Los datos son los actuales de la libreta (no es una copia de cierre). Aquí no se guarda ni se envía nada.' }));

      var vistas = [['riesgo', 'En riesgo', vistaRiesgo], ['planilla', 'Notas trimestrales', vistaPlanilla], ['fracaso', 'Cuadro de fracaso', vistaFracaso]];
      var barra = el('div', { clase: 'seg-pestanas', role: 'tablist' }), cuerpo = el('div'), hechas = {};
      function mostrar(k) {
        barra.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.k === k)); });
        cuerpo.textContent = '';
        if (!hechas[k]) { hechas[k] = vistas.filter(function (v) { return v[0] === k; })[0][2](filas, trims, ctx); }
        cuerpo.appendChild(hechas[k]);
      }
      vistas.forEach(function (v) { barra.appendChild(el('button', { type: 'button', role: 'tab', 'data-k': v[0], texto: v[1], onclick: function () { mostrar(v[0]); } })); });
      contenido.appendChild(barra); contenido.appendChild(cuerpo);
      mostrar('riesgo');
    } catch (e) { errorPantalla('No se pudo abrir el seguimiento. ' + P.traducirError(e)); }
  }
  iniciar();
})();
