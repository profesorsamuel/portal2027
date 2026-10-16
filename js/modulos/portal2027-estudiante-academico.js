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

  // Solo se muestran las dos notas semanales: Apreciación y Ejercicio escrito.
  var VISIBLES = ['apreciacion', 'ejercicio_escrito'];
  var NOTA_MINIMA = 3; // por debajo se resalta en rojo suave para que sea fácil de ver

  function celdaNota(valor) {
    if (valor === undefined || valor === null) { return el('span', { clase: 'nota-valor nota-vacia', texto: 'Sin nota' }); }
    return el('span', { clase: 'nota-valor' + (valor < NOTA_MINIMA ? ' nota-baja' : ''), texto: M.formatear(valor) });
  }

  // Un grupo (Apreciación o Ejercicio escrito): tabla «qué es · tema · nota» y su promedio.
  function grupoNotas(titulo, colQue, filas, promedioTexto) {
    var cab = [el('h4', null, [titulo, promedioTexto ? el('span', { clase: 'promedio-grupo', texto: 'Promedio: ' + promedioTexto }) : null])];
    if (filas.length === 0) {
      cab.push(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay notas de ' + titulo.toLowerCase() + ' en esta materia.' }));
      return el('div', { clase: 'grupo-notas' }, cab);
    }
    cab.push(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-notas' }, [
      el('thead', null, [el('tr', null, [el('th', { scope: 'col', texto: colQue }), el('th', { scope: 'col', texto: 'Tema' }), el('th', { scope: 'col', clase: 'col-nota', texto: 'Nota' })])]),
      el('tbody', null, filas)
    ])]));
    return el('div', { clase: 'grupo-notas' }, cab);
  }

  function dibujarNotas(cont, datos) {
    cont.textContent = '';
    if (datos.materias.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay materias asignadas a su grupo en este trimestre.' })); return; }
    datos.materias.forEach(function (m) {
      var bloque = el('div', { clase: 'materia-notas' }, [el('h3', { texto: m.materia })]);
      if (!m.publicada) {
        bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'El profesor aún no ha publicado las notas de esta materia en este trimestre.' }));
        cont.appendChild(bloque);
        return;
      }
      var evals = m.evaluaciones.filter(function (e) { return VISIBLES.indexOf(e.categoria) !== -1; });
      if (evals.length === 0) {
        bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay notas de apreciación ni de ejercicio escrito en esta materia.' }));
        cont.appendChild(bloque);
        return;
      }
      // La libreta del estudiante presenta una sola fila por semana.
      // Las tareas se consultan en «Mis clases y tareas» y no se duplican aquí.
      // Se filtran por categoría y nombre, sin borrar ni alterar notas en Supabase.
      evals = evals.filter(function (e) {
        if (e.categoria !== 'apreciacion') { return true; }
        var tema = String(e.tema || '').trim();
        var tipo = String(e.tipo || '').trim();
        return !(/^tarea\b/i.test(tipo) || /(?:^|[·:.-]\s*)tarea\s*\d+\b/i.test(tema));
      });
      var notas = {};
      evals.forEach(function (e) { if (M.esNota(e.valor)) { notas[e.id] = Number(e.valor); } });
      var r = M.calcular(evals, notas);

      // Apreciación: de qué se trata cada nota (ejercicio virtual, laboratorio…) y su tema.
      var filasApre = evals.filter(function (e) { return e.categoria === 'apreciacion'; }).map(function (e) {
        return el('tr', null, [
          el('td', null, [el('span', { clase: 'etiqueta-tipo', texto: e.tipo || M.ETIQUETAS.apreciacion })]),
          el('td', { clase: 'nota-tema', texto: e.tema || '—' }),
          el('td', { clase: 'col-nota' }, [celdaNota(notas[e.id])])
        ]);
      });
      // Ejercicio escrito: «Ejercicio 1», «Ejercicio 2»… en el orden que puso el profesor, con su tema.
      var n = 0;
      var filasEsc = evals.filter(function (e) { return e.categoria === 'ejercicio_escrito'; }).map(function (e) {
        n++;
        return el('tr', null, [
          el('td', { clase: 'nota-que', texto: 'Ejercicio ' + n }),
          el('td', { clase: 'nota-tema', texto: e.tema || '—' }),
          el('td', { clase: 'col-nota' }, [celdaNota(notas[e.id])])
        ]);
      });
      bloque.appendChild(grupoNotas('Apreciación', 'Qué es', filasApre, r.categorias.apreciacion.texto));
      bloque.appendChild(grupoNotas('Ejercicio escrito', 'Ejercicio', filasEsc, r.categorias.ejercicio_escrito.texto));

      // Promedio final: solo aparece cuando ya hay al menos una nota.
      var conNota = r.final !== null;
      bloque.appendChild(el('div', { clase: 'promedio-final' + (conNota ? '' : ' sin-nota') }, [
        el('span', { clase: 'pf-texto' }, ['Promedio final de ' + m.materia,
          el('span', { clase: 'pf-ayuda', texto: conNota ? 'Promedio entre apreciación y ejercicio escrito' : 'Todavía no hay notas para calcularlo' })]),
        el('span', { clase: 'pf-numero', texto: conNota ? r.textoFinal : 'Sin promedio' })
      ]));
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

  P.renderEstudianteAcademico = async function (zona, info) {
    var sec = el('section', { clase: 'bloque reporte-imprimible' }, [el('h2', { texto: 'Mis notas y asistencia' })]);
    var cabImpresion = el('p', { clase: 'solo-impresion' });
    zona.appendChild(sec);
    if(P.renderConsejeriaEstudianteExtra)P.renderConsejeriaEstudianteExtra(zona);

    var mats = await consultar(db.from('portal2027_matriculas').select('anio_id,anio:portal2027_anios(anio)'));
    mats = mats.filter(function (m) { return m.anio; }).sort(function (a, b) { return b.anio.anio - a.anio.anio; });
    if (mats.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no tiene una matrícula registrada.' })); return; }
    var trims = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', mats[0].anio_id).order('numero'));
    if (trims.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este año no tiene trimestres.' })); return; }
    var estados = await consultar(db.from('portal2027_estados_asistencia').select('codigo,etiqueta,abreviatura'));

    var sel = el('select', { 'aria-label': 'Trimestre' }, trims.map(function (t) { return el('option', { value: t.id, texto: 'Trimestre ' + t.numero }); }));
    var msg = el('p', { clase: 'mensaje error', role: 'alert', hidden: true });
    var zNotas = el('div'), zAsis = el('div');
    // Etapa 7B: «Ver mis notas» como reporte imprimible (PDF desde el navegador). Es informativo: sin promedio anual ni honor.
    var btnImp = el('button', { clase: 'boton boton-secundario boton-chico no-imprimir', type: 'button', texto: 'Imprimir o guardar mi reporte (PDF)', onclick: function () {
      var nombre = P.nombreCompleto(info && info.perfil) || 'Estudiante';
      var archivo = 'Notas_' + nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + sel.options[sel.selectedIndex].text.replace(/\s+/g, '_') + '_' + new Date().toLocaleDateString('en-CA').replace(/\//g, '-');
      document.title = archivo;
      document.body.classList.add('solo-reporte');
      window.print();
    } });
    var tituloOriginal = document.title;
    window.addEventListener('afterprint', function () { document.body.classList.remove('solo-reporte'); document.title = tituloOriginal; });
    sec.appendChild(cabImpresion);
    sec.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Trimestre', sel]), btnImp]));
    sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Reporte informativo de las materias que su profesor ya publicó. Vacío no es cero. No incluye promedio anual ni criterios de honor.' }));
    sec.appendChild(msg);
    sec.appendChild(el('h3', { texto: 'Notas' }));
    sec.appendChild(zNotas);
    sec.appendChild(el('h3', { texto: 'Asistencia' }));
    sec.appendChild(zAsis);

    async function cargar() {
      cabImpresion.textContent = 'C.E.B.G. El Jiral · Reporte de notas de ' + P.nombreCompleto(info && info.perfil) + ' · ' + sel.options[sel.selectedIndex].text + ' · ' + new Date().toLocaleDateString('es-PA');
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
