// Control común del servidor. Cada función debe llamarlo antes de operar.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export const PORTAL2027_ORIGEN = Deno.env.get('PORTAL2027_ORIGEN') || 'https://profesorsamuel.github.io';
if (new URL(PORTAL2027_ORIGEN).origin !== PORTAL2027_ORIGEN || !PORTAL2027_ORIGEN.startsWith('https://')) {
  throw new Error('PORTAL2027_ORIGEN debe ser un origen HTTPS sin ruta ni barra final.');
}

export const PORTAL2027_CORS = {
  'Access-Control-Allow-Origin': PORTAL2027_ORIGEN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
};

export function responderPortal(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado, headers: { ...PORTAL2027_CORS, 'Content-Type': 'application/json' },
  });
}

// CORS es un control del navegador; no sustituye la comprobación de sesión y rol.
// Retorna una respuesta para solicitudes rechazadas/preflight, o null para POST.
export function comprobarSolicitudPortal(req: Request) {
  const origen = req.headers.get('Origin');
  if (origen && origen !== PORTAL2027_ORIGEN) {
    return responderPortal({ error: 'Origen no permitido.' }, 403);
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: PORTAL2027_CORS });
  if (req.method !== 'POST') return responderPortal({ error: 'Método no permitido.' }, 405);
  return null;
}

// Nunca toma el ID o el rol del cuerpo enviado por el navegador.
// Usa getUser para leer el indicador actualizado del servidor, no un JWT antiguo.
export async function comprobarAdministradorPortal(req: Request, servicio: SupabaseClient) {
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return { usuario: null, respuesta: responderPortal({ error: 'Inicie sesión para continuar.' }, 401) };
    const { data, error } = await servicio.auth.getUser(token);
    if (error || !data?.user) {
      return { usuario: null, respuesta: responderPortal({ error: 'Su sesión venció. Inicie sesión nuevamente.' }, 401) };
    }
    const usuario = data.user;
    if (usuario.app_metadata?.portal2027_requiere_cambio_clave === true) {
      return { usuario: null, respuesta: responderPortal({ error: 'Debe cambiar su contraseña temporal antes de continuar.' }, 403) };
    }
    const { data: perfil, error: ep } = await servicio.from('portal2027_perfiles')
      .select('activo').eq('id', usuario.id).maybeSingle();
    if (ep) throw ep;
    const { data: rol, error: er } = await servicio.from('portal2027_roles_usuario')
      .select('rol').eq('usuario_id', usuario.id).eq('rol', 'administrador').maybeSingle();
    if (er) throw er;
    if (!perfil?.activo || !rol) {
      return { usuario: null, respuesta: responderPortal({ error: 'Solo la administración activa puede realizar esta acción.' }, 403) };
    }
    return { usuario, respuesta: null };
  } catch (error) {
    // No registra token, correo, cuerpo ni contraseñas.
    console.error('portal2027: no se pudieron comprobar permisos', error instanceof Error ? error.name : 'Error de consulta');
    return { usuario: null, respuesta: responderPortal({ error: 'No se pudo comprobar su permiso. Inténtelo más tarde.' }, 500) };
  }
}
