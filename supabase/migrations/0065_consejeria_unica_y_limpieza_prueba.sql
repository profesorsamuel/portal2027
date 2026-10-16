-- Portal 2027: eliminar SOLO la asignación duplicada de prueba del 9C/2027.
-- No elimina perfiles, usuarios Auth, materias, matrículas ni notas.
-- Si los datos no coinciden exactamente, se detiene para evitar daños.
DO $$
DECLARE v_salon uuid; v_sobrante uuid; v_cantidad int;
BEGIN
 SELECT s.id INTO STRICT v_salon FROM public.portal2027_salones s
 JOIN public.portal2027_anios a ON a.id=s.anio_id
 WHERE upper(trim(s.nombre))='9C' AND a.anio=2027;
 SELECT count(*), min(p.id) INTO v_cantidad,v_sobrante
 FROM public.portal2027_perfiles p
 JOIN public.portal2027_consejeros_salon c ON c.consejero_id=p.id AND c.salon_id=v_salon
 WHERE regexp_replace(coalesce(p.telefono,''),'[^0-9]','','g')='60103047'
 AND NOT EXISTS (SELECT 1 FROM public.portal2027_asignaciones x WHERE x.profesor_id=p.id AND x.salon_id=v_salon);
 IF v_cantidad<>1 THEN RAISE EXCEPTION 'No hay un único registro 9C solo-consejería con teléfono 60103047 (encontrados: %). No se modificó nada.',v_cantidad; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.portal2027_consejeros_salon c WHERE c.salon_id=v_salon AND c.consejero_id<>v_sobrante)
 THEN RAISE EXCEPTION 'No se encontró el otro consejero de 9C; no se elimina el único consejero.'; END IF;
 DELETE FROM public.portal2027_consejeros_salon WHERE salon_id=v_salon AND consejero_id=v_sobrante;
 RAISE NOTICE 'Se quitó la asignación duplicada de consejería 9C/2027, sin borrar la cuenta.';
END $$;

-- Una asignación de consejería por grupo, sin duplicados.
-- Si otros grupos tienen duplicados, se detiene hasta resolverlos.
CREATE UNIQUE INDEX IF NOT EXISTS portal2027_consejeros_salon_unico
ON public.portal2027_consejeros_salon (salon_id);

-- Operación atómica, solo administradores autenticados.
CREATE OR REPLACE FUNCTION public.portal2027_asignar_consejero_unico(p_salon uuid, p_consejero uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.portal2027_es_admin() THEN
   RAISE EXCEPTION 'No autorizado';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.portal2027_salones WHERE id=p_salon) OR
    NOT EXISTS (SELECT 1 FROM public.portal2027_perfiles WHERE id=p_consejero AND activo=true) THEN
   RAISE EXCEPTION 'Grupo o profesor no válido';
 END IF;
 -- Bloqueo para evitar dos asignaciones concurrentes al mismo grupo.
 PERFORM 1 FROM public.portal2027_salones WHERE id=p_salon FOR UPDATE;
 INSERT INTO public.portal2027_roles_usuario(usuario_id,rol)
 VALUES (p_consejero,'consejero') ON CONFLICT (usuario_id,rol) DO NOTHING;
 DELETE FROM public.portal2027_consejeros_salon WHERE salon_id=p_salon AND consejero_id<>p_consejero;
 INSERT INTO public.portal2027_consejeros_salon(salon_id,consejero_id)
 VALUES (p_salon,p_consejero) ON CONFLICT (salon_id,consejero_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.portal2027_asignar_consejero_unico(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal2027_asignar_consejero_unico(uuid,uuid) TO authenticated;
