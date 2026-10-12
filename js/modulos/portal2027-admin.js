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
    var filas = datos.perfiles.map(function (p) {
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
        return el('td', { clase: 'centro' }, [cb]);
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

      return el('tr', null, [
        el('td', { texto: p.correo || '' }),
        el('td', null, [nombres]),
        el('td', { texto: p.telefono || '—' }),
        el('td', null, [guardar]),
        el('td', null, [resumenAsignaciones(p.id), el('button', {
          clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Materias y salones',
          onclick: function () { abrirAsignacionesDocente(zonaAsignar, p); }
        })])
      ].concat(celdasRoles).concat([el('td', { clase: 'centro' }, [activo])]));
    });

    var cab = ['Correo', 'Nombre completo', 'Teléfono', '', 'Materias y salones'].concat(P.ORDEN.map(function (r) { return P.ROLES[r].etiqueta; })).concat(['Activa']);
    return el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Personas y roles' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Las cuentas nuevas se crean en Supabase (Authentication → Users). Aparecen aquí sin roles; marque los roles que correspondan.' }),
      tabla(cab, filas, 'Todavía no hay cuentas.'),
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
      return el('tr', null, [el('td', { texto: m.nombre }), el('td', null, [el('div', { clase: 'cabecera-acciones' }, [eliminar])])]);
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
    return el('section', { clase: 'bloque' }, [el('h2', { texto: 'Materias' }), tabla(['Materia', ''], filas, 'Todavía no hay materias.'), form]);
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

    var selSalon = el('select', { required: true }, opciones(datos.salones, function (s) { return s.id; }, etiquetaSalon, 'Elija el grupo'));
    var selProfesor = el('select', { required: true }, opciones(profesores, function (p) { return p.id; }, function (p) {
      var mats = materiasDe(docenteDe(p)).join(' / ');
      return P.nombreCompleto(p) + (mats ? ' · ' + mats : '') + (p.telefono ? ' · ' + p.telefono : '');
    }, 'Elija el profesor'));
    var selMateria = el('select', null, opciones(datos.materias, function (m) { return m.id; }, function (m) { return m.nombre; }, 'Sin materia (solo consejería)'));
    var cbCons = el('input', { type: 'checkbox', 'aria-label': 'Es consejero de este grupo' });
    var sugerencia = el('p', { clase: 'bloque-ayuda', hidden: true });
    selProfesor.addEventListener('change', function () {
      sugerencia.hidden = true;
      var perfil = perfilDe[selProfesor.value];
      var d = perfil ? docenteDe(perfil) : null;
      if (!d) { return; }
      var partes = [];
      // Materia: la primera del directorio que exista en la lista de materias.
      var mats = materiasDe(d);
      var hallada = '';
      mats.forEach(function (m) {
        if (hallada) { return; }
        var op = datos.materias.filter(function (x) { return sinTildes(x.nombre) === sinTildes(m); })[0];
        if (op) { hallada = op.id; }
      });
      if (hallada) { selMateria.value = hallada; }
      if (mats.length) { partes.push('materia(s): ' + mats.join(', ')); }
      // Grupo: solo si el directorio lo trae y existe ese grupo en el sistema (año activo primero).
      var local = grupoLocal(d.grupo);
      if (local) {
        var activo = datos.anios.filter(function (a) { return a.activo; })[0];
        var cand = datos.salones.filter(function (x) { return x.nombre === local; });
        var salon = cand.filter(function (x) { return activo && x.anio && x.anio.anio === activo.anio; })[0] || cand[0];
        if (salon) { selSalon.value = salon.id; cbCons.checked = /consejer/i.test(d.tipo || ''); partes.push('grupo ' + local + (cbCons.checked ? ' (consejería)' : '')); }
        else { partes.push('grupo ' + d.grupo + ' (aún no existe en «Grupos»)'); }
      }
      if (partes.length) {
        sugerencia.textContent = 'Según el directorio de docentes: ' + partes.join(' · ') + '. Se rellenó solo; cámbielo si hace falta y pulse «Asignar».';
        sugerencia.hidden = false;
      }
    });
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      campo('Grupo', selSalon), campo('Profesor', selProfesor), campo('Materia', selMateria),
      el('label', null, [cbCons, ' Es consejero(a) de este grupo']),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Asignar' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!selSalon.value || !selProfesor.value) { aviso('Elija el grupo y el profesor.', 'error'); return; }
      if (!selMateria.value && !cbCons.checked) { aviso('Elija una materia, marque «Es consejero(a)», o ambas.', 'error'); return; }
      ejecutar(async function () {
        if (!tieneRol(selProfesor.value, 'profesor')) {
          var rp = await db.from('portal2027_roles_usuario').insert({ usuario_id: selProfesor.value, rol: 'profesor' });
          if (rp.error) { throw rp.error; }
        }
        if (selMateria.value) {
          var r = await db.from('portal2027_asignaciones').insert({ salon_id: selSalon.value, materia_id: selMateria.value, profesor_id: selProfesor.value });
          if (r.error) { throw r.error; }
        }
        if (cbCons.checked) { await hacerConsejero(selSalon.value, selProfesor.value); }
      }, 'Asignación guardada.');
    });

    var hijos = [
      el('h2', { texto: 'Profesores por grupo' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Aquí se asigna a cada profesor su grupo, su materia y, si corresponde, su consejería. Para un profesor con varias materias en el mismo grupo, asigne una por una.' }),
      tabla(['Grupo', 'Profesor', 'Teléfono', 'Materias', 'Consejero'], filas, 'Todavía no hay profesores asignados a grupos.')
    ];
    if (profesores.length === 0) {
      hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'No hay cuentas para asignar. Cree las cuentas de los profesores en «Personas y roles» o importe la lista de profesores desde Excel.' }));
    }
    hijos.push(form);
    hijos.push(sugerencia);
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
