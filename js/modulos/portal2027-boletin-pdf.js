/* portal2027-boletin-pdf.js — boletín «Notas trimestrales, ausencias y tardanzas» en PDF.
   Una sola página, tamaño carta vertical. Texto vectorial (nítido y seleccionable), logo integrado en el archivo.
   Este módulo SOLO dibuja: recibe los datos ya calculados (el cálculo lo hace el motor único en el seguimiento)
   y no lee ni escribe nada en la base. Requiere jsPDF (window.jspdf.jsPDF) y portal2027.evaluacion (formato de notas).
   Se ajusta solo a la cantidad de estudiantes: márgenes, anchos de columna, altura de fila y tamaño de letra. */
(function (raiz, fabrica) {
  'use strict';
  var API = fabrica(raiz);
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
  var P = (raiz.portal2027 = raiz.portal2027 || {});
  P.boletinPdf = API;
})(typeof window !== 'undefined' ? window : globalThis, function (raiz) {
  'use strict';

  var W = 612, H = 792;                       // carta vertical en puntos (8.5 × 11 pulgadas)
  var COLOR = {
    borde: [47, 95, 168], fondoEnc: [207, 226, 246], textoEnc: [18, 53, 91],
    texto: [25, 25, 25], suave: [95, 95, 95], rojoTexto: [155, 28, 28], rojoFondo: [253, 226, 228]
  };
  var AJUSTES = [                              // se usa el primero que deje la letra legible; el último es el más compacto
    { margen: 36, escala: 1.00 }, { margen: 30, escala: 0.94 }, { margen: 24, escala: 0.88 }, { margen: 18, escala: 0.82 }
  ];
  var LETRA_MIN = 4.5, LETRA_OK = 6.2, LETRA_MAX = 10, FILA_MAX = 20;

  /* ---------- texto seguro para las fuentes estándar del PDF (Latin-1 / WinAnsi) ---------- */
  var EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function seguro(t) {
    t = String(t === null || t === undefined ? '' : t).replace(/\s+/g, ' ').trim();
    var s = '';
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i), c = ch.charCodeAt(0);
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || EXTRA_WINANSI.indexOf(ch) !== -1) { s += ch; continue; }
      var base = ch.normalize ? ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
      s += (base && base.charCodeAt(0) < 127) ? base : (c >= 0xD800 && c <= 0xDFFF ? '' : '?');
    }
    return s;
  }

  function motor() {
    var M = raiz.portal2027 && raiz.portal2027.evaluacion;
    if (!M) { throw new Error('Falta el motor de notas (portal2027.evaluacion).'); }
    return M;
  }
  function claseJsPDF() {
    var J = raiz.jspdf && raiz.jspdf.jsPDF;
    if (!J) { throw new Error('No se pudo cargar la biblioteca de PDF. Revise su conexión a internet y recargue la página.'); }
    return J;
  }
  // Reprobada = valor ORIGINAL menor que el mínimo (nunca el redondeado). La tolerancia solo absorbe ruido de coma flotante.
  function reprobada(v, minimo) { return v !== null && v !== undefined && isFinite(v) && v < minimo - 1e-9; }
  function nombreArchivo(d) {
    var limpio = function (t) { return seguro(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); };
    return 'Boletin_' + (limpio(d.materia) || 'Asignatura') + '_' + (limpio(d.grupo) || 'Grupo') + '_' + (limpio(d.anio) || 'Anio') + '.pdf';
  }

  /* ---------- columnas, en el orden pedido ---------- */
  function columnas(d) {
    var c = [{ id: 'n', enc: 'N°', tipo: 'num' }, { id: 'nombre', enc: 'ESTUDIANTE', tipo: 'nombre' }];
    d.trimestres.forEach(function (t, i) { c.push({ id: 'nota' + i, enc: 'T' + t, tipo: 'nota', i: i }); });
    c.push({ id: 'final', enc: 'FINAL', tipo: 'final' });
    d.trimestres.forEach(function (t, i) { c.push({ id: 'a' + i, enc: 'A T' + t, tipo: 'aus', i: i }, { id: 't' + i, enc: 'T T' + t, tipo: 'tar', i: i }); });
    c.push({ id: 'atot', enc: 'A TOTAL', tipo: 'atot' }, { id: 'ttot', enc: 'T TOTAL', tipo: 'ttot' });
    return c;
  }
  function textoCelda(col, e, M) {
    switch (col.tipo) {
      case 'nombre': return seguro(e.nombre);
      case 'nota': return M.formatear(e.notas[col.i]);                 // un decimal; null → vacío (no es cero)
      case 'final': return M.formatear(e.final);
      case 'aus': return cuenta(e.aus[col.i]);
      case 'tar': return cuenta(e.tar[col.i]);
      case 'atot': return cuenta(suma(e.aus));
      case 'ttot': return cuenta(suma(e.tar));
      default: return '';
    }
  }
  function suma(l) { return (l || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0); }
  function cuenta(n) { return n ? String(n) : ''; }                    // sin registros → en blanco
  function valorNota(col, e) { return col.tipo === 'nota' ? e.notas[col.i] : (col.tipo === 'final' ? e.final : null); }

  /* ---------- cálculo de la distribución (sin dibujar) ---------- */
  function distribuir(doc, d, cols, M, aj) {
    var n = d.estudiantes.length, m = aj.margen, s = aj.escala, ancho = W - 2 * m;
    var logoMaxW = 104 * s, logoMaxH = 58 * s, logoW = 0, logoH = 0;
    if (d.logo && d.logo.ancho > 0 && d.logo.alto > 0) {
      var k = Math.min(logoMaxW / d.logo.ancho, logoMaxH / d.logo.alto);   // proporción original, sin deformar
      logoW = d.logo.ancho * k; logoH = d.logo.alto * k;
    }
    var yTit1 = m + 12 * s, yTit2 = yTit1 + 13.5 * s;
    var fInfo = 9 * s, lineaInfo = 12.5 * s;
    var lineas = armarInfo(doc, d, ancho, fInfo);                         // puede bajar la letra si algo no cabe
    var yInfo = m + Math.max(logoH, 27 * s) + 13 * s;
    var yTabla = yInfo + lineas.lineas.length * lineaInfo * (lineas.fs / fInfo) + 6 * s;
    var altoEnc = (n < 25 ? 21 : 17) * s;
    var bloqueFirma = 52 * s;
    var disponible = H - m - bloqueFirma - yTabla - altoEnc;
    var filas = Math.max(n, 1);
    var altoFila = Math.min(FILA_MAX, disponible / filas);
    var letraFila = Math.max(LETRA_MIN, Math.min(LETRA_MAX, altoFila * 0.56));
    // Anchos según la letra; si no caben, se baja la letra de a poco hasta que quepan.
    var fs = letraFila, w;
    for (;;) {
      w = anchos(doc, d, cols, M, fs);
      var tot = w.reduce(function (a, b) { return a + b; }, 0);
      if (tot <= ancho + 0.01 || fs <= LETRA_MIN) { break; }
      fs = Math.max(LETRA_MIN, fs - 0.1);
    }
    var total = w.reduce(function (a, b) { return a + b; }, 0);
    if (total > ancho) {                                                   // último recurso: comprimir proporcionalmente
      w = w.map(function (x) { return x * ancho / total; });
    } else {                                                               // sobra ancho: se reparte (45% al nombre, el resto parejo)
      var extra = ancho - total, otros = cols.length - 1;
      w = w.map(function (x, i) { return x + (cols[i].tipo === 'nombre' ? extra * 0.45 : extra * 0.55 / otros); });
    }
    return { m: m, s: s, ancho: ancho, logoW: logoW, logoH: logoH, yTit1: yTit1, yTit2: yTit2, info: lineas, yInfo: yInfo, lineaInfo: lineaInfo,
      yTabla: yTabla, altoEnc: altoEnc, altoFila: altoFila, fs: fs, fsEnc: Math.max(LETRA_MIN, Math.min(fs * 0.92, 8.5)), w: w, n: n, bloqueFirma: bloqueFirma };
  }

  function anchos(doc, d, cols, M, fs) {
    var fe = Math.max(LETRA_MIN, Math.min(fs * 0.92, 8.5)), pad = Math.max(2, fs * 0.45);
    return cols.map(function (col) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(fe);
      var mayor = doc.getTextWidth(col.enc);
      doc.setFont('helvetica', col.tipo === 'nombre' ? 'normal' : 'bold'); doc.setFontSize(fs);
      if (!d.estudiantes.length) { mayor = Math.max(mayor, col.tipo === 'num' ? doc.getTextWidth('00') : 0); }
      d.estudiantes.forEach(function (e, i) {
        var t = col.tipo === 'num' ? String(i + 1) : textoCelda(col, e, M);
        if (t) { mayor = Math.max(mayor, doc.getTextWidth(t)); }
      });
      if (col.tipo === 'nota' || col.tipo === 'final') { mayor = Math.max(mayor, doc.getTextWidth('5.0')); }
      return mayor + 2 * pad + (col.tipo === 'nombre' ? pad : 0);
    });
  }

  // Datos del plantel: se agrupan en líneas y, si algo no cabe, se baja la letra (o se pasa a otra línea).
  function armarInfo(doc, d, ancho, fs) {
    var pares = [['PLANTEL', d.plantel], ['ASIGNATURA', d.materia], ['AÑO LECTIVO', d.anio], ['GRUPO', d.grupo], ['PROFESOR CONSEJERO', d.consejero || '']];
    var grupos = [[0, 1], [2, 3, 4]], gap = 16;
    for (var f = fs; f >= 6; f -= 0.25) {
      var ok = true, lineas = [];
      for (var g = 0; g < grupos.length && ok; g++) {
        var actual = [], x = 0;
        for (var j = 0; j < grupos[g].length; j++) {
          var p = pares[grupos[g][j]], wp = anchoPar(doc, p, f);
          if (wp > ancho) { ok = false; break; }
          if (actual.length && x + gap + wp > ancho) { lineas.push(actual); actual = []; x = 0; }
          x += (actual.length ? gap : 0) + wp; actual.push(p);
        }
        if (ok) { lineas.push(actual); }
      }
      if (ok) { return { lineas: lineas, fs: f, gap: gap }; }
    }
    return { lineas: pares.map(function (p) { return [p]; }), fs: 6, gap: gap };
  }
  function anchoPar(doc, p, fs) {
    doc.setFontSize(fs);
    doc.setFont('helvetica', 'bold'); var a = doc.getTextWidth(p[0] + ':');
    doc.setFont('helvetica', 'normal');
    return a + doc.getTextWidth(' ') + 2 + doc.getTextWidth(seguro(p[1]) || '________________');
  }

  /* ---------- dibujo ---------- */
  function construir(d, J) {
    var M = motor(), Clase = J || claseJsPDF();
    var doc = new Clase({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    var cols = columnas(d), L = null, i;
    for (i = 0; i < AJUSTES.length; i++) {
      L = distribuir(doc, d, cols, M, AJUSTES[i]);
      if (L.fs >= LETRA_OK) { break; }
    }
    var m = L.m, s = L.s;
    var fam = 'helvetica';

    // Logo arriba a la derecha (proporción original).
    if (d.logo && L.logoW) {
      doc.addImage(d.logo.dataUrl, d.logo.formato || 'PNG', W - m - L.logoW, m, L.logoW, L.logoH, undefined, 'FAST');
    }
    // Encabezados centrados (se corren a la izquierda si pudieran tocar el logo).
    var tit = ['MINISTERIO DE EDUCACIÓN', 'NOTAS TRIMESTRALES, AUSENCIAS Y TARDANZAS'], fT = [11.5 * s, 10 * s], cx = W / 2;
    doc.setFont(fam, 'bold'); doc.setTextColor.apply(doc, COLOR.textoEnc);
    var anchoMax = 0;
    tit.forEach(function (t, k) { doc.setFontSize(fT[k]); anchoMax = Math.max(anchoMax, doc.getTextWidth(t)); });
    var limiteDer = L.logoW ? W - m - L.logoW - 10 : W - m;
    if (cx + anchoMax / 2 > limiteDer) { cx = Math.max(m + anchoMax / 2, limiteDer - anchoMax / 2); }
    tit.forEach(function (t, k) { doc.setFontSize(fT[k]); doc.text(t, cx, k ? L.yTit2 : L.yTit1, { align: 'center' }); });

    // Plantel, asignatura, año lectivo, grupo y profesor consejero.
    var y = L.yInfo, f = L.info.fs;
    doc.setTextColor.apply(doc, COLOR.texto);
    L.info.lineas.forEach(function (linea) {
      var x = m;
      linea.forEach(function (p) {
        doc.setFontSize(f); doc.setFont(fam, 'bold'); doc.text(p[0] + ':', x, y);
        x += doc.getTextWidth(p[0] + ': ') + 2;
        doc.setFont(fam, 'normal');
        var v = seguro(p[1]);
        if (v) { doc.text(v, x, y); x += doc.getTextWidth(v); }
        else { doc.setDrawColor.apply(doc, COLOR.texto); doc.setLineWidth(0.5); doc.line(x, y + 1, x + 110 * s, y + 1); x += 110 * s; }
        x += L.info.gap;
      });
      y += L.lineaInfo * (f / (9 * s));
    });

    // Tabla.
    var x0 = m, y0 = L.yTabla, ancho = L.ancho, hE = L.altoEnc, hF = L.altoFila, fs = L.fs, fe = L.fsEnc, pad = Math.max(2, fs * 0.45);
    var xs = [x0]; L.w.forEach(function (w) { xs.push(xs[xs.length - 1] + w); });
    var nFilas = Math.max(L.n, 1), yFin = y0 + hE + nFilas * hF;
    doc.setLineJoin && doc.setLineJoin('miter');

    doc.setFillColor.apply(doc, COLOR.fondoEnc); doc.rect(x0, y0, ancho, hE, 'F');
    d.estudiantes.forEach(function (e, r) {                       // fondo rosado de las notas reprobadas
      cols.forEach(function (col, c) {
        if (reprobada(valorNota(col, e), d.minimo)) {
          doc.setFillColor.apply(doc, COLOR.rojoFondo); doc.rect(xs[c], y0 + hE + r * hF, L.w[c], hF, 'F');
        }
      });
    });
    // Rejilla azul.
    doc.setDrawColor.apply(doc, COLOR.borde); doc.setLineWidth(0.5);
    for (i = 0; i <= nFilas + 1; i++) { var yy = i === 0 ? y0 : (i === 1 ? y0 + hE : y0 + hE + (i - 1) * hF); doc.line(x0, yy, x0 + ancho, yy); }
    xs.forEach(function (xx) { doc.line(xx, y0, xx, yFin); });
    doc.setLineWidth(1.1);                                         // contorno y separadores de grupo más gruesos
    doc.rect(x0, y0, ancho, yFin - y0, 'S');
    cols.forEach(function (col, c) { if (col.id === 'nombre' || col.id === 'final' || col.id === 'atot') { doc.line(xs[c], y0, xs[c], yFin); } });
    doc.setLineWidth(0.8); doc.line(x0, y0 + hE, x0 + ancho, y0 + hE);

    // Encabezados.
    doc.setFont(fam, 'bold'); doc.setFontSize(fe); doc.setTextColor.apply(doc, COLOR.textoEnc);
    cols.forEach(function (col, c) {
      doc.text(col.enc, col.tipo === 'nombre' ? xs[c] + pad * 1.5 : xs[c] + L.w[c] / 2, y0 + hE / 2, { align: col.tipo === 'nombre' ? 'left' : 'center', baseline: 'middle' });
    });
    // Filas.
    if (!L.n) {
      doc.setFont(fam, 'italic'); doc.setFontSize(Math.min(fs, 10)); doc.setTextColor.apply(doc, COLOR.suave);
      doc.text('Sin estudiantes matriculados en este grupo.', x0 + ancho / 2, y0 + hE + hF / 2, { align: 'center', baseline: 'middle' });
    }
    d.estudiantes.forEach(function (e, r) {
      var cy = y0 + hE + r * hF + hF / 2;
      cols.forEach(function (col, c) {
        var t = col.tipo === 'num' ? String(r + 1) : textoCelda(col, e, M);
        if (!t) { return; }
        var mala = reprobada(valorNota(col, e), d.minimo);
        doc.setFont(fam, (col.tipo === 'nombre' || col.tipo === 'num') && !mala ? 'normal' : 'bold');
        if (col.tipo === 'aus' || col.tipo === 'tar') { doc.setFont(fam, 'normal'); }
        doc.setFontSize(fs); doc.setTextColor.apply(doc, mala ? COLOR.rojoTexto : COLOR.texto);
        if (col.tipo === 'nombre') { doc.text(t, xs[c] + pad * 1.5, cy, { baseline: 'middle' }); }
        else { doc.text(t, xs[c] + L.w[c] / 2, cy, { align: 'center', baseline: 'middle' }); }
      });
    });

    // Firma del profesor, debajo de la tabla.
    var fF = 9 * s, ys = yFin + 28 * s, largo = 150 * s;
    doc.setFont(fam, 'normal'); doc.setFontSize(fF); doc.setTextColor.apply(doc, COLOR.texto);
    var etq = 'PROFESOR:', wE = doc.getTextWidth(etq + ' '), xi = (W - (wE + largo)) / 2;
    doc.text(etq, xi, ys);
    doc.setDrawColor.apply(doc, COLOR.texto); doc.setLineWidth(0.6); doc.line(xi + wE, ys + 1, xi + wE + largo, ys + 1);
    var nombreProf = seguro(d.profesor);
    if (nombreProf) { doc.setFont(fam, 'bold'); doc.text(nombreProf, xi + wE + largo / 2, ys + 13 * s, { align: 'center' }); }

    if (doc.getNumberOfPages() !== 1) { throw new Error('El boletín debe quedar en una sola página.'); }
    if (ys + 13 * s > H - m + 0.5) { throw new Error('La firma no cabe en la página.'); }
    doc.setProperties({ title: 'Notas trimestrales, ausencias y tardanzas · ' + seguro(d.materia) + ' · ' + seguro(d.grupo) + ' · ' + seguro(d.anio),
      subject: 'Boletín de notas', creator: 'Portal ' + seguro(d.anio) });
    doc.__diseno = { fuente: fs, altoFila: hF, margen: m, estudiantes: L.n, finTabla: yFin, firmaY: ys };   // solo para pruebas
    return doc;
  }

  /* ---------- logo y descarga ---------- */
  function cargarLogo(ruta) {
    return fetch(ruta, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) { throw new Error('No se encontró el logo de MEDUCA (' + ruta + ').'); }
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (ok, mal) {
        var fr = new FileReader();
        fr.onerror = function () { mal(new Error('No se pudo leer el logo de MEDUCA.')); };
        fr.onload = function () {
          var img = new Image();
          img.onerror = function () { mal(new Error('El archivo del logo de MEDUCA no es una imagen válida.')); };
          img.onload = function () { ok({ dataUrl: fr.result, ancho: img.naturalWidth, alto: img.naturalHeight, formato: /jpe?g/i.test(blob.type) ? 'JPEG' : 'PNG' }); };
          img.src = fr.result;
        };
        fr.readAsDataURL(blob);
      });
    });
  }
  function descargar(datos, opciones) {
    opciones = opciones || {};
    return cargarLogo(opciones.rutaLogo).then(function (logo) {
      var d = Object.assign({}, datos, { logo: logo });
      var doc = construir(d);
      var nombre = nombreArchivo(d);
      doc.save(nombre);
      return nombre;
    });
  }

  return { construir: construir, descargar: descargar, cargarLogo: cargarLogo, nombreArchivo: nombreArchivo, reprobada: reprobada, seguro: seguro };
});
