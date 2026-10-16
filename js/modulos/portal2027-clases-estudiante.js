/* portal2027-clases-estudiante.js — «Mis clases y tareas» (guía, etapa 5, parte B): panel del estudiante.
   Los datos llegan de portal2027_mis_clases (solo lo publicado para su grupo y su propia entrega).
   La entrega sube el archivo a su carpeta privada y luego registra la tanda con portal2027_entregar_tarea_archivos. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var C = P.clases;
  var F = P.archivos;

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }

  var ES_FOTO = /\.(jpe?g|png)$/i;
  var ICONO_ARCHIVO = { pdf: '📕', doc: '📝', docx: '📝', ppt: '📊', pptx: '📊', xls: '📗', xlsx: '📗', txt: '📄' };

  function icono(nombre) { var m = /\.([A-Za-z0-9]+)$/.exec(nombre || ''); return (m && ICONO_ARCHIVO[m[1].toLowerCase()]) || '📎'; }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  function boton(texto, fn, extra) {
    return el('button', { clase: 'boton boton-secundario boton-chico' + (extra ? ' ' + extra : ''), type: 'button', texto: texto, onclick: fn });
  }

  // ---- Fechas: «vence mañana» se entiende mejor que una fecha suelta ----
  function diasHasta(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) { return null; }
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - hoy.getTime()) / 86400000);
  }
  function cuandoVence(iso) {
    var dias = diasHasta(iso);
    if (dias === null) { return ''; }
    if (dias === 0) { return 'hoy'; }
    if (dias === 1) { return 'mañana'; }
    if (dias > 1 && dias <= 6) { return 'en ' + dias + ' días'; }
    return 'el ' + new Date(iso).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' });
  }
  function plazoInfo(t, entregada) {
    if (!t.fecha_limite) { return { texto: 'Sin fecha límite', clase: 'plazo' }; }
    var cuando = C.fechaHora(t.fecha_limite);
    if (entregada) { return { texto: '📅 Fecha límite: ' + cuando, clase: 'plazo' }; }
    if (new Date(t.fecha_limite).getTime() < Date.now()) {
      return { texto: '⏰ Venció el ' + cuando + '. Si entregas ahora, quedará como tardía.', clase: 'plazo vencido' };
    }
    return { texto: '📅 Vence ' + cuandoVence(t.fecha_limite) + ' · ' + cuando, clase: 'plazo' + (diasHasta(t.fecha_limite) <= 1 ? ' urgente' : '') };
  }

  // ---- Fotos en mosaico: la miniatura se pide solo cuando está a la vista ----
  function cargarMiniatura(observado, img, bucket, ruta) {
    var pedida = false;
    img.addEventListener('error', function () { img.hidden = true; });
    function traer() {
      if (pedida) { return; } pedida = true;
      try {
        Promise.resolve(db.storage.from(bucket).createSignedUrl(ruta, 600)).then(function (r) {
          if (r && !r.error && r.data) { img.src = r.data.signedUrl; img.hidden = false; }
        }).catch(function () { /* sin vista previa */ });
      } catch (e) { /* sin vista previa */ }
    }
    if (window.IntersectionObserver) {
      var o = new window.IntersectionObserver(function (es) {
        if (es.some(function (x) { return x.isIntersecting; })) { o.disconnect(); traer(); }
      }, { rootMargin: '300px' });
      o.observe(observado);
    } else { traer(); }
  }

  function esFoto(x) { return !!x.archivo_ruta && ES_FOTO.test(x.archivo_nombre || '') && !x.eliminado_en; }
  // Los títulos que son solo el nombre del archivo (20250108_203825.jpg) no aportan: no se muestran.
  function pieFoto(x) {
    var t = (x.titulo || '').trim();
    if (!t || t === x.archivo_nombre || ES_FOTO.test(t)) { return ''; }
    return t;
  }

  function mosaico(fotos, bucket) {
    return el('ul', { clase: 'mosaico' }, fotos.map(function (x) {
      var img = el('img', { alt: '', hidden: true, decoding: 'async' });
      var foto = el('button', {
        clase: 'mosaico-foto', type: 'button', 'aria-label': 'Ver foto' + (pieFoto(x) ? ': ' + pieFoto(x) : ''),
        onclick: function () { C.visorImagenes(fotos, x, bucket); }
      }, [el('span', { clase: 'mosaico-vacio', 'aria-hidden': 'true', texto: '🖼️' }), img]);
      cargarMiniatura(foto, img, bucket, x.archivo_ruta);
      var pie = pieFoto(x);
      return el('li', null, [foto, pie ? el('span', { clase: 'mosaico-pie', texto: pie }) : null]);
    }));
  }

  // Archivos que no son fotos (PDF, Word, enlaces…): una fila compacta con un solo botón.
  function filaArchivo(x, aviso) {
    var acciones = [];
    var esEnlace = x.tipo === 'enlace' || (!x.archivo_ruta && x.enlace);
    if (x.archivo_ruta) {
      var b = boton('Abrir', async function () {
        try { await C.abrir(C.BUCKET_MATERIALES, x.archivo_ruta); }
        catch (e) { aviso('No se pudo abrir el archivo. ' + C.textoError(e), 'error'); }
      }, 'boton-abrir');
      b.title = x.archivo_nombre || x.titulo || '';
      acciones.push(b);
    }
    var enlace = C.enlace(x.enlace, esEnlace && !x.archivo_ruta ? 'Abrir enlace' : 'Enlace');
    if (enlace) { enlace.className += ' boton-abrir'; acciones.push(enlace); }
    var sub = x.descripcion || (x.archivo_nombre && x.archivo_nombre !== x.titulo ? x.archivo_nombre : '');
    return el('li', { clase: 'archivo-fila' }, [
      el('span', { clase: 'archivo-icono', 'aria-hidden': 'true', texto: esEnlace && !x.archivo_ruta ? '🔗' : icono(x.archivo_nombre) }),
      el('div', { clase: 'archivo-info' }, [el('strong', { texto: x.titulo || x.archivo_nombre || 'Archivo' }), sub ? el('small', { texto: sub }) : null]),
      el('div', { clase: 'archivo-acciones' }, acciones)
    ]);
  }

  // Fotos arriba (mosaico) y el resto como filas. Devuelve una lista de nodos.
  function recursos(lista, aviso) {
    var fotos = lista.filter(esFoto);
    var otros = lista.filter(function (x) { return !esFoto(x); });
    fotos.forEach(function (x) { if (x.enlace) { otros.push({ titulo: x.titulo, enlace: x.enlace, tipo: 'enlace' }); } });
    var salida = [];
    if (fotos.length) { salida.push(mosaico(fotos, C.BUCKET_MATERIALES)); }
    if (otros.length) { salida.push(el('ul', { clase: 'archivos-lista' }, otros.map(function (x) { return filaArchivo(x, aviso); }))); }
    return salida;
  }

  P.renderEstudianteClases = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis clases y tareas' })]);
    zona.appendChild(sec);

    var mats = await consultar(db.from('portal2027_matriculas').select('anio_id,anio:portal2027_anios(anio)'));
    mats = mats.filter(function (m) { return m.anio; }).sort(function (a, b) { return b.anio.anio - a.anio.anio; });
    if (mats.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no tienes una matrícula registrada.' })); return; }
    var trims = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', mats[0].anio_id).order('numero'));
    if (trims.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este año no tiene trimestres.' })); return; }

    var sel = el('select', { 'aria-label': 'Trimestre' }, trims.map(function (t) { return el('option', { value: t.id, texto: 'Trimestre ' + t.numero }); }));
    var msg = el('p', { clase: 'mensaje aviso-fijo', role: 'status', 'aria-live': 'polite', hidden: true });
    var resumen = el('p', { clase: 'resumen-tareas', hidden: true });
    var cont = el('div', { clase: 'clases-contenido' });
    sec.appendChild(el('div', { clase: 'clases-barra' }, [resumen, el('label', { clase: 'selector-trimestre' }, ['Trimestre', sel])]));
    sec.appendChild(msg);
    sec.appendChild(cont);

    function aviso(texto, tipo) { msg.textContent = texto; msg.className = 'mensaje aviso-fijo ' + (tipo || 'info'); msg.hidden = !texto; }

    var entregaOcupada = false;
    function formEntrega(t, matriculaId) {
      var en = t.entrega, items = [], preparando = false, bloqueada = false, comentarioEnviado = null;
      var archivo = el('input', { type: 'file', accept: C.ACEPTAR, multiple: true, clase: 'archivo-oculto' });
      var coment = el('input', { type: 'text', maxlength: '1000', placeholder: 'Ej.: me costó el ejercicio 3' });
      var enviar = el('button', { clase: 'boton-entregar', type: 'submit', texto: en ? 'Guardar nueva entrega' : 'Guardar entrega' });
      var lista = el('ul', { clase: 'fotos-previas', hidden: true });
      var progreso = el('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Archivos preparados para entregar' });
      var estadoEntrega = el('p', { role: 'status', 'aria-live': 'polite' });
      var selector = el('label', { clase: 'selector-archivos' }, [
        el('span', { clase: 'selector-icono', 'aria-hidden': 'true', texto: '📷' }),
        el('span', { clase: 'selector-texto' }, [
          el('strong', { texto: en ? 'Elegir otras fotos' : 'Elegir fotos o un documento' }),
          el('small', { texto: 'Hasta 15 fotos JPG/PNG, o un documento (máx. ' + F.maxMB('entregas') + ' MB por archivo)' })
        ]),
        archivo
      ]);
      var f = el('form', { clase: 'formulario-clases formulario-entrega' }, [
        el('h5', { clase: 'entrega-titulo-form', texto: en ? 'Cambiar mi entrega' : 'Entrega tu tarea' }),
        selector,
        en ? el('p', { clase: 'bloque-ayuda', texto: 'Si entregas de nuevo, estas fotos reemplazan todo lo de tu entrega actual.' }) : null,
        lista, el('label', { clase: 'campo-comentario' }, ['Comentario (opcional)', coment]), enviar, progreso, estadoEntrega
      ]);
      function dibujarFotos() {
        lista.textContent = ''; lista.hidden = items.length === 0;
        items.forEach(function (it) {
          var miniatura;
          if (ES_FOTO.test(it.original.name)) {
            miniatura = el('img', { clase: 'prev-img', alt: 'Vista previa de ' + it.original.name });
            var url = URL.createObjectURL(it.final || it.original);
            miniatura.onload = miniatura.onerror = function () { URL.revokeObjectURL(url); };
            miniatura.src = url;
          } else {
            miniatura = el('span', { clase: 'prev-icono', 'aria-hidden': 'true', texto: icono(it.original.name) });
          }
          var quitar = boton('Quitar', function () { items = items.filter(function (x) { return x !== it; }); dibujarFotos(); }, 'prev-quitar');
          quitar.disabled = preparando || entregaOcupada || bloqueada;
          lista.appendChild(el('li', { clase: it.error ? 'prev-item con-error' : 'prev-item' }, [miniatura, el('div', { clase: 'prev-info' }, [
            el('strong', { texto: it.original.name }),
            el('small', { texto: it.error || (it.subida ? 'Subido; pendiente de confirmar la entrega' : 'Listo para enviar ✓') }),
            !it.error && it.final ? el('small', { texto: 'Pesa ' + F.peso(it.final.size) }) : null
          ]), F.esPDF(it.original) ? F.detalleArchivo(it.original, 'entregas') : null, quitar]));
        });
      }
      archivo.addEventListener('change', async function () {
        if (entregaOcupada || preparando || bloqueada) { return; }
        var elegidas = Array.prototype.slice.call(archivo.files || []); archivo.value = '';
        if (!elegidas.length) { return; }
        var todas = items.map(function (it) { return it.original; }).concat(elegidas);
        if (todas.length > 15) { aviso('Puedes adjuntar hasta 15 fotos.', 'error'); return; }
        if (todas.length > 1 && todas.some(function (a) { return !/\.(jpe?g|png)$/i.test(a.name); })) {
          aviso('Para enviar varios archivos, elige solo fotos JPG o PNG. Los documentos se entregan de uno en uno.', 'error'); return;
        }
        preparando = true; entregaOcupada = true; archivo.disabled = true; sel.disabled = true; enviar.disabled = true;
        estadoEntrega.textContent = 'Preparando los archivos…';
        try {
          for (var i = 0; i < elegidas.length; i++) {
            var it = { original: elegidas[i], final: null, ruta: null, subida: false, error: '' };
            items.push(it);
            try {
              it.final = await C.reducirImagen(it.original);
              var v = C.validar(it.final, 'entregas'); if (v.error) { throw new Error(v.error); }
            } catch (e) {
              console.error('Preparar adjunto', it.original.name, e);
              it.error = F.errorTamano(it.final || it.original, 'entregas') || 'No se pudo preparar. Quite este archivo y elija otro de los formatos permitidos.';
            }
            dibujarFotos();
          }
          estadoEntrega.textContent = items.some(function (it) { return it.error; }) ? 'Quita los archivos con errores para continuar.' : 'Archivos preparados. Guardando la entrega automáticamente…';
        } finally {
          preparando = false; entregaOcupada = false; archivo.disabled = false; sel.disabled = false; enviar.disabled = false; dibujarFotos();
          if (items.length && items.every(function (it) { return !!it.final && !it.error; })) { f.requestSubmit(); }
        }
      });
      f.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        if (bloqueada === 'conflicto') { return; }
        if (preparando || entregaOcupada) { aviso('Espere a que termine la preparación o subida actual.', 'info'); return; }
        if (!items.length) { aviso('Elige al menos una foto o un documento.', 'error'); return; }
        if (items.some(function (it) { return !it.final || (!it.ruta && it.error); })) { aviso('Quita los archivos que no se pudieron preparar antes de entregar.', 'error'); return; }
        entregaOcupada = true; bloqueada = true;
        if (comentarioEnviado === null) { comentarioEnviado = coment.value; }
        var controles = Array.prototype.slice.call(sec.querySelectorAll('button,input,select,textarea'));
        var previos = controles.map(function (c) { var d = c.disabled; c.disabled = true; return d; });
        progreso.hidden = false; progreso.max = items.length; progreso.value = 0;
        var recibida = false;
        try {
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            estadoEntrega.textContent = (i + 1) + ' de ' + items.length + ': ' + it.original.name;
            if (!it.subida) {
              try {
                if (!it.ruta) {
                  it.ruta = t.id + '/' + matriculaId + '/' + Date.now() + '-' +
                    (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2)) + '-' + C.nombreSeguro(it.final.name);
                }
                var v = C.validar(it.final, 'entregas'); if (v.error) { throw new Error(v.error); }
                var s = await db.storage.from(C.BUCKET_ENTREGAS).upload(it.ruta, it.final, { contentType: v.tipo, cacheControl: '0', upsert: false });
                if (s.error) {
                  // Si se perdió la respuesta de una subida confirmada, reutiliza la misma ruta.
                  var existe = await db.storage.from(C.BUCKET_ENTREGAS).createSignedUrl(it.ruta, 60);
                  if (existe.error || !existe.data) { throw s.error; }
                }
                it.subida = true; it.error = '';
              } catch (e) { console.error('Subir adjunto', it.original.name, e); it.error = 'No se pudo subir. Inténtalo de nuevo cuando tengas conexión.'; }
            }
            progreso.value = i + 1; dibujarFotos();
          }
          if (items.some(function (it) { return !it.subida; })) {
            estadoEntrega.textContent = 'Tu entrega todavía no se registró. Vuelve a intentarlo: se conservan los archivos ya subidos.';
            enviar.textContent = 'Reintentar entrega'; return;
          }
          estadoEntrega.textContent = 'Confirmando la entrega…';
          var g = await db.rpc('portal2027_entregar_tarea_archivos', {
            p_tarea: t.id, p_archivos: items.map(function (it) { return { ruta: it.ruta, nombre: it.final.name.slice(0, 200) }; }),
            p_comentario: comentarioEnviado, p_version: en ? en.version : null
          });
          if (g.error) { throw g.error; }
          recibida = true;
          estadoEntrega.textContent = 'Entrega recibida.';
          var actualizada = await cargar();
          if (!actualizada) { aviso('Tu entrega se guardó, pero la pantalla no se actualizó. Recarga la página para verla.', 'info'); return; }
          aviso(g.data && g.data.tardia ? 'Entrega recibida. Quedó marcada como tardía.' : 'Entrega recibida.', 'ok');
        } catch (e) {
          console.error('Confirmar entrega', e);
          if (recibida) { aviso('Tu entrega se guardó, pero la pantalla no se actualizó. Recarga la página para verla.', 'info'); }
          else if (/CONFLICTO|ya fue revisada/i.test((e && e.message) || '')) {
            estadoEntrega.textContent = 'Tu entrega cambió o el profesor ya la revisó. Recarga para ver su estado antes de volver a enviarla.';
            enviar.textContent = 'Recargar entrega';
            enviar.onclick = function () { if (!entregaOcupada) { cargar(); } };
            // El próximo clic recarga; no vuelve a registrar una versión anterior.
            f.onsubmit = function (evento) { evento.preventDefault(); };
            bloqueada = 'conflicto';
          } else {
            estadoEntrega.textContent = 'No se pudo confirmar tu entrega. Inténtalo otra vez: no hace falta subir los archivos de nuevo.';
            enviar.textContent = 'Reintentar entrega';
          }
        } finally {
          entregaOcupada = false;
          controles.forEach(function (c, i) { c.disabled = previos[i]; });
          archivo.disabled = recibida; coment.disabled = recibida; enviar.disabled = recibida;
          if (bloqueada === 'conflicto') { enviar.type = 'button'; }
          dibujarFotos();
        }
      });
      return f;
    }

    // «Tu entrega»: fotos en miniatura y un botón por archivo.
    function vistaEntrega(en) {
      var adjuntos = Array.isArray(en.archivos) && en.archivos.length ? en.archivos : [{ ruta: en.archivo_ruta, nombre: en.archivo_nombre }];
      var fotos = adjuntos.filter(function (a) { return ES_FOTO.test(a.nombre || ''); }).map(function (a) {
        return { id: a.ruta, titulo: a.nombre, archivo_ruta: a.ruta, archivo_nombre: a.nombre };
      });
      function abrirArchivo(a) {
        var foto = fotos.filter(function (x) { return x.archivo_ruta === a.ruta; })[0];
        if (foto && C.visorImagenes) { C.visorImagenes(fotos, foto, C.BUCKET_ENTREGAS); return; }
        return C.abrir(C.BUCKET_ENTREGAS, a.ruta).catch(function (e) {
          console.error('Abrir adjunto', e); aviso('No se pudo abrir el archivo. Inténtalo de nuevo.', 'error');
        });
      }
      var lista = el('ul', { clase: 'mosaico mosaico-entrega' }, adjuntos.map(function (a) {
        var miniatura = null;
        if (ES_FOTO.test(a.nombre || '')) {
          var img = el('img', { alt: '', hidden: true, decoding: 'async' });
          miniatura = el('div', { clase: 'mosaico-foto mosaico-quieta', 'aria-hidden': 'true', onclick: function () { abrirArchivo(a); } }, [el('span', { clase: 'mosaico-vacio', texto: '🖼️' }), img]);
          cargarMiniatura(miniatura, img, C.BUCKET_ENTREGAS, a.ruta);
        } else {
          miniatura = el('div', { clase: 'mosaico-foto mosaico-quieta', 'aria-hidden': 'true' }, [el('span', { clase: 'mosaico-vacio', texto: icono(a.nombre) })]);
        }
        return el('li', null, [miniatura, boton('Abrir ' + a.nombre, function () { return abrirArchivo(a); }, 'mosaico-boton')]);
      }));
      return el('div', { clase: 'entrega-hecha' }, [
        el('p', { clase: 'entrega-titulo', texto: 'Tu entrega · ' + plural(adjuntos.length, 'archivo', 'archivos') + (en.entregada_en ? ' · ' + C.fechaHora(en.entregada_en) : '') }),
        lista,
        en.comentario ? el('p', { clase: 'bloque-ayuda', texto: 'Tu comentario: ' + en.comentario }) : null,
        en.comentario_profesor ? el('p', { clase: 'nota-profe', texto: '💬 Comentario del profesor: ' + en.comentario_profesor }) : null
      ]);
    }

    function estadoTarea(en) {
      if (!en) { return { texto: 'Por entregar', clase: 'estado-pendiente' }; }
      if (en.estado === 'revisada') { return { texto: 'Revisada ✓', clase: 'estado-revisada' }; }
      return en.tardia ? { texto: 'Entregada (tardía)', clase: 'estado-tardia' } : { texto: 'Entregada ✓', clase: 'estado-entregada' };
    }

    function tarjetaTarea(t, matriculaId) {
      var en = t.entrega, est = estadoTarea(en), plazo = plazoInfo(t, !!en);
      var hijos = [
        t._n ? el('span', { clase: 'tarea-numero', texto: 'Tarea ' + t._n }) : null,
        el('div', { clase: 'tarea-cabecera' }, [el('strong', { clase: 'tarea-titulo', texto: t.titulo }), el('span', { clase: 'estado ' + est.clase, texto: est.texto })]),
        el('p', { clase: 'tarea-meta' }, [el('span', { clase: plazo.clase, texto: plazo.texto }), t.vale_nota ? el('span', { clase: 'vale-nota', texto: '⭐ Cuenta para la nota' }) : null]),
        t.instrucciones ? el('p', { clase: 'tarea-instrucciones', texto: t.instrucciones }) : null
      ];
      var anexos = Array.isArray(t.adjuntos) ? t.adjuntos : [];
      if (anexos.length) {
        hijos.push(el('div', { clase: 'adjuntos-tarea' }, [el('h4', { texto: '📎 Material de la tarea' })].concat(recursos(anexos, aviso))));
      }
      if (en) { hijos.push(vistaEntrega(en)); }
      if (!en || en.estado === 'entregada') { hijos.push(formEntrega(t, matriculaId)); }
      return el('li', { clase: 'tarea-tarjeta ' + est.clase }, hijos);
    }

    function resumirPendientes(datos) {
      var todas = [];
      datos.materias.forEach(function (m) { m.tareas.forEach(function (t) { todas.push(t); }); });
      var pend = todas.filter(function (t) { return !t.entrega; });
      resumen.hidden = todas.length === 0;
      if (!todas.length) { return; }
      if (!pend.length) { resumen.className = 'resumen-tareas resumen-ok'; resumen.textContent = '🎉 ¡Listo! No tienes tareas por entregar.'; return; }
      var proximas = pend.filter(function (t) { return t.fecha_limite && new Date(t.fecha_limite).getTime() >= Date.now(); })
        .sort(function (x, y) { return new Date(x.fecha_limite) - new Date(y.fecha_limite); });
      var vencidas = pend.filter(function (t) { return t.fecha_limite && new Date(t.fecha_limite).getTime() < Date.now(); }).length;
      var texto = '📝 Tienes ' + plural(pend.length, 'tarea por entregar', 'tareas por entregar');
      if (proximas.length) { texto += ' · la próxima vence ' + cuandoVence(proximas[0].fecha_limite); }
      if (vencidas) { texto += ' · ' + plural(vencidas, 'ya venció', 'ya vencieron'); }
      resumen.className = 'resumen-tareas' + (vencidas ? ' resumen-vencida' : (proximas.length && diasHasta(proximas[0].fecha_limite) <= 1 ? ' resumen-urgente' : ''));
      resumen.textContent = texto;
    }

    function dibujar(datos) {
      cont.textContent = '';
      resumirPendientes(datos);
      if (datos.materias.length === 0) {
        cont.appendChild(el('div', { clase: 'vacio-lindo' }, [el('span', { 'aria-hidden': 'true', texto: '🎒' }), el('p', { texto: 'Aún no hay materias asignadas a tu grupo en este trimestre.' })]));
        return;
      }
      datos.materias.forEach(function (m, idx) {
        var porEntregar = m.tareas.filter(function (t) { return !t.entrega; }).length;
        var cabeza = [el('h3', { texto: m.materia })];
        if (porEntregar) { cabeza.push(el('span', { clase: 'pill pill-pendiente', texto: plural(porEntregar, 'tarea por entregar', 'tareas por entregar') })); }
        else if (m.tareas.length) { cabeza.push(el('span', { clase: 'pill pill-ok', texto: 'Todo entregado 🎉' })); }
        var materia = el('section', { clase: 'materia-tarjeta color-' + (idx % 6) }, [el('div', { clase: 'materia-cabecera' }, cabeza)]);
        cont.appendChild(materia);
        var grupos = {};
        m.materiales.concat(m.tareas).forEach(function (x) { var id = x.clase_id || 'sin'; if (!grupos[id]) { grupos[id] = { id: id, numero: x.clase_numero, tema: x.clase_tema }; } });
        if (!Object.keys(grupos).length) { grupos.sin = { id: 'sin' }; }
        // La clase más reciente va primero; se abren las que tienen tareas por entregar.
        var ids = Object.keys(grupos).sort(function (a, b) { return (grupos[b].numero || -1) - (grupos[a].numero || -1); });
        ids.forEach(function (id, pos) {
          var g = grupos[id];
          var materiales = m.materiales.filter(function (x) { return (x.clase_id || 'sin') === id; });
          var tareas = m.tareas.filter(function (x) { return (x.clase_id || 'sin') === id; });
          // Numeración y orden fijos: Tarea 1, Tarea 2… según el orden en que el profesor las creó.
          // No se reordenan por fecha ni por estado (entregada o pendiente).
          tareas = tareas.slice().sort(function (x, y) {
            var a = x.creado_en || '', b = y.creado_en || '';
            return a < b ? -1 : (a > b ? 1 : 0);
          });
          tareas.forEach(function (x, i) { x._n = i + 1; });
          var pendientes = tareas.filter(function (t) { return !t.entrega; }).length;
          var pills = [];
          if (pendientes) { pills.push(el('span', { clase: 'pill pill-pendiente', texto: '✏️ ' + pendientes + ' por entregar' })); }
          if (materiales.length) { pills.push(el('span', { clase: 'pill', texto: '📎 ' + materiales.length })); }
          var bloque = el('details', { clase: 'clase-detalle', open: pendientes > 0 || pos === 0 }, [
            el('summary', null, [
              el('span', { clase: 'clase-titulo' }, g.numero
                ? [el('strong', { texto: 'Clase ' + g.numero }), g.tema ? el('span', { clase: 'clase-tema', texto: g.tema }) : null]
                : [el('strong', { texto: 'Sin clase asignada' })]),
              el('span', { clase: 'clase-pills' }, pills)
            ])
          ]);
          if (materiales.length === 0 && tareas.length === 0) {
            bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay materiales ni tareas.' }));
          }
          if (materiales.length) {
            bloque.appendChild(el('h4', { clase: 'seccion-titulo', texto: '📎 Material de la clase' }));
            recursos(materiales, aviso).forEach(function (n) { bloque.appendChild(n); });
          }
          if (tareas.length) {
            bloque.appendChild(el('h4', { clase: 'seccion-titulo titulo-tareas', texto: '✏️ Tareas de la clase' }));
            bloque.appendChild(el('ul', { clase: 'lista-tareas' }, tareas.map(function (t) { return tarjetaTarea(t, datos.matricula_id); })));
          }
          materia.appendChild(bloque);
        });
      });
    }

    async function cargar() {
      try {
        var r = await db.rpc('portal2027_mis_clases', { p_trimestre: sel.value });
        if (r.error) { throw r.error; }
        dibujar(r.data);
        return true;
      } catch (e) {
        cont.textContent = '';
        console.error('Cargar clases del estudiante', e);
        aviso('No se pudieron cargar tus clases. Revisa tu conexión y recarga la página.', 'error');
        return false;
      }
    }
    sel.addEventListener('change', function () { aviso('', 'info'); cargar(); });
    cont.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
    await cargar();
  };
})();
