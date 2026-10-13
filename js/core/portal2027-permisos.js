/* portal2027-permisos.js — sesión, roles y utilidades comunes.
   La seguridad real está en las políticas RLS de la base; esto solo decide qué pantalla mostrar. */
(function () {
  'use strict';

  var P = (window.portal2027 = window.portal2027 || {});

  P.raiz = document.body.getAttribute('data-raiz') || '';

  P.ORDEN = ['administrador', 'profesor', 'consejero', 'estudiante'];
  P.ROLES = {
    administrador: { etiqueta: 'Administración', archivo: 'portal2027-admin.html' },
    profesor: { etiqueta: 'Profesor', archivo: 'portal2027-profesor.html' },
    consejero: { etiqueta: 'Consejería', archivo: 'portal2027-consejero.html' },
    estudiante: { etiqueta: 'Estudiante', archivo: 'portal2027-estudiante.html' }
  };

  P.rutaPanel = function (rol) { return new URL('pages/' + P.ROLES[rol].archivo, new URL(P.raiz, window.location.href)).href; };
  P.rutaInicio = function () { return new URL('index.html', new URL(P.raiz, window.location.href)).href; };

  P.nombreCompleto = function (perfil) {
    if (!perfil) { return ''; }
    var n = ((perfil.nombres || '') + ' ' + (perfil.apellidos || '')).trim();
    return n || perfil.correo || '';
  };

  P.traducirError = function (e) {
    var m = (e && e.message) || '';
    if (/Invalid login credentials/i.test(m)) { return 'Correo o contraseña incorrectos.'; }
    if (/Email not confirmed/i.test(m)) { return 'El correo aún no está confirmado.'; }
    if (/rate limit|too many|security purposes/i.test(m)) { return 'Demasiados intentos. Espere unos minutos e intente de nuevo.'; }
    if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) { return 'No hay conexión con el servidor. Revise su internet e intente de nuevo.'; }
    if (/different from the old|same password/i.test(m)) { return 'La contraseña nueva debe ser distinta de la anterior.'; }
    if (/row-level security|permission denied/i.test(m)) { return 'No tiene permiso para esta acción.'; }
    if (/duplicate key|already exists/i.test(m)) { return 'Ese registro ya existe.'; }
    if (/violates check constraint/i.test(m)) { return 'Algún dato no tiene el formato permitido.'; }
    if (/foreign key|still referenced/i.test(m)) { return 'No se puede completar: hay datos que dependen de este registro.'; }
    return 'Ocurrió un error: ' + (m || 'desconocido');
  };

  // Crea elementos sin usar innerHTML (los textos de la base nunca se interpretan como HTML).
  P.el = function (tag, props, hijos) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'texto') { n.textContent = v; }
      else if (k === 'clase') { n.className = v; }
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') { n[k] = v; }
      else if (k.slice(0, 2) === 'on') { n.addEventListener(k.slice(2), v); }
      else { n.setAttribute(k, v === true ? '' : v); }
    });
    (hijos || []).forEach(function (h) {
      if (h === null || h === undefined || h === false) { return; }
      n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
    });
    return n;
  };

  // Devuelve { sesion, perfil, roles } o null si no hay sesión.
  P.cargarSesion = async function () {
    var r = await P.db.auth.getSession();
    if (r.error) { throw r.error; }
    var sesion = r.data.session;
    if (!sesion) { return null; }
    var uid = sesion.user.id;
    var res = await Promise.all([
      P.db.from('portal2027_perfiles').select('id,nombres,apellidos,correo,activo').eq('id', uid).maybeSingle(),
      P.db.from('portal2027_roles_usuario').select('rol').eq('usuario_id', uid)
    ]);
    if (res[0].error) { throw res[0].error; }
    if (res[1].error) { throw res[1].error; }
    var perfil = res[0].data;
    var roles = res[1].data.map(function (x) { return x.rol; })
      .filter(function (x) { return P.ROLES[x]; })
      .sort(function (a, b) { return P.ORDEN.indexOf(a) - P.ORDEN.indexOf(b); });
    if (perfil && perfil.activo === false) { roles = []; }
    return { sesion: sesion, perfil: perfil, roles: roles };
  };

  P.cerrarSesion = async function () {
    try { await P.db.auth.signOut(); } catch (e) { /* se vuelve al inicio igualmente */ }
    window.location.replace(P.rutaInicio());
  };

  // Para las páginas internas: exige sesión y rol; si falta algo vuelve al inicio.
  P.requerirRol = async function (rol) {
    if (!P.db) { return { error: P.errorCarga }; }
    var info;
    try { info = await P.cargarSesion(); }
    catch (e) { return { error: P.traducirError(e) }; }
    if (!info || info.roles.indexOf(rol) === -1) {
      window.location.replace(P.rutaInicio());
      return null;
    }
    P.db.auth.onAuthStateChange(function (evento) {
      if (evento === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); }
    });
    return info;
  };
})();
