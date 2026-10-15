-- 0064: conexión entre asistencia, comportamiento y apreciación semanal.
-- Ejecutar una vez en Supabase SQL Editor, después de migraciones anteriores.
CREATE TABLE IF NOT EXISTS public.portal2027_config_conducta_semanal (
 asignacion_id uuid PRIMARY KEY REFERENCES public.portal2027_asignaciones(id),
 base numeric(4,2) NOT NULL DEFAULT 5 CHECK(base BETWEEN 0 AND 5),
 descuento_mal numeric(4,2) NOT NULL DEFAULT 0.5 CHECK(descuento_mal BETWEEN 0 AND 5),
 descuento_ausencia numeric(4,2) NOT NULL DEFAULT 0.5 CHECK(descuento_ausencia BETWEEN 0 AND 5),
 descuento_tardanza numeric(4,2) NOT NULL DEFAULT 0.25 CHECK(descuento_tardanza BETWEEN 0 AND 5),
 bono_bien numeric(4,2) NOT NULL DEFAULT 0 CHECK(bono_bien BETWEEN 0 AND 5),
 minimo numeric(4,2) NOT NULL DEFAULT 1 CHECK(minimo BETWEEN 0 AND 5)
);
ALTER TABLE public.portal2027_config_conducta_semanal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_conducta_docente_lectura ON public.portal2027_config_conducta_semanal;
CREATE POLICY config_conducta_docente_lectura ON public.portal2027_config_conducta_semanal FOR SELECT TO authenticated USING(public.portal2027_puede_editar_asignacion(asignacion_id));
REVOKE ALL ON public.portal2027_config_conducta_semanal FROM PUBLIC,anon;
GRANT SELECT ON public.portal2027_config_conducta_semanal TO authenticated;

CREATE OR REPLACE FUNCTION public.portal2027_guardar_config_conducta(p_asignacion uuid,p_base numeric,p_mal numeric,p_ausencia numeric,p_tardanza numeric,p_bono numeric,p_minimo numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.portal2027_puede_editar_asignacion(p_asignacion) THEN RAISE EXCEPTION 'Sin permiso'; END IF;
 IF p_base NOT BETWEEN 0 AND 5 OR p_mal NOT BETWEEN 0 AND 5 OR p_ausencia NOT BETWEEN 0 AND 5 OR p_tardanza NOT BETWEEN 0 AND 5 OR p_bono NOT BETWEEN 0 AND 5 OR p_minimo NOT BETWEEN 0 AND p_base OR p_base IS NULL OR p_mal IS NULL OR p_ausencia IS NULL OR p_tardanza IS NULL OR p_bono IS NULL OR p_minimo IS NULL THEN RAISE EXCEPTION 'Descuentos fuera de rango'; END IF;
 INSERT INTO public.portal2027_config_conducta_semanal(asignacion_id,base,descuento_mal,descuento_ausencia,descuento_tardanza,bono_bien,minimo)
 VALUES(p_asignacion,p_base,p_mal,p_ausencia,p_tardanza,p_bono,p_minimo)
 ON CONFLICT(asignacion_id) DO UPDATE SET base=excluded.base,descuento_mal=excluded.descuento_mal,descuento_ausencia=excluded.descuento_ausencia,descuento_tardanza=excluded.descuento_tardanza,bono_bien=excluded.bono_bien,minimo=excluded.minimo;
 RETURN jsonb_build_object('guardado',true);
END $$;

CREATE OR REPLACE FUNCTION public.portal2027_aplicar_conducta_semana(p_evaluacion uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; c record; st record; v_grupo uuid; v_val numeric(4,2); v_nuevo integer:=0; v_cambio integer:=0; v_igual integer:=0; v_id uuid; v_ant numeric; v_count integer;
BEGIN
 SELECT * INTO e FROM public.portal2027_evaluaciones WHERE id=p_evaluacion FOR UPDATE;
 IF NOT FOUND OR e.categoria <> 'apreciacion' OR e.semana_inicio IS NULL OR e.semana_fin IS NULL OR e.eliminada_en IS NOT NULL OR e.bloqueada THEN RAISE EXCEPTION 'La apreciación debe tener fechas válidas y estar desbloqueada'; END IF;
 IF NOT public.portal2027_puede_editar_asignacion(e.asignacion_id) OR public.portal2027_trimestre_cerrado(e.asignacion_id,e.trimestre_id) THEN RAISE EXCEPTION 'Sin permiso o trimestre cerrado'; END IF;
 SELECT * INTO c FROM public.portal2027_config_conducta_semanal WHERE asignacion_id=e.asignacion_id;
 IF NOT FOUND THEN SELECT 5::numeric base, 0.5::numeric descuento_mal,0.5::numeric descuento_ausencia,0.25::numeric descuento_tardanza,0::numeric bono_bien,1::numeric minimo INTO c; END IF;
 SELECT grupo INTO v_grupo FROM public.portal2027_registros_semana WHERE evaluacion_id=e.id AND tipo='Conducta' ORDER BY actualizado_en,id LIMIT 1;
 IF v_grupo IS NULL THEN v_grupo:=gen_random_uuid(); END IF;
 FOR st IN
  SELECT m.id matricula_id,
    count(*) FILTER(WHERE a.estado IS NOT NULL OR co.estado IS NOT NULL) marcados,
    count(*) FILTER(WHERE a.estado IN ('A','ausente')) ausencias,
    count(*) FILTER(WHERE a.estado IN ('T','tardanza')) tardanzas,
    count(*) FILTER(WHERE co.estado='mal') malos,
    count(*) FILTER(WHERE co.estado='bien') buenos
  FROM public.portal2027_asignaciones asi
  JOIN public.portal2027_salones sa ON sa.id=asi.salon_id
  JOIN public.portal2027_matriculas m ON m.salon_id=sa.id AND m.anio_id=sa.anio_id
  LEFT JOIN public.portal2027_sesiones_asistencia s ON s.asignacion_id=asi.id AND s.trimestre_id=e.trimestre_id AND s.fecha BETWEEN e.semana_inicio AND e.semana_fin AND s.eliminada_en IS NULL
  LEFT JOIN public.portal2027_asistencia a ON a.sesion_id=s.id AND a.matricula_id=m.id
  LEFT JOIN public.portal2027_comportamiento co ON co.sesion_id=s.id AND co.matricula_id=m.id
  WHERE asi.id=e.asignacion_id GROUP BY m.id
 LOOP
  -- Sin registros: dejar celda vacía, nunca inventar una nota.
  IF st.marcados=0 THEN v_val:=NULL;
  ELSE v_val:=round(least(5::numeric,c.base,greatest(c.minimo,c.base-st.ausencias*c.descuento_ausencia-st.tardanzas*c.descuento_tardanza-st.malos*c.descuento_mal+st.buenos*c.bono_bien)),2); END IF;
  SELECT id,valor INTO v_id,v_ant FROM public.portal2027_registros_semana WHERE evaluacion_id=e.id AND matricula_id=st.matricula_id AND grupo=v_grupo FOR UPDATE;
  IF v_id IS NULL THEN
   INSERT INTO public.portal2027_registros_semana(evaluacion_id,matricula_id,grupo,tipo,descripcion,valor,actualizado_por)
   VALUES(e.id,st.matricula_id,v_grupo,'Conducta','Asistencia y comportamiento',v_val,auth.uid()) RETURNING id INTO v_id;
   INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,nuevo,version)
   VALUES(v_id,e.id,st.matricula_id,'crear',jsonb_build_object('tipo','Conducta','valor',v_val),1);
   v_nuevo:=v_nuevo+1;
  ELSIF v_ant IS DISTINCT FROM v_val THEN
   UPDATE public.portal2027_registros_semana SET valor=v_val,version=version+1,actualizado_por=auth.uid(),actualizado_en=now() WHERE id=v_id;
   INSERT INTO public.portal2027_historial_registros_semana(registro_id,evaluacion_id,matricula_id,accion,anterior,nuevo,version)
   SELECT id,evaluacion_id,matricula_id,'actualizar',jsonb_build_object('valor',v_ant),jsonb_build_object('valor',v_val),version FROM public.portal2027_registros_semana WHERE id=v_id;
   v_cambio:=v_cambio+1;
  ELSE v_igual:=v_igual+1;
  END IF;
  PERFORM public.portal2027_recalcular_semana(e.id,st.matricula_id);
  v_id:=NULL;
 END LOOP;
 RETURN jsonb_build_object('creados',v_nuevo,'actualizados',v_cambio,'sin_cambio',v_igual);
END $$;
REVOKE ALL ON FUNCTION public.portal2027_guardar_config_conducta(uuid,numeric,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.portal2027_aplicar_conducta_semana(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_guardar_config_conducta(uuid,numeric,numeric,numeric,numeric,numeric,numeric),public.portal2027_aplicar_conducta_semana(uuid) TO authenticated;
