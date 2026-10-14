-- Ejecutar una sola vez en Supabase > SQL Editor antes de subir los archivos web.
begin;
alter table public.portal2027_materiales add column if not exists clase_id uuid references public.portal2027_plan_clases(id) on delete restrict;
alter table public.portal2027_materiales add column if not exists enlace text check (enlace is null or enlace ~* '^https?://[^[:space:]]+$');
alter table public.portal2027_tareas add column if not exists clase_id uuid references public.portal2027_plan_clases(id) on delete restrict;

create or replace function public.portal2027_validar_clase_recurso(p_clase uuid, p_asignacion uuid, p_trimestre uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.portal2027_puede_editar_asignacion(p_asignacion) then raise exception 'No tiene permiso'; end if;
 if p_clase is not null then
   perform 1 from public.portal2027_plan_clases where id=p_clase and asignacion_id=p_asignacion and trimestre_id=p_trimestre and eliminada_en is null for share;
   if not found then raise exception 'La clase no pertenece a esta asignación y trimestre'; end if;
 end if;
end $$;

create or replace function public.portal2027_crear_material_clase(p_asignacion uuid, p_trimestre uuid, p_titulo text, p_descripcion text,
 p_ruta text default null, p_nombre text default null, p_publicado boolean default true, p_clase uuid default null, p_enlace text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
 perform public.portal2027_validar_clase_recurso(p_clase,p_asignacion,p_trimestre);
 if nullif(trim(p_enlace),'') is not null and trim(p_enlace) !~* '^https?://[^[:space:]]+$' then raise exception 'Enlace inválido'; end if;
 v := public.portal2027_crear_material(p_asignacion,p_trimestre,p_titulo,p_descripcion,p_ruta,p_nombre,p_publicado);
 update public.portal2027_materiales set clase_id=p_clase, enlace=nullif(trim(p_enlace),'') where id=v;
 return v;
end $$;

create or replace function public.portal2027_crear_tarea_clase(p_asignacion uuid, p_trimestre uuid, p_titulo text, p_instrucciones text,
 p_fecha_limite timestamptz default null, p_evaluacion uuid default null, p_publicada boolean default false, p_clase uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
 perform public.portal2027_validar_clase_recurso(p_clase,p_asignacion,p_trimestre);
 v := public.portal2027_crear_tarea(p_asignacion,p_trimestre,p_titulo,p_instrucciones,p_fecha_limite,p_evaluacion,p_publicada);
 update public.portal2027_tareas set clase_id=p_clase where id=v;
 return v;
end $$;

create or replace function public.portal2027_ubicar_recurso_clase(p_id uuid,p_tipo text,p_clase uuid,p_version integer default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare r record;
begin
 if p_tipo='material' then select * into r from public.portal2027_materiales where id=p_id for update;
 elsif p_tipo='tarea' then select * into r from public.portal2027_tareas where id=p_id for update;
 else raise exception 'Tipo inválido'; end if;
 if not found then raise exception 'El recurso no existe'; end if;
 perform public.portal2027_validar_clase_recurso(p_clase,r.asignacion_id,r.trimestre_id);
 if p_tipo='material' then update public.portal2027_materiales set clase_id=p_clase where id=p_id;
 else
   if p_version is distinct from r.version then raise exception 'CONFLICTO: la tarea cambió. Recargue.'; end if;
   update public.portal2027_tareas set clase_id=p_clase,version=version+1,actualizado_en=now() where id=p_id;
 end if;
 return true;
end $$;
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
        where m.asignacion_id = a.id and m.trimestre_id = p_trimestre and m.publicado and m.eliminado_en is null), '[]'::jsonb),
      'tareas', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'instrucciones', t.instrucciones,
                 'clase_id', t.clase_id, 'clase_numero', (select c.numero from public.portal2027_plan_clases c where c.id=t.clase_id), 'clase_tema', (select c.tema from public.portal2027_plan_clases c where c.id=t.clase_id), 'fecha_limite', t.fecha_limite, 'vale_nota', t.evaluacion_id is not null,
                 'entrega', (select jsonb_build_object('id', en.id, 'archivo_nombre', en.archivo_nombre, 'archivo_ruta', en.archivo_ruta,
                                'comentario', en.comentario, 'entregada_en', en.entregada_en, 'tardia', en.tardia,
                                'estado', en.estado, 'comentario_profesor', en.comentario_profesor)
                             from public.portal2027_entregas en where en.tarea_id = t.id and en.matricula_id = v_mat))
               order by t.fecha_limite nulls last, t.creado_en)
        from public.portal2027_tareas t
        where t.asignacion_id = a.id and t.trimestre_id = p_trimestre and t.publicada and t.eliminada_en is null), '[]'::jsonb)
    ) as x
    from public.portal2027_asignaciones a
    join public.portal2027_materias mt on mt.id = a.materia_id
    where a.salon_id = v_salon
  ) s;
  return jsonb_build_object('matricula_id', v_mat, 'materias', v_res);
end $$;

revoke all on function public.portal2027_validar_clase_recurso(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.portal2027_crear_material_clase(uuid,uuid,text,text,text,text,boolean,uuid,text), public.portal2027_crear_tarea_clase(uuid,uuid,text,text,timestamptz,uuid,boolean,uuid), public.portal2027_ubicar_recurso_clase(uuid,text,uuid,integer) from public,anon;
grant execute on function public.portal2027_crear_material_clase(uuid,uuid,text,text,text,text,boolean,uuid,text), public.portal2027_crear_tarea_clase(uuid,uuid,text,text,timestamptz,uuid,boolean,uuid), public.portal2027_ubicar_recurso_clase(uuid,text,uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
