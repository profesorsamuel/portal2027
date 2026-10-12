-- 0027: la apreciación semanal siempre se recalcula desde los registros.
-- Ejecutar después de las migraciones 0022 a 0026.
-- Conserva el historial y los controles existentes de portal2027_guardar_nota.
CREATE OR REPLACE FUNCTION public.portal2027_recalcular_semana(p_evaluacion uuid,p_matricula uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; n record; v_val numeric; v_ver integer; v_result jsonb;
BEGIN
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.categoria<>'apreciacion' OR e.semana IS NULL THEN RAISE EXCEPTION 'No es una apreciación semanal'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id)
    OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 IF e.bloqueada OR e.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'Columna bloqueada o eliminada'; END IF;
 SELECT * INTO n FROM public.portal2027_notas WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula FOR UPDATE;
 SELECT round(avg(valor),2) INTO v_val FROM public.portal2027_registros_semana
 WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula AND valor IS NOT NULL;
 IF n.id IS NOT NULL AND n.valor IS NOT DISTINCT FROM v_val THEN
   IF n.nota_manual THEN UPDATE public.portal2027_notas SET nota_manual=false WHERE id=n.id; END IF;
   RETURN jsonb_build_object('valor',v_val,'version',n.version,'automatico',true);
 END IF;
 v_ver:=CASE WHEN n.id IS NULL THEN 0 ELSE n.version END;
 v_result:=public.portal2027_guardar_nota(p_evaluacion,p_matricula,v_val,v_ver,
   CASE WHEN n.id IS NOT NULL THEN 'Recálculo automático de apreciación semanal' ELSE NULL END);
 UPDATE public.portal2027_notas SET nota_manual=false WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula;
 RETURN v_result;
END $$;
REVOKE EXECUTE ON FUNCTION public.portal2027_recalcular_semana(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_recalcular_semana(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
