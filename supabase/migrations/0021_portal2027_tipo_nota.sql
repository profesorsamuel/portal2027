-- 0021_portal2027_tipo_nota.sql
-- Cada columna de la libreta dice de qué se trata: «tipo» (Ejercicio virtual, Laboratorio, Participación…)
-- además del «tema». El estudiante lo ve en «Mis notas y ejercicios».
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0020. Se puede ejecutar más de una vez.

-- 1) Columna nueva (vacía = sin tipo; el estudiante verá solo la categoría).
alter table public.portal2027_evaluaciones
  add column if not exists tipo text not null default '' check (length(tipo) <= 40);

-- 2) Las columnas que ya alimentan un ejercicio virtual quedan marcadas como tal.
--    Las de trimestres cerrados no se tocan (la base no permite cambiarlas): el estudiante verá solo la categoría.
update public.portal2027_evaluaciones e set tipo = 'Ejercicio virtual'
  where e.tipo = '' and exists (select 1 from public.portal2027_periodos_ejercicio p where p.evaluacion_id = e.id)
    and not public.portal2027_trimestre_cerrado(e.asignacion_id, e.trimestre_id);

-- 3) Cuando un periodo de ejercicios virtuales se liga a una columna sin tipo, se marca sola.
create or replace function public.portal2027_marcar_tipo_ejercicio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.portal2027_evaluaciones e set tipo = 'Ejercicio virtual'
    where e.id = new.evaluacion_id and e.tipo = '' and not public.portal2027_trimestre_cerrado(e.asignacion_id, e.trimestre_id);
  return new;
end $$;
drop trigger if exists portal2027_periodos_ejercicio_tipo on public.portal2027_periodos_ejercicio;
create trigger portal2027_periodos_ejercicio_tipo after insert or update of evaluacion_id
  on public.portal2027_periodos_ejercicio for each row execute function public.portal2027_marcar_tipo_ejercicio();

-- 4) Crear columna: ahora acepta el tipo (opcional).
drop function if exists public.portal2027_crear_evaluacion(uuid, uuid, text, text);
create function public.portal2027_crear_evaluacion(p_asignacion uuid, p_trimestre uuid, p_categoria text, p_tema text, p_tipo text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_orden integer; v_tipo text := left(trim(coalesce(p_tipo, '')), 40);
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select coalesce(max(orden), 0) + 1 into v_orden from public.portal2027_evaluaciones
    where asignacion_id = p_asignacion and trimestre_id = p_trimestre;
  insert into public.portal2027_evaluaciones (asignacion_id, trimestre_id, categoria, tema, tipo, orden)
    values (p_asignacion, p_trimestre, p_categoria, left(trim(coalesce(p_tema, '')), 120), v_tipo, v_orden)
    returning id into v_id;
  insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, detalle, version)
    values (v_id, 'crear', jsonb_build_object('categoria', p_categoria, 'tema', p_tema, 'tipo', v_tipo), 1);
  return v_id;
end $$;

-- 5) Actualizar columna: tema, tipo, ocultar o bloqueo. Parámetro nulo = no cambia.
drop function if exists public.portal2027_actualizar_evaluacion(uuid, integer, text, boolean, boolean);
create function public.portal2027_actualizar_evaluacion(
  p_id uuid, p_version integer, p_tema text default null, p_oculta boolean default null, p_bloqueada boolean default null,
  p_tipo text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare ev record; v_tema text; v_tipo text;
begin
  select * into ev from public.portal2027_evaluaciones where id = p_id for update;
  if not found then raise exception 'La columna no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(ev.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if ev.version <> p_version then
    raise exception 'CONFLICTO: la columna cambió desde que la abrió. Recargue la libreta.';
  end if;
  if ev.eliminada_en is not null then raise exception 'La columna está en la papelera'; end if;
  v_tema := case when p_tema is null then null else left(trim(p_tema), 120) end;
  v_tipo := case when p_tipo is null then null else left(trim(p_tipo), 40) end;
  if ((v_tema is not null and v_tema is distinct from ev.tema) or (v_tipo is not null and v_tipo is distinct from ev.tipo)) and ev.bloqueada then
    raise exception 'La columna está bloqueada; desbloquéela para cambiar el tema o el tipo';
  end if;
  update public.portal2027_evaluaciones set
    tema = coalesce(v_tema, tema), tipo = coalesce(v_tipo, tipo), oculta = coalesce(p_oculta, oculta),
    bloqueada = coalesce(p_bloqueada, bloqueada), version = version + 1, actualizado_en = now()
  where id = p_id;
  insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, detalle, version)
    values (p_id, 'actualizar', jsonb_build_object('tema', v_tema, 'tipo', v_tipo, 'oculta', p_oculta, 'bloqueada', p_bloqueada), ev.version + 1);
  return ev.version + 1;
end $$;

revoke execute on function public.portal2027_crear_evaluacion(uuid, uuid, text, text, text),
  public.portal2027_actualizar_evaluacion(uuid, integer, text, boolean, boolean, text) from public, anon;
grant execute on function public.portal2027_crear_evaluacion(uuid, uuid, text, text, text),
  public.portal2027_actualizar_evaluacion(uuid, integer, text, boolean, boolean, text) to authenticated;

-- 6) Notas propias del estudiante: ahora incluyen el tipo de cada nota.
create or replace function public.portal2027_mis_notas(p_trimestre uuid)
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
      'publicada', coalesce(p.publicada, false),
      'evaluaciones', case when coalesce(p.publicada, false) then coalesce((
          select jsonb_agg(jsonb_build_object('id', e.id, 'categoria', e.categoria, 'tema', e.tema, 'tipo', e.tipo, 'valor', n.valor) order by e.orden, e.id)
          from public.portal2027_evaluaciones e
          left join public.portal2027_notas n on n.evaluacion_id = e.id and n.matricula_id = v_mat
          where e.asignacion_id = a.id and e.trimestre_id = p_trimestre and e.eliminada_en is null
        ), '[]'::jsonb) else '[]'::jsonb end
    ) as x
    from public.portal2027_asignaciones a
    join public.portal2027_materias mt on mt.id = a.materia_id
    left join public.portal2027_publicaciones p on p.asignacion_id = a.id and p.trimestre_id = p_trimestre
    where a.salon_id = v_salon
  ) s;
  return jsonb_build_object('materias', v_res);
end $$;
