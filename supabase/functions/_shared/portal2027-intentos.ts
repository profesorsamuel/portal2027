// Contador compartido. El identificador debe construirse en el servidor;
// nunca aceptar un hash o una clave de control enviados por el navegador.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { responderPortal } from './portal2027-seguridad.ts';

type Ambito = 'buscar_ip' | 'buscar_nombre' | 'cambiar_clave';

export async function consumirIntentoPortal(servicio: SupabaseClient, ambito: Ambito, identificador: string) {
  try {
    const secreto = Deno.env.get('PORTAL2027_INTENTOS_SECRETO');
    if (!secreto || !/^[a-f0-9]{64}$/i.test(secreto)) {
      throw new Error('Falta un secreto válido para controlar solicitudes.');
    }
    if (!['buscar_ip', 'buscar_nombre', 'cambiar_clave'].includes(ambito) ||
        typeof identificador !== 'string' || !identificador || identificador.length > 2048) {
      throw new Error('Identificador de control no válido.');
    }
    const encoder = new TextEncoder();
    const clave = await crypto.subtle.importKey('raw', encoder.encode(secreto),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const firma = await crypto.subtle.sign('HMAC', clave, encoder.encode(JSON.stringify([ambito, identificador])));
    const hash = Array.from(new Uint8Array(firma), b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await servicio.rpc('portal2027_consumir_intento', {
      p_ambito: ambito, p_clave_hash: hash,
    });
    if (error) {
      console.error('portal2027: contador no disponible', error.code, error.status);
      throw new Error('Contador no disponible.');
    }
    if (!data || typeof data.permitido !== 'boolean' ||
        !Number.isInteger(data.reintentar_en) || data.reintentar_en < 0 || data.reintentar_en > 900 ||
        (!data.permitido && data.reintentar_en < 1)) {
      throw new Error('Respuesta de contador no válida.');
    }
    if (data.permitido) return null;
    const segundos = data.reintentar_en;
    const espera = segundos < 60 ? segundos + ' segundos' : Math.ceil(segundos / 60) + ' minutos';
    const respuesta = responderPortal({
      error: 'Demasiados intentos. Espere ' + espera + ' y vuelva a intentarlo.',
      reintentar_en: segundos,
    }, 429);
    respuesta.headers.set('Retry-After', String(segundos));
    respuesta.headers.set('Access-Control-Expose-Headers', 'Retry-After');
    return respuesta;
  } catch (error) {
    // Nunca registra el secreto ni el identificador original.
    console.error('portal2027: control de solicitudes interrumpido', error instanceof Error ? error.name : 'Error');
    return responderPortal({ error: 'No se pudo comprobar el acceso. Inténtelo más tarde.' }, 503);
  }
}
