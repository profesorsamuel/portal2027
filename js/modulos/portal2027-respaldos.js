/* portal2027-respaldos.js — respaldos (guía, etapa 9, parte B). Solo administración.
   El portal NO hace copias: aquí se ANOTA, con su resultado real, cada copia hecha fuera de Supabase
   (scripts/portal2027-respaldo-db.sh y portal2027-respaldo-storage.mjs) o cada ensayo de restauración.
   Un tipo sin copia exitosa registrada se muestra como tal: nunca se presume que existe.
   Se escribe solo con portal2027_registrar_respaldo; la base vuelve a validar todo. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  var TIPOS = [
    ['diaria', 'Base de datos (diaria o semanal)'],
    ['storage', 'Archivos de Storage'],
    ['previa_importacion', 'Previa a una importación'],
    ['previa_cierre', 'Previa a un cierre trimestral'],
    ['manual', 'Manual'],
    ['restauracion_prueba', 'Ensayo de restauración']
  ];
  var RESULTADOS = [['exitoso', 'Exitoso'], ['parcial', 'Parcial'], ['fallido', 'Fallido']];
  function etiqueta(lista, v) { var x = lista.filter(function (t) { return t[0] === v; })[0]; return x ? x[1] : v; }

  function fecha(v) { return v ? new Date(v).toLocaleString('es-PA') : ''; }
  function hace(v) {
    var dias = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
    return dias <= 0 ? 'hoy' : (dias === 1 ? 'hace 1 día' : 'hace ' + dias + ' días');
  }
  function tamano(b) {
    if (b === null || b === undefined) { return ''; }
    return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/Escriba quién|parcial o falló|no puede ser futura|No tiene permiso/i.test(m)) { return m.replace(/\s*\(row-level security\)/, ''); }
    return P.traducirError(e);
  }

  P.renderRespaldosAdmin = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Respaldos' }),
      el('p', { clase: 'bloque-ayuda', texto: 'El portal no hace copias por sí mismo. Aquí se anota cada copia que usted hace fuera de Supabase (base y archivos) y cada ensayo de restauración, con su resultado real. Nunca escriba claves ni cadenas de conexión.' })
    ]);
    zona.appendChild(sec);
    var cuerpo = el('div');
    sec.appendChild(cuerpo);
    await dibujar(cuerpo);
  };

  async function dibujar(cuerpo) {
    cuerpo.textContent = '';
    var estado, lista;
    try {
      var r = await Promise.all([
        db.rpc('portal2027_estado_respaldos'),
        db.from('portal2027_respaldos')
          .select('tipo,resultado,responsable,ubicacion,detalle,tamano_bytes,realizado_en')
          .order('realizado_en', { ascending: false }).order('registrado_en', { ascending: false }).limit(20)
      ]);
      if (r[0].error) { throw r[0].error; }
      if (r[1].error) { throw r[1].error; }
      estado = r[0].data || {};
      lista = r[1].data;
    } catch (e) {
      cuerpo.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: 'No se pudo cargar el estado de los respaldos. ' + textoError(e) + ' (¿ejecutó la migración 0015?)' }));
      return;
    }

    // Aviso en pantalla: lo que NO tiene copia exitosa registrada.
    var sin = TIPOS.filter(function (t) { return t[0] === 'diaria' || t[0] === 'storage'; })
      .filter(function (t) { return !(estado[t[0]] && estado[t[0]].ultimo_exitoso); });
    if (sin.length) {
      cuerpo.appendChild(el('p', { clase: 'mensaje error', role: 'alert',
        texto: 'Sin copia exitosa registrada: ' + sin.map(function (t) { return t[1]; }).join('; ') + '. Antes de usar datos reales haga y anote una copia.' }));
    }

    cuerpo.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Tipo', 'Última copia exitosa', 'Último intento'].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, TIPOS.map(function (t) {
        var s = estado[t[0]] || {};
        return el('tr', null, [
          el('td', { texto: t[1] }),
          el('td', { texto: s.ultimo_exitoso ? fecha(s.ultimo_exitoso) + ' (' + hace(s.ultimo_exitoso) + ')' : 'Ninguna registrada' }),
          el('td', { texto: s.ultimo_intento ? fecha(s.ultimo_intento) + ' — ' + etiqueta(RESULTADOS, s.ultimo_resultado) : '—' })
        ]);
      }))
    ])]));

    cuerpo.appendChild(formulario(cuerpo));

    var h = el('div', { clase: 'doc-subbloque' }, [el('h3', { texto: 'Últimos registros (máximo 20)' })]);
    cuerpo.appendChild(h);
    if (lista.length === 0) { h.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no se ha anotado ningún respaldo.' })); return; }
    h.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Fecha', 'Tipo', 'Resultado', 'Responsable', 'Dónde quedó', 'Tamaño', 'Detalle'].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, lista.map(function (x) {
        return el('tr', null, [el('td', { texto: fecha(x.realizado_en) }), el('td', { texto: etiqueta(TIPOS, x.tipo) }),
          el('td', { texto: etiqueta(RESULTADOS, x.resultado) }), el('td', { texto: x.responsable }), el('td', { texto: x.ubicacion || '' }),
          el('td', { texto: tamano(x.tamano_bytes) }), el('td', { texto: x.detalle || '' })]);
      }))
    ])]));
  }

  function formulario(cuerpo) {
    var tipo = el('select', { 'aria-label': 'Tipo' }, TIPOS.map(function (t) { return el('option', { value: t[0], texto: t[1] }); }));
    var res = el('select', { 'aria-label': 'Resultado' }, RESULTADOS.map(function (t) { return el('option', { value: t[0], texto: t[1] }); }));
    var resp = el('input', { type: 'text', maxlength: '120', required: true, placeholder: 'Quién hizo la copia' });
    var ubic = el('input', { type: 'text', maxlength: '300', placeholder: 'Ej.: disco externo A, carpeta 2027-10' });
    var mb = el('input', { type: 'number', min: '0', step: '0.1', placeholder: 'Opcional' });
    var cuando = el('input', { type: 'datetime-local' });
    var det = el('input', { type: 'text', maxlength: '1000', placeholder: 'Obligatorio si fue parcial o fallido' });
    var msg = el('p', { clase: 'mensaje info', role: 'status', 'aria-live': 'polite', hidden: true });
    var btn = el('button', { clase: 'boton', type: 'submit', texto: 'Anotar respaldo' });

    function aviso(t, c) { msg.textContent = t; msg.className = 'mensaje ' + c; msg.hidden = !t; }

    var form = el('form', { clase: 'formulario-fila' }, [
      el('label', null, ['Tipo', tipo]), el('label', null, ['Resultado real', res]), el('label', null, ['Responsable', resp]),
      el('label', null, ['Dónde quedó', ubic]), el('label', null, ['Tamaño (MB)', mb]), el('label', null, ['Fecha y hora (vacío = ahora)', cuando]),
      el('label', null, ['Detalle', det]), btn
    ]);
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (res.value !== 'exitoso' && !det.value.trim()) { aviso('Si el respaldo fue parcial o falló, describa qué ocurrió.', 'error'); return; }
      if (cuando.value && new Date(cuando.value).getTime() > Date.now() + 300000) { aviso('La fecha del respaldo no puede ser futura.', 'error'); return; }
      btn.disabled = true;
      aviso('Guardando…', 'info');
      try {
        var r = await db.rpc('portal2027_registrar_respaldo', {
          p_tipo: tipo.value, p_resultado: res.value, p_responsable: resp.value, p_ubicacion: ubic.value || null, p_detalle: det.value || null,
          p_tamano: mb.value === '' ? null : Math.round(Number(mb.value) * 1048576),
          p_realizado_en: cuando.value ? new Date(cuando.value).toISOString() : null
        });
        if (r.error) { throw r.error; }
        await dibujar(cuerpo);
        var ok = el('p', { clase: 'mensaje ok', role: 'status', texto: 'Respaldo anotado.' });
        cuerpo.insertBefore(ok, cuerpo.firstChild);
      } catch (e) {
        btn.disabled = false;
        aviso('No se guardó. ' + textoError(e), 'error');
      }
    });
    return el('div', { clase: 'doc-subbloque' }, [el('h3', { texto: 'Anotar un respaldo' }), form, msg]);
  }
})();
