/* Cuadro de aprobados y reprobados: conecta filtros/botones con portal2027.aprobadosCore, maneja sesión y exporta PDF.
   Solo lee datos (respeta RLS). Nada se guarda en Supabase. */
(function () {
  'use strict';
  var P = window.portal2027, db = P.db, C = P.aprobadosCore, root = document.getElementById('contenido');
  var INSTITUCION = 'MINISTERIO DE EDUCACIÓN – DIRECCIÓN REGIONAL DE COLÓN – C.E.B.G. EL JIRAL'; // editable también en pantalla
  function $(tag, txt, cls) { var e = document.createElement(tag); if (txt !== undefined) { e.textContent = txt; } if (cls) { e.className = cls; } return e; }
  async function get(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  async function all(f) { var out = [], o = 0; while (true) { var v = await get(f().range(o, o + 999)); out.push.apply(out, v); if (v.length < 1000) { return out; } o += 1000; } }
  function campo(label, ctl) { var w = $('label', label); w.append(ctl); return w; }
  function opciones(s, items) { s.replaceChildren(); items.forEach(function (i) { var o = $('option', i[1]); o.value = i[0]; s.append(o); }); }

  async function main() {
    try {
      if (!db) { throw Error('No se pudo conectar con Supabase.'); }
      var ses = await P.cargarSesion();
      if (!ses || !ses.roles.some(function (r) { return ['profesor', 'administrador'].indexOf(r) >= 0; })) { throw Error('No tiene acceso al cuadro.'); }
      var profesor = P.nombreCompleto(ses.perfil) || '________________';
      var asig = (await all(function () { return db.from('portal2027_asignaciones').select('id,materia_id,salon:portal2027_salones(id,nombre,grado,seccion,anio_id,anio:portal2027_anios(anio)),materia:portal2027_materias(nombre)').order('id'); }))
        .filter(function (a) { return a.salon && a.materia && a.salon.anio; });
      var anios = Array.from(new Set(asig.map(function (a) { return String(a.salon.anio.anio); }))).sort().reverse();

      root.replaceChildren();
      var cab = $('div', undefined, 'aprobados-cab no-imprimir');
      var tit = $('div'); tit.append($('small', profesor), $('h1', '📊 Cuadro de estudiantes aprobados y reprobados'));
      var volver = $('a', '↩️ Regresar a Docente', 'boton boton-secundario'); volver.href = P.rutaInicio();
      cab.append(tit, volver); root.append(cab);

      var panel = $('div', undefined, 'aprobados-panel no-imprimir'); root.append(panel);
      var sAnio = $('select'), sMat = $('select'), sTri = $('select'), sJor = $('select');
      opciones(sAnio, anios.map(function (y) { return [y, y]; }));
      opciones(sJor, ['Matutina', 'Vespertina', 'Nocturna'].map(function (j) { return [j, j]; }));
      var fila = $('div', undefined, 'formulario-fila'); fila.append(campo('Asignatura', sMat), campo('Trimestre', sTri), campo('Año electivo', sAnio), campo('Jornada', sJor)); panel.append(fila);
      panel.append($('p', 'Grados a incluir', 'aprobados-sub'));
      var chips = $('div', undefined, 'aprobados-grupos'); panel.append(chips);
      var acc = $('div', undefined, 'aprobados-acciones'); panel.append(acc);
      var bGen = $('button', '📊 Generar cuadro', 'boton'), bPdf = $('button', '📄 Descargar PDF', 'boton boton-secundario'), bImp = $('button', '🖨️ Imprimir', 'boton boton-secundario');
      bPdf.hidden = bImp.hidden = true; acc.append(bGen, bPdf, bImp);
      var avisos = $('div', undefined, 'no-imprimir'), salida = $('div'); root.append(avisos, salida);
      var hoja = null, nombrePdf = 'Cuadro_Aprobados';
      function error(e) { avisos.replaceChildren($('p', 'Error: ' + (e.message || e), 'mensaje error')); }

      function actMaterias() {
        var viejo = sMat.value, nombres = Array.from(new Set(asig.filter(function (a) { return String(a.salon.anio.anio) === sAnio.value; }).map(function (a) { return a.materia.nombre; }))).sort();
        opciones(sMat, nombres.map(function (n) { return [n, n]; })); if (nombres.indexOf(viejo) >= 0) { sMat.value = viejo; } actChips();
      }
      function actChips() {
        chips.replaceChildren();
        asig.filter(function (a) { return String(a.salon.anio.anio) === sAnio.value && a.materia.nombre === sMat.value; })
          .sort(function (a, b) { return (a.salon.grado - b.salon.grado) || a.salon.seccion.localeCompare(b.salon.seccion); })
          .forEach(function (a) { var l = $('label'), c = $('input'); c.type = 'checkbox'; c.checked = true; c.value = a.id; l.append(c, document.createTextNode(' ' + a.salon.grado + '°' + a.salon.seccion)); chips.append(l); });
      }
      async function actTrimestres() {
        var a = asig.find(function (x) { return String(x.salon.anio.anio) === sAnio.value; }); sTri.replaceChildren(); if (!a) { return; }
        var t = await get(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', a.salon.anio_id).order('numero'));
        opciones(sTri, t.map(function (x) { return [x.id, 'Trimestre ' + x.numero]; }));
      }
      async function refrescar() { actMaterias(); await actTrimestres(); }
      sAnio.onchange = function () { refrescar().catch(error); }; sMat.onchange = actChips;

      async function datosGrupo(a) {
        var q = await Promise.all([
          all(function () { return db.from('portal2027_evaluaciones').select('id,categoria,eliminada_en').eq('asignacion_id', a.id).eq('trimestre_id', sTri.value).is('eliminada_en', null).order('id'); }),
          all(function () { return db.from('portal2027_matriculas').select('id,estado,estudiante:portal2027_estudiantes(nombres,apellidos,sexo)').eq('salon_id', a.salon.id).eq('anio_id', a.salon.anio_id).order('id'); }),
          all(function () { return db.from('portal2027_notas').select('evaluacion_id,matricula_id,valor,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id,eliminada_en)').eq('evaluacion.asignacion_id', a.id).eq('evaluacion.trimestre_id', sTri.value).is('evaluacion.eliminada_en', null).order('id'); }),
          get(db.from('portal2027_cierres').select('cerrado').eq('asignacion_id', a.id).eq('trimestre_id', sTri.value).maybeSingle())]);
        var nm = {}; q[2].forEach(function (n) { if (n.valor !== null) { (nm[n.matricula_id] = nm[n.matricula_id] || {})[n.evaluacion_id] = Number(n.valor); } });
        var r = C.calcularGrupo(a.salon.grado + '°' + a.salon.seccion, q[0], q[1], nm); r.cerrado = !!(q[3] && q[3].cerrado); return r;
      }

      async function generar() {
        bGen.disabled = true; avisos.replaceChildren($('p', 'Calculando cuadro…')); salida.replaceChildren(); bPdf.hidden = bImp.hidden = true;
        try {
          var ids = Array.from(chips.querySelectorAll('input:checked')).map(function (c) { return c.value; });
          var sel = asig.filter(function (a) { return ids.indexOf(a.id) >= 0; }).sort(function (a, b) { return (a.salon.grado - b.salon.grado) || a.salon.seccion.localeCompare(b.salon.seccion); });
          if (!sel.length) { throw Error('Seleccione al menos un grado.'); } if (!sTri.value) { throw Error('Seleccione un trimestre.'); }
          var res = []; for (var i = 0; i < sel.length; i++) { res.push(await datosGrupo(sel[i])); }
          var triTxt = sTri.selectedOptions[0].text;
          hoja = $('section', undefined, 'aprobados-hoja');
          hoja.innerHTML = C.htmlCuadro({ institucion: INSTITUCION, profesor: profesor, asignatura: sMat.value, nivelesTxt: C.niveles(sel.map(function (a) { return a.salon; })), trimestre: triTxt, anio: sAnio.value, jornada: sJor.value, resumenes: res, mostrarExamen: C.llave(sMat.value) !== 'informatica' });
          salida.replaceChildren(hoja);
          nombrePdf = 'Cuadro_Aprobados_' + (C.llave(sMat.value).replace(/[^a-z0-9]+/g, '_') || 'materia') + '_' + triTxt.replace(/\s+/g, '_') + '.pdf';
          avisos.replaceChildren();
          var sin = res.filter(function (r) { return r.sinSexo.length; });
          if (sin.length) { var w = $('div', undefined, 'aprobados-aviso-sexo'); w.append($('b', '⚠️ Estudiantes sin género registrado (cuentan en el TOTAL, pero no en M/F). Complete el dato en la ficha del estudiante:'));
            sin.forEach(function (r) { w.append($('p', r.grupo + ': ' + r.sinSexo.join('; '))); }); avisos.append(w); }
          avisos.append($('p', res.every(function (r) { return r.cerrado; }) ? 'Trimestre cerrado (cálculo con datos actuales de la libreta).' : 'Resultados provisionales: el trimestre no está cerrado o falta cerrar algún grupo.', 'bloque-ayuda'));
          bPdf.hidden = bImp.hidden = false;
        } catch (e) { error(e); } finally { bGen.disabled = false; }
      }
      // Retirados editables: recalcula la fila TOTALES.
      salida.addEventListener('input', function (ev) {
        var c = ev.target.closest && ev.target.closest('td.ed'); if (!c) { return; }
        ['h', 'm'].forEach(function (k) { var s = 0; hoja.querySelectorAll('td.ed[data-k="' + k + '"]').forEach(function (x) { s += parseInt(x.textContent, 10) || 0; }); hoja.querySelector('td.tot-ret[data-k="' + k + '"]').textContent = s; });
      });
      async function descargarPdf() {
        bPdf.disabled = true;
        try {
          if (!window.html2canvas || !window.jspdf) { throw Error('No cargaron las librerías de PDF. Revise internet y recargue (Ctrl+F5).'); }
          await document.fonts.ready; hoja.classList.add('capturando');
          var cv = await window.html2canvas(hoja, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true }); hoja.classList.remove('capturando');
          var pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }), W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), m = 12;
          var k = Math.min((W - 2 * m) / cv.width, (H - 2 * m) / cv.height), w = cv.width * k, h = cv.height * k;
          pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', (W - w) / 2, (H - h) / 2, w, h); pdf.save(nombrePdf);
        } catch (e) { error(e); } finally { hoja.classList.remove('capturando'); bPdf.disabled = false; }
      }
      bGen.onclick = generar; bPdf.onclick = descargarPdf; bImp.onclick = function () { window.print(); };

      await refrescar();
      var param = new URLSearchParams(location.search).get('asignacion'), a0 = param && asig.find(function (x) { return x.id === param; });
      if (a0) { sAnio.value = String(a0.salon.anio.anio); await refrescar(); sMat.value = a0.materia.nombre; actChips(); }
    } catch (e) { root.replaceChildren($('p', 'No se pudo abrir el cuadro: ' + (e.message || e), 'mensaje error')); }
  }
  main();
})();
