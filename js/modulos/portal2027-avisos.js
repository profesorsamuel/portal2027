/* portal2027-avisos.js — avisos como BORRADORES (etapa 7, parte B).
   Nunca se envía nada: la persona revisa, edita y copia el texto para enviarlo ella misma por el medio que decida.
   No usa correo, mensajes ni ningún envío automático. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;

  async function copiar(texto) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; }
    } catch (e) { /* se prueba el método alterno */ }
    try {
      var t = el('textarea', { value: texto, style: 'position:fixed;left:-9999px;top:0' });
      document.body.appendChild(t);
      t.select();
      var ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (e2) { return false; }
  }

  // items: [{ titulo, texto }]
  function dibujar(cont, items, ayuda) {
    cont.textContent = '';
    cont.appendChild(el('p', { clase: 'mensaje info', texto: 'BORRADORES: no se envía nada automáticamente. Revise y edite cada texto; luego cópielo y envíelo usted mismo por el medio que decida.' }));
    if (ayuda) { cont.appendChild(el('p', { clase: 'bloque-ayuda', texto: ayuda })); }
    if (items.length === 0) { cont.appendChild(el('p', { clase: 'vacio-texto', texto: 'No hay avisos que preparar con los datos actuales.' })); return; }
    items.forEach(function (it) {
      var area = el('textarea', { clase: 'aviso-texto', rows: '7', 'aria-label': 'Borrador: ' + it.titulo, value: it.texto });
      var marca = el('span', { clase: 'aviso-marca', role: 'status', 'aria-live': 'polite' });
      var boton = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Copiar borrador', onclick: async function () {
        var ok = await copiar(area.value);
        marca.textContent = ok ? 'Copiado.' : 'No se pudo copiar: seleccione el texto y cópielo a mano.';
      } });
      cont.appendChild(el('div', { clase: 'aviso-borrador' }, [
        el('h4', { texto: it.titulo }), area, el('div', { clase: 'cabecera-acciones' }, [boton, marca])
      ]));
    });
  }

  P.avisos = { dibujar: dibujar };
})();
