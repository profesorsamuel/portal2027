// portal2027-invitar-estudiante — Edge Function (servidor).
// Valida en el servidor que quien llama es administrador activo, invita al correo de la ficha
// (o vincula una cuenta ya existente) y le da el rol estudiante.
// Usa la clave service_role que Supabase inyecta como secreto de la función; nunca va al navegador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { comprobarSolicitudPortal, comprobarAdministradorPortal, responderPortal as responder } from '../_shared/portal2027-seguridad.ts';

Deno.serve(async (req) => {
  const rechazo = comprobarSolicitudPortal(req);
  if (rechazo) return rechazo;

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const permiso = await comprobarAdministradorPortal(req, servicio);
  if (permiso.respuesta) return permiso.respuesta;
  const usuario = permiso.usuario;
  if (!usuario) return responder({ error: 'Inicie sesión nuevamente.' }, 401);

  // 3. Ficha válida, con correo y sin cuenta vinculada.
  let cuerpo: { estudiante_id?: string; redirect_to?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Solicitud no válida' }, 400); }
  if (!cuerpo.estudiante_id) return responder({ error: 'Falta la ficha del estudiante' }, 400);

  const { data: ficha } = await servicio.from('portal2027_estudiantes')
    .select('id, nombres, apellidos, correo_estudiante, usuario_id').eq('id', cuerpo.estudiante_id).maybeSingle();
  if (!ficha) return responder({ error: 'La ficha no existe' }, 404);
  if (ficha.usuario_id) return responder({ error: 'Esta ficha ya tiene una cuenta vinculada' }, 409);
  if (!ficha.correo_estudiante) return responder({ error: 'La ficha no tiene correo; agréguelo en la importación' }, 400);

  const correo = ficha.correo_estudiante.toLowerCase();

  // 4. Si la cuenta ya existe se vincula; si no, se invita.
  const { data: existente } = await servicio.from('portal2027_perfiles').select('id').ilike('correo', correo).maybeSingle();
  let usuarioId = existente?.id as string | undefined;
  let accion = 'vinculada';

  if (!usuarioId) {
    const destino = typeof cuerpo.redirect_to === 'string' && /^https:\/\/[^\s]+$/.test(cuerpo.redirect_to)
      ? cuerpo.redirect_to : undefined;
    const { data: inv, error: ei } = await servicio.auth.admin.inviteUserByEmail(correo, {
      redirectTo: destino,
      data: { nombres: ficha.nombres, apellidos: ficha.apellidos },
    });
    if (ei || !inv?.user) return responder({ error: 'No se pudo enviar la invitación: ' + (ei?.message || 'error') }, 400);
    usuarioId = inv.user.id;
    accion = 'invitada';
  }

  // 5. Otra ficha no puede tener ya esa cuenta.
  const { data: otra } = await servicio.from('portal2027_estudiantes').select('id').eq('usuario_id', usuarioId).maybeSingle();
  if (otra && otra.id !== ficha.id) return responder({ error: 'Esa cuenta ya está vinculada a otra ficha' }, 409);

  const { error: e1 } = await servicio.from('portal2027_estudiantes')
    .update({ usuario_id: usuarioId, invitado_en: new Date().toISOString() }).eq('id', ficha.id);
  if (e1) return responder({ error: 'No se pudo vincular: ' + e1.message }, 500);
  const { error: e2 } = await servicio.from('portal2027_roles_usuario')
    .upsert({ usuario_id: usuarioId, rol: 'estudiante', asignado_por: usuario.id }, { onConflict: 'usuario_id,rol', ignoreDuplicates: true });
  if (e2) return responder({ error: 'Vinculada, pero no se pudo asignar el rol: ' + e2.message }, 500);

  return responder({ ok: true, accion, correo });
});
