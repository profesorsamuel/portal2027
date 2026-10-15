-- 0063: reconciliar promedios de apreciación tras eliminar tareas.
-- Conserva ejercicios escritos independientes y notas de tareas activas.
BEGIN;
-- Eliminar enlaces residuales de tareas en papelera, sin afectar columnas compartidas.
DELETE FROM public.portal2027_registros_semana r
USING public.portal2027_tareas_desglose d, public.portal2027_tareas t
WHERE d.tarea_id=t.id AND t.eliminada_en IS NOT NULL
 AND r.evaluacion_id=d.evaluacion_id AND r.grupo=d.grupo;
DELETE FROM public.portal2027_tareas_desglose d
USING public.portal2027_tareas t
WHERE d.tarea_id=t.id AND t.eliminada_en IS NOT NULL;
-- Reconciliar únicamente notas automáticas semanales, incluso cuando la
-- última tarea con nota fue eliminada (en ese caso, la nota pasa a NULL).
WITH calculadas AS (
 SELECT e.id evaluacion_id, n.matricula_id, round(avg(r.valor),2) nuevo
 FROM public.portal2027_evaluaciones e
 JOIN public.portal2027_notas n ON n.evaluacion_id=e.id
 LEFT JOIN public.portal2027_registros_semana r
   ON r.evaluacion_id=e.id AND r.matricula_id=n.matricula_id
 WHERE e.categoria='apreciacion' AND e.semana IS NOT NULL
   AND e.eliminada_en IS NULL AND coalesce(n.nota_manual,false)=false
 GROUP BY e.id,n.matricula_id
)
UPDATE public.portal2027_notas n
SET valor=c.nuevo, version=n.version+1, actualizado_en=now()
FROM calculadas c
WHERE n.evaluacion_id=c.evaluacion_id AND n.matricula_id=c.matricula_id
 AND n.valor IS DISTINCT FROM c.nuevo;
COMMIT;
-- Diagnóstico: no cambia datos.
SELECT e.categoria,e.tema,n.valor,e.semana
FROM public.portal2027_notas n
JOIN public.portal2027_evaluaciones e ON e.id=n.evaluacion_id
WHERE e.eliminada_en IS NULL AND n.valor IS NOT NULL
ORDER BY e.categoria,e.semana NULLS LAST LIMIT 50;
