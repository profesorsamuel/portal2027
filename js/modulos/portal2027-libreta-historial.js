/* portal2027-libreta-historial.js — papelera, consulta y recuperación de notas.
   Conserva las RPC y validaciones existentes. Cargar antes de la libreta. */
(function () {
  'use strict';
  var P = window.portal2027;
  function crear(contexto) {
    var S = contexto.estado;
    var M = contexto.evaluacion;
    var el = contexto.el;
    var aPapelera = contexto.aPapelera;
    var conDialogo = contexto.conDialogo;
    var aviso = contexto.aviso;
    var db = contexto.db;
    var clave = contexto.clave;
    var cargarLibreta = contexto.cargarLibreta;
    var dibujar = contexto.dibujar;
    var textoError = contexto.textoError;
    var consultar = contexto.consultar;
    var evalPorId = contexto.evalPorId;
    var nombreEst = contexto.nombreEst;

  function dibujarPapelera() {
    var lista = S.evals.filter(function (e) { return e.eliminada_en; });
    var sec = el('section', { clase: 'bloque' }, [el('h3', { texto: 'Papelera (' + lista.length + ')' })]);
    if (lista.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'La papelera está vacía.' })); return sec; }
    sec.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Categoría', 'Tema', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, lista.map(function (e) {
        return el('tr', null, [el('td', { texto: M.ETIQUETAS[e.categoria] }), el('td', { texto: e.tema || '(sin tema)' }),
          el('td', null, [el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', disabled: S.cerrado, texto: 'Restaurar', onclick: function () { aPapelera(e, false); } })])]);
      }))
    ])]));
    return sec;
  }

  /* Recuperar una nota: devuelve la celda al valor que tenía ANTES del cambio elegido.
     Usa portal2027_recuperar_nota (guardado común): la base valida permisos, columna bloqueada o en papelera,
     trimestre cerrado y versión, y deja una fila nueva en el historial (el historial anterior no se toca). */
  function botonRecuperar(x, ev, contenedor) {
    var actual = S.notas[clave(x.evaluacion_id, x.matricula_id)];
    var motivoNoPosible = S.cerrado ? 'El trimestre está cerrado.'
      : (!ev ? 'La columna ya no está disponible.'
        : (ev.eliminada_en ? 'La columna está en la papelera.'
          : (ev.bloqueada ? 'La columna está bloqueada.'
            : (!actual ? 'La nota ya no existe.' : ''))));
    var b = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recuperar', disabled: !!motivoNoPosible,
      title: motivoNoPosible || 'Volver al valor anterior a este cambio' });
    b.addEventListener('click', async function () {
      return conDialogo('recuperar|' + x.id, async function () {
        var antes = x.valor_anterior === null ? '(vacía)' : String(Number(x.valor_anterior));
        var motivo = await P.pedirTexto('Recuperar nota del historial', 'La nota volverá a ' + antes + '. Escriba el motivo de la recuperación:', '');
        if (motivo === null) { return; }
        if (!motivo.trim()) { aviso('No se guardó. Escriba el motivo de la recuperación.', 'error'); return; }
        await recuperar(x, actual.version, motivo.trim());
      });
    });
    return b;
  }

  async function recuperar(x, version, motivo) {
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc('portal2027_recuperar_nota', { p_historial: x.id, p_version: version, p_motivo: motivo });
      if (r.error) { throw r.error; }
      await cargarLibreta();
      S.abrirHistorial = true;
      dibujar();
      aviso('Nota recuperada. El cambio quedó anotado en el historial.', 'ok');
    } catch (e) {
      aviso('No se recuperó la nota. ' + textoError(e), 'error');
    }
  }

  async function dibujarHistorial(contenedor) {
    contenedor.textContent = '';
    contenedor.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando historial…' }));
    try {
      var h = await consultar(db.from('portal2027_historial_notas')
        .select('id,matricula_id,evaluacion_id,valor_anterior,valor_nuevo,version,motivo,creado_en,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id)')
        .eq('evaluacion.asignacion_id', S.asig.id).eq('evaluacion.trimestre_id', S.trimestreId)
        .order('creado_en', { ascending: false }).limit(100));
      contenedor.textContent = '';
      if (h.length === 0) { contenedor.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay cambios de notas en este trimestre.' })); return; }
      var porMat = {};
      S.mats.forEach(function (m) { porMat[m.id] = m; });
      contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Últimos ' + h.length + ' cambios (máximo 100).' }));
      contenedor.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Fecha', 'Estudiante', 'Columna', 'Antes', 'Ahora', 'Versión', 'Motivo', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
        el('tbody', null, h.map(function (x) {
          var e = evalPorId(x.evaluacion_id), m = porMat[x.matricula_id];
          return el('tr', null, [
            el('td', { texto: new Date(x.creado_en).toLocaleString('es-PA') }),
            el('td', { texto: m ? nombreEst(m.estudiante) : '' }),
            el('td', { texto: e ? M.ETIQUETAS[e.categoria] + (e.tema ? ': ' + e.tema : '') : '' }),
            el('td', { texto: x.valor_anterior === null ? '—' : String(Number(x.valor_anterior)) }),
            el('td', { texto: x.valor_nuevo === null ? '(vacía)' : String(Number(x.valor_nuevo)) }),
            el('td', { texto: String(x.version) }), el('td', { texto: x.motivo || '' }),
            el('td', null, [botonRecuperar(x, e, contenedor)])
          ]);
        }))
      ])]));
    } catch (e) {
      contenedor.textContent = '';
      contenedor.appendChild(el('p', { clase: 'mensaje error', texto: 'No se pudo cargar el historial. ' + textoError(e) }));
    }
  }

    return Object.freeze({ dibujarPapelera: dibujarPapelera, dibujarHistorial: dibujarHistorial });
  }
  P.libretaHistorial = Object.freeze({ crear: crear });
})();
