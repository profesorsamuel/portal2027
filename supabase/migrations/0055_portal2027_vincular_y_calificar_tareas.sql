-- 0055: reparación de vínculos por tarea y calificación independiente.
-- Ejecutar desde SQL Editor como propietario. No modifica notas existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.portal2027_vincular_tarea_desglose()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_eval uuid; v_grupo uuid; v_num integer;
BEGIN
 IF NEW.clase_id IS NULL OR NEW.eliminada_en IS NOT NULL THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM public.portal2027_tareas_desglose WHERE tarea_id=NEW.id) THEN RETURN NEW; END IF;
 SELECT numero INTO v_num FROM public.portal2027_plan_clases
 WHERE id=NEW.clase_id AND asignacion_id=NEW.asignacion_id AND trimestre_id=NEW.trimestre_id AND eliminada_en IS NULL;
 IF v_num IS NULL THEN RETURN NEW; END IF;
 SELECT id INTO v_eval FROM public.portal2027_evaluaciones
 WHERE asignacion_id=NEW.asignacion_id AND trimestre_id=NEW.trimestre_id
 AND categoria='apreciacion' AND semana=v_num AND eliminada_en IS NULL LIMIT 1;
 IF v_eval IS NULL THEN RAISE EXCEPTION 'No existe apreciación para la clase %',v_num; END IF;
 -- El trigger usa el usuario autenticado para nuevas tareas. La recuperación administrativa
 -- se ejecuta directamente al final de esta migración sin fingir una sesión de profesor.
 IF auth.uid() IS NOT NULL AND NOT public.portal2027_puede_editar_asignacion(NEW.asignacion_id)
 THEN RAISE EXCEPTION 'Sin permiso para vincular tarea'; END IF;
 INSERT INTO public.portal2027_tareas_desglose(tarea_id,evaluacion_id)
 VALUES(NEW.id,v_eval) ON CONFLICT(tarea_id) DO NOTHING RETURNING grupo INTO v_grupo;
 IF v_grupo IS NOT NULL THEN
  INSERT INTO public.portal2027_registros_semana(evaluacion_id,matricula_id,tipo,descripcion,grupo)
  SELECT v_eval,ma.id,'Tarea',left(NEW.titulo,120),v_grupo
  FROM public.portal2027_asignaciones a
  JOIN public.portal2027_salones s ON s.id=a.salon_id
  JOIN public.portal2027_matriculas ma ON ma.salon_id=a.salon_id AND ma.anio_id=s.anio_id
  WHERE a.id=NEW.asignacion_id
  ON CONFLICT(evaluacion_id,grupo,matricula_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal2027_vincular_tarea_desglose() FROM PUBLIC,anon,authenticated;
-- Recupera las tareas anteriores. El trigger no se ejecuta en esta actualización:
-- lo invocamos como propietario, con control de clase y trimestre en la propia función.
CREATE OR REPLACE FUNCTION public.portal2027_vincular_tarea_desglose_admin(p_tarea uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t record; v_eval uuid; v_grupo uuid;
BEGIN
 SELECT ta.*,cl.numero FROM public.portal2027_tareas ta
 JOIN public.portal2027_plan_clases cl ON cl.id=ta.clase_id AND cl.asignacion_id=ta.asignacion_id AND cl.trimestre_id=ta.trimestre_id
 WHERE ta.id=p_tarea AND ta.eliminada_en IS NULL AND cl.eliminada_en IS NULL INTO t;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT id INTO v_eval FROM public.portal2027_evaluaciones
 WHERE asignacion_id=t.asignacion_id AND trimestre_id=t.trimestre_id
 AND categoria='apreciacion' AND semana=t.numero AND eliminada_en IS NULL LIMIT 1;
 IF v_eval IS NULL THEN RETURN; END IF;
 INSERT INTO public.portal2027_tareas_desglose(tarea_id,evaluacion_id)
 VALUES(t.id,v_eval) ON CONFLICT(tarea_id) DO NOTHING RETURNING grupo INTO v_grupo;
 IF v_grupo IS NULL THEN RETURN; END IF;
 INSERT INTO public.portal2027_registros_semana(evaluacion_id,matricula_id,tipo,descripcion,grupo)
 SELECT v_eval,ma.id,'Tarea',left(t.titulo,120),v_grupo
 FROM public.portal2027_asignaciones a
 JOIN public.portal2027_salones s ON s.id=a.salon_id
 JOIN public.portal2027_matriculas ma ON ma.salon_id=a.salon_id AND ma.anio_id=s.anio_id
 WHERE a.id=t.asignacion_id ON CONFLICT(evaluacion_id,grupo,matricula_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.portal2027_vincular_tarea_desglose_admin(uuid) FROM PUBLIC,anon,authenticated;

DO $$ DECLARE t public.portal2027_tareas%ROWTYPE; BEGIN
 FOR t IN SELECT * FROM public.portal2027_tareas WHERE clase_id IS NOT NULL AND eliminada_en IS NULL LOOP
  PERFORM public.portal2027_vincular_tarea_desglose_admin(t.id);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.portal2027_calificar_tarea_desglose(p_tarea uuid,p_matricula uuid,p_nota numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record; r record;
BEGIN
 IF p_nota IS NULL OR p_nota<0 OR p_nota>5 THEN RAISE EXCEPTION 'Nota fuera de rango'; END IF;
 SELECT td.grupo,td.evaluacion_id,e.asignacion_id,e.trimestre_id,e.bloqueada
 INTO v FROM public.portal2027_tareas_desglose td
 JOIN public.portal2027_evaluaciones e ON e.id=td.evaluacion_id
 JOIN public.portal2027_tareas t ON t.id=td.tarea_id
 WHERE td.tarea_id=p_tarea AND t.eliminada_en IS NULL AND e.eliminada_en IS NULL
 AND t.asignacion_id=e.asignacion_id AND t.trimestre_id=e.trimestre_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarea no vinculada al desglose'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(v.asignacion_id)
 OR public.portal2027_trimestre_cerrado(v.asignacion_id,v.trimestre_id) OR v.bloqueada
 THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 SELECT * INTO r FROM public.portal2027_registros_semana
 WHERE evaluacion_id=v.evaluacion_id AND grupo=v.grupo AND matricula_id=p_matricula FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Estudiante sin columna de tarea'; END IF;
 UPDATE public.portal2027_registros_semana SET valor=p_nota,version=version+1,
 actualizado_en=now(),actualizado_por=auth.uid() WHERE id=r.id;
 INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,anterior,nuevo,version)
 VALUES(r.id,v.evaluacion_id,p_matricula,'editar',jsonb_build_object('valor',r.valor),jsonb_build_object('valor',p_nota),r.version+1);
 PERFORM public.portal2027_recalcular_semana(v.evaluacion_id,p_matricula);
END $$;
REVOKE ALL ON FUNCTION public.portal2027_calificar_tarea_desglose(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_calificar_tarea_desglose(uuid,uuid,numeric) TO authenticated;

COMMIT;
