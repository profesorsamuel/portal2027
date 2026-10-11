/* portal2027-evaluacion.js — motor ÚNICO de cálculo de notas.
   La libreta, los reportes y la consejería deben usar solo estas funciones; no se calcula en otro lugar.
   Reglas (guía del proyecto):
   - Promedio por categoría con las notas que existen. Vacío (null, undefined, '') no es cero.
   - Final = promedio de las categorías que tienen nota. Sin ninguna nota: sin final.
   - Columnas en papelera no cuentan. Columnas ocultas SÍ cuentan (ocultar no cambia el cálculo).
   - Sin redondeo intermedio; el resultado se muestra con 1 decimal (mitad hacia arriba). */
(function (raiz, fabrica) {
  'use strict';
  var motor = fabrica();
  if (typeof module !== 'undefined' && module.exports) { module.exports = motor; }
  var P = (raiz.portal2027 = raiz.portal2027 || {});
  P.evaluacion = motor;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var CATEGORIAS = ['apreciacion', 'ejercicio_escrito', 'examen'];
  var ETIQUETAS = { apreciacion: 'Apreciación', ejercicio_escrito: 'Ejercicio escrito', examen: 'Examen' };

  function esNota(v) {
    if (v === null || v === undefined || v === '') { return false; }
    var n = Number(v);
    return isFinite(n);
  }

  function promedio(lista) {
    var vals = lista.filter(esNota).map(Number);
    if (vals.length === 0) { return null; }
    var suma = 0;
    for (var i = 0; i < vals.length; i++) { suma += vals[i]; }
    return suma / vals.length;
  }

  // Un decimal, mitad hacia arriba, sin errores de coma flotante (4.45 -> 4.5).
  function redondear1(x) {
    if (x === null || x === undefined || !isFinite(x)) { return null; }
    return Math.floor(x * 10 + 0.5 + 1e-9) / 10;
  }

  function formatear(x) {
    var r = redondear1(x);
    return r === null ? '' : r.toFixed(1);
  }

  // evaluaciones: [{id, categoria, eliminada_en}]  notas: { evaluacionId: valor } de UN estudiante.
  function calcular(evaluaciones, notas) {
    var porCategoria = {};
    CATEGORIAS.forEach(function (c) { porCategoria[c] = []; });
    evaluaciones.forEach(function (e) {
      if (e.eliminada_en || !porCategoria[e.categoria]) { return; }
      porCategoria[e.categoria].push(notas[e.id]);
    });
    var categorias = {};
    var promedios = [];
    CATEGORIAS.forEach(function (c) {
      var p = promedio(porCategoria[c]);
      categorias[c] = { promedio: p, texto: formatear(p), cantidad: porCategoria[c].filter(esNota).length };
      if (p !== null) { promedios.push(p); }
    });
    var final = promedio(promedios);
    return { categorias: categorias, final: final, textoFinal: final === null ? 'Sin nota' : formatear(final) };
  }

  return { CATEGORIAS: CATEGORIAS, ETIQUETAS: ETIQUETAS, esNota: esNota, promedio: promedio,
    redondear1: redondear1, formatear: formatear, calcular: calcular };
});
