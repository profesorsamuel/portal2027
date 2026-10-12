// portal2027-buscar-estudiante — Edge Function PÚBLICA (desplegar con --no-verify-jwt).
// La pantalla de entrada no puede leer la lista de estudiantes (RLS), así que pregunta aquí:
//   { accion: 'grupos' }                     -> grupos del año activo (ej. 7A, 9C)
//   { grupo: '9C', nombre: 'Ana Pérez' }      -> correos de acceso de los estudiantes que coinciden
// La contraseña (la cédula) NUNCA pasa por aquí: el navegador la verifica directamente con Supabase Auth.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Minúsculas, sin tildes ni signos: "María  José" -> ["maria", "jose"]
const palabras = (t: string) =>
  String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let cuerpo: { accion?: string; grupo?: string; nombre?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Solicitud no válida' }, 400); }

  const { data: anio } = await servicio.from('portal2027_anios').select('id').eq('activo', true).maybeSingle();
  if (!anio) return responder({ grupos: [], candidatos: [] });

  if (cuerpo.accion === 'grupos') {
    const { data } = await servicio.from('portal2027_salones').select('nombre, grado, seccion').eq('anio_id', anio.id);
    const grupos = (data || [])
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
      .map((s) => s.nombre);
    return responder({ grupos });
  }

  // Búsqueda por grupo + nombre. Se exigen al menos dos palabras (nombre y apellido).
  const grupo = String(cuerpo.grupo || '').trim().toUpperCase();
  const pedidas = palabras(cuerpo.nombre || '');
  if (!grupo || pedidas.length < 2) return responder({ candidatos: [] });

  const { data: salon } = await servicio.from('portal2027_salones').select('id')
    .eq('anio_id', anio.id).eq('nombre', grupo).maybeSingle();
  if (!salon) return responder({ candidatos: [] });

  const { data: mats } = await servicio.from('portal2027_matriculas')
    .select('estudiante:portal2027_estudiantes(nombres, apellidos, usuario_id)')
    .eq('salon_id', salon.id).eq('estado', 'activo').limit(2000);

  const idsCoinciden: string[] = [];
  for (const m of (mats || []) as any[]) {
    const e = m.estudiante;
    if (!e || !e.usuario_id) continue; // sin acceso creado todavía
    const suyas = palabras(e.nombres + ' ' + e.apellidos);
    if (pedidas.every((p) => suyas.includes(p))) idsCoinciden.push(e.usuario_id);
  }
  if (idsCoinciden.length === 0) return responder({ candidatos: [] });

  const { data: perfiles } = await servicio.from('portal2027_perfiles').select('correo, activo')
    .in('id', idsCoinciden.slice(0, 5));
  const candidatos = (perfiles || []).filter((p) => p.activo && p.correo).map((p) => p.correo);
  return responder({ candidatos });
});
