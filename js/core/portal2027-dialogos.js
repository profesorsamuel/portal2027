/* portal2027-dialogos.js — confirmaciones, texto y avisos accesibles.
   Cargar después de portal2027-permisos.js y antes del módulo que lo utilice.
   Las solicitudes de diálogo se atienden en orden, una ventana a la vez. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var cola = Promise.resolve();
  var siguienteId = 0;
  var zonaAvisos = null;

  function texto(valor, respaldo) {
    return valor === null || valor === undefined ? (respaldo || '') : String(valor);
  }

  function mostrarDialogo(opciones) {
    return new Promise(function (resolver) {
      var anterior = document.activeElement;
      var id = 'portal-dialogo-' + (++siguienteId);
      var resultadoCancelado = opciones.pedir ? null : false;
      var resuelto = false;
      var restaurarInert = [];
      var fondo = null;
      var dialogo = el('dialog', {
        clase: 'portal-dialogo', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': id + '-titulo', 'aria-describedby': id + '-texto'
      });
      var titulo = el('h2', { id: id + '-titulo', texto: opciones.titulo });
      var descripcion = el('p', { id: id + '-texto', clase: 'portal-dialogo-texto', texto: opciones.texto });
      var entrada = opciones.pedir ? el('input', {
        id: id + '-entrada', type: 'text', value: opciones.valor, autocomplete: 'off'
      }) : null;
      var cancelar = el('button', { type: 'button', clase: 'boton boton-secundario', texto: 'Cancelar' });
      var aceptar = el('button', { type: 'submit', clase: 'boton boton-secundario portal-dialogo-aceptar', texto: opciones.boton });
      var formulario = el('form', { clase: 'portal-dialogo-formulario' }, [
        titulo, descripcion,
        entrada ? el('label', { for: id + '-entrada' }, [opciones.etiqueta, entrada]) : null,
        el('div', { clase: 'portal-dialogo-acciones' }, [cancelar, aceptar])
      ]);
      dialogo.appendChild(formulario);

      function controles() { return entrada ? [entrada, cancelar, aceptar] : [cancelar, aceptar]; }
      function focoInicial() {
        var objetivo = entrada || cancelar;
        objetivo.focus();
        if (entrada) entrada.select();
      }
      function cerrar(valor) {
        if (resuelto) return;
        resuelto = true;
        document.removeEventListener('keydown', teclado, true);
        document.removeEventListener('focusin', retenerFoco, true);
        if (typeof dialogo.close === 'function' && dialogo.open) dialogo.close();
        dialogo.remove();
        if (fondo) fondo.remove();
        restaurarInert.forEach(function (item) { item.nodo.inert = item.valor; });
        if (anterior && anterior.isConnected && typeof anterior.focus === 'function') anterior.focus();
        resolver(valor);
      }
      function teclado(ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault(); ev.stopPropagation(); cerrar(resultadoCancelado);
        } else if (ev.key === 'Tab') {
          var lista = controles(), actual = lista.indexOf(document.activeElement);
          // Se controla cada salto para que Tab y Shift+Tab nunca salgan del diálogo.
          ev.preventDefault();
          lista[(actual + (ev.shiftKey ? -1 : 1) + lista.length) % lista.length].focus();
        }
      }
      function retenerFoco(ev) {
        if (!resuelto && !dialogo.contains(ev.target)) focoInicial();
      }
      cancelar.addEventListener('click', function () { cerrar(resultadoCancelado); });
      formulario.addEventListener('submit', function (ev) {
        ev.preventDefault(); cerrar(entrada ? entrada.value : true);
      });
      dialogo.addEventListener('cancel', function (ev) { ev.preventDefault(); cerrar(resultadoCancelado); });
      dialogo.addEventListener('close', function () { cerrar(resultadoCancelado); });
      document.body.appendChild(dialogo);
      try {
        if (typeof dialogo.showModal === 'function') {
          dialogo.showModal(); // El navegador bloquea el contenido de fondo y pone el diálogo encima.
        } else {
          fondo = el('div', { clase: 'portal-dialogo-fondo', 'aria-hidden': 'true' });
          document.body.insertBefore(fondo, dialogo);
          Array.from(document.body.children).forEach(function (nodo) {
            if (nodo === dialogo || nodo === fondo) return;
            restaurarInert.push({ nodo: nodo, valor: nodo.inert });
            nodo.inert = true;
          });
          dialogo.setAttribute('open', '');
          dialogo.classList.add('portal-dialogo-alternativo');
        }
        document.addEventListener('keydown', teclado, true);
        document.addEventListener('focusin', retenerFoco, true);
        focoInicial();
      } catch (error) {
        cerrar(resultadoCancelado);
        P.aviso('No se pudo abrir la ventana. Intente nuevamente.', 'error');
      }
    });
  }

  function encolar(opciones) {
    var solicitud = cola.then(function () { return mostrarDialogo(opciones); });
    cola = solicitud.catch(function () { /* Un fallo no bloquea los diálogos siguientes. */ });
    return solicitud;
  }

  P.confirmar = function (titulo, mensaje, textoBoton) {
    return encolar({ titulo: texto(titulo, 'Confirmar acción'), texto: texto(mensaje), boton: texto(textoBoton, 'Confirmar'), pedir: false });
  };

  P.pedirTexto = function (titulo, etiqueta, valorInicial) {
    return encolar({ titulo: texto(titulo, 'Escribir información'), texto: 'Escriba el dato solicitado o cancele para volver.',
      etiqueta: texto(etiqueta, 'Texto'), valor: texto(valorInicial), boton: 'Aceptar', pedir: true });
  };

  P.aviso = function (mensaje, tipo) {
    tipo = ['ok', 'error', 'info'].indexOf(tipo) !== -1 ? tipo : 'info';
    if (!zonaAvisos || !zonaAvisos.isConnected) {
      zonaAvisos = el('div', { clase: 'portal-avisos', 'aria-label': 'Avisos del portal' });
      document.body.appendChild(zonaAvisos);
    }
    var focoAnterior = document.activeElement;
    var temporizador = null;
    var cerrado = false;
    var duracion = tipo === 'error' ? 8000 : 5000;
    var etiquetas = { ok: 'Correcto', error: 'Error', info: 'Información' };
    var contenido = el('div', { role: tipo === 'error' ? 'alert' : 'status', 'aria-atomic': 'true' });
    var botonCerrar = el('button', { type: 'button', clase: 'portal-aviso-cerrar', texto: 'Cerrar', 'aria-label': 'Cerrar aviso' });
    var aviso = el('div', { clase: 'portal-aviso portal-aviso-' + tipo }, [contenido, botonCerrar]);
    function pausar() { window.clearTimeout(temporizador); }
    function cerrar() {
      if (cerrado) return;
      cerrado = true; pausar();
      var teniaFoco = aviso.contains(document.activeElement);
      aviso.remove();
      if (teniaFoco && focoAnterior && focoAnterior.isConnected && typeof focoAnterior.focus === 'function') focoAnterior.focus();
    }
    function continuar() {
      pausar();
      if (!cerrado && !aviso.contains(document.activeElement) && !aviso.matches(':hover')) temporizador = window.setTimeout(cerrar, duracion);
    }
    botonCerrar.addEventListener('click', cerrar);
    aviso.addEventListener('mouseenter', pausar);
    aviso.addEventListener('mouseleave', continuar);
    aviso.addEventListener('focusin', pausar);
    aviso.addEventListener('focusout', function () { window.setTimeout(continuar, 0); });
    zonaAvisos.appendChild(aviso);
    // El nodo vivo existe antes de introducir el mensaje, para que se anuncie.
    window.setTimeout(function () {
      if (cerrado) return;
      contenido.appendChild(el('strong', { texto: etiquetas[tipo] + ': ' }));
      contenido.appendChild(document.createTextNode(texto(mensaje)));
      continuar();
    }, 0);
  };
})();
