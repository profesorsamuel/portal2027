/* portal2027-acceso.js — pantalla de entrada: inicio de sesión, recuperación y elección de panel. */
(function () {
  'use strict';

  var P = window.portal2027;
  var VISTAS = ['cargando', 'login', 'recuperar', 'nueva', 'elegir', 'sinrol', 'temporal'];

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

  function textoError(e) {
    console.error('portal2027-acceso: operación interrumpida', {
      nombre: e && e.name, codigo: e && e.code, estado: e && e.status
    });
    if (e && e.mensajePortal) { return e.mensajePortal; }
    if (e && (Number(e.status) === 429 || /over_.*rate_limit/.test(e.code || ''))) {
      return 'Demasiados intentos. Espere unos minutos y vuelva a intentarlo.';
    }
    return P.traducirError(e);
  }

  async function errorFuncion(r) {
    var original = r && r.error;
    var contexto = original && original.context;
    var estado = Number(contexto && contexto.status);
    var detalle = r && r.data;
    if (contexto && typeof contexto.json === 'function') {
      try {
        var copia = typeof contexto.clone === 'function' ? contexto.clone() : contexto;
        detalle = await copia.json();
      } catch (ignorar) { /* respuesta sin JSON: usa el mensaje seguro */ }
    }
    var texto = 'No se pudo completar la solicitud. Revise su internet e inténtelo nuevamente.';
    if (estado === 429) {
      var segundos = Number(detalle && detalle.reintentar_en);
      if (Number.isInteger(segundos) && segundos > 0 && segundos <= 900) {
        texto = 'Demasiados intentos. Espere ' + (segundos < 60 ? segundos + ' segundos' : Math.ceil(segundos / 60) + ' minutos') + ' y vuelva a intentarlo.';
      } else { texto = 'Demasiados intentos. Espere unos minutos y vuelva a intentarlo.'; }
    } else if (estado === 503 || estado >= 500) {
      texto = 'El servicio no está disponible por el momento. Inténtelo más tarde; si continúa, avise al docente.';
    } else if (estado === 401) {
      texto = 'Su sesión venció. Inicie sesión nuevamente.';
    } else if (estado === 403) {
      texto = 'No tiene permiso para realizar esta acción. Consulte con el docente.';
    } else if (estado === 409) {
      texto = 'Su cuenta no tiene un cambio temporal pendiente. Cierre sesión y vuelva a entrar.';
    } else if (estado === 400) {
      texto = 'Revise los datos escritos. Si está cambiando la contraseña, compruebe la clave temporal y elija otra clave nueva.';
    }
    var error = new Error(texto);
    error.mensajePortal = texto; error.status = estado || 0;
    return error;
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
      if (r.error || (r.data && r.data.error)) { throw await errorFuncion(r); }
      var grupos = (r.data && r.data.grupos) || [];
      sel.textContent = '';
      sel.appendChild(P.el('option', { value: '', texto: grupos.length ? 'Elija su grado…' : 'No hay grados disponibles' }));
      grupos.forEach(function (g) { sel.appendChild(P.el('option', { value: g, texto: g })); });
      gruposCargados = grupos.length > 0;
    } catch (e) {
      sel.textContent = '';
      sel.appendChild(P.el('option', { value: '', texto: 'No se pudieron cargar los grados' }));
      mensaje('login', textoError(e), 'error');
    }
  }

  var solicitudLista = 0;
  async function cargarEstudiantes() {
    var turno = ++solicitudLista;
    var grupo = $('est-grupo').value;
    var sel = $('est-nombre');
    sel.disabled = true;
    sel.textContent = '';
    $('est-cedula').value = '';
    sel.appendChild(P.el('option', { value: '', texto: grupo ? 'Cargando estudiantes…' : 'Primero elija su grado…' }));
    mensaje('login', '', 'info');
    if (!grupo) { return; }
    try {
      var r = await P.db.functions.invoke('portal2027-buscar-estudiante', { body: { accion: 'estudiantes', grupo: grupo } });
      if (turno !== solicitudLista) { return; }
      if (r.error || (r.data && r.data.error)) { throw await errorFuncion(r); }
      if (!r.data || !Array.isArray(r.data.estudiantes)) { throw new Error('Actualice la función portal2027-buscar-estudiante en Supabase con el código de este ZIP.'); }
      var estudiantes = r.data.estudiantes.slice().sort(function (a, b) {
        return (a.etiqueta || a.nombre).localeCompare(b.etiqueta || b.nombre, 'es', { sensitivity: 'base' });
      });
      sel.textContent = '';
      sel.appendChild(P.el('option', { value: '', texto: estudiantes.length ? 'Elija su nombre…' : 'No hay estudiantes con acceso en este salón' }));
      estudiantes.forEach(function (e) { sel.appendChild(P.el('option', { value: e.nombre, texto: e.etiqueta || e.nombre })); });
      sel.disabled = !estudiantes.length;
    } catch (e) {
      if (turno !== solicitudLista) { return; }
      sel.textContent = '';
      sel.appendChild(P.el('option', { value: '', texto: 'No se pudo cargar la lista' }));
      mensaje('login', e.mensajePortal ? textoError(e) : 'No se pudo cargar la lista de estudiantes. Vuelva a elegir el grado o avise al docente.', 'error');
    }
  }

  // Misma regla que en el servidor: solo letras y números, en mayúsculas ("8-123-456" = "8123456").
  function normalizarCedula(c) { return String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

  function credencialesIncorrectas(error) {
    return error && (error.code === 'invalid_credentials' || /Invalid login credentials/i.test(error.message || ''));
  }

  async function autenticarEstudiante(correo, clave) {
    var r = await P.db.auth.signInWithPassword({ email: correo, password: clave });
    // Compatibilidad con cuentas antiguas: solo después de credenciales incorrectas.
    var cedula = normalizarCedula(clave);
    // El segundo intento solo corresponde a una cédula con separadores,
    // nunca a una contraseña personal arbitraria que contenga símbolos.
    var formatoCedula = /^[A-Za-z0-9]+(?:[-.\s][A-Za-z0-9]+)+$/.test(clave);
    if (credencialesIncorrectas(r.error) && formatoCedula && cedula && cedula !== clave) {
      r = await P.db.auth.signInWithPassword({ email: correo, password: cedula });
    }
    return r;
  }

  async function requiereCambio() {
    var r = await P.db.rpc('portal2027_requiere_cambio_clave');
    if (r.error || typeof r.data !== 'boolean') {
      console.error('No se pudo comprobar el estado de contraseña', r.error);
      throw new Error('No se pudo comprobar su acceso. Inténtelo nuevamente o consulte al docente.');
    }
    return r.data;
  }

  function prepararCambioTemporal() {
    var vista = document.createElement('div');
    vista.id = 'vista-temporal'; vista.className = 'vista'; vista.hidden = true;
    vista.appendChild(P.el('h2', { texto: 'Elija su contraseña personal' }));
    vista.appendChild(P.el('p', { clase: 'texto-ayuda', texto: 'Debe cambiar la contraseña temporal antes de continuar. Use de 12 a 128 caracteres, con letras y números.' }));
    var form = document.createElement('form'); form.id = 'form-temporal'; form.noValidate = true;
    [['actual', 'Contraseña temporal', 'current-password'], ['clave', 'Contraseña nueva', 'new-password'], ['repetir', 'Repita la contraseña nueva', 'new-password']].forEach(function (campo) {
      var id = 'temporal-' + campo[0];
      var etiqueta = P.el('label', { texto: campo[1] }); etiqueta.htmlFor = id;
      var entrada = document.createElement('input');
      entrada.id = id; entrada.name = campo[0]; entrada.type = 'password';
      entrada.autocomplete = campo[2]; entrada.required = true; entrada.maxLength = 128;
      if (campo[0] === 'actual') { entrada.setAttribute('data-foco', ''); }
      form.appendChild(etiqueta); form.appendChild(entrada);
    });
    var guardar = P.el('button', { clase: 'boton boton-principal', texto: 'Guardar contraseña' }); guardar.type = 'submit';
    var cancelar = P.el('button', { clase: 'enlace-boton', texto: 'Cerrar sesión' }); cancelar.type = 'button';
    cancelar.addEventListener('click', salir);
    form.appendChild(guardar); form.appendChild(cancelar); vista.appendChild(form);
    var aviso = P.el('p', { clase: 'mensaje' }); aviso.id = 'mensaje-temporal'; aviso.setAttribute('role', 'alert'); aviso.hidden = true;
    vista.appendChild(aviso); $('vista-nueva').parentNode.appendChild(vista);
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var actual = $('temporal-actual').value;
      var nueva = $('temporal-clave').value;
      if (!actual || nueva.length < 12 || nueva.length > 128 || !/[A-Za-z]/.test(nueva) || !/[0-9]/.test(nueva)) {
        mensaje('temporal', 'Escriba la contraseña temporal y una nueva de 12 a 128 caracteres, con letras y números.', 'error'); return;
      }
      if (nueva !== $('temporal-repetir').value) { mensaje('temporal', 'Las contraseñas nuevas no coinciden.', 'error'); return; }
      if (actual === nueva) { mensaje('temporal', 'Elija una contraseña diferente de la temporal.', 'error'); return; }
      ocupado(form, true); cancelar.disabled = true; mensaje('temporal', '', 'info');
      try {
        var r = await P.db.functions.invoke('portal2027-cambiar-clave', { body: { claveActual: actual, claveNueva: nueva } });
        if (r.error || !r.data || !r.data.ok) { throw await errorFuncion(r); }
        form.reset();
        await salir();
        mensaje('login', 'Contraseña guardada. Entre con su nueva contraseña personal.', 'ok');
      } catch (e) {
        mensaje('temporal', textoError(e), 'error');
      } finally { ocupado(form, false); cancelar.disabled = false; }
    });
    var etiqueta = document.querySelector('label[for="est-cedula"]');
    if (etiqueta) { etiqueta.textContent = 'Contraseña personal o temporal'; }
    $('est-cedula').placeholder = 'Escriba su contraseña';
  }

  async function entrarEstudiante(form) {
    var grupo = form.grupo.value;
    var nombre = form.nombre.value.trim();
    var clave = form.cedula.value;
    var generico = 'No se pudo entrar. Revise su grado, su nombre y su contraseña.';
    if (!grupo || !nombre || !clave) { mensaje('login', 'Elija su grado, seleccione su nombre y escriba su contraseña.', 'error'); return; }
    if (nombre.split(/\s+/).length < 2) { mensaje('login', 'Escriba su nombre y su apellido.', 'error'); return; }

    ocupado(form, true);
    mensaje('login', '', 'info');
    try {
      var b = await P.db.functions.invoke('portal2027-buscar-estudiante', { body: { grupo: grupo, nombre: nombre } });
      if (b.error || (b.data && b.data.error)) { throw await errorFuncion(b); }
      var candidatos = (b.data && b.data.candidatos) || [];
      var entro = false;
      for (var i = 0; i < candidatos.length && !entro; i++) {
        var r = await autenticarEstudiante(candidatos[i], clave);
        if (!r.error) { entro = true; }
        else if (!credencialesIncorrectas(r.error)) { throw r.error; }
      }
      if (!entro) { form.cedula.value = ''; mensaje('login', generico, 'error'); ocupado(form, false); return; }
      form.cedula.value = '';
      await enrutar();
    } catch (e) {
      form.cedula.value = '';
      mensaje('login', textoError(e), 'error');
    }
    ocupado(form, false);
  }

  async function enrutar() {
    mostrar('cargando');
    try {
      if (await requiereCambio()) { mostrar('temporal'); return; }
    } catch (e) { mostrar('login'); mensaje('login', e.message, 'error'); return; }
    var info;
    try { info = await P.cargarSesion(); }
    catch (e) { mostrar('login'); mensaje('login', textoError(e), 'error'); return; }

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
    $('form-temporal').reset();
    $('form-login').reset();
    $('form-estudiante').reset();
    cargarEstudiantes();
    mostrar('login');
    mensaje('login', '', 'info');
  }

  function conectarFormularios() {
    $('est-grupo').addEventListener('change', cargarEstudiantes);
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
        mensaje('login', textoError(e), 'error');
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
        mensaje('recuperar', textoError(e), 'error');
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
        if (await requiereCambio()) { form.reset(); mostrar('temporal'); return; }
        var r = await P.db.auth.updateUser({ password: form.clave.value });
        if (r.error) { throw r.error; }
        form.reset();
        mensaje('nueva', 'Contraseña guardada. Entrando…', 'ok');
        await enrutar();
      } catch (e) {
        mensaje('nueva', textoError(e), 'error');
      }
      ocupado(form, false);
    });
  }

  async function iniciar() {
    prepararCambioTemporal();
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
