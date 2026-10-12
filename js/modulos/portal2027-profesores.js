/* portal2027-profesores.js — Administración: importar profesores desde Excel (nombre, materia, teléfono).
   Crea la cuenta, el perfil con teléfono, el rol profesor, las materias que falten y, si la hoja trae grupos,
   las asignaciones del año activo. El trabajo con cuentas lo hace la función de servidor portal2027-importar-profesores. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  var COLUMNAS = ['nombre_completo', 'materia', 'telefono', 'correo', 'grupos', 'consejeria', 'contrasena'];
  var OBLIGATORIAS = ['nombre_completo', 'materia', 'telefono'];
  var MAX_FILAS = 300;
  var LOTE = 100;
  var RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

  function norm(t) { return String(t === null || t === undefined ? '' : t).trim(); }

  function arreglarMayusculas(t) {
    if (!t || t !== t.toUpperCase()) { return t; }
    return t.toLowerCase().replace(/(^|[\s'-])([a-záéíóúüñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\s(De|Del|La|Las|Los|Y)(?=\s)/g, function (m) { return m.toLowerCase(); });
  }

  // «Pérez Gómez, Ana María» → apellidos antes de la coma, nombres después. Sin coma: todo queda como nombre.
  function partirNombre(texto) {
    var t = norm(texto).replace(/\s+/g, ' ');
    var i = t.search(/[;,]/);
    if (i === -1) { return { nombres: arreglarMayusculas(t), apellidos: '' }; }
    var ape = norm(t.slice(0, i)).replace(/\s+/g, ' ');
    var nom = norm(t.slice(i + 1).replace(/[;,]/g, ' ')).replace(/\s+/g, ' ');
    if (!nom) { return { nombres: arreglarMayusculas(ape), apellidos: '' }; }
    return { nombres: arreglarMayusculas(nom), apellidos: arreglarMayusculas(ape) };
  }

  function sinTildes(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function lista(t, separador) { return norm(t).split(separador).map(norm).filter(Boolean); }

  function crearAviso() {
    var n = el('p', { clase: 'mensaje', role: 'status', hidden: true });
    n.mostrar = function (texto, tipo) { n.textContent = texto || ''; n.className = 'mensaje ' + (tipo || 'info'); n.hidden = !texto; };
    return n;
  }

  function tablaSimple(cabecera, filas) {
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cabecera.map(function (c) { return el('th', { scope: 'col', texto: c }); }))]),
      el('tbody', null, filas.map(function (f) {
        return el('tr', null, f.map(function (v, i) {
          return el('td', { texto: v && v.texto !== undefined ? v.texto : String(v), clase: v && v.error ? 'celda-error' : '' });
        }));
      }))
    ])]);
  }

  var EJEMPLO = [
    ['Pérez Gómez, Ana María', 'Ciencias Naturales', '6000-0001', 'ana.perez.prueba@example.com', '9A; 9B', '9A', ''],
    ['Rodríguez Díaz, Luis Carlos', 'Matemática; Física', '6500-0002', '', '8A', '', ''],
    ['Castillo Ruiz, María José', 'Español', '6700-0003', '', '', 'Sí', '']
  ];
  var AYUDA = [
    ['Columna', '¿Obligatoria?', 'Qué escribir', 'Ejemplo'],
    ['nombre_completo', 'Sí', 'Nombre completo en una sola celda. Se recomienda «Apellidos, Nombres» (con coma) para que las listas salgan ordenadas.', 'Pérez Gómez, Ana María'],
    ['materia', 'Sí', 'La materia que da. Si da varias, sepárelas con «;». Las que no existan se crean solas.', 'Matemática; Física'],
    ['telefono', 'Sí', 'Teléfono del profesor. Si no escribe contraseña, sus dígitos serán la contraseña inicial (mínimo 6 cifras). Dé a la columna formato «Texto».', '6000-0001'],
    ['correo', 'No', 'Correo con el que entrará. Si queda vacío, el portal crea uno interno (nombre.apellido@docentes.portal2027.app) y se lo muestra al terminar.', 'ana@example.com'],
    ['grupos', 'No', 'Grupos del año activo donde da esa(s) materia(s), separados por «;». Crea las asignaciones. Vacío = solo registra al profesor.', '9A; 9B'],
    ['consejeria', 'No', 'Si es consejero(a): escriba el grupo que aconseja (9A) o varios con «;». «Sí» = solo le da el rol consejero, sin grupo. Vacío = no es consejero.', '9A'],
    ['contrasena', 'No', 'Contraseña inicial propia (mínimo 6 caracteres). Vacío = el teléfono.', '']
  ];

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
    if (faltan.length) { throw new Error('Faltan columnas en la hoja: ' + faltan.join(', ') + '. Descargue la plantilla de profesores.'); }
    var filas = [];
    for (var i = 1; i < matriz.length; i++) {
      var o = { _fila: i + 1 };
      COLUMNAS.forEach(function (c) { var pos = cab.indexOf(c); o[c] = pos === -1 ? '' : norm(matriz[i][pos]); });
      if (COLUMNAS.every(function (c) { return o[c] === ''; })) { continue; }
      var par = partirNombre(o.nombre_completo);
      o.nombres = par.nombres; o.apellidos = par.apellidos;
      o.materias = lista(o.materia, /[;/]/);
      o.listaGrupos = lista(o.grupos, /[;,/\s]+/).map(function (g) { return g.toUpperCase(); });
      o.correo = o.correo.toLowerCase();
      // consejeria: vacío / No = no es consejero; «Sí» = rol consejero; grupos (9A; 9B) = consejero de esos grupos.
      var cj = o.consejeria.toLowerCase();
      o.esConsejero = cj !== '' && ['no', 'n'].indexOf(cj) === -1;
      o.listaConsejeria = o.esConsejero && ['si', 'sí', 's', 'x'].indexOf(cj) === -1 ? lista(o.consejeria, /[;,/\s]+/).map(function (g) { return g.toUpperCase(); }) : [];
      filas.push(o);
    }
    return filas;
  }

  function analizar(filas) {
    var correos = {};
    filas.forEach(function (f) {
      f.errores = [];
      if (!f.nombres) { f.errores.push('Falta el nombre'); }
      if (f.materias.length === 0) { f.errores.push('Falta la materia'); }
      var digitos = f.telefono.replace(/\D/g, '');
      if (!f.telefono) { f.errores.push('Falta el teléfono'); }
      else if (!f.contrasena && digitos.length < 6) { f.errores.push('Teléfono con menos de 6 cifras (úselo con una contraseña propia)'); }
      if (f.contrasena && f.contrasena.length < 6) { f.errores.push('La contraseña debe tener 6 o más caracteres'); }
      if (f.correo && !RE_CORREO.test(f.correo)) { f.errores.push('Correo no válido'); }
      var llave = f.correo || sinTildes(f.nombres + ' ' + f.apellidos).toLowerCase().replace(/[^a-z0-9]+/g, '.');
      if (correos[llave]) { f.errores.push('Profesor repetido (fila ' + correos[llave] + '): use una sola fila y separe las materias con «;»'); }
      else { correos[llave] = f._fila; }
      var malos = f.listaGrupos.filter(function (g) { return !/^[0-9]{1,2}[A-Z]{1,2}$/.test(g); });
      if (malos.length) { f.errores.push('Grupo no válido: ' + malos.join(', ') + ' (ej. 9A)'); }
      var malosC = f.listaConsejeria.filter(function (g) { return !/^[0-9]{1,2}[A-Z]{1,2}$/.test(g); });
      if (malosC.length) { f.errores.push('Consejería: escriba Sí o el grupo (ej. 9A), no «' + malosC.join(', ') + '»'); }
      if (f.listaGrupos.length && f.materias.length === 0) { f.errores.push('Hay grupos pero no materia'); }
    });
    return filas;
  }

  P.renderProfesoresAdmin = async function (zona) {
    var aviso = crearAviso();
    var entrada = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', 'aria-label': 'Excel de profesores' });
    var vista = el('div', { clase: 'vista-previa' });
    var confirmar = el('button', { clase: 'boton', type: 'button', texto: 'Confirmar importación', hidden: true });
    var recargar = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Recargar para ver los profesores', hidden: true });
    recargar.addEventListener('click', function () { window.location.reload(); });
    var actual = null;

    var botonPlantilla = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Descargar plantilla de Excel' });
    botonPlantilla.addEventListener('click', function () {
      if (!window.XLSX) { aviso.mostrar('No se cargó la biblioteca de Excel. Recargue la página.', 'error'); return; }
      var libro = XLSX.utils.book_new();
      var hoja = XLSX.utils.aoa_to_sheet([COLUMNAS].concat(EJEMPLO));
      hoja['!cols'] = [34, 28, 14, 34, 14, 14, 14].map(function (w) { return { wch: w }; });
      [COLUMNAS.indexOf('telefono'), COLUMNAS.indexOf('contrasena')].forEach(function (c) {
        for (var r = 1; r <= 300; r++) {
          var d = XLSX.utils.encode_cell({ r: r, c: c });
          if (!hoja[d]) { hoja[d] = { t: 's', v: '' }; }
          hoja[d].t = 's'; hoja[d].z = '@';
        }
      });
      hoja['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 300, c: COLUMNAS.length - 1 } });
      XLSX.utils.book_append_sheet(libro, hoja, 'Importar');
      var ayuda = XLSX.utils.aoa_to_sheet([
        ['Cómo llenar la hoja «Importar»'],
        ['Las 3 filas de ejemplo son ficticias: bórrelas y escriba sus profesores, una fila por profesor.'],
        ['No cambie los nombres de la fila 1 ni el nombre de la hoja «Importar».'],
        []
      ].concat(AYUDA));
      ayuda['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 90 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(libro, ayuda, 'Instrucciones');
      XLSX.writeFile(libro, 'portal2027-plantilla-profesores.xlsx');
    });

    function pintar() {
      vista.textContent = '';
      var filas = actual;
      var conError = filas.filter(function (f) { return f.errores.length; });
      vista.appendChild(el('p', { clase: 'mensaje ' + (conError.length ? 'error' : 'info'), texto: 'Filas leídas: ' + filas.length + ' · Con errores: ' + conError.length }));
      var orden = conError.concat(filas.filter(function (f) { return !f.errores.length; })).slice(0, 80);
      vista.appendChild(tablaSimple(['Fila', 'Profesor', 'Materia(s)', 'Teléfono', 'Grupos', 'Consejero', 'Resultado'], orden.map(function (f) {
        return [String(f._fila), f.apellidos ? f.apellidos + ', ' + f.nombres : f.nombres, f.materias.join('; '), f.telefono,
          f.listaGrupos.join(' '), f.esConsejero ? (f.listaConsejeria.join(' ') || 'Sí') : '', f.errores.length ? { texto: f.errores.join('; '), error: true } : 'Listo'];
      })));
    }

    entrada.addEventListener('change', async function () {
      vista.textContent = ''; confirmar.hidden = true; recargar.hidden = true; actual = null; aviso.mostrar('', 'info');
      var archivo = entrada.files && entrada.files[0];
      if (!archivo) { return; }
      try {
        aviso.mostrar('Leyendo archivo…', 'info');
        var filas = leerHoja(await archivo.arrayBuffer(), archivo.name);
        if (filas.length === 0) { throw new Error('La hoja «Importar» no tiene filas con datos.'); }
        if (filas.length > MAX_FILAS) { throw new Error('El archivo tiene más de ' + MAX_FILAS + ' filas. Divídalo en partes.'); }
        actual = analizar(filas);
        pintar();
        var hay = actual.some(function (f) { return f.errores.length; });
        confirmar.hidden = hay;
        aviso.mostrar(hay ? 'Corrija los errores en el Excel y vuelva a cargarlo. No se importó nada.' : 'Vista previa lista. Revise y confirme.', hay ? 'error' : 'info');
      } catch (e) { aviso.mostrar(e.message || P.traducirError(e), 'error'); }
    });

    confirmar.addEventListener('click', async function () {
      if (!actual || !window.confirm('¿Importar ' + actual.length + ' profesor(es)?')) { return; }
      confirmar.disabled = true; entrada.disabled = true;
      aviso.mostrar('Importando…', 'info');
      try {
        var todos = [];
        for (var d = 0; d < actual.length; d += LOTE) {
          var envio = actual.slice(d, d + LOTE).map(function (f) {
            return { nombres: f.nombres, apellidos: f.apellidos, telefono: f.telefono, correo: f.correo, clave: f.contrasena, materias: f.materias, grupos: f.listaGrupos, es_consejero: f.esConsejero, consejeria: f.listaConsejeria };
          });
          var r = await db.functions.invoke('portal2027-importar-profesores', { body: { profesores: envio } });
          if (r.error) {
            var det = '';
            try { det = (await r.error.context.json()).error; } catch (x) { /* sin detalle */ }
            if (!det && r.error.name === 'FunctionsFetchError') {
              det = 'no se pudo contactar la función «portal2027-importar-profesores». Revise en Supabase > Edge Functions que esté creada y con «Verify JWT» DESACTIVADO.';
            }
            throw new Error(det || r.error.message);
          }
          todos = todos.concat(r.data.resultados);
        }
        var malos = todos.filter(function (x) { return x.estado === 'error'; });
        var creados = todos.filter(function (x) { return x.estado === 'creado'; }).length;
        var actualizados = todos.filter(function (x) { return x.estado === 'actualizado'; }).length;
        vista.textContent = '';
        vista.appendChild(tablaSimple(['Profesor', 'Correo de entrada', 'Resultado', 'Detalle'], todos.map(function (x) {
          return [x.nombre, x.correo, x.estado === 'error' ? { texto: 'Con problema', error: true } : (x.estado === 'creado' ? 'Cuenta creada' : 'Actualizado'),
            x.detalle || (x.asignadas ? x.asignadas + ' asignación(es)' : '')];
        })));
        aviso.mostrar('Listo. Cuentas creadas: ' + creados + ', actualizadas: ' + actualizados + (malos.length ? ', con problema: ' + malos.length + ' (corrija esas filas y vuelva a subir el archivo; no duplica).' : '.'),
          malos.length ? 'error' : 'ok');
        confirmar.hidden = true; entrada.value = ''; actual = null; recargar.hidden = false;
      } catch (e) {
        aviso.mostrar('No se importó nada. ' + (e.message || P.traducirError(e)), 'error');
      }
      confirmar.disabled = false; entrada.disabled = false;
    });

    function paso(n, titulo, hijos) {
      return el('div', { clase: 'paso-importar' }, [
        el('h3', { texto: n + '. ' + titulo })
      ].concat(hijos));
    }

    zona.appendChild(el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Importar profesores desde Excel' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Cargue a todos los profesores de una vez: nombre, materia y teléfono (y, si quiere, grupos y consejería). Reimportar el mismo archivo no duplica: actualiza lo que cambió.' }),
      paso(1, 'Descargue la plantilla', [
        el('p', { clase: 'bloque-ayuda' }, ['Es un Excel con la hoja «Importar» y una hoja «Instrucciones». ']),
        el('div', { clase: 'cabecera-acciones' }, [botonPlantilla])
      ]),
      paso(2, 'Llénela así (una fila por profesor)', [
        el('p', { clase: 'bloque-ayuda', texto: 'Ejemplo. Las filas de ejemplo de la plantilla son ficticias: bórrelas y escriba las suyas. No cambie los nombres de la primera fila.' }),
        tablaSimple(COLUMNAS, EJEMPLO),
        el('details', null, [
          el('summary', { texto: 'Qué lleva cada columna' }),
          tablaSimple(AYUDA[0], AYUDA.slice(1))
        ])
      ]),
      paso(3, 'Súbala aquí y confirme', [
        aviso,
        el('label', null, ['Archivo Excel (.xlsx) con la hoja «Importar»', entrada]),
        vista, confirmar, recargar
      ])
    ]));
  };
})();
