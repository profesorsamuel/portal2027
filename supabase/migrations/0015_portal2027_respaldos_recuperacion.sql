-- 0015_portal2027_respaldos_recuperacion.sql
-- Etapa 9 (guía), parte A: recuperar una nota desde su historial y registro de respaldos.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0014. Se puede ejecutar varias veces.
-- Aquí NO se calcula ningún promedio. Recuperar una nota usa el guardado común (portal2027_guardar_nota):
-- mismos permisos, mismo bloqueo por trimestre cerrado, misma versión y deja una fila nueva en el historial.

-- ---------- Registro de respaldos ----------
-- Anota cada copia hecha FUERA de Supabase (o ensayo de restauración) con su resultado real. Solo se agrega.
-- No guarda claves ni cadenas de conexión: solo qué se hizo, quién, cuándo y dónde quedó guardado.
create table if not exists public.portal2027_respaldos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('diaria', 'previa_importacion', 'previa_cierre', 'manual', 'storage', 'restauracion_prueba')),
  resultado     text not null check (resultado in ('exitoso', 'parcial', 'fallido')),
  responsable   text not null check (length(trim(responsable)) > 0 and length(responsable) <= 120),
  ubicacion     text not null default '' check (length(ubicacion) <= 300),   -- p. ej. "disco externo A, carpeta 2027-10"
  detalle       text not null default '' check (length(detalle) <= 1000),    -- qué falló o qué se comprobó
  tamano_bytes  bigint check (tamano_bytes is null or tamano_bytes >= 0),
  realizado_en  timestamptz not null default now(),
  registrado_por uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  registrado_en timestamptz not null default now()
);
create index if not exists portal2027_respaldos_tipo_idx on public.portal2027_respaldos (tipo, realizado_en desc);

drop trigger if exists portal2027_respaldos_inmutable on public.portal2027_respaldos;
create trigger portal2027_respaldos_inmutable before update or delete on public.portal2027_respaldos
  for each row execute function public.portal2027_historial_inmutable();

revoke all on public.portal2027_respaldos from anon;
revoke insert, update, delete, truncate, references, trigger on public.portal2027_respaldos from authenticated;
grant select on public.portal2027_respaldos to authenticated;
alter table public.portal2027_respaldos enable row level security;
drop policy if exists portal2027_respaldos_ver on public.portal2027_respaldos;
create policy portal2027_respaldos_ver on public.portal2027_respaldos
  for select to authenticated using (public.portal2027_es_admin());

-- Registrar (solo administración).
drop function if exists public.portal2027_registrar_respaldo(text, text, text, text, text, bigint, timestamptz);
create function public.portal2027_registrar_respaldo(
  p_tipo text, p_resultado text, p_responsable text,
  p_ubicacion text default null, p_detalle text default null, p_tamano bigint default null,
  p_realizado_en timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_resp text := nullif(trim(coalesce(p_responsable, '')), '');
begin
  if not public.portal2027_es_admin() then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if v_resp is null then raise exception 'Escriba quién hizo el respaldo'; end if;
  if p_realizado_en is not null and p_realizado_en > now() + interval '5 minutes' then
    raise exception 'La fecha del respaldo no puede ser futura';
  end if;
  if p_resultado in ('parcial', 'fallido') and nullif(trim(coalesce(p_detalle, '')), '') is null then
    raise exception 'Si el respaldo fue parcial o falló, describa qué ocurrió';
  end if;
  insert into public.portal2027_respaldos (tipo, resultado, responsable, ubicacion, detalle, tamano_bytes, realizado_en)
    values (p_tipo, p_resultado, left(v_resp, 120), left(coalesce(trim(p_ubicacion), ''), 300),
            left(coalesce(trim(p_detalle), ''), 1000), p_tamano, coalesce(p_realizado_en, now()))
    returning id into v_id;
  return v_id;
end $$;

-- Estado: último respaldo EXITOSO de cada tipo y último intento (sea cual sea el resultado). Solo administración.
-- Sin copia exitosa de un tipo devuelve nulo: nunca se presume que existe.
drop function if exists public.portal2027_estado_respaldos();
create function public.portal2027_estado_respaldos()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.portal2027_es_admin() then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  return (
    select coalesce(jsonb_object_agg(t.tipo, jsonb_build_object(
      'ultimo_exitoso', (select max(r.realizado_en) from public.portal2027_respaldos r where r.tipo = t.tipo and r.resultado = 'exitoso'),
      'ultimo_intento', (select max(r.realizado_en) from public.portal2027_respaldos r where r.tipo = t.tipo),
      'ultimo_resultado', (select r.resultado from public.portal2027_respaldos r where r.tipo = t.tipo order by r.realizado_en desc, r.registrado_en desc limit 1)
    )), '{}'::jsonb)
    from (values ('diaria'), ('previa_importacion'), ('previa_cierre'), ('manual'), ('storage'), ('restauracion_prueba')) as t(tipo)
  );
end $$;

-- ---------- Recuperar una nota ----------
-- Devuelve la nota al valor que tenía ANTES del cambio registrado en p_historial.
-- p_version = versión actual de la nota en la pantalla (si cambió, CONFLICTO). El motivo es obligatorio.
-- Si la columna está bloqueada, en la papelera o el trimestre está cerrado, el guardado común lo rechaza.
drop function if exists public.portal2027_recuperar_nota(uuid, integer, text);
create function public.portal2027_recuperar_nota(p_historial uuid, p_version integer, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare h record; v_motivo text := nullif(trim(coalesce(p_motivo, '')), ''); r jsonb;
begin
  select * into h from public.portal2027_historial_notas where id = p_historial;
  if not found then raise exception 'El registro del historial no existe'; end if;
  if not public.portal2027_puede_ver_evaluacion(h.evaluacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if v_motivo is null then raise exception 'Escriba el motivo de la recuperación'; end if;
  r := public.portal2027_guardar_nota(h.evaluacion_id, h.matricula_id, h.valor_anterior, p_version,
         left('Recuperación del valor anterior a la versión ' || h.version || ': ' || v_motivo, 300));
  return r;
end $$;

revoke execute on function public.portal2027_registrar_respaldo(text, text, text, text, text, bigint, timestamptz),
  public.portal2027_estado_respaldos(), public.portal2027_recuperar_nota(uuid, integer, text) from public, anon;
grant execute on function public.portal2027_registrar_respaldo(text, text, text, text, text, bigint, timestamptz),
  public.portal2027_estado_respaldos(), public.portal2027_recuperar_nota(uuid, integer, text) to authenticated;
