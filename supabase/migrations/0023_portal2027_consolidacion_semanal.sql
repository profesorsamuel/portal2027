-- 0023: Consolidación de ejercicios virtuales hacia desglose semanal.
-- REQUIERE que la migración 0022 haya sido completada y probada.
-- No ejecutar aún en producción: el paquete 0022 anterior era parcial.
-- Reutiliza el cálculo y la configuración del periodo existentes.
create or replace function public.portal2027_consolidar_periodo(p_periodo uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; cfg record; m record; v_anio uuid; v_notas numeric[]; v_det jsonb; v_prom numeric; v_val numeric;
  v_ver integer; v_res jsonb; v_proc integer := 0; v_con integer := 0; v_sin integer := 0; v_igual integer := 0;
  v_ej record; v_mejor numeric; v_semana integer; v_reg record;
begin
  select * into p from public.portal2027_periodos_ejercicio where id = p_periodo for update;
  if not found then raise exception 'El periodo no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(p.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p.asignacion_id, p.trimestre_id) then raise exception 'El trimestre está cerrado'; end if;

  select s.anio_id into v_anio from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id where a.id = p.asignacion_id;
  select * into cfg from public.portal2027_config_ejercicios where anio_id = v_anio;
  if not found or cfg.metodo = 'sin_definir' or cfg.faltantes = 'sin_definir' then
    raise exception 'Falta definir cómo se combinan los ejercicios y qué pasa con los faltantes (administración lo define por año)';
  end if;

  select e.semana into v_semana from public.portal2027_evaluaciones e where e.id=p.evaluacion_id;
  if v_semana is null then
    raise exception 'Seleccione una columna de Apreciación semanal antes de consolidar';
  end if;

  for m in select ma.id from public.portal2027_matriculas ma join public.portal2027_asignaciones a on a.salon_id = ma.salon_id
           where a.id = p.asignacion_id order by ma.id loop
    v_proc := v_proc + 1;
    v_notas := '{}'; v_det := '[]'::jsonb;
    for v_ej in select e.id, e.titulo from public.portal2027_ejercicios e
                where e.periodo_id = p_periodo and e.modo = 'obligatorio' and e.eliminado_en is null order by e.creado_en, e.id loop
      v_mejor := public.portal2027_mejor_nota_ejercicio(v_ej.id, m.id);
      v_det := v_det || jsonb_build_array(jsonb_build_object('ejercicio_id', v_ej.id, 'titulo', v_ej.titulo, 'mejor', v_mejor));
      if v_mejor is not null then v_notas := v_notas || v_mejor; end if;     -- faltante: no cuenta (no es cero)
    end loop;

    if coalesce(array_length(v_notas, 1), 0) = 0 then
      v_prom := null; v_val := null; v_sin := v_sin + 1;
    else
      select avg(x) into v_prom from unnest(v_notas) x;
      v_val := round(v_prom, 2);        -- la columna de notas guarda 2 decimales
    end if;

    insert into public.portal2027_consolidaciones (periodo_id, matricula_id, valor, detalle, consolidado_por, consolidado_en)
      values (p_periodo, m.id, v_val, jsonb_build_object('metodo', cfg.metodo, 'faltantes', cfg.faltantes, 'promedio', v_prom, 'ejercicios', v_det), auth.uid(), now())
    on conflict (periodo_id, matricula_id) do update
      set valor = excluded.valor, detalle = excluded.detalle, consolidado_por = auth.uid(), consolidado_en = now();

    if v_val is not null then
      select r.id, r.version into v_reg from public.portal2027_registros_semana r
       where r.evaluacion_id=p.evaluacion_id and r.matricula_id=m.id
         and r.tipo='Ejercicio virtual' and r.descripcion=('Periodo ' || p_periodo::text)
       order by r.actualizado_en desc limit 1;
      v_res := public.portal2027_guardar_registro_semana(
        v_reg.id, p.evaluacion_id, m.id, 'Ejercicio virtual',
        'Periodo ' || p_periodo::text, v_val, coalesce(v_reg.version,0));
      if (v_res ->> 'sin_cambio')::boolean then v_igual := v_igual + 1; else v_con := v_con + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('procesados', v_proc, 'notas_escritas', v_con, 'sin_cambio', v_igual, 'sin_ejercicios_con_nota', v_sin);
end $$;

revoke execute on function public.portal2027_consolidar_periodo(uuid) from public, anon;
grant execute on function public.portal2027_consolidar_periodo(uuid) to authenticated;
