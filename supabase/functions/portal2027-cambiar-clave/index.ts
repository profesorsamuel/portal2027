// Cambia exclusivamente la contraseña temporal de la cuenta autenticada.
// Recibe { claveActual, claveNueva }. Nunca recibe un ID de otra cuenta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const ORIGEN = Deno.env.get('PORTAL2027_ORIGEN') || 'https://profesorsamuel.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ORIGEN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
};
const responder = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { ...CORS, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin');
  if (origen && origen !== ORIGEN) return responder({ error: 'Origen no permitido.' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const servicioKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !servicioKey || !anonKey) throw new Error('Falta configuración del servidor.');
    const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
    const servicio = createClient(url, servicioKey, opciones);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return responder({ error: 'Inicie sesión nuevamente.' }, 401);
    const { data, error } = await servicio.auth.getUser(token);
    if (error || !data?.user) return responder({ error: 'Su sesión venció. Inicie sesión nuevamente.' }, 401);
    const usuario = data.user;

    const { data: perfil, error: ep } = await servicio.from('portal2027_perfiles')
      .select('activo').eq('id', usuario.id).maybeSingle();
    if (ep) throw ep;
    const { data: rol, error: er } = await servicio.from('portal2027_roles_usuario')
      .select('rol').eq('usuario_id', usuario.id).eq('rol', 'estudiante').maybeSingle();
    if (er) throw er;
    if (!perfil?.activo || !rol) return responder({ error: 'Esta cuenta no tiene acceso de estudiante activo.' }, 403);
    if (usuario.app_metadata?.portal2027_requiere_cambio_clave !== true) {
      return responder({ error: 'Esta cuenta no tiene un cambio de contraseña temporal pendiente.' }, 409);
    }

    let cuerpo;
    try { cuerpo = await req.json(); } catch { return responder({ error: 'Solicitud no válida.' }, 400); }
    const actual = cuerpo?.claveActual;
    const nueva = cuerpo?.claveNueva;
    if (typeof actual !== 'string' || !actual || actual.length > 128 ||
        typeof nueva !== 'string' || nueva.length < 12 || nueva.length > 128 ||
        !/[A-Za-z]/.test(nueva) || !/[0-9]/.test(nueva)) {
      return responder({ error: 'Use una contraseña nueva de 12 a 128 caracteres, con letras y números.' }, 400);
    }
    if (actual === nueva) return responder({ error: 'La contraseña nueva debe ser diferente de la temporal.' }, 400);
    if (!usuario.email) return responder({ error: 'Pida al docente que revise su cuenta.' }, 409);

    // Comprueba la contraseña actual con Auth antes de usar privilegios del servidor.
    const acceso = createClient(url, anonKey, opciones);
    const { data: verificada, error: ev } = await acceso.auth.signInWithPassword({ email: usuario.email, password: actual });
    if (ev || verificada?.user?.id !== usuario.id) {
      if (ev?.status === 429) return responder({ error: 'Demasiados intentos. Espere unos minutos y vuelva a intentarlo.' }, 429);
      return responder({ error: 'La contraseña temporal no es correcta.' }, 400);
    }
    // Cierra únicamente la sesión adicional creada para la comprobación.
    const { error: es } = await acceso.auth.signOut({ scope: 'local' });
    if (es) throw es;

    const { error: ec } = await servicio.auth.admin.updateUserById(usuario.id, {
      password: nueva,
      app_metadata: { ...usuario.app_metadata, portal2027_requiere_cambio_clave: false },
    });
    if (ec) {
      console.error('portal2027-cambiar-clave: actualización rechazada', ec.code, ec.status);
      return responder({ error: 'No se pudo guardar la contraseña. Pruebe otra clave o consulte al docente.' }, 400);
    }
    return responder({ ok: true, mensaje: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.' });
  } catch (error) {
    console.error('portal2027-cambiar-clave: fallo del servidor', error instanceof Error ? error.name : 'Error');
    return responder({ error: 'No se pudo cambiar la contraseña. Inténtelo más tarde.' }, 500);
  }
});
