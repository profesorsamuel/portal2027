-- 0007_portal2027_asistencia.sql
-- Etapa 4, parte A: asistencia por sesión.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0006.
-- Igual que la libreta: las tablas se LEEN directamente y se ESCRIBEN solo con funciones portal2027_*
-- (permisos, versión para detectar conflictos, historial). Aquí NO se calcula ningún porcentaje
-- ni peso: solo se registra y se cuenta. Los estados son configurables (tabla de estados).

-- ---------- Estados de asistencia (configurables) ----------
-- Los códigos de abajo son un punto de partida: cámbielos o agregue otros desde Supabase
-- (Table Editor > portal2027_estados_asistencia). Todavía no tienen efecto en ningún cálculo.
create table public.portal2027_estados_asistencia (
  codigo    text primary key check (codigo ~ '^[a-z_]{1,20}$'),
  etiqueta  text not null check (length(trim(etiqueta)) > 0),
  abreviatura text not null check (length(trim(abreviatura)) between 1 and 3),
  orden     integer not null default 0,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);
insert into public.portal2027_estados_asistencia (codigo, etiqueta, abreviatura, orden) values
  ('presente',   'Presente',             'P', 1),
  ('ausente',    'Ausente',              'A', 2),
  ('tardanza',   'Tardanza',             'T', 3),
  ('justificada','Ausencia justificada', 'J', 4);

-- ---------- Sesiones (una clase: asignación + fecha + bloque) ----------
create table public.portal2027_sesiones_asistencia (
  id             uuid primary key default gen_random_uuid(),
  asignacion_id  uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id   uuid not null references public.portal2027_trimestres (id) on delete restrict,
  fecha          date not null,
  bloque         smallint not null default 1 check (bloque between 1 and 12),
  descripcion    text not null default '' check (length(descripcion) <= 120),
  bloqueada      boolean not null default false,
  eliminada_en   timestamptz,                        -- papelera: recuperable
  version        integer not null default 1,
  creado_por     uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
-- Una sola sesión por asignación, fecha y bloque (las de la papelera también ocupan el lugar: se restaura).
create unique index portal2027_sesiones_unica on public.portal2027_sesiones_asistencia (asignacion_id, fecha, bloque);
create index portal2027_sesiones_libreta_idx on public.portal2027_sesiones_asistencia (asignacion_id, trimestre_id, fecha);

-- ---------- Registro por estudiante ----------
-- Sin fila o estado nulo = sin registrar (no es ausencia).
create table public.portal2027_asistencia (
  id              uuid primary key default gen_random_uuid(),
  sesion_id       uuid not null references public.portal2027_sesiones_asistencia (id) on delete restrict,
  matricula_id    uuid not null references public.portal2027_matriculas (id) on delete restrict,
  estado          text references public.portal2027_estados_asistencia (codigo) on update cascade on delete restrict,
  version         integer not null default 1,
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  unique (sesion_id, matricula_id)
);

-- Historial de solo agregar (reutiliza el bloqueo de 0006).
create table public.portal2027_historial_asistencia (
  id               uuid primary key default gen_random_uuid(),
  asistencia_id    uuid not null references public.portal2027_asistencia (id) on delete restrict,
  sesion_id        uuid not null references public.portal2027_sesiones_asistencia (id) on delete restrict,
  matricula_id     uuid not null references public.portal2027_matriculas (id) on delete restrict,
  estado_anterior  text,
  estado_nuevo     text,
  version          integer not null,
  usuario_id       uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en        timestamptz not null default now()
);
create index portal2027_historial_asistencia_idx on public.portal2027_historial_asistencia (sesion_id, creado_en);
create trigger portal2027_historial_asistencia_inmutable before update or delete on public.portal2027_historial_asistencia
  for each row execute function public.portal2027_historial_inmutable();

-- ---------- Validaciones ----------
-- El trimestre debe ser del año del grupo; si el trimestre tiene fechas, la fecha debe caer dentro.
create function public.portal2027_validar_sesion()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select t2.* into t
  from public.portal2027_asignaciones a
  join public.portal2027_salones s on s.id = a.salon_id
  join public.portal2027_trimestres t2 on t2.anio_id = s.anio_id
  where a.id = new.asignacion_id and t2.id = new.trimestre_id;
  if not found then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;
  if (t.fecha_inicio is not null and new.fecha < t.fecha_inicio)
     or (t.fecha_fin is not null and new.fecha > t.fecha_fin) then
    raise exception 'La fecha está fuera de las fechas del trimestre';
  end if;
  return new;
end $$;
create trigger portal2027_sesiones_validar before insert or update of asignacion_id, trimestre_id, fecha
  on public.portal2027_sesiones_asistencia for each row execute function public.portal2027_validar_sesion();

-- La matrícula debe ser del grupo de la asignación de la sesión.
create function public.portal2027_validar_asistencia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_sesiones_asistencia s
    join public.portal2027_asignaciones a on a.id = s.asignacion_id
    join public.portal2027_matriculas m on m.salon_id = a.salon_id
    where s.id = new.sesion_id and m.id = new.matricula_id
  ) then
    raise exception 'El estudiante no pertenece al grupo de esta sesión';
  end if;
  return new;
end $$;
create trigger portal2027_asistencia_validar before insert or update of sesion_id, matricula_id
  on public.portal2027_asistencia for each row execute function public.portal2027_validar_asistencia();

-- ---------- Permisos ----------
create function public.portal2027_puede_ver_sesion(p_sesion uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_sesiones_asistencia s
    where s.id = p_sesion and public.portal2027_puede_editar_asignacion(s.asignacion_id)
  );
$$;
revoke execute on function public.portal2027_puede_ver_sesion(uuid) from public, anon;
grant execute on function public.portal2027_puede_ver_sesion(uuid) to authenticated;

revoke all on public.portal2027_estados_asistencia, public.portal2027_sesiones_asistencia,
  public.portal2027_asistencia, public.portal2027_historial_asistencia from anon;
-- Con sesión: solo lectura (el permiso de lectura se da de forma explícita).
revoke insert, update, delete, truncate, references, trigger on public.portal2027_sesiones_asistencia,
  public.portal2027_asistencia, public.portal2027_historial_asistencia from authenticated;
revoke truncate, references, trigger on public.portal2027_estados_asistencia from authenticated;
grant select on public.portal2027_estados_asistencia, public.portal2027_sesiones_asistencia,
  public.portal2027_asistencia, public.portal2027_historial_asistencia to authenticated;
-- Los estados se cambian desde Supabase o con la cuenta de administración.
grant insert, update on public.portal2027_estados_asistencia to authenticated;
revoke delete on public.portal2027_estados_asistencia from authenticated;

-- Permiso de lectura de la libreta (0006) por si faltó: es seguro repetirlo, RLS sigue filtrando.
grant select on public.portal2027_evaluaciones, public.portal2027_notas,
  public.portal2027_historial_notas, public.portal2027_historial_evaluaciones to authenticated;

alter table public.portal2027_estados_asistencia  enable row level security;
alter table public.portal2027_sesiones_asistencia enable row level security;
alter table public.portal2027_asistencia          enable row level security;
alter table public.portal2027_historial_asistencia enable row level security;

create policy portal2027_estados_asistencia_ver on public.portal2027_estados_asistencia
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_estados_asistencia_ins on public.portal2027_estados_asistencia
  for insert to authenticated with check (public.portal2027_es_admin());
create policy portal2027_estados_asistencia_upd on public.portal2027_estados_asistencia
  for update to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_sesiones_ver on public.portal2027_sesiones_asistencia
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
create policy portal2027_asistencia_ver on public.portal2027_asistencia
  for select to authenticated using (public.portal2027_puede_ver_sesion(sesion_id));
create policy portal2027_historial_asistencia_ver on public.portal2027_historial_asistencia
  for select to authenticated using (public.portal2027_puede_ver_sesion(sesion_id));

-- ---------- Funciones de escritura ----------
create function public.portal2027_crear_sesion(
  p_asignacion uuid, p_trimestre uuid, p_fecha date, p_bloque integer default 1, p_descripcion text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p_fecha is null then raise exception 'Elija la fecha de la sesión'; end if;
  if exists (select 1 from public.portal2027_sesiones_asistencia
             where asignacion_id = p_asignacion and fecha = p_fecha and bloque = coalesce(p_bloque, 1)) then
    raise exception 'Ya existe una sesión en esa fecha y bloque (puede estar en la papelera)';
  end if;
  insert into public.portal2027_sesiones_asistencia (asignacion_id, trimestre_id, fecha, bloque, descripcion)
    values (p_asignacion, p_trimestre, p_fecha, coalesce(p_bloque, 1), left(trim(coalesce(p_descripcion, '')), 120))
    returning id into v_id;
  return v_id;
end $$;

-- Cambia descripción o bloqueo. Parámetro nulo = no cambia.
create function public.portal2027_actualizar_sesion(
  p_id uuid, p_version integer, p_descripcion text default null, p_bloqueada boolean default null)
returns integer language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.portal2027_sesiones_asistencia where id = p_id for update;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(s.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if s.version <> p_version then
    raise exception 'CONFLICTO: la sesión cambió desde que la abrió. Recargue la asistencia.';
  end if;
  if s.eliminada_en is not null then raise exception 'La sesión está en la papelera'; end if;
  if p_descripcion is not null and left(trim(p_descripcion), 120) is distinct from s.descripcion and s.bloqueada then
    raise exception 'La sesión está bloqueada; desbloquéela para cambiar la descripción';
  end if;
  update public.portal2027_sesiones_asistencia set
    descripcion = coalesce(left(trim(p_descripcion), 120), descripcion),
    bloqueada = coalesce(p_bloqueada, bloqueada),
    version = version + 1, actualizado_en = now()
  where id = p_id;
  return s.version + 1;
end $$;

create function public.portal2027_papelera_sesion(p_id uuid, p_version integer, p_a_papelera boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.portal2027_sesiones_asistencia where id = p_id for update;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(s.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if s.version <> p_version then
    raise exception 'CONFLICTO: la sesión cambió desde que la abrió. Recargue la asistencia.';
  end if;
  if p_a_papelera and s.bloqueada then raise exception 'La sesión está bloqueada; desbloquéela primero'; end if;
  update public.portal2027_sesiones_asistencia
    set eliminada_en = case when p_a_papelera then now() else null end, version = version + 1, actualizado_en = now()
    where id = p_id;
  return s.version + 1;
end $$;

-- Marca la asistencia de un estudiante. p_version = versión que la pantalla tenía (0 si no había registro).
-- p_estado nulo = dejar sin registrar.
create function public.portal2027_guardar_asistencia(
  p_sesion uuid, p_matricula uuid, p_estado text, p_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; a record; v_id uuid;
begin
  select * into s from public.portal2027_sesiones_asistencia where id = p_sesion for update;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(s.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if s.eliminada_en is not null then raise exception 'La sesión está en la papelera'; end if;
  if s.bloqueada then raise exception 'La sesión está bloqueada'; end if;
  if p_estado is not null and not exists (
    select 1 from public.portal2027_estados_asistencia where codigo = p_estado and activo
  ) then
    raise exception 'El estado de asistencia no existe o no está activo';
  end if;
  if not exists (
    select 1 from public.portal2027_matriculas m
    join public.portal2027_asignaciones asg on asg.salon_id = m.salon_id
    where m.id = p_matricula and asg.id = s.asignacion_id
  ) then
    raise exception 'El estudiante no pertenece al grupo de esta sesión';
  end if;

  select * into a from public.portal2027_asistencia where sesion_id = p_sesion and matricula_id = p_matricula for update;

  if not found then
    if coalesce(p_version, 0) <> 0 then
      raise exception 'CONFLICTO: la asistencia cambió desde que la abrió. Recargue la asistencia.';
    end if;
    if p_estado is null then
      return jsonb_build_object('version', 0, 'estado', null, 'sin_cambio', true);
    end if;
    insert into public.portal2027_asistencia (sesion_id, matricula_id, estado, version, actualizado_por)
      values (p_sesion, p_matricula, p_estado, 1, auth.uid()) returning id into v_id;
    insert into public.portal2027_historial_asistencia (asistencia_id, sesion_id, matricula_id, estado_anterior, estado_nuevo, version)
      values (v_id, p_sesion, p_matricula, null, p_estado, 1);
    return jsonb_build_object('version', 1, 'estado', p_estado, 'sin_cambio', false);
  end if;

  if p_version is distinct from a.version then
    raise exception 'CONFLICTO: la asistencia cambió desde que la abrió. Recargue la asistencia.';
  end if;
  if a.estado is not distinct from p_estado then
    return jsonb_build_object('version', a.version, 'estado', a.estado, 'sin_cambio', true);
  end if;
  update public.portal2027_asistencia set estado = p_estado, version = a.version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where id = a.id;
  insert into public.portal2027_historial_asistencia (asistencia_id, sesion_id, matricula_id, estado_anterior, estado_nuevo, version)
    values (a.id, p_sesion, p_matricula, a.estado, p_estado, a.version + 1);
  return jsonb_build_object('version', a.version + 1, 'estado', p_estado, 'sin_cambio', false);
end $$;

-- Marca a TODOS los estudiantes que aún no tienen registro con un mismo estado (no toca los ya marcados).
create function public.portal2027_marcar_pendientes(p_sesion uuid, p_estado text)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; m record; v_id uuid; v_n integer := 0;
begin
  select * into s from public.portal2027_sesiones_asistencia where id = p_sesion for update;
  if not found then raise exception 'La sesión no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(s.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if s.eliminada_en is not null then raise exception 'La sesión está en la papelera'; end if;
  if s.bloqueada then raise exception 'La sesión está bloqueada'; end if;
  if not exists (select 1 from public.portal2027_estados_asistencia where codigo = p_estado and activo) then
    raise exception 'El estado de asistencia no existe o no está activo';
  end if;

  for m in
    select mt.id from public.portal2027_matriculas mt
    join public.portal2027_asignaciones asg on asg.salon_id = mt.salon_id
    where asg.id = s.asignacion_id
      and not exists (select 1 from public.portal2027_asistencia x
                      where x.sesion_id = p_sesion and x.matricula_id = mt.id and x.estado is not null)
  loop
    insert into public.portal2027_asistencia (sesion_id, matricula_id, estado, version, actualizado_por)
      values (p_sesion, m.id, p_estado, 1, auth.uid())
      on conflict (sesion_id, matricula_id) do update
        set estado = excluded.estado, version = public.portal2027_asistencia.version + 1,
            actualizado_por = auth.uid(), actualizado_en = now()
      returning id into v_id;
    insert into public.portal2027_historial_asistencia (asistencia_id, sesion_id, matricula_id, estado_anterior, estado_nuevo, version)
      select v_id, p_sesion, m.id, null, p_estado, x.version from public.portal2027_asistencia x where x.id = v_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function public.portal2027_crear_sesion(uuid, uuid, date, integer, text),
  public.portal2027_actualizar_sesion(uuid, integer, text, boolean),
  public.portal2027_papelera_sesion(uuid, integer, boolean),
  public.portal2027_guardar_asistencia(uuid, uuid, text, integer),
  public.portal2027_marcar_pendientes(uuid, text) from public, anon;
grant execute on function public.portal2027_crear_sesion(uuid, uuid, date, integer, text),
  public.portal2027_actualizar_sesion(uuid, integer, text, boolean),
  public.portal2027_papelera_sesion(uuid, integer, boolean),
  public.portal2027_guardar_asistencia(uuid, uuid, text, integer),
  public.portal2027_marcar_pendientes(uuid, text) to authenticated;
