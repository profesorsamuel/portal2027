-- 0008_portal2027_configuracion.sql
-- Etapa 4, parte B: periodos (fechas de trimestres), pesos por categoría y estados de nota (pendiente/exento).
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0007.
-- IMPORTANTE (condición de la guía): esto solo GUARDA configuración. Ningún peso ni estado se usa todavía
-- en el cálculo de notas ni de asistencia; el final sigue siendo el promedio simple de las categorías con nota.

-- Quién y cuándo cambió cada configuración.
create function public.portal2027_marcar_config()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end $$;

-- ---------- Pesos por categoría y año (nulo = sin definir) ----------
create table public.portal2027_pesos_categoria (
  anio_id         uuid not null references public.portal2027_anios (id) on delete cascade,
  categoria       text not null check (categoria in ('apreciacion', 'ejercicio_escrito', 'examen')),
  peso            numeric(5, 2) check (peso is null or (peso >= 0 and peso <= 100)),
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  primary key (anio_id, categoria)
);
create trigger portal2027_pesos_marcar before insert or update on public.portal2027_pesos_categoria
  for each row execute function public.portal2027_marcar_config();

-- ---------- Estados de nota (pendiente, exento...). "efecto" queda SIN DEFINIR hasta que usted lo decida ----------
create table public.portal2027_estados_nota (
  codigo          text primary key check (codigo ~ '^[a-z_]{1,20}$'),
  etiqueta        text not null check (length(trim(etiqueta)) > 0),
  abreviatura     text not null check (length(trim(abreviatura)) between 1 and 3),
  orden           integer not null default 0,
  activo          boolean not null default true,
  efecto          text not null default 'sin_definir' check (efecto = 'sin_definir'),
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en  timestamptz not null default now()
);
create trigger portal2027_estados_nota_marcar before insert or update on public.portal2027_estados_nota
  for each row execute function public.portal2027_marcar_config();
insert into public.portal2027_estados_nota (codigo, etiqueta, abreviatura, orden) values
  ('pendiente', 'Pendiente', 'PEN', 1),
  ('exento',    'Exento',    'EXE', 2);

-- Los estados de asistencia (0007) también registran quién y cuándo.
alter table public.portal2027_estados_asistencia
  add column actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  add column actualizado_en  timestamptz not null default now();
create trigger portal2027_estados_asistencia_marcar before insert or update on public.portal2027_estados_asistencia
  for each row execute function public.portal2027_marcar_config();

-- ---------- Fechas de trimestres: sin cruces y sin dejar sesiones de asistencia fuera ----------
create function public.portal2027_validar_trimestre()
returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  for o in select numero, fecha_inicio, fecha_fin from public.portal2027_trimestres
           where anio_id = new.anio_id and id <> new.id loop
    if o.numero < new.numero and o.fecha_fin is not null and new.fecha_inicio is not null and new.fecha_inicio <= o.fecha_fin then
      raise exception 'Las fechas se cruzan con el trimestre %', o.numero;
    end if;
    if o.numero > new.numero and o.fecha_inicio is not null and new.fecha_fin is not null and new.fecha_fin >= o.fecha_inicio then
      raise exception 'Las fechas se cruzan con el trimestre %', o.numero;
    end if;
  end loop;
  if exists (
    select 1 from public.portal2027_sesiones_asistencia s
    where s.trimestre_id = new.id
      and ((new.fecha_inicio is not null and s.fecha < new.fecha_inicio) or (new.fecha_fin is not null and s.fecha > new.fecha_fin))
  ) then
    raise exception 'Hay sesiones de asistencia fuera de esas fechas; cámbielas o restáurelas primero';
  end if;
  return new;
end $$;
create trigger portal2027_trimestres_validar before update of fecha_inicio, fecha_fin on public.portal2027_trimestres
  for each row execute function public.portal2027_validar_trimestre();

-- ---------- Permisos: lectura con rol; escritura solo administración (RLS) ----------
revoke all on public.portal2027_pesos_categoria, public.portal2027_estados_nota from anon;
revoke delete, truncate, references, trigger on public.portal2027_pesos_categoria, public.portal2027_estados_nota from authenticated;
grant select, insert, update on public.portal2027_pesos_categoria, public.portal2027_estados_nota to authenticated;
alter table public.portal2027_pesos_categoria enable row level security;
alter table public.portal2027_estados_nota    enable row level security;

create policy portal2027_pesos_ver on public.portal2027_pesos_categoria
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_pesos_ins on public.portal2027_pesos_categoria
  for insert to authenticated with check (public.portal2027_es_admin());
create policy portal2027_pesos_upd on public.portal2027_pesos_categoria
  for update to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_estados_nota_ver on public.portal2027_estados_nota
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_estados_nota_ins on public.portal2027_estados_nota
  for insert to authenticated with check (public.portal2027_es_admin());
create policy portal2027_estados_nota_upd on public.portal2027_estados_nota
  for update to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());
