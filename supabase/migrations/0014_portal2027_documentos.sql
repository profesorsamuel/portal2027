-- 0014_portal2027_documentos.sql
-- Etapa 8 (guía), parte A: documentos privados por estudiante y año. Bucket privado portal2027-documentos.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0013.
-- Las tablas de documentos NO se escriben directamente: todo cambio pasa por portal2027_registrar_documento y
-- portal2027_revisar_documento. Los tipos de documento los gestiona administración (no se inventó ninguno).
-- Aquí NO se calcula nada de notas ni de honor.

-- ---------- Tablas ----------
create table public.portal2027_tipos_documento (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null check (codigo ~ '^[a-z0-9_]{2,40}$'),
  nombre      text not null check (length(trim(nombre)) > 0 and length(nombre) <= 120),
  obligatorio boolean not null default true,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create unique index portal2027_tipos_documento_codigo_uq on public.portal2027_tipos_documento (lower(codigo));

-- Un documento vigente por estudiante, año y tipo. Sustituir reemplaza el vigente; lo anterior queda en el historial.
create table public.portal2027_documentos (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.portal2027_estudiantes (id) on delete restrict,
  anio_id        uuid not null references public.portal2027_anios (id) on delete restrict,
  tipo_id        uuid not null references public.portal2027_tipos_documento (id) on delete restrict,
  archivo_ruta   text not null,            -- objeto en portal2027-documentos: <estudiante>/<año>/<tipo>/<archivo>
  archivo_nombre text not null,
  archivo_tamano bigint not null check (archivo_tamano > 0),
  archivo_mime   text not null,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  observacion    text not null default '' check (length(observacion) <= 1000),
  subido_en      timestamptz not null default now(),
  subido_por     uuid references public.portal2027_perfiles (id) on delete set null,
  revisado_en    timestamptz,
  revisado_por   uuid references public.portal2027_perfiles (id) on delete set null,
  version        integer not null default 1,
  unique (estudiante_id, anio_id, tipo_id),
  foreign key (estudiante_id, anio_id) references public.portal2027_matriculas (estudiante_id, anio_id) on delete restrict
);
create index portal2027_documentos_anio_idx on public.portal2027_documentos (anio_id, estudiante_id);

-- Historial: solo se agrega. Cada registro y cada revisión dejan una fila con la ruta del archivo de ese momento.
create table public.portal2027_historial_documentos (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references public.portal2027_documentos (id) on delete restrict,
  estudiante_id  uuid not null,
  anio_id        uuid not null,
  tipo_id        uuid not null,
  accion         text not null check (accion in ('registrado', 'aprobado', 'rechazado')),
  archivo_ruta   text not null,
  archivo_nombre text not null,
  archivo_tamano bigint not null,
  archivo_mime   text not null,
  estado         text not null,
  observacion    text not null default '',
  version        integer not null,
  hecho_por      uuid references public.portal2027_perfiles (id) on delete set null,
  hecho_en       timestamptz not null default now()
);
create index portal2027_historial_documentos_doc_idx on public.portal2027_historial_documentos (documento_id, hecho_en);

create function public.portal2027_historial_documentos_solo_agregar()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial de documentos no se puede modificar ni borrar';
end $$;
create trigger portal2027_historial_documentos_inmutable before update or delete
  on public.portal2027_historial_documentos for each row execute function public.portal2027_historial_documentos_solo_agregar();

-- ---------- Funciones de apoyo para RLS ----------
-- Revisar: administración o el consejero del grupo donde el estudiante está matriculado ese año.
create function public.portal2027_reviso_documentos(p_estudiante uuid, p_anio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_es_admin()
    or (public.portal2027_tiene_rol('consejero') and exists (
      select 1 from public.portal2027_matriculas m
      join public.portal2027_consejeros_salon c on c.salon_id = m.salon_id
      where m.estudiante_id = p_estudiante and m.anio_id = p_anio and c.consejero_id = auth.uid()
    ));
$$;

-- Ver documentos de un estudiante en un año: administración, el propio estudiante o el consejero de su grupo ese año.
create function public.portal2027_ve_documentos(p_estudiante uuid, p_anio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_es_admin()
    or public.portal2027_es_mi_ficha(p_estudiante)
    or public.portal2027_reviso_documentos(p_estudiante, p_anio);
$$;

-- Subir: el estudiante dueño (o administración), con matrícula ese año, tipo activo, y sin sustituir un documento aprobado
-- (administración sí puede).
create function public.portal2027_puede_subir_documento(p_estudiante uuid, p_anio uuid, p_tipo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (public.portal2027_es_admin() or public.portal2027_es_mi_ficha(p_estudiante))
    and exists (select 1 from public.portal2027_matriculas m where m.estudiante_id = p_estudiante and m.anio_id = p_anio)
    and exists (select 1 from public.portal2027_tipos_documento t where t.id = p_tipo and t.activo)
    and (public.portal2027_es_admin() or not exists (
      select 1 from public.portal2027_documentos d
      where d.estudiante_id = p_estudiante and d.anio_id = p_anio and d.tipo_id = p_tipo and d.estado = 'aprobado'));
$$;

revoke execute on function public.portal2027_ve_documentos(uuid, uuid), public.portal2027_reviso_documentos(uuid, uuid),
  public.portal2027_puede_subir_documento(uuid, uuid, uuid) from public, anon;
grant execute on function public.portal2027_ve_documentos(uuid, uuid), public.portal2027_reviso_documentos(uuid, uuid),
  public.portal2027_puede_subir_documento(uuid, uuid, uuid) to authenticated;

-- ---------- RLS de tablas ----------
revoke all on public.portal2027_tipos_documento, public.portal2027_documentos, public.portal2027_historial_documentos from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.portal2027_documentos, public.portal2027_historial_documentos from authenticated;
revoke delete, truncate, references, trigger on public.portal2027_tipos_documento from authenticated;
grant select on public.portal2027_documentos, public.portal2027_historial_documentos to authenticated;
grant select, insert, update on public.portal2027_tipos_documento to authenticated;
alter table public.portal2027_tipos_documento       enable row level security;
alter table public.portal2027_documentos            enable row level security;
alter table public.portal2027_historial_documentos  enable row level security;

create policy portal2027_tipos_documento_ver on public.portal2027_tipos_documento
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_tipos_documento_ins on public.portal2027_tipos_documento
  for insert to authenticated with check (public.portal2027_es_admin());
create policy portal2027_tipos_documento_upd on public.portal2027_tipos_documento
  for update to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_documentos_ver on public.portal2027_documentos
  for select to authenticated using (public.portal2027_ve_documentos(estudiante_id, anio_id));
create policy portal2027_historial_documentos_ver on public.portal2027_historial_documentos
  for select to authenticated using (public.portal2027_ve_documentos(estudiante_id, anio_id));

-- ---------- Bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal2027-documentos', 'portal2027-documentos', false, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ruta: <estudiante>/<año>/<tipo>/<archivo>. Sin políticas de actualizar ni borrar: los archivos viejos se conservan.
create policy portal2027_documentos_obj_ver on storage.objects for select to authenticated
  using (bucket_id = 'portal2027-documentos'
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[1]) is not null
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[2]) is not null
    and public.portal2027_ve_documentos(public.portal2027_uuid_o_nulo((storage.foldername(name))[1]),
                                        public.portal2027_uuid_o_nulo((storage.foldername(name))[2])));
create policy portal2027_documentos_obj_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'portal2027-documentos'
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[1]) is not null
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[2]) is not null
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[3]) is not null
    and public.portal2027_puede_subir_documento(public.portal2027_uuid_o_nulo((storage.foldername(name))[1]),
                                                public.portal2027_uuid_o_nulo((storage.foldername(name))[2]),
                                                public.portal2027_uuid_o_nulo((storage.foldername(name))[3])));

-- ---------- Funciones de escritura ----------
-- Se llama DESPUÉS de subir el archivo. Tamaño y tipo se toman del objeto guardado en Storage, no de lo que diga el navegador.
-- Si ya había documento de ese tipo: lo reemplaza, vuelve a «pendiente» y lo anterior queda en el historial con su ruta.
-- Registrar dos veces la misma ruta no duplica nada.
create function public.portal2027_registrar_documento(
  p_estudiante uuid, p_anio uuid, p_tipo uuid, p_ruta text, p_nombre text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := public.portal2027_es_admin();
  v_obj record; v_doc record; v_tam bigint; v_mime text; v_nombre text; v_id uuid; v_version integer; v_sustituye boolean := false;
begin
  if not (v_admin or public.portal2027_es_mi_ficha(p_estudiante)) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if not exists (select 1 from public.portal2027_matriculas m where m.estudiante_id = p_estudiante and m.anio_id = p_anio) then
    raise exception 'El estudiante no está matriculado en ese año';
  end if;
  if not exists (select 1 from public.portal2027_tipos_documento t where t.id = p_tipo and t.activo) then
    raise exception 'El tipo de documento no está disponible';
  end if;
  if split_part(p_ruta, '/', 1) <> p_estudiante::text or split_part(p_ruta, '/', 2) <> p_anio::text
     or split_part(p_ruta, '/', 3) <> p_tipo::text or split_part(p_ruta, '/', 4) = '' or split_part(p_ruta, '/', 5) <> '' then
    raise exception 'La ruta del archivo no corresponde a este documento';
  end if;
  select o.metadata into v_obj from storage.objects o where o.bucket_id = 'portal2027-documentos' and o.name = p_ruta;
  if not found then
    raise exception 'El archivo no se encontró en el servidor; vuelva a subirlo';
  end if;
  v_tam := nullif(v_obj.metadata ->> 'size', '')::bigint;
  v_mime := v_obj.metadata ->> 'mimetype';
  if v_tam is null or v_tam <= 0 or v_tam > 5242880 then
    raise exception 'El archivo está vacío o pesa más de 5 MB';
  end if;
  if v_mime is null or v_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Tipo de archivo no permitido';
  end if;
  v_nombre := left(coalesce(nullif(trim(p_nombre), ''), split_part(p_ruta, '/', 4)), 200);

  select * into v_doc from public.portal2027_documentos
    where estudiante_id = p_estudiante and anio_id = p_anio and tipo_id = p_tipo for update;
  if found then
    if v_doc.archivo_ruta = p_ruta then
      return jsonb_build_object('documento_id', v_doc.id, 'version', v_doc.version, 'sustituido', false);
    end if;
    if v_doc.estado = 'aprobado' and not v_admin then
      raise exception 'El documento ya fue aprobado; solo administración puede sustituirlo';
    end if;
    update public.portal2027_documentos set
      archivo_ruta = p_ruta, archivo_nombre = v_nombre, archivo_tamano = v_tam, archivo_mime = v_mime,
      estado = 'pendiente', observacion = '', subido_en = now(), subido_por = auth.uid(),
      revisado_en = null, revisado_por = null, version = version + 1
      where id = v_doc.id returning id, version into v_id, v_version;
    v_sustituye := true;
  else
    insert into public.portal2027_documentos (estudiante_id, anio_id, tipo_id, archivo_ruta, archivo_nombre, archivo_tamano, archivo_mime, subido_por)
      values (p_estudiante, p_anio, p_tipo, p_ruta, v_nombre, v_tam, v_mime, auth.uid())
      returning id, version into v_id, v_version;
  end if;

  insert into public.portal2027_historial_documentos
    (documento_id, estudiante_id, anio_id, tipo_id, accion, archivo_ruta, archivo_nombre, archivo_tamano, archivo_mime, estado, observacion, version, hecho_por)
    values (v_id, p_estudiante, p_anio, p_tipo, 'registrado', p_ruta, v_nombre, v_tam, v_mime, 'pendiente', '', v_version, auth.uid());
  return jsonb_build_object('documento_id', v_id, 'version', v_version, 'sustituido', v_sustituye);
end $$;

-- Aprobar o rechazar. Rechazar exige observación. Una revisión sobre una versión vieja se rechaza con «CONFLICTO».
create function public.portal2027_revisar_documento(
  p_documento uuid, p_version integer, p_estado text, p_observacion text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d record; v_obs text; v_version integer;
begin
  select * into d from public.portal2027_documentos where id = p_documento for update;
  if not found then raise exception 'El documento no existe'; end if;
  if not public.portal2027_reviso_documentos(d.estudiante_id, d.anio_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p_estado not in ('aprobado', 'rechazado') then raise exception 'El estado de revisión no es válido'; end if;
  if d.version <> p_version then
    raise exception 'CONFLICTO: el documento cambió desde que lo abrió. Recargue la página.';
  end if;
  v_obs := left(trim(coalesce(p_observacion, '')), 1000);
  if p_estado = 'rechazado' and v_obs = '' then
    raise exception 'Rechazar un documento exige una observación';
  end if;
  update public.portal2027_documentos set estado = p_estado, observacion = v_obs,
    revisado_en = now(), revisado_por = auth.uid(), version = version + 1
    where id = p_documento returning version into v_version;
  insert into public.portal2027_historial_documentos
    (documento_id, estudiante_id, anio_id, tipo_id, accion, archivo_ruta, archivo_nombre, archivo_tamano, archivo_mime, estado, observacion, version, hecho_por)
    values (d.id, d.estudiante_id, d.anio_id, d.tipo_id, p_estado, d.archivo_ruta, d.archivo_nombre, d.archivo_tamano, d.archivo_mime, p_estado, v_obs, v_version, auth.uid());
  return jsonb_build_object('version', v_version);
end $$;

-- Faltantes del grupo en un año: tipos obligatorios y activos sin documento o con documento rechazado.
-- Los pendientes de revisión no son faltantes; se informan aparte. No se filtra por estado de la matrícula.
create function public.portal2027_faltantes_documentos(p_salon uuid, p_anio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_falt jsonb; v_pend jsonb; v_obl integer;
begin
  if not (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(p_salon)) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if not exists (select 1 from public.portal2027_salones s where s.id = p_salon and s.anio_id = p_anio) then
    raise exception 'El grupo no corresponde a ese año';
  end if;
  select count(*) into v_obl from public.portal2027_tipos_documento where obligatorio and activo;

  select coalesce(jsonb_agg(jsonb_build_object('matricula_id', m.id, 'estudiante_id', m.estudiante_id, 'tipo_id', t.id,
           'tipo', t.nombre, 'motivo', case when d.id is null then 'sin_documento' else 'rechazado' end)
           order by t.nombre), '[]'::jsonb) into v_falt
  from public.portal2027_matriculas m
  cross join public.portal2027_tipos_documento t
  left join public.portal2027_documentos d on d.estudiante_id = m.estudiante_id and d.anio_id = p_anio and d.tipo_id = t.id
  where m.salon_id = p_salon and m.anio_id = p_anio and t.obligatorio and t.activo
    and (d.id is null or d.estado = 'rechazado');

  select coalesce(jsonb_agg(jsonb_build_object('matricula_id', m.id, 'estudiante_id', m.estudiante_id, 'tipo_id', t.id,
           'tipo', t.nombre, 'documento_id', d.id) order by t.nombre), '[]'::jsonb) into v_pend
  from public.portal2027_matriculas m
  join public.portal2027_documentos d on d.estudiante_id = m.estudiante_id and d.anio_id = p_anio and d.estado = 'pendiente'
  join public.portal2027_tipos_documento t on t.id = d.tipo_id
  where m.salon_id = p_salon and m.anio_id = p_anio;

  return jsonb_build_object('obligatorios', v_obl, 'faltantes', v_falt, 'pendientes', v_pend);
end $$;

revoke execute on function public.portal2027_registrar_documento(uuid, uuid, uuid, text, text),
  public.portal2027_revisar_documento(uuid, integer, text, text),
  public.portal2027_faltantes_documentos(uuid, uuid) from public, anon;
grant execute on function public.portal2027_registrar_documento(uuid, uuid, uuid, text, text),
  public.portal2027_revisar_documento(uuid, integer, text, text),
  public.portal2027_faltantes_documentos(uuid, uuid) to authenticated;
