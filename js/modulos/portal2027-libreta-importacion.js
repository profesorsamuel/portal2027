/* portal2027-libreta-importacion.js — funciones puras de lectura y normalización.
   Extraídas sin cambiar sus cuerpos. No accede a la base, al DOM ni a cálculos de promedios.
   Cargar antes de portal2027-libreta.js. */
(function () {
  'use strict';
  var P = window.portal2027;

  function esNum(c) { return (typeof c === 'number' && isFinite(c)) || (typeof c === 'string' && /^\d+([.,]\d+)?$/.test(c.trim())); }
  function aNumero(c) { return typeof c === 'number' ? c : Number(String(c).trim().replace(',', '.')); }
  function tokensNombre(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function claveNombre(s) { return tokensNombre(s).sort().join(' '); }

  // Texto pegado (Excel copia con tabuladores) -> filas de celdas. Las filas vacías conservan su lugar.
  function filasDeTexto(t) {
    var l = String(t).replace(/\r/g, '').split('\n');
    while (l.length && l[l.length - 1].trim() === '') { l.pop(); }
    return l.map(function (x) {
      var z = x.trim();
      if (z === '' || /^\d+([.,]\d+)?$/.test(z)) { return [z]; }
      var d = x.indexOf('\t') !== -1 ? '\t' : (x.indexOf(';') !== -1 ? ';' : null);
      if (d) { return x.split(d).map(function (c) { return c.trim(); }); }
      var m = /^(.*\S)\s+(\d+(?:[.,]\d+)?)$/.exec(z);   // «Diaz Wilton 4.5» sin tabulador
      return m ? [m[1], m[2]] : [z];
    });
  }
  function leerFilas(filas) {
    var f = filas.map(function (cells) {
      var t = [], n = [];
      cells.forEach(function (c) {
        if (c === '' || c === null || c === undefined) { return; }
        if (esNum(c)) { n.push(c); } else { t.push(String(c).trim()); }
      });
      return { texto: t.join(' '), nums: n };
    });
    if (f.length && f[0].nums.length === 0 && /nombre|apellido|estudiante|nota|c[oó]digo|virtual|ejercicio/i.test(f[0].texto)) { f.shift(); }
    while (f.length && !f[f.length - 1].texto && f[f.length - 1].nums.length === 0) { f.pop(); }
    return f;
  }

  function validar(v) {
    if (!isFinite(v) || v < 0 || v > 5) { return 'Debe estar entre 0 y 5'; }
    if (Math.round(v * 100) / 100 !== v) { return 'Máximo 2 decimales'; }
    return '';
  }

  P.libretaImportacion = Object.freeze({
    esNum: esNum,
    aNumero: aNumero,
    tokensNombre: tokensNombre,
    claveNombre: claveNombre,
    filasDeTexto: filasDeTexto,
    leerFilas: leerFilas,
    validar: validar
  });
})();
