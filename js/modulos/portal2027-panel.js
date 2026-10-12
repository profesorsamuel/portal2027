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
        await P.renderEstudiantesAdmin(zona, info);
        await P.renderConsejeriaAdmin(zona, info);
        await P.renderDocumentosAdmin(zona, info);
        await P.renderConfigAdmin(zona, info);
        await P.renderRespaldosAdmin(zona, info);
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
