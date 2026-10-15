-- 0061: al enviar una tarea a papelera, retirar exclusivamente sus notas
-- del desglose y recalcular la apreciación semanal. La columna no se
-- reutiliza; al restaurar la tarea, las calificaciones permanecen vacías.
BEGIN;
CREATE OR REPLACE FUNCTION public.portal2027_limpiar_notas_tarea_papelera()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d record; r record;
BEGIN
 IF OLD.eliminada_en IS NULL AND NEW.eliminada_en IS NOT NULL THEN
  SELECT evaluacion_id,grupo INTO d FROM public.portal2027_tareas_desglose WHERE tarea_id=NEW.id;
  IF FOUND THEN
   FOR r IN SELECT * FROM public.portal2027_registros_semana
            WHERE evaluacion_id=d.evaluacion_id AND grupo=d.grupo AND valor IS NOT NULL FOR UPDATE LOOP
    INSERT INTO public.portal2027_historial_registros_semana
      (registro_id,evaluacion_id,matricula_id,accion,anterior,nuevo,version)
    VALUES (r.id,r.evaluacion_id,r.matricula_id,'actualizar',
      jsonb_build_object('valor',r.valor),jsonb_build_object('valor',null),r.version+1);
    UPDATE public.portal2027_registros_semana
      SET valor=NULL,version=version+1,actualizado_en=now(),actualizado_por=auth.uid()
      WHERE id=r.id;
    PERFORM public.portal2027_recalcular_semana(r.evaluacion_id,r.matricula_id);
   END LOOP;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal2027_tarea_papelera_limpia_notas ON public.portal2027_tareas;
CREATE TRIGGER portal2027_tarea_papelera_limpia_notas
 AFTER UPDATE OF eliminada_en ON public.portal2027_tareas
 FOR EACH ROW EXECUTE FUNCTION public.portal2027_limpiar_notas_tarea_papelera();
REVOKE ALL ON FUNCTION public.portal2027_limpiar_notas_tarea_papelera() FROM PUBLIC,anon,authenticated;
-- Limpiar también tareas que ya estaban en papelera antes de instalar 0061.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT DISTINCT rs.evaluacion_id,rs.matricula_id
  FROM public.portal2027_registros_semana rs
  JOIN public.portal2027_tareas_desglose d ON d.evaluacion_id=rs.evaluacion_id AND d.grupo=rs.grupo
  JOIN public.portal2027_tareas t ON t.id=d.tarea_id
  WHERE t.eliminada_en IS NOT NULL AND rs.valor IS NOT NULL LOOP
  UPDATE public.portal2027_registros_semana rs SET valor=NULL,version=version+1,actualizado_en=now()
   FROM public.portal2027_tareas_desglose d JOIN public.portal2027_tareas t ON t.id=d.tarea_id
   WHERE rs.evaluacion_id=d.evaluacion_id AND rs.grupo=d.grupo
    AND rs.evaluacion_id=r.evaluacion_id AND rs.matricula_id=r.matricula_id
    AND t.eliminada_en IS NOT NULL;
  PERFORM public.portal2027_recalcular_semana(r.evaluacion_id,r.matricula_id);
 END LOOP;
END $$;
COMMIT;
