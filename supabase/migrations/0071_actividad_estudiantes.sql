-- Actividad 2027. Ejecutar tras 0070. El servidor deriva identidad, grupo y fecha.
create table if not exists public.portal2027_actividad (
 id bigint generated always as identity primary key,
 estudiante_id uuid not null references public.portal2027_estudiantes(id) on delete cascade,
 salon_id uuid not null references public.portal2027_salones(id),
 anio_id uuid not null references public.portal2027_anios(id),
 evento text not null check (evento in ('ingreso','notas','tareas','asistencia','boletin_visto','pdf_descargado')),
 detalle text not null default '',
 ocurrido_en timestamptz not null default now()
);
create index if not exists portal2027_actividad_salon_fecha on public.portal2027_actividad(salon_id, ocurrido_en desc);
create index if not exists portal2027_actividad_est_fecha on public.portal2027_actividad(estudiante_id, ocurrido_en desc);
alter table public.portal2027_actividad enable row level security;
revoke all on public.portal2027_actividad from anon, authenticated;
-- El RPC permite únicamente eventos del propio estudiante; no acepta ID ni fecha del cliente.
create or replace function public.portal2027_registrar_actividad(p_evento text, p_detalle text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare v_est uuid; v_salon uuid; v_anio uuid;
begin
 if auth.uid() is null or p_evento not in ('ingreso','notas','tareas','asistencia','boletin_visto','pdf_descargado') then raise exception 'Evento no autorizado'; end if;
 select e.id,m.salon_id,m.anio_id into v_est,v_salon,v_anio
 from public.portal2027_estudiantes e join public.portal2027_matriculas m on m.estudiante_id=e.id
 join public.portal2027_anios a on a.id=m.anio_id and a.activo
 where e.usuario_id=auth.uid() and m.estado='activo' limit 1;
 if v_est is null then return; end if;
 -- Un ingreso por minuto; las demás acciones se registran individualmente.
 if p_evento='ingreso' and exists(select 1 from public.portal2027_actividad x where x.estudiante_id=v_est and x.evento='ingreso' and x.ocurrido_en>now()-interval '1 minute') then return; end if;
 insert into public.portal2027_actividad(estudiante_id,salon_id,anio_id,evento,detalle)
 values(v_est,v_salon,v_anio,p_evento,left(coalesce(p_detalle,''),120));
end $$;
revoke all on function public.portal2027_registrar_actividad(text,text) from public;
grant execute on function public.portal2027_registrar_actividad(text,text) to authenticated;
-- Lectura agregada por salón con comprobación de rol, sin exponer eventos de otros grupos.
create or replace function public.portal2027_consultar_actividad(p_salon uuid default null,p_desde timestamptz default null,p_hasta timestamptz default null)
returns table(estudiante_id uuid,estudiante text,salon text,salon_id uuid,evento text,detalle text,ocurrido_en timestamptz)
language sql stable security definer set search_path = '' as $$
 select x.estudiante_id, e.apellidos||', '||e.nombres,s.nombre,x.salon_id,x.evento,x.detalle,x.ocurrido_en
 from public.portal2027_actividad x join public.portal2027_estudiantes e on e.id=x.estudiante_id
 join public.portal2027_salones s on s.id=x.salon_id
 where (p_salon is null or x.salon_id=p_salon)
 and (p_desde is null or x.ocurrido_en>=p_desde) and (p_hasta is null or x.ocurrido_en<p_hasta)
 and (public.portal2027_es_admin() or public.portal2027_es_profesor_de_salon(x.salon_id) or public.portal2027_es_consejero_de_salon(x.salon_id))
 order by x.ocurrido_en desc limit 10000;
$$;
revoke all on function public.portal2027_consultar_actividad(uuid,timestamptz,timestamptz) from public;
grant execute on function public.portal2027_consultar_actividad(uuid,timestamptz,timestamptz) to authenticated;
