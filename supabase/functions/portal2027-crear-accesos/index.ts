// portal2027-crear-accesos — Edge Function (servidor), solo administración.
// Recibe { accesos: [{ codigo, cedula }] }. Para cada estudiante crea (o actualiza) una cuenta
// cuyo correo interno se deriva del código y cuya contraseña es la cédula. La cédula no se guarda
// en ninguna tabla: Supabase Auth solo conserva su hash. Tampoco se devuelve en la respuesta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DOMINIO = 'estudiantes.portal2027.app'; // dominio interno; no recibe correos
const MAX_LOTE = 200;

// Misma regla que en la pantalla de entrada: solo letras y números, en mayúsculas.
// "8-123-456" y "8123456" dan la misma contraseña.
const normalizarCedula = (c: string) => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const correoDe = (codigo: string) => codigo.toLowerCase().replace(/[^a-z0-9]/g, '') + '@' + DOMINIO;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u, error: eu } = await servicio.auth.getUser(token);
  if (eu || !u?.user) return responder({ error: 'Sesión no válida' }, 401);

  const { data: perfil } = await servicio.from('portal2027_perfiles').select('activo').eq('id', u.user.id).maybeSingle();
  const { data: rol } = await servicio.from('portal2027_roles_usuario').select('rol')
    .eq('usuario_id', u.user.id).eq('rol', 'administrador').maybeSingle();
  if (!perfil?.activo || !rol) return responder({ error: 'Solo la administración puede crear accesos' }, 403);

  let cuerpo: { accesos?: { codigo?: string; cedula?: string }[] };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Solicitud no válida' }, 400); }
  const accesos = cuerpo.accesos;
  if (!Array.isArray(accesos) || accesos.length === 0) return responder({ error: 'No hay accesos para crear' }, 400);
  if (accesos.length > MAX_LOTE) return responder({ error: 'Máximo ' + MAX_LOTE + ' por envío' }, 400);

  const resultados: { codigo: string; estado: 'creado' | 'actualizado' | 'error'; detalle?: string }[] = [];

  for (const a of accesos) {
    const codigo = String(a?.codigo || '').trim();
    const clave = normalizarCedula(a?.cedula || '');
    const fallo = (detalle: string) => resultados.push({ codigo, estado: 'error', detalle });

    if (!codigo) { fallo('Falta el código'); continue; }
    if (clave.length < 6) { fallo('Cédula vacía o demasiado corta (mínimo 6 letras o números)'); continue; }

    const { data: ficha } = await servicio.from('portal2027_estudiantes')
      .select('id, nombres, apellidos, usuario_id').ilike('codigo', codigo).maybeSingle();
    if (!ficha) { fallo('No existe un estudiante con ese código'); continue; }

    // Ya tiene cuenta: solo se actualiza la contraseña.
    if (ficha.usuario_id) {
      const { error } = await servicio.auth.admin.updateUserById(ficha.usuario_id, { password: clave });
      if (error) { fallo('No se pudo actualizar: ' + error.message); continue; }
      resultados.push({ codigo, estado: 'actualizado' });
      continue;
    }

    const { data: nuevo, error: ec } = await servicio.auth.admin.createUser({
      email: correoDe(codigo),
      password: clave,
      email_confirm: true,
      user_metadata: { nombres: ficha.nombres, apellidos: ficha.apellidos },
    });
    if (ec || !nuevo?.user) { fallo('No se pudo crear la cuenta: ' + (ec?.message || 'error')); continue; }
    const uid = nuevo.user.id;

    const { error: e1 } = await servicio.from('portal2027_estudiantes')
      .update({ usuario_id: uid, invitado_en: new Date().toISOString() }).eq('id', ficha.id);
    if (e1) { fallo('Cuenta creada pero no se pudo vincular: ' + e1.message); continue; }
    const { error: e2 } = await servicio.from('portal2027_roles_usuario')
      .upsert({ usuario_id: uid, rol: 'estudiante', asignado_por: u.user.id }, { onConflict: 'usuario_id,rol', ignoreDuplicates: true });
    if (e2) { fallo('Cuenta vinculada pero sin rol: ' + e2.message); continue; }
    resultados.push({ codigo, estado: 'creado' });
  }

  return responder({ ok: true, resultados });
});
