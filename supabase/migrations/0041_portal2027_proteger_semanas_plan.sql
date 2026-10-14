-- 0041: las columnas de apreciación ligadas a la planificación no se pueden enviar a la papelera,
-- y se restauran las que ya estén en la papelera aunque su clase siga en la planificación (ej. Apreciación 3).
-- Requiere 0006 y 0029. Ejecutable varias veces. No borra datos ni notas.

-- 1) Protección en la base de datos (aunque alguien use otra pantalla).
create or replace function public.portal2027_papelera_evaluacion(p_id uuid, p_version integer, p_a_papelera boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare ev record; v_clase integer;
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
  if p_a_papelera then
    select numero into v_clase from public.portal2027_plan_clases
     where evaluacion_id = p_id and eliminada_en is null limit 1;
    if found then
      raise exception 'Esta columna pertenece a la Clase % de la planificación y no se puede enviar a la papelera. Para quitarla, quite la clase en Planificación.', v_clase;
    end if;
  end if;
  update public.portal2027_evaluaciones
    set eliminada_en = case when p_a_papelera then now() else null end, version = version + 1, actualizado_en = now()
    where id = p_id;
  insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, version)
    values (p_id, case when p_a_papelera then 'papelera' else 'restaurar' end, ev.version + 1);
  return ev.version + 1;
end $$;

-- 2) Reparación: restaura las apreciaciones de clases activas que estaban en la papelera
--    (no toca trimestres cerrados ni semanas que ya tengan otra columna activa).
with rest as (
  update public.portal2027_evaluaciones e
     set eliminada_en = null, version = e.version + 1, actualizado_en = now()
    from public.portal2027_plan_clases pc
   where pc.evaluacion_id = e.id and pc.eliminada_en is null and e.eliminada_en is not null
     and not public.portal2027_trimestre_cerrado(e.asignacion_id, e.trimestre_id)
     and not exists (select 1 from public.portal2027_evaluaciones o
                      where o.asignacion_id = e.asignacion_id and o.trimestre_id = e.trimestre_id
                        and o.categoria = 'apreciacion' and o.semana is not distinct from e.semana
                        and o.eliminada_en is null and o.id <> e.id)
  returning e.id, e.version
)
insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, version)
select id, 'restaurar', version from rest;

revoke execute on function public.portal2027_papelera_evaluacion(uuid, integer, boolean) from public, anon;
grant execute on function public.portal2027_papelera_evaluacion(uuid, integer, boolean) to authenticated;
notify pgrst, 'reload schema';
