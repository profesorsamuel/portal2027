-- 0025: correcciones complementarias de apreciación semanal (después de 0022-0024).
-- IMPORTANTE: aplicar únicamente tras validar 0022-0024 en un proyecto de pruebas.
CREATE OR REPLACE FUNCTION public.portal2027_crear_apreciacion_semanal(
 p_asignacion uuid,p_trimestre uuid,p_inicio date,p_fin date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_semana integer; v_id uuid;
BEGIN
 IF NOT public.portal2027_puede_editar_asignacion(p_asignacion) OR public.portal2027_trimestre_cerrado(p_asignacion,p_trimestre)
 THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 IF p_inicio IS NULL OR p_fin IS NULL OR p_inicio>p_fin THEN RAISE EXCEPTION 'Fechas inválidas'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_asignacion::text || p_trimestre::text));
 SELECT coalesce(max(semana),0)+1 INTO v_semana FROM public.portal2027_evaluaciones
 WHERE asignacion_id=p_asignacion AND trimestre_id=p_trimestre AND categoria='apreciacion' AND semana IS NOT NULL;
 v_id:=public.portal2027_crear_evaluacion(p_asignacion,p_trimestre,'apreciacion','Semana '||v_semana,'');
 UPDATE public.portal2027_evaluaciones SET semana=v_semana,semana_inicio=p_inicio,semana_fin=p_fin WHERE id=v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.portal2027_guardar_nota_semanal_manual(
 p_evaluacion uuid,p_matricula uuid,p_valor numeric,p_version integer,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; v_result jsonb;
BEGIN
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.categoria<>'apreciacion' OR e.semana IS NULL THEN RAISE EXCEPTION 'No es apreciación semanal'; END IF;
 IF public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) THEN RAISE EXCEPTION 'Trimestre cerrado'; END IF;
 IF nullif(trim(coalesce(p_motivo,'')),'') IS NULL THEN RAISE EXCEPTION 'Indique motivo de la corrección'; END IF;
 v_result:=public.portal2027_guardar_nota(p_evaluacion,p_matricula,p_valor,p_version,p_motivo);
 UPDATE public.portal2027_notas SET nota_manual=true WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula;
 RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION public.portal2027_restaurar_nota_semanal(
 p_evaluacion uuid,p_matricula uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; n record; v_result jsonb;
BEGIN
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.semana IS NULL OR e.categoria<>'apreciacion' THEN RAISE EXCEPTION 'Semana inválida'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id) OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id)
 OR e.bloqueada OR e.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'No se puede editar'; END IF;
 SELECT * INTO n FROM public.portal2027_notas WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula FOR UPDATE;
 IF NOT FOUND OR n.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'CONFLICTO: recargue la libreta'; END IF;
 UPDATE public.portal2027_notas SET nota_manual=false WHERE id=n.id;
 v_result:=public.portal2027_recalcular_semana(p_evaluacion,p_matricula);
 RETURN v_result;
END $$;
REVOKE EXECUTE ON FUNCTION public.portal2027_crear_apreciacion_semanal(uuid,uuid,date,date),
 public.portal2027_guardar_nota_semanal_manual(uuid,uuid,numeric,integer,text),
 public.portal2027_restaurar_nota_semanal(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_crear_apreciacion_semanal(uuid,uuid,date,date),
 public.portal2027_guardar_nota_semanal_manual(uuid,uuid,numeric,integer,text),
 public.portal2027_restaurar_nota_semanal(uuid,uuid,integer) TO authenticated;
