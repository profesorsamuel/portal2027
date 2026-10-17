-- PORTAL 2027 - limpieza de columnas duplicadas de prueba, 9C Ciencias Naturales, trimestre 1.
-- Mantiene las 7 columnas enlazadas a la planificación y oculta las restantes.
-- No elimina notas, tareas ni historiales; puede ejecutarse repetidamente.
BEGIN;
WITH sobrantes AS (
 SELECT e.id
 FROM public.portal2027_evaluaciones e
 WHERE e.asignacion_id = '9c5e7941-62ed-4d60-86c6-cbd235f4fccc'::uuid
   AND e.trimestre_id = 'db40abbc-a659-4545-bc01-e36d87177240'::uuid
   AND e.categoria = 'apreciacion'
   AND e.eliminada_en IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.portal2027_plan_clases p
     WHERE p.asignacion_id = e.asignacion_id
       AND p.trimestre_id = e.trimestre_id
       AND p.eliminada_en IS NULL
       AND p.evaluacion_id = e.id
   )
)
UPDATE public.portal2027_evaluaciones e
SET eliminada_en = now(), actualizado_en = now(), version = e.version + 1
FROM sobrantes s WHERE e.id = s.id;
COMMIT;
-- Verificación: debe mostrar 7 apreciaciones activas si las 7 clases están vinculadas.
SELECT e.orden,e.tema,e.semana,p.numero AS clase
FROM public.portal2027_evaluaciones e
LEFT JOIN public.portal2027_plan_clases p ON p.evaluacion_id=e.id AND p.eliminada_en IS NULL
WHERE e.asignacion_id='9c5e7941-62ed-4d60-86c6-cbd235f4fccc'::uuid
AND e.trimestre_id='db40abbc-a659-4545-bc01-e36d87177240'::uuid
AND e.categoria='apreciacion' AND e.eliminada_en IS NULL
ORDER BY p.numero NULLS LAST,e.orden;
