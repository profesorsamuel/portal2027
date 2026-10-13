-- 0032_portal2027_horario.sql
-- Horario semanal del profesor: día, hora de inicio y fin, y qué es cada franja
-- (clase de una asignación = grupo + materia, recreo, consejería u otro).
-- Requiere 0001, 0002 y 0006. Se puede ejecutar varias veces sin dañar nada.
-- Igual que la libreta: la tabla se LEE directamente y se ESCRIBE solo con funciones portal2027_*.

create table if not exists public.portal2027_horario (
  id             uuid primary key default gen_random_uuid(),
  anio_id        uuid not null references public.portal2027_anios (id) on delete cascade,
  profesor_id    uuid not null references public.portal2027_perfiles (id) on delete cascade,
  dia            smallint not null check (dia between 1 and 5),          -- 1 lunes … 5 viernes
  bloque         smallint not null default 1 check (bloque between 1 and 12), -- orden de la franja en ese día (lo calcula la base)
  hora_inicio    time not null,
  hora_fin       time not null,
  tipo           text not null check (tipo in ('clase', 'recreo', 'consejeria', 'otro')),
  asignacion_id  uuid references public.portal2027_asignaciones (id) on delete cascade,
  etiqueta       text not null default '' check (length(etiqueta) <= 60), -- grupo de consejería, «Almuerzo», etc.
  actualizado_en timestamptz not null default now(),
  constraint portal2027_horario_horas_validas check (hora_fin > hora_inicio),
  constraint portal2027_horario_clase_con_asignacion check ((tipo = 'clase') = (asignacion_id is not null))
);
create unique index if not exists portal2027_horario_unico
  on public.portal2027_horario (profesor_id, anio_id, dia, hora_inicio);
create index if not exists portal2027_horario_asignacion_idx on public.portal2027_horario (asignacion_id);

-- ---------- Permisos ----------
create or replace function public.portal2027_puede_gestionar_horario(p_profesor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_es_admin()
      or (p_profesor = auth.uid() and public.portal2027_tiene_rol('profesor'));
$$;
revoke execute on function public.portal2027_puede_gestionar_horario(uuid) from public, anon;
grant execute on function public.portal2027_puede_gestionar_horario(uuid) to authenticated;

alter table public.portal2027_horario enable row level security;
drop policy if exists portal2027_horario_ver on public.portal2027_horario;
create policy portal2027_horario_ver on public.portal2027_horario for select to authenticated
  using (public.portal2027_puede_gestionar_horario(profesor_id));
revoke all on public.portal2027_horario from public, anon, authenticated;
grant select on public.portal2027_horario to authenticated;

-- ---------- Validaciones ----------
create or replace function public.portal2027_validar_horario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.portal2027_roles_usuario where usuario_id = new.profesor_id and rol = 'profesor') then
    raise exception 'La persona del horario no tiene el rol profesor';
  end if;
  if new.tipo = 'clase' and not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    where a.id = new.asignacion_id and a.profesor_id = new.profesor_id and s.anio_id = new.anio_id
  ) then
    raise exception 'La asignación no es de este profesor o no es de este año';
  end if;
  if exists (
    select 1 from public.portal2027_horario h
    where h.profesor_id = new.profesor_id and h.anio_id = new.anio_id and h.dia = new.dia
      and h.id <> new.id and h.hora_inicio < new.hora_fin and h.hora_fin > new.hora_inicio
  ) then
    raise exception 'La franja se cruza con otra del mismo día';
  end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists portal2027_horario_validar on public.portal2027_horario;
create trigger portal2027_horario_validar before insert or update on public.portal2027_horario
  for each row execute function public.portal2027_validar_horario();

-- Numera las franjas de cada día por hora de inicio (1, 2, 3…). Es el «bloque» que usa la asistencia.
create or replace function public.portal2027_renumerar_horario(p_anio uuid, p_profesor uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.portal2027_horario
    where anio_id = p_anio and profesor_id = p_profesor
    group by dia having count(*) > 12
  ) then
    raise exception 'Un día no puede tener más de 12 franjas';
  end if;
  update public.portal2027_horario h set bloque = n.num
  from (
    select id, row_number() over (partition by dia order by hora_inicio)::smallint as num
    from public.portal2027_horario where anio_id = p_anio and profesor_id = p_profesor
  ) n
  where h.id = n.id and h.bloque is distinct from n.num;
end $$;
revoke execute on function public.portal2027_renumerar_horario(uuid, uuid) from public, anon, authenticated;

-- ---------- Escritura ----------
-- Reemplaza TODO el horario de un profesor en un año (importación). Todo o nada.
-- p_filas: [{dia, inicio, fin, tipo, asignacion_id, etiqueta}, …]
create or replace function public.portal2027_reemplazar_horario(p_anio uuid, p_profesor uuid, p_filas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.portal2027_puede_gestionar_horario(p_profesor) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'El horario no tiene el formato esperado';
  end if;
  if jsonb_array_length(p_filas) > 80 then
    raise exception 'El horario tiene demasiadas franjas (máximo 80)';
  end if;
  perform pg_advisory_xact_lock(hashtext('horario' || p_anio::text || p_profesor::text));
  delete from public.portal2027_horario where anio_id = p_anio and profesor_id = p_profesor;
  insert into public.portal2027_horario (anio_id, profesor_id, dia, hora_inicio, hora_fin, tipo, asignacion_id, etiqueta)
  select p_anio, p_profesor, f.dia, f.inicio, f.fin, f.tipo, f.asignacion_id, coalesce(trim(f.etiqueta), '')
  from jsonb_to_recordset(p_filas) as f(dia smallint, inicio time, fin time, tipo text, asignacion_id uuid, etiqueta text);
  get diagnostics n = row_count;
  perform public.portal2027_renumerar_horario(p_anio, p_profesor);
  return jsonb_build_object('franjas', n);
end $$;

-- Crea (p_id nulo) o corrige una franja.
create or replace function public.portal2027_guardar_horario_franja(
  p_id uuid, p_anio uuid, p_profesor uuid, p_dia smallint, p_inicio time, p_fin time,
  p_tipo text, p_asignacion uuid, p_etiqueta text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.portal2027_puede_gestionar_horario(p_profesor) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  perform pg_advisory_xact_lock(hashtext('horario' || p_anio::text || p_profesor::text));
  if p_id is null then
    insert into public.portal2027_horario (anio_id, profesor_id, dia, hora_inicio, hora_fin, tipo, asignacion_id, etiqueta)
    values (p_anio, p_profesor, p_dia, p_inicio, p_fin, p_tipo,
            case when p_tipo = 'clase' then p_asignacion end, coalesce(trim(p_etiqueta), ''))
    returning id into v_id;
  else
    update public.portal2027_horario
       set dia = p_dia, hora_inicio = p_inicio, hora_fin = p_fin, tipo = p_tipo,
           asignacion_id = case when p_tipo = 'clase' then p_asignacion end,
           etiqueta = coalesce(trim(p_etiqueta), '')
     where id = p_id and anio_id = p_anio and profesor_id = p_profesor
    returning id into v_id;
    if v_id is null then raise exception 'La franja no existe'; end if;
  end if;
  perform public.portal2027_renumerar_horario(p_anio, p_profesor);
  return v_id;
end $$;

create or replace function public.portal2027_borrar_horario_franja(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare h record;
begin
  select * into h from public.portal2027_horario where id = p_id;
  if not found then return; end if;
  if not public.portal2027_puede_gestionar_horario(h.profesor_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  delete from public.portal2027_horario where id = p_id;
  perform public.portal2027_renumerar_horario(h.anio_id, h.profesor_id);
end $$;

revoke execute on function public.portal2027_reemplazar_horario(uuid, uuid, jsonb),
  public.portal2027_guardar_horario_franja(uuid, uuid, uuid, smallint, time, time, text, uuid, text),
  public.portal2027_borrar_horario_franja(uuid) from public, anon;
grant execute on function public.portal2027_reemplazar_horario(uuid, uuid, jsonb),
  public.portal2027_guardar_horario_franja(uuid, uuid, uuid, smallint, time, time, text, uuid, text),
  public.portal2027_borrar_horario_franja(uuid) to authenticated;
notify pgrst, 'reload schema';
