// portal2027-buscar-estudiante — Edge Function PÚBLICA (desplegar con --no-verify-jwt).
// La pantalla de entrada no puede leer la lista de estudiantes (RLS), así que pregunta aquí:
//   { accion: 'grupos' }                     -> grupos del año activo (ej. 7A, 9C)
//   { grupo: '9C', nombre: 'Ana Pérez' }      -> correos de acceso de los estudiantes que coinciden
// La contraseña NUNCA pasa por aquí: el navegador la verifica directamente con Supabase Auth.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { comprobarSolicitudPortal, responderPortal as responder } from '../_shared/portal2027-seguridad.ts';

import { consumirIntentoPortal } from '../_shared/portal2027-intentos.ts';

// Solo para Supabase hospedado: toma el último salto añadido por el gateway.
// Debe volver a verificarse si se añade un proxy propio delante de Supabase.
function conexionDe(req: Request) {
  const cabecera = req.headers.get('x-forwarded-for') || '';
  if (!cabecera || cabecera.length > 4096) return null;
  const partes = cabecera.split(',');
  const ip = partes[partes.length - 1].trim();
  if (/^[0-9.]+$/.test(ip)) {
    const octetos = ip.split('.');
    if (octetos.length !== 4 || octetos.some(x => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
    return octetos.map(x => String(Number(x))).join('.');
  }
  if (/^[a-f0-9:]+$/i.test(ip) && ip.includes(':')) {
    try { return new URL('https://[' + ip + ']/').hostname.toLowerCase(); } catch { return null; }
  }
  return null;
}

// Minúsculas, sin tildes ni signos: "María  José" -> ["maria", "jose"]
const palabras = (t: string) =>
  String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean);

Deno.serve(async (req) => {
  const rechazo = comprobarSolicitudPortal(req);
  if (rechazo) return rechazo;

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const conexion = conexionDe(req);
  if (!conexion) {
    console.error('portal2027-buscar-estudiante: falta dirección válida del gateway');
    return responder({ error: 'No se pudo comprobar su conexión. Inténtelo más tarde.' }, 503);
  }
  const limiteConexion = await consumirIntentoPortal(servicio, 'buscar_ip', conexion);
  if (limiteConexion) return limiteConexion;

  let cuerpo: { accion?: string; grupo?: string; nombre?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Solicitud no válida' }, 400); }

  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      (cuerpo.grupo !== undefined && (typeof cuerpo.grupo !== 'string' || cuerpo.grupo.length > 30)) ||
      (cuerpo.nombre !== undefined && (typeof cuerpo.nombre !== 'string' || cuerpo.nombre.length > 200))) {
    return responder({ error: 'Revise el grado y el nombre e inténtelo nuevamente.' }, 400);
  }
  if (cuerpo.accion !== 'grupos' && cuerpo.accion !== 'estudiantes') {
    const grupoControl = String(cuerpo.grupo || '').trim().toUpperCase();
    const nombreControl = Array.from(new Set(palabras(cuerpo.nombre || ''))).sort().join(' ');
    if (grupoControl && nombreControl) {
      const limiteNombre = await consumirIntentoPortal(servicio, 'buscar_nombre',
        JSON.stringify([conexion, grupoControl, nombreControl]));
      if (limiteNombre) return limiteNombre;
    }
  }

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
  if (!grupo || (cuerpo.accion !== 'estudiantes' && pedidas.length < 2)) return responder({ candidatos: [] });

  const { data: salon } = await servicio.from('portal2027_salones').select('id')
    .eq('anio_id', anio.id).eq('nombre', grupo).maybeSingle();
  if (!salon) return responder({ candidatos: [] });

  const { data: mats, error: errorMatriculas } = await servicio.from('portal2027_matriculas')
    .select('estudiante:portal2027_estudiantes(nombres, apellidos, usuario_id)')
    .eq('salon_id', salon.id).eq('estado', 'activo').limit(2000);

  if (errorMatriculas) return responder({ error: 'No se pudo leer la matrícula del salón' }, 500);

  if (cuerpo.accion === 'estudiantes') {
    const alumnos = (mats || []).map((m: any) => m.estudiante).filter((e: any) => e && e.usuario_id);
    if (!alumnos.length) return responder({ estudiantes: [] });
    const { data: cuentas, error } = await servicio.from('portal2027_perfiles')
      .select('id').in('id', alumnos.map((e: any) => e.usuario_id)).eq('activo', true);
    if (error) return responder({ error: 'No se pudieron leer las cuentas de estudiantes' }, 500);
    const activos = new Set((cuentas || []).map((c) => c.id));
    // Solo nombres: nunca cédulas, teléfonos, correos ni contraseñas.
    const estudiantes = alumnos.filter((e: any) => activos.has(e.usuario_id))
      .map((e: any) => ({ nombre: [e.nombres, e.apellidos].filter(Boolean).join(' ').trim() }))
      .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, 'es'));
    return responder({ estudiantes });
  }

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
