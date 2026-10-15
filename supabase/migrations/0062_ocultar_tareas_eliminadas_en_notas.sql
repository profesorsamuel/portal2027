-- 0062: retirar columnas y notas exclusivas de tareas enviadas a papelera.
-- Ejecutar en SQL Editor después de 0061. No modifica otras evaluaciones.
BEGIN;
CREATE OR REPLACE FUNCTION public.portal2027_retirar_columnas_tarea()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.eliminada_en IS NULL AND NEW.eliminada_en IS NOT NULL THEN
   -- El vínculo individual evaluacion_id es exclusivo de una tarea (índice único).
   IF NEW.evaluacion_id IS NOT NULL THEN
     UPDATE public.portal2027_evaluaciones
       SET eliminada_en=now()
       WHERE id=NEW.evaluacion_id AND eliminada_en IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.portal2027_tareas x
           WHERE x.evaluacion_id=NEW.evaluacion_id AND x.id<>NEW.id AND x.eliminada_en IS NULL);
   END IF;
   -- El grupo de desglose es exclusivo de esta tarea, pero la evaluación semanal es compartida.
   DELETE FROM public.portal2027_registros_semana r
     USING public.portal2027_tareas_desglose d
     WHERE d.tarea_id=NEW.id AND r.evaluacion_id=d.evaluacion_id AND r.grupo=d.grupo;
   DELETE FROM public.portal2027_tareas_desglose WHERE tarea_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal2027_retirar_columnas_tarea_trg ON public.portal2027_tareas;
CREATE TRIGGER portal2027_retirar_columnas_tarea_trg
 AFTER UPDATE OF eliminada_en ON public.portal2027_tareas
 FOR EACH ROW EXECUTE FUNCTION public.portal2027_retirar_columnas_tarea();
REVOKE ALL ON FUNCTION public.portal2027_retirar_columnas_tarea() FROM PUBLIC,anon,authenticated;
-- Reparar tareas que ya estaban en papelera.
UPDATE public.portal2027_evaluaciones e SET eliminada_en=now()
FROM public.portal2027_tareas t
WHERE t.evaluacion_id=e.id AND t.eliminada_en IS NOT NULL AND e.eliminada_en IS NULL
 AND NOT EXISTS (SELECT 1 FROM public.portal2027_tareas activa
                 WHERE activa.evaluacion_id=e.id AND activa.eliminada_en IS NULL);
DELETE FROM public.portal2027_registros_semana r
 USING public.portal2027_tareas_desglose d, public.portal2027_tareas t
 WHERE d.tarea_id=t.id AND t.eliminada_en IS NOT NULL
   AND r.evaluacion_id=d.evaluacion_id AND r.grupo=d.grupo;
DELETE FROM public.portal2027_tareas_desglose d
 USING public.portal2027_tareas t
 WHERE d.tarea_id=t.id AND t.eliminada_en IS NOT NULL;
COMMIT;
