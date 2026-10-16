-- Ejecutar en Supabase SQL Editor antes de publicar los JS.
begin;
alter table public.portal2027_plan_clases add column if not exists visible_estudiantes boolean not null default true;
-- La modificación solo se permite mediante RPC con comprobación de asignación.
create or replace function public.portal2027_visibilidad_clase(p_clase uuid, p_visible boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_asignacion uuid;
begin
 select asignacion_id into v_asignacion from public.portal2027_plan_clases where id=p_clase and eliminada_en is null;
 if v_asignacion is null or not public.portal2027_puede_editar_asignacion(v_asignacion) then
  raise exception 'No tiene permiso para cambiar la visibilidad';
 end if;
 if p_visible is null then raise exception 'Visibilidad inválida'; end if;
 update public.portal2027_plan_clases set visible_estudiantes=p_visible, actualizado_en=now() where id=p_clase;
end $$;
revoke all on function public.portal2027_visibilidad_clase(uuid,boolean) from public,anon;
grant execute on function public.portal2027_visibilidad_clase(uuid,boolean) to authenticated;
-- El RPC del estudiante filtra en servidor, no solo en pantalla.
create or replace function public.portal2027_mis_clases(p_trimestre uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mat uuid; v_salon uuid; v_res jsonb;
begin
  if not public.portal2027_tiene_rol('estudiante') then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select m.id, m.salon_id into v_mat, v_salon
    from public.portal2027_matriculas m
    join public.portal2027_estudiantes e on e.id = m.estudiante_id
    join public.portal2027_trimestres t on t.anio_id = m.anio_id
    where e.usuario_id = auth.uid() and t.id = p_trimestre;
  if v_mat is null then return jsonb_build_object('materias', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(s.x order by s.x ->> 'materia'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'asignacion_id', a.id,
      'materia', mt.nombre,
      'materiales', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'titulo', m.titulo, 'descripcion', m.descripcion,
                 'clase_id', m.clase_id, 'enlace', m.enlace, 'clase_numero', (select c.numero from public.portal2027_plan_clases c where c.id=m.clase_id), 'clase_tema', (select c.tema from public.portal2027_plan_clases c where c.id=m.clase_id), 'archivo_ruta', m.archivo_ruta, 'archivo_nombre', m.archivo_nombre, 'creado_en', m.creado_en)
               order by m.creado_en desc)
        from public.portal2027_materiales m
        where m.asignacion_id = a.id and m.trimestre_id = p_trimestre and m.publicado and m.eliminado_en is null and (m.clase_id is null or exists (select 1 from public.portal2027_plan_clases pc where pc.id=m.clase_id and pc.visible_estudiantes and pc.eliminada_en is null))), '[]'::jsonb),
      'tareas', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'instrucciones', t.instrucciones,
                 'clase_id', t.clase_id, 'clase_numero', (select c.numero from public.portal2027_plan_clases c where c.id=t.clase_id), 'clase_tema', (select c.tema from public.portal2027_plan_clases c where c.id=t.clase_id), 'fecha_limite', t.fecha_limite, 'creado_en', t.creado_en, 'vale_nota', t.evaluacion_id is not null,
                 'adjuntos', coalesce((
                   select jsonb_agg(jsonb_build_object('id', ad.id, 'tipo', ad.tipo, 'titulo', ad.titulo,
                            'archivo_ruta', ad.archivo_ruta, 'archivo_nombre', ad.archivo_nombre, 'enlace', ad.enlace)
                          order by ad.orden, ad.creado_en)
                   from public.portal2027_tareas_adjuntos ad where ad.tarea_id = t.id), '[]'::jsonb),
                 'entrega', (select jsonb_build_object('id', en.id, 'archivos', en.archivos, 'version', en.version, 'archivo_nombre', en.archivo_nombre, 'archivo_ruta', en.archivo_ruta,
                                'comentario', en.comentario, 'entregada_en', en.entregada_en, 'tardia', en.tardia,
                                'estado', en.estado, 'comentario_profesor', en.comentario_profesor)
                             from public.portal2027_entregas en where en.tarea_id = t.id and en.matricula_id = v_mat))
               order by t.creado_en, t.id)
        from public.portal2027_tareas t
        where t.asignacion_id = a.id and t.trimestre_id = p_trimestre and t.publicada and t.eliminada_en is null and (t.clase_id is null or exists (select 1 from public.portal2027_plan_clases pc where pc.id=t.clase_id and pc.visible_estudiantes and pc.eliminada_en is null))), '[]'::jsonb)
    ) as x
    from public.portal2027_asignaciones a
    join public.portal2027_materias mt on mt.id = a.materia_id
    where a.salon_id = v_salon
  ) s;
  return jsonb_build_object('matricula_id', v_mat, 'materias', v_res);
end $$;


revoke all on function public.portal2027_mis_clases(uuid) from public,anon;
grant execute on function public.portal2027_mis_clases(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
