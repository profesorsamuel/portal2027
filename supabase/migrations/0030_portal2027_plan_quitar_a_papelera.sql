-- 0030: al quitar una clase de la planificación, su apreciación semanal va a la papelera de la libreta.
-- Solo hace falta si ya ejecutó una 0029 anterior. Ejecutable varias veces.
-- Quitar una clase de la planificación. Su apreciación semanal pasa a la PAPELERA de la libreta
-- (no se borra: deja de contar y se puede restaurar). Si esa columna está bloqueada, se queda donde está.
create or replace function public.portal2027_eliminar_plan_clase(p_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pl record; ev record; v_pap boolean := false;
begin
  select * into pl from public.portal2027_plan_clases where id = p_id for update;
  if not found or pl.eliminada_en is not null then raise exception 'La clase no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(pl.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(pl.asignacion_id, pl.trimestre_id) then
    raise exception 'El trimestre está cerrado';
  end if;
  if pl.version is distinct from p_version then
    raise exception 'CONFLICTO: la planificación cambió desde que la abrió.';
  end if;
  update public.portal2027_plan_clases set eliminada_en = now(), version = version + 1, actualizado_en = now() where id = p_id;
  if pl.evaluacion_id is not null then
    select * into ev from public.portal2027_evaluaciones where id = pl.evaluacion_id for update;
    if found and ev.eliminada_en is null and not ev.bloqueada then
      update public.portal2027_evaluaciones set eliminada_en = now(), version = version + 1, actualizado_en = now() where id = ev.id;
      insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, version) values (ev.id, 'papelera', ev.version + 1);
      v_pap := true;
    end if;
  end if;
  return jsonb_build_object('eliminada', true, 'apreciacion_en_papelera', v_pap);
end $$;

revoke execute on function public.portal2027_eliminar_plan_clase(uuid, integer) from public, anon;
grant execute on function public.portal2027_eliminar_plan_clase(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
