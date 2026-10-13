-- 0035_portal2027_asignaciones_samuel_2027.sql
-- Ejecutar una sola vez en Supabase SQL Editor, después de revisar el SELECT final.
-- Crea únicamente las cuatro asignaciones faltantes; conserva las existentes.
-- El profesor se identifica por las asignaciones 9B y 9C ya confirmadas.
DO $$
DECLARE v_anio uuid; v_prof uuid; v_n int; v_grupo text; v_mat text; v_salon uuid; v_materia uuid;
BEGIN
 SELECT id INTO STRICT v_anio FROM public.portal2027_anios WHERE anio=2027;
 SELECT count(distinct a.profesor_id), min(a.profesor_id::text)::uuid INTO v_n,v_prof
 FROM public.portal2027_asignaciones a
 JOIN public.portal2027_salones s ON s.id=a.salon_id
 JOIN public.portal2027_materias m ON m.id=a.materia_id
 WHERE s.anio_id=v_anio AND s.nombre IN ('9B','9C') AND lower(m.nombre)='ciencias naturales';
 IF v_n<>1 OR v_prof IS NULL THEN RAISE EXCEPTION 'No se pudo identificar un único profesor desde 9B y 9C. No se modificó nada.'; END IF;
 IF (SELECT count(DISTINCT s.nombre) FROM public.portal2027_asignaciones a JOIN public.portal2027_salones s ON s.id=a.salon_id JOIN public.portal2027_materias m ON m.id=a.materia_id WHERE a.profesor_id=v_prof AND s.anio_id=v_anio AND s.nombre IN ('9B','9C') AND lower(m.nombre)='ciencias naturales')<>2 THEN
 RAISE EXCEPTION 'Deben existir 9B y 9C de Naturales asignadas al mismo profesor.'; END IF;
 FOR v_grupo,v_mat IN SELECT * FROM (VALUES ('9A','Ciencias Naturales'),('8A','Ciencias Naturales'),('8A','Informática'),('8B','Informática')) AS x(grupo,materia) LOOP
  SELECT id INTO v_salon FROM public.portal2027_salones WHERE anio_id=v_anio AND nombre=v_grupo;
  IF v_salon IS NULL THEN RAISE EXCEPTION 'Falta el grupo % en el año 2027. Créelo en Administración.',v_grupo; END IF;
  SELECT id INTO v_materia FROM public.portal2027_materias WHERE lower(nombre)=lower(v_mat) LIMIT 1;
  IF v_materia IS NULL THEN
   INSERT INTO public.portal2027_materias(nombre) VALUES(v_mat) ON CONFLICT DO NOTHING;
   SELECT id INTO v_materia FROM public.portal2027_materias WHERE lower(nombre)=lower(v_mat) LIMIT 1;
  END IF;
  IF v_materia IS NULL THEN RAISE EXCEPTION 'No se encontró la materia %',v_mat; END IF;
  INSERT INTO public.portal2027_asignaciones(salon_id,materia_id,profesor_id)
  VALUES(v_salon,v_materia,v_prof) ON CONFLICT (salon_id,materia_id,profesor_id) DO NOTHING;
 END LOOP;
END $$;
SELECT s.nombre AS grupo,m.nombre AS materia,a.id AS asignacion_id
FROM public.portal2027_asignaciones a JOIN public.portal2027_salones s ON s.id=a.salon_id
JOIN public.portal2027_materias m ON m.id=a.materia_id
WHERE s.anio_id=(SELECT id FROM public.portal2027_anios WHERE anio=2027)
AND s.nombre IN ('9A','9B','9C','8A','8B') AND m.nombre IN ('Ciencias Naturales','Informática')
ORDER BY s.nombre,m.nombre;
