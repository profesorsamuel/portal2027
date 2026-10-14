-- 0042: cada clase de la planificación tiene SIEMPRE su columna «Apreciación N» en la libreta.
-- Si falta (está en la papelera o no existe), se restaura o se crea con su tema y fechas, en su lugar.
-- Requiere 0006, 0021, 0022, 0029 y 0041. Ejecutable varias veces. No borra datos ni notas.

-- Trabajo interno (sin permisos de sesión; no se expone a la app).
create or replace function public.portal2027_asegurar_semanas_plan_interna(p_asignacion uuid, p_trimestre uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare pc record; ev record; v_orden integer; v_n integer := 0;
begin
  if public.portal2027_trimestre_cerrado(p_asignacion, p_trimestre) then return 0; end if;
  for pc in select * from public.portal2027_plan_clases
             where asignacion_id = p_asignacion and trimestre_id = p_trimestre and eliminada_en is null order by numero
  loop
    select * into ev from public.portal2027_evaluaciones
     where asignacion_id = p_asignacion and trimestre_id = p_trimestre and categoria = 'apreciacion'
       and semana = pc.numero and eliminada_en is null order by orden, id limit 1;
    if not found then
      select * into ev from public.portal2027_evaluaciones
       where asignacion_id = p_asignacion and trimestre_id = p_trimestre and categoria = 'apreciacion'
         and semana = pc.numero and eliminada_en is not null order by eliminada_en desc limit 1;
      if found then
        update public.portal2027_evaluaciones set eliminada_en = null, version = version + 1, actualizado_en = now() where id = ev.id;
        insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, version) values (ev.id, 'restaurar', ev.version + 1);
      else
        select min(orden) - 1 into v_orden from public.portal2027_evaluaciones
         where asignacion_id = p_asignacion and trimestre_id = p_trimestre and categoria = 'apreciacion'
           and semana > pc.numero and eliminada_en is null;
        if v_orden is null then
          select coalesce(max(orden), 0) + 1 into v_orden from public.portal2027_evaluaciones
           where asignacion_id = p_asignacion and trimestre_id = p_trimestre;
        end if;
        insert into public.portal2027_evaluaciones (asignacion_id, trimestre_id, categoria, tema, tipo, orden, semana, semana_inicio, semana_fin)
          values (p_asignacion, p_trimestre, 'apreciacion', left('Semana ' || pc.numero || ' · ' || pc.tema, 120), '', v_orden, pc.numero, pc.fecha_inicio, pc.fecha_fin)
          returning * into ev;
        insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, detalle, version)
          values (ev.id, 'crear', jsonb_build_object('origen', 'planificacion', 'clase', pc.numero), 1);
      end if;
      v_n := v_n + 1;
    end if;
    if pc.evaluacion_id is distinct from ev.id then
      update public.portal2027_plan_clases set evaluacion_id = ev.id where id = pc.id;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.portal2027_asegurar_semanas_plan_interna(uuid, uuid) from public, anon, authenticated;

-- Versión que usa la libreta al abrirse (con permisos).
create or replace function public.portal2027_asegurar_semanas_plan(p_asignacion uuid, p_trimestre uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'Sin permiso para esta asignación';
  end if;
  return public.portal2027_asegurar_semanas_plan_interna(p_asignacion, p_trimestre);
end $$;
revoke all on function public.portal2027_asegurar_semanas_plan(uuid, uuid) from public, anon;
grant execute on function public.portal2027_asegurar_semanas_plan(uuid, uuid) to authenticated;

-- Reparación inmediata de todos los grupos (9B, etc.).
do $$
declare r record;
begin
  for r in select distinct asignacion_id, trimestre_id from public.portal2027_plan_clases where eliminada_en is null loop
    perform public.portal2027_asegurar_semanas_plan_interna(r.asignacion_id, r.trimestre_id);
  end loop;
end $$;
notify pgrst, 'reload schema';
