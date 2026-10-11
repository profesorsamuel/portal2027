-- 0010_portal2027_estudiante_academico.sql
-- Etapa 6: el estudiante ve su propia asistencia y sus notas. Las notas solo se ven cuando el profesor
-- (o administración) publica la libreta de esa materia y trimestre; se puede retirar la publicación.
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0009.
-- El estudiante NO lee las tablas directamente: solo recibe sus propios datos por estas funciones.
-- No se calcula nada aquí: promedios y final los calcula el motor único en la pantalla.

create table public.portal2027_publicaciones (
  asignacion_id   uuid not null references public.portal2027_asignaciones (id) on delete cascade,
  trimestre_id    uuid not null references public.portal2027_trimestres (id) on delete cascade,
  publicada       boolean not null default false,
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  primary key (asignacion_id, trimestre_id)
);

revoke all on public.portal2027_publicaciones from anon;
revoke insert, update, delete, truncate, references, trigger on public.portal2027_publicaciones from authenticated;
grant select on public.portal2027_publicaciones to authenticated;
alter table public.portal2027_publicaciones enable row level security;
create policy portal2027_publicaciones_ver on public.portal2027_publicaciones
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));

-- Publicar o retirar (profesor de la asignación o administración).
create function public.portal2027_publicar_notas(p_asignacion uuid, p_trimestre uuid, p_publicar boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where a.id = p_asignacion and t.id = p_trimestre
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;
  insert into public.portal2027_publicaciones (asignacion_id, trimestre_id, publicada, actualizado_por, actualizado_en)
    values (p_asignacion, p_trimestre, coalesce(p_publicar, false), auth.uid(), now())
  on conflict (asignacion_id, trimestre_id) do update
    set publicada = excluded.publicada, actualizado_por = auth.uid(), actualizado_en = now();
  return coalesce(p_publicar, false);
end $$;

-- Notas propias, solo de materias publicadas. Las columnas en papelera no se envían.
create function public.portal2027_mis_notas(p_trimestre uuid)
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
          select jsonb_agg(jsonb_build_object('id', e.id, 'categoria', e.categoria, 'tema', e.tema, 'valor', n.valor) order by e.orden, e.id)
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

-- Asistencia propia: total de sesiones del trimestre y las sesiones con marca.
create function public.portal2027_mi_asistencia(p_trimestre uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mat uuid; v_salon uuid; v_total integer; v_items jsonb;
begin
  if not public.portal2027_tiene_rol('estudiante') then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select m.id, m.salon_id into v_mat, v_salon
    from public.portal2027_matriculas m
    join public.portal2027_estudiantes e on e.id = m.estudiante_id
    join public.portal2027_trimestres t on t.anio_id = m.anio_id
    where e.usuario_id = auth.uid() and t.id = p_trimestre;
  if v_mat is null then return jsonb_build_object('sesiones', 0, 'items', '[]'::jsonb); end if;

  select count(*) into v_total
    from public.portal2027_sesiones_asistencia s
    join public.portal2027_asignaciones a on a.id = s.asignacion_id
    where a.salon_id = v_salon and s.trimestre_id = p_trimestre and s.eliminada_en is null;

  select coalesce(jsonb_agg(jsonb_build_object('materia', mt.nombre, 'fecha', s.fecha, 'bloque', s.bloque, 'estado', t.estado)
                            order by s.fecha desc, s.bloque desc), '[]'::jsonb) into v_items
    from public.portal2027_sesiones_asistencia s
    join public.portal2027_asignaciones a on a.id = s.asignacion_id
    join public.portal2027_materias mt on mt.id = a.materia_id
    join public.portal2027_asistencia t on t.sesion_id = s.id and t.matricula_id = v_mat and t.estado is not null
    where a.salon_id = v_salon and s.trimestre_id = p_trimestre and s.eliminada_en is null;

  return jsonb_build_object('sesiones', v_total, 'items', v_items);
end $$;

revoke execute on function public.portal2027_publicar_notas(uuid, uuid, boolean), public.portal2027_mis_notas(uuid),
  public.portal2027_mi_asistencia(uuid) from public, anon;
grant execute on function public.portal2027_publicar_notas(uuid, uuid, boolean), public.portal2027_mis_notas(uuid),
  public.portal2027_mi_asistencia(uuid) to authenticated;
