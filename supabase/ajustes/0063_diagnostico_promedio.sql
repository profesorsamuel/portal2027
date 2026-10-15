-- SOLO CONSULTAS: no modifica ninguna calificación.
-- 1. Identificar evaluaciones y notas que producen el promedio.
SELECT e.id AS evaluacion_id, e.categoria, e.tema, e.tipo, e.semana,
       e.eliminada_en, count(n.id) AS notas_registradas,
       count(n.id) FILTER (WHERE n.valor IS NOT NULL) AS notas_con_valor,
       round(avg(n.valor),2) AS promedio
FROM public.portal2027_evaluaciones e
LEFT JOIN public.portal2027_notas n ON n.evaluacion_id=e.id
GROUP BY e.id,e.categoria,e.tema,e.tipo,e.semana,e.eliminada_en
HAVING count(n.id) FILTER (WHERE n.valor IS NOT NULL)>0
ORDER BY e.categoria,e.tema;

-- 2. Comprobar si las notas de tareas eliminadas siguen vinculadas.
SELECT t.id AS tarea_id,t.titulo,t.eliminada_en AS tarea_eliminada,
       t.evaluacion_id, td.evaluacion_id AS evaluacion_desglose,
       td.grupo, ev.eliminada_en AS columna_eliminada
FROM public.portal2027_tareas t
LEFT JOIN public.portal2027_tareas_desglose td ON td.tarea_id=t.id
LEFT JOIN public.portal2027_evaluaciones ev ON ev.id=COALESCE(t.evaluacion_id,td.evaluacion_id)
WHERE t.eliminada_en IS NOT NULL
ORDER BY t.eliminada_en DESC;
