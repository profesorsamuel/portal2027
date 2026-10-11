/* portal2027-acceso.js — pantalla de entrada: inicio de sesión, recuperación y elección de panel. */
(function () {
  'use strict';

  var P = window.portal2027;
  var VISTAS = ['cargando', 'login', 'recuperar', 'nueva', 'elegir', 'sinrol'];

  function $(id) { return document.getElementById(id); }

  function mostrar(nombre) {
    VISTAS.forEach(function (v) { $('vista-' + v).hidden = (v !== nombre); });
    var foco = document.querySelector('#vista-' + nombre + ' [data-foco]');
    if (foco) { foco.focus(); }
  }

  function mensaje(nombre, texto, tipo) {
    var m = $('mensaje-' + nombre);
    if (!m) { return; }
    m.textContent = texto || '';
    m.className = 'mensaje ' + (tipo || 'info');
    m.hidden = !texto;
  }

  function ocupado(form, si) {
    Array.prototype.forEach.call(form.querySelectorAll('button[type="submit"]'), function (b) { b.disabled = si; });
  }

  function urlInicio() {
    return window.location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
  }

  async function enrutar() {
    mostrar('cargando');
    var info;
    try { info = await P.cargarSesion(); }
    catch (e) { mostrar('login'); mensaje('login', P.traducirError(e), 'error'); return; }

    if (!info) { mostrar('login'); return; }

    if (info.perfil && info.perfil.activo === false) {
      await P.db.auth.signOut();
      mostrar('login');
      mensaje('login', 'Su cuenta está desactivada. Consulte con la administración.', 'error');
      return;
    }
    if (info.roles.length === 0) { mostrar('sinrol'); return; }
    if (info.roles.length === 1) { window.location.replace(P.rutaPanel(info.roles[0])); return; }

    var lista = $('lista-paneles');
    lista.textContent = '';
    info.roles.forEach(function (rol) {
      lista.appendChild(P.el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rol), texto: P.ROLES[rol].etiqueta }));
    });
    mostrar('elegir');
  }

  async function salir() {
    try { await P.db.auth.signOut(); } catch (e) { /* ignorar */ }
    $('form-login').reset();
    mostrar('login');
    mensaje('login', '', 'info');
  }

  function conectarFormularios() {
    $('ir-recuperar').addEventListener('click', function () { mostrar('recuperar'); });
    $('volver-login').addEventListener('click', function () { mostrar('login'); });
    $('salir-elegir').addEventListener('click', salir);
    $('salir-sinrol').addEventListener('click', salir);

    $('form-login').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var form = ev.target;
      var correo = form.correo.value.trim();
      var clave = form.clave.value;
      if (!correo || !clave) { mensaje('login', 'Escriba su correo y su contraseña.', 'error'); return; }
      ocupado(form, true);
      mensaje('login', '', 'info');
      try {
        var r = await P.db.auth.signInWithPassword({ email: correo, password: clave });
        if (r.error) { throw r.error; }
        form.clave.value = '';
        await enrutar();
      } catch (e) {
        mensaje('login', P.traducirError(e), 'error');
      }
      ocupado(form, false);
    });

    $('form-recuperar').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var form = ev.target;
      var correo = form.correo.value.trim();
      if (!correo) { mensaje('recuperar', 'Escriba su correo.', 'error'); return; }
      ocupado(form, true);
      try {
        var r = await P.db.auth.resetPasswordForEmail(correo, { redirectTo: urlInicio() });
        if (r.error) { throw r.error; }
        mensaje('recuperar', 'Si el correo está registrado, recibirá un enlace en unos minutos. Revise también la carpeta de correo no deseado.', 'ok');
      } catch (e) {
        mensaje('recuperar', P.traducirError(e), 'error');
      }
      ocupado(form, false);
    });

    $('form-nueva').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var form = ev.target;
      if (form.clave.value.length < 8) { mensaje('nueva', 'La contraseña debe tener al menos 8 caracteres.', 'error'); return; }
      if (form.clave.value !== form.clave2.value) { mensaje('nueva', 'Las dos contraseñas no coinciden.', 'error'); return; }
      ocupado(form, true);
      try {
        var r = await P.db.auth.updateUser({ password: form.clave.value });
        if (r.error) { throw r.error; }
        form.reset();
        mensaje('nueva', 'Contraseña guardada. Entrando…', 'ok');
        await enrutar();
      } catch (e) {
        mensaje('nueva', P.traducirError(e), 'error');
      }
      ocupado(form, false);
    });
  }

  async function iniciar() {
    conectarFormularios();

    if (!P.db) {
      mostrar('login');
      mensaje('login', P.errorCarga, 'error');
      Array.prototype.forEach.call(document.querySelectorAll('#form-login button, #form-login input'), function (n) { n.disabled = true; });
      return;
    }

    var h = new URLSearchParams((window.portal2027_hashInicial || '').replace(/^#/, ''));

    if (h.get('error')) {
      mostrar('login');
      mensaje('login', 'El enlace venció o ya se usó. Pida uno nuevo con «¿Olvidó su contraseña?» (o pida a la administración que reenvíe la invitación).', 'error');
      return;
    }

    P.db.auth.onAuthStateChange(function (evento) {
      if (evento === 'PASSWORD_RECOVERY') { setTimeout(function () { mostrar('nueva'); }, 0); }
    });

    var r = await P.db.auth.getSession();
    if (h.get('type') === 'recovery' || h.get('type') === 'invite') {
      if (r.data.session) { mostrar('nueva'); }
      else {
        mostrar('login');
        mensaje('login', 'No se pudo validar el enlace. Pida uno nuevo con «¿Olvidó su contraseña?».', 'error');
      }
      return;
    }
    if (r.data.session) { await enrutar(); } else { mostrar('login'); }
  }

  iniciar();
})();
