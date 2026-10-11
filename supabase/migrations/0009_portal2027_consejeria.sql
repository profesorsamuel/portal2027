-- 0009_portal2027_consejeria.sql
-- Etapa 5: consejería. Administración asigna consejeros a grupos; el consejero ve su grupo en solo lectura:
-- fichas de los estudiantes y conteo de asistencia por estado. NO ve notas (se decidirá después).
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0008.

create table public.portal2027_consejeros_salon (
  salon_id     uuid not null references public.portal2027_salones (id) on delete cascade,
  consejero_id uuid not null references public.portal2027_perfiles (id) on delete restrict,
  creado_en    timestamptz not null default now(),
  primary key (salon_id, consejero_id)
);
create index portal2027_consejeros_salon_idx on public.portal2027_consejeros_salon (consejero_id);

-- Solo personas con rol consejero.
create function public.portal2027_validar_consejero()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.portal2027_roles_usuario where usuario_id = new.consejero_id and rol = 'consejero') then
    raise exception 'La persona asignada no tiene el rol consejero';
  end if;
  return new;
end $$;
create trigger portal2027_consejeros_validar before insert or update on public.portal2027_consejeros_salon
  for each row execute function public.portal2027_validar_consejero();

create function public.portal2027_es_consejero_de_salon(p_salon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_tiene_rol('consejero') and exists (
    select 1 from public.portal2027_consejeros_salon c where c.salon_id = p_salon and c.consejero_id = auth.uid()
  );
$$;
revoke execute on function public.portal2027_es_consejero_de_salon(uuid) from public, anon;
grant execute on function public.portal2027_es_consejero_de_salon(uuid) to authenticated;

-- El consejero también ve las fichas de los estudiantes de su grupo (y sus fotos, que usan esta función).
create or replace function public.portal2027_ve_estudiante(p_estudiante uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_es_admin()
    or public.portal2027_es_mi_ficha(p_estudiante)
    or (public.portal2027_tiene_rol('profesor') and exists (
      select 1 from public.portal2027_matriculas m
      join public.portal2027_asignaciones a on a.salon_id = m.salon_id
      where m.estudiante_id = p_estudiante and a.profesor_id = auth.uid()
    ))
    or (public.portal2027_tiene_rol('consejero') and exists (
      select 1 from public.portal2027_matriculas m
      join public.portal2027_consejeros_salon c on c.salon_id = m.salon_id
      where m.estudiante_id = p_estudiante and c.consejero_id = auth.uid()
    ));
$$;

-- ---------- Permisos ----------
revoke all on public.portal2027_consejeros_salon from anon;
revoke update, truncate, references, trigger on public.portal2027_consejeros_salon from authenticated;
grant select, insert, delete on public.portal2027_consejeros_salon to authenticated;
alter table public.portal2027_consejeros_salon enable row level security;

create policy portal2027_consejeros_ver on public.portal2027_consejeros_salon
  for select to authenticated using (public.portal2027_es_admin() or (consejero_id = auth.uid() and public.portal2027_tiene_rol('consejero')));
create policy portal2027_consejeros_ins on public.portal2027_consejeros_salon
  for insert to authenticated with check (public.portal2027_es_admin());
create policy portal2027_consejeros_del on public.portal2027_consejeros_salon
  for delete to authenticated using (public.portal2027_es_admin());

-- Políticas adicionales (se suman a las existentes): el consejero ve su grupo y sus matrículas.
create policy portal2027_salones_ver_consejero on public.portal2027_salones
  for select to authenticated using (public.portal2027_es_consejero_de_salon(id));
create policy portal2027_matriculas_ver_consejero on public.portal2027_matriculas
  for select to authenticated using (public.portal2027_es_consejero_de_salon(salon_id));

-- ---------- Resumen de asistencia del grupo (solo conteos; no expone sesiones ni profesores) ----------
create function public.portal2027_resumen_asistencia_salon(p_salon uuid, p_trimestre uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_total integer; v_filas jsonb;
begin
  if not (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(p_salon)) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select count(*) into v_total
    from public.portal2027_sesiones_asistencia s
    join public.portal2027_asignaciones a on a.id = s.asignacion_id
    where a.salon_id = p_salon and s.trimestre_id = p_trimestre and s.eliminada_en is null;

  select coalesce(jsonb_agg(jsonb_build_object('matricula_id', y.matricula_id, 'conteos', y.conteos)), '[]'::jsonb) into v_filas
  from (
    select x.matricula_id, jsonb_object_agg(x.estado, x.n) as conteos
    from (
      select t.matricula_id, t.estado, count(*) as n
      from public.portal2027_asistencia t
      join public.portal2027_sesiones_asistencia s on s.id = t.sesion_id
      join public.portal2027_asignaciones a on a.id = s.asignacion_id
      where a.salon_id = p_salon and s.trimestre_id = p_trimestre and s.eliminada_en is null and t.estado is not null
      group by t.matricula_id, t.estado
    ) x
    group by x.matricula_id
  ) y;
  return jsonb_build_object('sesiones', v_total, 'filas', v_filas);
end $$;
revoke execute on function public.portal2027_resumen_asistencia_salon(uuid, uuid) from public, anon;
grant execute on function public.portal2027_resumen_asistencia_salon(uuid, uuid) to authenticated;
