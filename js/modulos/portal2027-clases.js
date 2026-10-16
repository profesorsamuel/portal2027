/* portal2027-clases.js — clases y tareas (guía, etapa 5, parte B): pantalla del profesor y administración.
   Materiales, tareas con plazo, entregas y revisión por asignación y trimestre.
   Todo cambio pasa por funciones de la base (permisos, versión); aquí solo se muestra el resultado real. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var C = P.clases;
  var F = P.archivos;
  var M = P.evaluacion;
  var contenido = document.getElementById('contenido');

  var S = {
    plan: [], claseId: null, tipoMaterial: null, asig: null, trimestres: [], trimestreId: null,
    materiales: [], tareas: [], evals: [], mats: [], entregas: [], adjuntos: [], notas: {},   // notas: evalId|matId -> {valor}
    verPapelera: false, nuevaTarea: false, editando: null, abierta: null, revisando: null, adjuntosDisponibles: true   // abierta = tareaId; revisando = matriculaId
  };
  var estado = null;
  var zona = null;

  /* ---------- utilidades ---------- */
  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function aviso(texto, tipo) {
    estado.textContent = texto;
    estado.className = 'mensaje estado-panel ' + (tipo || 'info');
    estado.hidden = !texto;
  }
  function errorPantalla(texto) {
    contenido.textContent = '';
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: texto }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }
  function nombreEst(m) {
    var e = m.estudiante || {};
    return ((e.apellidos || '') + ', ' + (e.nombres || '')).replace(/^, |, $/g, '');
  }
  function tareaPorId(id) { return S.tareas.filter(function (t) { return t.id === id; })[0]; }
  function entregaDe(tareaId, matId) {
    return S.entregas.filter(function (e) { return e.tarea_id === tareaId && e.matricula_id === matId; })[0];
  }
  function evalPorId(id) { return S.evals.filter(function (e) { return e.id === id; })[0]; }
  function etiquetaEval(e) {
    return (M && M.ETIQUETAS && M.ETIQUETAS[e.categoria] ? M.ETIQUETAS[e.categoria] : e.categoria) + (e.tema ? ' — ' + e.tema : '');
  }
  function boton(texto, fn, extra) {
    return el('button', { clase: 'boton boton-secundario boton-chico' + (extra ? ' ' + extra : ''), type: 'button', texto: texto, onclick: fn });
  }
  function chip(texto, tipo) { return el('span', { clase: 'chip' + (tipo ? ' chip-' + tipo : ''), texto: texto }); }
  function campo(texto, control) { return el('label', null, [texto, control]); }

  // Ejecuta una acción de escritura y muestra el resultado real (nunca «guardado» si falló).
  // Separa «no se guardó» de «se guardó pero no se pudo recargar»: si la escritura ya ocurrió,
  // no se debe decir que falló, porque el usuario volvería a crear el mismo registro.
  async function accion(textoOcupado, textoOk, fn) {
    aviso(textoOcupado, 'info');
    try { await fn(); }
    catch (e) { aviso('No se guardó. ' + C.textoError(e), 'error'); return false; }
    try {
      await cargar();
      dibujar();
      aviso(textoOk, 'ok');
    } catch (e) {
      console.error('Recargar clases después de guardar', e);
      aviso('Se guardó, pero no se pudo actualizar la pantalla. Pulse «Recargar» antes de seguir.', 'info');
    }
    return true;
  }

  /* ---------- carga ---------- */
  async function cargar() {
    var a = S.asig.id, t = S.trimestreId;
    var r = await Promise.all([
      consultar(db.from('portal2027_materiales').select('*').eq('asignacion_id', a).eq('trimestre_id', t).order('creado_en', { ascending: false })),
      consultar(db.from('portal2027_tareas').select('*').eq('asignacion_id', a).eq('trimestre_id', t).order('creado_en')),
      consultar(db.from('portal2027_evaluaciones').select('id,categoria,tema,orden').eq('asignacion_id', a).eq('trimestre_id', t).is('eliminada_en', null).order('orden')),
      consultar(db.from('portal2027_matriculas').select('id,estudiante:portal2027_estudiantes(codigo,nombres,apellidos)').eq('salon_id', S.asig.salon.id))
    ]);
    S.plan = await consultar(db.from('portal2027_plan_clases').select('id,numero,tema,fecha_inicio,fecha_fin,visible_estudiantes').eq('asignacion_id', a).eq('trimestre_id', t).is('eliminada_en', null).order('numero'));
    if (S.claseId && !S.plan.some(function(c) { return c.id === S.claseId; })) S.claseId = null;
    S.materiales = r[0]; S.tareas = r[1]; S.evals = r[2];
    S.mats = r[3].sort(function (x, y) { return nombreEst(x).localeCompare(nombreEst(y), 'es'); });
    S.entregas = []; S.adjuntos = []; S.notas = {};
    var ids = S.tareas.map(function (x) { return x.id; });
    if (ids.length) {
      S.entregas = await consultar(db.from('portal2027_entregas').select('*').in('tarea_id', ids));
      try {
        S.adjuntos = await consultar(db.from('portal2027_tareas_adjuntos').select('*').in('tarea_id', ids).order('orden'));
        S.adjuntosDisponibles = true;
      } catch (e) {
        // Normalmente significa que falta ejecutar la migración 0050 en Supabase.
        console.error('Adjuntos de tareas no disponibles', e);
        S.adjuntos = []; S.adjuntosDisponibles = false;
      }
    }
    var evIds = S.tareas.filter(function (x) { return x.evaluacion_id; }).map(function (x) { return x.evaluacion_id; });
    if (evIds.length) {
      var ns = await consultar(db.from('portal2027_notas').select('evaluacion_id,matricula_id,valor').in('evaluacion_id', evIds));
      ns.forEach(function (n) { S.notas[n.evaluacion_id + '|' + n.matricula_id] = n; });
    }
  }

  function selectorMover(item, tipo) {
    var sel = el('select', { 'aria-label': 'Mover a clase' }, [el('option', { value: '', texto: 'Sin clase asignada', selected: !item.clase_id })].concat(S.plan.map(function(c) { return el('option', { value: c.id, texto: 'Clase ' + c.numero + ' · ' + c.tema, selected: item.clase_id === c.id }); })));
    sel.addEventListener('change', function() {
      accion('Moviendo…', 'Recurso ubicado en la clase.', async function() {
        var r = await db.rpc('portal2027_ubicar_recurso_clase', { p_id: item.id, p_tipo: tipo, p_clase: sel.value || null, p_version: tipo === 'tarea' ? item.version : null });
        if (r.error) throw r.error;
      });
    });
    return sel;
  }
  function navegacionClases() {
    var sec = el('section', { clase: 'bloque clases-navegacion' }, [el('h2', { texto: '📚 Clases del trimestre' }), el('p', { clase: 'bloque-ayuda', texto: 'Seleccione una clase para agregar su PDF, imágenes, enlaces y tareas.' })]);
    var opciones = S.plan.concat([{ id: null, numero: null, tema: 'Sin clase asignada' }]);
    sec.appendChild(el('div', { clase: 'clases-cuadricula' }, opciones.map(function(c) {
      var nm = S.materiales.filter(function(m) { return (m.clase_id || null) === c.id && !m.eliminado_en; }).length;
      var nt = S.tareas.filter(function(t) { return (t.clase_id || null) === c.id && !t.eliminada_en; }).length;
      var esSin = c.numero === null;
      var selector = el('button', { type: 'button', clase: 'clase-selector' + (S.claseId === c.id ? ' activa' : ''), 'aria-pressed': S.claseId === c.id ? 'true' : 'false', onclick: function() { S.claseId = c.id; S.tipoMaterial = null; S.editando = null; S.nuevaTarea = false; S.abierta = null; S.revisando = null; dibujar(); } }, [
        el('span', { clase: 'clase-num', texto: esSin ? '·' : 'Clase ' + c.numero }),
        el('strong', { texto: esSin ? c.tema : c.tema }),
        c.fecha_inicio ? el('small', { clase: 'clase-fechas', texto: '📅 ' + c.fecha_inicio + ' → ' + c.fecha_fin }) : null,
        el('span', { clase: 'clase-conteo' }, [chip('📎 ' + nm, nm ? 'azul' : ''), chip('✏️ ' + nt, nt ? 'ambar' : '')])
      ]);
      if (esSin) return selector;
      var check = el('input', { type: 'checkbox', checked: c.visible_estudiantes !== false });
      check.addEventListener('change', async function () {
        var nuevo = check.checked; check.disabled = true;
        var ok = await accion('Actualizando visibilidad…', nuevo ? 'Clase publicada para los estudiantes.' : 'Clase oculta para los estudiantes.', async function () {
          var r = await db.rpc('portal2027_visibilidad_clase', { p_clase: c.id, p_visible: nuevo });
          if (r.error) throw r.error;
        });
        if (!ok) { check.checked = !nuevo; check.disabled = false; }
      });
      return el('div', { clase: 'clase-control-visibilidad' }, [selector, el('label', { clase: 'clase-publicacion' }, [check, el('span', { texto: c.visible_estudiantes !== false ? 'Visible a estudiantes' : 'Oculta a estudiantes' })])]);
    })));
    if (!S.plan.length) sec.appendChild(el('p', { clase: 'mensaje info', texto: 'Agregue las clases en Planificación para organizar sus recursos.' }));
    sec.appendChild(el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-planificacion.html?asignacion=' + encodeURIComponent(S.asig.id), texto: 'Ir a Planificación' }));
    var actual = S.plan.filter(function(c) { return c.id === S.claseId; })[0];
    sec.appendChild(el('h3', { clase: 'clase-actual', texto: '➡️ ' + (actual ? 'Clase ' + actual.numero + ' · ' + actual.tema : 'Sin clase asignada') }));
    return sec;
  }

  function habilitarArrastre(formulario, entrada, recibir) {
    var zonaDrop = el('div', { clase: 'zona-soltar', role: 'note', texto: 'Arrastre y suelte aquí sus archivos, o selecciónelos arriba.' });
    if (entrada.parentNode) entrada.parentNode.appendChild(zonaDrop); else formulario.appendChild(zonaDrop);
    ['dragenter', 'dragover'].forEach(function(t) { zonaDrop.addEventListener(t, function(e) { e.preventDefault(); zonaDrop.classList.add('sobre'); }); });
    ['dragleave', 'drop'].forEach(function(t) { zonaDrop.addEventListener(t, function(e) { e.preventDefault(); zonaDrop.classList.remove('sobre'); }); });
    zonaDrop.addEventListener('drop', function(e) { if (e.dataTransfer && e.dataTransfer.files.length) recibir(e.dataTransfer.files); });
  }

  /* ---------- materiales ---------- */
  // Una tanda conserva sus resultados y títulos para reintentar solo fallidas.
  function formImagenes() {
    var items = [], ocupado = false, preparando = false, contexto = null;
    var titulo = el('input', { type: 'text', maxlength: '110' });
    var desc = el('textarea', { rows: '2', maxlength: '2000' });
    var archivo = el('input', { type: 'file', accept: '.jpg,.jpeg,.png', multiple: true });
    var pub = el('input', { type: 'checkbox', checked: true });
    var lista = el('ul', { clase: 'fotos-previas' });
    var resumen = el('div', { role: 'status', 'aria-live': 'polite' });
    var progreso = el('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Fotos procesadas' });
    var textoProgreso = el('p', { texto: '', 'aria-live': 'polite' });
    var enviar = el('button', { type: 'submit', clase: 'boton boton-principal-chico', texto: 'Subir fotos' });
    var reintentar = boton('Reintentar las fallidas', function () { subir(true); });
    reintentar.hidden = true;
    var f = el('form', { clase: 'formulario-clases' }, [
      campo('Título (opcional; se numerará si hay varias fotos)', titulo), campo('Descripción (opcional)', desc),
      campo('Fotos JPG o PNG (máximo 40 por tanda)', archivo), lista,
      el('label', { clase: 'etiqueta-check' }, [pub, 'Visible para los estudiantes']),
      enviar, progreso, textoProgreso, resumen, reintentar
    ]);
    function peso(a) { return F.peso(a.size); }
    function dibujarPrevias() {
      lista.textContent = '';
      items.forEach(function (it) {
        var imagen = el('img', { clase: 'foto-previa-miniatura', alt: 'Vista previa de ' + it.original.name });
        var url = URL.createObjectURL(it.final || it.original);
        imagen.onload = imagen.onerror = function () { URL.revokeObjectURL(url); };
        imagen.src = url;
        var quitar = boton('Quitar', function () { items = items.filter(function (x) { return x !== it; }); dibujarPrevias(); });
        quitar.disabled = preparando || ocupado || !!contexto;
        lista.appendChild(el('li', null, [imagen, el('div', null, [
          el('strong', { texto: it.original.name }),
          el('small', { texto: 'Original: ' + peso(it.original) + ' · Final: ' + (it.final ? peso(it.final) : 'Sin preparar') }),
          el('small', { texto: it.error || (it.ok ? 'Subida' : 'Lista para subir') })
        ]), quitar]));
      });
    }
    archivo.addEventListener('change', function () { agregarFotos(Array.prototype.slice.call(archivo.files || [])); archivo.value = ''; });
    async function agregarFotos(elegidas) {
      if (ocupado || preparando) { return; }
      if (items.length + elegidas.length > 40) { aviso('Puede elegir hasta 40 fotos por tanda. Quite algunas antes de agregar más.', 'error'); return; }
      preparando = true; archivo.disabled = true; enviar.disabled = true;
      // Empezar una nueva tanda después de terminar la anterior.
      contexto = null; resumen.textContent = ''; reintentar.hidden = true;
      for (var i = 0; i < elegidas.length; i++) {
        var it = { original: elegidas[i], final: null, ok: false, error: '' };
        items.push(it);
        try {
          if (!/\.(jpe?g|png)$/i.test(it.original.name)) { throw new Error('Elija una foto JPG o PNG.'); }
          it.final = await C.reducirImagen(it.original);
          var validacion = C.validar(it.final);
          if (validacion.error) { throw new Error(validacion.error); }
        } catch (e) { console.error('Preparación de foto', it.original.name, e); it.error = F.errorTamano(it.final || it.original, 'materiales') || 'No se pudo preparar esta foto. Quite el archivo y elija otra imagen JPG o PNG.'; }
        dibujarPrevias();
      }
      preparando = false; archivo.disabled = false; enviar.disabled = false; dibujarPrevias();
    }
    async function subir(esReintento) {
      if (ocupado || preparando) { return; }
      if (!items.length) { aviso('Elija al menos una foto.', 'error'); return; }
      if (!esReintento) {
        contexto = { asignacion: S.asig.id, trimestre: S.trimestreId, clase: S.claseId, descripcion: desc.value, publicado: pub.checked };
        var base = titulo.value.trim();
        items.forEach(function (it, i) { it.titulo = base ? base + (items.length > 1 ? ' ' + (i + 1) : '') : it.original.name.slice(0, 120); });
      }
      var tanda = items.filter(function (it) { return !it.ok; });
      if (!tanda.length) { return; }
      ocupado = true; enviar.disabled = true; reintentar.disabled = true;
      // Evita cambiar de clase o reconstruir el formulario mientras sube.
      var controles = Array.prototype.slice.call(zona.querySelectorAll('button,input,select,textarea'));
      var anteriores = controles.map(function (c) { var d = c.disabled; c.disabled = true; return d; });
      progreso.hidden = false; progreso.max = tanda.length; progreso.value = 0;
      for (var i = 0; i < tanda.length; i++) {
        var it = tanda[i];
        textoProgreso.textContent = (i + 1) + ' de ' + tanda.length + ': ' + it.original.name;
        try {
          if (it.rutaPendiente) {
            var limpieza = await db.storage.from(C.BUCKET_MATERIALES).remove([it.rutaPendiente]);
            if (limpieza.error) { throw limpieza.error; }
            it.rutaPendiente = null;
          }
          if (!/\.(jpe?g|png)$/i.test(it.original.name)) { throw new Error('Elija una foto JPG o PNG.'); }
          if (!it.final) { it.final = await C.reducirImagen(it.original); }
          var v = C.validar(it.final);
          if (v.error) { throw new Error(v.error); }
          var ruta = contexto.asignacion + '/' + Date.now() + '-' + (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2)) + '-' + C.nombreSeguro(it.final.name);
          var s = await db.storage.from(C.BUCKET_MATERIALES).upload(ruta, it.final, { contentType: v.tipo, cacheControl: '0', upsert: false });
          if (s.error) { throw s.error; }
          it.rutaPendiente = ruta;
          var g = await db.rpc('portal2027_crear_material_clase', {
            p_asignacion: contexto.asignacion, p_trimestre: contexto.trimestre, p_clase: contexto.clase,
            p_titulo: it.titulo, p_descripcion: contexto.descripcion, p_ruta: ruta,
            p_nombre: it.final.name, p_publicado: contexto.publicado, p_enlace: null
          });
          if (g.error) { throw g.error; }
          it.rutaPendiente = null; it.ok = true; it.error = '';
        } catch (e) {
          console.error('Subida de foto', it.original.name, e);
          it.error = 'No se pudo guardar. Revise su conexión y reintente.';
          if (it.rutaPendiente) {
            try {
              var borrado = await db.storage.from(C.BUCKET_MATERIALES).remove([it.rutaPendiente]);
              if (borrado.error) { throw borrado.error; }
              it.rutaPendiente = null;
            } catch (errorBorrado) {
              console.error('Limpieza de foto sin registro', it.rutaPendiente, errorBorrado);
              it.error = 'No se guardó y falta retirar la copia subida. Reintente para limpiar esa copia antes de subirla otra vez.';
            }
          }
        }
        progreso.value = i + 1; dibujarPrevias();
      }
      ocupado = false;
      controles.forEach(function (c, i) { c.disabled = anteriores[i]; });
      titulo.disabled = desc.disabled = pub.disabled = true;
      archivo.disabled = true; enviar.disabled = true; reintentar.disabled = false;
      var fallidas = items.filter(function (it) { return !it.ok; });
      resumen.textContent = '';
      resumen.appendChild(el('p', { texto: 'Subidas: ' + (items.length - fallidas.length) + ' · No subidas: ' + fallidas.length }));
      resumen.appendChild(el('ul', null, items.map(function (it) { return el('li', { texto: it.original.name + ': ' + (it.ok ? 'Subida' : it.error) }); })));
      reintentar.hidden = !fallidas.length;
      if (!fallidas.length) { resumen.appendChild(boton('Elegir otra tanda', function () { dibujar(); })); }
      textoProgreso.textContent = 'Tanda terminada.';
      dibujarPrevias();
      try {
        await cargar();
        var seccion = f.parentNode;
        var anterior = seccion.querySelector('.materiales-lista');
        if (anterior) { anterior.remove(); }
        var vacio = seccion.querySelector('.vacio-texto');
        if (vacio) { vacio.remove(); }
        seccion.appendChild(listaMateriales(S.materiales.filter(function (m) {
          return (m.clase_id || null) === contexto.clase && (S.verPapelera || !m.eliminado_en);
        })));
      } catch (e) { console.error('Actualizar materiales', e); aviso('La tanda terminó, pero no se pudo actualizar la lista. Pulse «Recargar».', 'error'); }
    }
    habilitarArrastre(f, archivo, function(files) { agregarFotos(files); });
    f.addEventListener('submit', function (ev) { ev.preventDefault(); subir(false); });
    return f;
  }

  function formMaterial() {
    if (S.tipoMaterial === 'imagen') { return formImagenes(); }
    var titulo = el('input', { type: 'text', maxlength: '120', required: true });
    var desc = el('textarea', { rows: '2', maxlength: '2000' });
    var archivo = el('input', { type: 'file', accept: S.tipoMaterial === 'pdf' ? '.pdf' : S.tipoMaterial === 'imagen' ? '.jpg,.jpeg,.png' : C.ACEPTAR, required: S.tipoMaterial === 'pdf' || S.tipoMaterial === 'imagen' });
    var enlace = el('input', { type: 'url', placeholder: 'https://…', required: S.tipoMaterial === 'enlace' });
    var pub = el('input', { type: 'checkbox', checked: true });
    var enviar = el('button', { clase: 'boton boton-principal-chico', type: 'submit', texto: 'Agregar material' });
    var f = el('form', { clase: 'formulario-clases' }, [
      campo('Título', titulo), campo('Descripción (opcional)', desc), S.tipoMaterial === 'enlace' ? campo('Enlace de tarea o recurso', enlace) : campo('Archivo (hasta ' + F.maxMB('materiales') + ' MB)', archivo),
      S.tipoMaterial === 'enlace' ? null : F.vincularPeso(archivo, 'materiales'),
      el('p', { clase: 'material-auto-ayuda', texto: 'Al elegir o arrastrar un archivo se guarda y publica automáticamente.' })
    ]);
    var guardando = false;
    if (S.tipoMaterial === 'pdf') habilitarArrastre(f, archivo, function(files) { if (files.length) { archivo.files = files; archivo.dispatchEvent(new Event('change')); } });
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (guardando) return;
      if (!titulo.value.trim() && archivo.files[0]) { titulo.value = archivo.files[0].name.replace(/\.[^.]+$/, '').slice(0, 120); }
      if (!titulo.value.trim()) { aviso('Escriba el título del material.', 'error'); return; }
      var arch = S.tipoMaterial === 'enlace' ? null : archivo.files[0] || null, ruta = null, nombre = null;
      if (enlace.value && !C.urlSegura(enlace.value)) { aviso('Use un enlace que empiece con https:// o http://.', 'error'); return; }
      if (arch && S.tipoMaterial === 'pdf' && !/\.pdf$/i.test(arch.name) || arch && S.tipoMaterial === 'imagen' && !/\.(png|jpe?g)$/i.test(arch.name)) { aviso('El archivo no corresponde al tipo elegido.', 'error'); return; }
      if (arch) {
        var v = C.validar(arch);
        if (v.error) { aviso(v.error, 'error'); return; }
        ruta = S.asig.id + '/' + Date.now() + '-' + C.nombreSeguro(arch.name);
        nombre = arch.name;
      }
      guardando = true; archivo.disabled = true;
      var subido = false;
      await accion('Guardando material…', 'Material guardado.', async function () {
        if (arch) {
          var s = await db.storage.from(C.BUCKET_MATERIALES).upload(ruta, arch, { contentType: C.validar(arch).tipo, cacheControl: '0', upsert: false });
          if (s.error) { throw s.error; }
          subido = true;
        }
        var g = await db.rpc('portal2027_crear_material_clase', {
          p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_titulo: titulo.value, p_descripcion: desc.value,
          p_ruta: ruta, p_nombre: nombre, p_publicado: true, p_clase: S.claseId, p_enlace: enlace.value || null
        });
        if (g.error) {
          if (subido) { await db.storage.from(C.BUCKET_MATERIALES).remove([ruta]); }   // no deja archivos sueltos
          throw g.error;
        }
      });
      guardando = false; archivo.disabled = false;
    });
    archivo.addEventListener('change', function () {
      if (archivo.files && archivo.files.length && !guardando) {
        f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });
    return f;
  }

  function filaMaterial(m) {
    var enPapelera = !!m.eliminado_en;
    var acciones = [];
    if (m.archivo_ruta && !enPapelera) {
      acciones.push(boton('Abrir archivo', function () { abrirMaterial(m); }));
    }
    if (C.urlSegura(m.enlace)) acciones.push(C.enlace(m.enlace, 'Abrir enlace'));
    acciones.push(selectorMover(m, 'material'));
    if (!enPapelera) {
      acciones.push(boton(m.publicado ? 'Ocultar' : 'Mostrar', function () { alternarVisible(m); }));
    }
    acciones.push(botonQuitar(m, enPapelera));
    return el('li', { clase: 'tarjeta-clase tarjeta-material tarjeta-material-fila' }, [
      el('div', { clase: 'material-info' }, [
        el('div', { clase: 'material-titulo-fila' }, [
          el('strong', { texto: (/\.pdf$/i.test(m.archivo_nombre || '') ? '📕 ' : (m.archivo_ruta ? '🖼️ ' : '🔗 ')) + m.titulo }),
          chip(enPapelera ? 'En papelera' : (m.publicado ? 'Visible' : 'Oculto'), enPapelera ? 'rojo' : (m.publicado ? 'verde' : 'gris'))
        ]),
        m.descripcion ? el('p', { clase: 'bloque-ayuda', texto: m.descripcion }) : null,
        m.archivo_nombre ? el('p', { clase: 'bloque-ayuda', texto: m.archivo_nombre }) : null
      ]),
      el('div', { clase: 'material-acciones' }, acciones)
    ]);
  }

  /* ---------- ayudas de materiales (fila y foto) ---------- */
  function esFoto(m) { return !!m.archivo_ruta && /\.(jpe?g|png)$/i.test(m.archivo_nombre || ''); }
  function fotosDeLaClase(m) { return S.materiales.filter(function (x) { return (x.clase_id || null) === (m.clase_id || null) && !x.eliminado_en; }); }
  async function abrirMaterial(m) {
    try { await C.abrir(C.BUCKET_MATERIALES, m.archivo_ruta); } catch (e) { aviso('No se pudo abrir el archivo. ' + C.textoError(e), 'error'); }
  }
  function alternarVisible(m) {
    accion('Guardando…', m.publicado ? 'Material oculto.' : 'Material visible.', async function () {
      var g = await db.rpc('portal2027_actualizar_material', { p_id: m.id, p_publicado: !m.publicado, p_a_papelera: null });
      if (g.error) { throw g.error; }
    });
  }
  function cambiarPapelera(m, aPapelera) {
    accion('Guardando…', aPapelera ? 'Quitado. Puede recuperarlo con «Mostrar papelera».' : 'Material restaurado.', async function () {
      var g = await db.rpc('portal2027_actualizar_material', { p_id: m.id, p_publicado: null, p_a_papelera: aPapelera });
      if (g.error) { throw g.error; }
    });
  }
  // Botón ✕ (a la papelera) o «Restaurar» si ya está en la papelera.
  function botonQuitar(m, enPapelera) {
    if (enPapelera) { return boton('↩ Restaurar', function () { cambiarPapelera(m, false); }); }
    return el('button', { clase: 'boton-quitar', type: 'button', texto: '✕', title: 'Quitar (va a la papelera)', 'aria-label': 'Quitar ' + (m.titulo || 'material'), onclick: function () { cambiarPapelera(m, true); } });
  }

  // Foto en cuadrícula compacta: miniatura que abre la presentación, ✕ para quitarla y acciones mínimas.
  function tarjetaFoto(m) {
    var enPapelera = !!m.eliminado_en;
    var miniatura = C.miniatura(m);
    var marco = enPapelera
      ? el('div', { clase: 'mat-foto-marco' }, [miniatura])
      : el('button', { clase: 'mat-foto-marco', type: 'button', title: 'Ver foto', 'aria-label': 'Presentar imágenes desde ' + (m.titulo || 'esta foto'), onclick: function () { C.visorImagenes(fotosDeLaClase(m), m); } }, [miniatura]);
    var pie = [];
    if (enPapelera) { pie.push(chip('En papelera', 'rojo')); }
    else {
      pie.push(el('button', { clase: 'boton-mini ' + (m.publicado ? 'mini-visible' : 'mini-oculto'), type: 'button', texto: m.publicado ? '👁 Visible' : '🙈 Oculto', title: m.publicado ? 'Pulse para ocultar a los estudiantes' : 'Pulse para mostrar a los estudiantes', onclick: function () { alternarVisible(m); } }));
      pie.push(el('details', { clase: 'mat-foto-mas' }, [
        el('summary', { texto: 'Más', title: 'Abrir archivo o mover a otra clase' }),
        el('div', { clase: 'mat-foto-mas-cuerpo' }, [boton('Abrir archivo', function () { abrirMaterial(m); }), selectorMover(m, 'material')])
      ]));
    }
    return el('li', { clase: 'mat-foto' + (enPapelera ? ' mat-foto-papelera' : '') }, [
      marco,
      enPapelera ? boton('↩ Restaurar', function () { cambiarPapelera(m, false); }, 'mat-foto-restaurar') : botonQuitar(m, false),
      el('p', { clase: 'mat-foto-nombre', texto: m.titulo || m.archivo_nombre || 'Foto', title: m.archivo_nombre || m.titulo || '' }),
      el('div', { clase: 'mat-foto-pie' }, pie)
    ]);
  }

  // PDF y enlaces en filas delgadas; las fotos juntas en una cuadrícula.
  function listaMateriales(lista) {
    var fotos = lista.filter(esFoto);
    var otros = lista.filter(function (m) { return !esFoto(m); });
    return el('div', { clase: 'materiales-lista' }, [
      otros.length ? el('ul', { clase: 'lista-clases lista-materiales-filas' }, otros.map(filaMaterial)) : null,
      fotos.length ? el('p', { clase: 'bloque-ayuda mat-foto-cuenta', texto: '🖼️ ' + fotos.length + (fotos.length === 1 ? ' foto' : ' fotos') + ' · toque una para presentarla; la ✕ la quita.' }) : null,
      fotos.length ? el('ul', { clase: 'fotos-cuadricula' }, fotos.map(tarjetaFoto)) : null
    ]);
  }

  function seccionMateriales() {
    var lista = S.materiales.filter(function (m) { return (m.clase_id || null) === S.claseId && (S.verPapelera || !m.eliminado_en); });
    var sec = el('section', { clase: 'bloque bloque-materiales' }, [el('h2', { texto: '📎 Material de la clase' }), el('div', { clase: 'cabecera-acciones' }, ['pdf', 'imagen'].map(function(tipo, i) { return boton(['📕 Subir PDF de la clase', '🖼️ Agregar imagen'][i], function() { S.tipoMaterial = tipo; dibujar(); }, 'boton-claro'); })), S.tipoMaterial ? formMaterial() : null]);
    if (lista.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay materiales en esta clase.' })); }
    else { sec.appendChild(listaMateriales(lista)); }
    return sec;
  }

  /* ---------- tareas ---------- */
  var MAX_ADJUNTOS = 10;
  var ETIQUETA_TIPO = { pdf: 'PDF', imagen: 'Imagen', enlace: 'Enlace' };

  function adjuntosDeTarea(tareaId) {
    return S.adjuntos.filter(function (a) { return a.tarea_id === tareaId; });
  }

  // Lista de alumnos del salón: «1. Apellidos, Nombres», una línea por estudiante.
  function listaAlumnosTexto() {
    return S.mats.map(function (m, i) { return (i + 1) + '. ' + nombreEst(m); }).join('\n');
  }

  async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* alternativa abajo */ }
    }
    var area = el('textarea', { readonly: true, clase: 'texto-oculto', 'aria-hidden': 'true' });
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
  }

  async function copiarAlumnos() {
    if (!S.mats.length) { aviso('Este salón no tiene estudiantes matriculados.', 'error'); return false; }
    var ok = await copiarTexto(listaAlumnosTexto());
    if (ok) { aviso(S.mats.length + ' alumnos copiados. Péguelos donde los necesite.', 'ok'); }
    else { aviso('El navegador no permitió copiar. Intente de nuevo o use Chrome o Edge.', 'error'); }
    return ok;
  }

  // Botón que copia la lista del salón y confirma en el propio botón.
  function botonCopiar(texto) {
    var b = boton(texto, null);
    b.addEventListener('click', async function () {
      if (await copiarAlumnos()) {
        b.textContent = '¡Lista copiada!';
        window.setTimeout(function () { b.textContent = texto; }, 2000);
      }
    });
    return b;
  }

  // Sube un adjunto (PDF, imagen o enlace) a una tarea ya creada y lo registra en la base.
  async function registrarAdjunto(tareaId, it) {
    if (it.tipo === 'enlace') {
      var g = await db.rpc('portal2027_agregar_adjunto_tarea', {
        p_tarea: tareaId, p_tipo: 'enlace', p_titulo: it.titulo, p_ruta: null, p_nombre: null, p_enlace: it.enlace
      });
      if (g.error) { throw g.error; }
      return;
    }
    var archivo = it.tipo === 'imagen' ? await C.reducirImagen(it.archivo) : it.archivo;
    var v = C.validar(archivo);
    if (v.error) { throw new Error(v.error); }
    var ruta = S.asig.id + '/tareas/' + tareaId + '/' + Date.now() + '-' + C.nombreSeguro(archivo.name);
    var s = await db.storage.from(C.BUCKET_MATERIALES).upload(ruta, archivo, { contentType: v.tipo, cacheControl: '0', upsert: false });
    if (s.error) { throw s.error; }
    var r = await db.rpc('portal2027_agregar_adjunto_tarea', {
      p_tarea: tareaId, p_tipo: it.tipo, p_titulo: it.titulo, p_ruta: ruta, p_nombre: archivo.name, p_enlace: null
    });
    if (r.error) {
      await db.storage.from(C.BUCKET_MATERIALES).remove([ruta]);   // no deja archivos sin registro
      throw r.error;
    }
  }

  async function abrirAdjunto(a) {
    try { await C.abrir(C.BUCKET_MATERIALES, a.archivo_ruta); }
    catch (e) { aviso('No se pudo abrir el archivo. ' + C.textoError(e), 'error'); }
  }

  async function quitarAdjunto(a) {
    if (!(await P.confirmar('Quitar adjunto', '¿Quitar «' + a.titulo + '» de esta tarea? Si es un archivo, se borrará del servidor.', 'Quitar'))) { return; }
    await accion('Quitando…', 'Adjunto quitado.', async function () {
      var r = await db.rpc('portal2027_quitar_adjunto_tarea', { p_id: a.id });
      if (r.error) { throw r.error; }
      if (r.data) {
        var s = await db.storage.from(C.BUCKET_MATERIALES).remove([r.data]);
        if (s.error) { console.error('Archivo de adjunto no borrado', r.data, s.error); }
      }
    });
  }

  // Bloque de adjuntos del formulario. Permite elegir varios PDF o imágenes a la vez y agregar
  // varios enlaces seguidos (el panel queda abierto). Con tarea existente cada adjunto se guarda
  // al agregarlo; con tarea nueva se guardan al crear la tarea.
  function bloqueAdjuntos(t, pendientes) {
    var tipo = null;
    var titulo = el('input', { type: 'text', maxlength: '120', 'aria-label': 'Título del adjunto' });
    var archivo = el('input', { type: 'file', multiple: true, accept: '.pdf,.jpg,.jpeg,.png' });
    var enlace = el('input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Enlace' });
    var etiqueta = el('p', { clase: 'bloque-ayuda' });
    var estadoPanel = el('p', { clase: 'mensaje', role: 'status', 'aria-live': 'polite', hidden: true });
    var aceptarBtn = boton('Añadir', null);
    var cerrarBtn = boton('Cerrar', null);
    var panel = el('div', { clase: 'adjuntos-panel', hidden: true }, [
      etiqueta,
      campo('Título (opcional; con varios archivos se numeran)', titulo),
      archivo, enlace, estadoPanel,
      el('div', { clase: 'cabecera-acciones' }, [aceptarBtn, cerrarBtn])
    ]);
    var lista = el('ul', { clase: 'lista-adjuntos' });
    var zonaSoltar = el('div', { clase: 'zona-soltar-adjuntos', role: 'button', tabindex: '0', 'aria-label': 'Arrastre PDF o imágenes aquí, o pulse para elegir archivos', texto: '📂 Arrastre y suelte aquí sus PDF o imágenes, o haga clic para elegir archivos.' });
    var contador = el('p', { clase: 'bloque-ayuda' });
    var resumen = el('p', { clase: 'bloque-ayuda', role: 'status', 'aria-live': 'polite' });
    var botones = { pdf: boton('Agregar PDF', null), imagen: boton('Agregar imágenes', null), enlace: boton('Agregar enlaces', null) };

    function cantidad() { return t ? adjuntosDeTarea(t.id).length : pendientes.length; }
    function mostrarEstado(texto, clase) { estadoPanel.textContent = texto; estadoPanel.className = 'mensaje ' + (clase || 'info'); estadoPanel.hidden = !texto; }
    function cerrarPanel() { tipo = null; panel.hidden = true; mostrarEstado('', 'info'); }
    function abrirPanel(k) {
      tipo = k;
      titulo.value = ''; archivo.value = ''; enlace.value = '';
      archivo.hidden = k === 'enlace'; enlace.hidden = k !== 'enlace';
      aceptarBtn.hidden = k !== 'enlace';
      archivo.accept = k === 'pdf' ? '.pdf' : '.jpg,.jpeg,.png';
      etiqueta.textContent = k === 'enlace' ? 'Escriba un enlace y presione Añadir. Puede agregar varios seguidos (https://…).'
        : k === 'pdf' ? 'Elija uno o varios PDF (hasta ' + F.maxMB('materiales') + ' MB cada uno).'
        : 'Elija una o varias imágenes JPG o PNG (las grandes se reducen automáticamente).';
      mostrarEstado('', 'info');
      panel.hidden = false;
      (k === 'enlace' ? enlace : titulo).focus();
    }

    // Convierte lo elegido en una lista de adjuntos. Valida antes de subir nada.
    function leerItems(archivosElegidos) {
      if (tipo === 'enlace') {
        var url = enlace.value.trim();
        if (!C.urlSegura(url)) { mostrarEstado('Use un enlace que empiece con https:// o http://.', 'error'); return null; }
        var nombre = titulo.value.trim() || new URL(url).hostname;
        return [{ tipo: 'enlace', titulo: nombre.slice(0, 120), enlace: url }];
      }
      var archivos = archivosElegidos || Array.prototype.slice.call(archivo.files || []);
      if (!archivos.length) { mostrarEstado('Elija al menos un archivo.', 'error'); return null; }
      var patron = tipo === 'pdf' ? /\.pdf$/i : tipo === 'imagen' ? /\.(jpe?g|png)$/i : /\.(pdf|jpe?g|png)$/i;
      var malos = archivos.filter(function (a) { return !patron.test(a.name); });
      if (malos.length) {
        mostrarEstado((tipo === 'pdf' ? 'Solo se aceptan PDF: ' : 'Solo se aceptan JPG o PNG: ') + malos.map(function (a) { return a.name; }).join(', '), 'error');
        return null;
      }
      for (var i = 0; i < archivos.length; i++) {
        var problema = F.errorTamano(archivos[i], 'materiales');
        if (problema) { mostrarEstado(archivos[i].name + ': ' + problema, 'error'); return null; }
      }
      var base = titulo.value.trim();
      return archivos.map(function (f, n) {
        var sinExtension = f.name.replace(/\.[^.]+$/, '');
        var tit = base ? (archivos.length > 1 ? base + ' ' + (n + 1) : base) : sinExtension;
        return { tipo: tipo === 'mixto' ? (/\.pdf$/i.test(f.name) ? 'pdf' : 'imagen') : tipo, titulo: tit.slice(0, 120), archivo: f };
      });
    }

    function dibujarLista() {
      lista.textContent = '';
      var filas = t ? adjuntosDeTarea(t.id) : pendientes;
      filas.forEach(function (a, i) {
        var quitar = boton('Quitar', t ? function () { quitarAdjunto(a); } : function () { pendientes.splice(i, 1); dibujarLista(); });
        var contenido;
        if (a.tipo === 'enlace') {
          contenido = [el('span', { clase: 'etiqueta-chica', texto: 'Enlace' }), C.enlace(a.enlace, a.titulo)];
        } else {
          var acciones = t ? [boton('Abrir', function () { abrirAdjunto(a); })] : [];
          contenido = [el('span', { clase: 'etiqueta-chica', texto: ETIQUETA_TIPO[a.tipo] }), el('strong', { texto: a.titulo }),
            el('small', { texto: a.archivo_nombre || (a.archivo && a.archivo.name) || '' })].concat(acciones);
        }
        lista.appendChild(el('li', null, [el('div', { clase: 'lista-adjuntos-fila' }, contenido.concat([quitar]))]));
      });
      contador.textContent = filas.length + ' de ' + MAX_ADJUNTOS + ' adjuntos' + (t ? '' : ' (se guardarán al crear la tarea)');
      Object.keys(botones).forEach(function (k) { botones[k].disabled = !S.adjuntosDisponibles || filas.length >= MAX_ADJUNTOS; });
    }

    // Guarda varios adjuntos de una tarea existente. Informa cuáles sí y cuáles no se guardaron.
    async function guardarLote(tareaId, items) {
      aceptarBtn.disabled = true; cerrarBtn.disabled = true;
      var fallos = [], guardados = 0;
      resumen.textContent = 'Subiendo ' + items.length + ' adjunto(s)…';
      try {
        for (var i = 0; i < items.length; i++) {
          try { await registrarAdjunto(tareaId, items[i]); guardados++; }
          catch (e) { console.error('Adjunto', items[i].titulo, e); fallos.push(items[i].titulo + ' (' + C.textoError(e) + ')'); }
        }
        await cargar();
        dibujarLista();
        resumen.textContent = fallos.length
          ? guardados + ' guardado(s). No se guardaron: ' + fallos.join('; ') + '.'
          : (guardados === 1 ? 'Adjunto agregado.' : guardados + ' adjuntos agregados.');
      } catch (e) {
        console.error('Actualizar adjuntos', e);
        resumen.textContent = 'Los adjuntos se procesaron, pero no se pudo actualizar la lista. Pulse «Recargar».';
        fallos.push('actualizar');
      } finally { aceptarBtn.disabled = false; cerrarBtn.disabled = false; }
      return fallos;
    }

    if (!S.adjuntosDisponibles) {
      Object.keys(botones).forEach(function (k) { botones[k].disabled = true; });
      resumen.textContent = 'Los adjuntos no están activos todavía en la base de datos. Ejecute la migración 0050 en Supabase y recargue la página.';
    }

    botones.pdf.addEventListener('click', function () { abrirPanel('pdf'); });
    botones.imagen.addEventListener('click', function () { abrirPanel('imagen'); });
    botones.enlace.addEventListener('click', function () { abrirPanel('enlace'); });
    cerrarBtn.addEventListener('click', cerrarPanel);
    // Enter en estos campos no debe enviar la tarea completa.
    [titulo, enlace].forEach(function (c) {
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aceptarBtn.click(); } });
    });

    var procesando = false;
    async function agregarSeleccion(archivosElegidos) {
      if (procesando) { return; }
      var items = leerItems(archivosElegidos);
      if (!items) { return; }
      var libres = MAX_ADJUNTOS - cantidad();
      if (items.length > libres) {
        mostrarEstado(libres > 0 ? 'Solo caben ' + libres + ' adjuntos más en esta tarea.' : 'Esta tarea ya tiene ' + MAX_ADJUNTOS + ' adjuntos.', 'error');
        return;
      }
      procesando = true;
      var fallos = [];
      try {
        if (!t) {
          pendientes.push.apply(pendientes, items);
          dibujarLista();
          resumen.textContent = items.length === 1 ? 'Archivo listo. Se guardará al crear la tarea.' : items.length + ' archivos listos. Se guardarán al crear la tarea.';
        } else {
          fallos = await guardarLote(t.id, items);
        }
        if (fallos.length) { mostrarEstado('Revise lo que no se guardó.', 'error'); return; }
        if (tipo === 'enlace') { enlace.value = ''; titulo.value = ''; mostrarEstado('Enlace añadido. Puede agregar otro.', 'ok'); enlace.focus(); }
        else { archivo.value = ''; titulo.value = ''; cerrarPanel(); }
      } finally { procesando = false; }
    }
    aceptarBtn.addEventListener('click', function () { agregarSeleccion(); });
    archivo.addEventListener('change', function () {
      if (archivo.files && archivo.files.length) { agregarSeleccion(); }
    });
    zonaSoltar.addEventListener('click', function () { if (S.adjuntosDisponibles) { abrirPanel('pdf'); archivo.accept = '.pdf,.jpg,.jpeg,.png'; tipo = 'mixto'; archivo.click(); } });
    zonaSoltar.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zonaSoltar.click(); } });
    ['dragenter', 'dragover'].forEach(function (nombre) { zonaSoltar.addEventListener(nombre, function (e) { e.preventDefault(); zonaSoltar.classList.add('arrastrando'); }); });
    ['dragleave', 'drop'].forEach(function (nombre) { zonaSoltar.addEventListener(nombre, function (e) { e.preventDefault(); zonaSoltar.classList.remove('arrastrando'); }); });
    zonaSoltar.addEventListener('drop', function (e) {
      if (!S.adjuntosDisponibles || !e.dataTransfer || !e.dataTransfer.files.length) { return; }
      var archivos = Array.prototype.slice.call(e.dataTransfer.files);
      tipo = 'mixto';
      agregarSeleccion(archivos);
    });

    dibujarLista();
    return el('fieldset', { clase: 'adjuntos-tarea' }, [
      el('legend', { texto: 'Archivos y enlaces de la tarea' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Agregue PDF, imágenes o enlaces. Puede elegir varias imágenes a la vez y agregar varios enlaces.' }),
      el('div', { clase: 'cabecera-acciones' }, [botones.pdf, botones.imagen, botones.enlace]),
      zonaSoltar, panel, lista, contador, resumen
    ]);
  }

  function formTarea(t) {
    var pendientes = [];
    var titulo = el('input', { type: 'text', maxlength: '120', required: true, value: t ? t.titulo : '' });
    var instr = el('textarea', { rows: '3', maxlength: '4000', value: t ? t.instrucciones : '' });
    var plazo = el('input', { type: 'datetime-local', value: t ? C.aInputFecha(t.fecha_limite) : '' });
    var usados = {};
    S.tareas.forEach(function (x) { if (x.evaluacion_id && (!t || x.id !== t.id)) { usados[x.evaluacion_id] = true; } });
    var opciones = [el('option', { value: '', texto: 'Sin nota (solo se revisa y se comenta)' })];
    S.evals.filter(function (e) { return !usados[e.id]; }).forEach(function (e) {
      opciones.push(el('option', { value: e.id, texto: etiquetaEval(e), selected: !!(t && t.evaluacion_id === e.id) }));
    });
    if (t && t.evaluacion_id && !evalPorId(t.evaluacion_id)) {
      opciones.push(el('option', { value: t.evaluacion_id, texto: 'Columna en la papelera de la libreta (se conserva el vínculo)', selected: true }));
    }
    // Cada tarea nueva tiene una columna de calificación independiente.
    if (!t) {
      opciones = [
        el('option', { value: '__crear_apreciacion__', texto: 'Apreciación — nota propia de esta tarea', selected: true }),
        el('option', { value: '', texto: 'Sin nota' })
      ];
    } else {
      opciones.push(el('option', { value: '__crear_apreciacion__', texto: 'Apreciación — crear nota propia' }));
    }
    var vinculo = el('select', null, opciones);
    var bloqueaVinculo = t && S.entregas.some(function (e) { return e.tarea_id === t.id && e.estado === 'revisada'; });
    if (bloqueaVinculo) { vinculo.disabled = true; }
    var enviar = el('button', { clase: 'boton boton-principal-chico', type: 'submit', texto: t ? 'Guardar cambios' : 'Crear tarea' });
    var controlNota = vinculo;
    if (!t) {
      // Mantener el select como fuente del valor que usa el guardado, pero mostrar botones de un clic.
      vinculo.style.display = 'none';
      var conNota = el('button', { type: 'button', texto: '✓ Con nota' });
      var sinNota = el('button', { type: 'button', texto: '○ Sin nota' });
      function actualizarBotonesNota() {
        var activo = vinculo.value === '__crear_apreciacion__';
        conNota.style.cssText = 'flex:1;min-width:130px;padding:12px;border-radius:10px;cursor:pointer;font-weight:700;border:2px solid ' + (activo ? '#15803d;background:#dcfce7;color:#166534' : '#cbd5e1;background:white;color:#334155');
        sinNota.style.cssText = 'flex:1;min-width:130px;padding:12px;border-radius:10px;cursor:pointer;font-weight:700;border:2px solid ' + (!activo ? '#475569;background:#e2e8f0;color:#334155' : '#cbd5e1;background:white;color:#334155');
        conNota.setAttribute('aria-pressed', String(activo));
        sinNota.setAttribute('aria-pressed', String(!activo));
      }
      conNota.addEventListener('click', function () { vinculo.value = '__crear_apreciacion__'; actualizarBotonesNota(); });
      sinNota.addEventListener('click', function () { vinculo.value = ''; actualizarBotonesNota(); });
      controlNota = el('div', null, [
        el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' }, [conNota, sinNota]),
        vinculo
      ]);
      actualizarBotonesNota();
    }
    var hijos = [campo('Título', titulo), campo('Instrucciones', instr), campo('Plazo (opcional)', plazo),
      campo('Nota de esta tarea en la libreta', controlNota)];
    if (bloqueaVinculo) { hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'El vínculo con la libreta no se puede cambiar: ya hay entregas revisadas.' })); }
    hijos.push(bloqueAdjuntos(t, pendientes));
    var acciones = [enviar];
    if (t) { acciones.push(boton('Cancelar', function () { S.editando = null; dibujar(); })); }
    hijos.push(el('div', { clase: 'cabecera-acciones' }, acciones));
    var f = el('form', { clase: 'formulario-clases' + (t ? ' formulario-edicion' : ' formulario-nueva') }, hijos);
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (!titulo.value.trim()) { aviso('Escriba el título de la tarea.', 'error'); return; }
      var iso = C.deInputFecha(plazo.value);
      var categoriaNueva = vinculo.value === '__crear_apreciacion__' ? 'apreciacion' : (vinculo.value === '__crear_escrito__' ? 'ejercicio_escrito' : null);
      var adjuntosNuevos = pendientes.slice();
      var nuevaId = null;
      enviar.disabled = true;
      if (!t) { S.nuevaTarea = false; }
      var guardada = await accion('Guardando tarea…', t ? 'Tarea actualizada.' : 'Tarea creada.', async function () {
        var g;
        if (categoriaNueva) {
          var clase = S.plan.find(function (c) { return c.id === (t ? t.clase_id : S.claseId); });
          var temaColumna = (clase ? 'Semana ' + clase.numero + ' · ' : '') + titulo.value.trim();
          var creada = await db.rpc('portal2027_crear_evaluacion', {
            p_asignacion: S.asig.id, p_trimestre: S.trimestreId,
            p_categoria: categoriaNueva, p_tema: temaColumna.slice(0, 120),
            p_tipo: categoriaNueva === 'apreciacion' ? 'Tarea' : ''
          });
          if (creada.error) { throw creada.error; }
          vinculo.value = creada.data;
          // La columna nueva queda disponible aun si después falla guardar la tarea.
        }
        if (t) {
          g = await db.rpc('portal2027_actualizar_tarea', {
            p_id: t.id, p_version: t.version, p_titulo: titulo.value, p_instrucciones: instr.value,
            p_fecha_limite: iso, p_limpiar_plazo: !iso,
            p_evaluacion: vinculo.value || null, p_limpiar_evaluacion: !vinculo.value && !bloqueaVinculo,
            p_publicada: true, p_a_papelera: null
          });
        } else {
          g = await db.rpc('portal2027_crear_tarea_clase', {
            p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_titulo: titulo.value, p_instrucciones: instr.value,
            p_fecha_limite: iso, p_evaluacion: vinculo.value || null, p_publicada: true, p_clase: S.claseId
          });
          if (!g.error) { nuevaId = g.data; }
        }
        if (g.error) { throw g.error; }
        S.editando = null;
      });
      if (!t && guardada === false) { S.nuevaTarea = true; }   // si falló, el formulario sigue abierto con lo escrito
      // Tarea nueva: los adjuntos se suben después de crearla y se informa el resultado real.
      if (!t && nuevaId && adjuntosNuevos.length) {
        var fallidos = [];
        aviso('Subiendo ' + adjuntosNuevos.length + ' adjunto(s)…', 'info');
        for (var i = 0; i < adjuntosNuevos.length; i++) {
          try { await registrarAdjunto(nuevaId, adjuntosNuevos[i]); }
          catch (e) { console.error('Adjunto de tarea nueva', e); fallidos.push(adjuntosNuevos[i].titulo + ' (' + C.textoError(e) + ')'); }
        }
        try { await cargar(); dibujar(); }
        catch (e) { console.error('Actualizar tareas', e); aviso('La tarea se creó, pero no se pudo actualizar la pantalla. Pulse «Recargar».', 'error'); return; }
        if (fallidos.length) { aviso('La tarea se creó, pero no se guardaron: ' + fallidos.join('; ') + '. Agréguelos desde Editar.', 'error'); }
        else { aviso('Tarea creada con ' + adjuntosNuevos.length + ' adjunto(s).', 'ok'); }
      }
      enviar.disabled = false;
    });
    return f;
  }

  function cambiarTarea(t, cambios, ok) {
    accion('Guardando…', ok, async function () {
      var args = { p_id: t.id, p_version: t.version, p_titulo: null, p_instrucciones: null, p_fecha_limite: null, p_limpiar_plazo: false,
        p_evaluacion: null, p_limpiar_evaluacion: false, p_publicada: null, p_a_papelera: null };
      Object.keys(cambios).forEach(function (k) { args[k] = cambios[k]; });
      var g = await db.rpc('portal2027_actualizar_tarea', args);
      if (g.error) { throw g.error; }
    });
  }

  function resumenEntregas(t) {
    var hechas = S.entregas.filter(function (e) { return e.tarea_id === t.id; });
    var rev = hechas.filter(function (e) { return e.estado === 'revisada'; }).length;
    return hechas.length + ' de ' + S.mats.length + ' entregadas · ' + rev + ' revisadas';
  }
  // Barra de avance de entregas (elemento nativo <progress>, sin estilos en línea).
  function progresoEntregas(t) {
    var hechas = S.entregas.filter(function (e) { return e.tarea_id === t.id; }).length;
    return el('div', { clase: 'entregas-progreso' }, [
      el('progress', { max: String(Math.max(S.mats.length, 1)), value: String(hechas), 'aria-label': 'Entregas recibidas' }),
      el('span', { texto: resumenEntregas(t) })
    ]);
  }

  function resumenAdjuntosProfesor(t) {
    var archivos = adjuntosDeTarea(t.id);
    var bloque = el('div', { clase: 'tarea-materiales-profesor' }, [
      el('strong', { clase: 'tarea-materiales-titulo', texto: '📎 Materiales adjuntos (' + archivos.length + ')' })
    ]);
    if (!archivos.length) {
      bloque.appendChild(el('p', { clase: 'tarea-materiales-vacio', texto: 'Esta tarea no tiene PDF, imágenes ni enlaces adjuntos.' }));
      return bloque;
    }
    var lista = el('ul', { clase: 'tarea-materiales-lista' });
    archivos.forEach(function (a) {
      var tipo = a.tipo === 'pdf' ? '📕 PDF' : (a.tipo === 'imagen' ? '🖼️ Imagen' : '🔗 Enlace');
      var titulo = a.titulo || a.archivo_nombre || 'Archivo sin título';
      var detalle = a.archivo_nombre && a.archivo_nombre !== titulo ? a.archivo_nombre : '';
      var accion = a.tipo === 'enlace'
        ? C.enlace(a.enlace, 'Abrir enlace')
        : boton('Abrir archivo', function () { abrirAdjunto(a); });
      lista.appendChild(el('li', { clase: 'tarea-materiales-item' }, [
        el('span', { clase: 'tarea-materiales-tipo', texto: tipo }),
        el('span', { clase: 'tarea-materiales-nombre' }, [
          el('strong', { texto: titulo }),
          detalle ? el('small', { texto: detalle }) : null
        ]),
        accion
      ]));
    });
    bloque.appendChild(lista);
    return bloque;
  }

  function tarjetaTarea(t, numero) {
    var enPapelera = !!t.eliminada_en;
    var ev = t.evaluacion_id ? evalPorId(t.evaluacion_id) : null;
    var nAdj = adjuntosDeTarea(t.id).length;
    var chips = [
      chip(enPapelera ? 'En papelera' : (t.publicada ? '👁️ Visible' : '📝 Borrador'), enPapelera ? 'rojo' : (t.publicada ? 'verde' : 'gris')),
      t.fecha_limite ? chip('📅 Plazo: ' + C.fechaHora(t.fecha_limite), 'azul') : chip('Sin plazo', 'gris'),
      t.evaluacion_id ? chip('⭐ ' + (ev ? etiquetaEval(ev) : 'columna en papelera'), 'ambar') : null,
      nAdj ? chip('📎 ' + nAdj + (nAdj === 1 ? ' adjunto' : ' adjuntos'), 'gris') : null
    ];
    var acciones = [selectorMover(t, 'tarea')];
    if (!enPapelera) {
      acciones.unshift(boton(S.abierta === t.id ? '✖ Cerrar entregas' : '📥 Ver entregas', function () {
        S.abierta = S.abierta === t.id ? null : t.id; S.revisando = null; dibujar();
      }, 'boton-relleno'));
      acciones.push(boton('✏️ Editar', function () { S.editando = t.id; dibujar(); }));
      acciones.push(boton(t.publicada ? 'Ocultar' : 'Publicar', function () {
        cambiarTarea(t, { p_publicada: !t.publicada }, t.publicada ? 'Tarea oculta.' : 'Tarea publicada.');
      }));
      acciones.push(botonCopiar('Copiar alumnos'));
    }
    acciones.push(boton(enPapelera ? 'Restaurar' : 'A la papelera', function () {
      if (!enPapelera && !window.confirm('¿Enviar esta tarea a la papelera? Se borrarán sus notas de la libreta y se recalcularán los promedios. Las notas no se recuperarán al restaurar la tarea.')) { return; }
      cambiarTarea(t, { p_a_papelera: !enPapelera }, enPapelera ? 'Tarea restaurada sin calificaciones anteriores.' : 'Tarea en la papelera. Sus notas fueron limpiadas de la libreta.');
    }, enPapelera ? '' : 'boton-peligro'));

    var hijos = [
      el('div', { clase: 'tarea-titulo-fila' }, [el('span', { clase: 'tarea-numero-prof', texto: (numero ? 'Tarea ' + numero : 'En papelera') }), el('strong', { clase: 'tarea-titulo-prof', texto: t.titulo })]),
      el('div', { clase: 'tarea-chips' }, chips),
      t.instrucciones ? el('p', { clase: 'tarea-texto', texto: t.instrucciones }) : null,
      resumenAdjuntosProfesor(t),
      progresoEntregas(t),
      el('div', { clase: 'cabecera-acciones tarea-acciones' }, acciones)
    ];
    if (S.editando === t.id) { hijos.push(formTarea(t)); }
    if (S.abierta === t.id && !enPapelera) { hijos.push(tablaEntregas(t)); }
    return el('li', { clase: 'tarjeta-clase tarjeta-columna tarjeta-tarea' }, hijos);
  }

  function seccionTareas() {
    // Numerar solo las tareas activas de la clase. Las tareas en papelera
    // no consumen números; al restaurarlas se recalcula el orden visible.
    var todas = S.tareas.filter(function (t) { return (t.clase_id || null) === S.claseId; }).slice().sort(function (x, y) {
      return x.creado_en < y.creado_en ? -1 : (x.creado_en > y.creado_en ? 1 : (x.id < y.id ? -1 : 1));
    });
    var activas = todas.filter(function (t) { return !t.eliminada_en; });
    var numeros = {};
    activas.forEach(function (t, i) { numeros[t.id] = i + 1; });
    var lista = S.verPapelera ? todas : activas;
    var sec = el('section', { clase: 'bloque bloque-tareas' }, [
      el('h2', { texto: '✏️ Tareas de la clase' }),
      el('p', { clase: 'bloque-ayuda', texto: S.mats.length + ' alumnos en este salón. Las tareas se numeran por orden de creación.' }),
      el('div', { clase: 'cabecera-acciones' }, [
        boton(S.nuevaTarea ? '✖ Cancelar' : '➕ Nueva tarea', function () { S.nuevaTarea = !S.nuevaTarea; dibujar(); }, S.nuevaTarea ? '' : 'boton-relleno'),
        botonCopiar('📋 Copiar lista de alumnos')
      ]),
      S.nuevaTarea ? formTarea(null) : null
    ]);
    if (lista.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay tareas en esta clase.' })); }
    else { sec.appendChild(el('ul', { clase: 'lista-clases' }, lista.map(function (t) { return tarjetaTarea(t, numeros[t.id]); }))); }
    return sec;
  }

  /* ---------- entregas y revisión ---------- */
  function etiquetaEstado(en) {
    if (!en) { return 'Sin entrega'; }
    if (en.estado === 'revisada') { return 'Revisada'; }
    return en.tardia ? 'Entregada (tardía)' : 'Entregada';
  }

  function tablaEntregas(t) {
    if (S.mats.length === 0) { return el('p', { clase: 'vacio-texto', texto: 'Este grupo no tiene estudiantes matriculados.' }); }
    var filas = S.mats.map(function (m) {
      var en = entregaDe(t.id, m.id);
      return el('tr', { clase: en ? '' : 'fila-sin-entrega' }, [
        el('td', { texto: nombreEst(m) }),
        el('td', null, [chip(etiquetaEstado(en), !en ? 'gris' : (en.estado === 'revisada' ? 'azul' : (en.tardia ? 'ambar' : 'verde')))]),
        el('td', { texto: en ? C.fechaHora(en.entregada_en) : '—' }),
        el('td', { texto: (function () {
          if (!en) { return '—'; }
          var oficial = t.evaluacion_id ? S.notas[t.evaluacion_id + '|' + m.id] : null;
          var valor = oficial && oficial.valor != null ? oficial.valor : en.nota_profesor;
          return valor == null || valor === '' ? '—' : Number(valor).toFixed(1);
        })() }),
        el('td', { clase: 'celda-accion' }, [en ? boton(S.revisando === m.id ? '✖ Cerrar' : '🔍 Revisar', function () {
          S.revisando = S.revisando === m.id ? null : m.id; dibujar();
        }, 'boton-relleno') : null])
      ]);
    });
    var cont = el('div', { clase: 'detalle-ficha' }, [
      el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Estudiante', 'Estado', 'Entregada', 'Nota', ''].map(function (x) { return el('th', { scope: 'col', texto: x }); }))]),
        el('tbody', null, filas)])])
    ]);
    if (S.revisando) {
      var m = S.mats.filter(function (x) { return x.id === S.revisando; })[0];
      var en = m ? entregaDe(t.id, m.id) : null;
      // El panel va ARRIBA de la lista para verlo sin bajar hasta el final de los 25 estudiantes.
      if (m && en) {
        var panel = formRevision(t, m, en);
        cont.insertBefore(panel, cont.firstChild);
        setTimeout(function () { if (panel.scrollIntoView) { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 0);
      }
    }
    return cont;
  }

  function formRevision(t, m, en) {
    var notaActual = t.evaluacion_id ? S.notas[t.evaluacion_id + '|' + m.id] : null;
    // Las tareas vinculadas usan la nota oficial de la libreta; las demás guardan su nota en la entrega.
    var valorGuardado = t.evaluacion_id && notaActual && notaActual.valor != null ? notaActual.valor : en.nota_profesor;
    var valorActual = valorGuardado !== null && valorGuardado !== undefined ? String(Number(valorGuardado)) : '';
    var coment = el('textarea', { rows: '3', maxlength: '2000', value: en.comentario_profesor || '' });
    var nota = el('input', { type: 'text', inputmode: 'decimal', value: valorActual, 'aria-label': 'Nota de 0 a 5' });
    var motivo = el('input', { type: 'text', maxlength: '200', placeholder: 'Motivo si cambia una nota ya guardada' });
    var guardar = el('button', { clase: 'boton boton-principal-chico', type: 'submit', texto: 'Guardar revisión' });
    var revisables = S.mats.filter(function (al) { return !!entregaDe(t.id, al.id); });
    var posicion = revisables.findIndex(function (al) { return al.id === m.id; });
    var navegando = false;
    var indicador = el('p', { clase: 'bloque-ayuda revision-indicador', texto: 'Entrega ' + (posicion + 1) + ' de ' + revisables.length + ' recibidas · Al avanzar se guardan nota y comentario.' });

    var hijos = [
      el('h3', { texto: 'Entrega de ' + nombreEst(m) }),
      indicador,
      el('p', { clase: 'bloque-ayuda revision-fecha', texto: 'Entregada el ' + C.fechaHora(en.entregada_en) + (en.tardia ? ' (después del plazo)' : '') + ' · ' + (Array.isArray(en.archivos) ? en.archivos.length + ' archivo(s)' : en.archivo_nombre) }),
      en.comentario ? el('p', { clase: 'bloque-ayuda', texto: 'Comentario del estudiante: ' + en.comentario }) : null,
      vistaEntrega(archivosEntrega(en)),
      el('div', { clase: 'cabecera-acciones' }, archivosEntrega(en).map(function (a) {
        return boton('Abrir ' + a.nombre, async function () {
          try { await C.abrir(C.BUCKET_ENTREGAS, a.ruta); }
          catch (e) { console.error('Abrir adjunto del estudiante', e); aviso('No se pudo abrir el archivo. Inténtelo de nuevo.', 'error'); }
        });
      })),
      campo('Comentario para el estudiante', coment)
    ];
    hijos.push(campo('Nota de 0 a 5 (vinculada con la libreta)', nota));
    var campoMotivo = campo('Motivo (obligatorio si cambia una nota ya guardada)', motivo);
    campoMotivo.classList.add('revision-motivo');
    function actualizarMotivo() {
      var escrito = nota.value.trim().replace(',', '.');
      var nuevo = escrito === '' ? null : Number(escrito);
      var previo = valorGuardado == null ? null : Number(valorGuardado);
      campoMotivo.hidden = !(previo !== null && nuevo !== previo);
    }
    nota.addEventListener('input', actualizarMotivo);
    actualizarMotivo();
    hijos.push(campoMotivo);
    hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'La nota se registra en el desglose semanal de la libreta cuando la tarea está vinculada.' }));
    var acciones = [guardar];
    if (en.estado === 'revisada') {
      acciones.push(boton('Devolver para corregir', function () {
        accion('Guardando…', 'Entrega devuelta al estudiante.', async function () {
          var g = await db.rpc('portal2027_reabrir_entrega', { p_entrega: en.id, p_version: en.version });
          if (g.error) { throw g.error; }
        });
      }));
    }
    var anterior = boton('← Anterior estudiante', function () { avanzar(-1); });
    var siguiente = boton('Siguiente estudiante →', function () { avanzar(1); }, 'boton-relleno');
    anterior.disabled = posicion <= 0;
    siguiente.disabled = posicion >= revisables.length - 1;
    hijos.push(el('div', { clase: 'cabecera-acciones' }, acciones));
    hijos.push(el('div', { clase: 'cabecera-acciones revision-navegacion' }, [anterior, siguiente]));
    var f = el('form', { clase: 'formulario-clases formulario-revision' }, hijos);
    async function guardarDatos() {
      var valor = null;
      if (nota.value.trim() !== '') {
        valor = Number(nota.value.trim().replace(',', '.'));
        if (!isFinite(valor) || valor < 0 || valor > 5) { aviso('La nota debe estar entre 0 y 5.', 'error'); return false; }
      }
      var comentarioNuevo = coment.value;
      var comentarioAnterior = en.comentario_profesor || '';
      var cambioNota = (valor === null ? null : Number(valor)) !== (valorGuardado == null ? null : Number(valorGuardado));
      var cambioComentario = comentarioNuevo !== comentarioAnterior;
      if (!cambioNota && !cambioComentario && en.estado === 'revisada') { return true; }
      guardar.disabled = true;
      anterior.disabled = true;
      siguiente.disabled = true;
      aviso('Guardando nota y comentario…', 'info');
      try {
        var g = await db.rpc('portal2027_revisar_entrega', {
          p_entrega: en.id, p_version: en.version, p_comentario: comentarioNuevo,
          p_nota: valor, p_motivo: motivo.value || null
        });
        if (g.error) { throw g.error; }
      } catch (e) {
        aviso('No se guardó. ' + C.textoError(e), 'error');
        guardar.disabled = false;
        anterior.disabled = posicion <= 0;
        siguiente.disabled = posicion >= revisables.length - 1;
        return false;
      }
      try { await cargar(); }
      catch (e) {
        aviso('Se guardó, pero no se pudo recargar. Pulse «Recargar» antes de continuar.', 'info');
        return false;
      }
      return true;
    }
    async function avanzar(direccion) {
      if (navegando) { return; }
      var destino = revisables[posicion + direccion];
      if (!destino) { return; }
      navegando = true;
      var ok = await guardarDatos();
      if (ok) {
        S.revisando = destino.id;
        dibujar();
        aviso('Revisión guardada. Mostrando siguiente entrega.', 'ok');
      }
      navegando = false;
    }
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (navegando) { return; }
      navegando = true;
      var ok = await guardarDatos();
      if (ok) { dibujar(); aviso('Revisión guardada.', 'ok'); }
      navegando = false;
    });
    return f;
  }

  function archivosEntrega(en) {
    return Array.isArray(en.archivos) && en.archivos.length ? en.archivos : [{ ruta: en.archivo_ruta, nombre: en.archivo_nombre }];
  }

  // Muestra las fotos entregadas directamente en la pantalla (clic = abrir en tamaño completo).
  function vistaEntrega(archivos) {
    var imagenes = archivos.filter(function (a) { return /\.(jpe?g|png|gif|webp)$/i.test(a.nombre || ''); });
    if (!imagenes.length) { return null; }
    return el('div', { clase: 'entrega-vista' }, imagenes.map(function (a) {
      var img = el('img', { alt: 'Entrega: ' + a.nombre, loading: 'lazy', clase: 'entrega-imagen', hidden: true });
      var marco = el('button', { type: 'button', clase: 'entrega-marco', title: 'Abrir ' + a.nombre, onclick: async function () {
        try { await C.abrir(C.BUCKET_ENTREGAS, a.ruta); }
        catch (e) { console.error('Abrir imagen de la entrega', e); aviso('No se pudo abrir el archivo. Inténtelo de nuevo.', 'error'); }
      } }, [img, el('small', { texto: a.nombre })]);
      try {
        Promise.resolve(db.storage.from(C.BUCKET_ENTREGAS).createSignedUrl(a.ruta, 600)).then(function (r) {
          if (!r.error && r.data) { img.src = r.data.signedUrl; img.hidden = false; }
        }).catch(function () {});
      } catch (e) { console.error('Vista previa de la entrega', e); }
      return marco;
    }));
  }

  /* ---------- pantalla ---------- */
  function dibujar() {
    zona.textContent = '';
    var selTr = el('select', { 'aria-label': 'Trimestre' }, S.trimestres.map(function (t) {
      return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === S.trimestreId });
    }));
    selTr.addEventListener('change', async function () {
      S.trimestreId = selTr.value; S.claseId = null; S.tipoMaterial = null; S.abierta = null; S.revisando = null; S.editando = null;
      aviso('Cargando…', 'info');
      try { await cargar(); dibujar(); aviso('', 'info'); } catch (e) { aviso('No se pudo cargar. ' + C.textoError(e), 'error'); }
    });
    var papelera = el('input', { type: 'checkbox', checked: S.verPapelera });
    papelera.addEventListener('change', function () { S.verPapelera = papelera.checked; dibujar(); });
    zona.appendChild(el('div', { clase: 'formulario-fila' }, [
      campo('Trimestre', selTr),
      el('label', { clase: 'etiqueta-check' }, [papelera, 'Mostrar papelera']),
      boton('Recargar', async function () {
        aviso('Recargando…', 'info');
        try { await cargar(); dibujar(); aviso('Datos al día.', 'ok'); } catch (e) { aviso('No se pudo recargar. ' + C.textoError(e), 'error'); }
      })
    ]));
    zona.appendChild(navegacionClases());
    zona.appendChild(seccionMateriales());
    zona.appendChild(seccionTareas());
  }

  async function iniciar() {
    if (!db) { errorPantalla(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { errorPantalla(P.traducirError(e)); return; }
    var rolPanel = info && (info.roles.indexOf('profesor') !== -1 ? 'profesor' : (info.roles.indexOf('administrador') !== -1 ? 'administrador' : null));
    if (!info || !rolPanel) { window.location.replace(P.rutaInicio()); return; }
    db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); } });

    var params = new URLSearchParams(window.location.search);
    var asigId = params.get('asignacion');
    document.body.classList.add('pagina-clases');
    contenido.textContent = '';
    estado = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });
    try {
      S.asig = asigId ? await consultar(db.from('portal2027_asignaciones')
        .select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
        .eq('id', asigId).maybeSingle()) : null;
      if (!S.asig) { errorPantalla('No se encontró esta clase o no tiene acceso a ella.'); return; }
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', S.asig.salon.anio_id).order('numero'));
      S.trimestreId = S.trimestres[0] ? S.trimestres[0].id : null;
      if (!S.trimestreId) { errorPantalla('Este año no tiene trimestres.'); return; }

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Clases y tareas' }),
          el('h1', { texto: S.asig.materia.nombre + ' · ' + S.asig.salon.nombre }),
          el('p', { clase: 'panel-datos', texto: '📅 Año lectivo ' + S.asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(S.asig.id), texto: '📒 Libreta' }),
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: '← Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(estado);
      zona = el('div', { clase: 'secciones' });
      contenido.appendChild(zona);
      await cargar();
      S.claseId = S.plan[0] ? S.plan[0].id : null;
      dibujar();
    } catch (e) {
      errorPantalla('No se pudo abrir la pantalla. ' + C.textoError(e));
    }
  }

  iniciar();
})();
