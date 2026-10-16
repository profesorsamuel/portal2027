-- Actividades generales del grupo, independientes de pagos.
create table if not exists public.portal2027_actividades_generales (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.portal2027_salones(id) on delete cascade,
 titulo text not null check(length(trim(titulo)) between 1 and 200),
 descripcion text not null default '',
 enlace text,
 fecha_limite date,
 visible boolean not null default true,
 creado_en timestamptz not null default now()
);
create index if not exists actividades_generales_salon on public.portal2027_actividades_generales(salon_id,creado_en);
alter table public.portal2027_actividades_generales enable row level security;
grant select,insert,update,delete on public.portal2027_actividades_generales to authenticated;
create policy actividades_generales_ver on public.portal2027_actividades_generales for select to authenticated using (
 public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id) or (visible and public.portal2027_es_alumno_salon(salon_id))
);
create policy actividades_generales_insert on public.portal2027_actividades_generales for insert to authenticated with check(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy actividades_generales_update on public.portal2027_actividades_generales for update to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id)) with check(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy actividades_generales_delete on public.portal2027_actividades_generales for delete to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
