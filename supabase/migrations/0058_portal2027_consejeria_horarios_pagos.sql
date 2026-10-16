-- ETAPAS 2-6: ejecutar una sola vez en Supabase SQL Editor.
create table if not exists public.portal2027_horario_grupo (
 id uuid primary key default gen_random_uuid(), salon_id uuid not null references public.portal2027_salones(id) on delete cascade,
 dia smallint not null check(dia between 1 and 5), hora_inicio time not null, hora_fin time not null,
 materia text not null check(length(materia) between 1 and 100), docente text not null default '',
 check(hora_fin>hora_inicio), unique(salon_id,dia,hora_inicio));
create table if not exists public.portal2027_actividades_consejeria (
 id uuid primary key default gen_random_uuid(), salon_id uuid not null references public.portal2027_salones(id) on delete cascade,
 titulo text not null check(length(titulo) between 1 and 120), descripcion text not null default '',
 monto numeric(10,2) not null check(monto>=0), fecha_limite date, creado_en timestamptz default now());
create table if not exists public.portal2027_pagos_consejeria (
 id uuid primary key default gen_random_uuid(), actividad_id uuid not null references public.portal2027_actividades_consejeria(id) on delete cascade,
 estudiante_id uuid not null references public.portal2027_estudiantes(id) on delete cascade,
 abono numeric(10,2) not null default 0 check(abono>=0), actualizado_en timestamptz default now(),
 unique(actividad_id,estudiante_id));
create or replace function public.portal2027_es_alumno_salon(p_salon uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.portal2027_matriculas m join public.portal2027_estudiantes e on e.id=m.estudiante_id
 where m.salon_id=p_salon and e.usuario_id=auth.uid()); $$;
revoke all on function public.portal2027_es_alumno_salon(uuid) from public,anon;
grant execute on function public.portal2027_es_alumno_salon(uuid) to authenticated;
create or replace function public.portal2027_es_mi_pago(p_estudiante uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.portal2027_estudiantes e where e.id=p_estudiante and e.usuario_id=auth.uid()); $$;
revoke all on function public.portal2027_es_mi_pago(uuid) from public,anon;
grant execute on function public.portal2027_es_mi_pago(uuid) to authenticated;
alter table public.portal2027_horario_grupo enable row level security;
alter table public.portal2027_actividades_consejeria enable row level security;
alter table public.portal2027_pagos_consejeria enable row level security;
grant select,insert,update,delete on public.portal2027_horario_grupo,public.portal2027_actividades_consejeria,public.portal2027_pagos_consejeria to authenticated;
create policy horario_grupo_ver on public.portal2027_horario_grupo for select to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id) or public.portal2027_es_alumno_salon(salon_id));
create policy horario_grupo_insert on public.portal2027_horario_grupo for insert to authenticated with check(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy horario_grupo_update on public.portal2027_horario_grupo for update to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id)) with check(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy horario_grupo_delete on public.portal2027_horario_grupo for delete to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy actividad_ver on public.portal2027_actividades_consejeria for select to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id) or public.portal2027_es_alumno_salon(salon_id));
create policy actividad_insert on public.portal2027_actividades_consejeria for insert to authenticated with check(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy actividad_update on public.portal2027_actividades_consejeria for update to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id)) with check(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy actividad_delete on public.portal2027_actividades_consejeria for delete to authenticated using(public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(salon_id));
create policy pago_ver on public.portal2027_pagos_consejeria for select to authenticated using(public.portal2027_es_mi_pago(estudiante_id) or exists(select 1 from public.portal2027_actividades_consejeria a where a.id=actividad_id and (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(a.salon_id))));
create policy pago_insert on public.portal2027_pagos_consejeria for insert to authenticated with check(exists(select 1 from public.portal2027_actividades_consejeria a join public.portal2027_matriculas m on m.salon_id=a.salon_id and m.estudiante_id=portal2027_pagos_consejeria.estudiante_id where a.id=actividad_id and (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(a.salon_id))));
create policy pago_update on public.portal2027_pagos_consejeria for update to authenticated using(exists(select 1 from public.portal2027_actividades_consejeria a where a.id=actividad_id and (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(a.salon_id)))) with check(exists(select 1 from public.portal2027_actividades_consejeria a join public.portal2027_matriculas m on m.salon_id=a.salon_id and m.estudiante_id=portal2027_pagos_consejeria.estudiante_id where a.id=actividad_id and (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(a.salon_id))));
create policy pago_delete on public.portal2027_pagos_consejeria for delete to authenticated using(exists(select 1 from public.portal2027_actividades_consejeria a where a.id=actividad_id and (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(a.salon_id))));
