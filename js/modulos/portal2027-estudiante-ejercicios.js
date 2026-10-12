/* portal2027-estudiante-ejercicios.js — «Mis ejercicios virtuales» (guía, etapa 6, parte B): panel del estudiante.
   Los datos llegan de portal2027_mis_ejercicios (solo su grupo, sin nombres de compañeros). Aquí no se calcula nota:
   la nota de la libreta solo cambia cuando el profesor consolida el periodo. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;

  async function consultar(q) { var r = await q; if (r.error) { throw r.error; } return r.data; }
  function fecha(d) { var p = String(d).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
  function chip(t) { return el('span', { clase: 'etiqueta-chica', texto: t }); }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/duplicate key|violates check constraint/i.test(m)) { return P.traducirError(e); }
    if (/periodo|trimestre|equipo|No tiene permiso/i.test(m)) { return m.replace(/\s*\(row-level security\)/, ''); }
    return P.traducirError(e);
  }

  P.renderEstudianteEjercicios = async function (zona) {
    var sec = el('section', { clase: 'bloque' }, [el('h2', { texto: 'Mis ejercicios virtuales' })]);
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

    function tarjeta(x) {
      var chips = [
        chip(x.materia),
        chip((x.periodo_tipo === 'semanal' ? 'Semana' : 'Quincena') + ' ' + fecha(x.fecha_inicio) + ' – ' + fecha(x.fecha_fin)),
        chip(x.cuenta_nota ? 'Cuenta para la nota' : 'Práctica: no da nota'),
        chip(x.participacion === 'equipo' ? 'Equipo de ' + x.tamano_equipo : 'Individual'),
        x.periodo_cerrado ? chip('Periodo cerrado') : null
      ];
      var hijos = [el('div', null, [el('strong', { texto: x.titulo + ' ' })].concat(chips))];
      hijos.push(el('p', { clase: 'bloque-ayuda', texto: x.mejor_nota === null || x.mejor_nota === undefined
        ? 'Todavía no tiene intentos guardados.' : 'Su mejor nota guardada: ' + Number(x.mejor_nota) + (x.cuenta_nota ? '' : ' (práctica, no cuenta)') }));

      if (x.participacion === 'equipo') {
        if (!x.equipo_id) { hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Su profesor aún no le asigna un equipo.' })); }
        else if (x.equipo_confirmado) { hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Su equipo está confirmado.' })); }
        else if (x.yo_confirme) { hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Usted ya confirmó; faltan otros integrantes.' })); }
        else {
          hijos.push(el('div', { clase: 'cabecera-acciones' }, [el('button', { clase: 'boton boton-secundario boton-chico', type: 'button',
            disabled: x.periodo_cerrado, texto: 'Confirmar mi equipo', onclick: async function () {
              aviso('Guardando…', 'info');
              try {
                var r = await db.rpc('portal2027_confirmar_equipo', { p_equipo: x.equipo_id });
                if (r.error) { throw r.error; }
                await cargar();
                aviso(r.data && r.data.equipo_confirmado ? 'Equipo confirmado por todos.' : 'Confirmado. Faltan otros integrantes.', 'ok');
              } catch (e) { aviso('No se confirmó. ' + textoError(e), 'error'); }
            } })]));
        }
      }

      var pagina = /^[a-z0-9-]+$/.test(x.juego || '') ? P.raiz + 'pages/ejercicios/portal2027-' + x.juego + '.html?ejercicio=' + encodeURIComponent(x.ejercicio_id) : null;
      if (x.puede_jugar && pagina) {
        hijos.push(el('div', { clase: 'cabecera-acciones' }, [el('a', { clase: 'boton boton-secundario boton-chico', href: pagina, texto: 'Jugar' })]));
      } else if (x.puede_jugar) {
        hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'Su profesor aún no asigna un juego a este ejercicio.' }));
      } else if (x.motivo) {
        hijos.push(el('p', { clase: 'bloque-ayuda', texto: 'No disponible: ' + x.motivo + '.' }));
      }
      return el('li', { clase: 'tarjeta-clase tarjeta-columna' }, hijos);
    }

    async function cargar() {
      cont.textContent = '';
      cont.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando…' }));
      var r = await P.ejercicios.misEjercicios(sel.value);
      cont.textContent = '';
      if (!r.ok) { cont.appendChild(el('p', { clase: 'mensaje error', texto: 'No se pudieron cargar sus ejercicios. ' + r.error })); return; }
      if (r.ejercicios.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'No tiene ejercicios virtuales en este trimestre.' })); return; }
      cont.appendChild(el('ul', { clase: 'lista-clases' }, r.ejercicios.map(tarjeta)));
    }
    sel.addEventListener('change', function () { aviso('', 'info'); cargar(); });
    await cargar();
  };
})();
