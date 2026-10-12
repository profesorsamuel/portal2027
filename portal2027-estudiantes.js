/* portal2027-estudiantes.js — etapa 2: fichas, importación de Excel, invitación y foto de perfil.
   Administración: importar, listar, invitar y ayudar con fotos.
   Profesor: ve a los estudiantes de sus grupos y puede ayudar con la foto.
   Estudiante: ve su ficha y cambia su propia foto.
   Los permisos reales los aplica la base (RLS y políticas de Storage). */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  var COLUMNAS = ['codigo_estudiante', 'nombres', 'apellidos', 'grado', 'seccion', 'anio_lectivo',
    'correo_estudiante', 'nombre_acudiente', 'telefono_acudiente', 'estado'];
  var OBLIGATORIAS = ['codigo_estudiante', 'nombres', 'apellidos', 'grado', 'seccion', 'anio_lectivo'];
  var BUCKET = 'portal2027-fotos';
  var MAX_FOTO = 2 * 1024 * 1024;
  var MAX_FILAS = 3000;
  var RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

  /* ---------- utilidades ---------- */
  async function consultar(q) {
    var r = await q;
    if (r.error) { throw r.error; }
    return r.data;
  }

  // Trae todas las filas aunque pasen de 1000 (límite por consulta de la API).
  async function todas(fabrica) {
    var salida = [];
    var desde = 0;
    for (;;) {
      var lote = await consultar(fabrica().range(desde, desde + 999));
      salida = salida.concat(lote);
      if (lote.length < 1000) { return salida; }
      desde += 1000;
    }
  }

  function crearAviso() {
    var n = el('p', { clase: 'mensaje', role: 'status', hidden: true });
    n.mostrar = function (texto, tipo) {
      n.textContent = texto || '';
      n.className = 'mensaje ' + (tipo || 'info');
      n.hidden = !texto;
    };
    return n;
  }

  function norm(t) { return String(t === null || t === undefined ? '' : t).trim(); }

  function urlBase() { return new URL(P.raiz, window.location.href).href; }

  function textoTabla(cabeceras, filas, vacio) {
    if (filas.length === 0) { return el('p', { clase: 'vacio-texto', texto: vacio }); }
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cabeceras.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }

  function nombreEst(e) { return (norm(e.nombres) + ' ' + norm(e.apellidos)).trim(); }

  /* ---------- foto ---------- */
  function tipoImagen(bytes) {
    if (bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) { return 'image/jpeg'; }
    if (bytes.length > 7 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) { return 'image/png'; }
    return null;
  }

  // Tarjeta con la foto del estudiante y, si se permite, botones para subir o quitar.
  // alCambiar(): se llama tras un cambio real y guardado.
  function tarjetaFoto(est, alCambiar) {
    var aviso = crearAviso();
    var imagen = el('div', { clase: 'foto-marco' }, [el('span', { clase: 'foto-vacia', texto: 'Sin foto' })]);
    var entrada = el('input', { type: 'file', accept: 'image/jpeg,image/png', 'aria-label': 'Elegir foto de ' + nombreEst(est) });
    var subir = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Subir foto' });
    var quitar = el('button', { clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Quitar foto', hidden: !est.foto_ruta });

    function ocupado(si) { subir.disabled = si; quitar.disabled = si; entrada.disabled = si; }

    async function mostrarFoto() {
      if (!est.foto_ruta) { return; }
      var r = await db.storage.from(BUCKET).createSignedUrl(est.foto_ruta, 600);
      if (r.error || !r.data) { aviso.mostrar('No se pudo cargar la foto.', 'error'); return; }
      imagen.textContent = '';
      imagen.appendChild(el('img', { src: r.data.signedUrl, alt: 'Foto de ' + nombreEst(est), clase: 'foto-img' }));
    }

    subir.addEventListener('click', async function () {
      var archivo = entrada.files && entrada.files[0];
      if (!archivo) { aviso.mostrar('Elija primero una imagen JPG o PNG.', 'error'); return; }
      if (archivo.size > MAX_FOTO) { aviso.mostrar('La foto pesa más de 2 MB. Elija una más pequeña.', 'error'); return; }
      ocupado(true);
      aviso.mostrar('Subiendo foto…', 'info');
      try {
        var bytes = new Uint8Array(await archivo.slice(0, 8).arrayBuffer());
        var tipo = tipoImagen(bytes);
        if (!tipo) { aviso.mostrar('El archivo no es una imagen JPG o PNG válida.', 'error'); ocupado(false); return; }
        var ruta = est.id + '/foto';
        var s = await db.storage.from(BUCKET).upload(ruta, archivo, { upsert: true, contentType: tipo, cacheControl: '0' });
        if (s.error) { throw s.error; }
        var g = await db.rpc('portal2027_guardar_foto_ruta', { p_estudiante: est.id, p_ruta: ruta });
        if (g.error) { throw g.error; }
        est.foto_ruta = ruta;
        quitar.hidden = false;
        entrada.value = '';
        await mostrarFoto();
        aviso.mostrar('Foto guardada.', 'ok');
        if (alCambiar) { alCambiar(); }
      } catch (e) {
        aviso.mostrar('No se guardó la foto. ' + P.traducirError(e), 'error');
      }
      ocupado(false);
    });

    quitar.addEventListener('click', async function () {
      if (!window.confirm('¿Quitar la foto de ' + nombreEst(est) + '?')) { return; }
      ocupado(true);
      try {
        var d = await db.storage.from(BUCKET).remove([est.foto_ruta]);
        if (d.error) { throw d.error; }
        var g = await db.rpc('portal2027_guardar_foto_ruta', { p_estudiante: est.id, p_ruta: null });
        if (g.error) { throw g.error; }
        est.foto_ruta = null;
        imagen.textContent = '';
        imagen.appendChild(el('span', { clase: 'foto-vacia', texto: 'Sin foto' }));
        quitar.hidden = true;
        aviso.mostrar('Foto quitada.', 'ok');
        if (alCambiar) { alCambiar(); }
      } catch (e) {
        aviso.mostrar('No se quitó la foto. ' + P.traducirError(e), 'error');
      }
      ocupado(false);
    });

    mostrarFoto().catch(function () { aviso.mostrar('No se pudo cargar la foto.', 'error'); });

    return el('div', { clase: 'foto-tarjeta' }, [
      imagen,
      el('div', { clase: 'foto-controles' }, [
        el('p', { clase: 'bloque-ayuda', texto: 'JPG o PNG, máximo 2 MB.' }),
        entrada,
        el('div', { clase: 'cabecera-acciones' }, [subir, quitar]),
        aviso
      ])
    ]);
  }

  /* ================= ADMINISTRACIÓN ================= */
  async function renderAdmin(zona, info) {
    var aviso = crearAviso();
    var sec = el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Estudiantes' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Importe la hoja «Importar» del Excel, revise la vista previa y confirme. Reimportar el mismo archivo no duplica: actualiza lo que cambió.' }),
      aviso
    ]);
    zona.appendChild(sec);

    var zonaImport = el('div', { clase: 'zona-importar' });
    var zonaLista = el('div', { clase: 'zona-lista' });
    sec.appendChild(zonaImport);
    sec.appendChild(el('h3', { texto: 'Lista de estudiantes' }));
    sec.appendChild(zonaLista);

    var anios = [];
    var existentes = { estudiantes: [], matriculas: [], salones: [] };

    async function cargarBase() {
      var r = await Promise.all([
        consultar(db.from('portal2027_anios').select('id,anio,activo').order('anio', { ascending: false })),
        todas(function () { return db.from('portal2027_estudiantes').select('id,codigo,nombres,apellidos,correo_estudiante,nombre_acudiente,telefono_acudiente').order('id'); }),
        todas(function () { return db.from('portal2027_matriculas').select('estudiante_id,anio_id,estado,salon_id').order('id'); }),
        consultar(db.from('portal2027_salones').select('id,anio_id,nombre'))
      ]);
      anios = r[0];
      existentes = { estudiantes: r[1], matriculas: r[2], salones: r[3] };
    }

    /* ----- importación ----- */
    function leerHoja(buffer, nombreArchivo) {
      if (!window.XLSX) { throw new Error('No se pudo cargar la biblioteca para leer Excel. Revise su internet y recargue.'); }
      var libro = window.XLSX.read(buffer, { type: 'array' });
      var nombre = libro.SheetNames.filter(function (n) { return n.trim().toLowerCase() === 'importar'; })[0];
      if (!nombre) {
        if (/\.csv$/i.test(nombreArchivo) && libro.SheetNames.length === 1) { nombre = libro.SheetNames[0]; }
        else { throw new Error('No se encontró la hoja «Importar» en el archivo.'); }
      }
      var matriz = window.XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: false, defval: '', blankrows: false });
      if (matriz.length === 0) { throw new Error('La hoja «Importar» está vacía.'); }
      var cab = matriz[0].map(function (c) { return norm(c).replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, '_'); });
      var faltan = OBLIGATORIAS.filter(function (c) { return cab.indexOf(c) === -1; });
      if (faltan.length) { throw new Error('Faltan columnas en la hoja: ' + faltan.join(', ') + '.'); }
      var filas = [];
      for (var i = 1; i < matriz.length; i++) {
        var o = { _fila: i + 1 };
        COLUMNAS.forEach(function (c) {
          var pos = cab.indexOf(c);
          o[c] = pos === -1 ? '' : norm(matriz[i][pos]);
        });
        var vacia = COLUMNAS.every(function (c) { return o[c] === ''; });
        if (!vacia) { filas.push(o); }
      }
      return filas;
    }

    function analizar(filas) {
      var aniosPorNum = {};
      anios.forEach(function (a) { aniosPorNum[a.anio] = a; });
      var porCodigo = {};
      existentes.estudiantes.forEach(function (e) { porCodigo[e.codigo.toLowerCase()] = e; });
      var correoDe = {};
      existentes.estudiantes.forEach(function (e) { if (e.correo_estudiante) { correoDe[e.correo_estudiante.toLowerCase()] = e.codigo.toLowerCase(); } });
      var gruposPorAnio = {};
      existentes.salones.forEach(function (s) { gruposPorAnio[s.anio_id + '|' + s.nombre] = s; });

      var vistos = {};
      var correosArchivo = {};
      var gruposNuevos = {};

      filas.forEach(function (f) {
        f.errores = [];
        var cod = f.codigo_estudiante.toLowerCase();
        f.seccion = f.seccion.toUpperCase();
        f.estadoNorm = f.estado ? f.estado.toLowerCase() : 'activo';
        if (!f.codigo_estudiante || !f.nombres || !f.apellidos) { f.errores.push('Faltan código, nombres o apellidos'); }
        if (!/^[0-9]{1,2}$/.test(f.grado)) { f.errores.push('Grado no válido'); }
        if (!/^[A-Z]{1,2}$/.test(f.seccion)) { f.errores.push('Sección no válida'); }
        var anio = /^[0-9]{4}$/.test(f.anio_lectivo) ? parseInt(f.anio_lectivo, 10) : NaN;
        var filaAnio = aniosPorNum[anio];
        if (isNaN(anio)) { f.errores.push('Año lectivo no válido'); }
        else if (!filaAnio) { f.errores.push('El año ' + anio + ' no existe; créelo en Años lectivos'); }
        var correo = f.correo_estudiante.toLowerCase();
        if (correo && !RE_CORREO.test(correo)) { f.errores.push('Correo no válido'); }
        if (correo) {
          if (correosArchivo[correo] && correosArchivo[correo] !== cod) { f.errores.push('El correo está en otro código del archivo'); }
          if (correoDe[correo] && correoDe[correo] !== cod) { f.errores.push('El correo ya pertenece a otro estudiante'); }
          correosArchivo[correo] = cod;
        }
        var clave = cod + '|' + anio;
        if (cod && vistos[clave]) { f.errores.push('Código repetido en el archivo para ' + anio + ' (fila ' + vistos[clave] + ')'); }
        else if (cod) { vistos[clave] = f._fila; }

        // Qué pasará con esta fila.
        var ex = porCodigo[cod];
        var grupo = f.grado + f.seccion;
        f.accion = 'Estudiante nuevo';
        if (ex) {
          var mat = filaAnio ? existentes.matriculas.filter(function (m) { return m.estudiante_id === ex.id && m.anio_id === filaAnio.id; })[0] : null;
          var salonActual = mat ? existentes.salones.filter(function (s) { return s.id === mat.salon_id; })[0] : null;
          if (mat) {
            var igual = salonActual && salonActual.nombre === grupo && mat.estado === f.estadoNorm
              && ex.nombres === f.nombres && ex.apellidos === f.apellidos
              && (!f.correo_estudiante || (ex.correo_estudiante || '').toLowerCase() === correo)
              && (!f.nombre_acudiente || ex.nombre_acudiente === f.nombre_acudiente)
              && (!f.telefono_acudiente || ex.telefono_acudiente === f.telefono_acudiente);
            f.accion = igual ? 'Sin cambios' : 'Se actualiza';
          } else { f.accion = 'Existe; matrícula nueva'; }
        }
        if (filaAnio && !gruposPorAnio[filaAnio.id + '|' + grupo] && /^[0-9]{1,2}$/.test(f.grado) && /^[A-Z]{1,2}$/.test(f.seccion)) {
          gruposNuevos[anio + '|' + grupo] = true;
        }
      });
      return { filas: filas, gruposNuevos: Object.keys(gruposNuevos).map(function (k) { return k.replace('|', ' · '); }) };
    }

    function pintarVistaPrevia(contenedor, resultado) {
      contenedor.textContent = '';
      var filas = resultado.filas;
      var conError = filas.filter(function (f) { return f.errores.length > 0; });
      var cuenta = {};
      filas.forEach(function (f) { if (!f.errores.length) { cuenta[f.accion] = (cuenta[f.accion] || 0) + 1; } });

      var resumen = ['Filas leídas: ' + filas.length, 'Con errores: ' + conError.length]
        .concat(Object.keys(cuenta).map(function (k) { return k + ': ' + cuenta[k]; }));
      contenedor.appendChild(el('p', { clase: 'mensaje ' + (conError.length ? 'error' : 'info'), texto: resumen.join(' · ') }));
      if (resultado.gruposNuevos.length) {
        contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Grupos que se crearán: ' + resultado.gruposNuevos.join(', ') + '. Revise que no haya letras mal escritas.' }));
      }
      var estados = {};
      filas.forEach(function (f) { estados[f.estadoNorm] = true; });
      contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Valores de «estado» encontrados: ' + Object.keys(estados).join(', ') + '.' }));

      var mostrar = conError.concat(filas.filter(function (f) { return !f.errores.length; })).slice(0, 60);
      var cuerpo = mostrar.map(function (f) {
        return el('tr', null, [
          el('td', { texto: String(f._fila) }),
          el('td', { texto: f.codigo_estudiante }),
          el('td', { texto: (f.nombres + ' ' + f.apellidos).trim() }),
          el('td', { texto: f.grado + f.seccion }),
          el('td', { texto: f.anio_lectivo }),
          el('td', { texto: f.errores.length ? f.errores.join('; ') : f.accion, clase: f.errores.length ? 'celda-error' : '' })
        ]);
      });
      contenedor.appendChild(textoTabla(['Fila', 'Código', 'Nombre', 'Grupo', 'Año', 'Resultado'], cuerpo, ''));
      if (filas.length > mostrar.length) {
        contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Se muestran las filas con error primero y un máximo de 60. Se importan todas.' }));
      }
    }

    function dibujarImportacion() {
      zonaImport.textContent = '';
      var entrada = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', 'aria-label': 'Archivo de Excel' });
      var vista = el('div', { clase: 'vista-previa' });
      var confirmar = el('button', { clase: 'boton', type: 'button', texto: 'Confirmar importación', hidden: true });
      var resultadoActual = null;

      entrada.addEventListener('change', async function () {
        vista.textContent = '';
        confirmar.hidden = true;
        resultadoActual = null;
        aviso.mostrar('', 'info');
        var archivo = entrada.files && entrada.files[0];
        if (!archivo) { return; }
        try {
          aviso.mostrar('Leyendo archivo…', 'info');
          var filas = leerHoja(await archivo.arrayBuffer(), archivo.name);
          if (filas.length === 0) { throw new Error('La hoja «Importar» no tiene filas con datos.'); }
          if (filas.length > MAX_FILAS) { throw new Error('El archivo tiene más de ' + MAX_FILAS + ' filas. Divídalo en partes.'); }
          await cargarBase(); // datos al día para comparar
          resultadoActual = analizar(filas);
          pintarVistaPrevia(vista, resultadoActual);
          var hayErrores = resultadoActual.filas.some(function (f) { return f.errores.length > 0; });
          confirmar.hidden = hayErrores;
          aviso.mostrar(hayErrores
            ? 'Corrija los errores en el Excel y vuelva a cargarlo. No se importó nada.'
            : 'Vista previa lista. Revise y confirme para importar.', hayErrores ? 'error' : 'info');
        } catch (e) {
          aviso.mostrar(e.message && !e.code ? e.message : P.traducirError(e), 'error');
        }
      });

      confirmar.addEventListener('click', async function () {
        if (!resultadoActual) { return; }
        if (!window.confirm('¿Importar ' + resultadoActual.filas.length + ' filas?')) { return; }
        confirmar.disabled = true;
        entrada.disabled = true;
        aviso.mostrar('Importando…', 'info');
        try {
          var envio = resultadoActual.filas.map(function (f) {
            var o = {};
            COLUMNAS.forEach(function (c) { o[c] = f[c]; });
            return o;
          });
          var r = await db.rpc('portal2027_importar_estudiantes', { p_filas: envio });
          if (r.error) { throw r.error; }
          var d = r.data;
          vista.textContent = '';
          confirmar.hidden = true;
          entrada.value = '';
          resultadoActual = null;
          aviso.mostrar('Importación guardada. Estudiantes nuevos: ' + d.estudiantes_nuevos + ', actualizados: ' + d.estudiantes_actualizados
            + '. Matrículas nuevas: ' + d.matriculas_nuevas + ', actualizadas: ' + d.matriculas_actualizadas
            + '. Grupos creados: ' + d.grupos_creados + '.', 'ok');
          await cargarBase();
          dibujarLista();
        } catch (e) {
          var m = (e && e.message) || '';
          aviso.mostrar(/^Fila \d+/.test(m) || /^(No hay filas|Máximo)/.test(m) ? 'No se importó nada. ' + m : 'No se importó nada. ' + P.traducirError(e), 'error');
        }
        confirmar.disabled = false;
        entrada.disabled = false;
      });

      zonaImport.appendChild(el('p', { clase: 'bloque-ayuda' }, [
        el('a', {
          clase: 'boton boton-secundario boton-chico',
          href: P.raiz + 'assets/plantillas/portal2027-plantilla-importar-estudiantes.xlsx',
          download: 'portal2027-plantilla-importar-estudiantes.xlsx',
          texto: 'Descargar plantilla de Excel'
        }),
        ' Llénela (borre las filas de ejemplo) y súbala aquí abajo.'
      ]));
      zonaImport.appendChild(el('label', null, ['Archivo Excel (.xlsx) con la hoja «Importar»', entrada]));
      zonaImport.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Columnas: ' + COLUMNAS.join(', ') + '. El correo y el estado son opcionales (sin estado se usa «activo»).' }));
      zonaImport.appendChild(vista);
      zonaImport.appendChild(confirmar);
    }

    /* ----- lista, invitación y foto ----- */
    var anioElegido = null;
    var texto = '';

    async function dibujarLista() {
      zonaLista.textContent = '';
      if (!anioElegido && anios.length) {
        var act = anios.filter(function (a) { return a.activo; })[0] || anios[0];
        anioElegido = act.id;
      }
      var selAnio = el('select', { 'aria-label': 'Año' }, anios.map(function (a) {
        return el('option', { value: a.id, texto: String(a.anio), selected: a.id === anioElegido });
      }));
      var buscar = el('input', { type: 'search', placeholder: 'Buscar por código o nombre', value: texto, 'aria-label': 'Buscar estudiante' });
      zonaLista.appendChild(el('div', { clase: 'formulario-fila' }, [el('label', null, ['Año', selAnio]), el('label', null, ['Buscar', buscar])]));
      var cuerpo = el('div');
      var detalle = el('div', { clase: 'detalle-ficha' });
      zonaLista.appendChild(cuerpo);
      zonaLista.appendChild(detalle);

      selAnio.addEventListener('change', function () { anioElegido = selAnio.value; dibujarLista(); });
      buscar.addEventListener('input', function () { texto = buscar.value; pintar(); });

      var matAnio = [];
      try {
        matAnio = await todas(function () {
          return db.from('portal2027_matriculas')
            .select('estado, salon:portal2027_salones(nombre), estudiante:portal2027_estudiantes(id,codigo,nombres,apellidos,correo_estudiante,usuario_id,invitado_en,foto_ruta)')
            .eq('anio_id', anioElegido).order('id');
        });
      } catch (e) { cuerpo.appendChild(el('p', { clase: 'mensaje error', texto: P.traducirError(e) })); return; }

      matAnio = matAnio.filter(function (m) { return m.estudiante; }).sort(function (a, b) {
        var ga = a.salon ? a.salon.nombre : '', gb = b.salon ? b.salon.nombre : '';
        return ga.localeCompare(gb, 'es', { numeric: true }) || a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es');
      });

      function pintar() {
        cuerpo.textContent = '';
        var q = texto.trim().toLowerCase();
        var lista = matAnio.filter(function (m) {
          return !q || m.estudiante.codigo.toLowerCase().indexOf(q) !== -1 || nombreEst(m.estudiante).toLowerCase().indexOf(q) !== -1;
        });
        var filas = lista.slice(0, 200).map(function (m) {
          var e = m.estudiante;
          var cuenta = e.usuario_id ? 'Vinculada' : (e.correo_estudiante ? 'Sin cuenta' : 'Sin correo');
          var invitar = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Invitar', disabled: !!e.usuario_id || !e.correo_estudiante });
          invitar.addEventListener('click', async function () {
            if (!window.confirm('¿Enviar invitación a ' + e.correo_estudiante + '?')) { return; }
            invitar.disabled = true;
            aviso.mostrar('Enviando invitación…', 'info');
            try {
              var r = await db.functions.invoke('portal2027-invitar-estudiante', { body: { estudiante_id: e.id, redirect_to: urlBase() } });
              if (r.error) {
                var detalleError = '';
                try { detalleError = (await r.error.context.json()).error; } catch (x) { /* sin detalle */ }
                throw new Error(detalleError || r.error.message);
              }
              aviso.mostrar(r.data.accion === 'invitada'
                ? 'Invitación enviada a ' + r.data.correo + '.' : 'Cuenta existente vinculada a la ficha.', 'ok');
              await dibujarLista();
            } catch (err) {
              aviso.mostrar('No se pudo invitar. ' + (err.message || ''), 'error');
              invitar.disabled = false;
            }
          });
          var ver = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Foto', onclick: function () {
            detalle.textContent = '';
            detalle.appendChild(el('h3', { texto: 'Foto de ' + nombreEst(e) }));
            detalle.appendChild(tarjetaFoto(e, null));
            detalle.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } });
          return el('tr', null, [
            el('td', { texto: e.codigo }), el('td', { texto: nombreEst(e) }),
            el('td', { texto: m.salon ? m.salon.nombre : '' }), el('td', { texto: m.estado }),
            el('td', { texto: e.correo_estudiante || '' }), el('td', { texto: cuenta + (e.foto_ruta ? ' · con foto' : '') }),
            el('td', null, [el('div', { clase: 'cabecera-acciones' }, [ver, invitar])])
          ]);
        });
        cuerpo.appendChild(textoTabla(['Código', 'Nombre', 'Grupo', 'Estado', 'Correo', 'Cuenta', ''], filas,
          anios.length ? 'No hay estudiantes matriculados en este año.' : 'Primero cree un año lectivo.'));
        if (lista.length > 200) { cuerpo.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Se muestran 200 de ' + lista.length + '. Use el buscador.' })); }
      }
      pintar();
    }

    await cargarBase();
    dibujarImportacion();
    await dibujarLista();
  }

  /* ================= PROFESOR ================= */
  async function renderProfesor(zona, info) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis estudiantes' })]);
    zona.appendChild(sec);
    var asig = await consultar(db.from('portal2027_asignaciones').select('salon_id').eq('profesor_id', info.sesion.user.id));
    var ids = asig.map(function (a) { return a.salon_id; });
    var mats = ids.length === 0 ? [] : await todas(function () {
      return db.from('portal2027_matriculas')
        .select('salon:portal2027_salones(nombre, anio:portal2027_anios(anio)), estudiante:portal2027_estudiantes(id,codigo,nombres,apellidos,foto_ruta)')
        .in('salon_id', ids).order('id');
    });
    mats = mats.filter(function (m) { return m.estudiante && m.salon; });
    if (mats.length === 0) {
      sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay estudiantes en sus grupos.' }));
      return;
    }
    mats.sort(function (a, b) {
      return (b.salon.anio ? b.salon.anio.anio : 0) - (a.salon.anio ? a.salon.anio.anio : 0)
        || a.salon.nombre.localeCompare(b.salon.nombre, 'es', { numeric: true })
        || a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es');
    });
    var detalle = el('div', { clase: 'detalle-ficha' });
    var filas = mats.map(function (m) {
      var e = m.estudiante;
      return el('tr', null, [
        el('td', { texto: String(m.salon.anio ? m.salon.anio.anio : '') }), el('td', { texto: m.salon.nombre }),
        el('td', { texto: e.codigo }), el('td', { texto: nombreEst(e) }),
        el('td', null, [el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Foto', onclick: function () {
          detalle.textContent = '';
          detalle.appendChild(el('h3', { texto: 'Foto de ' + nombreEst(e) }));
          detalle.appendChild(tarjetaFoto(e, null));
        } })])
      ]);
    });
    sec.appendChild(textoTabla(['Año', 'Grupo', 'Código', 'Nombre', ''], filas, ''));
    sec.appendChild(detalle);
  }

  /* ================= ESTUDIANTE ================= */
  async function renderEstudiante(zona, info) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mi información' })]);
    zona.appendChild(sec);
    var fichas = await consultar(db.from('portal2027_estudiantes')
      .select('id,codigo,nombres,apellidos,foto_ruta,matriculas:portal2027_matriculas(estado, salon:portal2027_salones(nombre), anio:portal2027_anios(anio))')
      .eq('usuario_id', info.sesion.user.id));
    if (fichas.length === 0) {
      sec.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Su cuenta está activa, pero todavía no está vinculada a una ficha de estudiante. Consulte con la administración.' }));
      return;
    }
    var f = fichas[0];
    var mats = (f.matriculas || []).slice().sort(function (a, b) { return (b.anio ? b.anio.anio : 0) - (a.anio ? a.anio.anio : 0); });
    sec.appendChild(el('p', null, [el('strong', { texto: nombreEst(f) }), ' · Código ' + f.codigo]));
    sec.appendChild(textoTabla(['Año', 'Grupo', 'Estado'], mats.map(function (m) {
      return el('tr', null, [el('td', { texto: m.anio ? String(m.anio.anio) : '' }), el('td', { texto: m.salon ? m.salon.nombre : '' }), el('td', { texto: m.estado })]);
    }), 'Aún no tiene matrícula registrada.'));
    sec.appendChild(el('h3', { texto: 'Mi foto' }));
    sec.appendChild(tarjetaFoto(f, null));
  }

  P.renderEstudiantesAdmin = renderAdmin;
  P.renderEstudiantesProfesor = renderProfesor;
  P.renderEstudianteFicha = renderEstudiante;
})();
