// Juego de ejemplo «Sumas». Antes era un <script> en línea de
// pages/ejercicios/portal2027-ejemplo-suma.html; se movió a un archivo para poder aplicar
// una CSP sin unsafe-inline. Se carga después de portal2027-integracion-ejercicios.js.
  /* Juego de EJEMPLO con datos ficticios: 5 sumas. Nota = aciertos (0 a 5). Cumple el contrato
     docs/portal2027-integracion-ejercicios.md: solo usa iniciarEjercicio y guardarIntento. */
  (function () {
    'use strict';
    var P = window.portal2027, el = P.el, E = P.ejercicios;
    var cont = document.getElementById('contenido');
    var TOTAL = 5;

    function salida(nodos) { cont.textContent = ''; nodos.forEach(function (n) { cont.appendChild(n); }); }
    function volver() { return el('a', { clase: 'boton boton-secundario', href: P.rutaPanel('estudiante'), texto: 'Volver a mi panel' }); }
    function cabecera(extra) {
      return el('header', { clase: 'panel-cabecera' }, [el('div', null, [
        el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Ejercicio virtual' }),
        el('h1', { texto: extra || 'Sumas (ejemplo)' }),
        el('p', { clase: 'panel-datos', texto: 'Juego de ejemplo con datos ficticios.' })])]);
    }
    function error(texto) { salida([cabecera(), el('p', { clase: 'mensaje error', role: 'alert', texto: texto }), volver()]); }

    async function iniciar() {
      if (!P.db) { error(P.errorCarga); return; }
      var info;
      try { info = await P.cargarSesion(); } catch (e) { error(P.traducirError(e)); return; }
      if (!info || info.roles.indexOf('estudiante') === -1) { window.location.replace(P.rutaInicio()); return; }
      var id = new URLSearchParams(window.location.search).get('ejercicio');
      if (!id) { error('Falta indicar el ejercicio. Abra el juego desde «Mis ejercicios virtuales».'); return; }
      var ini = await E.iniciarEjercicio(id);
      if (!ini.ok) { error('No se pudo abrir el ejercicio. ' + ini.error); return; }
      if (!ini.puedeJugar) { error('No puede jugar ahora: ' + ini.motivo + '.'); return; }
      jugar(ini);
    }

    function jugar(ini) {
      var preguntas = [];
      for (var i = 0; i < TOTAL; i++) { preguntas.push({ a: 1 + Math.floor(Math.random() * 20), b: 1 + Math.floor(Math.random() * 20) }); }
      // Texto con teclado numérico (no «number»): la rueda del mouse y las flechas nunca cambian una respuesta.
      var campos = preguntas.map(function () { return el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '3', 'aria-label': 'Respuesta' }); });
      campos.forEach(function (c, i) {
        c.addEventListener('input', function () { c.value = c.value.replace(/\D/g, ''); });
        c.addEventListener('keydown', function (k) {
          var dest = null;
          if (k.key === 'Enter' || k.key === 'ArrowDown') { dest = campos[i + 1] || null; }
          else if (k.key === 'ArrowUp') { dest = campos[i - 1] || null; }
          else { return; }
          k.preventDefault();               // Enter no envía el formulario por accidente: solo pasa a la siguiente respuesta
          if (dest) { dest.focus(); dest.select(); }
          else if (k.key === 'Enter') { enviar.focus(); }   // en la última, el foco va a «Terminar»
        });
      });
      var aviso = el('p', { clase: 'mensaje', role: 'status', 'aria-live': 'polite', hidden: true });
      var enviar = el('button', { clase: 'boton', type: 'submit', texto: 'Terminar' });
      var form = el('form', null, preguntas.map(function (p, i) {
        return el('div', { clase: 'juego-pregunta' }, [el('span', { texto: p.a + ' + ' + p.b + ' =' }), campos[i]]);
      }).concat([enviar]));

      salida([cabecera(ini.titulo), el('p', { clase: 'mensaje info', texto: ini.cuentaNota
        ? 'Este ejercicio cuenta para la nota: se conserva su mejor intento.' : 'Es una práctica: se guarda el intento, pero no da nota.' }), form, aviso, volver()]);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var aciertos = 0;
        preguntas.forEach(function (p, i) { if (Number(campos[i].value) === p.a + p.b && campos[i].value !== '') { aciertos++; } });
        enviar.disabled = true; campos.forEach(function (c) { c.disabled = true; });
        guardar(ini, aciertos, aviso, form);
      });
    }

    // Reintentar con la MISMA clave es seguro: si el primer envío sí llegó, la base no crea otro intento.
    async function guardar(ini, nota, aviso, form) {
      aviso.textContent = 'Guardando…'; aviso.className = 'mensaje info'; aviso.hidden = false;
      var r = await E.guardarIntento(ini.ejercicioId, ini.claveEnvio, nota);
      if (r.ok) {
        aviso.className = 'mensaje ok';
        aviso.textContent = 'Guardado. Sacó ' + nota + ' de ' + TOTAL + '. Su mejor nota guardada: ' + r.mejorNota + (r.cuentaNota ? '.' : ' (práctica, no cuenta).');
        return;
      }
      aviso.className = 'mensaje error';
      aviso.textContent = 'NO se guardó. ' + r.error;
      var de = el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Reintentar guardar', onclick: function () { de.remove(); guardar(ini, nota, aviso, form); } });
      aviso.appendChild(document.createTextNode(' '));
      aviso.appendChild(de);
    }

    iniciar();
  })();
  
