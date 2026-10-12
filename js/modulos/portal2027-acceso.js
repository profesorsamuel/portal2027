/* portal2027-acceso.js — pantalla de entrada: inicio de sesión, recuperación y elección de panel. */
(function () {
  'use strict';

  var P = window.portal2027;
  var VISTAS = ['cargando', 'login', 'recuperar', 'nueva', 'elegir', 'sinrol'];

  function $(id) { return document.getElementById(id); }

  function mostrar(nombre) {
    VISTAS.forEach(function (v) { $('vista-' + v).hidden = (v !== nombre); });
    if (nombre === 'login') { cargarGrupos(); $('est-grupo').focus(); return; }
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

  var gruposCargados = false;

  function elegirPestana(estudiante) {
    $('form-estudiante').hidden = !estudiante;
    $('form-login').hidden = estudiante;
    $('pestana-estudiante').classList.toggle('activa', estudiante);
    $('pestana-personal').classList.toggle('activa', !estudiante);
    $('pestana-estudiante').setAttribute('aria-selected', String(estudiante));
    $('pestana-personal').setAttribute('aria-selected', String(!estudiante));
    mensaje('login', '', 'info');
    var campo = estudiante ? $('est-grupo') : $('login-correo');
    if (campo) { campo.focus(); }
    if (estudiante) { cargarGrupos(); }
  }

  // La lista de grados la da una función pública; la pantalla de entrada no puede leer tablas.
  async function cargarGrupos() {
    if (gruposCargados || !P.db) { return; }
    var sel = $('est-grupo');
    try {
      var r = await P.db.functions.invoke('portal2027-buscar-estudiante', { body: { accion: 'grupos' } });
      if (r.error) { throw r.error; }
      var grupos = (r.data && r.data.grupos) || [];
      sel.textContent = '';
      sel.appendChild(P.el('option', { value: '', texto: grupos.length ? 'Elija su grado…' : 'No hay grados disponibles' }));
      grupos.forEach(function (g) { sel.appendChild(P.el('option', { value: g, texto: g })); });
      gruposCargados = grupos.length > 0;
    } catch (e) {
      sel.textContent = '';
      sel.appendChild(P.el('option', { value: '', texto: 'No se pudieron cargar los grados' }));
      mensaje('login', 'No se pudo cargar la lista de grados. Revise su internet y recargue la página.', 'error');
    }
  }

  // Misma regla que en el servidor: solo letras y números, en mayúsculas ("8-123-456" = "8123456").
  function normalizarCedula(c) { return String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

  async function entrarEstudiante(form) {
    var grupo = form.grupo.value;
    var nombre = form.nombre.value.trim();
    var cedula = normalizarCedula(form.cedula.value);
    var generico = 'No encontramos un estudiante con esos datos. Revise su grado, su nombre y apellido, y su cédula.';
    if (!grupo || !nombre || !cedula) { mensaje('login', 'Elija su grado y escriba su nombre y su cédula.', 'error'); return; }
    if (nombre.split(/\s+/).length < 2) { mensaje('login', 'Escriba su nombre y su apellido.', 'error'); return; }

    ocupado(form, true);
    mensaje('login', '', 'info');
    try {
      var b = await P.db.functions.invoke('portal2027-buscar-estudiante', { body: { grupo: grupo, nombre: nombre } });
      if (b.error) { throw b.error; }
      var candidatos = (b.data && b.data.candidatos) || [];
      var entro = false;
      for (var i = 0; i < candidatos.length && !entro; i++) {
        var r = await P.db.auth.signInWithPassword({ email: candidatos[i], password: cedula });
        if (!r.error) { entro = true; }
        else if (!/Invalid login credentials/i.test(r.error.message || '')) { throw r.error; }
      }
      if (!entro) { mensaje('login', generico, 'error'); ocupado(form, false); return; }
      form.cedula.value = '';
      await enrutar();
    } catch (e) {
      mensaje('login', P.traducirError(e), 'error');
    }
    ocupado(form, false);
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
    $('form-estudiante').reset();
    mostrar('login');
    mensaje('login', '', 'info');
  }

  function conectarFormularios() {
    $('pestana-estudiante').addEventListener('click', function () { elegirPestana(true); });
    $('pestana-personal').addEventListener('click', function () { elegirPestana(false); });
    $('form-estudiante').addEventListener('submit', function (ev) { ev.preventDefault(); entrarEstudiante(ev.target); });
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
      Array.prototype.forEach.call(document.querySelectorAll('#vista-login button, #vista-login input, #vista-login select'), function (n) { n.disabled = true; });
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
