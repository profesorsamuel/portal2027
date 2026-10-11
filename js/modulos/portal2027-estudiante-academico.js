/* portal2027-estudiante-academico.js — etapa 6: el estudiante ve su asistencia y sus notas (solo lectura).
   Los datos llegan por funciones de la base que solo devuelven lo del propio estudiante; las notas solo
   de materias publicadas por el profesor. Los promedios los calcula el motor único (portal2027.evaluacion). */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var M = P.evaluacion;

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function fechaTexto(f) { var p = String(f).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function tabla(cab, filas) {
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }

  function dibujarNotas(cont, datos) {
    cont.textContent = '';
    if (datos.materias.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay materias asignadas a su grupo en este trimestre.' })); return; }
    datos.materias.forEach(function (m) {
      var bloque = el('div', { clase: 'detalle-ficha' }, [el('h3', { texto: m.materia })]);
      if (!m.publicada) {
        bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'El profesor aún no ha publicado las notas de esta materia en este trimestre.' }));
      } else if (m.evaluaciones.length === 0) {
        bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay evaluaciones en esta materia.' }));
      } else {
        var notas = {};
        m.evaluaciones.forEach(function (e) { if (e.valor !== null && e.valor !== undefined) { notas[e.id] = Number(e.valor); } });
        var r = M.calcular(m.evaluaciones, notas);
        bloque.appendChild(tabla(['Categoría', 'Tema', 'Nota'], m.evaluaciones.map(function (e) {
          return el('tr', null, [el('td', { texto: M.ETIQUETAS[e.categoria] || e.categoria }), el('td', { texto: e.tema || '—' }),
            el('td', { texto: notas[e.id] === undefined ? '—' : String(notas[e.id]) })]);
        })));
        var partes = M.CATEGORIAS.map(function (c) { return M.ETIQUETAS[c] + ': ' + (r.categorias[c].texto || '—'); });
        bloque.appendChild(el('p', { clase: 'bloque-ayuda', texto: partes.join(' · ') + ' · Final: ' + r.textoFinal }));
      }
      cont.appendChild(bloque);
    });
  }

  function dibujarAsistencia(cont, datos, estados) {
    cont.textContent = '';
    var etiquetas = {};
    estados.forEach(function (e) { etiquetas[e.codigo] = e; });
    if (datos.sesiones === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay sesiones registradas en este trimestre.' })); return; }
    var cuenta = {};
    datos.items.forEach(function (i) { cuenta[i.estado] = (cuenta[i.estado] || 0) + 1; });
    var resumen = Object.keys(cuenta).map(function (c) { return (etiquetas[c] ? etiquetas[c].etiqueta : c) + ': ' + cuenta[c]; });
    resumen.push('Sin marcar: ' + Math.max(datos.sesiones - datos.items.length, 0));
    cont.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Sesiones del trimestre: ' + datos.sesiones + '. ' + resumen.join(' · ') + '.' }));
    if (datos.items.length === 0) { return; }
    cont.appendChild(tabla(['Fecha', 'Materia', 'Bloque', 'Asistencia'], datos.items.slice(0, 100).map(function (i) {
      return el('tr', null, [el('td', { texto: fechaTexto(i.fecha) }), el('td', { texto: i.materia }), el('td', { texto: String(i.bloque) }),
        el('td', { texto: etiquetas[i.estado] ? etiquetas[i.estado].etiqueta : i.estado })]);
    })));
    if (datos.items.length > 100) { cont.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Se muestran las 100 sesiones más recientes.' })); }
  }

  P.renderEstudianteAcademico = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis notas y asistencia' })]);
    zona.appendChild(sec);

    var mats = await consultar(db.from('portal2027_matriculas').select('anio_id,anio:portal2027_anios(anio)'));
    mats = mats.filter(function (m) { return m.anio; }).sort(function (a, b) { return b.anio.anio - a.anio.anio; });
    if (mats.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no tiene una matrícula registrada.' })); return; }
    var trims = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', mats[0].anio_id).order('numero'));
    if (trims.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este año no tiene trimestres.' })); return; }
    var estados = await consultar(db.from('portal2027_estados_asistencia').select('codigo,etiqueta,abreviatura'));

    var sel = el('select', { 'aria-label': 'Trimestre' }, trims.map(function (t) { return el('option', { value: t.id, texto: 'Trimestre ' + t.numero }); }));
    var msg = el('p', { clase: 'mensaje error', role: 'alert', hidden: true });
    var zNotas = el('div'), zAsis = el('div');
    sec.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Trimestre', sel])]));
    sec.appendChild(msg);
    sec.appendChild(el('h3', { texto: 'Notas' }));
    sec.appendChild(zNotas);
    sec.appendChild(el('h3', { texto: 'Asistencia' }));
    sec.appendChild(zAsis);

    async function cargar() {
      msg.hidden = true;
      zNotas.textContent = ''; zAsis.textContent = '';
      zNotas.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
      try {
        var r = await Promise.all([db.rpc('portal2027_mis_notas', { p_trimestre: sel.value }), db.rpc('portal2027_mi_asistencia', { p_trimestre: sel.value })]);
        if (r[0].error) { throw r[0].error; }
        if (r[1].error) { throw r[1].error; }
        dibujarNotas(zNotas, r[0].data);
        dibujarAsistencia(zAsis, r[1].data, estados);
      } catch (e) {
        zNotas.textContent = '';
        msg.textContent = 'No se pudo cargar. ' + P.traducirError(e);
        msg.hidden = false;
      }
    }
    sel.addEventListener('change', cargar);
    await cargar();
  };
})();
