-- Al completar datos de contacto, crea una evaluación en Apreciación, semana 1.
-- Nota automática entre 1 y 5, recalculada al cambiar cualquiera de los cinco campos.
-- No altera evaluaciones manuales ni notas de otras tareas.
CREATE OR REPLACE FUNCTION public.portal2027_nota_formulario_contacto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x record; g uuid; n record; promedio numeric(4,2); nuevo_id uuid;
BEGIN

 -- Sólo después de guardar el formulario desde la cuenta del propio estudiante.

 FOR x IN
  SELECT ev.id evaluacion_id, m.id matricula_id
  FROM public.portal2027_matriculas m
  JOIN public.portal2027_asignaciones a ON a.salon_id=m.salon_id
  JOIN public.portal2027_trimestres tr ON tr.anio_id=m.anio_id AND tr.numero=1
  JOIN public.portal2027_evaluaciones ev ON ev.asignacion_id=a.id AND ev.trimestre_id=tr.id
   AND ev.categoria='apreciacion' AND ev.semana=1 AND ev.eliminada_en IS NULL
   AND ev.bloqueada=false
  WHERE m.estudiante_id=NEW.id AND m.estado='activo'
 LOOP
  SELECT grupo INTO g FROM public.portal2027_registros_semana
  WHERE evaluacion_id=x.evaluacion_id AND tipo='Formulario' AND descripcion='Actualización de datos personales y del acudiente'
  LIMIT 1;
  IF g IS NULL THEN g:=gen_random_uuid(); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.portal2027_registros_semana
      WHERE evaluacion_id=x.evaluacion_id AND matricula_id=x.matricula_id AND grupo=g) THEN
   INSERT INTO public.portal2027_registros_semana
    (evaluacion_id,matricula_id,grupo,tipo,descripcion,valor,actualizado_por)
   VALUES (x.evaluacion_id,x.matricula_id,g,'Formulario',
           'Actualización de datos personales y del acudiente',
           1 + 0.8 * (
             (CASE WHEN nullif(btrim(coalesce(NEW.correo_estudiante,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
             (CASE WHEN nullif(btrim(coalesce(NEW.telefono_estudiante,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
             (CASE WHEN nullif(btrim(coalesce(NEW.nombre_acudiente,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
             (CASE WHEN nullif(btrim(coalesce(NEW.telefono_acudiente,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
             (CASE WHEN nullif(btrim(coalesce(NEW.direccion,'')),'') IS NOT NULL THEN 1 ELSE 0 END)),auth.uid());
  ELSE
   UPDATE public.portal2027_registros_semana SET valor=1 + 0.8 * (
      (CASE WHEN nullif(btrim(coalesce(NEW.correo_estudiante,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN nullif(btrim(coalesce(NEW.telefono_estudiante,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN nullif(btrim(coalesce(NEW.nombre_acudiente,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN nullif(btrim(coalesce(NEW.telefono_acudiente,'')),'') IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN nullif(btrim(coalesce(NEW.direccion,'')),'') IS NOT NULL THEN 1 ELSE 0 END))
   WHERE evaluacion_id=x.evaluacion_id AND matricula_id=x.matricula_id AND grupo=g;
  END IF;
  SELECT round(avg(valor),2) INTO promedio FROM public.portal2027_registros_semana
  WHERE evaluacion_id=x.evaluacion_id AND matricula_id=x.matricula_id AND valor IS NOT NULL;
  SELECT * INTO n FROM public.portal2027_notas
  WHERE evaluacion_id=x.evaluacion_id AND matricula_id=x.matricula_id FOR UPDATE;
  IF n.id IS NULL THEN
   INSERT INTO public.portal2027_notas(evaluacion_id,matricula_id,valor,actualizado_por)
   VALUES(x.evaluacion_id,x.matricula_id,promedio,auth.uid()) RETURNING id INTO nuevo_id;
   INSERT INTO public.portal2027_historial_notas(nota_id,evaluacion_id,matricula_id,valor_anterior,valor_nuevo,version,motivo)
   VALUES(nuevo_id,x.evaluacion_id,x.matricula_id,NULL,promedio,1,'Formulario de contacto completado');
  ELSIF NOT n.nota_manual AND n.valor IS DISTINCT FROM promedio THEN
   UPDATE public.portal2027_notas SET valor=promedio,version=version+1,
    actualizado_por=auth.uid(),actualizado_en=now() WHERE id=n.id;
   INSERT INTO public.portal2027_historial_notas(nota_id,evaluacion_id,matricula_id,valor_anterior,valor_nuevo,version,motivo)
   VALUES(n.id,x.evaluacion_id,x.matricula_id,n.valor,promedio,n.version+1,'Formulario de contacto completado');
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal2027_nota_formulario_contacto() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS portal2027_contacto_calificacion ON public.portal2027_estudiantes;
CREATE TRIGGER portal2027_contacto_calificacion
AFTER INSERT OR UPDATE OF correo_estudiante,telefono_estudiante,nombre_acudiente,telefono_acudiente,direccion ON public.portal2027_estudiantes
FOR EACH ROW EXECUTE FUNCTION public.portal2027_nota_formulario_contacto();

-- Recalcular los estudiantes existentes disparando el trigger.
UPDATE public.portal2027_estudiantes SET direccion=direccion;
