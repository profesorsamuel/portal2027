/* portal2027-documentos.js — documentos privados (guía, etapa 8, parte B).
   Estudiante: sube y sustituye sus documentos. Administración: tipos, revisión y faltantes. Consejero: revisión y faltantes de su grupo.
   Archivos en el bucket privado portal2027-documentos (ruta: estudiante/año/tipo/archivo), siempre abiertos con enlace temporal.
   Las escrituras pasan por portal2027_registrar_documento y portal2027_revisar_documento; la base vuelve a validar todo. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  var D = (P.docs = {
    BUCKET: 'portal2027-documentos',
    MAX: 5 * 1024 * 1024,
    ACEPTAR: '.pdf,.jpg,.jpeg,.png'
  });
  var MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  var ESTADOS = { pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' };

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function nombreEst(e) { return ((e.apellidos || '') + ', ' + (e.nombres || '')).replace(/^, |, $/g, ''); }

  D.validar = function (archivo) {
    if (!archivo) { return { error: 'Elija un archivo.' }; }
    var m = /\.([A-Za-z0-9]+)$/.exec(archivo.name || '');
    var tipo = m ? MIME[m[1].toLowerCase()] : null;
    if (!tipo) { return { error: 'Tipo de archivo no permitido. Use PDF, JPG o PNG.' }; }
    if (archivo.size === 0) { return { error: 'El archivo está vacío.' }; }
    if (archivo.size > D.MAX) { return { error: 'El archivo pesa más de 5 MB.' }; }
    return { tipo: tipo };
  };

  D.nombreSeguro = function (nombre) {
    var limpio = String(nombre || 'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_');
    var m = /(\.[A-Za-z0-9]+)$/.exec(limpio);
    var ext = m ? m[1] : '';
    var base = ext ? limpio.slice(0, -ext.length) : limpio;
    return (base.slice(0, 60) || 'archivo') + ext.toLowerCase();
  };

  // Abre un archivo privado en otra pestaña con enlace temporal (10 minutos).
  D.abrir = async function (ruta) {
    var w = window.open('', '_blank');
    try {
      var r = await db.storage.from(D.BUCKET).createSignedUrl(ruta, 600);
      if (r.error) { throw r.error; }
      if (w) { w.location.href = r.data.signedUrl; } else { window.location.assign(r.data.signedUrl); }
    } catch (e) {
      if (w) { w.close(); }
      throw e;
    }
  };

  D.fecha = function (iso) {
    var d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-PA', { dateStyle: 'medium' }) : '';
  };

  D.textoError = function (e) {
    var m = (e && e.message) || '';
    if (/^CONFLICTO/.test(m)) { return m.replace(/^CONFLICTO:\s*/, 'Conflicto: ') + ' Pulse «Recargar».'; }
    if (/mime type|not supported|invalid_mime/i.test(m)) { return 'Tipo de archivo no permitido. Use PDF, JPG o PNG.'; }
    if (/maximum allowed size|too large|payload/i.test(m)) { return 'El archivo pesa más de 5 MB.'; }
    if (/new row violates row-level security/i.test(m)) { return 'No tiene permiso para subir este documento (¿ya fue aprobado?).'; }
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) { return 'No hay conexión con el servidor. Revise su internet e intente de nuevo.'; }
    if (/ya fue aprobado|no está disponible|no corresponde|no se encontró|observación|matriculado|pesa más|no permitido|no es válido|no existe|No tiene permiso/i.test(m)
        && !/duplicate key/i.test(m)) {
      return m.replace(/\s*\(row-level security\)/, '');
    }
    return P.traducirError(e);
  };

  function chip(estado) { return el('span', { clase: 'doc-chip doc-' + estado, texto: ESTADOS[estado] || estado }); }
  function btn(texto, fn, extra) {
    return el('button', { clase: 'boton boton-secundario boton-chico' + (extra ? ' ' + extra : ''), type: 'button', texto: texto, onclick: fn });
  }
  function tabla(cab, filas, vacio) {
    if (filas.length === 0) { return el('p', { clase: 'vacio-texto', texto: vacio }); }
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cab.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }
  function barra() {
    var b = el('p', { clase: 'mensaje', role: 'status', 'aria-live': 'polite', hidden: true });
    b.poner = function (texto, tipo) { b.textContent = texto; b.className = 'mensaje ' + (tipo || 'info'); b.hidden = !texto; };
    return b;
  }

  // ---------------------------------------------------------------- Estudiante
  P.renderDocumentosEstudiante = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis documentos' })]);
    zona.appendChild(sec);

    var mats = await consultar(db.from('portal2027_matriculas').select('estudiante_id,anio_id,anio:portal2027_anios(anio)'));
    mats = mats.filter(function (m) { return m.anio; }).sort(function (a, b) { return b.anio.anio - a.anio.anio; });
    if (mats.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no tiene una matrícula registrada.' })); return; }
    var mat = mats[0];

    sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Año lectivo ' + mat.anio.anio + '. Formatos PDF, JPG o PNG, hasta 5 MB. Puede reemplazar un documento mientras no esté aprobado.' }));
    var msg = barra();
    var cont = el('ul', { clase: 'doc-lista' });
    sec.appendChild(msg);
    sec.appendChild(cont);

    function tarjeta(t, doc) {
      var hijos = [el('div', null, [
        el('strong', { texto: t.nombre }),
        el('span', { clase: 'doc-chip', texto: t.obligatorio ? 'Obligatorio' : 'Opcional' }),
        doc ? chip(doc.estado) : el('span', { clase: 'doc-chip', texto: 'Sin subir' })
      ])];
      if (doc) {
        hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Su archivo: ' + doc.archivo_nombre + ' · subido el ' + D.fecha(doc.subido_en) }));
        hijos.push(el('div', { clase: 'cabecera-acciones' }, [btn('Abrir mi archivo', async function () {
          try { await D.abrir(doc.archivo_ruta); } catch (e) { msg.poner('No se pudo abrir el archivo. ' + D.textoError(e), 'error'); }
        })]));
        if (doc.estado === 'rechazado') { hijos.push(el('p', { clase: 'mensaje error', texto: 'Motivo del rechazo: ' + doc.observacion + ' Suba un documento corregido.' })); }
        if (doc.estado === 'aprobado') { hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Documento aprobado. Si necesita cambiarlo, comuníquese con la administración.' })); }
      }
      if (!doc || doc.estado !== 'aprobado') {
        var archivo = el('input', { type: 'file', accept: D.ACEPTAR });
        var enviar = el('button', { clase: 'boton boton-principal-chico', type: 'submit', texto: doc ? 'Sustituir documento' : 'Subir documento' });
        var f = el('form', { clase: 'doc-formulario' }, [el('label', null, ['Archivo (PDF, JPG o PNG, hasta 5 MB)', archivo]), enviar]);
        f.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var arch = archivo.files[0];
          var v = D.validar(arch);
          if (v.error) { msg.poner(v.error, 'error'); return; }
          enviar.disabled = true;
          msg.poner('Subiendo su documento…', 'info');
          try {
            var ruta = mat.estudiante_id + '/' + mat.anio_id + '/' + t.id + '/' + Date.now() + '-' + D.nombreSeguro(arch.name);
            var s = await db.storage.from(D.BUCKET).upload(ruta, arch, { contentType: v.tipo, cacheControl: '0', upsert: false });
            if (s.error) { throw s.error; }
            var g = await db.rpc('portal2027_registrar_documento', { p_estudiante: mat.estudiante_id, p_anio: mat.anio_id, p_tipo: t.id, p_ruta: ruta, p_nombre: arch.name });
            if (g.error) { throw g.error; }
            await cargar();
            msg.poner('Documento recibido. Queda en revisión.', 'ok');
          } catch (e) {
            enviar.disabled = false;
            msg.poner('No se guardó su documento. ' + D.textoError(e), 'error');
          }
        });
        hijos.push(f);
      }
      return el('li', { clase: 'doc-tarjeta' }, hijos);
    }

    async function cargar() {
      try {
        var r = await Promise.all([
          consultar(db.from('portal2027_tipos_documento').select('id,nombre,obligatorio').eq('activo', true).order('nombre')),
          consultar(db.from('portal2027_documentos').select('id,tipo_id,archivo_ruta,archivo_nombre,estado,observacion,subido_en')
            .eq('estudiante_id', mat.estudiante_id).eq('anio_id', mat.anio_id))
        ]);
        var porTipo = {};
        r[1].forEach(function (d) { porTipo[d.tipo_id] = d; });
        cont.textContent = '';
        if (r[0].length === 0) { cont.appendChild(el('li', { clase: 'vacio-texto', texto: 'La administración todavía no ha definido documentos para entregar.' })); return; }
        r[0].forEach(function (t) { cont.appendChild(tarjeta(t, porTipo[t.id])); });
      } catch (e) {
        cont.textContent = '';
        msg.poner('No se pudo cargar. ' + D.textoError(e), 'error');
      }
    }
    cont.appendChild(el('li', { clase: 'texto-estado', texto: 'Cargando…' }));
    await cargar();
  };

  // ---------------------------------------------------------------- Revisión y faltantes (administración y consejería)
  function panelRevision(sec, grupos) {
    var selGrupo = el('select', { 'aria-label': 'Grupo' }, grupos.map(function (g) { return el('option', { value: g.id, texto: g.nombre + ' (' + g.anio.anio + ')' }); }));
    var selEstado = el('select', { 'aria-label': 'Mostrar' }, [
      el('option', { value: 'pendiente', texto: 'Por revisar' }), el('option', { value: 'todos', texto: 'Todos' }),
      el('option', { value: 'aprobado', texto: 'Aprobados' }), el('option', { value: 'rechazado', texto: 'Rechazados' })
    ]);
    var msg = barra();
    var zonaFalt = el('div'), zonaTabla = el('div');
    sec.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Grupo', selGrupo]), el('label', null, ['Mostrar', selEstado]),
      btn('Recargar', function () { cargar(); })]));
    sec.appendChild(msg);
    sec.appendChild(el('div', { clase: 'doc-subbloque' }, [el('h3', { texto: 'Documentos' }), zonaTabla]));
    sec.appendChild(el('div', { clase: 'doc-subbloque' }, [el('h3', { texto: 'Faltantes del grupo' }), zonaFalt]));

    var ficha = 0;
    function grupo() { return grupos.filter(function (g) { return g.id === selGrupo.value; })[0]; }

    async function revisar(doc, estado, obs) {
      if (estado === 'rechazado' && !obs.trim()) { msg.poner('Escriba la observación para rechazar el documento.', 'error'); return; }
      try {
        var r = await db.rpc('portal2027_revisar_documento', { p_documento: doc.id, p_version: doc.version, p_estado: estado, p_observacion: obs });
        if (r.error) { throw r.error; }
        await cargar();
        msg.poner(estado === 'aprobado' ? 'Documento aprobado.' : 'Documento rechazado.', 'ok');
      } catch (e) { msg.poner('No se guardó la revisión. ' + D.textoError(e), 'error'); }
    }

    function filaDoc(d, est) {
      var obs = el('input', { clase: 'doc-obs', type: 'text', maxlength: '1000', 'aria-label': 'Observación', placeholder: 'Observación (obligatoria para rechazar)', value: d.estado === 'rechazado' ? d.observacion : '' });
      return el('tr', null, [
        el('td', { texto: nombreEst(est) }), el('td', { texto: d.tipo ? d.tipo.nombre : '' }),
        el('td', { texto: d.archivo_nombre }), el('td', { texto: D.fecha(d.subido_en) }), el('td', null, [chip(d.estado)]),
        el('td', null, [el('div', { clase: 'doc-acciones' }, [
          obs,
          el('div', { clase: 'cabecera-acciones' }, [
            btn('Abrir', async function () { try { await D.abrir(d.archivo_ruta); } catch (e) { msg.poner('No se pudo abrir el archivo. ' + D.textoError(e), 'error'); } }),
            btn('Aprobar', function () { revisar(d, 'aprobado', obs.value); }),
            btn('Rechazar', function () { revisar(d, 'rechazado', obs.value); }, 'boton-peligro')
          ])
        ])])
      ]);
    }

    async function cargar() {
      var mi = ++ficha, g = grupo();
      if (!g) { return; }
      zonaTabla.textContent = ''; zonaFalt.textContent = '';
      zonaTabla.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
      try {
        var mats = await consultar(db.from('portal2027_matriculas').select('id,estudiante:portal2027_estudiantes(id,codigo,nombres,apellidos)')
          .eq('salon_id', g.id).eq('anio_id', g.anio_id));
        mats = mats.filter(function (m) { return m.estudiante; });
        var porEst = {};
        mats.forEach(function (m) { porEst[m.estudiante.id] = m.estudiante; });
        var ids = Object.keys(porEst);
        var docs = ids.length ? await consultar(db.from('portal2027_documentos')
          .select('id,estudiante_id,archivo_ruta,archivo_nombre,estado,observacion,subido_en,version,tipo:portal2027_tipos_documento(nombre)')
          .eq('anio_id', g.anio_id).in('estudiante_id', ids)) : [];
        var fa = await db.rpc('portal2027_faltantes_documentos', { p_salon: g.id, p_anio: g.anio_id });
        if (fa.error) { throw fa.error; }
        if (mi !== ficha) { return; }

        var ver = selEstado.value;
        var lista = docs.filter(function (d) { return ver === 'todos' || d.estado === ver; })
          .sort(function (a, b) { return nombreEst(porEst[a.estudiante_id]).localeCompare(nombreEst(porEst[b.estudiante_id]), 'es'); });
        zonaTabla.textContent = '';
        zonaTabla.appendChild(tabla(['Estudiante', 'Documento', 'Archivo', 'Subido', 'Estado', 'Revisión'],
          lista.map(function (d) { return filaDoc(d, porEst[d.estudiante_id]); }),
          ver === 'pendiente' ? 'No hay documentos por revisar en este grupo.' : 'No hay documentos con este filtro.'));

        zonaFalt.textContent = '';
        var f = fa.data;
        if (f.obligatorios === 0) {
          zonaFalt.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay tipos de documento obligatorios activos; por eso no hay faltantes que calcular.' }));
          return;
        }
        var porMat = {}, orden = [];
        f.faltantes.forEach(function (x) { if (!porMat[x.matricula_id]) { porMat[x.matricula_id] = { est: porEst[x.estudiante_id], items: [] }; orden.push(x.matricula_id); } porMat[x.matricula_id].items.push(x); });
        orden.sort(function (a, b) { return nombreEst(porMat[a].est).localeCompare(nombreEst(porMat[b].est), 'es'); });
        zonaFalt.appendChild(tabla(['Estudiante', 'Código', 'Falta'], orden.map(function (k) {
          var p = porMat[k];
          return el('tr', null, [el('td', { texto: nombreEst(p.est) }), el('td', { texto: p.est.codigo }),
            el('td', { texto: p.items.map(function (x) { return x.tipo + (x.motivo === 'rechazado' ? ' (rechazado)' : ''); }).join(' · ') })]);
        }), 'Ningún estudiante tiene documentos obligatorios pendientes de entregar.'));
        if (f.pendientes.length) { zonaFalt.appendChild(el('p', { clase: 'bloque-ayuda', texto: f.pendientes.length + ' documento(s) esperan revisión; no cuentan como faltantes.' })); }
      } catch (e) {
        if (mi !== ficha) { return; }
        zonaTabla.textContent = ''; zonaFalt.textContent = '';
        msg.poner('No se pudo cargar. ' + D.textoError(e), 'error');
      }
    }
    selGrupo.addEventListener('change', function () { msg.poner('', 'info'); cargar(); });
    selEstado.addEventListener('change', function () { cargar(); });
    return cargar();
  }

  // ---------------------------------------------------------------- Administración
  P.renderDocumentosAdmin = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Documentos de estudiantes' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Defina qué documentos se piden; luego revise lo que suben los estudiantes y vea quién falta. Administración y el consejero del grupo revisan; los profesores no tienen acceso.' })]);
    zona.appendChild(sec);

    // Tipos de documento
    var msgT = barra();
    var zonaTipos = el('div');
    var codigo = el('input', { type: 'text', maxlength: '40', required: true, placeholder: 'ej. cedula', 'aria-label': 'Código' });
    var nombre = el('input', { type: 'text', maxlength: '120', required: true, placeholder: 'ej. Cédula del estudiante', 'aria-label': 'Nombre' });
    var oblig = el('input', { type: 'checkbox', checked: true });
    var form = el('form', { clase: 'formulario-fila' }, [
      el('label', null, ['Código (minúsculas, números y _)', codigo]), el('label', null, ['Nombre', nombre]),
      el('label', null, [oblig, ' Obligatorio']), el('button', { clase: 'boton boton-principal', type: 'submit', texto: 'Crear tipo' })]);
    sec.appendChild(el('div', { clase: 'doc-subbloque' }, [el('h3', { texto: 'Tipos de documento' }), form, msgT, zonaTipos]));

    async function tipos() {
      try {
        var lista = await consultar(db.from('portal2027_tipos_documento').select('id,codigo,nombre,obligatorio,activo').order('nombre'));
        zonaTipos.textContent = '';
        zonaTipos.appendChild(tabla(['Código', 'Nombre', 'Obligatorio', 'Activo', ''], lista.map(function (t) {
          function cambiar(campo, valor) {
            return async function () {
              try {
                var u = {}; u[campo] = valor;
                var r = await db.from('portal2027_tipos_documento').update(u).eq('id', t.id);
                if (r.error) { throw r.error; }
                await tipos();
              } catch (e) { msgT.poner('No se guardó el cambio. ' + D.textoError(e), 'error'); }
            };
          }
          return el('tr', null, [el('td', { texto: t.codigo }), el('td', { texto: t.nombre }), el('td', { texto: t.obligatorio ? 'Sí' : 'No' }),
            el('td', { texto: t.activo ? 'Sí' : 'No' }),
            el('td', null, [el('div', { clase: 'cabecera-acciones' }, [
              btn(t.obligatorio ? 'Marcar opcional' : 'Marcar obligatorio', cambiar('obligatorio', !t.obligatorio)),
              btn(t.activo ? 'Desactivar' : 'Activar', cambiar('activo', !t.activo))])])]);
        }), 'Todavía no hay tipos de documento. Cree el primero arriba.'));
      } catch (e) { msgT.poner('No se pudieron cargar los tipos. ' + D.textoError(e), 'error'); }
    }
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var c = codigo.value.trim().toLowerCase();
      if (!/^[a-z0-9_]{2,40}$/.test(c)) { msgT.poner('El código debe tener de 2 a 40 letras minúsculas, números o _ (sin espacios ni acentos).', 'error'); return; }
      try {
        var r = await db.from('portal2027_tipos_documento').insert({ codigo: c, nombre: nombre.value.trim(), obligatorio: oblig.checked });
        if (r.error) { throw r.error; }
        codigo.value = ''; nombre.value = '';
        await tipos();
        msgT.poner('Tipo creado.', 'ok');
      } catch (e) { msgT.poner('No se creó el tipo. ' + D.textoError(e), 'error'); }
    });
    await tipos();

    // Revisión y faltantes
    var grupos = await consultar(db.from('portal2027_salones').select('id,nombre,anio_id,anio:portal2027_anios(anio)'));
    grupos = grupos.filter(function (g) { return g.anio; }).sort(function (a, b) { return b.anio.anio - a.anio.anio || a.nombre.localeCompare(b.nombre); });
    var rev = el('div', { clase: 'doc-subbloque' }, [el('h3', { texto: 'Revisión y faltantes por grupo' })]);
    sec.appendChild(rev);
    if (grupos.length === 0) { rev.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay grupos.' })); return; }
    await panelRevision(rev, grupos);
  };

  // ---------------------------------------------------------------- Consejería
  P.renderDocumentosConsejeria = async function (zona, info) {
    var asign = await consultar(db.from('portal2027_consejeros_salon')
      .select('salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio))').eq('consejero_id', info.sesion.user.id));
    var grupos = asign.map(function (a) { return a.salon; }).filter(function (s) { return s && s.anio; })
      .sort(function (a, b) { return b.anio.anio - a.anio.anio || a.nombre.localeCompare(b.nombre); });
    if (grupos.length === 0) { return; }
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Documentos del grupo' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Revise los documentos que suben sus estudiantes. Rechazar exige una observación.' })]);
    zona.appendChild(sec);
    await panelRevision(sec, grupos);
  };
})();
