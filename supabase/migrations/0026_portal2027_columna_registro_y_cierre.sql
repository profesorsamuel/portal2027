-- 0026: (a) «Agregar registro» como una sola función transaccional; (b) bloqueo por cierre trimestral también en la base
-- para registros de la semana y comportamiento. Requiere 0012, 0022 y 0024. Ejecutable varias veces.

-- ---------- Identificador de columna ----------
-- El navegador ya envía un «grupo» por columna de registros. Si el proyecto aún no tiene la columna, se crea aquí.
ALTER TABLE public.portal2027_registros_semana ADD COLUMN IF NOT EXISTS grupo uuid NOT NULL DEFAULT gen_random_uuid();
-- Un estudiante no puede tener dos celdas en la misma columna; además permite reintentar la creación sin duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS portal2027_registros_semana_grupo_unico
  ON public.portal2027_registros_semana(evaluacion_id, grupo, matricula_id);

-- ---------- (a) Crear la columna completa en una transacción ----------
-- Crea una celda vacía por cada estudiante de la libreta (mismas matrículas que carga la libreta: salón y año de la asignación).
-- Todo o nada: si algo falla, no queda ninguna celda. Si el grupo ya existe, solo completa los estudiantes que falten.
CREATE OR REPLACE FUNCTION public.portal2027_crear_columna_registro_semana(
  p_evaluacion uuid, p_tipo text, p_descripcion text, p_grupo uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; v_tipo text; v_desc text; v_creados integer := 0; v_total integer := 0; v_existe boolean;
BEGIN
 IF p_grupo IS NULL THEN RAISE EXCEPTION 'Datos fuera de rango'; END IF;
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.categoria<>'apreciacion' OR e.semana IS NULL THEN RAISE EXCEPTION 'Semana no válida'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id) OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 IF e.bloqueada OR e.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'Columna bloqueada o eliminada'; END IF;
 v_tipo := trim(coalesce(p_tipo,'')); v_desc := coalesce(p_descripcion,'');
 IF length(v_tipo) NOT BETWEEN 1 AND 40 OR length(v_desc)>120 THEN RAISE EXCEPTION 'Datos fuera de rango'; END IF;

 -- Si el grupo ya existe (reintento), se respeta su tipo y descripción originales.
 SELECT true, min(tipo), min(descripcion) INTO v_existe, v_tipo, v_desc
   FROM public.portal2027_registros_semana WHERE evaluacion_id=p_evaluacion AND grupo=p_grupo HAVING count(*)>0;
 v_existe := coalesce(v_existe,false);
 IF NOT v_existe THEN v_tipo := trim(p_tipo); v_desc := coalesce(p_descripcion,''); END IF;

 WITH estudiantes AS (
   SELECT ma.id AS matricula_id
     FROM public.portal2027_asignaciones a
     JOIN public.portal2027_salones s ON s.id=a.salon_id
     JOIN public.portal2027_matriculas ma ON ma.salon_id=a.salon_id AND ma.anio_id=s.anio_id
    WHERE a.id=e.asignacion_id
 ), nuevos AS (
   INSERT INTO public.portal2027_registros_semana(evaluacion_id,matricula_id,tipo,descripcion,valor,grupo,actualizado_por)
   SELECT p_evaluacion, st.matricula_id, v_tipo, v_desc, NULL, p_grupo, auth.uid() FROM estudiantes st
   ON CONFLICT (evaluacion_id,grupo,matricula_id) DO NOTHING
   RETURNING id, matricula_id, version
 ), hist AS (
   INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,nuevo,version)
   SELECT n.id, p_evaluacion, n.matricula_id, 'crear',
          jsonb_build_object('tipo',v_tipo,'descripcion',v_desc,'valor',NULL), n.version FROM nuevos n
   RETURNING 1
 )
 SELECT (SELECT count(*) FROM nuevos), (SELECT count(*) FROM estudiantes) INTO v_creados, v_total;

 -- Celdas vacías no cambian el promedio semanal, por eso no hace falta recalcular notas.
 RETURN jsonb_build_object('grupo',p_grupo,'creados',v_creados,'estudiantes',v_total);
END $$;
REVOKE EXECUTE ON FUNCTION public.portal2027_crear_columna_registro_semana(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_crear_columna_registro_semana(uuid,text,text,uuid) TO authenticated;

-- ---------- (b) Cierre trimestral en la base para registros y comportamiento ----------
-- Misma regla que 0012 para notas y asistencia: con el trimestre cerrado no se inserta, cambia ni borra, pase por donde pase.
CREATE OR REPLACE FUNCTION public.portal2027_bloquear_registros_si_cerrado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_asig uuid; v_tr uuid; r record; i integer;
BEGIN
 FOR i IN 1..2 LOOP
  IF i=1 THEN
   IF tg_op='DELETE' THEN r:=old; ELSE r:=new; END IF;
  ELSE
   IF tg_op<>'UPDATE' THEN EXIT; END IF;
   r:=old;
  END IF;
  v_asig:=NULL; v_tr:=NULL;
  IF tg_table_name='portal2027_registros_semana' THEN
   SELECT e.asignacion_id,e.trimestre_id INTO v_asig,v_tr FROM public.portal2027_evaluaciones e WHERE e.id=r.evaluacion_id;
  ELSIF tg_table_name='portal2027_comportamiento' THEN
   SELECT s.asignacion_id,s.trimestre_id INTO v_asig,v_tr FROM public.portal2027_sesiones_asistencia s WHERE s.id=r.sesion_id;
  END IF;
  IF v_asig IS NOT NULL AND public.portal2027_trimestre_cerrado(v_asig,v_tr) THEN
   RAISE EXCEPTION 'El trimestre está cerrado: no se pueden cambiar registros ni comportamiento. La administración puede reabrirlo';
  END IF;
 END LOOP;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END $$;

DROP TRIGGER IF EXISTS portal2027_registros_semana_cierre ON public.portal2027_registros_semana;
CREATE TRIGGER portal2027_registros_semana_cierre BEFORE INSERT OR UPDATE OR DELETE ON public.portal2027_registros_semana
 FOR EACH ROW EXECUTE FUNCTION public.portal2027_bloquear_registros_si_cerrado();
DROP TRIGGER IF EXISTS portal2027_comportamiento_cierre ON public.portal2027_comportamiento;
CREATE TRIGGER portal2027_comportamiento_cierre BEFORE INSERT OR UPDATE OR DELETE ON public.portal2027_comportamiento
 FOR EACH ROW EXECUTE FUNCTION public.portal2027_bloquear_registros_si_cerrado();
