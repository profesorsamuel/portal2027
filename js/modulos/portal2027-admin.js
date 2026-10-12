/* portal2027-admin.js — panel de administración: personas y roles, años, materias, grupos y asignaciones. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  var datos = {};
  var yo = null;
  var zona = null;
  var estado = null;
  var mostrarInactivos = false;

  function aviso(texto, tipo) {
    estado.textContent = texto;
    estado.className = 'mensaje estado-panel ' + (tipo || 'info');
    estado.hidden = !texto;
  }

  async function consultar(q) {
    var r = await q;
    if (r.error) { throw r.error; }
    return r.data;
  }

  async function cargar() {
    var r = await Promise.all([
      consultar(db.from('portal2027_perfiles').select('id,nombres,apellidos,correo,telefono,activo').order('apellidos').order('correo')),
      consultar(db.from('portal2027_roles_usuario').select('usuario_id,rol')),
      consultar(db.from('portal2027_anios').select('id,anio,activo,trimestres:portal2027_trimestres(numero)').order('anio', { ascending: false })),
      consultar(db.from('portal2027_salones').select('id,nombre,anio_id,anio:portal2027_anios(anio)').order('nombre')),
      consultar(db.from('portal2027_materias').select('id,nombre').order('nombre')),
      consultar(db.from('portal2027_asignaciones').select('id,salon_id,materia_id,profesor_id,salon:portal2027_salones(nombre,anio:portal2027_anios(anio)),materia:portal2027_materias(nombre),profesor:portal2027_perfiles(nombres,apellidos,correo)')),
      consultar(db.from('portal2027_consejeros_salon').select('salon_id,consejero_id'))
    ]);
    datos = { perfiles: r[0], roles: r[1], anios: r[2], salones: r[3], materias: r[4], asignaciones: r[5], consejerias: r[6] };
  }

  async function ejecutar(accion, textoOk) {
    try {
      await accion();
      await cargar();
      dibujar();
      aviso(textoOk, 'ok');
    } catch (e) {
      aviso(P.traducirError(e), 'error');
    }
  }

  function tabla(cabeceras, filas, vacio) {
    if (filas.length === 0) { return el('p', { clase: 'vacio-texto', texto: vacio }); }
    return el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, cabeceras.map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas)
    ])]);
  }

  function opciones(lista, valor, texto, vacio) {
    return [el('option', { value: '', texto: vacio })].concat(lista.map(function (x) {
      return el('option', { value: valor(x), texto: texto(x) });
    }));
  }

  function campo(etiqueta, control) { return el('label', null, [etiqueta, control]); }

  function tieneRol(id, rol) {
    return datos.roles.some(function (x) { return x.usuario_id === id && x.rol === rol; });
  }

  /* ---------- Personas y roles ---------- */
  function seccionPersonas() {
    var zonaAsignar = el('div', { clase: 'editor-docente', hidden: true });
    var verInactivos = el('input', { type: 'checkbox', checked: mostrarInactivos });
    verInactivos.addEventListener('change', function () { mostrarInactivos = verInactivos.checked; dibujar(); });
    var filas = datos.perfiles.filter(function (p) { return mostrarInactivos || p.activo !== false; }).map(function (p) {
      var nombreOriginal = ((p.nombres || '') + ' ' + (p.apellidos || '')).trim();
      var nombres = el('input', { type: 'text', value: nombreOriginal, style: 'min-width:240px', 'aria-label': 'Nombre completo de ' + P.nombreCompleto(p) });
      var guardar = el('button', {
        clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Guardar nombre',
        onclick: function () {
          ejecutar(async function () {
            var completo = nombres.value.trim();
            if (!completo) { throw new Error('Escriba el nombre completo.'); }
            var cambios = completo === nombreOriginal
              ? { nombres: p.nombres || '', apellidos: p.apellidos || '' }
              : { nombres: completo, apellidos: '' };
            var r = await db.from('portal2027_perfiles').update(cambios).eq('id', p.id);
            if (r.error) { throw r.error; }
          }, 'Nombre guardado.');
        }
      });

      var celdasRoles = P.ORDEN.map(function (rol) {
        var cb = el('input', { type: 'checkbox', checked: tieneRol(p.id, rol), 'aria-label': P.ROLES[rol].etiqueta + ' para ' + P.nombreCompleto(p) });
        cb.addEventListener('change', function () {
          var marcado = cb.checked;
          if (p.id === yo.sesion.user.id && rol === 'administrador' && !marcado) {
            cb.checked = true;
            aviso('No puede quitarse su propio rol de administración.', 'error');
            return;
          }
          ejecutar(async function () {
            var r = marcado
              ? await db.from('portal2027_roles_usuario').insert({ usuario_id: p.id, rol: rol })
              : await db.from('portal2027_roles_usuario').delete().eq('usuario_id', p.id).eq('rol', rol);
            if (r.error) { throw r.error; }
          }, 'Rol actualizado.').then(function () { /* el dibujo se rehace en ejecutar */ });
        });
        return el('label', { clase: 'rol-docente' }, [cb, P.ROLES[rol].etiqueta]);
      });

      var activo = el('input', { type: 'checkbox', checked: p.activo, 'aria-label': 'Cuenta activa de ' + P.nombreCompleto(p) });
      activo.addEventListener('change', function () {
        var marcado = activo.checked;
        if (p.id === yo.sesion.user.id && !marcado) {
          activo.checked = true;
          aviso('No puede desactivar su propia cuenta.', 'error');
          return;
        }
        ejecutar(async function () {
          var r = await db.from('portal2027_perfiles').update({ activo: marcado }).eq('id', p.id);
          if (r.error) { throw r.error; }
        }, marcado ? 'Cuenta activada.' : 'Cuenta desactivada.');
      });

      var accionesBaja = [];
      if (tieneRol(p.id, 'profesor') || tieneRol(p.id, 'consejero')) {
        var retirar = el('button', {
          clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button',
          texto: p.activo === false ? 'Profesor dado de baja' : 'Retirar profesor',
          disabled: p.activo === false || p.id === yo.sesion.user.id,
          onclick: async function () {
            if (p.id === yo.sesion.user.id || p.activo === false) { return; }
            if (!window.confirm('¿Dar de baja a ' + P.nombreCompleto(p) + '?\n\nNo podrá acceder al portal ni recibir nuevas asignaciones. Se conservan sus notas, grupos e historial. Puede reactivarlo marcando «Activa» en las cuentas dadas de baja.')) { return; }
            retirar.disabled = true;
            await ejecutar(async function () {
              var r = await db.from('portal2027_perfiles').update({ activo: false }).eq('id', p.id);
              if (r.error) { throw r.error; }
            }, 'Profesor dado de baja. Sus notas e historial se conservan.');
            retirar.disabled = p.activo === false;
          }
        });
        accionesBaja.push(retirar);
      }
      var fila = el('tr', null, [
        el('td', null, [nombres, guardar]),
        el('td', { clase: 'contacto-docente' }, [el('div', { texto: p.correo || 'Sin correo' }), el('small', { texto: p.telefono || 'Sin teléfono' })]),
        el('td', null, [resumenAsignaciones(p.id), el('button', {
          clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Asignar materias y salones',
          onclick: function () { abrirAsignacionesDocente(zonaAsignar, p); }
        })]),
        el('td', null, [el('details', { clase: 'roles-docente' }, [
          el('summary', { texto: 'Permisos de la cuenta' })
        ].concat(celdasRoles))]),
        el('td', null, [el('label', { clase: 'rol-docente' }, [activo, ' Activa'])].concat(accionesBaja))
      ]);
      fila.setAttribute('data-busqueda', (nombreOriginal + ' ' + (p.correo || '') + ' ' + (p.telefono || '') + ' ' + resumenAsignaciones(p.id).textContent).toLocaleLowerCase('es'));
      return fila;
    });

    var cab = ['Profesor', 'Contacto', 'Materias y salones', 'Permisos', 'Estado'];
    var buscar = el('input', { type: 'search', placeholder: 'Buscar profesor, materia o salón…', 'aria-label': 'Buscar profesor, materia o salón' });
    var contador = el('span', { clase: 'bloque-ayuda', texto: filas.length + ' cuenta(s)' });
    buscar.addEventListener('input', function () {
      var termino = buscar.value.trim().toLocaleLowerCase('es');
      var total = 0;
      filas.forEach(function (fila) {
        fila.hidden = (fila.getAttribute('data-busqueda') || '').indexOf(termino) === -1;
        if (!fila.hidden) { total++; }
      });
      contador.textContent = total + ' de ' + filas.length + ' cuenta(s)';
    });
    return el('section', { clase: 'bloque listado-profesores' }, [
      el('h2', { texto: 'Profesores y materias que imparten' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Consulte qué materias imparte cada profesor y qué salones atiende. Use «Asignar materias y salones» para agregar varias materias y grupos; abra «Permisos de la cuenta» para cambiar sus roles.' }),
      el('div', { clase: 'herramientas-profesores' }, [buscar, contador, el('label', { clase: 'bloque-ayuda' }, [verInactivos, ' Mostrar cuentas dadas de baja'])]),
      tabla(cab, filas, 'No hay cuentas activas. Marque «Mostrar cuentas dadas de baja» para verlas.'),
      zonaAsignar
    ]);
  }

  /* Cada materia conserva sus propios salones. Las asignaciones alimentan los paneles,
     libretas, asistencia, clases y tareas que ya consultan portal2027_asignaciones. */
  var GRUPOS_PREMEDIA = ['7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];

  function resumenAsignaciones(profesorId) {
    var activo = datos.anios.filter(function (a) { return a.activo; })[0];
    var asigs = datos.asignaciones.filter(function (a) {
      return a.profesor_id === profesorId && (!activo || (a.salon && a.salon.anio && a.salon.anio.anio === activo.anio));
    });
    var lista = {};
    asigs.forEach(function (a) {
      var nombre = a.materia ? a.materia.nombre : 'Materia';
      if (!lista[nombre]) { lista[nombre] = []; }
      if (a.salon && lista[nombre].indexOf(a.salon.nombre) === -1) { lista[nombre].push(a.salon.nombre); }
    });
    return el('div', { clase: 'resumen-asignaciones' }, [
      el('small', { texto: activo ? 'Año ' + activo.anio : 'Todos los años' })
    ].concat(Object.keys(lista).sort(function (a, b) { return a.localeCompare(b, 'es'); }).map(function (m) {
      return el('div', { texto: m + ': ' + lista[m].sort().join(', ') });
    })).concat(asigs.length ? [] : [el('div', { texto: 'Sin materias asignadas' })]));
  }

  function abrirAsignacionesDocente(zonaEditor, perfil) {
    zonaEditor.hidden = false;
    zonaEditor.replaceChildren();
    var activo = datos.anios.filter(function (a) { return a.activo; })[0];
    var selAnio = el('select', { 'aria-label': 'Año de las asignaciones' }, opciones(datos.anios, function (a) { return a.id; }, function (a) { return String(a.anio); }, 'Elija el año'));
    selAnio.value = activo ? activo.id : '';
    var cuerpo = el('div');
    var mensaje = el('p', { clase: 'mensaje info', role: 'status', hidden: true });
    var guardar = el('button', { clase: 'boton', type: 'button', texto: 'Guardar materias y salones' });
    var filas = [];
    var ocupada = false;
    var agregar = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Agregar otra materia' });
    var cerrar = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar' });

    function informar(t, error) {
      mensaje.textContent = t;
      mensaje.className = 'mensaje ' + (error ? 'error' : 'info');
      mensaje.hidden = false;
    }
    function salonesDelAnio() { return datos.salones.filter(function (s) { return s.anio_id === selAnio.value; }); }
    function existentes(materiaId) {
      var ids = salonesDelAnio().map(function (s) { return s.id; });
      return datos.asignaciones.filter(function (a) { return a.profesor_id === perfil.id && a.materia_id === materiaId && ids.indexOf(a.salon_id) !== -1; });
    }
    function agregarFila(materiaId) {
      var selector = el('select', { 'aria-label': 'Materia del docente' }, opciones(datos.materias, function (m) { return m.id; }, function (m) { return m.nombre; }, 'Elija una materia'));
      selector.value = materiaId || '';
      var checks = [];
      var rejilla = el('div', { clase: 'salones-docente' });
      var fila = el('div', { clase: 'fila-asignacion-docente' });
      var detalle = el('p', { clase: 'bloque-ayuda' });
      function dibujarChecks() {
        rejilla.replaceChildren();
        checks = [];
        var salones = salonesDelAnio();
        var nombres = GRUPOS_PREMEDIA.concat(salones.map(function (s) { return s.nombre; }).filter(function (n) { return GRUPOS_PREMEDIA.indexOf(n) === -1; }));
        var asigs = existentes(selector.value);
        nombres.forEach(function (nombre) {
          var salon = salones.filter(function (s) { return s.nombre === nombre; })[0];
          var ya = !!salon && asigs.some(function (a) { return a.salon_id === salon.id; });
          var cb = el('input', { type: 'checkbox', checked: ya, disabled: ya || !selAnio.value || !selector.value, 'aria-label': nombre + ' para ' + (selector.selectedOptions[0] ? selector.selectedOptions[0].textContent : 'materia') });
          checks.push({ nombre: nombre, control: cb, guardada: ya });
          rejilla.appendChild(el('label', { clase: 'opcion-salon' + (ya ? ' asignada' : '') }, [cb, nombre, el('small', { texto: ya ? 'Guardado' : salon ? '' : 'Se creará' })]));
        });
        detalle.textContent = asigs.length ? 'Los salones guardados se conservan. Puede agregar más salones a esta materia.' : 'Marque los salones donde impartirá esta materia.';
      }
      selector.addEventListener('change', dibujarChecks);
      var quitar = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Quitar esta fila', onclick: function () {
        if (ocupada) { return; }
        filas = filas.filter(function (f) { return f.elemento !== fila; });
        fila.remove();
      } });
      fila.appendChild(el('div', { clase: 'cabecera-acciones' }, [campo('Materia', selector), quitar]));
      fila.appendChild(rejilla);
      fila.appendChild(detalle);
      cuerpo.appendChild(fila);
      filas.push({ elemento: fila, selector: selector, seleccion: function () { return checks.filter(function (c) { return c.control.checked; }); } });
      dibujarChecks();
    }
    function cargarFilas() {
      cuerpo.replaceChildren();
      filas = [];
      mensaje.hidden = true;
      var ids = salonesDelAnio().map(function (s) { return s.id; });
      var materias = [];
      datos.asignaciones.forEach(function (a) {
        if (a.profesor_id === perfil.id && ids.indexOf(a.salon_id) !== -1 && materias.indexOf(a.materia_id) === -1) { materias.push(a.materia_id); }
      });
      materias.forEach(agregarFila);
      if (!materias.length) { agregarFila(); }
      agregar.disabled = !selAnio.value;
      guardar.disabled = !selAnio.value || perfil.activo === false;
      if (!datos.anios.length) { informar('Cree primero el año lectivo en «Años, grupos y materias».', true); }
      else if (perfil.activo === false) { informar('Active la cuenta del docente antes de guardar asignaciones.', true); }
    }
    selAnio.addEventListener('change', cargarFilas);
    agregar.addEventListener('click', function () { if (!ocupada) { agregarFila(); } });
    cerrar.addEventListener('click', function () { if (!ocupada) { zonaEditor.hidden = true; } });
    guardar.addEventListener('click', async function () {
      if (ocupada) { return; }
      if (!selAnio.value || perfil.activo === false) { informar('Seleccione un año y una cuenta activa.', true); return; }
      var pares = [];
      var claves = {};
      for (var i = 0; i < filas.length; i++) {
        var f = filas[i];
        var seleccion = f.seleccion();
        if (!f.selector.value) { informar('Elija una materia en cada fila o quite la fila vacía.', true); return; }
        if (!seleccion.length) { informar('Marque al menos un salón para cada materia.', true); return; }
        seleccion.forEach(function (c) {
          var k = f.selector.value + '|' + c.nombre;
          if (!c.guardada && !claves[k]) { claves[k] = true; pares.push({ materiaId: f.selector.value, nombre: c.nombre }); }
        });
      }
      if (!pares.length) { informar('No hay asignaciones nuevas. Las materias y salones guardados ya aparecen en el portal.'); return; }
      ocupada = true;
      selAnio.disabled = agregar.disabled = cerrar.disabled = guardar.disabled = true;
      cuerpo.querySelectorAll('select, button, input').forEach(function (n) { n.disabled = true; });
      informar('Guardando materias y salones…');
      try {
        var nombres = pares.map(function (p) { return p.nombre; }).filter(function (n, i, a) { return a.indexOf(n) === i; });
        var actuales = salonesDelAnio();
        var faltantes = nombres.filter(function (n) { return !actuales.some(function (s) { return s.nombre === n; }); });
        if (faltantes.length) {
          var rg = await db.from('portal2027_salones').upsert(faltantes.map(function (n) {
            var partes = /^(\d+)([A-Z]+)$/.exec(n);
            return { anio_id: selAnio.value, grado: partes[1], seccion: partes[2] };
          }), { onConflict: 'anio_id,grado,seccion', ignoreDuplicates: true });
          if (rg.error) { throw rg.error; }
        }
        var rs = await db.from('portal2027_salones').select('id,nombre').eq('anio_id', selAnio.value);
        if (rs.error) { throw rs.error; }
        var idDe = {};
        (rs.data || []).forEach(function (s) { idDe[s.nombre] = s.id; });
        if (nombres.some(function (n) { return !idDe[n]; })) { throw new Error('No se pudieron localizar todos los salones.'); }
        var rr = await db.from('portal2027_roles_usuario').upsert({ usuario_id: perfil.id, rol: 'profesor' }, { onConflict: 'usuario_id,rol', ignoreDuplicates: true });
        if (rr.error) { throw rr.error; }
        var ra = await db.from('portal2027_asignaciones').upsert(pares.map(function (p) {
          return { salon_id: idDe[p.nombre], materia_id: p.materiaId, profesor_id: perfil.id };
        }), { onConflict: 'salon_id,materia_id,profesor_id', ignoreDuplicates: true });
        if (ra.error) { throw ra.error; }
        await cargar();
        dibujar();
        aviso('Materias y salones guardados para ' + P.nombreCompleto(perfil) + '. Ya se usan en su panel, libreta, asistencia y clases.', 'ok');
      } catch (e) {
        informar(P.traducirError(e) + ' Puede volver a intentar guardar: no se duplicarán las asignaciones.', true);
        selAnio.disabled = agregar.disabled = cerrar.disabled = guardar.disabled = false;
        cuerpo.querySelectorAll('select, button').forEach(function (n) { n.disabled = false; });
        filas.forEach(function (f) { f.seleccion().forEach(function (c) { c.control.disabled = c.guardada; }); });
        // Restore unchecked choices too after a failed request.
        cuerpo.querySelectorAll('input[type="checkbox"]').forEach(function (n) { if (!n.closest('.asignada')) { n.disabled = false; } });
      } finally { ocupada = false; }
    });
    zonaEditor.appendChild(el('h3', { texto: 'Materias y salones de ' + P.nombreCompleto(perfil) }));
    zonaEditor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Agregue una fila por materia y marque sus salones. Ejemplo: Ciencias Naturales en 7A y 7B; Cívica en 9A y 9C. Los salones que falten se crean al guardar. La consejería se asigna por separado en «Profesores por grupo».' }));
    zonaEditor.appendChild(campo('Año lectivo', selAnio));
    zonaEditor.appendChild(cuerpo);
    zonaEditor.appendChild(el('div', { clase: 'cabecera-acciones' }, [agregar, guardar, cerrar]));
    zonaEditor.appendChild(mensaje);
    zonaEditor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Para quitar una asignación guardada, use «Profesores por grupo» en «Años, grupos y materias». Revise primero si tiene notas o tareas registradas.' }));
    cargarFilas();
    zonaEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Años y trimestres ---------- */
  function seccionAnios() {
    var filas = datos.anios.map(function (a) {
      var accion = a.activo
        ? el('span', { clase: 'etiqueta-activo', texto: 'Año activo' })
        : el('button', {
            clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Hacer activo',
            onclick: function () {
              ejecutar(async function () {
                var r1 = await db.from('portal2027_anios').update({ activo: false }).eq('activo', true);
                if (r1.error) { throw r1.error; }
                var r2 = await db.from('portal2027_anios').update({ activo: true }).eq('id', a.id);
                if (r2.error) { throw r2.error; }
              }, 'Año activo cambiado.');
            }
          });
      var nTrim = (a.trimestres || []).length;
      return el('tr', null, [el('td', { texto: String(a.anio) }), el('td', { texto: nTrim + ' trimestres' }), el('td', null, [accion])]);
    });

    var inAnio = el('input', { type: 'number', min: '2000', max: '2100', required: true, inputmode: 'numeric' });
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      campo('Nuevo año lectivo', inAnio),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Crear año' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var n = parseInt(inAnio.value, 10);
      if (!n || n < 2000 || n > 2100) { aviso('Escriba un año entre 2000 y 2100.', 'error'); return; }
      ejecutar(async function () {
        var r = await db.from('portal2027_anios').insert({ anio: n, activo: datos.anios.length === 0 });
        if (r.error) { throw r.error; }
      }, 'Año creado con sus tres trimestres.');
    });

    return el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Años lectivos' }),
      tabla(['Año', 'Trimestres', ''], filas, 'Todavía no hay años.'),
      form
    ]);
  }

  /* ---------- Materias ---------- */
  function seccionMaterias() {
    var filas = datos.materias.map(function (m) {
      var eliminar = el('button', {
        clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Eliminar',
        onclick: async function () {
          eliminar.disabled = true;
          try {
            // Una materia que ya está asignada a un profesor en algún grupo no se borra: primero se quita esa asignación.
            var asig = await db.from('portal2027_asignaciones').select('id', { count: 'exact', head: true }).eq('materia_id', m.id);
            if (asig.error) { throw asig.error; }
            if (asig.count > 0) {
              aviso('La materia «' + m.nombre + '» está asignada en ' + asig.count + ' grupo(s) con profesor, por eso no se puede eliminar. '
                + 'Quite primero esas asignaciones en «Profesores por grupo» y vuelva a intentarlo.', 'error');
              eliminar.disabled = false;
              return;
            }
            if (!window.confirm('¿Eliminar la materia «' + m.nombre + '»? Esta acción no se puede deshacer.')) { eliminar.disabled = false; return; }
          } catch (e) {
            aviso(P.traducirError(e), 'error');
            eliminar.disabled = false;
            return;
          }
          ejecutar(async function () {
            var r = await db.from('portal2027_materias').delete().eq('id', m.id);
            if (r.error) { throw r.error; }
          }, 'Materia eliminada.');
        }
      });
      return el('li', { clase: 'materia-compacta' }, [el('span', { texto: m.nombre }), eliminar]);
    });
    var inNombre = el('input', { type: 'text', required: true, maxlength: '80' });
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      campo('Nueva materia', inNombre),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Agregar materia' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nombre = inNombre.value.trim();
      if (!nombre) { aviso('Escriba el nombre de la materia.', 'error'); return; }
      ejecutar(async function () {
        var r = await db.from('portal2027_materias').insert({ nombre: nombre });
        if (r.error) { throw r.error; }
      }, 'Materia agregada.');
    });
    return el('section', { clase: 'bloque bloque-materias' }, [el('h2', { texto: 'Materias' }), filas.length ? el('ul', { clase: 'lista-materias-compacta', 'aria-label': 'Materias registradas' }, filas) : el('p', { clase: 'vacio-texto', texto: 'Todavía no hay materias.' }), form]);
  }

  /* ---------- Grupos ---------- */
  function seccionSalones() {
    var filas = datos.salones.map(function (s) {
      var eliminar = el('button', {
        clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Eliminar',
        onclick: async function () {
          var etiqueta = s.nombre + (s.anio ? ' (' + s.anio.anio + ')' : '');
          eliminar.disabled = true;
          try {
            // Un grupo con estudiantes matriculados no se puede borrar: primero hay que moverlos o eliminarlos.
            var m = await db.from('portal2027_matriculas').select('id', { count: 'exact', head: true }).eq('salon_id', s.id);
            if (m.error) { throw m.error; }
            if (m.count > 0) {
              aviso('El grupo ' + etiqueta + ' tiene ' + m.count + ' estudiante(s) matriculado(s), por eso no se puede eliminar. '
                + 'Cambie a esos estudiantes de grupo (reimporte el Excel con el grupo correcto) y vuelva a intentarlo.', 'error');
              eliminar.disabled = false;
              return;
            }
            // Las asignaciones (materia + profesor) del grupo se borran con él, junto con lo que cuelga de ellas.
            var asig = await db.from('portal2027_asignaciones').select('id', { count: 'exact', head: true }).eq('salon_id', s.id);
            if (asig.error) { throw asig.error; }
            var aviso2 = asig.count > 0
              ? '\n\nOJO: este grupo tiene ' + asig.count + ' asignación(es) de materia y profesor. También se borrarán, con sus notas, asistencia y tareas.' : '';
            if (!window.confirm('¿Eliminar el grupo ' + etiqueta + '? Esta acción no se puede deshacer.' + aviso2)) { eliminar.disabled = false; return; }
          } catch (e) {
            aviso(P.traducirError(e), 'error');
            eliminar.disabled = false;
            return;
          }
          ejecutar(async function () {
            var r = await db.from('portal2027_salones').delete().eq('id', s.id);
            if (r.error) { throw r.error; }
          }, 'Grupo eliminado.');
        }
      });
      return el('tr', null, [
        el('td', { texto: s.nombre }), el('td', { texto: s.anio ? String(s.anio.anio) : '' }),
        el('td', null, [el('div', { clase: 'cabecera-acciones' }, [eliminar])])
      ]);
    });
    var selAnio = el('select', { required: true }, opciones(datos.anios, function (a) { return a.id; }, function (a) { return String(a.anio); }, 'Elija el año'));
    var inGrado = el('input', { type: 'text', required: true, maxlength: '2', inputmode: 'numeric', placeholder: '9' });
    var inSeccion = el('input', { type: 'text', required: true, maxlength: '2', placeholder: 'C' });
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      campo('Año', selAnio), campo('Grado', inGrado), campo('Sección', inSeccion),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Crear grupo' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var grado = inGrado.value.trim();
      var seccion = inSeccion.value.trim().toUpperCase();
      if (!selAnio.value) { aviso('Elija el año del grupo.', 'error'); return; }
      if (!/^[0-9]{1,2}$/.test(grado)) { aviso('El grado debe ser un número (por ejemplo 9).', 'error'); return; }
      if (!/^[A-Z]{1,2}$/.test(seccion)) { aviso('La sección debe ser una o dos letras (por ejemplo C).', 'error'); return; }
      ejecutar(async function () {
        var r = await db.from('portal2027_salones').insert({ anio_id: selAnio.value, grado: grado, seccion: seccion });
        if (r.error) { throw r.error; }
      }, 'Grupo creado.');
    });
    return el('section', { clase: 'bloque' }, [el('h2', { texto: 'Grupos' }), tabla(['Grupo', 'Año', ''], filas, 'Todavía no hay grupos.'), form]);
  }

  /* ---------- Profesores por grupo: materias y consejería en un solo lugar ---------- */
  function etiquetaSalon(s) { return s ? s.nombre + (s.anio ? ' (' + s.anio.anio + ')' : '') : ''; }

  /* Directorio de docentes (js/datos/portal2027-docentes-2026.js): sirve para sugerir materia y grupo al elegir al profesor. */
  var ROMANOS = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9' };
  function sinTildes(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function palabras(t) {
    return sinTildes(t).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter(function (w) { return w && ['de', 'del', 'la', 'las', 'los'].indexOf(w) === -1; });
  }
  // Busca al docente en el directorio: todas las palabras de su nombre deben estar en el nombre de la cuenta.
  function docenteDe(perfil) {
    var lista = P.docentes2026 || [];
    var mias = palabras(P.nombreCompleto(perfil));
    for (var i = 0; i < lista.length; i++) {
      var w = palabras(lista[i].nombre);
      if (w.length >= 2 && w.every(function (x) { return mias.indexOf(x) !== -1; })) { return lista[i]; }
    }
    return null;
  }
  function materiasDe(d) {
    return d && d.asignatura ? d.asignatura.split(/[\/\u2013;,]/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
  }
  // «VII-C» -> «7C». Si no tiene esa forma (primaria), devuelve ''.
  function grupoLocal(g) {
    var m = /^([IVX]+)-([A-Z])$/.exec(String(g || '').trim().toUpperCase());
    return m && ROMANOS[m[1]] ? ROMANOS[m[1]] + m[2] : '';
  }

  function seccionAsignaciones() {
    // Se ofrecen todas las cuentas activas que no sean solo de estudiante; al asignar se les da el rol Profesor si no lo tienen.
    var profesores = datos.perfiles.filter(function (p) {
      return p.activo !== false && (tieneRol(p.id, 'profesor') || !tieneRol(p.id, 'estudiante'));
    }).sort(function (a, b) { return P.nombreCompleto(a).localeCompare(P.nombreCompleto(b), 'es'); });
    var perfilDe = {};
    datos.perfiles.forEach(function (p) { perfilDe[p.id] = p; });
    var salonDe = {};
    datos.salones.forEach(function (s) { salonDe[s.id] = s; });

    // Una fila por grupo y profesor, con sus materias y si es consejero de ese grupo.
    var filasMapa = {};
    function fila(salonId, profId) {
      var k = salonId + '|' + profId;
      if (!filasMapa[k]) { filasMapa[k] = { salonId: salonId, profId: profId, asigs: [], consejero: false }; }
      return filasMapa[k];
    }
    datos.asignaciones.forEach(function (a) { fila(a.salon_id, a.profesor_id).asigs.push(a); });
    datos.consejerias.forEach(function (c) { fila(c.salon_id, c.consejero_id).consejero = true; });
    var lista = Object.keys(filasMapa).map(function (k) { return filasMapa[k]; });
    lista.sort(function (x, y) {
      var gx = etiquetaSalon(salonDe[x.salonId]), gy = etiquetaSalon(salonDe[y.salonId]);
      return gx.localeCompare(gy, 'es') || P.nombreCompleto(perfilDe[x.profId]).localeCompare(P.nombreCompleto(perfilDe[y.profId]), 'es');
    });

    var filas = lista.map(function (f) {
      var materias = f.asigs.map(function (a) {
        var quitar = el('button', {
          clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Quitar',
          onclick: function () {
            if (!window.confirm('¿Quitar la materia «' + (a.materia ? a.materia.nombre : '') + '» de este profesor en este grupo?')) { return; }
            ejecutar(async function () {
              var r = await db.from('portal2027_asignaciones').delete().eq('id', a.id);
              if (r.error) { throw r.error; }
            }, 'Materia quitada.');
          }
        });
        var enlace = function (pagina, texto) {
          return el('a', { clase: 'boton boton-secundario boton-chico', href: P.raiz + 'pages/' + pagina + '?asignacion=' + encodeURIComponent(a.id), texto: texto });
        };
        return el('div', { clase: 'cabecera-acciones' }, [
          el('strong', { texto: a.materia ? a.materia.nombre : '' }),
          enlace('portal2027-libreta.html', 'Libreta'), enlace('portal2027-asistencia.html', 'Asistencia'),
          enlace('portal2027-clases.html', 'Clases y tareas'), quitar
        ]);
      });
      if (materias.length === 0) { materias = [el('span', { clase: 'bloque-ayuda', texto: 'Sin materia (solo consejería)' })]; }

      var celdaCons = f.consejero
        ? el('div', { clase: 'cabecera-acciones' }, [el('strong', { texto: 'Sí' }), el('button', {
            clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Quitar consejería',
            onclick: function () {
              if (!window.confirm('¿Quitar a este profesor como consejero de este grupo?')) { return; }
              ejecutar(async function () {
                var r = await db.from('portal2027_consejeros_salon').delete().eq('salon_id', f.salonId).eq('consejero_id', f.profId);
                if (r.error) { throw r.error; }
              }, 'Consejería quitada.');
            }
          })])
        : el('div', { clase: 'cabecera-acciones' }, [el('span', { texto: 'No' }), el('button', {
            clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Hacer consejero',
            onclick: function () { ejecutar(function () { return hacerConsejero(f.salonId, f.profId); }, 'Consejería asignada.'); }
          })]);

      return el('tr', null, [
        el('td', { texto: etiquetaSalon(salonDe[f.salonId]) }),
        el('td', { texto: P.nombreCompleto(perfilDe[f.profId]) }),
        el('td', { texto: (perfilDe[f.profId] && perfilDe[f.profId].telefono) || '—' }),
        el('td', null, materias),
        el('td', null, [celdaCons])
      ]);
    });

    var selProfesor = el('select', { required: true, 'aria-label': 'Profesor para asignar materias y salones' }, opciones(profesores, function (p) { return p.id; }, function (p) {
      return P.nombreCompleto(p);
    }, 'Elija el profesor'));
    var editor = el('div', { clase: 'editor-docente', hidden: true });
    var grupoConsejeria = el('select', { required: true, 'aria-label': 'Grupo de consejería' }, opciones(datos.salones, function (s) { return s.id; }, etiquetaSalon, 'Elija el grupo de consejería'));
    selProfesor.addEventListener('change', function () {
      grupoConsejeria.value = '';
      var perfil = perfilDe[selProfesor.value];
      if (perfil) { abrirAsignacionesDocente(editor, perfil); }
      else { editor.hidden = true; editor.replaceChildren(); }
    });
    var formConsejeria = el('form', { clase: 'formulario-fila', novalidate: true }, [
      campo('Grupo de consejería', grupoConsejeria),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Asignar consejería' })
    ]);
    formConsejeria.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!selProfesor.value || !grupoConsejeria.value) { aviso('Elija el profesor y el grupo de consejería.', 'error'); return; }
      var perfil = perfilDe[selProfesor.value];
      if (!perfil || perfil.activo === false) { aviso('Elija un docente con cuenta activa.', 'error'); return; }
      var profId = selProfesor.value;
      var salonId = grupoConsejeria.value;
      ejecutar(function () { return hacerConsejero(salonId, profId); }, 'Consejería asignada.');
    });
    var consejeria = el('details', { clase: 'consejeria-opcional' }, [
      el('summary', { texto: 'Asignar consejería (opcional)' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Elija arriba al docente. La consejería se asigna aparte de los salones donde imparte clases.' }),
      formConsejeria
    ]);

    var hijos = [
      el('h2', { texto: 'Profesores por grupo' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Elija al profesor, agregue sus materias y marque los salones de cada una. Puede atender varios grupos y dar materias diferentes en cada grupo.' }),
      tabla(['Grupo', 'Profesor', 'Teléfono', 'Materias', 'Consejero'], filas, 'Todavía no hay profesores asignados a grupos.')
    ];
    if (profesores.length === 0) {
      hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'No hay cuentas para asignar. Cree las cuentas de los profesores en «Profesores y materias que imparten» o importe la lista de profesores desde Excel.' }));
    }
    hijos.push(el('div', { clase: 'formulario-fila' }, [campo('Profesor', selProfesor)]));
    hijos.push(editor);
    hijos.push(consejeria);
    return el('section', { clase: 'bloque' }, hijos);
  }

  // Da el rol consejero al profesor si aún no lo tiene y lo pone como consejero del grupo (sin duplicar).
  async function hacerConsejero(salonId, profId) {
    if (!tieneRol(profId, 'consejero')) {
      var rr = await db.from('portal2027_roles_usuario').insert({ usuario_id: profId, rol: 'consejero' });
      if (rr.error) { throw rr.error; }
    }
    var ya = datos.consejerias.some(function (c) { return c.salon_id === salonId && c.consejero_id === profId; });
    if (!ya) {
      var r = await db.from('portal2027_consejeros_salon').insert({ salon_id: salonId, consejero_id: profId });
      if (r.error) { throw r.error; }
    }
  }

  function dibujar() {
    var previo = zona.querySelector('.secciones-admin');
    if (previo) { previo.remove(); }
    var cont = el('div', { clase: 'secciones secciones-admin' }, [
      seccionPersonas(), seccionAnios(), seccionSalones(), seccionMaterias(), seccionAsignaciones()
    ]);
    zona.appendChild(cont);
  }

  P.renderAdmin = async function (contenedor, info) {
    zona = contenedor;
    yo = info;
    estado = el('p', { clase: 'mensaje estado-panel', role: 'status', hidden: true });
    zona.appendChild(estado);
    await cargar();
    dibujar();
  };
})();
