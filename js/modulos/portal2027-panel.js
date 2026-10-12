/* portal2027-panel.js — estructura común de los paneles por rol y vista de profesor (la ficha del estudiante está en portal2027-estudiantes.js). */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var rol = document.body.getAttribute('data-rol');
  var contenido = document.getElementById('contenido');

  function limpiar() { contenido.textContent = ''; }

  function errorPantalla(texto) {
    limpiar();
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: texto }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }

  function cabecera(info) {
    var otros = info.roles.filter(function (r) { return r !== rol; }).map(function (r) {
      return el('a', { clase: 'boton boton-secundario boton-chico', href: P.rutaPanel(r), texto: 'Panel de ' + P.ROLES[r].etiqueta.toLowerCase() });
    });
    var salir = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion });
    return el('header', { clase: 'panel-cabecera' }, [
      el('div', null, [
        el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral' }),
        el('h1', { texto: 'Hola, ' + P.nombreCompleto(info.perfil) }),
        el('p', { clase: 'panel-datos', texto: 'Panel de ' + P.ROLES[rol].etiqueta.toLowerCase() })
      ]),
      el('div', { clase: 'cabecera-acciones' }, otros.concat([salir]))
    ]);
  }

  function bloqueTexto(titulo, parrafos) {
    return el('section', { clase: 'bloque' },
      [el('h2', { texto: titulo })].concat(parrafos.map(function (t) { return el('p', { clase: 'bloque-ayuda', texto: t }); })));
  }

  async function vistaProfesor(info) {
    var r = await P.db.from('portal2027_asignaciones')
      .select('id, salon:portal2027_salones(nombre, anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
      .eq('profesor_id', info.sesion.user.id);
    if (r.error) { throw r.error; }

    var filas = r.data.map(function (a) {
      return {
        id: a.id,
        anio: a.salon && a.salon.anio ? a.salon.anio.anio : 0,
        grupo: a.salon ? a.salon.nombre : '',
        materia: a.materia ? a.materia.nombre : ''
      };
    }).sort(function (a, b) { return b.anio - a.anio || a.grupo.localeCompare(b.grupo) || a.materia.localeCompare(b.materia); });

    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis grupos y materias' })]);
    if (filas.length === 0) {
      sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'Aún no tiene grupos asignados. Pida a la administración que se los asigne.' }));
      return sec;
    }
    var tabla = el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Año', 'Grupo', 'Materia', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, filas.map(function (f) {
        return el('tr', null, [el('td', { texto: String(f.anio) }), el('td', { texto: f.grupo }), el('td', { texto: f.materia }),
          el('td', null, [el('div', { clase: 'cabecera-acciones' }, [
            el('a', { clase: 'boton boton-secundario boton-chico', href: P.raiz + 'pages/portal2027-libreta.html?asignacion=' + encodeURIComponent(f.id), texto: 'Abrir libreta' }),
            el('a', { clase: 'boton boton-secundario boton-chico', href: P.raiz + 'pages/portal2027-asistencia.html?asignacion=' + encodeURIComponent(f.id), texto: 'Asistencia' }),
            el('a', { clase: 'boton boton-secundario boton-chico', href: P.raiz + 'pages/portal2027-clases.html?asignacion=' + encodeURIComponent(f.id), texto: 'Clases y tareas' }),
            el('a', { clase: 'boton boton-secundario boton-chico', href: P.raiz + 'pages/portal2027-ejercicios.html?asignacion=' + encodeURIComponent(f.id), texto: 'Ejercicios virtuales' })])])]);
      }))
    ]);
    sec.appendChild(el('div', { clase: 'tabla-contenedor' }, [tabla]));
    return sec;
  }

  // Administración en pestañas: una barra fija arriba y, debajo, solo las secciones de la pestaña elegida.
  var PESTANAS = [
    { id: 'personas', texto: 'Personas', titulos: ['Personas y roles', 'Importar profesores desde Excel', 'Directorio de docentes'] },
    { id: 'estructura', texto: 'Años, grupos y materias', titulos: ['Años lectivos', 'Grupos', 'Materias', 'Profesores por grupo', 'Consejeros por grupo'] },
    { id: 'estudiantes', texto: 'Estudiantes', titulos: ['Estudiantes'] },
    { id: 'documentos', texto: 'Documentos', titulos: ['Documentos de estudiantes'] },
    { id: 'config', texto: 'Configuración', titulos: ['Configuración académica'] },
    { id: 'respaldos', texto: 'Respaldos', titulos: ['Respaldos'] }
  ];

  function menuSecciones(zona) {
    var activa = PESTANAS[0].id;
    try { var g = window.sessionStorage.getItem('portal2027-pestana-admin'); if (g) { activa = g; } } catch (e) { /* sin almacenamiento */ }
    if (!PESTANAS.some(function (t) { return t.id === activa; })) { activa = PESTANAS[0].id; }

    // Cada «unidad» es una sección (o el bloque de configuración); se reconoce por su primer título.
    function unidades() {
      var salida = [];
      Array.prototype.forEach.call(zona.children, function (c) {
        if (c.classList.contains('secciones-admin')) { Array.prototype.forEach.call(c.children, function (x) { salida.push(x); }); }
        else if (c.tagName === 'SECTION' || c.classList.contains('secciones')) { salida.push(c); }
      });
      return salida;
    }
    function ubicar(u) {
      var h = u.querySelector('h2');
      var t = h ? h.textContent.trim() : '';
      for (var i = 0; i < PESTANAS.length; i++) {
        var pos = PESTANAS[i].titulos.indexOf(t);
        if (pos !== -1) { return { pestana: PESTANAS[i].id, orden: pos }; }
      }
      return { pestana: 'otros', orden: 99 };
    }

    var elegidas = {};
    try { elegidas = JSON.parse(window.sessionStorage.getItem('portal2027-subpestanas-admin') || '{}') || {}; } catch (e) { /* sin almacenamiento */ }
    if (typeof elegidas !== 'object' || Array.isArray(elegidas)) { elegidas = {}; }
    var barra = el('div', { clase: 'navegacion-admin' });
    var nav = el('nav', { clase: 'menu-secciones', 'aria-label': 'Secciones de administración' });
    var subnav = el('nav', { clase: 'menu-subsecciones', role: 'tablist', 'aria-label': 'Apartados de administración' });
    var botones = {};
    function guardar() {
      try {
        window.sessionStorage.setItem('portal2027-pestana-admin', activa);
        window.sessionStorage.setItem('portal2027-subpestanas-admin', JSON.stringify(elegidas));
      } catch (e) { /* sin almacenamiento */ }
    }
    function aplicar() {
      var hay = {};
      var lista = unidades().map(function (u, i) {
        var d = ubicar(u);
        var h = u.querySelector('h2');
        d.titulo = h ? h.textContent.trim() : 'Apartado ' + (i + 1);
        d.unidad = u;
        d.id = 'admin-apartado-' + i;
        hay[d.pestana] = true;
        return d;
      });
      var disponibles = lista.filter(function (d) { return d.pestana === activa; }).sort(function (a, b) { return a.orden - b.orden; });
      if (!disponibles.some(function (d) { return d.titulo === elegidas[activa]; }) && disponibles.length) {
        elegidas[activa] = disponibles[0].titulo;
      }
      subnav.replaceChildren();
      subnav.hidden = disponibles.length < 2;
      disponibles.forEach(function (d) {
        var on = d.titulo === elegidas[activa];
        var b = el('button', { clase: 'pestana' + (on ? ' activa' : ''), type: 'button', role: 'tab',
          id: d.id + '-tab', texto: d.titulo === 'Importar profesores desde Excel' ? 'Importar profesores' : d.titulo,
          'aria-controls': d.id, 'aria-selected': on ? 'true' : 'false', tabindex: on ? '0' : '-1' });
        b.addEventListener('click', function () {
          elegidas[activa] = d.titulo;
          guardar();
          aplicar();
          var nuevo = document.getElementById(d.id + '-tab');
          if (nuevo) { nuevo.focus(); }
        });
        b.addEventListener('keydown', function (e) {
          var i = disponibles.indexOf(d), siguiente;
          if (e.key === 'ArrowRight') { siguiente = (i + 1) % disponibles.length; }
          else if (e.key === 'ArrowLeft') { siguiente = (i + disponibles.length - 1) % disponibles.length; }
          else if (e.key === 'Home') { siguiente = 0; }
          else if (e.key === 'End') { siguiente = disponibles.length - 1; }
          else { return; }
          e.preventDefault();
          elegidas[activa] = disponibles[siguiente].titulo;
          guardar();
          aplicar();
          var nuevo = document.getElementById(disponibles[siguiente].id + '-tab');
          if (nuevo) { nuevo.focus(); }
        });
        subnav.appendChild(b);
      });
      lista.forEach(function (d) {
        var on = d.pestana === activa && d.titulo === elegidas[activa];
        d.unidad.id = d.id;
        d.unidad.style.order = String(d.orden);
        d.unidad.classList.toggle('oculta', !on);
        d.unidad.setAttribute('role', 'tabpanel');
        d.unidad.setAttribute('aria-labelledby', d.id + '-tab');
      });
      Object.keys(botones).forEach(function (id) {
        var on = id === activa;
        botones[id].setAttribute('aria-pressed', on ? 'true' : 'false');
        botones[id].classList.toggle('activa', on);
        botones[id].hidden = id === 'otros' && !hay.otros;
      });
    }
    PESTANAS.concat([{ id: 'otros', texto: 'Otros' }]).forEach(function (t) {
      var b = el('button', { clase: 'pestana', type: 'button', texto: t.texto });
      b.addEventListener('click', function () {
        activa = t.id;
        aplicar();
        guardar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      botones[t.id] = b;
      nav.appendChild(b);
    });
    barra.appendChild(nav);
    barra.appendChild(subnav);
    zona.parentNode.insertBefore(barra, zona);
    aplicar();
    // Mantiene el apartado seleccionado después de guardar o redibujar las secciones.
    new MutationObserver(aplicar).observe(zona, { childList: true });
  }

  async function iniciar() {
    var info = await P.requerirRol(rol);
    if (info === null) { return; }
    if (info.error) { errorPantalla(info.error); return; }

    limpiar();
    contenido.appendChild(cabecera(info));
    var zona = el('div', { clase: 'secciones' });
    contenido.appendChild(zona);

    try {
      if (rol === 'administrador') {
        await P.renderAdmin(zona, info);
        await P.renderProfesoresAdmin(zona, info);
        await P.renderDocentesAdmin(zona, info);
        await P.renderEstudiantesAdmin(zona, info);
        await P.renderDocumentosAdmin(zona, info);
        await P.renderConfigAdmin(zona, info);
        await P.renderRespaldosAdmin(zona, info);
        menuSecciones(zona);
      } else if (rol === 'profesor') {
        zona.appendChild(await vistaProfesor(info));
        await P.renderEstudiantesProfesor(zona, info);
      } else if (rol === 'consejero') {
        await P.renderConsejeria(zona, info);
        await P.renderDocumentosConsejeria(zona, info);
      }
      else {
        await P.renderEstudianteFicha(zona, info);
        await P.renderEstudianteAcademico(zona, info);
        await P.renderEstudianteClases(zona, info);
        await P.renderEstudianteEjercicios(zona, info);
        await P.renderDocumentosEstudiante(zona, info);
      }
    } catch (e) {
      zona.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: P.traducirError(e) }));
    }
  }

  iniciar();
})();
