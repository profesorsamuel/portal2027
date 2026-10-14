/* portal2027-libreta-importacion.js — lectura, normalización y planificación de importaciones.
   Extraídas sin cambiar sus cuerpos. Recibe dependencias explícitas; no guarda en la base ni accede al DOM o al cálculo de promedios.
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

  // Recibe referencias al estado y servicios de la libreta; no duplica las notas.
  function crearPlanificador(contexto) {
    var S = contexto.estado;
    var matsVisibles = contexto.matsVisibles;
    var clave = contexto.clave;
    var nombreEst = contexto.nombreEst;

  // Arma el plan: a quién va cada nota y qué pasaría. No guarda nada.
  function planificar(filas, ev, inicio) {
    var mats = matsVisibles();
    var porCodigo = {}, porClave = {};
    mats.forEach(function (m) {
      if (m.estudiante.codigo) { porCodigo[String(m.estudiante.codigo).trim()] = m; }
      porClave[claveNombre((m.estudiante.apellidos || '') + ' ' + (m.estudiante.nombres || ''))] = m;
    });
    var porNombres = filas.some(function (r) { return r.texto; }) ||
      filas.some(function (r) { return r.nums.length > 1 && porCodigo[String(r.nums[0]).trim()]; });
    var items = [], usados = {};

    function item(mat, etiqueta, valor, error) {
      var it = { mat: mat, etiqueta: etiqueta, valor: valor, previa: null, estado: '', detalle: '' };
      if (error) { it.estado = error.estado; it.detalle = error.detalle; return it; }
      if (valor === null) { it.estado = 'vacia'; it.detalle = 'Sin nota en el archivo'; return it; }
      var bad = validar(valor);
      if (bad) { it.estado = 'invalida'; it.detalle = bad; return it; }
      if (usados[mat.id]) { it.estado = 'repetido'; it.detalle = 'Este estudiante ya aparece antes'; return it; }
      usados[mat.id] = true;
      var n = S.notas[clave(ev.id, mat.id)];
      it.previa = n && n.valor !== null ? n.valor : null;
      it.estado = it.previa === null ? 'nueva' : (it.previa === valor ? 'igual' : 'cambia');
      return it;
    }

    if (porNombres) {
      filas.forEach(function (r) {
        if (!r.texto && r.nums.length === 0) { return; }
        var mat = null, nums = r.nums.slice(), amb = false;
        for (var i = 0; i < nums.length && !mat; i++) {
          var cm = porCodigo[String(nums[i]).trim()];
          if (cm && (r.texto || nums.length > 1)) { mat = cm; nums.splice(i, 1); }
        }
        if (!mat && r.texto) {
          var k = claveNombre(r.texto);
          mat = porClave[k] || null;
          if (!mat) {
            var tk = tokensNombre(r.texto);
            var cand = mats.filter(function (m) {
              var st = tokensNombre((m.estudiante.apellidos || '') + ' ' + (m.estudiante.nombres || ''));
              return tk.length > 0 && tk.every(function (t) { return st.indexOf(t) !== -1; });
            });
            if (cand.length === 1) { mat = cand[0]; } else if (cand.length > 1) { amb = true; }
          }
        }
        var etiqueta = r.texto || String(r.nums[0]);
        if (!mat) { items.push(item(null, etiqueta, null, { estado: 'noencontrado', detalle: amb ? 'Coincide con varios estudiantes' : 'No se encontró en esta lista' })); return; }
        items.push(item(mat, nombreEst(mat.estudiante), nums.length ? aNumero(nums[nums.length - 1]) : null, null));
      });
    } else {
      filas.forEach(function (r, i) {
        var mat = mats[inicio + i];
        if (!mat) { items.push(item(null, 'Fila ' + (i + 1), null, { estado: 'sobra', detalle: 'No hay más estudiantes en la lista' })); return; }
        items.push(item(mat, nombreEst(mat.estudiante), r.nums.length ? aNumero(r.nums[r.nums.length - 1]) : null, null));
      });
    }
    return { porNombres: porNombres, items: items };
  }

    return planificar;
  }

  P.libretaImportacion = Object.freeze({
    esNum: esNum,
    aNumero: aNumero,
    tokensNombre: tokensNombre,
    claveNombre: claveNombre,
    filasDeTexto: filasDeTexto,
    leerFilas: leerFilas,
    validar: validar,
    crearPlanificador: crearPlanificador
  });
})();
