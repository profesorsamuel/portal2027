-- 0033_portal2027_calendario.sql
-- Calendario de clases: días sin clases y opción de bloques dobles.
-- Requiere 0032. Se puede ejecutar varias veces sin dañar nada.
-- Las fechas del trimestre ya existen (portal2027_trimestres.fecha_inicio / fecha_fin).
-- Las fechas de clase NO se guardan: el portal las calcula a partir del horario, las fechas del
-- trimestre y los días sin clases, así que cambiar el horario o un feriado se refleja solo.

-- ---------- Días sin clases ----------
-- profesor_id nulo = todo el colegio (feriado, jornada; solo administración).
-- profesor_id con valor = solo para las clases de ese profesor.
create table if not exists public.portal2027_dias_sin_clases (
  id          uuid primary key default gen_random_uuid(),
  anio_id     uuid not null references public.portal2027_anios (id) on delete cascade,
  fecha       date not null,
  motivo      text not null check (length(trim(motivo)) between 1 and 80),
  profesor_id uuid references public.portal2027_perfiles (id) on delete cascade,
  creado_por  uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en   timestamptz not null default now()
);
create unique index if not exists portal2027_dias_sin_clases_unico
  on public.portal2027_dias_sin_clases (anio_id, fecha, coalesce(profesor_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.portal2027_dias_sin_clases enable row level security;
drop policy if exists portal2027_dias_sin_clases_ver on public.portal2027_dias_sin_clases;
create policy portal2027_dias_sin_clases_ver on public.portal2027_dias_sin_clases for select to authenticated
  using (
    public.portal2027_es_admin()
    or (public.portal2027_tiene_rol('profesor') and (profesor_id is null or profesor_id = auth.uid()))
  );
revoke all on public.portal2027_dias_sin_clases from public, anon, authenticated;
grant select on public.portal2027_dias_sin_clases to authenticated;

-- ---------- Bloques dobles: ¿una sesión o dos? (por asignación) ----------
create table if not exists public.portal2027_calendario_opciones (
  asignacion_id  uuid primary key references public.portal2027_asignaciones (id) on delete cascade,
  bloque_doble   text not null default 'una' check (bloque_doble in ('una', 'dos')),
  actualizado_en timestamptz not null default now()
);
alter table public.portal2027_calendario_opciones enable row level security;
drop policy if exists portal2027_calendario_opciones_ver on public.portal2027_calendario_opciones;
create policy portal2027_calendario_opciones_ver on public.portal2027_calendario_opciones for select to authenticated
  using (public.portal2027_puede_editar_asignacion(asignacion_id));
revoke all on public.portal2027_calendario_opciones from public, anon, authenticated;
grant select on public.portal2027_calendario_opciones to authenticated;

-- ---------- Escritura ----------
-- Agrega un día o un rango (solo lunes a viernes). Si ya existía, actualiza el motivo.
create or replace function public.portal2027_guardar_dias_sin_clases(
  p_anio uuid, p_desde date, p_hasta date, p_motivo text, p_global boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare v_prof uuid; v_motivo text; n integer;
begin
  v_motivo := trim(coalesce(p_motivo, ''));
  if length(v_motivo) not between 1 and 80 then raise exception 'Escriba el motivo (máximo 80 caracteres)'; end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then raise exception 'Fechas inválidas: el inicio no puede ser posterior al final'; end if;
  if p_hasta - p_desde > 120 then raise exception 'El rango es demasiado largo (máximo 120 días)'; end if;
  if p_global then
    if not public.portal2027_es_admin() then
      raise exception 'No tiene permiso para esta acción (row-level security): los días de todo el colegio los define administración';
    end if;
    v_prof := null;
  else
    if not (public.portal2027_es_admin() or public.portal2027_tiene_rol('profesor')) then
      raise exception 'No tiene permiso para esta acción (row-level security)';
    end if;
    v_prof := auth.uid();
  end if;
  insert into public.portal2027_dias_sin_clases (anio_id, fecha, motivo, profesor_id)
  select p_anio, d::date, v_motivo, v_prof
  from generate_series(p_desde, p_hasta, interval '1 day') d
  where extract(isodow from d) between 1 and 5
  on conflict (anio_id, fecha, coalesce(profesor_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set motivo = excluded.motivo;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.portal2027_borrar_dia_sin_clases(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from public.portal2027_dias_sin_clases where id = p_id;
  if not found then return; end if;
  if not (public.portal2027_es_admin() or (d.profesor_id is not null and d.profesor_id = auth.uid())) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  delete from public.portal2027_dias_sin_clases where id = p_id;
end $$;

create or replace function public.portal2027_guardar_opcion_doble(p_asignacion uuid, p_valor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p_valor not in ('una', 'dos') then raise exception 'Opción no válida'; end if;
  insert into public.portal2027_calendario_opciones (asignacion_id, bloque_doble) values (p_asignacion, p_valor)
  on conflict (asignacion_id) do update set bloque_doble = excluded.bloque_doble, actualizado_en = now();
end $$;

revoke execute on function public.portal2027_guardar_dias_sin_clases(uuid, date, date, text, boolean),
  public.portal2027_borrar_dia_sin_clases(uuid), public.portal2027_guardar_opcion_doble(uuid, text) from public, anon;
grant execute on function public.portal2027_guardar_dias_sin_clases(uuid, date, date, text, boolean),
  public.portal2027_borrar_dia_sin_clases(uuid), public.portal2027_guardar_opcion_doble(uuid, text) to authenticated;
notify pgrst, 'reload schema';
