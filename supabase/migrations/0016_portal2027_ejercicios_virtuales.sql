-- 0016_portal2027_ejercicios_virtuales.sql
-- Ejercicios virtuales (guía, etapa 6), parte A: periodos, ejercicios, equipos, intentos y consolidación.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0015. Se puede ejecutar varias veces.
--
-- REGLAS DE ESTA PARTE
-- * El juego NUNCA escribe notas finales: solo guarda intentos (portal2027_guardar_intento).
-- * La nota de la libreta se escribe únicamente al CONSOLIDAR un periodo (portal2027_consolidar_periodo), que usa el
--   guardado común portal2027_guardar_nota (permisos, columna bloqueada, trimestre cerrado, versión e historial).
-- * La consolidación queda BLOQUEADA hasta que administración defina, por año, cómo se combinan los ejercicios y qué
--   pasa con los faltantes (tabla portal2027_config_ejercicios). La guía pide no activarla sin ese acuerdo.
-- * Aquí no se calcula ningún promedio por categoría ni final: eso sigue siendo del motor único en la pantalla.

-- ---------- Configuración por año (SIN DEFINIR hasta que administración la fije) ----------
create table if not exists public.portal2027_config_ejercicios (
  anio_id         uuid primary key references public.portal2027_anios (id) on delete cascade,
  metodo          text not null default 'sin_definir' check (metodo in ('sin_definir', 'promedio_mejores')),
  faltantes       text not null default 'sin_definir' check (faltantes in ('sin_definir', 'no_cuenta')),
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en  timestamptz not null default now()
);
drop trigger if exists portal2027_config_ejercicios_marcar on public.portal2027_config_ejercicios;
create trigger portal2027_config_ejercicios_marcar before insert or update on public.portal2027_config_ejercicios
  for each row execute function public.portal2027_marcar_config();

-- ---------- Periodos (semanal o quincenal), cada uno vinculado a UNA columna de apreciación ----------
create table if not exists public.portal2027_periodos_ejercicio (
  id            uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id  uuid not null references public.portal2027_trimestres (id) on delete restrict,
  tipo          text not null check (tipo in ('semanal', 'quincenal')),
  fecha_inicio  date not null,
  fecha_fin     date not null,
  evaluacion_id uuid not null references public.portal2027_evaluaciones (id) on delete restrict,
  cerrado_en    timestamptz,
  cerrado_por   uuid references public.portal2027_perfiles (id) on delete set null,
  creado_por    uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en     timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio and fecha_fin - fecha_inicio <= 14)
);
create unique index if not exists portal2027_periodos_ejercicio_columna_uq on public.portal2027_periodos_ejercicio (evaluacion_id);
create index if not exists portal2027_periodos_ejercicio_asig_idx on public.portal2027_periodos_ejercicio (asignacion_id, trimestre_id);

-- ---------- Ejercicios ----------
create table if not exists public.portal2027_ejercicios (
  id            uuid primary key default gen_random_uuid(),
  periodo_id    uuid not null references public.portal2027_periodos_ejercicio (id) on delete restrict,
  titulo        text not null check (length(trim(titulo)) between 1 and 120),
  juego         text not null default '' check (length(juego) <= 80),      -- identifica la página en pages/ejercicios/
  modo          text not null check (modo in ('obligatorio', 'practica')), -- práctica: se guarda el intento, nunca da nota
  participacion text not null default 'individual' check (participacion in ('individual', 'equipo')),
  tamano_equipo smallint check (tamano_equipo in (2, 3, 4)),
  eliminado_en  timestamptz,                                               -- papelera: no es borrado definitivo
  creado_por    uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en     timestamptz not null default now(),
  check ((participacion = 'equipo') = (tamano_equipo is not null))
);
create index if not exists portal2027_ejercicios_periodo_idx on public.portal2027_ejercicios (periodo_id);

-- ---------- Equipos (de 2, 3 o 4, según el ejercicio). Cada integrante debe CONFIRMAR ----------
create table if not exists public.portal2027_equipos_ejercicio (
  id           uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references public.portal2027_ejercicios (id) on delete restrict,
  creado_por   uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en    timestamptz not null default now()
);
create table if not exists public.portal2027_equipo_integrantes (
  equipo_id     uuid not null references public.portal2027_equipos_ejercicio (id) on delete cascade,
  ejercicio_id  uuid not null references public.portal2027_ejercicios (id) on delete restrict,
  matricula_id  uuid not null references public.portal2027_matriculas (id) on delete restrict,
  confirmado_en timestamptz,
  primary key (equipo_id, matricula_id),
  unique (ejercicio_id, matricula_id)        -- un estudiante, un solo equipo por ejercicio
);

-- ---------- Intentos: solo se agregan. clave_envio evita duplicados si el envío se repite ----------
create table if not exists public.portal2027_intentos (
  id           uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references public.portal2027_ejercicios (id) on delete restrict,
  matricula_id uuid not null references public.portal2027_matriculas (id) on delete restrict,   -- quien jugó
  equipo_id    uuid references public.portal2027_equipos_ejercicio (id) on delete restrict,
  nota         numeric(4, 2) not null check (nota >= 0 and nota <= 5),
  clave_envio  uuid not null,
  creado_en    timestamptz not null default now(),
  unique (ejercicio_id, matricula_id, clave_envio)
);
create index if not exists portal2027_intentos_ejercicio_idx on public.portal2027_intentos (ejercicio_id, matricula_id);
create index if not exists portal2027_intentos_equipo_idx on public.portal2027_intentos (equipo_id) where equipo_id is not null;
drop trigger if exists portal2027_intentos_inmutable on public.portal2027_intentos;
create trigger portal2027_intentos_inmutable before update or delete on public.portal2027_intentos
  for each row execute function public.portal2027_historial_inmutable();

-- ---------- Consolidación: una por estudiante y periodo (la última; los cambios de nota quedan en su historial) ----------
create table if not exists public.portal2027_consolidaciones (
  periodo_id      uuid not null references public.portal2027_periodos_ejercicio (id) on delete restrict,
  matricula_id    uuid not null references public.portal2027_matriculas (id) on delete restrict,
  valor           numeric(4, 2),                 -- nulo = sin ejercicios con nota (no es cero)
  detalle         jsonb not null default '{}'::jsonb,
  consolidado_por uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  consolidado_en  timestamptz not null default now(),
  primary key (periodo_id, matricula_id)
);

-- ---------- Validaciones en la base ----------
create or replace function public.portal2027_validar_periodo_ejercicio()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev record; tr record;
begin
  select * into ev from public.portal2027_evaluaciones where id = new.evaluacion_id;
  if not found or ev.asignacion_id <> new.asignacion_id or ev.trimestre_id <> new.trimestre_id then
    raise exception 'La columna no corresponde a esta materia y trimestre';
  end if;
  if ev.categoria <> 'apreciacion' then
    raise exception 'Los ejercicios virtuales alimentan una columna de apreciación';
  end if;
  if not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where a.id = new.asignacion_id and t.id = new.trimestre_id
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;
  select fecha_inicio, fecha_fin into tr from public.portal2027_trimestres where id = new.trimestre_id;
  if (tr.fecha_inicio is not null and new.fecha_inicio < tr.fecha_inicio) or (tr.fecha_fin is not null and new.fecha_fin > tr.fecha_fin) then
    raise exception 'El periodo debe quedar dentro de las fechas del trimestre';
  end if;
  return new;
end $$;
drop trigger if exists portal2027_periodos_ejercicio_validar on public.portal2027_periodos_ejercicio;
create trigger portal2027_periodos_ejercicio_validar before insert or update of asignacion_id, trimestre_id, evaluacion_id, fecha_inicio, fecha_fin
  on public.portal2027_periodos_ejercicio for each row execute function public.portal2027_validar_periodo_ejercicio();

-- ---------- Ayudas de permisos y búsqueda ----------
create or replace function public.portal2027_asig_de_periodo(p_periodo uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select asignacion_id from public.portal2027_periodos_ejercicio where id = p_periodo;
$$;
create or replace function public.portal2027_asig_de_ejercicio(p_ejercicio uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.asignacion_id from public.portal2027_ejercicios e
  join public.portal2027_periodos_ejercicio p on p.id = e.periodo_id where e.id = p_ejercicio;
$$;
-- Matrícula del estudiante con sesión dentro del grupo de una asignación (nulo si no es estudiante de ese grupo).
create or replace function public.portal2027_mi_matricula(p_asignacion uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.portal2027_matriculas m
  join public.portal2027_estudiantes e on e.id = m.estudiante_id
  join public.portal2027_asignaciones a on a.salon_id = m.salon_id
  where a.id = p_asignacion and e.usuario_id = auth.uid() and public.portal2027_tiene_rol('estudiante')
  limit 1;
$$;
-- Equipo al que pertenece una matrícula en un ejercicio (nulo si no tiene).
create or replace function public.portal2027_equipo_de(p_ejercicio uuid, p_matricula uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select equipo_id from public.portal2027_equipo_integrantes where ejercicio_id = p_ejercicio and matricula_id = p_matricula;
$$;
-- Un equipo está confirmado cuando tiene todos sus integrantes y todos confirmaron.
create or replace function public.portal2027_equipo_confirmado(p_equipo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select count(*) = e.tamano_equipo and count(i.confirmado_en) = e.tamano_equipo
    from public.portal2027_equipos_ejercicio q
    join public.portal2027_ejercicios e on e.id = q.ejercicio_id
    join public.portal2027_equipo_integrantes i on i.equipo_id = q.id
    where q.id = p_equipo group by e.tamano_equipo), false);
$$;
-- Motivo por el que una matrícula NO puede jugar ahora (nulo = puede).
create or replace function public.portal2027_motivo_no_jugar(p_ejercicio uuid, p_matricula uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare e record; p record; v_eq uuid;
begin
  select * into e from public.portal2027_ejercicios where id = p_ejercicio;
  if not found or e.eliminado_en is not null then return 'El ejercicio ya no está disponible'; end if;
  select * into p from public.portal2027_periodos_ejercicio where id = e.periodo_id;
  if p.cerrado_en is not null then return 'El periodo está cerrado'; end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then return 'El trimestre está cerrado'; end if;
  if e.participacion = 'equipo' then
    v_eq := public.portal2027_equipo_de(e.id, p_matricula);
    if v_eq is null then return 'Todavía no tiene un equipo para este ejercicio'; end if;
    if not public.portal2027_equipo_confirmado(v_eq) then return 'Su equipo aún no está confirmado por todos los integrantes'; end if;
  end if;
  return null;
end $$;

-- Mejor nota válida de una matrícula en un ejercicio: individual = sus intentos; equipo = intentos de su equipo
-- (solo si ella confirmó). Nulo si no hay intentos. Los intentos inválidos nunca se guardan.
create or replace function public.portal2027_mejor_nota_ejercicio(p_ejercicio uuid, p_matricula uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare e record; v_eq uuid; v numeric;
begin
  select * into e from public.portal2027_ejercicios where id = p_ejercicio;
  if not found then return null; end if;
  if e.participacion = 'individual' then
    select max(nota) into v from public.portal2027_intentos where ejercicio_id = p_ejercicio and matricula_id = p_matricula and equipo_id is null;
  else
    select i.equipo_id into v_eq from public.portal2027_equipo_integrantes i
      where i.ejercicio_id = p_ejercicio and i.matricula_id = p_matricula and i.confirmado_en is not null;
    if v_eq is null then return null; end if;
    select max(nota) into v from public.portal2027_intentos where ejercicio_id = p_ejercicio and equipo_id = v_eq;
  end if;
  return v;
end $$;

-- ---------- Permisos de tablas: se lee con RLS (profesor de la asignación y administración); se escribe por funciones ----------
revoke all on public.portal2027_config_ejercicios, public.portal2027_periodos_ejercicio, public.portal2027_ejercicios,
  public.portal2027_equipos_ejercicio, public.portal2027_equipo_integrantes, public.portal2027_intentos,
  public.portal2027_consolidaciones from anon;
revoke insert, update, delete, truncate, references, trigger on public.portal2027_periodos_ejercicio, public.portal2027_ejercicios,
  public.portal2027_equipos_ejercicio, public.portal2027_equipo_integrantes, public.portal2027_intentos,
  public.portal2027_consolidaciones from authenticated;
revoke delete, truncate, references, trigger on public.portal2027_config_ejercicios from authenticated;
grant select on public.portal2027_periodos_ejercicio, public.portal2027_ejercicios, public.portal2027_equipos_ejercicio,
  public.portal2027_equipo_integrantes, public.portal2027_intentos, public.portal2027_consolidaciones to authenticated;
grant select, insert, update on public.portal2027_config_ejercicios to authenticated;

alter table public.portal2027_config_ejercicios  enable row level security;
alter table public.portal2027_periodos_ejercicio enable row level security;
alter table public.portal2027_ejercicios         enable row level security;
alter table public.portal2027_equipos_ejercicio  enable row level security;
alter table public.portal2027_equipo_integrantes enable row level security;
alter table public.portal2027_intentos           enable row level security;
alter table public.portal2027_consolidaciones    enable row level security;

drop policy if exists portal2027_config_ejercicios_ver on public.portal2027_config_ejercicios;
create policy portal2027_config_ejercicios_ver on public.portal2027_config_ejercicios
  for select to authenticated using (public.portal2027_tiene_algun_rol());
drop policy if exists portal2027_config_ejercicios_ins on public.portal2027_config_ejercicios;
create policy portal2027_config_ejercicios_ins on public.portal2027_config_ejercicios
  for insert to authenticated with check (public.portal2027_es_admin());
drop policy if exists portal2027_config_ejercicios_upd on public.portal2027_config_ejercicios;
create policy portal2027_config_ejercicios_upd on public.portal2027_config_ejercicios
  for update to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

drop policy if exists portal2027_periodos_ejercicio_ver on public.portal2027_periodos_ejercicio;
create policy portal2027_periodos_ejercicio_ver on public.portal2027_periodos_ejercicio
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
drop policy if exists portal2027_ejercicios_ver on public.portal2027_ejercicios;
create policy portal2027_ejercicios_ver on public.portal2027_ejercicios
  for select to authenticated using (public.portal2027_puede_editar_asignacion(public.portal2027_asig_de_periodo(periodo_id)));
drop policy if exists portal2027_equipos_ejercicio_ver on public.portal2027_equipos_ejercicio;
create policy portal2027_equipos_ejercicio_ver on public.portal2027_equipos_ejercicio
  for select to authenticated using (public.portal2027_puede_editar_asignacion(public.portal2027_asig_de_ejercicio(ejercicio_id)));
drop policy if exists portal2027_equipo_integrantes_ver on public.portal2027_equipo_integrantes;
create policy portal2027_equipo_integrantes_ver on public.portal2027_equipo_integrantes
  for select to authenticated using (public.portal2027_puede_editar_asignacion(public.portal2027_asig_de_ejercicio(ejercicio_id)));
drop policy if exists portal2027_intentos_ver on public.portal2027_intentos;
create policy portal2027_intentos_ver on public.portal2027_intentos
  for select to authenticated using (public.portal2027_puede_editar_asignacion(public.portal2027_asig_de_ejercicio(ejercicio_id)));
drop policy if exists portal2027_consolidaciones_ver on public.portal2027_consolidaciones;
create policy portal2027_consolidaciones_ver on public.portal2027_consolidaciones
  for select to authenticated using (public.portal2027_puede_editar_asignacion(public.portal2027_asig_de_periodo(periodo_id)));

-- ---------- Funciones de escritura: profesor / administración ----------
create or replace function public.portal2027_crear_periodo_ejercicio(
  p_asignacion uuid, p_trimestre uuid, p_tipo text, p_inicio date, p_fin date, p_evaluacion uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p_asignacion, p_trimestre) then raise exception 'El trimestre está cerrado'; end if;
  insert into public.portal2027_periodos_ejercicio (asignacion_id, trimestre_id, tipo, fecha_inicio, fecha_fin, evaluacion_id)
    values (p_asignacion, p_trimestre, p_tipo, p_inicio, p_fin, p_evaluacion) returning id into v_id;
  return v_id;
end $$;

-- Cerrar (p_cerrar = true) o reabrir un periodo. Cerrado: el juego rechaza intentos nuevos.
create or replace function public.portal2027_cerrar_periodo_ejercicio(p_periodo uuid, p_cerrar boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.portal2027_periodos_ejercicio where id = p_periodo for update;
  if not found then raise exception 'El periodo no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;
  update public.portal2027_periodos_ejercicio
    set cerrado_en = case when coalesce(p_cerrar, false) then coalesce(cerrado_en, now()) else null end,
        cerrado_por = case when coalesce(p_cerrar, false) then auth.uid() else null end
    where id = p_periodo;
  return coalesce(p_cerrar, false);
end $$;

create or replace function public.portal2027_crear_ejercicio(
  p_periodo uuid, p_titulo text, p_juego text, p_modo text, p_participacion text, p_tamano integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; v_id uuid;
begin
  select * into p from public.portal2027_periodos_ejercicio where id = p_periodo;
  if not found then raise exception 'El periodo no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p.cerrado_en is not null then raise exception 'El periodo está cerrado'; end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;
  insert into public.portal2027_ejercicios (periodo_id, titulo, juego, modo, participacion, tamano_equipo)
    values (p_periodo, trim(coalesce(p_titulo, '')), left(coalesce(trim(p_juego), ''), 80), p_modo, coalesce(p_participacion, 'individual'),
            case when coalesce(p_participacion, 'individual') = 'equipo' then p_tamano else null end)
    returning id into v_id;
  return v_id;
end $$;

-- Papelera de ejercicios (recuperable). Los intentos ya guardados se conservan.
create or replace function public.portal2027_papelera_ejercicio(p_ejercicio uuid, p_a_papelera boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select pe.* into p from public.portal2027_ejercicios e join public.portal2027_periodos_ejercicio pe on pe.id = e.periodo_id
    where e.id = p_ejercicio;
  if not found then raise exception 'El ejercicio no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;
  update public.portal2027_ejercicios set eliminado_en = case when coalesce(p_a_papelera, true) then coalesce(eliminado_en, now()) else null end
    where id = p_ejercicio;
  return coalesce(p_a_papelera, true);
end $$;

-- Crear un equipo (profesor / administración). p_matriculas debe traer exactamente el tamaño del ejercicio.
-- Los integrantes quedan SIN confirmar; cada uno confirma desde su cuenta.
create or replace function public.portal2027_crear_equipo(p_ejercicio uuid, p_matriculas uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare e record; p record; v_eq uuid; v_m uuid; v_n integer;
begin
  select * into e from public.portal2027_ejercicios where id = p_ejercicio;
  if not found or e.eliminado_en is not null then raise exception 'El ejercicio no existe o está en la papelera'; end if;
  select * into p from public.portal2027_periodos_ejercicio where id = e.periodo_id;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p.cerrado_en is not null then raise exception 'El periodo está cerrado'; end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;
  if e.participacion <> 'equipo' then raise exception 'Este ejercicio es individual'; end if;
  select count(distinct x) into v_n from unnest(coalesce(p_matriculas, '{}'::uuid[])) x;
  if v_n <> e.tamano_equipo or coalesce(array_length(p_matriculas, 1), 0) <> v_n then
    raise exception 'El equipo debe tener exactamente % estudiantes distintos', e.tamano_equipo;
  end if;
  foreach v_m in array p_matriculas loop
    if not exists (select 1 from public.portal2027_matriculas m join public.portal2027_asignaciones a on a.salon_id = m.salon_id
                   where m.id = v_m and a.id = p.asignacion_id) then
      raise exception 'Un estudiante no pertenece al grupo de este ejercicio';
    end if;
    if exists (select 1 from public.portal2027_equipo_integrantes i where i.ejercicio_id = p_ejercicio and i.matricula_id = v_m) then
      raise exception 'Un estudiante ya está en otro equipo de este ejercicio';
    end if;
  end loop;
  insert into public.portal2027_equipos_ejercicio (ejercicio_id) values (p_ejercicio) returning id into v_eq;
  foreach v_m in array p_matriculas loop
    insert into public.portal2027_equipo_integrantes (equipo_id, ejercicio_id, matricula_id) values (v_eq, p_ejercicio, v_m);
  end loop;
  return v_eq;
end $$;

-- Disolver un equipo (solo si todavía no tiene intentos).
create or replace function public.portal2027_disolver_equipo(p_equipo uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select pe.* into p from public.portal2027_equipos_ejercicio q
    join public.portal2027_ejercicios e on e.id = q.ejercicio_id
    join public.portal2027_periodos_ejercicio pe on pe.id = e.periodo_id where q.id = p_equipo;
  if not found then raise exception 'El equipo no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;
  if exists (select 1 from public.portal2027_intentos where equipo_id = p_equipo) then
    raise exception 'El equipo ya tiene intentos y no se puede disolver';
  end if;
  delete from public.portal2027_equipos_ejercicio where id = p_equipo;   -- los integrantes se van en cascada
  return true;
end $$;

-- ---------- Funciones del estudiante ----------
-- Confirmar mi participación en un equipo.
create or replace function public.portal2027_confirmar_equipo(p_equipo uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record; v_mat uuid; p record;
begin
  select q2.*, e.periodo_id into q from public.portal2027_equipos_ejercicio q2 join public.portal2027_ejercicios e on e.id = q2.ejercicio_id where q2.id = p_equipo;
  if not found then raise exception 'El equipo no existe'; end if;
  select * into p from public.portal2027_periodos_ejercicio where id = q.periodo_id;
  v_mat := public.portal2027_mi_matricula(p.asignacion_id);
  if v_mat is null or not exists (select 1 from public.portal2027_equipo_integrantes where equipo_id = p_equipo and matricula_id = v_mat) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p.cerrado_en is not null then raise exception 'El periodo está cerrado'; end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;
  update public.portal2027_equipo_integrantes set confirmado_en = coalesce(confirmado_en, now())
    where equipo_id = p_equipo and matricula_id = v_mat;
  return jsonb_build_object('equipo_id', p_equipo, 'equipo_confirmado', public.portal2027_equipo_confirmado(p_equipo));
end $$;

-- Mis ejercicios (estudiante): solo los de mi grupo y el trimestre pedido. Sin nombres de compañeros.
create or replace function public.portal2027_mis_ejercicios(p_trimestre uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not public.portal2027_tiene_rol('estudiante') then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select coalesce(jsonb_agg(x.o order by x.o ->> 'fecha_inicio', x.o ->> 'titulo'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'ejercicio_id', e.id, 'titulo', e.titulo, 'juego', e.juego, 'modo', e.modo, 'cuenta_nota', e.modo = 'obligatorio',
      'participacion', e.participacion, 'tamano_equipo', e.tamano_equipo,
      'materia', mt.nombre, 'periodo_tipo', p.tipo, 'fecha_inicio', p.fecha_inicio, 'fecha_fin', p.fecha_fin,
      'periodo_cerrado', p.cerrado_en is not null,
      'equipo_id', public.portal2027_equipo_de(e.id, mi.m),
      'equipo_confirmado', coalesce(public.portal2027_equipo_confirmado(public.portal2027_equipo_de(e.id, mi.m)), false),
      'yo_confirme', coalesce((select i.confirmado_en is not null from public.portal2027_equipo_integrantes i where i.ejercicio_id = e.id and i.matricula_id = mi.m), false),
      'puede_jugar', public.portal2027_motivo_no_jugar(e.id, mi.m) is null,
      'motivo', public.portal2027_motivo_no_jugar(e.id, mi.m),
      'mejor_nota', public.portal2027_mejor_nota_ejercicio(e.id, mi.m)
    ) as o
    from public.portal2027_ejercicios e
    join public.portal2027_periodos_ejercicio p on p.id = e.periodo_id
    join public.portal2027_asignaciones a on a.id = p.asignacion_id
    join public.portal2027_materias mt on mt.id = a.materia_id
    cross join lateral (select public.portal2027_mi_matricula(a.id) as m) mi
    where p.trimestre_id = p_trimestre and e.eliminado_en is null and mi.m is not null
  ) x;
  return v_res;
end $$;

-- Iniciar un ejercicio: solo LEE y entrega una clave de envío nueva. No guarda nada ni da nota.
create or replace function public.portal2027_iniciar_ejercicio(p_ejercicio uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_asig uuid; v_mat uuid; v_motivo text; v_eq uuid;
begin
  if not public.portal2027_tiene_rol('estudiante') then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select * into e from public.portal2027_ejercicios where id = p_ejercicio;
  v_asig := public.portal2027_asig_de_ejercicio(p_ejercicio);
  v_mat := case when v_asig is null then null else public.portal2027_mi_matricula(v_asig) end;
  if e.id is null or v_mat is null then raise exception 'No tiene permiso para esta acción (row-level security)'; end if;
  v_motivo := public.portal2027_motivo_no_jugar(p_ejercicio, v_mat);
  v_eq := public.portal2027_equipo_de(p_ejercicio, v_mat);
  return jsonb_build_object(
    'ejercicio_id', e.id, 'titulo', e.titulo, 'juego', e.juego, 'modo', e.modo, 'cuenta_nota', e.modo = 'obligatorio',
    'participacion', e.participacion, 'tamano_equipo', e.tamano_equipo, 'equipo_id', v_eq,
    'puede_jugar', v_motivo is null, 'motivo', v_motivo,
    'mejor_nota', public.portal2027_mejor_nota_ejercicio(p_ejercicio, v_mat),
    'clave_envio', gen_random_uuid());
end $$;

-- Guardar un intento. Repetir el mismo envío (misma clave) NO crea otro intento. Se rechazan periodos o trimestres
-- cerrados, ejercicios en papelera y equipos sin confirmar. Nunca escribe en la libreta.
create or replace function public.portal2027_guardar_intento(p_ejercicio uuid, p_clave uuid, p_nota numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_asig uuid; v_mat uuid; v_motivo text; v_eq uuid; v_n integer;
begin
  if not public.portal2027_tiene_rol('estudiante') then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p_clave is null then raise exception 'Falta la clave de envío; inicie el ejercicio de nuevo'; end if;
  if p_nota is null or p_nota < 0 or p_nota > 5 then raise exception 'La nota debe estar entre 0 y 5'; end if;
  select * into e from public.portal2027_ejercicios where id = p_ejercicio for share;
  v_asig := public.portal2027_asig_de_ejercicio(p_ejercicio);
  v_mat := case when v_asig is null then null else public.portal2027_mi_matricula(v_asig) end;
  if e.id is null or v_mat is null then raise exception 'No tiene permiso para esta acción (row-level security)'; end if;

  -- Un reenvío exacto responde lo mismo, aunque el periodo se haya cerrado entre tanto.
  if exists (select 1 from public.portal2027_intentos where ejercicio_id = p_ejercicio and matricula_id = v_mat and clave_envio = p_clave) then
    return jsonb_build_object('repetido', true, 'cuenta_nota', e.modo = 'obligatorio',
      'mejor_nota', public.portal2027_mejor_nota_ejercicio(p_ejercicio, v_mat));
  end if;

  v_motivo := public.portal2027_motivo_no_jugar(p_ejercicio, v_mat);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  v_eq := case when e.participacion = 'equipo' then public.portal2027_equipo_de(p_ejercicio, v_mat) else null end;

  insert into public.portal2027_intentos (ejercicio_id, matricula_id, equipo_id, nota, clave_envio)
    values (p_ejercicio, v_mat, v_eq, p_nota, p_clave);
  select count(*) into v_n from public.portal2027_intentos
    where ejercicio_id = p_ejercicio and ((v_eq is null and matricula_id = v_mat and equipo_id is null) or (v_eq is not null and equipo_id = v_eq));
  return jsonb_build_object('repetido', false, 'cuenta_nota', e.modo = 'obligatorio', 'intentos', v_n,
    'mejor_nota', public.portal2027_mejor_nota_ejercicio(p_ejercicio, v_mat));
end $$;

-- ---------- Consolidar un periodo (profesor de la asignación o administración) ----------
-- Por cada estudiante del grupo: promedio de la MEJOR nota de cada ejercicio obligatorio (no archivado) del periodo;
-- los ejercicios sin intentos no cuentan (no son cero). Sin ningún ejercicio con nota: no se escribe nada (no se borra
-- una nota existente). Todo en una sola transacción y con el guardado común: permisos, columna bloqueada, trimestre
-- cerrado, versión e historial. Repetir la consolidación con los mismos intentos no cambia nada.
-- BLOQUEADA hasta que administración defina el método y el tratamiento de faltantes del año.
create or replace function public.portal2027_consolidar_periodo(p_periodo uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; cfg record; m record; v_anio uuid; v_notas numeric[]; v_det jsonb; v_prom numeric; v_val numeric;
  v_ver integer; v_res jsonb; v_proc integer := 0; v_con integer := 0; v_sin integer := 0; v_igual integer := 0;
  v_ej record; v_mejor numeric;
begin
  select * into p from public.portal2027_periodos_ejercicio where id = p_periodo for update;
  if not found then raise exception 'El periodo no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;

  select s.anio_id into v_anio from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id where a.id = p.asignacion_id;
  select * into cfg from public.portal2027_config_ejercicios where anio_id = v_anio;
  if not found or cfg.metodo = 'sin_definir' or cfg.faltantes = 'sin_definir' then
    raise exception 'Falta definir cómo se combinan los ejercicios y qué pasa con los faltantes (administración lo define por año)';
  end if;

  for m in select ma.id from public.portal2027_matriculas ma join public.portal2027_asignaciones a on a.salon_id = ma.salon_id
           where a.id = p.asignacion_id order by ma.id loop
    v_proc := v_proc + 1;
    v_notas := '{}'; v_det := '[]'::jsonb;
    for v_ej in select e.id, e.titulo from public.portal2027_ejercicios e
                where e.periodo_id = p_periodo and e.modo = 'obligatorio' and e.eliminado_en is null order by e.creado_en, e.id loop
      v_mejor := public.portal2027_mejor_nota_ejercicio(v_ej.id, m.id);
      v_det := v_det || jsonb_build_array(jsonb_build_object('ejercicio_id', v_ej.id, 'titulo', v_ej.titulo, 'mejor', v_mejor));
      if v_mejor is not null then v_notas := v_notas || v_mejor; end if;     -- faltante: no cuenta (no es cero)
    end loop;

    if coalesce(array_length(v_notas, 1), 0) = 0 then
      v_prom := null; v_val := null; v_sin := v_sin + 1;
    else
      select avg(x) into v_prom from unnest(v_notas) x;
      v_val := round(v_prom, 2);        -- la columna de notas guarda 2 decimales
    end if;

    insert into public.portal2027_consolidaciones (periodo_id, matricula_id, valor, detalle, consolidado_por, consolidado_en)
      values (p_periodo, m.id, v_val, jsonb_build_object('metodo', cfg.metodo, 'faltantes', cfg.faltantes, 'promedio', v_prom, 'ejercicios', v_det), auth.uid(), now())
    on conflict (periodo_id, matricula_id) do update
      set valor = excluded.valor, detalle = excluded.detalle, consolidado_por = auth.uid(), consolidado_en = now();

    if v_val is not null then
      select coalesce((select n.version from public.portal2027_notas n where n.evaluacion_id = p.evaluacion_id and n.matricula_id = m.id), 0) into v_ver;
      v_res := public.portal2027_guardar_nota(p.evaluacion_id, m.id, v_val, v_ver, 'Consolidación de ejercicios virtuales del periodo');
      if (v_res ->> 'sin_cambio')::boolean then v_igual := v_igual + 1; else v_con := v_con + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('procesados', v_proc, 'notas_escritas', v_con, 'sin_cambio', v_igual, 'sin_ejercicios_con_nota', v_sin);
end $$;

-- ---------- Ejecución ----------
revoke execute on function public.portal2027_asig_de_periodo(uuid), public.portal2027_asig_de_ejercicio(uuid) from public, anon;
grant execute on function public.portal2027_asig_de_periodo(uuid), public.portal2027_asig_de_ejercicio(uuid) to authenticated;
revoke execute on function public.portal2027_validar_periodo_ejercicio(), public.portal2027_mi_matricula(uuid), public.portal2027_equipo_de(uuid, uuid),
  public.portal2027_equipo_confirmado(uuid), public.portal2027_motivo_no_jugar(uuid, uuid), public.portal2027_mejor_nota_ejercicio(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.portal2027_crear_periodo_ejercicio(uuid, uuid, text, date, date, uuid),
  public.portal2027_cerrar_periodo_ejercicio(uuid, boolean),
  public.portal2027_crear_ejercicio(uuid, text, text, text, text, integer),
  public.portal2027_papelera_ejercicio(uuid, boolean),
  public.portal2027_crear_equipo(uuid, uuid[]), public.portal2027_disolver_equipo(uuid),
  public.portal2027_confirmar_equipo(uuid), public.portal2027_mis_ejercicios(uuid),
  public.portal2027_iniciar_ejercicio(uuid), public.portal2027_guardar_intento(uuid, uuid, numeric),
  public.portal2027_consolidar_periodo(uuid) from public, anon;
grant execute on function public.portal2027_crear_periodo_ejercicio(uuid, uuid, text, date, date, uuid),
  public.portal2027_cerrar_periodo_ejercicio(uuid, boolean),
  public.portal2027_crear_ejercicio(uuid, text, text, text, text, integer),
  public.portal2027_papelera_ejercicio(uuid, boolean),
  public.portal2027_crear_equipo(uuid, uuid[]), public.portal2027_disolver_equipo(uuid),
  public.portal2027_confirmar_equipo(uuid), public.portal2027_mis_ejercicios(uuid),
  public.portal2027_iniciar_ejercicio(uuid), public.portal2027_guardar_intento(uuid, uuid, numeric),
  public.portal2027_consolidar_periodo(uuid) to authenticated;
