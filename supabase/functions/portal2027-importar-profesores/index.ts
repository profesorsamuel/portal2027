// portal2027-importar-profesores — Edge Function (servidor), solo administración.
// Recibe { profesores: [{ nombres, apellidos, telefono, correo, clave, materias[], grupos[] }] }.
// Por cada fila: crea (o localiza) la cuenta, guarda nombre y teléfono en el perfil, da el rol profesor,
// crea las materias que falten y, si vienen grupos, crea las asignaciones del año activo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DOMINIO = 'docentes.portal2027.app'; // correo interno cuando el profesor no tiene uno propio
const MAX_LOTE = 100;
const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const clave = (t: string) => sinTildes(String(t || '')).toLowerCase().replace(/\s+/g, ' ').trim();
const correoDerivado = (nombres: string, apellidos: string) =>
  sinTildes(`${nombres} ${apellidos}`).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') + '@' + DOMINIO;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u, error: eu } = await servicio.auth.getUser(token);
  if (eu || !u?.user) return responder({ error: 'Sesión no válida' }, 401);

  const { data: perfilAdmin } = await servicio.from('portal2027_perfiles').select('activo').eq('id', u.user.id).maybeSingle();
  const { data: rolAdmin } = await servicio.from('portal2027_roles_usuario').select('rol')
    .eq('usuario_id', u.user.id).eq('rol', 'administrador').maybeSingle();
  if (!perfilAdmin?.activo || !rolAdmin) return responder({ error: 'Solo la administración puede importar profesores' }, 403);

  let cuerpo: { profesores?: any[] };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Solicitud no válida' }, 400); }
  const filas = cuerpo.profesores;
  if (!Array.isArray(filas) || filas.length === 0) return responder({ error: 'No hay profesores para importar' }, 400);
  if (filas.length > MAX_LOTE) return responder({ error: 'Máximo ' + MAX_LOTE + ' por envío' }, 400);

  // Materias existentes y grupos del año activo, una sola vez.
  const { data: mats } = await servicio.from('portal2027_materias').select('id,nombre');
  const materias = new Map<string, string>((mats || []).map((m: any) => [clave(m.nombre), m.id]));
  const { data: anio } = await servicio.from('portal2027_anios').select('id,anio').eq('activo', true).maybeSingle();
  const salones = new Map<string, string>();
  if (anio) {
    const { data: ss } = await servicio.from('portal2027_salones').select('id,nombre').eq('anio_id', anio.id);
    (ss || []).forEach((s: any) => salones.set(String(s.nombre).toUpperCase(), s.id));
  }

  const resultados: any[] = [];

  for (const f of filas) {
    const nombres = String(f?.nombres || '').trim();
    const apellidos = String(f?.apellidos || '').trim();
    const telefono = String(f?.telefono || '').trim();
    const listaMaterias: string[] = (Array.isArray(f?.materias) ? f.materias : []).map((x: any) => String(x).trim()).filter(Boolean);
    const listaGrupos: string[] = (Array.isArray(f?.grupos) ? f.grupos : []).map((x: any) => String(x).trim().toUpperCase()).filter(Boolean);
    const consejeria: string[] = (Array.isArray(f?.consejeria) ? f.consejeria : []).map((x: any) => String(x).trim().toUpperCase()).filter(Boolean);
    const esConsejero = !!f?.es_consejero;
    const etiqueta = `${apellidos ? apellidos + ', ' : ''}${nombres}`;
    const fallo = (detalle: string, correo = '') => resultados.push({ nombre: etiqueta, correo, estado: 'error', detalle });

    if (!nombres) { fallo('Falta el nombre'); continue; }
    const correo = (String(f?.correo || '').trim().toLowerCase()) || correoDerivado(nombres, apellidos);
    if (!RE_CORREO.test(correo)) { fallo('Correo no válido', correo); continue; }
    const claveIngreso = String(f?.clave || '').trim() || telefono.replace(/\D/g, '');

    // ¿Ya tiene cuenta?
    const { data: previo } = await servicio.from('portal2027_perfiles').select('id').ilike('correo', correo).maybeSingle();
    let uid = previo?.id as string | undefined;
    let estado: 'creado' | 'actualizado' = 'actualizado';

    if (!uid) {
      if (claveIngreso.length < 6) { fallo('Sin contraseña: escriba un teléfono de 6 o más cifras o una contraseña', correo); continue; }
      const { data: nuevo, error: ec } = await servicio.auth.admin.createUser({
        email: correo, password: claveIngreso, email_confirm: true,
        user_metadata: { nombres, apellidos },
      });
      if (ec || !nuevo?.user) { fallo('No se pudo crear la cuenta: ' + (ec?.message || 'error'), correo); continue; }
      uid = nuevo.user.id;
      estado = 'creado';
    } else if (String(f?.clave || '').trim().length >= 6) {
      await servicio.auth.admin.updateUserById(uid, { password: String(f.clave).trim() });
    }

    const { error: ep } = await servicio.from('portal2027_perfiles')
      .update({ nombres, apellidos, telefono, activo: true }).eq('id', uid);
    if (ep) { fallo('Cuenta lista pero no se guardó el perfil (¿ejecutó la migración 0019?): ' + ep.message, correo); continue; }

    const { error: er } = await servicio.from('portal2027_roles_usuario')
      .upsert({ usuario_id: uid, rol: 'profesor', asignado_por: u.user.id }, { onConflict: 'usuario_id,rol', ignoreDuplicates: true });
    if (er) { fallo('Cuenta lista pero sin rol profesor: ' + er.message, correo); continue; }

    // Consejería: rol consejero y, si trae grupos, su asignación como consejero del grupo (año activo).
    const avisos: string[] = [];
    let consejerias = 0;
    if (esConsejero) {
      const { error: ec2 } = await servicio.from('portal2027_roles_usuario')
        .upsert({ usuario_id: uid, rol: 'consejero', asignado_por: u.user.id }, { onConflict: 'usuario_id,rol', ignoreDuplicates: true });
      if (ec2) avisos.push('rol consejero: ' + ec2.message);
      else for (const g of consejeria) {
        if (!anio) { avisos.push('no hay año activo: no se asignó consejería'); break; }
        const salonId = salones.get(g);
        if (!salonId) { avisos.push('consejería: el grupo ' + g + ' no existe en ' + anio.anio); continue; }
        const { error: ek } = await servicio.from('portal2027_consejeros_salon')
          .upsert({ salon_id: salonId, consejero_id: uid }, { onConflict: 'salon_id,consejero_id', ignoreDuplicates: true });
        if (ek) avisos.push('consejería ' + g + ': ' + ek.message); else consejerias++;
      }
    }

    // Materias (se crean las que falten).
    const idsMaterias: string[] = [];
    for (const m of listaMaterias) {
      let id = materias.get(clave(m));
      if (!id) {
        const { data: creada, error: em } = await servicio.from('portal2027_materias').insert({ nombre: m }).select('id').single();
        if (em || !creada) { avisos.push('materia «' + m + '»: ' + (em?.message || 'error')); continue; }
        id = creada.id; materias.set(clave(m), id!);
      }
      idsMaterias.push(id!);
    }

    // Asignaciones: grupos × materias, en el año activo.
    let asignadas = 0;
    if (listaGrupos.length) {
      if (!anio) avisos.push('no hay año activo: no se crearon asignaciones');
      else for (const g of listaGrupos) {
        const salonId = salones.get(g);
        if (!salonId) { avisos.push('el grupo ' + g + ' no existe en ' + anio.anio); continue; }
        for (const mid of idsMaterias) {
          const { error: ea } = await servicio.from('portal2027_asignaciones')
            .upsert({ salon_id: salonId, materia_id: mid, profesor_id: uid }, { onConflict: 'salon_id,materia_id,profesor_id', ignoreDuplicates: true });
          if (ea) avisos.push('asignación ' + g + ': ' + ea.message); else asignadas++;
        }
      }
    }

    resultados.push({ nombre: etiqueta, correo, estado, asignadas, consejerias, detalle: avisos.join('; ') });
  }

  return responder({ ok: true, resultados });
});
