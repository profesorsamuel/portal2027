-- 0037_portal2027_guardar_registro_semana_produccion.sql
-- Copia fiel de la función que YA está en producción (obtenida con pg_get_functiondef).
-- Incluye el parámetro p_grupo y la columna grupo. NO la ejecute de nuevo en producción:
-- sirve para que el repositorio refleje la base real. Si la base ya la tiene, no hace falta correrla.
-- OJO: convive con la versión de 7 parámetros de la 0022 (usada por la 0023). Ver notas.

CREATE OR REPLACE FUNCTION public.portal2027_guardar_registro_semana(p_id uuid, p_evaluacion uuid, p_matricula uuid, p_tipo text, p_descripcion text, p_valor numeric, p_version integer, p_grupo uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e record; r record; v_id uuid; v_ver integer; v_ant jsonb; v_grupo uuid;
begin
  select * into e from public.portal2027_evaluaciones where id = p_evaluacion for update;
  if not found or e.categoria <> 'apreciacion' or e.semana is null then raise exception 'Semana no válida'; end if;
  if not public.portal2027_puede_editar_asignacion(e.asignacion_id) or public.portal2027_trimestre_cerrado(e.asignacion_id, e.trimestre_id) then
    raise exception 'Sin permiso o trimestre cerrado';
  end if;
  if e.bloqueada or e.eliminada_en is not null then raise exception 'Columna bloqueada o eliminada'; end if;
  if not exists (select 1 from public.portal2027_matriculas m join public.portal2027_asignaciones a on a.salon_id = m.salon_id
                 where m.id = p_matricula and a.id = e.asignacion_id) then
    raise exception 'Matrícula ajena al grupo';
  end if;
  if length(trim(coalesce(p_tipo, ''))) not between 1 and 40 or length(coalesce(p_descripcion, '')) > 120
     or (p_valor is not null and (p_valor < 0 or p_valor > 5)) then
    raise exception 'Datos fuera de rango';
  end if;

  if p_id is null then
    if coalesce(p_version, 0) <> 0 then raise exception 'CONFLICTO: versión incorrecta'; end if;
    v_grupo := coalesce(p_grupo, md5(p_evaluacion::text || '|' || trim(p_tipo) || '|' || coalesce(p_descripcion, ''))::uuid);
    if exists (select 1 from public.portal2027_registros_semana where evaluacion_id = p_evaluacion and matricula_id = p_matricula and grupo = v_grupo) then
      raise exception 'CONFLICTO: ese registro ya existe. Recargue el desglose';
    end if;
    insert into public.portal2027_registros_semana (evaluacion_id, matricula_id, tipo, descripcion, valor, grupo, actualizado_por)
      values (p_evaluacion, p_matricula, trim(p_tipo), coalesce(p_descripcion, ''), p_valor, v_grupo, auth.uid())
      returning id, version into v_id, v_ver;
    insert into public.portal2027_historial_registros_semana (registro_id, evaluacion_id, matricula_id, accion, nuevo, version)
      values (v_id, p_evaluacion, p_matricula, 'crear',
              jsonb_build_object('tipo', p_tipo, 'descripcion', p_descripcion, 'valor', p_valor, 'grupo', v_grupo), v_ver);
  else
    select * into r from public.portal2027_registros_semana where id = p_id for update;
    if not found or r.evaluacion_id <> p_evaluacion or r.matricula_id <> p_matricula then raise exception 'Registro no encontrado'; end if;
    if r.version is distinct from p_version then raise exception 'CONFLICTO: recargue el desglose'; end if;
    v_ant := jsonb_build_object('tipo', r.tipo, 'descripcion', r.descripcion, 'valor', r.valor);
    update public.portal2027_registros_semana
      set tipo = trim(p_tipo), descripcion = coalesce(p_descripcion, ''), valor = p_valor, version = version + 1,
          actualizado_por = auth.uid(), actualizado_en = now()
      where id = p_id returning id, version into v_id, v_ver;
    insert into public.portal2027_historial_registros_semana (registro_id, evaluacion_id, matricula_id, accion, anterior, nuevo, version)
      values (v_id, p_evaluacion, p_matricula, 'actualizar', v_ant,
              jsonb_build_object('tipo', p_tipo, 'descripcion', p_descripcion, 'valor', p_valor), v_ver);
  end if;
  perform public.portal2027_recalcular_semana(p_evaluacion, p_matricula);
  return jsonb_build_object('id', v_id, 'version', v_ver);
end $function$
