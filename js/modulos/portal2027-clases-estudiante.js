/* portal2027-clases-estudiante.js — «Mis clases y tareas» (guía, etapa 5, parte B): panel del estudiante.
   Los datos llegan de portal2027_mis_clases (solo lo publicado para su grupo y su propia entrega).
   La entrega sube el archivo a su carpeta privada y luego se registra con portal2027_entregar_tarea. */
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
        hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Su entrega: ' + en.archivo_nombre + ' · ' + C.fechaHora(en.entregada_en) }));
        hijos.push(el('div', { clase: 'cabecera-acciones' }, [boton('Abrir mi archivo', async function () {
          try { await C.abrir(C.BUCKET_ENTREGAS, en.archivo_ruta); } catch (e) { aviso('No se pudo abrir el archivo. ' + C.textoError(e), 'error'); }
        })]));
        if (en.comentario_profesor) { hijos.push(el('p', { clase: 'mensaje info', texto: 'Comentario del profesor: ' + en.comentario_profesor })); }
      }
      if (!en || en.estado === 'entregada') {
        var archivo = el('input', { type: 'file', accept: C.ACEPTAR });
        var coment = el('input', { type: 'text', maxlength: '1000' });
        var enviar = el('button', { clase: 'boton boton-principal-chico', type: 'submit', texto: en ? 'Reemplazar mi entrega' : 'Entregar' });
        var f = el('form', { clase: 'formulario-clases' }, [
          el('label', null, ['Archivo (hasta 10 MB)', archivo]),
          el('label', null, ['Comentario (opcional)', coment]),
          enviar
        ]);
        f.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var arch = archivo.files[0];
          var v = C.validar(arch);
          if (v.error) { aviso(v.error, 'error'); return; }
          enviar.disabled = true;
          aviso('Subiendo su entrega…', 'info');
          try {
            var ruta = t.id + '/' + matriculaId + '/' + Date.now() + '-' + C.nombreSeguro(arch.name);
            var s = await db.storage.from(C.BUCKET_ENTREGAS).upload(ruta, arch, { contentType: v.tipo, cacheControl: '0', upsert: false });
            if (s.error) { throw s.error; }
            var g = await db.rpc('portal2027_entregar_tarea', { p_tarea: t.id, p_ruta: ruta, p_nombre: arch.name, p_comentario: coment.value });
            if (g.error) { throw g.error; }
            await cargar();
            aviso(g.data && g.data.tardia ? 'Entrega recibida. Quedó marcada como tardía.' : 'Entrega recibida.', 'ok');
          } catch (e) {
            enviar.disabled = false;
            aviso('No se envió su entrega. ' + C.textoError(e), 'error');
          }
        });
        hijos.push(f);
      }
      return el('li', { clase: 'tarjeta-clase tarjeta-columna' }, hijos);
    }

    function dibujar(datos) {
      cont.textContent = '';
      if (datos.materias.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay materias asignadas a su grupo en este trimestre.' })); return; }
      datos.materias.forEach(function (m) {
        var bloque = el('div', { clase: 'detalle-ficha' }, [el('h3', { texto: m.materia })]);
        if (m.materiales.length === 0 && m.tareas.length === 0) {
          bloque.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay materiales ni tareas.' }));
        }
        if (m.materiales.length) {
          bloque.appendChild(el('h4', { texto: 'Materiales' }));
          bloque.appendChild(el('ul', { clase: 'lista-clases' }, m.materiales.map(function (x) {
            return el('li', { clase: 'tarjeta-clase' }, [
              el('div', null, [el('strong', { texto: x.titulo }), x.descripcion ? el('p', { clase: 'bloque-ayuda', texto: x.descripcion }) : null]),
              x.archivo_ruta ? boton('Abrir ' + x.archivo_nombre, async function () {
                try { await C.abrir(C.BUCKET_MATERIALES, x.archivo_ruta); } catch (e) { aviso('No se pudo abrir el archivo. ' + C.textoError(e), 'error'); }
              }) : null
            ]);
          })));
        }
        if (m.tareas.length) {
          bloque.appendChild(el('h4', { texto: 'Tareas' }));
          bloque.appendChild(el('ul', { clase: 'lista-clases' }, m.tareas.map(function (t) { return tarjetaTarea(t, datos.matricula_id); })));
        }
        cont.appendChild(bloque);
      });
    }

    async function cargar() {
      try {
        var r = await db.rpc('portal2027_mis_clases', { p_trimestre: sel.value });
        if (r.error) { throw r.error; }
        dibujar(r.data);
      } catch (e) {
        cont.textContent = '';
        aviso('No se pudo cargar. ' + C.textoError(e), 'error');
      }
    }
    sel.addEventListener('change', function () { aviso('', 'info'); cargar(); });
    cont.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
    await cargar();
  };
})();
