-- 0043: restaura la Clase 3 de la planificación (y su «Apreciación 3» en la libreta) en los grupos
-- que la perdieron (ej. 9B), copiándola del grupo hermano donde sí existe (ej. 9C).
-- Ejecutar DESPUÉS de 0041 y 0042. Se puede ejecutar varias veces. No borra datos ni notas.
-- Si la columna de apreciación estaba en la papelera, se restaura con sus notas.
-- Para otra clase, cambie el 3 de la línea «v_num constant integer := 3».

do $$
declare
  v_num constant integer := 3;
  r record; src record; mine record; viejo record; cruce record;
  v_n integer := 0;
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'portal2027_asegurar_semanas_plan_interna') then
    raise exception 'Falta ejecutar primero las migraciones 0041 y 0042.';
  end if;

  -- Todo grupo (asignación + trimestre) que NO tiene activa la clase v_num pero cuyo grupo hermano sí.
  for r in
    select distinct a.id as asignacion_id, s.nombre as salon, src_pc.trimestre_id
      from public.portal2027_asignaciones a
      join public.portal2027_salones s on s.id = a.salon_id
      join public.portal2027_asignaciones a2
        on a2.id <> a.id and a2.materia_id = a.materia_id
       and a2.profesor_id is not distinct from a.profesor_id
      join public.portal2027_salones s2
        on s2.id = a2.salon_id and s2.grado = s.grado and s2.anio_id = s.anio_id
      join public.portal2027_plan_clases src_pc
        on src_pc.asignacion_id = a2.id and src_pc.numero = v_num and src_pc.eliminada_en is null
     where not exists (select 1 from public.portal2027_plan_clases x
                        where x.asignacion_id = a.id and x.trimestre_id = src_pc.trimestre_id
                          and x.numero = v_num and x.eliminada_en is null)
       and not public.portal2027_trimestre_cerrado(a.id, src_pc.trimestre_id)
  loop
    -- Clase modelo: la del hermano (se prefiere el grupo «C», como el 9C).
    select pc.* into src
      from public.portal2027_asignaciones a
      join public.portal2027_salones s on s.id = a.salon_id
      join public.portal2027_asignaciones a2
        on a2.id <> a.id and a2.materia_id = a.materia_id and a2.profesor_id is not distinct from a.profesor_id
      join public.portal2027_salones s2 on s2.id = a2.salon_id and s2.grado = s.grado and s2.anio_id = s.anio_id
      join public.portal2027_plan_clases pc
        on pc.asignacion_id = a2.id and pc.trimestre_id = r.trimestre_id and pc.numero = v_num and pc.eliminada_en is null
     where a.id = r.asignacion_id
     order by (s2.nombre::text ilike '%c') desc, s2.nombre
     limit 1;

    -- Si las fechas chocan con otra clase activa de este grupo, se omite y se avisa.
    select numero into cruce from public.portal2027_plan_clases
     where asignacion_id = r.asignacion_id and trimestre_id = r.trimestre_id and eliminada_en is null
       and fecha_inicio <= src.fecha_fin and fecha_fin >= src.fecha_inicio limit 1;
    if found then
      raise notice 'Grupo %: se omite, las fechas de la clase % se cruzan con la clase %.', r.salon, v_num, cruce.numero;
      continue;
    end if;

    -- ¿Existe la clase borrada (papelera de planificación)? Se restaura; si no, se crea.
    select * into viejo from public.portal2027_plan_clases
     where asignacion_id = r.asignacion_id and trimestre_id = r.trimestre_id and numero = v_num
     order by eliminada_en desc nulls last limit 1;
    if found then
      update public.portal2027_plan_clases
         set eliminada_en = null, tema = src.tema, fecha_inicio = src.fecha_inicio, fecha_fin = src.fecha_fin,
             version = version + 1, actualizado_en = now()
       where id = viejo.id;
    else
      insert into public.portal2027_plan_clases (asignacion_id, trimestre_id, numero, tema, fecha_inicio, fecha_fin)
        values (r.asignacion_id, r.trimestre_id, v_num, src.tema, src.fecha_inicio, src.fecha_fin);
    end if;

    -- Restaura (o crea) la columna «Apreciación N» y la liga a la clase.
    perform public.portal2027_asegurar_semanas_plan_interna(r.asignacion_id, r.trimestre_id);
    v_n := v_n + 1;
    raise notice 'Grupo %: clase % restaurada.', r.salon, v_num;
  end loop;

  if v_n = 0 then
    raise notice 'No había nada que restaurar (todos los grupos ya tienen la clase %).', v_num;
  end if;

  -- Reparación final de todos los grupos (restaura columnas que estén en la papelera).
  for r in select distinct asignacion_id, trimestre_id from public.portal2027_plan_clases where eliminada_en is null loop
    perform public.portal2027_asegurar_semanas_plan_interna(r.asignacion_id, r.trimestre_id);
  end loop;
end $$;
notify pgrst, 'reload schema';
