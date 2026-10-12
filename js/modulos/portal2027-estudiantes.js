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

  var COLUMNAS = ['codigo_estudiante', 'nombres', 'cedula', 'sexo', 'grado', 'seccion', 'anio_lectivo',
    'correo_estudiante', 'nombre_acudiente', 'telefono_acudiente', 'estado'];
  // La cédula nunca viaja a la función de importación de la base: solo va a la función de accesos.
  // Lo que recibe la base: sin cédula y con los apellidos ya separados del nombre.
  var COLUMNAS_BD = COLUMNAS.filter(function (c) { return c !== 'cedula'; }).concat(['apellidos']);
  var OBLIGATORIAS = ['codigo_estudiante', 'nombres', 'cedula', 'sexo', 'grado', 'seccion', 'anio_lectivo'];
  var MIN_CEDULA = 6;
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

  // Pasa «BEST; LIANELYS» o «Abrego, Yerlyn» a Title Case, sin tocar lo que ya viene bien escrito.
  function arreglarMayusculas(t) {
    if (!t || t !== t.toUpperCase()) { return t; }
    return t.toLowerCase().replace(/(^|[\s'-])([a-záéíóúüñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\s(De|Del|La|Las|Los|Y)(?=\s)/g, function (m) { return m.toLowerCase(); });
  }

  // La hoja trae el nombre completo en una columna. Con coma o punto y coma («Pérez Gómez, Ana María») se separa
  // el apellido (antes) del nombre (después). Sin separador, todo queda en «nombres» y los apellidos vacíos.
  function partirNombre(texto) {
    var t = norm(texto).replace(/\s+/g, ' ');
    var i = t.search(/[;,]/);
    if (i === -1) { return { nombres: arreglarMayusculas(t), apellidos: '' }; }
    var ape = norm(t.slice(0, i)).replace(/\s+/g, ' ');
    var nom = norm(t.slice(i + 1).replace(/[;,]/g, ' ')).replace(/\s+/g, ' ');
    if (!nom) { return { nombres: arreglarMayusculas(ape), apellidos: '' }; }
    return { nombres: arreglarMayusculas(nom), apellidos: arreglarMayusculas(ape) };
  }

  // Igual que en la pantalla de entrada y en el servidor: solo letras y números, en mayúsculas.
  function normCedula(c) { return String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
  // Acepta Femenino/Masculino o F/M (sin importar mayúsculas). Devuelve 'F', 'M', '' (vacío) o null (no válido).
  function normSexo(v) {
    var t = String(v || '').trim().toLowerCase();
    if (t === '') { return ''; }
    if (t === 'f' || t === 'femenino') { return 'F'; }
    if (t === 'm' || t === 'masculino') { return 'M'; }
    return null;
  }
  function textoSexo(v) { return v === 'F' ? 'Femenino' : (v === 'M' ? 'Masculino' : ''); }
  function ocultarCedula(c) { var n = normCedula(c); return n ? '••••' + n.slice(-3) : ''; }

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
    var zonaAccesos = el('div');
    sec.appendChild(zonaAccesos);
    sec.appendChild(el('h3', { texto: 'Lista de estudiantes' }));
    sec.appendChild(zonaLista);

    var anios = [];
    var existentes = { estudiantes: [], matriculas: [], salones: [] };

    async function cargarBase() {
      var r = await Promise.all([
        consultar(db.from('portal2027_anios').select('id,anio,activo').order('anio', { ascending: false })),
        todas(function () { return db.from('portal2027_estudiantes').select('id,codigo,nombres,apellidos,correo_estudiante,nombre_acudiente,telefono_acudiente,usuario_id,sexo').order('id'); }),
        todas(function () { return db.from('portal2027_matriculas').select('estudiante_id,anio_id,estado,salon_id').order('id'); }),
        consultar(db.from('portal2027_salones').select('id,anio_id,nombre'))
      ]);
      anios = r[0];
      existentes = { estudiantes: r[1], matriculas: r[2], salones: r[3] };
    }

    // Envía códigos y cédulas a la función de servidor, de 200 en 200. No guarda la cédula en ninguna tabla.
    async function crearAccesosEnLotes(filas, alAvanzar) {
      var res = { creados: 0, actualizados: 0, errores: [] };
      for (var d = 0; d < filas.length; d += 200) {
        if (alAvanzar) { alAvanzar(Math.min(d + 200, filas.length), filas.length); }
        var r = await db.functions.invoke('portal2027-crear-accesos', { body: { accesos: filas.slice(d, d + 200) } });
        if (r.error) {
          var det = '';
          try { det = (await r.error.context.json()).error; } catch (x) { /* sin detalle */ }
          if (!det && r.error.name === 'FunctionsFetchError') {
            det = 'no se pudo contactar la función «portal2027-crear-accesos». Revise en Supabase > Edge Functions que esté creada y con «Verify JWT» DESACTIVADO.';
          }
          throw new Error(det || r.error.message);
        }
        r.data.resultados.forEach(function (x) {
          if (x.estado === 'creado') { res.creados++; } else if (x.estado === 'actualizado') { res.actualizados++; } else { res.errores.push(x); }
        });
      }
      return res;
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
      if (faltan.length) { throw new Error('Faltan columnas en la hoja: ' + faltan.join(', ') + '. Si su Excel es antiguo, descargue la plantilla nueva (trae las columnas cedula y sexo).'); }
      var filas = [];
      for (var i = 1; i < matriz.length; i++) {
        var o = { _fila: i + 1 };
        COLUMNAS.forEach(function (c) {
          var pos = cab.indexOf(c);
          o[c] = pos === -1 ? '' : norm(matriz[i][pos]);
        });
        var vacia = COLUMNAS.every(function (c) { return o[c] === ''; });
        if (vacia) { continue; }
        o.nombre_original = o.nombres;
        var posApe = cab.indexOf('apellidos'); // Excel antiguo: si trae apellidos aparte, se respetan.
        var apeAparte = posApe === -1 ? '' : norm(matriz[i][posApe]);
        if (apeAparte) { o.apellidos = apeAparte; o.nombre_original = (o.nombres + ' ' + apeAparte).trim(); }
        else { var par = partirNombre(o.nombres); o.nombres = par.nombres; o.apellidos = par.apellidos; }
        filas.push(o);
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
      var cedulasArchivo = {};
      var correosArchivo = {};
      var gruposNuevos = {};

      filas.forEach(function (f) {
        f.errores = [];
        var cod = f.codigo_estudiante.toLowerCase();
        f.seccion = f.seccion.toUpperCase();
        f.estadoNorm = f.estado ? f.estado.toLowerCase() : 'activo';
        if (!f.codigo_estudiante || !f.nombres) { f.errores.push('Faltan el código o el nombre'); }
        if (!/^[0-9]{1,2}$/.test(f.grado)) { f.errores.push('Grado no válido'); }
        if (!/^[A-Z]{1,2}$/.test(f.seccion)) { f.errores.push('Sección no válida'); }
        var anio = /^[0-9]{4}$/.test(f.anio_lectivo) ? parseInt(f.anio_lectivo, 10) : NaN;
        var filaAnio = aniosPorNum[anio];
        if (isNaN(anio)) { f.errores.push('Año lectivo no válido'); }
        else if (!filaAnio) { f.errores.push('El año ' + anio + ' no existe; créelo en Años lectivos'); }
        // Cédula: obligatoria si el estudiante aún no tiene acceso; opcional si ya lo tiene (si viene, cambia su contraseña).
        var yaTieneCuenta = !!(porCodigo[cod] && porCodigo[cod].usuario_id);
        var ced = normCedula(f.cedula);
        if (!ced && !yaTieneCuenta) { f.errores.push('Falta la cédula'); }
        else if (ced && ced.length < MIN_CEDULA) { f.errores.push('Cédula demasiado corta (mínimo ' + MIN_CEDULA + ' letras o números)'); }
        else if (ced) {
          if (cedulasArchivo[ced] && cedulasArchivo[ced] !== cod) { f.errores.push('La cédula está repetida en otro código del archivo'); }
          cedulasArchivo[ced] = cod;
        }
        // Sexo: obligatorio si el estudiante es nuevo o aún no lo tiene registrado.
        var sx = normSexo(f.sexo);
        if (sx === null) { f.errores.push('Sexo no válido (escriba Femenino o Masculino)'); }
        else if (sx === '' && !(porCodigo[cod] && porCodigo[cod].sexo)) { f.errores.push('Falta el sexo (Femenino o Masculino)'); }
        f.sexo = sx === null ? f.sexo : sx;
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
              && (!f.sexo || ex.sexo === f.sexo)
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
          el('td', { texto: (f.apellidos ? f.apellidos + ', ' + f.nombres : f.nombres) }),
          el('td', { texto: ocultarCedula(f.cedula) }),
          el('td', { texto: textoSexo(f.sexo) }),
          el('td', { texto: f.grado + f.seccion }),
          el('td', { texto: f.anio_lectivo }),
          el('td', { texto: f.errores.length ? f.errores.join('; ') : f.accion, clase: f.errores.length ? 'celda-error' : '' })
        ]);
      });
      contenedor.appendChild(textoTabla(['Fila', 'Código', 'Nombre', 'Cédula', 'Sexo', 'Grupo', 'Año', 'Resultado'], cuerpo, ''));
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
            COLUMNAS_BD.forEach(function (c) { o[c] = f[c]; });
            return o;
          });
          var conCedula = resultadoActual.filas.filter(function (f) { return normCedula(f.cedula); })
            .map(function (f) { return { codigo: f.codigo_estudiante, cedula: f.cedula }; });
          var r = await db.rpc('portal2027_importar_estudiantes', { p_filas: envio });
          if (r.error) { throw r.error; }
          var d = r.data;
          aviso.mostrar('Estudiantes importados. Creando accesos con cédula…', 'info');
          var acc;
          try { acc = await crearAccesosEnLotes(conCedula); }
          catch (errAcc) {
            vista.textContent = '';
            confirmar.hidden = true;
            entrada.value = '';
            resultadoActual = null;
            aviso.mostrar('Los estudiantes SÍ se importaron, pero NO se pudieron crear los accesos con cédula: ' + (errAcc.message || 'error')
              + ' Cuando la función esté lista, vuelva a subir el mismo Excel (no duplica) para crear los accesos.', 'error');
            await cargarBase();
            dibujarLista();
            confirmar.disabled = false;
            entrada.disabled = false;
            return;
          }
          vista.textContent = '';
          confirmar.hidden = true;
          entrada.value = '';
          resultadoActual = null;
          aviso.mostrar('Importación guardada. Estudiantes nuevos: ' + d.estudiantes_nuevos + ', actualizados: ' + d.estudiantes_actualizados
            + '. Matrículas nuevas: ' + d.matriculas_nuevas + ', actualizadas: ' + d.matriculas_actualizadas
            + '. Grupos creados: ' + d.grupos_creados + '. Accesos con cédula creados: ' + acc.creados + ', actualizados: ' + acc.actualizados
            + (acc.errores.length ? ', con problema: ' + acc.errores.length + ' (' + acc.errores.slice(0, 5).map(function (x) { return x.codigo + ': ' + x.detalle; }).join('; ')
              + (acc.errores.length > 5 ? '; …' : '') + '). Corríjalos y súbalos en «Accesos de estudiantes con cédula».' : '.'),
            acc.errores.length ? 'error' : 'ok');
          await cargarBase();
          dibujarLista();
        } catch (e) {
          var m = (e && e.message) || '';
          aviso.mostrar(/^Fila \d+/.test(m) || /^(No hay filas|Máximo)/.test(m) ? 'No se importó nada. ' + m : 'No se importó nada. ' + P.traducirError(e), 'error');
        }
        confirmar.disabled = false;
        entrada.disabled = false;
      });

      /* ----- plantilla incrustada: ejemplo en pantalla y Excel generado en el navegador ----- */
      var EJEMPLO = [
        ['E0001', 'Pérez Gómez, Ana María', '8-123-456', 'Femenino', '9', 'C', '2027', 'ana.perez.prueba@example.com', 'Carmen Gómez', '6000-0001 / 6500-0002', 'activo'],
        ['E0002', 'Rodríguez Díaz, Luis Carlos', '4-567-890', 'Masculino', '9', 'C', '2027', 'luis.rodriguez.prueba@example.com', 'Jorge Rodríguez', '6000-0002; 6500-0003 (trabajo)', ''],
        ['E0003', 'Castillo Ruiz, María José', 'E-8-123456', 'Femenino', '10', 'A', '2027', '', 'Rosa Ruiz', '6000-0003', 'activo'],
        ['E0004', 'Santos Vega, Pedro', 'PE-12-345', 'Masculino', '7', 'B', '2027', '', '', '', '']
      ];
      var AYUDA_COLUMNAS = [
        ['Columna', '¿Obligatoria?', 'Qué escribir', 'Ejemplo'],
        ['codigo_estudiante', 'Sí', 'Código único del estudiante. No se repite. Es la llave para reimportar: no lo cambie después.', 'E0001'],
        ['nombres', 'Sí', 'Nombre completo del estudiante en una sola celda. Se recomienda «Apellidos, Nombres» (con coma o punto y coma) para que el portal separe el apellido y ordene bien las listas. Sin coma, todo se guarda como nombre.', 'Pérez Gómez, Ana María'],
        ['cedula', 'Sí', 'Cédula del estudiante. Es su contraseña de entrada al portal; puede llevar guiones. No se repite. Mínimo 6 letras o números. Dé a la columna formato «Texto». Si el estudiante ya tiene acceso, puede dejarla vacía.', '8-123-456'],
        ['sexo', 'Sí', 'Escriba Femenino o Masculino (también vale F o M). Si el estudiante ya tiene el sexo registrado, puede dejarla vacía.', 'Femenino'],
        ['grado', 'Sí', 'Solo el número del grado (uno o dos dígitos).', '9'],
        ['seccion', 'Sí', 'Solo la letra de la sección. Grado 9 + sección C = grupo 9C.', 'C'],
        ['anio_lectivo', 'Sí', 'Año con cuatro cifras. Debe existir en Años lectivos.', '2027'],
        ['correo_estudiante', 'No', 'Correo propio del estudiante, para invitarlo. No puede repetirse.', 'ana@example.com'],
        ['nombre_acudiente', 'No', 'Nombre del acudiente.', 'Carmen Gómez'],
        ['telefono_acudiente', 'No', 'Uno o varios teléfonos en la misma celda, separados por « / » o «; ».', '6000-0001 / 6500-0002'],
        ['estado', 'No', 'Estado de la matrícula. Vacío = activo.', 'activo']
      ];

      function tablaSimple(cabecera, filas) {
        return el('div', { clase: 'tabla-scroll', style: 'overflow-x:auto' }, [el('table', null, [
          el('thead', null, [el('tr', null, cabecera.map(function (c) { return el('th', { texto: c }); }))]),
          el('tbody', null, filas.map(function (f) { return el('tr', null, f.map(function (v) { return el('td', { texto: v }); })); }))
        ])]);
      }

      var botonPlantilla = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Descargar plantilla de Excel' });
      botonPlantilla.addEventListener('click', function () {
        if (!window.XLSX) { aviso.mostrar('No se cargó la biblioteca de Excel. Recargue la página e intente de nuevo.', 'error'); return; }
        var libro = XLSX.utils.book_new();
        var hojaImportar = XLSX.utils.aoa_to_sheet([COLUMNAS].concat(EJEMPLO));
        hojaImportar['!cols'] = [18, 34, 16, 12, 8, 10, 13, 34, 22, 32, 10].map(function (w) { return { wch: w }; });
        // Columna cedula como texto, para que Excel no quite guiones ni ceros.
        var colCed = COLUMNAS.indexOf('cedula');
        for (var rr = 1; rr <= 300; rr++) {
          var dir = XLSX.utils.encode_cell({ r: rr, c: colCed });
          if (!hojaImportar[dir]) { hojaImportar[dir] = { t: 's', v: '' }; }
          hojaImportar[dir].t = 's'; hojaImportar[dir].z = '@';
        }
        hojaImportar['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 300, c: COLUMNAS.length - 1 } });
        XLSX.utils.book_append_sheet(libro, hojaImportar, 'Importar');
        var hojaAyuda = XLSX.utils.aoa_to_sheet([
          ['Cómo llenar la hoja «Importar»'],
          ['Las 4 filas de ejemplo son ficticias: bórrelas y escriba sus estudiantes, una fila por estudiante.'],
          ['No cambie los nombres de la fila 1 ni el nombre de la hoja «Importar». Esta hoja puede quedarse en el archivo.'],
          ['El año debe existir antes en Administración → Años lectivos. Máximo 3000 filas por importación.'],
          []
        ].concat(AYUDA_COLUMNAS));
        hojaAyuda['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 80 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(libro, hojaAyuda, 'Instrucciones');
        XLSX.writeFile(libro, 'portal2027-plantilla-importar-estudiantes.xlsx');
      });

      zonaImport.appendChild(el('p', { clase: 'bloque-ayuda' }, [botonPlantilla, ' Llénela (borre las filas de ejemplo) y súbala aquí abajo.']));
      zonaImport.appendChild(el('details', null, [
        el('summary', { texto: 'Ver cómo llenar el Excel (ejemplo)' }),
        el('p', { clase: 'bloque-ayuda', texto: 'La hoja se llama «Importar»; la primera fila son estos nombres de columna, y cada estudiante va en una fila.' }),
        tablaSimple(COLUMNAS, EJEMPLO),
        el('p', { clase: 'bloque-ayuda', texto: 'Qué lleva cada columna:' }),
        tablaSimple(AYUDA_COLUMNAS[0], AYUDA_COLUMNAS.slice(1))
      ]));
      zonaImport.appendChild(el('label', null, ['Archivo Excel (.xlsx) con la hoja «Importar»', entrada]));
      zonaImport.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Plantilla versión 3 (nombre completo en una columna). Columnas: ' + COLUMNAS.join(', ') + '. La cédula es la contraseña del estudiante y el sexo es Femenino o Masculino. El correo y el estado son opcionales (sin estado se usa «activo»).' }));
      zonaImport.appendChild(vista);
      zonaImport.appendChild(confirmar);
    }


    /* ----- accesos con cédula (el estudiante entra con grado + nombre + cédula) ----- */
    function dibujarAccesos() {
      var zona = el('div', { clase: 'zona-importar' });
      zona.appendChild(el('h3', { texto: 'Accesos de estudiantes con cédula (solo para corregir o cambiar)' }));
      zona.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'La importación de arriba ya crea los accesos con la columna cedula. Use este bloque solo para corregir o cambiar cédulas: suba un Excel o CSV con dos columnas: codigo_estudiante y cedula (una fila por estudiante). '
        + 'El estudiante entrará eligiendo su grado, escribiendo su nombre y usando su cédula como contraseña. '
        + 'La cédula no se guarda como texto: solo queda cifrada como contraseña. Si vuelve a subir un código, se actualiza su contraseña. '
        + 'En Excel, dé a la columna cedula formato «Texto» para que no se pierdan guiones ni ceros.' }));
      var aviso2 = crearAviso();
      var entrada = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', 'aria-label': 'Archivo con códigos y cédulas' });
      var resumen = el('div');
      zona.appendChild(el('label', null, ['Archivo (.xlsx o .csv)', entrada]));
      zona.appendChild(aviso2);
      zona.appendChild(resumen);

      function leer(buffer) {
        if (!window.XLSX) { throw new Error('No se pudo cargar la biblioteca para leer Excel. Revise su internet y recargue.'); }
        var libro = window.XLSX.read(buffer, { type: 'array', raw: true });
        var hoja = libro.SheetNames.filter(function (n) { return n.trim().toLowerCase() === 'accesos'; })[0] || libro.SheetNames[0];
        var matriz = window.XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, raw: false, defval: '', blankrows: false });
        if (matriz.length < 2) { throw new Error('El archivo no tiene filas con datos.'); }
        var cab = matriz[0].map(function (c) { return norm(c).replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, '_'); });
        var iCod = cab.indexOf('codigo_estudiante'), iCed = cab.indexOf('cedula');
        if (iCod === -1 || iCed === -1) { throw new Error('Faltan las columnas codigo_estudiante y cedula en la primera fila.'); }
        var filas = [];
        for (var i = 1; i < matriz.length; i++) {
          var cod = norm(matriz[i][iCod]), ced = norm(matriz[i][iCed]);
          if (cod || ced) { filas.push({ codigo: cod, cedula: ced }); }
        }
        return filas;
      }

      entrada.addEventListener('change', async function () {
        resumen.textContent = '';
        aviso2.mostrar('', 'info');
        var archivo = entrada.files && entrada.files[0];
        if (!archivo) { return; }
        try {
          var filas = leer(await archivo.arrayBuffer());
          if (!window.confirm('¿Crear o actualizar el acceso de ' + filas.length + ' estudiantes?')) { entrada.value = ''; return; }
          entrada.disabled = true;
          var rr = await crearAccesosEnLotes(filas, function (n, t) { aviso2.mostrar('Procesando ' + n + ' de ' + t + '…', 'info'); });
          var creados = rr.creados, actualizados = rr.actualizados, errores = rr.errores;
          entrada.value = '';
          aviso2.mostrar('Listo. Accesos creados: ' + creados + ', actualizados: ' + actualizados + ', con error: ' + errores.length + '.', errores.length ? 'error' : 'ok');
          if (errores.length) {
            resumen.appendChild(textoTabla(['Código', 'Problema'], errores.map(function (x) {
              return el('tr', null, [el('td', { texto: x.codigo || '(vacío)' }), el('td', { texto: x.detalle || '' })]);
            }), ''));
          }
          await cargarBase();
          dibujarLista();
        } catch (e) {
          aviso2.mostrar(e.message || P.traducirError(e), 'error');
        }
        entrada.disabled = false;
      });
      return zona;
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
            .select('estado, salon:portal2027_salones(nombre), estudiante:portal2027_estudiantes(id,codigo,nombres,apellidos,sexo,correo_estudiante,usuario_id,invitado_en,foto_ruta)')
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
            el('td', { texto: e.codigo }), el('td', { texto: nombreEst(e) }), el('td', { texto: textoSexo(e.sexo) }),
            el('td', { texto: m.salon ? m.salon.nombre : '' }), el('td', { texto: m.estado }),
            el('td', { texto: e.correo_estudiante || '' }), el('td', { texto: cuenta + (e.foto_ruta ? ' · con foto' : '') }),
            el('td', null, [el('div', { clase: 'cabecera-acciones' }, [ver, invitar])])
          ]);
        });
        cuerpo.appendChild(textoTabla(['Código', 'Nombre', 'Sexo', 'Grupo', 'Estado', 'Correo', 'Cuenta', ''], filas,
          anios.length ? 'No hay estudiantes matriculados en este año.' : 'Primero cree un año lectivo.'));
        if (lista.length > 200) { cuerpo.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Se muestran 200 de ' + lista.length + '. Use el buscador.' })); }
      }
      pintar();
    }

    await cargarBase();
    dibujarImportacion();
    zonaAccesos.appendChild(dibujarAccesos());
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
