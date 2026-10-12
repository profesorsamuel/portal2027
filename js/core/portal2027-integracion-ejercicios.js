/* portal2027-integracion-ejercicios.js — contrato entre las páginas de juego (pages/ejercicios/) y el portal.
   Ver docs/portal2027-integracion-ejercicios.md.
   El juego SOLO puede: (1) iniciarEjercicio y (2) guardarIntento. Nunca escribe notas finales: la libreta se
   alimenta únicamente cuando el profesor consolida el periodo. Aquí no se calcula ningún promedio. */
(function () {
  'use strict';

  var P = window.portal2027;
  var db = P.db;

  var MENSAJES = [
    [/Failed to fetch|NetworkError|network|Load failed/i, 'No hay conexión con el servidor. El intento NO se guardó; puede reintentar.'],
    [/row-level security|permission denied/i, 'No tiene permiso para este ejercicio.']
  ];
  function textoError(e) {
    var m = (e && e.message) || '';
    for (var i = 0; i < MENSAJES.length; i++) { if (MENSAJES[i][0].test(m)) { return MENSAJES[i][1]; } }
    if (/periodo está cerrado|trimestre está cerrado|ya no está disponible|equipo|entre 0 y 5|clave de envío/i.test(m)) { return m; }
    return P.traducirError(e);
  }

  var E = (P.ejercicios = {});

  // Lista de ejercicios del estudiante en un trimestre (sin nombres de compañeros).
  E.misEjercicios = async function (trimestreId) {
    try {
      var r = await db.rpc('portal2027_mis_ejercicios', { p_trimestre: trimestreId });
      if (r.error) { throw r.error; }
      return { ok: true, ejercicios: r.data || [] };
    } catch (e) { return { ok: false, error: textoError(e) }; }
  };

  // Antes de jugar. Devuelve { ok, puedeJugar, motivo, claveEnvio, cuentaNota, mejorNota, ... }. No guarda nada.
  E.iniciarEjercicio = async function (ejercicioId) {
    try {
      var r = await db.rpc('portal2027_iniciar_ejercicio', { p_ejercicio: ejercicioId });
      if (r.error) { throw r.error; }
      var d = r.data;
      return {
        ok: true, puedeJugar: !!d.puede_jugar, motivo: d.motivo || null, claveEnvio: d.clave_envio,
        ejercicioId: d.ejercicio_id, titulo: d.titulo, juego: d.juego, modo: d.modo, cuentaNota: !!d.cuenta_nota,
        participacion: d.participacion, tamanoEquipo: d.tamano_equipo, mejorNota: d.mejor_nota === null ? null : Number(d.mejor_nota)
      };
    } catch (e) { return { ok: false, error: textoError(e) }; }
  };

  // Al terminar. Reenviar con la MISMA claveEnvio es seguro: no crea otro intento.
  // ok:true solo cuando la base confirmó. Si falla la red, ok:false y se puede reintentar con la misma clave.
  E.guardarIntento = async function (ejercicioId, claveEnvio, nota) {
    var n = Number(nota);
    if (!isFinite(n) || n < 0 || n > 5) { return { ok: false, error: 'La nota debe estar entre 0 y 5.' }; }
    try {
      var r = await db.rpc('portal2027_guardar_intento', { p_ejercicio: ejercicioId, p_clave: claveEnvio, p_nota: n });
      if (r.error) { throw r.error; }
      var d = r.data;
      return { ok: true, repetido: !!d.repetido, cuentaNota: !!d.cuenta_nota, intentos: d.intentos || null,
        mejorNota: d.mejor_nota === null ? null : Number(d.mejor_nota) };
    } catch (e) { return { ok: false, error: textoError(e) }; }
  };
})();
