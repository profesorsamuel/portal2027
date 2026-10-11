-- 0005_portal2027_estudiantes.sql
-- Etapa 2: fichas, matrículas, importación, fotos (bucket privado) y permisos.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0004.

-- Para poder exigir que el grupo de la matrícula pertenezca al mismo año.
alter table public.portal2027_salones add constraint portal2027_salones_id_anio_unico unique (id, anio_id);

-- Ficha: una por estudiante (se identifica por su código).
create table public.portal2027_estudiantes (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null check (length(trim(codigo)) > 0),
  nombres            text not null check (length(trim(nombres)) > 0),
  apellidos          text not null check (length(trim(apellidos)) > 0),
  correo_estudiante  text check (correo_estudiante is null or correo_estudiante ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nombre_acudiente   text,
  telefono_acudiente text,
  usuario_id         uuid unique references public.portal2027_perfiles (id) on delete set null,
  invitado_en        timestamptz,
  foto_ruta          text,
  creado_en          timestamptz not null default now()
);
create unique index portal2027_estudiantes_codigo_unico on public.portal2027_estudiantes (lower(codigo));
create unique index portal2027_estudiantes_correo_unico on public.portal2027_estudiantes (lower(correo_estudiante))
  where correo_estudiante is not null;

-- Matrícula: una por estudiante y año.
create table public.portal2027_matriculas (
  id            uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.portal2027_estudiantes (id) on delete cascade,
  anio_id       uuid not null references public.portal2027_anios (id) on delete restrict,
  salon_id      uuid not null,
  estado        text not null default 'activo' check (length(trim(estado)) > 0),
  creado_en     timestamptz not null default now(),
  unique (estudiante_id, anio_id),
  foreign key (salon_id, anio_id) references public.portal2027_salones (id, anio_id) on delete restrict
);
create index portal2027_matriculas_salon_idx on public.portal2027_matriculas (salon_id);

-- ---------- Funciones auxiliares (security definer: evitan recursión de RLS) ----------
create function public.portal2027_es_profesor_de_salon(p_salon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_tiene_rol('profesor') and exists (
    select 1 from public.portal2027_asignaciones a
    where a.salon_id = p_salon and a.profesor_id = auth.uid()
  );
$$;

create function public.portal2027_es_mi_ficha(p_estudiante uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_tiene_rol('estudiante') and exists (
    select 1 from public.portal2027_estudiantes e
    where e.id = p_estudiante and e.usuario_id = auth.uid()
  );
$$;

create function public.portal2027_ve_estudiante(p_estudiante uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_es_admin()
    or public.portal2027_es_mi_ficha(p_estudiante)
    or (public.portal2027_tiene_rol('profesor') and exists (
      select 1 from public.portal2027_matriculas m
      join public.portal2027_asignaciones a on a.salon_id = m.salon_id
      where m.estudiante_id = p_estudiante and a.profesor_id = auth.uid()
    ));
$$;

create function public.portal2027_es_salon_de_mi_ficha(p_salon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_tiene_rol('estudiante') and exists (
    select 1 from public.portal2027_matriculas m
    join public.portal2027_estudiantes e on e.id = m.estudiante_id
    where m.salon_id = p_salon and e.usuario_id = auth.uid()
  );
$$;

-- Fotos: p_texto es la primera carpeta de la ruta (id de la ficha), como texto.
create function public.portal2027_puede_gestionar_foto(p_texto text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal2027_estudiantes e
    where e.id::text = p_texto and public.portal2027_ve_estudiante(e.id)
  );
$$;

revoke execute on function public.portal2027_es_profesor_de_salon(uuid), public.portal2027_es_mi_ficha(uuid),
  public.portal2027_ve_estudiante(uuid), public.portal2027_es_salon_de_mi_ficha(uuid),
  public.portal2027_puede_gestionar_foto(text) from public, anon;
grant execute on function public.portal2027_es_profesor_de_salon(uuid), public.portal2027_es_mi_ficha(uuid),
  public.portal2027_ve_estudiante(uuid), public.portal2027_es_salon_de_mi_ficha(uuid),
  public.portal2027_puede_gestionar_foto(text) to authenticated;

-- ---------- RLS ----------
revoke all on public.portal2027_estudiantes, public.portal2027_matriculas from anon;
revoke truncate, references, trigger on public.portal2027_estudiantes, public.portal2027_matriculas from authenticated;
alter table public.portal2027_estudiantes enable row level security;
alter table public.portal2027_matriculas  enable row level security;

create policy portal2027_estudiantes_ver on public.portal2027_estudiantes
  for select to authenticated using (public.portal2027_ve_estudiante(id));
create policy portal2027_estudiantes_admin on public.portal2027_estudiantes
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_matriculas_ver on public.portal2027_matriculas
  for select to authenticated using (
    public.portal2027_es_admin()
    or public.portal2027_es_mi_ficha(estudiante_id)
    or public.portal2027_es_profesor_de_salon(salon_id)
  );
create policy portal2027_matriculas_admin on public.portal2027_matriculas
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

-- El estudiante ve el grupo en el que está matriculado.
create policy portal2027_salones_ver_estudiante on public.portal2027_salones
  for select to authenticated using (public.portal2027_es_salon_de_mi_ficha(id));

-- Quien sube la foto solo puede cambiar foto_ruta de la ficha (vía función).
create function public.portal2027_guardar_foto_ruta(p_estudiante uuid, p_ruta text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.portal2027_ve_estudiante(p_estudiante) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if p_ruta is not null and p_ruta <> p_estudiante::text || '/foto' then
    raise exception 'Ruta de foto no válida';
  end if;
  update public.portal2027_estudiantes set foto_ruta = p_ruta where id = p_estudiante;
end $$;
revoke execute on function public.portal2027_guardar_foto_ruta(uuid, text) from public, anon;
grant execute on function public.portal2027_guardar_foto_ruta(uuid, text) to authenticated;

-- ---------- Importación (una sola transacción: o entra todo o no entra nada) ----------
-- p_filas: arreglo JSON con las columnas de la hoja Importar.
create function public.portal2027_importar_estudiantes(p_filas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  f jsonb; n int := 0;
  v_cod text; v_nom text; v_ape text; v_grado text; v_sec text; v_anio int; v_correo text;
  v_acu text; v_tel text; v_estado text;
  v_anio_id uuid; v_salon_id uuid; v_est_id uuid; v_mat_id uuid;
  r_nuevos int := 0; r_actualizados int := 0; r_mat_nuevas int := 0; r_mat_act int := 0; r_salones int := 0;
  v_vistos text[] := '{}'; v_clave text;
begin
  if not public.portal2027_es_admin() then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para importar';
  end if;
  if jsonb_array_length(p_filas) > 3000 then
    raise exception 'Máximo 3000 filas por importación';
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    n := n + 1;
    v_cod    := trim(coalesce(f ->> 'codigo_estudiante', ''));
    v_nom    := trim(coalesce(f ->> 'nombres', ''));
    v_ape    := trim(coalesce(f ->> 'apellidos', ''));
    v_grado  := trim(coalesce(f ->> 'grado', ''));
    v_sec    := upper(trim(coalesce(f ->> 'seccion', '')));
    v_correo := nullif(lower(trim(coalesce(f ->> 'correo_estudiante', ''))), '');
    v_acu    := nullif(trim(coalesce(f ->> 'nombre_acudiente', '')), '');
    v_tel    := nullif(trim(coalesce(f ->> 'telefono_acudiente', '')), '');
    v_estado := coalesce(nullif(lower(trim(coalesce(f ->> 'estado', ''))), ''), 'activo');

    if v_cod = '' or v_nom = '' or v_ape = '' then
      raise exception 'Fila %: faltan código, nombres o apellidos', n;
    end if;
    if v_grado !~ '^[0-9]{1,2}$' or v_sec !~ '^[A-Z]{1,2}$' then
      raise exception 'Fila %: grado o sección no válidos (grado 9 y sección C forman 9C)', n;
    end if;
    begin
      v_anio := (f ->> 'anio_lectivo')::int;
    exception when others then
      raise exception 'Fila %: año lectivo no válido', n;
    end;
    if v_correo is not null and v_correo !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Fila %: correo no válido', n;
    end if;

    v_clave := lower(v_cod) || '|' || v_anio;
    if v_clave = any (v_vistos) then
      raise exception 'Fila %: el código % está repetido para el año %', n, v_cod, v_anio;
    end if;
    v_vistos := v_vistos || v_clave;

    select id into v_anio_id from public.portal2027_anios where anio = v_anio;
    if v_anio_id is null then
      raise exception 'Fila %: el año lectivo % no existe; créelo antes en Años lectivos', n, v_anio;
    end if;

    select id into v_salon_id from public.portal2027_salones
      where anio_id = v_anio_id and grado = v_grado and seccion = v_sec;
    if v_salon_id is null then
      insert into public.portal2027_salones (anio_id, grado, seccion) values (v_anio_id, v_grado, v_sec)
        returning id into v_salon_id;
      r_salones := r_salones + 1;
    end if;

    select id into v_est_id from public.portal2027_estudiantes where lower(codigo) = lower(v_cod);
    if v_est_id is null then
      insert into public.portal2027_estudiantes (codigo, nombres, apellidos, correo_estudiante, nombre_acudiente, telefono_acudiente)
      values (v_cod, v_nom, v_ape, v_correo, v_acu, v_tel) returning id into v_est_id;
      r_nuevos := r_nuevos + 1;
    else
      update public.portal2027_estudiantes
        set nombres = v_nom, apellidos = v_ape,
            correo_estudiante = coalesce(v_correo, correo_estudiante),
            nombre_acudiente = coalesce(v_acu, nombre_acudiente),
            telefono_acudiente = coalesce(v_tel, telefono_acudiente)
        where id = v_est_id;
      r_actualizados := r_actualizados + 1;
    end if;

    select id into v_mat_id from public.portal2027_matriculas where estudiante_id = v_est_id and anio_id = v_anio_id;
    if v_mat_id is null then
      insert into public.portal2027_matriculas (estudiante_id, anio_id, salon_id, estado)
      values (v_est_id, v_anio_id, v_salon_id, v_estado);
      r_mat_nuevas := r_mat_nuevas + 1;
    else
      update public.portal2027_matriculas set salon_id = v_salon_id, estado = v_estado where id = v_mat_id;
      r_mat_act := r_mat_act + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'filas', n, 'estudiantes_nuevos', r_nuevos, 'estudiantes_actualizados', r_actualizados,
    'matriculas_nuevas', r_mat_nuevas, 'matriculas_actualizadas', r_mat_act, 'grupos_creados', r_salones
  );
end $$;
revoke execute on function public.portal2027_importar_estudiantes(jsonb) from public, anon;
grant execute on function public.portal2027_importar_estudiantes(jsonb) to authenticated;

-- ---------- Bucket privado de fotos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal2027-fotos', 'portal2027-fotos', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png'];

create policy portal2027_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'portal2027-fotos' and public.portal2027_puede_gestionar_foto((storage.foldername(name))[1]));
create policy portal2027_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'portal2027-fotos' and name = (storage.foldername(name))[1] || '/foto'
    and public.portal2027_puede_gestionar_foto((storage.foldername(name))[1]));
create policy portal2027_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'portal2027-fotos' and public.portal2027_puede_gestionar_foto((storage.foldername(name))[1]))
  with check (bucket_id = 'portal2027-fotos' and name = (storage.foldername(name))[1] || '/foto'
    and public.portal2027_puede_gestionar_foto((storage.foldername(name))[1]));
create policy portal2027_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'portal2027-fotos' and public.portal2027_puede_gestionar_foto((storage.foldername(name))[1]));
