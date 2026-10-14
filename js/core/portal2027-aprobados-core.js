/* portal2027-aprobados-core.js — lógica del cuadro de aprobados y reprobados SIN tocar el DOM.
   calcularGrupo(): cuenta aprobados/reprobados/sin calificaciones por sexo (la nota final ya viene del motor único portal2027.evaluacion).
   htmlCuadro(): devuelve el HTML imprimible del cuadro (una sola página horizontal). */
(function (raiz) {
  'use strict';
  var P = (raiz.portal2027 = raiz.portal2027 || {}), M = P.evaluacion;
  var MIN = 3.0, TOPE = 5.0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function llave(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
  function sexo(v) { var k = llave(v); return (k === 'm' || k === 'masculino') ? 'M' : (k === 'f' || k === 'femenino') ? 'F' : 'X'; }
  function esRetirado(estado) { return /retir|traslad|baja/.test(llave(estado)); }
  function nuevo() { return { M: 0, F: 0, X: 0 }; }
  function tot(c) { return c.M + c.F + c.X; }
  function pct(n, d) { return (d ? 100 * n / d : 0).toFixed(2) + '%'; }

  // items: [{nombre, sexo, retirado, final, cat}]  cat = categorias del motor (o null si es nota final anual).
  function calcularGrupo(grupo, items) {
    var r = { grupo: grupo, activos: 0, ap: nuevo(), rep: nuevo(), sin: nuevo(), ret: nuevo(), pendientes: [], reprobados: [], sinSexo: [] };
    items.forEach(function (it) {
      var s = sexo(it.sexo);
      if (s === 'X') { r.sinSexo.push(it.nombre); }
      if (it.retirado) { r.ret[s]++; return; }
      r.activos++;
      var tipo = (it.final === null || it.final === undefined) ? 'sin' : (M.redondear1(it.final) >= MIN ? 'ap' : 'rep');
      r[tipo][s]++;
      if (tipo === 'rep') { r.reprobados.push({ grupo: grupo, nombre: it.nombre, final: it.final }); }
      var c = it.cat;
      if (tipo === 'ap' && c && c.examen.cantidad === 0 && c.apreciacion.promedio !== null && c.ejercicio_escrito.promedio !== null) {
        var need = 3 * MIN - c.apreciacion.promedio - c.ejercicio_escrito.promedio;
        r.pendientes.push({ grupo: grupo, nombre: it.nombre, minimo: Math.min(TOPE, Math.max(0, need)) });
      }
    });
    r.pendientes.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    return r;
  }

  function niveles(salones) { // [{grado, seccion}] -> "8° A / 9° A, B, C"
    var g = {}; salones.forEach(function (s) { (g[s.grado] = g[s.grado] || []).push(s.seccion); });
    return Object.keys(g).sort(function (a, b) { return a - b; }).map(function (k) { return k + '° ' + g[k].sort().join(', '); }).join(' / ');
  }

  function td(v, cls, extra) { return '<td' + (cls ? ' class="' + cls + '"' : '') + (extra || '') + '>' + v + '</td>'; }
  function fila(s, total) {
    var ed = function (k, v) { return td(v, 'ed', ' contenteditable="true" data-k="' + k + '"'); };
    return '<tr' + (total ? ' class="aprobados-total"' : '') + '>' + td(esc(s.grupo)) + td(s.activos) +
      td(s.ap.M) + td(s.ap.F) + td(tot(s.ap)) + td(pct(tot(s.ap), s.activos)) +
      td(s.rep.M) + td(s.rep.F) + td(tot(s.rep)) + td(pct(tot(s.rep), s.activos)) +
      td(s.sin.M) + td(s.sin.F) + td(tot(s.sin)) + td(pct(tot(s.sin), s.activos)) +
      (total ? td(s.ret.M, 'tot-ret', ' data-k="h"') + td(s.ret.F, 'tot-ret', ' data-k="m"') : ed('h', s.ret.M) + ed('m', s.ret.F)) + '</tr>';
  }

  // d: {institucion, profesor, asignatura, nivelesTxt, trimestre, anio, jornada, resumenes, mostrarExamen}
  function htmlCuadro(d) {
    var g = { grupo: 'TOTALES', activos: 0, ap: nuevo(), rep: nuevo(), sin: nuevo(), ret: nuevo() };
    d.resumenes.forEach(function (s) { g.activos += s.activos; ['ap', 'rep', 'sin', 'ret'].forEach(function (k) { ['M', 'F', 'X'].forEach(function (x) { g[k][x] += s[k][x]; }); }); });
    var pend = [].concat.apply([], d.resumenes.map(function (s) { return s.pendientes; }));
    var h = '<div class="aprobados-inst" contenteditable="true">' + esc(d.institucion) + '</div>' +
      '<h2>CUADRO DE ESTUDIANTES APROBADOS Y REPROBADOS</h2><p class="aprobados-prof"><b>NOMBRE DEL PROFESOR:</b> ' + esc(d.profesor) + '</p>' +
      '<div class="aprobados-datos"><span><b>ASIGNATURA:</b> ' + esc(d.asignatura) + '</span><span><b>NIVELES:</b> ' + esc(d.nivelesTxt) + '</span><span><b>TRIMESTRE:</b> ' + esc(d.trimestre) + '</span>' +
      '<span><b>AÑO ELECTIVO:</b> ' + esc(d.anio) + '</span><span><b>JORNADA:</b> ' + esc(d.jornada) + '</span></div>' +
      '<table class="aprobados-tabla"><thead><tr><th rowspan="2">GRADO</th><th rowspan="2">MATRÍCULA POR GRADO</th><th colspan="4">APROBADOS</th><th colspan="4">REPROBADOS HASTA LA FECHA</th><th colspan="4">SIN CALIFICACIONES</th><th colspan="2">RETIRADOS</th></tr>' +
      '<tr>' + ['M', 'F', 'TOTAL', '%', 'M', 'F', 'TOTAL', '%', 'H', 'M', 'TOTAL', '%', 'H', 'M'].map(function (t) { return '<th>' + t + '</th>'; }).join('') + '</tr></thead><tbody>' +
      d.resumenes.map(function (s) { return fila(s, false); }).join('') + fila(g, true) + '</tbody></table>';
    if (d.mostrarExamen) {
      h += '<h4>Estudiantes que deben cuidar su nota de Examen</h4><p class="aprobados-pend">' + (pend.length
        ? pend.map(function (p) { return '<span>' + esc(p.grupo) + ' — ' + esc(p.nombre) + ': <b>' + p.minimo.toFixed(2) + '</b></span>'; }).join(' | ')
        : 'No hay estudiantes aprobados a la espera de nota de Examen en los grados seleccionados.') + '</p>';
    }
    return h + '<h4>CAUSAS DEL RETIRO DEL ALUMNO SIN CALIFICACIONES:</h4><div class="aprobados-causas" contenteditable="true"></div>' +
      '<div class="aprobados-pie"><b>NOTA:</b> 1- Haga el % de cada nivel y por asignatura. 2- Deberá remitir a la Dirección 1 original y 1 copia. 3- El/la profesor(a) de la asignatura y la dirección deberán conservar una copia. 4- En la columna de reprobados anotar la cantidad hasta la fecha.</div>' +
      '<div class="aprobados-firmas"><span>______________________________<br>FIRMA DEL PROFESOR</span><span>______________________________<br>FIRMA DEL DIRECTOR</span></div>';
  }

  P.aprobadosCore = { calcularGrupo: calcularGrupo, htmlCuadro: htmlCuadro, niveles: niveles, llave: llave, esc: esc, esRetirado: esRetirado, tot: tot, pct: pct };
})(typeof window !== 'undefined' ? window : globalThis);
