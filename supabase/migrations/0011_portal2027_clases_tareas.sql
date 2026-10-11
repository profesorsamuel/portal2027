-- 0011_portal2027_clases_tareas.sql
-- Etapa 5 (guía), parte A: materiales, tareas, plazos y entregas por grupo/materia.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0010.
-- Las tablas NO se escriben directamente: todo cambio pasa por funciones portal2027_*.
-- Archivos en Storage privado: portal2027-materiales y portal2027-entregas.
-- Si una tarea aporta nota, se vincula a una columna de la libreta y la nota se guarda con
-- portal2027_guardar_nota (guardado común, con versión e historial). Aquí no se calcula nada.

-- ---------- Tablas ----------
create table public.portal2027_materiales (
  id             uuid primary key default gen_random_uuid(),
  asignacion_id  uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id   uuid not null references public.portal2027_trimestres (id) on delete restrict,
  titulo         text not null check (length(trim(titulo)) between 1 and 120),
  descripcion    text not null default '' check (length(descripcion) <= 2000),
  archivo_ruta   text,                       -- ruta del objeto en portal2027-materiales (opcional)
  archivo_nombre text,
  publicado      boolean not null default true,
  eliminado_en   timestamptz,                -- papelera recuperable
  creado_por     uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en      timestamptz not null default now(),
  check ((archivo_ruta is null) = (archivo_nombre is null))
);
create index portal2027_materiales_idx on public.portal2027_materiales (asignacion_id, trimestre_id);

create table public.portal2027_tareas (
  id             uuid primary key default gen_random_uuid(),
  asignacion_id  uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id   uuid not null references public.portal2027_trimestres (id) on delete restrict,
  titulo         text not null check (length(trim(titulo)) between 1 and 120),
  instrucciones  text not null default '' check (length(instrucciones) <= 4000),
  fecha_limite   timestamptz,                -- plazo; nulo = sin plazo
  evaluacion_id  uuid references public.portal2027_evaluaciones (id) on delete restrict,  -- opcional: columna de la libreta
  publicada      boolean not null default false,
  eliminada_en   timestamptz,
  version        integer not null default 1,
  creado_por     uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index portal2027_tareas_idx on public.portal2027_tareas (asignacion_id, trimestre_id);
-- Una columna de la libreta solo puede estar vinculada a una tarea.
create unique index portal2027_tareas_evaluacion_uq on public.portal2027_tareas (evaluacion_id) where evaluacion_id is not null;

-- Una entrega por tarea y matrícula; reenviar reemplaza el archivo (mientras no esté revisada).
create table public.portal2027_entregas (
  id                uuid primary key default gen_random_uuid(),
  tarea_id          uuid not null references public.portal2027_tareas (id) on delete restrict,
  matricula_id      uuid not null references public.portal2027_matriculas (id) on delete restrict,
  archivo_ruta      text not null,           -- objeto en portal2027-entregas: <tarea>/<matricula>/<archivo>
  archivo_nombre    text not null,
  comentario        text not null default '' check (length(comentario) <= 1000),
  entregada_en      timestamptz not null default now(),
  tardia            boolean not null default false,
  estado            text not null default 'entregada' check (estado in ('entregada', 'revisada')),
  comentario_profesor text not null default '' check (length(comentario_profesor) <= 2000),
  revisada_en       timestamptz,
  revisada_por      uuid references public.portal2027_perfiles (id) on delete set null,
  version           integer not null default 1,
  unique (tarea_id, matricula_id)
);

-- La entrega es de un estudiante del mismo grupo de la tarea.
create function public.portal2027_validar_entrega()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_tareas t
    join public.portal2027_asignaciones a on a.id = t.asignacion_id
    join public.portal2027_matriculas m on m.salon_id = a.salon_id
    where t.id = new.tarea_id and m.id = new.matricula_id
  ) then
    raise exception 'El estudiante no pertenece al grupo de esta tarea';
  end if;
  return new;
end $$;
create trigger portal2027_entregas_validar before insert or update of tarea_id, matricula_id
  on public.portal2027_entregas for each row execute function public.portal2027_validar_entrega();

-- Trimestre del mismo año del grupo; evaluación de la misma asignación y trimestre.
create function public.portal2027_validar_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where a.id = new.asignacion_id and t.id = new.trimestre_id
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;
  if new.evaluacion_id is not null and not exists (
    select 1 from public.portal2027_evaluaciones e
    where e.id = new.evaluacion_id and e.asignacion_id = new.asignacion_id and e.trimestre_id = new.trimestre_id
  ) then
    raise exception 'La columna de la libreta debe ser de la misma materia, grupo y trimestre';
  end if;
  return new;
end $$;
create trigger portal2027_tareas_validar before insert or update of asignacion_id, trimestre_id, evaluacion_id
  on public.portal2027_tareas for each row execute function public.portal2027_validar_tarea();

create function public.portal2027_validar_material()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where a.id = new.asignacion_id and t.id = new.trimestre_id
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;
  if new.archivo_ruta is not null and split_part(new.archivo_ruta, '/', 1) <> new.asignacion_id::text then
    raise exception 'El archivo debe estar en la carpeta de esta asignación';
  end if;
  return new;
end $$;
create trigger portal2027_materiales_validar before insert or update of asignacion_id, trimestre_id, archivo_ruta
  on public.portal2027_materiales for each row execute function public.portal2027_validar_material();

-- ---------- Funciones de apoyo para RLS ----------
-- ¿Soy estudiante matriculado en el grupo de esta asignación? (devuelve mi matrícula o nulo)
create function public.portal2027_mi_matricula_en_asignacion(p_asignacion uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id
    from public.portal2027_asignaciones a
    join public.portal2027_matriculas m on m.salon_id = a.salon_id
    join public.portal2027_estudiantes e on e.id = m.estudiante_id
   where a.id = p_asignacion and e.usuario_id = auth.uid()
     and public.portal2027_tiene_rol('estudiante')
   limit 1;
$$;

-- Convierte texto a uuid sin fallar (las carpetas de Storage son texto).
create function public.portal2027_uuid_o_nulo(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Material: lo leen quien edita la asignación o el estudiante del grupo si el material está publicado.
create function public.portal2027_puede_leer_material(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_materiales m
    where m.archivo_ruta = p_ruta and m.eliminado_en is null
      and (public.portal2027_puede_editar_asignacion(m.asignacion_id)
           or (m.publicado and public.portal2027_mi_matricula_en_asignacion(m.asignacion_id) is not null))
  );
$$;

-- Entrega: la lee quien edita la asignación de la tarea o el estudiante dueño (carpeta <tarea>/<matricula>/...).
create function public.portal2027_puede_leer_entrega(p_tarea uuid, p_matricula uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_tareas t
    where t.id = p_tarea
      and (public.portal2027_puede_editar_asignacion(t.asignacion_id)
           or public.portal2027_mi_matricula_en_asignacion(t.asignacion_id) = p_matricula)
  );
$$;

-- Subir: solo el estudiante dueño, en su carpeta, en una tarea publicada y mientras no esté revisada.
create function public.portal2027_puede_subir_entrega(p_tarea uuid, p_matricula uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_tareas t
    where t.id = p_tarea and t.publicada and t.eliminada_en is null
      and public.portal2027_mi_matricula_en_asignacion(t.asignacion_id) = p_matricula
      and not exists (select 1 from public.portal2027_entregas en
                      where en.tarea_id = p_tarea and en.matricula_id = p_matricula and en.estado = 'revisada')
  );
$$;

revoke execute on function public.portal2027_mi_matricula_en_asignacion(uuid), public.portal2027_uuid_o_nulo(text),
  public.portal2027_puede_leer_material(text), public.portal2027_puede_leer_entrega(uuid, uuid),
  public.portal2027_puede_subir_entrega(uuid, uuid) from public, anon;
grant execute on function public.portal2027_mi_matricula_en_asignacion(uuid), public.portal2027_uuid_o_nulo(text),
  public.portal2027_puede_leer_material(text), public.portal2027_puede_leer_entrega(uuid, uuid),
  public.portal2027_puede_subir_entrega(uuid, uuid) to authenticated;

-- ---------- RLS de tablas ----------
revoke all on public.portal2027_materiales, public.portal2027_tareas, public.portal2027_entregas from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.portal2027_materiales, public.portal2027_tareas, public.portal2027_entregas from authenticated;
grant select on public.portal2027_materiales, public.portal2027_tareas, public.portal2027_entregas to authenticated;
alter table public.portal2027_materiales enable row level security;
alter table public.portal2027_tareas     enable row level security;
alter table public.portal2027_entregas   enable row level security;

-- Personal: lo de sus asignaciones. El estudiante usa funciones (no lee estas tablas directamente).
create policy portal2027_materiales_ver on public.portal2027_materiales
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
create policy portal2027_tareas_ver on public.portal2027_tareas
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
create policy portal2027_entregas_ver on public.portal2027_entregas
  for select to authenticated using (public.portal2027_puede_leer_entrega(tarea_id, matricula_id));

-- ---------- Buckets privados ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal2027-materiales', 'portal2027-materiales', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal2027-entregas', 'portal2027-entregas', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- Materiales: sube/quita solo quien edita la asignación (carpeta = id de la asignación).
create policy portal2027_materiales_obj_ver on storage.objects for select to authenticated
  using (bucket_id = 'portal2027-materiales' and public.portal2027_puede_leer_material(name));
create policy portal2027_materiales_obj_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'portal2027-materiales'
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[1]) is not null
    and public.portal2027_puede_editar_asignacion(public.portal2027_uuid_o_nulo((storage.foldername(name))[1])));
create policy portal2027_materiales_obj_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'portal2027-materiales'
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[1]) is not null
    and public.portal2027_puede_editar_asignacion(public.portal2027_uuid_o_nulo((storage.foldername(name))[1])));

-- Entregas: ruta <tarea>/<matricula>/<archivo>. Lee el estudiante dueño o el personal de la asignación;
-- sube/reemplaza solo el dueño. Nadie borra objetos desde el navegador (se conservan como evidencia).
create policy portal2027_entregas_obj_ver on storage.objects for select to authenticated
  using (bucket_id = 'portal2027-entregas'
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[1]) is not null
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[2]) is not null
    and public.portal2027_puede_leer_entrega(public.portal2027_uuid_o_nulo((storage.foldername(name))[1]),
                                              public.portal2027_uuid_o_nulo((storage.foldername(name))[2])));
create policy portal2027_entregas_obj_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'portal2027-entregas'
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[1]) is not null
    and public.portal2027_uuid_o_nulo((storage.foldername(name))[2]) is not null
    and public.portal2027_puede_subir_entrega(public.portal2027_uuid_o_nulo((storage.foldername(name))[1]),
                                               public.portal2027_uuid_o_nulo((storage.foldername(name))[2])));

-- ---------- Funciones de escritura: materiales ----------
create function public.portal2027_crear_material(
  p_asignacion uuid, p_trimestre uuid, p_titulo text, p_descripcion text,
  p_ruta text default null, p_nombre text default null, p_publicado boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  insert into public.portal2027_materiales (asignacion_id, trimestre_id, titulo, descripcion, archivo_ruta, archivo_nombre, publicado)
    values (p_asignacion, p_trimestre, left(trim(coalesce(p_titulo, '')), 120), left(trim(coalesce(p_descripcion, '')), 2000),
            nullif(p_ruta, ''), case when nullif(p_ruta, '') is null then null else left(coalesce(nullif(trim(p_nombre), ''), 'archivo'), 200) end,
            coalesce(p_publicado, true))
    returning id into v_id;
  return v_id;
end $$;

-- Publicar/ocultar o mover a la papelera (y restaurar). Parámetro nulo = no cambia.
create function public.portal2027_actualizar_material(p_id uuid, p_publicado boolean default null, p_a_papelera boolean default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from public.portal2027_materiales where id = p_id for update;
  if not found then raise exception 'El material no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(m.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  update public.portal2027_materiales set
    publicado = coalesce(p_publicado, publicado),
    eliminado_en = case when p_a_papelera is null then eliminado_en when p_a_papelera then now() else null end
  where id = p_id;
  return true;
end $$;

-- ---------- Funciones de escritura: tareas ----------
create function public.portal2027_crear_tarea(
  p_asignacion uuid, p_trimestre uuid, p_titulo text, p_instrucciones text,
  p_fecha_limite timestamptz default null, p_evaluacion uuid default null, p_publicada boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  insert into public.portal2027_tareas (asignacion_id, trimestre_id, titulo, instrucciones, fecha_limite, evaluacion_id, publicada)
    values (p_asignacion, p_trimestre, left(trim(coalesce(p_titulo, '')), 120), left(trim(coalesce(p_instrucciones, '')), 4000),
            p_fecha_limite, p_evaluacion, coalesce(p_publicada, false))
    returning id into v_id;
  return v_id;
end $$;

-- Cambia título, instrucciones, plazo, publicación o papelera. Con versión (rechaza conflictos).
-- p_limpiar_plazo = true quita el plazo; p_limpiar_evaluacion = true quita el vínculo con la libreta.
create function public.portal2027_actualizar_tarea(
  p_id uuid, p_version integer, p_titulo text default null, p_instrucciones text default null,
  p_fecha_limite timestamptz default null, p_limpiar_plazo boolean default false,
  p_evaluacion uuid default null, p_limpiar_evaluacion boolean default false,
  p_publicada boolean default null, p_a_papelera boolean default null)
returns integer language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.portal2027_tareas where id = p_id for update;
  if not found then raise exception 'La tarea no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(t.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if t.version <> p_version then
    raise exception 'CONFLICTO: la tarea cambió desde que la abrió. Recargue la página.';
  end if;
  if p_evaluacion is not null and exists (select 1 from public.portal2027_entregas e where e.tarea_id = p_id and e.estado = 'revisada')
     and p_evaluacion is distinct from t.evaluacion_id then
    raise exception 'No se puede cambiar el vínculo con la libreta: ya hay entregas revisadas';
  end if;
  update public.portal2027_tareas set
    titulo = coalesce(left(trim(p_titulo), 120), titulo),
    instrucciones = coalesce(left(trim(p_instrucciones), 4000), instrucciones),
    fecha_limite = case when p_limpiar_plazo then null else coalesce(p_fecha_limite, fecha_limite) end,
    evaluacion_id = case when p_limpiar_evaluacion then null else coalesce(p_evaluacion, evaluacion_id) end,
    publicada = coalesce(p_publicada, publicada),
    eliminada_en = case when p_a_papelera is null then eliminada_en when p_a_papelera then now() else null end,
    version = version + 1, actualizado_en = now()
  where id = p_id;
  return t.version + 1;
end $$;

-- ---------- Funciones de escritura: entregas ----------
-- El estudiante registra su entrega DESPUÉS de subir el archivo. Si ya entregó, reemplaza (hasta que se revise).
-- El plazo no bloquea: una entrega posterior al plazo se marca «tardía» (regla por confirmar).
create function public.portal2027_entregar_tarea(p_tarea uuid, p_ruta text, p_nombre text, p_comentario text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; v_mat uuid; en record; v_tardia boolean; v_version integer;
begin
  select * into t from public.portal2027_tareas where id = p_tarea;
  if not found or not t.publicada or t.eliminada_en is not null then raise exception 'La tarea no está disponible'; end if;
  v_mat := public.portal2027_mi_matricula_en_asignacion(t.asignacion_id);
  if v_mat is null then raise exception 'No tiene permiso para esta acción (row-level security)'; end if;
  if split_part(p_ruta, '/', 1) <> p_tarea::text or split_part(p_ruta, '/', 2) <> v_mat::text or split_part(p_ruta, '/', 3) = '' then
    raise exception 'La ruta del archivo no corresponde a su entrega';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'portal2027-entregas' and o.name = p_ruta) then
    raise exception 'El archivo no se encontró en el servidor; vuelva a subirlo';
  end if;
  v_tardia := t.fecha_limite is not null and now() > t.fecha_limite;

  select * into en from public.portal2027_entregas where tarea_id = p_tarea and matricula_id = v_mat for update;
  if found then
    if en.estado = 'revisada' then raise exception 'La entrega ya fue revisada; no se puede reemplazar'; end if;
    update public.portal2027_entregas set archivo_ruta = p_ruta, archivo_nombre = left(coalesce(nullif(trim(p_nombre), ''), 'archivo'), 200),
      comentario = left(trim(coalesce(p_comentario, '')), 1000), entregada_en = now(), tardia = v_tardia, version = version + 1
      where id = en.id returning version into v_version;
  else
    insert into public.portal2027_entregas (tarea_id, matricula_id, archivo_ruta, archivo_nombre, comentario, tardia)
      values (p_tarea, v_mat, p_ruta, left(coalesce(nullif(trim(p_nombre), ''), 'archivo'), 200), left(trim(coalesce(p_comentario, '')), 1000), v_tardia)
      returning version into v_version;
  end if;
  return jsonb_build_object('version', v_version, 'tardia', v_tardia);
end $$;

-- Revisar: comentario y, si la tarea está vinculada a la libreta y se envía nota, la guarda con el guardado común.
-- Revisar de nuevo con la misma nota no crea otra (guardar_nota devuelve «sin cambio»); cambiarla exige motivo.
create function public.portal2027_revisar_entrega(
  p_entrega uuid, p_version integer, p_comentario text, p_nota numeric default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare en record; t record; v_nv integer; v_res jsonb := null;
begin
  select * into en from public.portal2027_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega no existe'; end if;
  select * into t from public.portal2027_tareas where id = en.tarea_id;
  if not public.portal2027_puede_editar_asignacion(t.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if en.version <> p_version then
    raise exception 'CONFLICTO: el estudiante cambió su entrega. Recargue la página.';
  end if;
  if p_nota is not null then
    if t.evaluacion_id is null then raise exception 'Esta tarea no está vinculada a una columna de la libreta'; end if;
    select coalesce((select n.version from public.portal2027_notas n where n.evaluacion_id = t.evaluacion_id and n.matricula_id = en.matricula_id), 0)
      into v_nv;
    v_res := public.portal2027_guardar_nota(t.evaluacion_id, en.matricula_id, p_nota, v_nv, p_motivo);
  end if;
  update public.portal2027_entregas set estado = 'revisada', comentario_profesor = left(trim(coalesce(p_comentario, '')), 2000),
    revisada_en = now(), revisada_por = auth.uid(), version = version + 1
    where id = p_entrega;
  return jsonb_build_object('version', en.version + 1, 'nota', v_res);
end $$;

-- Devolver para corregir: vuelve a «entregada» y el estudiante puede reemplazar el archivo. La nota ya guardada no se toca.
create function public.portal2027_reabrir_entrega(p_entrega uuid, p_version integer)
returns integer language plpgsql security definer set search_path = public as $$
declare en record; t record;
begin
  select * into en from public.portal2027_entregas where id = p_entrega for update;
  if not found then raise exception 'La entrega no existe'; end if;
  select * into t from public.portal2027_tareas where id = en.tarea_id;
  if not public.portal2027_puede_editar_asignacion(t.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if en.version <> p_version then raise exception 'CONFLICTO: la entrega cambió. Recargue la página.'; end if;
  update public.portal2027_entregas set estado = 'entregada', version = version + 1 where id = p_entrega;
  return en.version + 1;
end $$;

-- ---------- Lo que ve el estudiante ----------
-- Materiales publicados y tareas publicadas de mi grupo, con mi entrega. No incluye notas ni entregas ajenas.
create function public.portal2027_mis_clases(p_trimestre uuid)
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
                 'archivo_ruta', m.archivo_ruta, 'archivo_nombre', m.archivo_nombre, 'creado_en', m.creado_en)
               order by m.creado_en desc)
        from public.portal2027_materiales m
        where m.asignacion_id = a.id and m.trimestre_id = p_trimestre and m.publicado and m.eliminado_en is null), '[]'::jsonb),
      'tareas', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'instrucciones', t.instrucciones,
                 'fecha_limite', t.fecha_limite, 'vale_nota', t.evaluacion_id is not null,
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

revoke execute on function public.portal2027_crear_material(uuid, uuid, text, text, text, text, boolean),
  public.portal2027_actualizar_material(uuid, boolean, boolean),
  public.portal2027_crear_tarea(uuid, uuid, text, text, timestamptz, uuid, boolean),
  public.portal2027_actualizar_tarea(uuid, integer, text, text, timestamptz, boolean, uuid, boolean, boolean, boolean),
  public.portal2027_entregar_tarea(uuid, text, text, text),
  public.portal2027_revisar_entrega(uuid, integer, text, numeric, text),
  public.portal2027_reabrir_entrega(uuid, integer),
  public.portal2027_mis_clases(uuid) from public, anon;
grant execute on function public.portal2027_crear_material(uuid, uuid, text, text, text, text, boolean),
  public.portal2027_actualizar_material(uuid, boolean, boolean),
  public.portal2027_crear_tarea(uuid, uuid, text, text, timestamptz, uuid, boolean),
  public.portal2027_actualizar_tarea(uuid, integer, text, text, timestamptz, boolean, uuid, boolean, boolean, boolean),
  public.portal2027_entregar_tarea(uuid, text, text, text),
  public.portal2027_revisar_entrega(uuid, integer, text, numeric, text),
  public.portal2027_reabrir_entrega(uuid, integer),
  public.portal2027_mis_clases(uuid) to authenticated;
