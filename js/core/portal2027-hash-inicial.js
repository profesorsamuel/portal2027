// Guarda el fragmento (#...) de la URL antes de que supabase-js lo procese
// (enlaces de recuperación de contraseña e invitación). Debe cargarse sin
// defer/async y ANTES de supabase-js; lo lee js/modulos/portal2027-acceso.js.
window.portal2027_hashInicial = window.location.hash;
