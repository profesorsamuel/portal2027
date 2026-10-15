-- 0056: numeración estable de tareas por semana para la libreta.
-- Cada tarea conserva su grupo y nota individual (migraciones 0052-0055).
create or replace function public.portal2027_tareas_de_semana(p_evaluacion uuid)
returns table(grupo uuid, numero bigint, titulo text)
language sql stable security definer set search_path=public as $$
  select td.grupo,
         row_number() over(order by t.creado_en, t.id) as numero,
         t.titulo
  from public.portal2027_tareas_desglose td
  join public.portal2027_tareas t on t.id=td.tarea_id
  join public.portal2027_evaluaciones e on e.id=td.evaluacion_id
  where td.evaluacion_id=p_evaluacion
    and t.eliminada_en is null and e.eliminada_en is null
    and t.asignacion_id=e.asignacion_id and t.trimestre_id=e.trimestre_id
    and public.portal2027_puede_editar_asignacion(e.asignacion_id)
$$;
revoke all on function public.portal2027_tareas_de_semana(uuid) from public,anon;
grant execute on function public.portal2027_tareas_de_semana(uuid) to authenticated;
