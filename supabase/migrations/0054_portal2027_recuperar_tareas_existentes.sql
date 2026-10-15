-- 0054: incorpora tareas anteriores a la migración 0052 en su semana planificada.
-- Conserva entregas y notas. Idempotente. No duplica columnas existentes.
-- Requiere 0052 y la función portal2027_vincular_tarea_desglose.
DO $$
DECLARE t record; v_antes integer; v_despues integer;
BEGIN
 IF to_regclass('public.portal2027_tareas_desglose') IS NULL THEN
   RAISE EXCEPTION 'Primero ejecute la migración 0052';
 END IF;
 SELECT count(*) INTO v_antes FROM public.portal2027_tareas_desglose;
 FOR t IN
   SELECT x.* FROM public.portal2027_tareas x
   JOIN public.portal2027_plan_clases c ON c.id=x.clase_id
   WHERE x.eliminada_en IS NULL AND c.eliminada_en IS NULL
     AND x.asignacion_id=c.asignacion_id AND x.trimestre_id=c.trimestre_id
     AND NOT EXISTS (SELECT 1 FROM public.portal2027_tareas_desglose d WHERE d.tarea_id=x.id)
   ORDER BY x.creado_en
 LOOP
   -- El trigger de 0052 se dispara al actualizar clase_id, aunque conserve su valor.
   UPDATE public.portal2027_tareas SET clase_id=t.clase_id WHERE id=t.id;
 END LOOP;
 SELECT count(*) INTO v_despues FROM public.portal2027_tareas_desglose;
 RAISE NOTICE 'Columnas nuevas creadas: %', v_despues-v_antes;
END $$;
