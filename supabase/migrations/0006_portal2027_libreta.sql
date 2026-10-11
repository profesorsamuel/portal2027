-- 0006_portal2027_libreta.sql
-- Etapa 3, parte A: columnas de evaluación, notas, historial y funciones de guardado.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0005.
-- Las tablas NO se escriben directamente: todo cambio pasa por las funciones portal2027_*,
-- que validan permisos, bloqueo, versión (conflictos) y registran el historial.

-- Columnas de la libreta: una por actividad, dentro de asignación + trimestre.
create table public.portal2027_evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  asignacion_id  uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id   uuid not null references public.portal2027_trimestres (id) on delete restrict,
  categoria      text not null check (categoria in ('apreciacion', 'ejercicio_escrito', 'examen')),
  tema           text not null default '' check (length(tema) <= 120),
  orden          integer not null default 0,
  bloqueada      boolean not null default false,
  oculta         boolean not null default false,
  eliminada_en   timestamptz,                       -- papelera: no es borrado definitivo
  version        integer not null default 1,
  creado_por     uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index portal2027_evaluaciones_libreta_idx on public.portal2027_evaluaciones (asignacion_id, trimestre_id);

-- Notas: una por columna y matrícula. Vacío = sin fila o valor nulo (nunca cero).
create table public.portal2027_notas (
  id             uuid primary key default gen_random_uuid(),
  evaluacion_id  uuid not null references public.portal2027_evaluaciones (id) on delete restrict,
  matricula_id   uuid not null references public.portal2027_matriculas (id) on delete restrict,
  valor          numeric(4, 2) check (valor is null or (valor >= 0 and valor <= 5)),
  version        integer not null default 1,
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en timestamptz not null default now(),
  unique (evaluacion_id, matricula_id)
);

-- Historial de notas: desde la primera edición. Solo se agrega, nunca se cambia.
create table public.portal2027_historial_notas (
  id              uuid primary key default gen_random_uuid(),
  nota_id         uuid not null references public.portal2027_notas (id) on delete restrict,
  evaluacion_id   uuid not null references public.portal2027_evaluaciones (id) on delete restrict,
  matricula_id    uuid not null references public.portal2027_matriculas (id) on delete restrict,
  valor_anterior  numeric(4, 2),
  valor_nuevo     numeric(4, 2),
  version         integer not null,
  motivo          text,
  usuario_id      uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en       timestamptz not null default now()
);
create index portal2027_historial_notas_nota_idx on public.portal2027_historial_notas (nota_id, version);

-- Historial de acciones sobre columnas (crear, tema, bloquear, ocultar, papelera, restaurar).
create table public.portal2027_historial_evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  evaluacion_id  uuid not null references public.portal2027_evaluaciones (id) on delete restrict,
  accion         text not null,
  detalle        jsonb,
  version        integer not null,
  usuario_id     uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en      timestamptz not null default now()
);

-- El historial es de solo agregar.
create function public.portal2027_historial_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial no se puede modificar ni borrar';
end $$;
create trigger portal2027_historial_notas_inmutable before update or delete on public.portal2027_historial_notas
  for each row execute function public.portal2027_historial_inmutable();
create trigger portal2027_historial_eval_inmutable before update or delete on public.portal2027_historial_evaluaciones
  for each row execute function public.portal2027_historial_inmutable();

-- El trimestre debe ser del mismo año que el grupo de la asignación.
create function public.portal2027_validar_evaluacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where a.id = new.asignacion_id and t.id = new.trimestre_id
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;
  return new;
end $$;
create trigger portal2027_evaluaciones_validar before insert or update of asignacion_id, trimestre_id
  on public.portal2027_evaluaciones for each row execute function public.portal2027_validar_evaluacion();

-- La matrícula debe ser del grupo de la asignación de la columna.
create function public.portal2027_validar_nota()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_evaluaciones e
    join public.portal2027_asignaciones a on a.id = e.asignacion_id
    join public.portal2027_matriculas m on m.salon_id = a.salon_id
    where e.id = new.evaluacion_id and m.id = new.matricula_id
  ) then
    raise exception 'El estudiante no pertenece al grupo de esta libreta';
  end if;
  return new;
end $$;
create trigger portal2027_notas_validar before insert or update of evaluacion_id, matricula_id
  on public.portal2027_notas for each row execute function public.portal2027_validar_nota();

-- ---------- Permisos ----------
create function public.portal2027_puede_editar_asignacion(p_asignacion uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_es_admin()
    or (public.portal2027_tiene_rol('profesor') and exists (
      select 1 from public.portal2027_asignaciones a where a.id = p_asignacion and a.profesor_id = auth.uid()
    ));
$$;

create function public.portal2027_puede_ver_evaluacion(p_evaluacion uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_evaluaciones e
    where e.id = p_evaluacion and public.portal2027_puede_editar_asignacion(e.asignacion_id)
  );
$$;

revoke execute on function public.portal2027_puede_editar_asignacion(uuid), public.portal2027_puede_ver_evaluacion(uuid) from public, anon;
grant execute on function public.portal2027_puede_editar_asignacion(uuid), public.portal2027_puede_ver_evaluacion(uuid) to authenticated;

revoke all on public.portal2027_evaluaciones, public.portal2027_notas, public.portal2027_historial_notas,
  public.portal2027_historial_evaluaciones from anon;
-- Con sesión solo se puede leer; escribir solo con las funciones de abajo.
revoke insert, update, delete, truncate, references, trigger on public.portal2027_evaluaciones, public.portal2027_notas,
  public.portal2027_historial_notas, public.portal2027_historial_evaluaciones from authenticated;

alter table public.portal2027_evaluaciones          enable row level security;
alter table public.portal2027_notas                 enable row level security;
alter table public.portal2027_historial_notas       enable row level security;
alter table public.portal2027_historial_evaluaciones enable row level security;

create policy portal2027_evaluaciones_ver on public.portal2027_evaluaciones
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
create policy portal2027_notas_ver on public.portal2027_notas
  for select to authenticated using (public.portal2027_puede_ver_evaluacion(evaluacion_id));
create policy portal2027_historial_notas_ver on public.portal2027_historial_notas
  for select to authenticated using (public.portal2027_puede_ver_evaluacion(evaluacion_id));
create policy portal2027_historial_eval_ver on public.portal2027_historial_evaluaciones
  for select to authenticated using (public.portal2027_puede_ver_evaluacion(evaluacion_id));

-- ---------- Funciones de escritura ----------
create function public.portal2027_crear_evaluacion(p_asignacion uuid, p_trimestre uuid, p_categoria text, p_tema text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_orden integer;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select coalesce(max(orden), 0) + 1 into v_orden from public.portal2027_evaluaciones
    where asignacion_id = p_asignacion and trimestre_id = p_trimestre;
  insert into public.portal2027_evaluaciones (asignacion_id, trimestre_id, categoria, tema, orden)
    values (p_asignacion, p_trimestre, p_categoria, left(trim(coalesce(p_tema, '')), 120), v_orden)
    returning id into v_id;
  insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, detalle, version)
    values (v_id, 'crear', jsonb_build_object('categoria', p_categoria, 'tema', p_tema), 1);
  return v_id;
end $$;

-- Cambia tema, ocultar o bloqueo. Parámetro nulo = no cambia.
create function public.portal2027_actualizar_evaluacion(
  p_id uuid, p_version integer, p_tema text default null, p_oculta boolean default null, p_bloqueada boolean default null)
returns integer language plpgsql security definer set search_path = public as $$
declare ev record; v_tema text;
begin
  select * into ev from public.portal2027_evaluaciones where id = p_id for update;
  if not found then raise exception 'La columna no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(ev.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if ev.version <> p_version then
    raise exception 'CONFLICTO: la columna cambió desde que la abrió. Recargue la libreta.';
  end if;
  if ev.eliminada_en is not null then raise exception 'La columna está en la papelera'; end if;
  v_tema := case when p_tema is null then null else left(trim(p_tema), 120) end;
  if v_tema is not null and v_tema is distinct from ev.tema and ev.bloqueada then
    raise exception 'La columna está bloqueada; desbloquéela para cambiar el tema';
  end if;
  update public.portal2027_evaluaciones set
    tema = coalesce(v_tema, tema), oculta = coalesce(p_oculta, oculta), bloqueada = coalesce(p_bloqueada, bloqueada),
    version = version + 1, actualizado_en = now()
  where id = p_id;
  insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, detalle, version)
    values (p_id, 'actualizar', jsonb_build_object('tema', v_tema, 'oculta', p_oculta, 'bloqueada', p_bloqueada), ev.version + 1);
  return ev.version + 1;
end $$;

-- Papelera: la columna deja de contar, sus notas se conservan y se puede restaurar.
create function public.portal2027_papelera_evaluacion(p_id uuid, p_version integer, p_a_papelera boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare ev record;
begin
  select * into ev from public.portal2027_evaluaciones where id = p_id for update;
  if not found then raise exception 'La columna no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(ev.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if ev.version <> p_version then
    raise exception 'CONFLICTO: la columna cambió desde que la abrió. Recargue la libreta.';
  end if;
  if p_a_papelera and ev.bloqueada then raise exception 'La columna está bloqueada; desbloquéela primero'; end if;
  update public.portal2027_evaluaciones
    set eliminada_en = case when p_a_papelera then now() else null end, version = version + 1, actualizado_en = now()
    where id = p_id;
  insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, version)
    values (p_id, case when p_a_papelera then 'papelera' else 'restaurar' end, ev.version + 1);
  return ev.version + 1;
end $$;

-- Guarda una nota. p_version = versión que la pantalla tenía (0 si la celda estaba vacía y sin registro).
-- Para cambiar o borrar una nota ya escrita se exige motivo.
create function public.portal2027_guardar_nota(
  p_evaluacion uuid, p_matricula uuid, p_valor numeric, p_version integer, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev record; n record; v_motivo text := nullif(trim(coalesce(p_motivo, '')), ''); v_id uuid;
begin
  select * into ev from public.portal2027_evaluaciones where id = p_evaluacion for update;
  if not found then raise exception 'La columna no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(ev.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if ev.eliminada_en is not null then raise exception 'La columna está en la papelera'; end if;
  if ev.bloqueada then raise exception 'La columna está bloqueada'; end if;
  if p_valor is not null and (p_valor < 0 or p_valor > 5) then raise exception 'La nota debe estar entre 0 y 5'; end if;
  if not exists (
    select 1 from public.portal2027_matriculas m
    join public.portal2027_asignaciones a on a.salon_id = m.salon_id
    where m.id = p_matricula and a.id = ev.asignacion_id
  ) then
    raise exception 'El estudiante no pertenece al grupo de esta libreta';
  end if;

  select * into n from public.portal2027_notas where evaluacion_id = p_evaluacion and matricula_id = p_matricula for update;

  if not found then
    if coalesce(p_version, 0) <> 0 then
      raise exception 'CONFLICTO: la nota cambió desde que la abrió. Recargue la libreta.';
    end if;
    if p_valor is null then
      return jsonb_build_object('version', 0, 'valor', null, 'sin_cambio', true);
    end if;
    insert into public.portal2027_notas (evaluacion_id, matricula_id, valor, version, actualizado_por)
      values (p_evaluacion, p_matricula, p_valor, 1, auth.uid()) returning id into v_id;
    insert into public.portal2027_historial_notas (nota_id, evaluacion_id, matricula_id, valor_anterior, valor_nuevo, version, motivo)
      values (v_id, p_evaluacion, p_matricula, null, p_valor, 1, v_motivo);
    return jsonb_build_object('version', 1, 'valor', p_valor, 'sin_cambio', false);
  end if;

  if p_version is distinct from n.version then
    raise exception 'CONFLICTO: la nota cambió desde que la abrió. Recargue la libreta.';
  end if;
  if n.valor is not distinct from p_valor then
    return jsonb_build_object('version', n.version, 'valor', n.valor, 'sin_cambio', true);
  end if;
  if n.valor is not null and v_motivo is null then
    raise exception 'Escriba el motivo del cambio';
  end if;
  update public.portal2027_notas set valor = p_valor, version = n.version + 1, actualizado_por = auth.uid(), actualizado_en = now()
    where id = n.id;
  insert into public.portal2027_historial_notas (nota_id, evaluacion_id, matricula_id, valor_anterior, valor_nuevo, version, motivo)
    values (n.id, p_evaluacion, p_matricula, n.valor, p_valor, n.version + 1, v_motivo);
  return jsonb_build_object('version', n.version + 1, 'valor', p_valor, 'sin_cambio', false);
end $$;

revoke execute on function public.portal2027_crear_evaluacion(uuid, uuid, text, text),
  public.portal2027_actualizar_evaluacion(uuid, integer, text, boolean, boolean),
  public.portal2027_papelera_evaluacion(uuid, integer, boolean),
  public.portal2027_guardar_nota(uuid, uuid, numeric, integer, text) from public, anon;
grant execute on function public.portal2027_crear_evaluacion(uuid, uuid, text, text),
  public.portal2027_actualizar_evaluacion(uuid, integer, text, boolean, boolean),
  public.portal2027_papelera_evaluacion(uuid, integer, boolean),
  public.portal2027_guardar_nota(uuid, uuid, numeric, integer, text) to authenticated;
