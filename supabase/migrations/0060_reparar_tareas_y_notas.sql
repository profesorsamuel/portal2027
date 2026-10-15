-- Portal 2027: reparar vínculos y recuperar calificaciones ficticias ya revisadas.
-- Requiere migraciones 0055 y 0058 instaladas.
BEGIN;
DO $$
DECLARE t record; e record; v_grupo uuid; v_eval uuid; v_actual numeric;
BEGIN
 FOR t IN SELECT id FROM public.portal2027_tareas WHERE clase_id IS NOT NULL AND eliminada_en IS NULL LOOP
   PERFORM public.portal2027_vincular_tarea_desglose_admin(t.id);
 END LOOP;
 -- Reparar filas faltantes de estudiantes en vínculos existentes.
 INSERT INTO public.portal2027_registros_semana(evaluacion_id,matricula_id,tipo,descripcion,grupo)
 SELECT d.evaluacion_id,m.id,'Tarea',left(t.titulo,120),d.grupo
 FROM public.portal2027_tareas_desglose d
 JOIN public.portal2027_tareas t ON t.id=d.tarea_id AND t.eliminada_en IS NULL
 JOIN public.portal2027_asignaciones a ON a.id=t.asignacion_id
 JOIN public.portal2027_salones s ON s.id=a.salon_id
 JOIN public.portal2027_matriculas m ON m.salon_id=a.salon_id AND m.anio_id=s.anio_id
 ON CONFLICT(evaluacion_id,grupo,matricula_id) DO NOTHING;
 -- Sincronizar notas de entregas revisadas con la columna exacta de su tarea.
 FOR e IN SELECT en.matricula_id,en.nota_profesor,d.evaluacion_id,d.grupo
 FROM public.portal2027_entregas en
 JOIN public.portal2027_tareas_desglose d ON d.tarea_id=en.tarea_id
 JOIN public.portal2027_tareas t ON t.id=en.tarea_id AND t.eliminada_en IS NULL
 WHERE en.estado='revisada' AND en.nota_profesor IS NOT NULL
 LOOP
   UPDATE public.portal2027_registros_semana r
   SET valor=e.nota_profesor,version=r.version+1,actualizado_en=now()
   WHERE r.evaluacion_id=e.evaluacion_id AND r.grupo=e.grupo AND r.matricula_id=e.matricula_id
   AND r.valor IS DISTINCT FROM e.nota_profesor;
   IF FOUND THEN PERFORM public.portal2027_recalcular_semana(e.evaluacion_id,e.matricula_id); END IF;
 END LOOP;
END $$;
COMMIT;
-- Comprobación: cada tarea debe tener su propio grupo y la nota de su entrega.
SELECT t.titulo, d.grupo AS columna_libreta, en.nota_profesor AS nota_tarea,
 r.valor AS nota_libreta
FROM public.portal2027_tareas t
LEFT JOIN public.portal2027_tareas_desglose d ON d.tarea_id=t.id
LEFT JOIN public.portal2027_entregas en ON en.tarea_id=t.id AND en.estado='revisada'
LEFT JOIN public.portal2027_registros_semana r ON r.grupo=d.grupo AND r.evaluacion_id=d.evaluacion_id AND r.matricula_id=en.matricula_id
WHERE t.eliminada_en IS NULL ORDER BY t.creado_en DESC LIMIT 50;
