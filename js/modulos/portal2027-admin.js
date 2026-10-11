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
      consultar(db.from('portal2027_perfiles').select('id,nombres,apellidos,correo,activo').order('apellidos').order('correo')),
      consultar(db.from('portal2027_roles_usuario').select('usuario_id,rol')),
      consultar(db.from('portal2027_anios').select('id,anio,activo,trimestres:portal2027_trimestres(numero)').order('anio', { ascending: false })),
      consultar(db.from('portal2027_salones').select('id,nombre,anio:portal2027_anios(anio)').order('nombre')),
      consultar(db.from('portal2027_materias').select('id,nombre').order('nombre')),
      consultar(db.from('portal2027_asignaciones').select('id,salon:portal2027_salones(nombre,anio:portal2027_anios(anio)),materia:portal2027_materias(nombre),profesor:portal2027_perfiles(nombres,apellidos,correo)'))
    ]);
    datos = { perfiles: r[0], roles: r[1], anios: r[2], salones: r[3], materias: r[4], asignaciones: r[5] };
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
    var filas = datos.perfiles.map(function (p) {
      var nombres = el('input', { type: 'text', value: p.nombres || '', 'aria-label': 'Nombres de ' + P.nombreCompleto(p) });
      var apellidos = el('input', { type: 'text', value: p.apellidos || '', 'aria-label': 'Apellidos de ' + P.nombreCompleto(p) });
      var guardar = el('button', {
        clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Guardar nombre',
        onclick: function () {
          ejecutar(async function () {
            var r = await db.from('portal2027_perfiles').update({ nombres: nombres.value.trim(), apellidos: apellidos.value.trim() }).eq('id', p.id);
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
        el('td', null, [apellidos]),
        el('td', null, [guardar])
      ].concat(celdasRoles).concat([el('td', { clase: 'centro' }, [activo])]));
    });

    var cab = ['Correo', 'Nombres', 'Apellidos', ''].concat(P.ORDEN.map(function (r) { return P.ROLES[r].etiqueta; })).concat(['Activa']);
    return el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Personas y roles' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Las cuentas nuevas se crean en Supabase (Authentication → Users). Aparecen aquí sin roles; marque los roles que correspondan.' }),
      tabla(cab, filas, 'Todavía no hay cuentas.')
    ]);
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
    var filas = datos.materias.map(function (m) { return el('tr', null, [el('td', { texto: m.nombre })]); });
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
    return el('section', { clase: 'bloque' }, [el('h2', { texto: 'Materias' }), tabla(['Materia'], filas, 'Todavía no hay materias.'), form]);
  }

  /* ---------- Grupos ---------- */
  function seccionSalones() {
    var filas = datos.salones.map(function (s) {
      return el('tr', null, [el('td', { texto: s.nombre }), el('td', { texto: s.anio ? String(s.anio.anio) : '' })]);
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
    return el('section', { clase: 'bloque' }, [el('h2', { texto: 'Grupos' }), tabla(['Grupo', 'Año'], filas, 'Todavía no hay grupos.'), form]);
  }

  /* ---------- Asignaciones ---------- */
  function seccionAsignaciones() {
    var profesores = datos.perfiles.filter(function (p) { return tieneRol(p.id, 'profesor'); });

    var filas = datos.asignaciones.map(function (a) {
      var quitar = el('button', {
        clase: 'boton boton-secundario boton-chico boton-peligro', type: 'button', texto: 'Quitar',
        onclick: function () {
          if (!window.confirm('¿Quitar esta asignación?')) { return; }
          ejecutar(async function () {
            var r = await db.from('portal2027_asignaciones').delete().eq('id', a.id);
            if (r.error) { throw r.error; }
          }, 'Asignación quitada.');
        }
      });
      return el('tr', null, [
        el('td', { texto: a.salon ? a.salon.nombre + (a.salon.anio ? ' (' + a.salon.anio.anio + ')' : '') : '' }),
        el('td', { texto: a.materia ? a.materia.nombre : '' }),
        el('td', { texto: P.nombreCompleto(a.profesor) }),
        el('td', null, [quitar])
      ]);
    });

    var selSalon = el('select', { required: true }, opciones(datos.salones, function (s) { return s.id; }, function (s) { return s.nombre + (s.anio ? ' (' + s.anio.anio + ')' : ''); }, 'Elija el grupo'));
    var selMateria = el('select', { required: true }, opciones(datos.materias, function (m) { return m.id; }, function (m) { return m.nombre; }, 'Elija la materia'));
    var selProfesor = el('select', { required: true }, opciones(profesores, function (p) { return p.id; }, function (p) { return P.nombreCompleto(p); }, 'Elija el profesor'));
    var form = el('form', { clase: 'formulario-fila', novalidate: true }, [
      campo('Grupo', selSalon), campo('Materia', selMateria), campo('Profesor', selProfesor),
      el('button', { clase: 'boton boton-secundario', type: 'submit', texto: 'Asignar' })
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!selSalon.value || !selMateria.value || !selProfesor.value) { aviso('Elija grupo, materia y profesor.', 'error'); return; }
      ejecutar(async function () {
        var r = await db.from('portal2027_asignaciones').insert({ salon_id: selSalon.value, materia_id: selMateria.value, profesor_id: selProfesor.value });
        if (r.error) { throw r.error; }
      }, 'Asignación creada.');
    });

    var hijos = [el('h2', { texto: 'Asignaciones' }), tabla(['Grupo', 'Materia', 'Profesor', ''], filas, 'Todavía no hay asignaciones.')];
    if (profesores.length === 0) {
      hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Para asignar, primero marque el rol Profesor a alguien en «Personas y roles».' }));
    }
    hijos.push(form);
    return el('section', { clase: 'bloque' }, hijos);
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
