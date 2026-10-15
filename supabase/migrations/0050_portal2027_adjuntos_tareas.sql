-- 0050_portal2027_adjuntos_tareas.sql
-- Adjuntos de tareas: PDF, imágenes y enlaces (hasta 10 por tarea).
-- Ejecutar en Supabase > SQL Editor después de 0049, sin errores, antes de publicar los módulos web.
-- Los archivos van al bucket privado portal2027-materiales en <asignacion>/tareas/<tarea>/<archivo>.
-- Las políticas de Storage existentes ya cubren esa ruta: solo se amplía quién puede LEER el archivo.
-- El estudiante ve los adjuntos únicamente por portal2027_mis_clases (tareas publicadas de su grupo).
begin;

-- ---------- Tabla ----------
create table if not exists public.portal2027_tareas_adjuntos (
  id             uuid primary key default gen_random_uuid(),
  tarea_id       uuid not null references public.portal2027_tareas (id) on delete restrict,
  tipo           text not null check (tipo in ('pdf', 'imagen', 'enlace')),
  titulo         text not null check (length(trim(titulo)) between 1 and 120),
  archivo_ruta   text,                      -- objeto en portal2027-materiales (pdf e imagen)
  archivo_nombre text,
  enlace         text check (enlace is null or enlace ~* '^https?://[^[:space:]]+$'),
  orden          integer not null default 0,
  creado_por     uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en      timestamptz not null default now(),
  check (
    (tipo = 'enlace' and enlace is not null and archivo_ruta is null and archivo_nombre is null)
    or (tipo = 'pdf' and enlace is null and archivo_ruta is not null and archivo_nombre ~* '\.pdf$')
    or (tipo = 'imagen' and enlace is null and archivo_ruta is not null and archivo_nombre ~* '\.(jpe?g|png)$')
  )
);
create index if not exists portal2027_tareas_adjuntos_idx on public.portal2027_tareas_adjuntos (tarea_id, orden);

-- ---------- Permisos de lectura de Storage (se amplían; la regla de materiales se conserva) ----------
create or replace function public.portal2027_puede_leer_material(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_materiales m
    where m.archivo_ruta = p_ruta and m.eliminado_en is null
      and (public.portal2027_puede_editar_asignacion(m.asignacion_id)
           or (m.publicado and public.portal2027_mi_matricula_en_asignacion(m.asignacion_id) is not null))
  )
  or exists (
    select 1 from public.portal2027_tareas_adjuntos a
    join public.portal2027_tareas t on t.id = a.tarea_id
    where a.archivo_ruta = p_ruta and t.eliminada_en is null
      and (public.portal2027_puede_editar_asignacion(t.asignacion_id)
           or (t.publicada and public.portal2027_mi_matricula_en_asignacion(t.asignacion_id) is not null))
  );
$$;

-- ---------- Funciones de escritura ----------
create or replace function public.portal2027_agregar_adjunto_tarea(
  p_tarea uuid, p_tipo text, p_titulo text, p_ruta text default null, p_nombre text default null, p_enlace text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t record; v_id uuid; v_orden integer; v_titulo text := left(trim(coalesce(p_titulo, '')), 120);
begin
  select * into t from public.portal2027_tareas where id = p_tarea for update;
  if not found then raise exception 'La tarea no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(t.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if t.eliminada_en is not null then raise exception 'La tarea está en la papelera'; end if;
  if v_titulo = '' then raise exception 'Escriba un título para el adjunto'; end if;
  if (select count(*) from public.portal2027_tareas_adjuntos where tarea_id = p_tarea) >= 10 then
    raise exception 'Una tarea admite hasta 10 adjuntos';
  end if;

  if p_tipo = 'enlace' then
    if nullif(trim(coalesce(p_enlace, '')), '') is null or trim(p_enlace) !~* '^https?://[^[:space:]]+$' then
      raise exception 'Enlace inválido';
    end if;
    p_ruta := null; p_nombre := null;
  elsif p_tipo in ('pdf', 'imagen') then
    if p_ruta is null or p_ruta !~ ('^' || t.asignacion_id::text || '/tareas/' || p_tarea::text || '/[^/]+$') then
      raise exception 'El archivo no corresponde a esta tarea';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'portal2027-materiales' and o.name = p_ruta) then
      raise exception 'Un archivo no se encontró en el servidor; vuelva a subirlo';
    end if;
    p_enlace := null;
  else
    raise exception 'Tipo de adjunto inválido';
  end if;

  select coalesce(max(orden), 0) + 1 into v_orden from public.portal2027_tareas_adjuntos where tarea_id = p_tarea;
  insert into public.portal2027_tareas_adjuntos (tarea_id, tipo, titulo, archivo_ruta, archivo_nombre, enlace, orden)
    values (p_tarea, p_tipo, v_titulo, p_ruta, p_nombre, nullif(trim(coalesce(p_enlace, '')), ''), v_orden)
    returning id into v_id;
  return v_id;
end $$;

-- Devuelve la ruta del archivo para que la web lo retire de Storage (los enlaces devuelven null).
create or replace function public.portal2027_quitar_adjunto_tarea(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select ad.*, t.asignacion_id as asignacion into a
    from public.portal2027_tareas_adjuntos ad
    join public.portal2027_tareas t on t.id = ad.tarea_id
    where ad.id = p_id for update of ad;
  if not found then raise exception 'El adjunto no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(a.asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  delete from public.portal2027_tareas_adjuntos where id = p_id;
  return a.archivo_ruta;
end $$;

-- ---------- Mis clases: cada tarea incluye sus adjuntos ----------
-- Copia de la versión de 0045 con el campo «adjuntos» dentro de cada tarea.
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
                 'adjuntos', coalesce((
                   select jsonb_agg(jsonb_build_object('id', ad.id, 'tipo', ad.tipo, 'titulo', ad.titulo,
                            'archivo_ruta', ad.archivo_ruta, 'archivo_nombre', ad.archivo_nombre, 'enlace', ad.enlace)
                          order by ad.orden, ad.creado_en)
                   from public.portal2027_tareas_adjuntos ad where ad.tarea_id = t.id), '[]'::jsonb),
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

-- ---------- RLS y permisos ----------
revoke all on public.portal2027_tareas_adjuntos from anon;
revoke insert, update, delete, truncate, references, trigger on public.portal2027_tareas_adjuntos from authenticated;
grant select on public.portal2027_tareas_adjuntos to authenticated;
alter table public.portal2027_tareas_adjuntos enable row level security;

create policy portal2027_tareas_adjuntos_ver on public.portal2027_tareas_adjuntos
  for select to authenticated using (exists (
    select 1 from public.portal2027_tareas t
    where t.id = tarea_id and public.portal2027_puede_editar_asignacion(t.asignacion_id)));

revoke all on function public.portal2027_agregar_adjunto_tarea(uuid,text,text,text,text,text),
  public.portal2027_quitar_adjunto_tarea(uuid), public.portal2027_mis_clases(uuid) from public, anon;
grant execute on function public.portal2027_agregar_adjunto_tarea(uuid,text,text,text,text,text),
  public.portal2027_quitar_adjunto_tarea(uuid), public.portal2027_mis_clases(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
