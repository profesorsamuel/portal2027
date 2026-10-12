-- 0022: Etapa 1, estructura segura de apreciación semanal. Ejecutable varias veces.
ALTER TABLE public.portal2027_evaluaciones ADD COLUMN IF NOT EXISTS semana integer;
ALTER TABLE public.portal2027_evaluaciones ADD COLUMN IF NOT EXISTS semana_inicio date;
ALTER TABLE public.portal2027_evaluaciones ADD COLUMN IF NOT EXISTS semana_fin date;
ALTER TABLE public.portal2027_notas ADD COLUMN IF NOT EXISTS nota_manual boolean NOT NULL DEFAULT false;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal2027_semana_valida') THEN
 ALTER TABLE public.portal2027_evaluaciones ADD CONSTRAINT portal2027_semana_valida CHECK (semana IS NULL OR semana BETWEEN 1 AND 60);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='portal2027_fechas_semana_validas') THEN
 ALTER TABLE public.portal2027_evaluaciones ADD CONSTRAINT portal2027_fechas_semana_validas CHECK (semana_inicio IS NULL OR semana_fin IS NULL OR semana_inicio <= semana_fin);
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS portal2027_semana_unica ON public.portal2027_evaluaciones(asignacion_id,trimestre_id,semana) WHERE categoria='apreciacion' AND semana IS NOT NULL AND eliminada_en IS NULL;
CREATE TABLE IF NOT EXISTS public.portal2027_registros_semana (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evaluacion_id uuid NOT NULL REFERENCES public.portal2027_evaluaciones(id) ON DELETE RESTRICT,
 matricula_id uuid NOT NULL REFERENCES public.portal2027_matriculas(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(length(trim(tipo)) BETWEEN 1 AND 40),
 descripcion text NOT NULL DEFAULT '' CHECK(length(descripcion)<=120),
 valor numeric(4,2) CHECK(valor IS NULL OR (valor>=0 AND valor<=5)),
 version integer NOT NULL DEFAULT 1,
 actualizado_por uuid REFERENCES public.portal2027_perfiles(id) ON DELETE SET NULL,
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal2027_registros_semana_idx ON public.portal2027_registros_semana(evaluacion_id,matricula_id);
CREATE TABLE IF NOT EXISTS public.portal2027_historial_registros_semana (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registro_id uuid NOT NULL,
 evaluacion_id uuid NOT NULL, matricula_id uuid NOT NULL,
 accion text NOT NULL, anterior jsonb, nuevo jsonb,
 version integer NOT NULL, usuario_id uuid DEFAULT auth.uid(), creado_en timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS portal2027_historial_registros_semana_inmutable ON public.portal2027_historial_registros_semana;
CREATE TRIGGER portal2027_historial_registros_semana_inmutable BEFORE UPDATE OR DELETE ON public.portal2027_historial_registros_semana FOR EACH ROW EXECUTE FUNCTION public.portal2027_historial_inmutable();
ALTER TABLE public.portal2027_registros_semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal2027_historial_registros_semana ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal2027_registros_semana_ver ON public.portal2027_registros_semana;
CREATE POLICY portal2027_registros_semana_ver ON public.portal2027_registros_semana FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.portal2027_evaluaciones e WHERE e.id=evaluacion_id AND public.portal2027_puede_editar_asignacion(e.asignacion_id)));
DROP POLICY IF EXISTS portal2027_historial_registros_semana_ver ON public.portal2027_historial_registros_semana;
CREATE POLICY portal2027_historial_registros_semana_ver ON public.portal2027_historial_registros_semana FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.portal2027_evaluaciones e WHERE e.id=evaluacion_id AND public.portal2027_puede_editar_asignacion(e.asignacion_id)));
REVOKE ALL ON public.portal2027_registros_semana, public.portal2027_historial_registros_semana FROM PUBLIC, anon;
GRANT SELECT ON public.portal2027_registros_semana, public.portal2027_historial_registros_semana TO authenticated;

CREATE OR REPLACE FUNCTION public.portal2027_recalcular_semana(p_evaluacion uuid,p_matricula uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; n record; v_val numeric; v_ver integer;
BEGIN
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.categoria<>'apreciacion' OR e.semana IS NULL THEN RAISE EXCEPTION 'No es una apreciación semanal'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id) OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 IF e.bloqueada OR e.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'Columna bloqueada o eliminada'; END IF;
 SELECT * INTO n FROM public.portal2027_notas WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula FOR UPDATE;
 IF FOUND AND n.nota_manual THEN RETURN jsonb_build_object('manual',true,'version',n.version); END IF;
 SELECT round(avg(valor),2) INTO v_val FROM public.portal2027_registros_semana WHERE evaluacion_id=p_evaluacion AND matricula_id=p_matricula AND valor IS NOT NULL;
 v_ver:=CASE WHEN n.id IS NULL THEN 0 ELSE n.version END;
 RETURN public.portal2027_guardar_nota(p_evaluacion,p_matricula,v_val,v_ver,CASE WHEN n.id IS NOT NULL AND n.valor IS DISTINCT FROM v_val THEN 'Recálculo automático de apreciación semanal' ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION public.portal2027_guardar_registro_semana(p_id uuid,p_evaluacion uuid,p_matricula uuid,p_tipo text,p_descripcion text,p_valor numeric,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; r record; v_id uuid; v_ver integer; v_ant jsonb;
BEGIN
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.categoria<>'apreciacion' OR e.semana IS NULL THEN RAISE EXCEPTION 'Semana no válida'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id) OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 IF e.bloqueada OR e.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'Columna bloqueada o eliminada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.portal2027_matriculas m JOIN public.portal2027_asignaciones a ON a.salon_id=m.salon_id WHERE m.id=p_matricula AND a.id=e.asignacion_id) THEN RAISE EXCEPTION 'Matrícula ajena al grupo'; END IF;
 IF length(trim(coalesce(p_tipo,''))) NOT BETWEEN 1 AND 40 OR length(coalesce(p_descripcion,''))>120 OR (p_valor IS NOT NULL AND (p_valor<0 OR p_valor>5)) THEN RAISE EXCEPTION 'Datos fuera de rango'; END IF;
 IF p_id IS NULL THEN
  IF coalesce(p_version,0)<>0 THEN RAISE EXCEPTION 'CONFLICTO: versión incorrecta'; END IF;
  INSERT INTO public.portal2027_registros_semana(evaluacion_id,matricula_id,tipo,descripcion,valor,actualizado_por) VALUES(p_evaluacion,p_matricula,trim(p_tipo),coalesce(p_descripcion,''),p_valor,auth.uid()) RETURNING id,version INTO v_id,v_ver;
  INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,nuevo,version) VALUES(v_id,p_evaluacion,p_matricula,'crear',jsonb_build_object('tipo',p_tipo,'descripcion',p_descripcion,'valor',p_valor),v_ver);
 ELSE
  SELECT * INTO r FROM public.portal2027_registros_semana WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR r.evaluacion_id<>p_evaluacion OR r.matricula_id<>p_matricula THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
  IF r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'CONFLICTO: recargue el desglose'; END IF;
  v_ant:=jsonb_build_object('tipo',r.tipo,'descripcion',r.descripcion,'valor',r.valor);
  UPDATE public.portal2027_registros_semana SET tipo=trim(p_tipo),descripcion=coalesce(p_descripcion,''),valor=p_valor,version=version+1,actualizado_por=auth.uid(),actualizado_en=now() WHERE id=p_id RETURNING id,version INTO v_id,v_ver;
  INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,anterior,nuevo,version) VALUES(v_id,p_evaluacion,p_matricula,'actualizar',v_ant,jsonb_build_object('tipo',p_tipo,'descripcion',p_descripcion,'valor',p_valor),v_ver);
 END IF;
 PERFORM public.portal2027_recalcular_semana(p_evaluacion,p_matricula);
 RETURN jsonb_build_object('id',v_id,'version',v_ver);
END $$;

CREATE OR REPLACE FUNCTION public.portal2027_eliminar_registro_semana(p_id uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; e record;
BEGIN
 SELECT * INTO r FROM public.portal2027_registros_semana WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registro no encontrado'; END IF;
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=r.evaluacion_id FOR UPDATE;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id) OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) OR e.bloqueada OR e.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'No puede eliminar este registro'; END IF;
 IF r.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'CONFLICTO: recargue el desglose'; END IF;
 INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,anterior,version) VALUES(r.id,r.evaluacion_id,r.matricula_id,'eliminar',to_jsonb(r),r.version+1);
 DELETE FROM public.portal2027_registros_semana WHERE id=p_id;
 PERFORM public.portal2027_recalcular_semana(r.evaluacion_id,r.matricula_id);
 RETURN jsonb_build_object('eliminado',true);
END $$;
REVOKE EXECUTE ON FUNCTION public.portal2027_recalcular_semana(uuid,uuid),public.portal2027_guardar_registro_semana(uuid,uuid,uuid,text,text,numeric,integer),public.portal2027_eliminar_registro_semana(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_recalcular_semana(uuid,uuid),public.portal2027_guardar_registro_semana(uuid,uuid,uuid,text,text,numeric,integer),public.portal2027_eliminar_registro_semana(uuid,integer) TO authenticated;
