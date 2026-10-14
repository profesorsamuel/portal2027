/* portal2027-consejeria.js — etapa 5 y 7B: consejería.
   Administración: asigna consejeros a grupos. Consejero: ve su grupo en SOLO LECTURA (fichas, conteo de asistencia
   por estado y, desde la etapa 7B, las notas de las materias que el profesor ya PUBLICÓ). Los promedios los calcula
   el motor único (portal2027.evaluacion). Los avisos a acudientes son borradores: no se envía nada. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var M = P.evaluacion;

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function nombreEst(e) { return ((e.apellidos || '') + ', ' + (e.nombres || '')).replace(/^, |, $/g, ''); }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^(No tiene permiso|La persona asignada)/.test(m)) { return m.replace(/\s*\(row-level security\)/, ''); }
    if (/duplicate key/i.test(m)) { return 'Ese consejero ya está asignado a ese grupo.'; }
    return P.traducirError(e);
  }
  function tabla(cab, filas, vacio) {
    if (filas.length === 0) { return el('p', { clase: 'vacio-texto', texto: vacio }); }
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }

  /* ---------- Administración: consejeros por grupo ---------- */
  P.renderConsejeriaAdmin = async function (zona) {
    var barra = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });
    var cont = el('section', { clase: 'bloque' });
    zona.appendChild(barra);
    zona.appendChild(cont);
    function aviso(t, tipo) { barra.textContent = t; barra.className = 'mensaje estado-panel ' + (tipo || 'info'); barra.hidden = !t; }

    async function dibujar() {
      var r = await Promise.all([
        consultar(db.from('portal2027_consejeros_salon').select('salon_id,consejero_id,salon:portal2027_salones(nombre,anio:portal2027_anios(anio)),consejero:portal2027_perfiles(nombres,apellidos,correo)')),
        consultar(db.from('portal2027_salones').select('id,nombre,anio:portal2027_anios(anio)').order('nombre')),
        consultar(db.from('portal2027_roles_usuario').select('usuario_id').eq('rol', 'consejero')),
        consultar(db.from('portal2027_perfiles').select('id,nombres,apellidos,correo,activo').order('apellidos').order('correo'))
      ]);
      var asign = r[0], salones = r[1];
      var ids = {};
      r[2].forEach(function (x) { ids[x.usuario_id] = true; });
      var consejeros = r[3].filter(function (p) { return ids[p.id] && p.activo !== false; });

      var filas = asign.map(function (a) {
        var quitando = false;
        return el('tr', null, [
          el('td', { texto: a.salon ? a.salon.nombre + (a.salon.anio ? ' (' + a.salon.anio.anio + ')' : '') : '' }),
          el('td', { texto: P.nombreCompleto(a.consejero) }),
          el('td', null, [el('button', { clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Quitar', onclick: async function (ev) {
            if (quitando) { return; }
            quitando = true;
            var botonQuitar = ev.currentTarget;
            try {
              if (!(await P.confirmar('Quitar consejero', '¿Quitar este consejero del grupo?', 'Quitar consejero'))) { return; }
              botonQuitar.disabled = true;
              aviso('Guardando…', 'info');
              var d = await db.from('portal2027_consejeros_salon').delete().eq('salon_id', a.salon_id).eq('consejero_id', a.consejero_id);
              if (d.error) { throw d.error; }
              await dibujar(); aviso('Consejero quitado del grupo.', 'ok');
            } catch (e) { aviso('No se guardó. ' + textoError(e), 'error'); }
            finally { quitando = false; botonQuitar.disabled = false; }
          } })])
        ]);
      });

      var selSalon = el('select', { 'aria-label': 'Grupo' }, [el('option', { value: '', texto: 'Elija el grupo' })].concat(salones.map(function (s) {
        return el('option', { value: s.id, texto: s.nombre + (s.anio ? ' (' + s.anio.anio + ')' : '') });
      })));
      var selCons = el('select', { 'aria-label': 'Consejero' }, [el('option', { value: '', texto: 'Elija el consejero' })].concat(consejeros.map(function (p) {
        return el('option', { value: p.id, texto: P.nombreCompleto(p) });
      })));
      var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
        el('label', null, ['Grupo', selSalon]), el('label', null, ['Consejero', selCons]),
        el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Asignar consejero' })
      ]);
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        if (!selSalon.value || !selCons.value) { aviso('Elija el grupo y el consejero.', 'error'); return; }
        aviso('Guardando…', 'info');
        try {
          var i = await db.from('portal2027_consejeros_salon').insert({ salon_id: selSalon.value, consejero_id: selCons.value });
          if (i.error) { throw i.error; }
          await dibujar(); aviso('Consejero asignado.', 'ok');
        } catch (e) { aviso('No se guardó. ' + textoError(e), 'error'); }
      });

      cont.textContent = '';
      cont.appendChild(el('h2', { texto: 'Consejeros por grupo' }));
      cont.appendChild(tabla(['Grupo', 'Consejero', ''], filas, 'Todavía no hay consejeros asignados.'));
      if (consejeros.length === 0) {
        cont.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Para asignar, primero marque el rol Consejero a alguien en «Personas y roles».' }));
      }
      cont.appendChild(form);
    }
    await dibujar();
  };

  /* ---------- Consejero: su grupo en solo lectura ---------- */
  P.renderConsejeria = async function (zona, info) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mi grupo' })]);
    zona.appendChild(sec);
    var asign = await consultar(db.from('portal2027_consejeros_salon')
      .select('salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio))').eq('consejero_id', info.sesion.user.id));
    var grupos = asign.map(function (a) { return a.salon; }).filter(Boolean).sort(function (a, b) { return b.anio.anio - a.anio.anio || a.nombre.localeCompare(b.nombre); });
    if (grupos.length === 0) {
      sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Aún no tiene un grupo asignado. Pida a la administración que se lo asigne.' }));
      return;
    }

    var S = { grupo: grupos[0], trimestres: [], trimestreId: null };
    var selGrupo = el('select', { 'aria-label': 'Grupo' }, grupos.map(function (g) { return el('option', { value: g.id, texto: g.nombre + ' (' + g.anio.anio + ')' }); }));
    var selTrim = el('select', { 'aria-label': 'Trimestre' });
    var estado = el('p', { clase: 'mensaje', hidden: true });
    var zonaTabla = el('div');
    var zonaNotas = el('div');
    sec.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Grupo', selGrupo]), el('label', null, ['Trimestre', selTrim])]));
    sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Solo lectura. La asistencia es el conteo de todas las materias del grupo; una casilla sin marcar no cuenta como ausencia. Las notas aparecen solo de las materias que el profesor ya publicó.' }));
    sec.appendChild(estado);
    sec.appendChild(zonaTabla);
    sec.appendChild(zonaNotas);

    function error(t) { estado.textContent = t; estado.className = 'mensaje error'; estado.hidden = !t; }

    async function cargarTrimestres() {
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', S.grupo.anio_id).order('numero'));
      S.trimestreId = S.trimestres[0] ? S.trimestres[0].id : null;
      selTrim.textContent = '';
      S.trimestres.forEach(function (t) { selTrim.appendChild(el('option', { value: t.id, texto: 'Trimestre ' + t.numero })); });
    }

    function trimestreNumero() { var t = S.trimestres.filter(function (x) { return x.id === S.trimestreId; })[0]; return t ? t.numero : ''; }

    async function cargarNotas(mats, conteos, resumen, estados) {
      zonaNotas.textContent = '';
      zonaNotas.appendChild(el('h3', { texto: 'Notas del grupo (solo materias publicadas)' }));
      var d;
      try {
        var rn = await db.rpc('portal2027_notas_salon', { p_salon: S.grupo.id, p_trimestre: S.trimestreId });
        if (rn.error) { throw rn.error; }
        d = rn.data;
      } catch (e) {
        zonaNotas.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: 'No se pudieron cargar las notas. ' + textoError(e) }));
        return;
      }
      if (d.materias.length === 0) { zonaNotas.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este grupo no tiene materias asignadas.' })); return; }

      // Resultado por estudiante y materia (motor único). finales[matId] = [{materia, texto}]
      var finales = {}, sinPublicar = [];
      mats.forEach(function (m) { finales[m.id] = []; });
      d.materias.forEach(function (mt) {
        var bloque = el('div', { clase: 'detalle-ficha' }, [el('h4', { texto: mt.materia + (mt.cerrado ? ' · trimestre cerrado' : '') })]);
        zonaNotas.appendChild(bloque);
        if (!mt.publicada) { sinPublicar.push(mt.materia); bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'El profesor aún no ha publicado las notas de esta materia en este trimestre.' })); return; }
        if (mt.evaluaciones.length === 0) { bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay evaluaciones en esta materia.' })); return; }
        var porMat = {};
        mt.notas.forEach(function (n) { (porMat[n.matricula_id] = porMat[n.matricula_id] || {})[n.evaluacion_id] = Number(n.valor); });
        var filas = mats.map(function (m) {
          var r = M.calcular(mt.evaluaciones, porMat[m.id] || {});
          finales[m.id].push({ materia: mt.materia, texto: r.textoFinal });
          var celdas = [el('td', { texto: nombreEst(m.estudiante) })];
          M.CATEGORIAS.forEach(function (c) { celdas.push(el('td', { clase: 'centro', texto: r.categorias[c].texto || '—' })); });
          celdas.push(el('td', { clase: 'centro', texto: r.textoFinal }));
          return el('tr', null, celdas);
        });
        bloque.appendChild(tabla(['Estudiante'].concat(M.CATEGORIAS.map(function (c) { return M.ETIQUETAS[c]; }), ['Final']), filas, 'Sin estudiantes.'));
      });
      zonaNotas.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Solo lectura. Vacío no es cero: sin notas no hay promedio. No se muestra promedio anual ni criterios de honor.' }));

      // Avisos en borrador (no se envía nada)
      var zonaAv = el('div');
      zonaNotas.appendChild(el('h3', { texto: 'Avisos a acudientes (borradores)' }));
      zonaNotas.appendChild(zonaAv);
      var firma = P.nombreCompleto(info.perfil) || '[Su nombre]';
      var items = mats.map(function (m) {
        var c = conteos[m.id] || {}, marcadas = 0, partes = [];
        estados.forEach(function (e) { var n = c[e.codigo] || 0; marcadas += n; if (n) { partes.push(e.etiqueta + ' ' + n); } });
        var sin = Math.max(resumen.sesiones - marcadas, 0);
        var lineas = finales[m.id].map(function (f) { return '- ' + f.materia + ': ' + f.texto; });
        var nombre = ((m.estudiante.nombres || '') + ' ' + (m.estudiante.apellidos || '')).trim();
        return { titulo: nombreEst(m.estudiante), texto:
          'Estimado(a) acudiente de ' + nombre + ':\n\nResumen del trimestre ' + trimestreNumero() + ' (' + S.grupo.nombre + ') con las materias cuyas notas ya publicaron los profesores:\n' +
          (lineas.length ? lineas.join('\n') : '- (todavía no hay notas publicadas)') +
          (sinPublicar.length ? '\nMaterias sin publicar todavía: ' + sinPublicar.join(', ') + '.' : '') +
          '\n\nAsistencia registrada (todas las materias): ' + (partes.length ? partes.join(', ') : 'sin marcas registradas') + (sin ? ' (sin marcar: ' + sin + ')' : '') +
          '.\n\nEste resumen es informativo; no incluye promedio anual.\n\nAtentamente,\n' + firma };
      });
      P.avisos.dibujar(zonaAv, items);
    }

    async function cargarGrupo() {
      zonaTabla.textContent = '';
      zonaNotas.textContent = '';
      error('');
      if (!S.trimestreId) { zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este año no tiene trimestres.' })); return; }
      zonaTabla.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
      try {
        var r = await Promise.all([
          consultar(db.from('portal2027_matriculas')
            .select('id,estado,estudiante:portal2027_estudiantes(codigo,nombres,apellidos,nombre_acudiente,telefono_acudiente)')
            .eq('salon_id', S.grupo.id).eq('anio_id', S.grupo.anio_id)),
          consultar(db.from('portal2027_estados_asistencia').select('codigo,etiqueta,abreviatura,orden,activo').order('orden').order('codigo')),
          db.rpc('portal2027_resumen_asistencia_salon', { p_salon: S.grupo.id, p_trimestre: S.trimestreId })
        ]);
        if (r[2].error) { throw r[2].error; }
        var resumen = r[2].data, mats = r[0].filter(function (m) { return m.estudiante; });
        mats.sort(function (a, b) { return a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es') || a.estudiante.nombres.localeCompare(b.estudiante.nombres, 'es'); });
        var conteos = {}, usados = {};
        resumen.filas.forEach(function (f) { conteos[f.matricula_id] = f.conteos; Object.keys(f.conteos).forEach(function (c) { usados[c] = true; }); });
        var estados = r[1].filter(function (e) { return e.activo || usados[e.codigo]; });

        var filas = mats.map(function (m) {
          var c = conteos[m.id] || {}, marcadas = 0;
          Object.keys(c).forEach(function (k) { marcadas += c[k]; });
          var celdas = [
            el('td', null, [nombreEst(m.estudiante), m.estado && m.estado !== 'activo' ? el('small', { texto: ' (' + m.estado + ')' }) : null]),
            el('td', { texto: m.estudiante.codigo }),
            el('td', { texto: m.estudiante.nombre_acudiente || '—' }),
            el('td', { texto: m.estudiante.telefono_acudiente || '—' })
          ];
          estados.forEach(function (e) { celdas.push(el('td', { clase: 'centro', texto: String(c[e.codigo] || 0) })); });
          celdas.push(el('td', { clase: 'centro', texto: String(Math.max(resumen.sesiones - marcadas, 0)) }));
          return el('tr', null, celdas);
        });
        zonaTabla.textContent = '';
        zonaTabla.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Sesiones registradas en el trimestre (todas las materias): ' + resumen.sesiones + '. Estudiantes: ' + mats.length + '.' }));
        zonaTabla.appendChild(tabla(['Estudiante', 'Código', 'Acudiente', 'Teléfono'].concat(estados.map(function (e) { return e.abreviatura; })).concat(['Sin marcar']), filas,
          'Este grupo todavía no tiene estudiantes matriculados en el año.'));
        if (estados.length) {
          zonaTabla.appendChild(el('p', { clase: 'bloque-ayuda', texto: estados.map(function (e) { return e.abreviatura + ' = ' + e.etiqueta; }).join(' · ') }));
        }
        await cargarNotas(mats, conteos, resumen, estados);
      } catch (e) {
        zonaTabla.textContent = '';
        error('No se pudo cargar el grupo. ' + textoError(e));
      }
    }

    selGrupo.addEventListener('change', async function () {
      S.grupo = grupos.filter(function (g) { return g.id === selGrupo.value; })[0];
      await cargarTrimestres(); await cargarGrupo();
    });
    selTrim.addEventListener('change', function () { S.trimestreId = selTrim.value; cargarGrupo(); });
    await cargarTrimestres();
    await cargarGrupo();
  };
})();
