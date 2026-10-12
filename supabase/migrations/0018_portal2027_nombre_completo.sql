-- 0018_portal2027_nombre_completo.sql
-- El Excel ahora trae el nombre completo en una sola columna («Apellidos, Nombres»). Si una fila no trae coma,
-- el nombre completo queda en «nombres» y «apellidos» queda vacío. Esta migración permite apellidos vacíos
-- y ajusta la importación. Ejecutar en Supabase > SQL Editor (después de 0017) ANTES de subir la página nueva.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.portal2027_estudiantes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%apellidos%'
  loop
    execute format('alter table public.portal2027_estudiantes drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.portal2027_estudiantes alter column apellidos set default '';

create or replace function public.portal2027_importar_estudiantes(p_filas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  f jsonb; n int := 0;
  v_cod text; v_nom text; v_ape text; v_grado text; v_sec text; v_anio int; v_correo text;
  v_acu text; v_tel text; v_estado text; v_sexo text; v_sexo_txt text;
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
    v_sexo_txt := lower(trim(coalesce(f ->> 'sexo', '')));
    v_sexo := case
      when v_sexo_txt in ('f', 'femenino') then 'F'
      when v_sexo_txt in ('m', 'masculino') then 'M'
      when v_sexo_txt = '' then null
      else 'X' end;
    v_estado := coalesce(nullif(lower(trim(coalesce(f ->> 'estado', ''))), ''), 'activo');

    if v_cod = '' or v_nom = '' then
      raise exception 'Fila %: faltan el código o el nombre', n;
    end if;
    if v_grado !~ '^[0-9]{1,2}$' or v_sec !~ '^[A-Z]{1,2}$' then
      raise exception 'Fila %: grado o sección no válidos (grado 9 y sección C forman 9C)', n;
    end if;
    begin
      v_anio := (f ->> 'anio_lectivo')::int;
    exception when others then
      raise exception 'Fila %: año lectivo no válido', n;
    end;
    if v_sexo = 'X' then
      raise exception 'Fila %: el sexo debe ser Femenino o Masculino', n;
    end if;
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
      insert into public.portal2027_estudiantes (codigo, nombres, apellidos, sexo, correo_estudiante, nombre_acudiente, telefono_acudiente)
      values (v_cod, v_nom, v_ape, v_sexo, v_correo, v_acu, v_tel) returning id into v_est_id;
      r_nuevos := r_nuevos + 1;
    else
      update public.portal2027_estudiantes
        set nombres = v_nom, apellidos = v_ape,
            sexo = coalesce(v_sexo, sexo),
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
