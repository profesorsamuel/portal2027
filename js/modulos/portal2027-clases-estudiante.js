/* portal2027-clases-estudiante.js — «Mis clases y tareas» (guía, etapa 5, parte B): panel del estudiante.
   Los datos llegan de portal2027_mis_clases (solo lo publicado para su grupo y su propia entrega).
   La entrega sube el archivo a su carpeta privada y luego registra la tanda con portal2027_entregar_tarea_archivos. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var C = P.clases;

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }

  function boton(texto, fn) {
    return el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: texto, onclick: fn });
  }

  P.renderEstudianteClases = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis clases y tareas' })]);
    zona.appendChild(sec);

    var mats = await consultar(db.from('portal2027_matriculas').select('anio_id,anio:portal2027_anios(anio)'));
    mats = mats.filter(function (m) { return m.anio; }).sort(function (a, b) { return b.anio.anio - a.anio.anio; });
    if (mats.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no tiene una matrícula registrada.' })); return; }
    var trims = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', mats[0].anio_id).order('numero'));
    if (trims.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este año no tiene trimestres.' })); return; }

    var sel = el('select', { 'aria-label': 'Trimestre' }, trims.map(function (t) { return el('option', { value: t.id, texto: 'Trimestre ' + t.numero }); }));
    var msg = el('p', { clase: 'mensaje', role: 'status', 'aria-live': 'polite', hidden: true });
    var cont = el('div');
    sec.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Trimestre', sel])]));
    sec.appendChild(msg);
    sec.appendChild(cont);

    function aviso(texto, tipo) { msg.textContent = texto; msg.className = 'mensaje ' + (tipo || 'info'); msg.hidden = !texto; }

    var entregaOcupada = false;
    function formEntrega(t, matriculaId) {
      var en = t.entrega, items = [], preparando = false, bloqueada = false, comentarioEnviado = null;
      var archivo = el('input', { type: 'file', accept: C.ACEPTAR, multiple: true });
      var coment = el('input', { type: 'text', maxlength: '1000' });
      var enviar = el('button', { clase: 'boton boton-principal-chico', type: 'submit', texto: en ? 'Reemplazar mi entrega' : 'Entregar' });
      var lista = el('ul', { clase: 'fotos-previas' });
      var progreso = el('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Archivos preparados para entregar' });
      var estadoEntrega = el('p', { role: 'status', 'aria-live': 'polite' });
      var f = el('form', { clase: 'formulario-clases' }, [
        el('label', null, ['Hasta 15 fotos JPG/PNG o un documento individual (hasta 10 MB por archivo)', archivo]),
        el('p', { clase: 'bloque-ayuda', texto: en ? 'Esta tanda reemplazará todos los adjuntos de su entrega actual.' : 'Elija las fotos de su cuaderno o ejercicios.' }),
        lista, el('label', null, ['Comentario (opcional)', coment]), enviar, progreso, estadoEntrega
      ]);
      function dibujarFotos() {
        lista.textContent = '';
        items.forEach(function (it) {
          var img = null;
          if (/\.(jpe?g|png)$/i.test(it.original.name)) {
            img = el('img', { clase: 'foto-previa-miniatura', alt: 'Vista previa de ' + it.original.name });
            var url = URL.createObjectURL(it.final || it.original);
            img.onload = img.onerror = function () { URL.revokeObjectURL(url); };
            img.src = url;
          }
          var quitar = boton('Quitar', function () { items = items.filter(function (x) { return x !== it; }); dibujarFotos(); });
          quitar.disabled = preparando || entregaOcupada || bloqueada;
          lista.appendChild(el('li', null, [img, el('div', null, [
            el('strong', { texto: it.original.name }),
            el('small', { texto: 'Original: ' + (it.original.size / 1048576).toFixed(2) + ' MB · Final: ' + (it.final ? (it.final.size / 1048576).toFixed(2) + ' MB' : 'Sin preparar') }),
            el('small', { texto: it.error || (it.subida ? 'Subido; pendiente de confirmar la entrega' : 'Listo para enviar') })
          ]), quitar]));
        });
      }
      archivo.addEventListener('change', async function () {
        if (entregaOcupada || preparando || bloqueada) { return; }
        var elegidas = Array.prototype.slice.call(archivo.files || []); archivo.value = '';
        if (!elegidas.length) { return; }
        var todas = items.map(function (it) { return it.original; }).concat(elegidas);
        if (todas.length > 15) { aviso('Puede adjuntar hasta 15 fotos.', 'error'); return; }
        if (todas.length > 1 && todas.some(function (a) { return !/\.(jpe?g|png)$/i.test(a.name); })) {
          aviso('Para enviar varios archivos, elija solo fotos JPG o PNG. Los documentos se entregan individualmente.', 'error'); return;
        }
        preparando = true; entregaOcupada = true; archivo.disabled = true; sel.disabled = true; enviar.disabled = true;
        estadoEntrega.textContent = 'Preparando los archivos…';
        try {
          for (var i = 0; i < elegidas.length; i++) {
            var it = { original: elegidas[i], final: null, ruta: null, subida: false, error: '' };
            items.push(it);
            try {
              it.final = await C.reducirImagen(it.original);
              var v = C.validar(it.final); if (v.error) { throw new Error(v.error); }
            } catch (e) {
              console.error('Preparar adjunto', it.original.name, e);
              it.error = 'No se pudo preparar. Quite este archivo y elija otro permitido de hasta 10 MB.';
            }
            dibujarFotos();
          }
          estadoEntrega.textContent = 'Revise los archivos antes de entregar.';
        } finally {
          preparando = false; entregaOcupada = false; archivo.disabled = false; sel.disabled = false; enviar.disabled = false; dibujarFotos();
        }
      });
      f.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        if (bloqueada === 'conflicto') { return; }
        if (preparando || entregaOcupada) { aviso('Espere a que termine la preparación o subida actual.', 'info'); return; }
        if (!items.length) { aviso('Elija al menos una foto o un documento.', 'error'); return; }
        if (items.some(function (it) { return !it.final || (!it.ruta && it.error); })) { aviso('Quite los archivos que no se pudieron preparar antes de entregar.', 'error'); return; }
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
                var v = C.validar(it.final); if (v.error) { throw new Error(v.error); }
                var s = await db.storage.from(C.BUCKET_ENTREGAS).upload(it.ruta, it.final, { contentType: v.tipo, cacheControl: '0', upsert: false });
                if (s.error) {
                  // Si se perdió la respuesta de una subida confirmada, reutiliza la misma ruta.
                  var existe = await db.storage.from(C.BUCKET_ENTREGAS).createSignedUrl(it.ruta, 60);
                  if (existe.error || !existe.data) { throw s.error; }
                }
                it.subida = true; it.error = '';
              } catch (e) { console.error('Subir adjunto', it.original.name, e); it.error = 'No se pudo subir. Reintente con conexión disponible.'; }
            }
            progreso.value = i + 1; dibujarFotos();
          }
          if (items.some(function (it) { return !it.subida; })) {
            estadoEntrega.textContent = 'La entrega todavía no se registró. Reintente: se conservarán los archivos ya subidos.';
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
          if (!actualizada) { aviso('Su entrega se guardó, pero no se pudo actualizar la pantalla. Recargue para verla.', 'info'); return; }
          aviso(g.data && g.data.tardia ? 'Entrega recibida. Quedó marcada como tardía.' : 'Entrega recibida.', 'ok');
        } catch (e) {
          console.error('Confirmar entrega', e);
          if (recibida) { aviso('Su entrega se guardó, pero no se pudo actualizar la pantalla. Recargue para verla.', 'info'); }
          else if (/CONFLICTO|ya fue revisada/i.test((e && e.message) || '')) {
            estadoEntrega.textContent = 'La entrega cambió o el profesor ya la revisó. Recargue para consultar su estado antes de reenviar.';
            enviar.textContent = 'Recargar entrega';
            enviar.onclick = function () { if (!entregaOcupada) { cargar(); } };
            // El próximo clic recarga; no vuelve a registrar una versión anterior.
            f.onsubmit = function (evento) { evento.preventDefault(); };
            bloqueada = 'conflicto';
          } else {
            estadoEntrega.textContent = 'No se pudo confirmar la entrega. Reintente para comprobarla sin volver a subir los archivos.';
            enviar.textContent = 'Reintentar entrega';
          }
        } finally {
          entregaOcupada = false;
          controles.forEach(function (c, i) { c.disabled = previos[i]; });
          archivo.disabled = true; coment.disabled = true; enviar.disabled = recibida;
          if (bloqueada === 'conflicto') { enviar.type = 'button'; }
          dibujarFotos();
        }
      });
      return f;
    }

    function tarjetaTarea(t, matriculaId) {
      var en = t.entrega;
      var chips = [
        t.fecha_limite ? el('span', { clase: 'etiqueta-chica', texto: 'Plazo: ' + C.fechaHora(t.fecha_limite) }) : el('span', { clase: 'etiqueta-chica', texto: 'Sin plazo' }),
        t.vale_nota ? el('span', { clase: 'etiqueta-chica', texto: 'Cuenta para la nota' }) : null,
        el('span', { clase: 'etiqueta-chica', texto: !en ? 'Sin entregar' : (en.estado === 'revisada' ? 'Revisada' : (en.tardia ? 'Entregada (tardía)' : 'Entregada')) })
      ];
      var hijos = [
        el('div', null, [el('strong', { texto: t.titulo }), ' '].concat(chips)),
        t.instrucciones ? el('p', { clase: 'bloque-ayuda', texto: t.instrucciones }) : null
      ];
      if (en) {
        var adjuntos = Array.isArray(en.archivos) && en.archivos.length ? en.archivos : [{ ruta: en.archivo_ruta, nombre: en.archivo_nombre }];
        hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Su entrega: ' + adjuntos.length + ' archivo(s) · ' + C.fechaHora(en.entregada_en) }));
        hijos.push(el('div', { clase: 'cabecera-acciones' }, adjuntos.map(function (a) {
          return boton('Abrir ' + a.nombre, async function () {
            try { await C.abrir(C.BUCKET_ENTREGAS, a.ruta); }
            catch (e) { console.error('Abrir adjunto', e); aviso('No se pudo abrir el archivo. Inténtelo de nuevo.', 'error'); }
          });
        })));
        if (en.comentario_profesor) { hijos.push(el('p', { clase: 'mensaje info', texto: 'Comentario del profesor: ' + en.comentario_profesor })); }
      }
      if (!en || en.estado === 'entregada') { hijos.push(formEntrega(t, matriculaId)); }
      return el('li', { clase: 'tarjeta-clase tarjeta-columna' }, hijos);
    }

    function dibujar(datos) {
      cont.textContent = '';
      if (datos.materias.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay materias asignadas a su grupo en este trimestre.' })); return; }
      datos.materias.forEach(function (m) {
        var materia = el('div', { clase: 'detalle-ficha' }, [el('h3', { texto: m.materia })]);
        cont.appendChild(materia);
        var grupos = {};
        m.materiales.concat(m.tareas).forEach(function(x) { var id = x.clase_id || 'sin'; if (!grupos[id]) grupos[id] = { id: id, numero: x.clase_numero, tema: x.clase_tema }; });
        if (!Object.keys(grupos).length) grupos.sin = { id: 'sin' };
        Object.keys(grupos).sort(function(a,b) { return (grupos[a].numero || 9999) - (grupos[b].numero || 9999); }).forEach(function(id) {
        var g = grupos[id];
        var materiales = m.materiales.filter(function(x) { return (x.clase_id || 'sin') === id; });
        var tareas = m.tareas.filter(function(x) { return (x.clase_id || 'sin') === id; });
        var bloque = el('details', { clase: 'detalle-ficha' }, [el('summary', { texto: g.numero ? 'Clase ' + g.numero + ' · ' + (g.tema || '') : 'Sin clase asignada' })]);
        if (materiales.length === 0 && tareas.length === 0) {
          bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay materiales ni tareas.' }));
        }
        if (materiales.length) {
          bloque.appendChild(el('h4', { texto: 'Materiales' }));
          bloque.appendChild(el('ul', { clase: 'lista-clases' }, materiales.map(function (x) {
            return el('li', { clase: 'tarjeta-clase' }, [
              el('div', null, [el('strong', { texto: x.titulo }), x.descripcion ? el('p', { clase: 'bloque-ayuda', texto: x.descripcion }) : null]),
              C.miniatura(x),
              C.enlace(x.enlace, 'Abrir enlace de tarea o recurso'),
              x.archivo_ruta ? boton('Abrir ' + x.archivo_nombre, async function () {
                try { await C.abrir(C.BUCKET_MATERIALES, x.archivo_ruta); } catch (e) { aviso('No se pudo abrir el archivo. ' + C.textoError(e), 'error'); }
              }) : null
            ]);
          })));
        }
        if (tareas.length) {
          bloque.appendChild(el('h4', { texto: 'Tareas' }));
          bloque.appendChild(el('ul', { clase: 'lista-clases' }, tareas.map(function (t) { return tarjetaTarea(t, datos.matricula_id); })));
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
        aviso('No se pudieron cargar sus clases. Revise su conexión y recargue.', 'error');
        return false;
      }
    }
    sel.addEventListener('change', function () { aviso('', 'info'); cargar(); });
    cont.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
    await cargar();
  };
})();
