-- 0001_portal2027_tablas.sql
-- Etapa 1, parte A: tablas base del portal2027.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, en orden (0001, 0002, 0003, 0004).

-- Perfiles: uno por cuenta de Supabase Auth.
create table public.portal2027_perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombres    text not null default '',
  apellidos  text not null default '',
  correo     text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Roles múltiples: una fila por persona y rol.
create table public.portal2027_roles_usuario (
  usuario_id   uuid not null references public.portal2027_perfiles (id) on delete cascade,
  rol          text not null check (rol in ('administrador', 'profesor', 'consejero', 'estudiante')),
  asignado_por uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en    timestamptz not null default now(),
  primary key (usuario_id, rol)
);

-- Años lectivos: el año es un dato, no está fijo en el código.
create table public.portal2027_anios (
  id         uuid primary key default gen_random_uuid(),
  anio       integer not null unique check (anio between 2000 and 2100),
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);
-- Solo un año puede estar activo a la vez.
create unique index portal2027_anios_un_activo on public.portal2027_anios (activo) where activo;

-- Tres trimestres por año.
create table public.portal2027_trimestres (
  id           uuid primary key default gen_random_uuid(),
  anio_id      uuid not null references public.portal2027_anios (id) on delete cascade,
  numero       smallint not null check (numero between 1 and 3),
  fecha_inicio date,
  fecha_fin    date,
  unique (anio_id, numero),
  check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio)
);

-- Grupos (grado 9 + sección C = 9C).
create table public.portal2027_salones (
  id         uuid primary key default gen_random_uuid(),
  anio_id    uuid not null references public.portal2027_anios (id) on delete restrict,
  grado      text not null check (grado ~ '^[0-9]{1,2}$'),
  seccion    text not null check (seccion ~ '^[A-Z]{1,2}$'),
  nombre     text generated always as (grado || seccion) stored,
  creado_en  timestamptz not null default now(),
  unique (anio_id, grado, seccion)
);

create table public.portal2027_materias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (length(trim(nombre)) > 0),
  creado_en  timestamptz not null default now()
);
create unique index portal2027_materias_nombre_unico on public.portal2027_materias (lower(nombre));

-- Asignaciones: qué profesor da qué materia en qué grupo.
create table public.portal2027_asignaciones (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.portal2027_salones (id) on delete cascade,
  materia_id  uuid not null references public.portal2027_materias (id) on delete restrict,
  profesor_id uuid not null references public.portal2027_perfiles (id) on delete restrict,
  creado_en   timestamptz not null default now(),
  unique (salon_id, materia_id, profesor_id)
);
create index portal2027_asignaciones_profesor_idx on public.portal2027_asignaciones (profesor_id);

-- Al crear un año se crean sus tres trimestres.
create function public.portal2027_crear_trimestres()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.portal2027_trimestres (anio_id, numero)
  select new.id, n from generate_series(1, 3) as n;
  return new;
end $$;

create trigger portal2027_anios_crear_trimestres
  after insert on public.portal2027_anios
  for each row execute function public.portal2027_crear_trimestres();

-- Al crear una cuenta en Auth se crea su perfil. No se asigna ningún rol.
create function public.portal2027_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.portal2027_perfiles (id, correo, nombres, apellidos)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombres', ''),
    coalesce(new.raw_user_meta_data ->> 'apellidos', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger portal2027_al_crear_usuario
  after insert on auth.users
  for each row execute function public.portal2027_nuevo_usuario();

-- Una asignación solo puede apuntar a una persona con rol profesor.
create function public.portal2027_validar_asignacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_roles_usuario
    where usuario_id = new.profesor_id and rol = 'profesor'
  ) then
    raise exception 'La persona asignada no tiene el rol profesor';
  end if;
  return new;
end $$;

create trigger portal2027_asignaciones_validar
  before insert or update on public.portal2027_asignaciones
  for each row execute function public.portal2027_validar_asignacion();
