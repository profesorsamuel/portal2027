-- Etapa 3. Ejecutar después de 0044 y antes de publicar los módulos web.
-- No elimina evidencias ni cambia notas, estados o límites de buckets.
begin;
alter table public.portal2027_entregas add column if not exists archivos jsonb;
update public.portal2027_entregas
set archivos = jsonb_build_array(jsonb_build_object('ruta', archivo_ruta, 'nombre', archivo_nombre))
where archivos is null;
alter table public.portal2027_entregas alter column archivos set not null;
alter table public.portal2027_entregas drop constraint if exists portal2027_entregas_archivos_lista;
alter table public.portal2027_entregas add constraint portal2027_entregas_archivos_lista
check (jsonb_typeof(archivos) = 'array' and jsonb_array_length(archivos) between 1 and 15);

create or replace function public.portal2027_entregar_tarea_archivos(
  p_tarea uuid, p_archivos jsonb, p_comentario text default null, p_version integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; en record; v_mat uuid; v_existe boolean; v_archivo jsonb;
  v_lista jsonb := '[]'::jsonb; v_rutas text[] := array[]::text[];
  v_ruta text; v_nombre text; v_version integer; v_tardia boolean;
  v_comentario text := left(trim(coalesce(p_comentario, '')), 1000);
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  select * into t from public.portal2027_tareas where id = p_tarea for share;
  if not found or not t.publicada or t.eliminada_en is not null then raise exception 'La tarea no está disponible'; end if;
  v_mat := public.portal2027_mi_matricula_en_asignacion(t.asignacion_id);
  if v_mat is null then raise exception 'No tiene permiso para esta entrega'; end if;
  -- Serializa también la primera entrega, cuando aún no existe una fila que bloquear.
  perform pg_advisory_xact_lock(hashtextextended(p_tarea::text || '/' || v_mat::text, 0));
  if p_archivos is null or jsonb_typeof(p_archivos) <> 'array' then raise exception 'Seleccione los archivos de su entrega'; end if;
  if jsonb_array_length(p_archivos) not between 1 and 15 then raise exception 'La entrega debe contener entre 1 y 15 archivos'; end if;
  for v_archivo in select value from jsonb_array_elements(p_archivos) loop
    if jsonb_typeof(v_archivo) <> 'object' or jsonb_typeof(v_archivo->'ruta') is distinct from 'string'
      or jsonb_typeof(v_archivo->'nombre') is distinct from 'string' then raise exception 'Los datos de un archivo no son válidos'; end if;
    v_ruta := v_archivo->>'ruta'; v_nombre := trim(v_archivo->>'nombre');
    if v_ruta is null or length(v_ruta) > 1024 or v_nombre = '' or length(v_nombre) > 200
      or v_ruta !~ ('^' || p_tarea::text || '/' || v_mat::text || '/[^/]+$')
      or split_part(v_ruta, '/', 3) in ('.', '..') then raise exception 'El archivo no corresponde a su entrega'; end if;
    if v_ruta = any(v_rutas) then raise exception 'La entrega contiene un archivo repetido'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'portal2027-entregas' and o.name = v_ruta) then
      raise exception 'Un archivo no se encontró en el servidor; vuelva a subirlo'; end if;
    v_rutas := array_append(v_rutas, v_ruta);
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('ruta', v_ruta, 'nombre', v_nombre));
  end loop;
  select * into en from public.portal2027_entregas where tarea_id = p_tarea and matricula_id = v_mat for update;
  v_existe := found;
  if v_existe then
    -- Un reintento de la misma solicitud ya confirmada no duplica ni cambia su fecha.
    if en.archivos = v_lista and en.comentario = v_comentario
      and en.version = coalesce(p_version, 0) + 1 then
      return jsonb_build_object('version', en.version, 'tardia', en.tardia, 'sin_cambio', true);
    end if;
    if en.estado = 'revisada' then raise exception 'La entrega ya fue revisada; no se puede reemplazar'; end if;
    if p_version is distinct from en.version then raise exception 'CONFLICTO: la entrega cambió. Recargue antes de reenviar'; end if;
  elsif p_version is not null then
    raise exception 'CONFLICTO: la entrega cambió. Recargue antes de reenviar';
  end if;
  v_tardia := t.fecha_limite is not null and now() > t.fecha_limite;
  if v_existe then
    update public.portal2027_entregas set archivos = v_lista,
      archivo_ruta = v_lista->0->>'ruta', archivo_nombre = v_lista->0->>'nombre',
      comentario = v_comentario, entregada_en = now(), tardia = v_tardia, version = version + 1
      where id = en.id returning version into v_version;
  else
    insert into public.portal2027_entregas(tarea_id, matricula_id, archivos, archivo_ruta, archivo_nombre, comentario, tardia)
      values(p_tarea, v_mat, v_lista, v_lista->0->>'ruta', v_lista->0->>'nombre', v_comentario, v_tardia)
      returning version into v_version;
  end if;
  return jsonb_build_object('version', v_version, 'tardia', v_tardia);
end $$;

-- Compatibilidad: el cliente anterior sigue enviando un archivo y mantiene ambos formatos sincronizados.
create or replace function public.portal2027_entregar_tarea(
  p_tarea uuid, p_ruta text, p_nombre text, p_comentario text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mat uuid; v_version integer;
begin
  select public.portal2027_mi_matricula_en_asignacion(t.asignacion_id) into v_mat
    from public.portal2027_tareas t where t.id = p_tarea;
  if v_mat is null then raise exception 'No tiene permiso para esta entrega'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tarea::text || '/' || v_mat::text, 0));
  select version into v_version from public.portal2027_entregas where tarea_id = p_tarea and matricula_id = v_mat;
  return public.portal2027_entregar_tarea_archivos(p_tarea,
    jsonb_build_array(jsonb_build_object('ruta', p_ruta, 'nombre', left(coalesce(nullif(trim(p_nombre), ''), 'archivo'), 200))),
    p_comentario, v_version);
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
                 'entrega', (select jsonb_build_object('id', en.id, 'archivos', en.archivos, 'version', en.version, 'archivo_nombre', en.archivo_nombre, 'archivo_ruta', en.archivo_ruta,
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


revoke all on function public.portal2027_entregar_tarea_archivos(uuid,jsonb,text,integer),
 public.portal2027_entregar_tarea(uuid,text,text,text), public.portal2027_mis_clases(uuid) from public, anon;
grant execute on function public.portal2027_entregar_tarea_archivos(uuid,jsonb,text,integer),
 public.portal2027_entregar_tarea(uuid,text,text,text), public.portal2027_mis_clases(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
