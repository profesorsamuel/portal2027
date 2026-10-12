-- 0028: sincronización de apreciaciones semanales antiguas al abrir la libreta.
-- Ejecutar después de 0027. No modifica trimestres cerrados ni columnas bloqueadas.
-- Utiliza portal2027_recalcular_semana, que aplica permisos e historial.
CREATE OR REPLACE FUNCTION public.portal2027_sincronizar_apreciaciones(
 p_asignacion uuid, p_trimestre uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; total integer := 0;
BEGIN
 IF NOT public.portal2027_puede_editar_asignacion(p_asignacion) THEN
   RAISE EXCEPTION 'Sin permiso para esta asignación';
 END IF;
 IF public.portal2027_trimestre_cerrado(p_asignacion,p_trimestre) THEN
   RETURN 0;
 END IF;
 FOR r IN
   SELECT e.id AS evaluacion_id, m.matricula_id
   FROM public.portal2027_evaluaciones e
   JOIN (SELECT DISTINCT evaluacion_id,matricula_id FROM public.portal2027_registros_semana) m
     ON m.evaluacion_id=e.id
   LEFT JOIN public.portal2027_notas n
     ON n.evaluacion_id=e.id AND n.matricula_id=m.matricula_id
   CROSS JOIN LATERAL (
     SELECT round(avg(rs.valor),2) AS promedio
     FROM public.portal2027_registros_semana rs
     WHERE rs.evaluacion_id=e.id AND rs.matricula_id=m.matricula_id
   ) calc
   WHERE e.asignacion_id=p_asignacion AND e.trimestre_id=p_trimestre
     AND e.categoria='apreciacion' AND e.semana IS NOT NULL
     AND NOT e.bloqueada AND e.eliminada_en IS NULL
     AND (n.valor IS DISTINCT FROM calc.promedio OR coalesce(n.nota_manual,false))
 LOOP
   PERFORM public.portal2027_recalcular_semana(r.evaluacion_id,r.matricula_id);
   total := total + 1;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.portal2027_sincronizar_apreciaciones(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_sincronizar_apreciaciones(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
