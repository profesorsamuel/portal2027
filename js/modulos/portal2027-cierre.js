/* portal2027-cierre.js — etapa 7, parte B: panel de cierre trimestral dentro de la libreta.
   Usa las funciones de la parte A (0012): revisión previa, cerrar (copia versionada) y reabrir (solo administración, con motivo).
   La base es quien bloquea los cambios; aquí solo se muestra el estado real y el resultado de cada acción. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function fecha(t) { return new Date(t).toLocaleString('es-PA'); }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^(No tiene permiso|Debe confirmar|El trimestre|Escriba el motivo)/.test(m)) { return m.replace(/\s*\(row-level security\)/, ''); }
    return P.traducirError(e);
  }
  function tabla(cab, filas) {
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }

  // ctx: { asignacionId, trimestreId, trimestreNumero, cerrado, esAdmin, alCambiar(mensaje, tipo) }
  async function dibujar(cont, ctx) {
    cont.textContent = '';
    var sec = el('section', { clase: 'bloque cierre-panel' }, [el('h3', { texto: 'Cierre del trimestre ' + ctx.trimestreNumero })]);
    cont.appendChild(sec);
    var barra = el('p', { clase: 'mensaje', role: 'status', 'aria-live': 'polite', hidden: true });
    var zonaRev = el('div');
    function aviso(t, tipo) { barra.textContent = t; barra.className = 'mensaje ' + (tipo || 'info'); barra.hidden = !t; }
    var urlReporte = P.raiz + 'pages/portal2027-reporte.html?asignacion=' + encodeURIComponent(ctx.asignacionId) + '&trimestre=' + encodeURIComponent(ctx.trimestreId);

    var versiones = [], hist = [];
    try {
      var r = await Promise.all([
        consultar(db.from('portal2027_resultados_cierre').select('version,creado_en').eq('asignacion_id', ctx.asignacionId).eq('trimestre_id', ctx.trimestreId).order('version', { ascending: false })),
        consultar(db.from('portal2027_historial_cierres').select('accion,motivo,version_resultado,creado_en').eq('asignacion_id', ctx.asignacionId).eq('trimestre_id', ctx.trimestreId).order('creado_en', { ascending: false }).limit(50))
      ]);
      versiones = r[0]; hist = r[1];
    } catch (e) {
      sec.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: 'No se pudo cargar el cierre. ' + textoError(e) }));
      return;
    }

    if (ctx.cerrado) {
      sec.appendChild(el('p', { clase: 'mensaje ok', texto: 'Trimestre CERRADO. No se pueden cambiar columnas, notas ni asistencia. Publicar notas y revisar entregas sin nota siguen permitidos.' }));
    } else {
      sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Trimestre abierto. Al cerrarlo se guarda una copia (columnas, estudiantes, notas y conteo de asistencia) y la base bloquea los cambios. Nada se borra y los demás trimestres no se tocan.' }));
    }
    sec.appendChild(barra);

    var acciones = el('div', { clase: 'cabecera-acciones' }, [
      el('a', { clase: 'boton boton-secundario boton-chico', href: urlReporte, texto: 'Ver reporte del trimestre' })
    ]);
    sec.appendChild(acciones);

    if (!ctx.cerrado) {
      var btnRev = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Revisar antes de cerrar' });
      btnRev.addEventListener('click', async function () {
        zonaRev.textContent = '';
        aviso('Revisando…', 'info');
        try {
          var rv = await db.rpc('portal2027_revision_cierre', { p_asignacion: ctx.asignacionId, p_trimestre: ctx.trimestreId });
          if (rv.error) { throw rv.error; }
          aviso('', 'info');
          dibujarRevision(zonaRev, rv.data, ctx, aviso);
        } catch (e) { aviso('No se pudo hacer la revisión. ' + textoError(e), 'error'); }
      });
      acciones.insertBefore(btnRev, acciones.firstChild);
      sec.appendChild(zonaRev);
    } else if (ctx.esAdmin) {
      var motivo = el('input', { type: 'text', maxlength: '300', placeholder: 'Motivo de la reapertura (obligatorio)', 'aria-label': 'Motivo de la reapertura' });
      var reaperturaPendiente = false;
      var btnReab = el('button', { clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Reabrir trimestre', onclick: async function () {
        if (reaperturaPendiente) { return; }
        if (motivo.value.trim() === '') { aviso('Escriba el motivo de la reapertura.', 'error'); return; }
        reaperturaPendiente = true;
        try {
          if (!(await P.confirmar('Reabrir trimestre', '¿Reabrir este trimestre? Quedará registrado quién, cuándo y por qué. Al cerrarlo de nuevo se guardará una copia nueva (la anterior se conserva).', 'Reabrir trimestre'))) { return; }
          btnReab.disabled = true;
          aviso('Reabriendo…', 'info');
          var rr = await db.rpc('portal2027_reabrir_trimestre', { p_asignacion: ctx.asignacionId, p_trimestre: ctx.trimestreId, p_motivo: motivo.value });
          if (rr.error) { throw rr.error; }
          ctx.alCambiar('Trimestre reabierto. Quedó registrado en el historial.', 'ok');
        } catch (e) { aviso('NO se reabrió. ' + textoError(e), 'error'); }
        finally { reaperturaPendiente = false; btnReab.disabled = false; }
      } });
      sec.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Reapertura (solo administración)', motivo]), btnReab]));
    } else {
      sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Solo la administración puede reabrir un trimestre cerrado, y debe escribir el motivo.' }));
    }

    sec.appendChild(el('h4', { texto: 'Copias guardadas' }));
    if (versiones.length === 0) {
      sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay copias de cierre en este trimestre.' }));
    } else {
      sec.appendChild(tabla(['Versión', 'Fecha', ''], versiones.map(function (v) {
        return el('tr', null, [el('td', { texto: String(v.version) }), el('td', { texto: fecha(v.creado_en) }),
          el('td', null, [el('a', { clase: 'boton boton-secundario boton-chico', href: urlReporte + '&version=' + v.version, texto: 'Ver reporte de esta copia' })])]);
      })));
    }
    sec.appendChild(el('h4', { texto: 'Historial de cierres y reaperturas' }));
    if (hist.length === 0) {
      sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Sin movimientos todavía.' }));
    } else {
      sec.appendChild(tabla(['Fecha', 'Acción', 'Copia', 'Motivo'], hist.map(function (h) {
        return el('tr', null, [el('td', { texto: fecha(h.creado_en) }), el('td', { texto: h.accion === 'cerrar' ? 'Cierre' : 'Reapertura' }),
          el('td', { texto: h.version_resultado ? 'Versión ' + h.version_resultado : '—' }), el('td', { texto: h.motivo || '' })]);
      })));
    }
  }

  function dibujarRevision(zona, d, ctx, aviso) {
    zona.textContent = '';
    var pend = (d.por_evaluacion || []).filter(function (x) { return x.sin_nota > 0; });
    zona.appendChild(el('div', { clase: 'detalle-ficha' }, [
      el('h4', { texto: 'Revisión previa (solo informa; no impide cerrar)' }),
      el('ul', null, [
        el('li', { texto: 'Estudiantes del grupo: ' + d.estudiantes }),
        el('li', { texto: 'Columnas de evaluación: ' + d.evaluaciones }),
        el('li', { texto: 'Casillas sin nota: ' + d.celdas_sin_nota + ' (vacío no cuenta como cero)' }),
        el('li', { texto: 'Entregas sin revisar: ' + d.entregas_sin_revisar }),
        el('li', { texto: 'Sesiones de asistencia: ' + d.sesiones + ' · marcas faltantes: ' + d.marcas_asistencia_faltantes })
      ])
    ]));
    if (pend.length) {
      zona.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Columnas con casillas sin nota: ' + pend.map(function (x) {
        return (P.evaluacion.ETIQUETAS[x.categoria] || x.categoria) + (x.tema ? ' «' + x.tema + '»' : '') + ' (' + x.sin_nota + ')';
      }).join(', ') + '.' }));
    }
    var chk = el('input', { type: 'checkbox', id: 'cierre-confirmar' });
    var btn = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Cerrar trimestre ' + ctx.trimestreNumero, disabled: true });
    chk.addEventListener('change', function () { btn.disabled = !chk.checked; });
    var cierrePendiente = false;
    btn.addEventListener('click', async function () {
      if (!chk.checked || cierrePendiente) { return; }
      cierrePendiente = true;
      try {
        if (!(await P.confirmar('Cerrar trimestre ' + ctx.trimestreNumero, '¿Cerrar el trimestre ' + ctx.trimestreNumero + ' de esta materia y grupo? Se guardará una copia y se bloquearán columnas, notas y asistencia. Solo la administración podrá reabrirlo.', 'Cerrar trimestre'))) { return; }
        btn.disabled = true;
        aviso('Cerrando…', 'info');
        var r = await db.rpc('portal2027_cerrar_trimestre', { p_asignacion: ctx.asignacionId, p_trimestre: ctx.trimestreId, p_confirmar: true });
        if (r.error) { throw r.error; }
        ctx.alCambiar('Trimestre cerrado. Copia guardada: versión ' + r.data.version + '.', 'ok');
      } catch (e) { aviso('NO se cerró. ' + textoError(e), 'error'); }
      finally { cierrePendiente = false; btn.disabled = !chk.checked; }
    });
    zona.appendChild(el('label', { clase: 'etiqueta-check' }, [chk, ' Entiendo que se guardará una copia y el trimestre quedará bloqueado.']));
    zona.appendChild(btn);
  }

  P.cierre = { dibujar: dibujar };
})();
