/* portal2027-conexion.js — conexión con Supabase (proyecto meduca2027).
   Aquí solo van la URL y la clave PUBLICABLE (pública por diseño).
   Nunca ponga en este archivo la clave secret ni service_role. */
(function () {
  'use strict';

  var CONFIG = {
    url: 'https://gwxghgpsgvaletrqmwcn.supabase.co',
    clavePublicable: 'sb_publishable_WVj76515YeMpQYDTmHFn5g_AggPu3rx'
  };

  var P = (window.portal2027 = window.portal2027 || {});

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    P.db = null;
    P.errorCarga = 'No se pudo cargar la biblioteca de conexión. Revise su internet y recargue la página.';
    return;
  }

  P.db = window.supabase.createClient(CONFIG.url, CONFIG.clavePublicable, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'portal2027_sesion'
    }
  });
})();
