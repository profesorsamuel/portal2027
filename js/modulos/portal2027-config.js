/* portal2027-config.js — etapa 4B: configuración académica (solo administración).
   Administración de fechas de trimestres. Los catálogos internos de asistencia y notas
   permanecen intactos en Supabase y en los demás módulos. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var D = {};
  var zona = null, barra = null;

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
    D.anios = await consultar(db.from('portal2027_anios').select('id,anio,activo,trimestres:portal2027_trimestres(id,numero,fecha_inicio,fecha_fin)').order('anio', { ascending: false }));
    D.anios.forEach(function (a) { a.trimestres.sort(function (x, y) { return x.numero - y.numero; }); });
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

  function dibujar() {
    var previo = zona.querySelector('.secciones-config');
    if (previo) { previo.remove(); }
    zona.appendChild(el('div', { clase: 'secciones secciones-config' }, [
      el('h2', { texto: 'Configuración académica' }),
      seccionPeriodos()
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
