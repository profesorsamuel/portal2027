-- 0024: comportamiento por sesión de clase. Requiere 0006, 0007.
-- Idempotente; no modifica notas ni consolida automáticamente.
CREATE TABLE IF NOT EXISTS public.portal2027_comportamiento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sesion_id uuid NOT NULL REFERENCES public.portal2027_sesiones_asistencia(id) ON DELETE RESTRICT,
 matricula_id uuid NOT NULL REFERENCES public.portal2027_matriculas(id) ON DELETE RESTRICT,
 estado text CHECK (estado IS NULL OR estado IN ('bien','mal')),
 version integer NOT NULL DEFAULT 1,
 actualizado_por uuid REFERENCES public.portal2027_perfiles(id) ON DELETE SET NULL,
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE (sesion_id, matricula_id)
);
CREATE TABLE IF NOT EXISTS public.portal2027_historial_comportamiento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 comportamiento_id uuid NOT NULL REFERENCES public.portal2027_comportamiento(id) ON DELETE RESTRICT,
 sesion_id uuid NOT NULL REFERENCES public.portal2027_sesiones_asistencia(id) ON DELETE RESTRICT,
 matricula_id uuid NOT NULL REFERENCES public.portal2027_matriculas(id) ON DELETE RESTRICT,
 estado_anterior text, estado_nuevo text, version integer NOT NULL,
 usuario_id uuid DEFAULT auth.uid() REFERENCES public.portal2027_perfiles(id) ON DELETE SET NULL,
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal2027_comportamiento_sesion_idx ON public.portal2027_comportamiento(sesion_id);
CREATE INDEX IF NOT EXISTS portal2027_historial_comportamiento_idx ON public.portal2027_historial_comportamiento(sesion_id,creado_en);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='portal2027_historial_comportamiento_inmutable') THEN
 CREATE TRIGGER portal2027_historial_comportamiento_inmutable BEFORE UPDATE OR DELETE ON public.portal2027_historial_comportamiento
 FOR EACH ROW EXECUTE FUNCTION public.portal2027_historial_inmutable();
 END IF;
END $$;
ALTER TABLE public.portal2027_comportamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal2027_historial_comportamiento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal2027_comportamiento_ver ON public.portal2027_comportamiento;
CREATE POLICY portal2027_comportamiento_ver ON public.portal2027_comportamiento FOR SELECT TO authenticated
 USING (public.portal2027_puede_ver_sesion(sesion_id));
DROP POLICY IF EXISTS portal2027_historial_comportamiento_ver ON public.portal2027_historial_comportamiento;
CREATE POLICY portal2027_historial_comportamiento_ver ON public.portal2027_historial_comportamiento FOR SELECT TO authenticated
 USING (public.portal2027_puede_ver_sesion(sesion_id));
REVOKE ALL ON public.portal2027_comportamiento,public.portal2027_historial_comportamiento FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.portal2027_comportamiento,public.portal2027_historial_comportamiento TO authenticated;

CREATE OR REPLACE FUNCTION public.portal2027_guardar_comportamiento(
 p_sesion uuid,p_matricula uuid,p_estado text,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; c record; v_id uuid;
BEGIN
 SELECT * INTO s FROM public.portal2027_sesiones_asistencia WHERE id=p_sesion FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La sesión no existe'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(s.asignacion_id) THEN RAISE EXCEPTION 'No tiene permiso'; END IF;
 IF public.portal2027_trimestre_cerrado(s.asignacion_id,s.trimestre_id) THEN RAISE EXCEPTION 'El trimestre está cerrado'; END IF;
 IF s.bloqueada OR s.eliminada_en IS NOT NULL THEN RAISE EXCEPTION 'La sesión está bloqueada o eliminada'; END IF;
 IF p_estado IS NOT NULL AND p_estado NOT IN ('bien','mal') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.portal2027_matriculas m
 JOIN public.portal2027_asignaciones a ON a.salon_id=m.salon_id
 WHERE m.id=p_matricula AND a.id=s.asignacion_id) THEN RAISE EXCEPTION 'Estudiante fuera del grupo'; END IF;
 SELECT * INTO c FROM public.portal2027_comportamiento WHERE sesion_id=p_sesion AND matricula_id=p_matricula FOR UPDATE;
 IF NOT FOUND THEN
  IF coalesce(p_version,0)<>0 THEN RAISE EXCEPTION 'CONFLICTO: recargue la asistencia'; END IF;
  IF p_estado IS NULL THEN RETURN jsonb_build_object('version',0,'estado',null,'sin_cambio',true); END IF;
  INSERT INTO public.portal2027_comportamiento(sesion_id,matricula_id,estado,actualizado_por)
   VALUES(p_sesion,p_matricula,p_estado,auth.uid()) RETURNING id INTO v_id;
  INSERT INTO public.portal2027_historial_comportamiento(comportamiento_id,sesion_id,matricula_id,estado_nuevo,version)
   VALUES(v_id,p_sesion,p_matricula,p_estado,1);
  RETURN jsonb_build_object('version',1,'estado',p_estado);
 END IF;
 IF c.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'CONFLICTO: recargue la asistencia'; END IF;
 IF c.estado IS NOT DISTINCT FROM p_estado THEN RETURN jsonb_build_object('version',c.version,'estado',c.estado,'sin_cambio',true); END IF;
 UPDATE public.portal2027_comportamiento SET estado=p_estado,version=c.version+1,
 actualizado_por=auth.uid(),actualizado_en=now() WHERE id=c.id;
 INSERT INTO public.portal2027_historial_comportamiento(comportamiento_id,sesion_id,matricula_id,estado_anterior,estado_nuevo,version)
 VALUES(c.id,p_sesion,p_matricula,c.estado,p_estado,c.version+1);
 RETURN jsonb_build_object('version',c.version+1,'estado',p_estado,'sin_cambio',false);
END $$;
REVOKE ALL ON FUNCTION public.portal2027_guardar_comportamiento(uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_guardar_comportamiento(uuid,uuid,text,integer) TO authenticated;
