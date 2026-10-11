-- 0013_portal2027_consejeria_notas.sql
-- Etapa 7 (guía), parte B: la consejería ve las notas de su grupo en SOLO LECTURA.
-- Solo de materias que el profesor ya PUBLICÓ para ese trimestre (igual que el estudiante).
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0012.
-- Aquí NO se calcula ningún promedio: promedios y final los calcula el motor único (portal2027-evaluacion.js) en la pantalla.
-- Las materias sin publicar llegan solo con su nombre (sin columnas ni notas). Las columnas en papelera no se envían.

create function public.portal2027_notas_salon(p_salon uuid, p_trimestre uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not (public.portal2027_es_admin() or public.portal2027_es_consejero_de_salon(p_salon)) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if not exists (
    select 1 from public.portal2027_salones s
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where s.id = p_salon and t.id = p_trimestre
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;

  select coalesce(jsonb_agg(z.m order by z.m ->> 'materia'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'asignacion_id', a.id,
      'materia', mt.nombre,
      'publicada', coalesce(p.publicada, false),
      'cerrado', coalesce(c.cerrado, false),
      'evaluaciones', case when coalesce(p.publicada, false) then coalesce((
          select jsonb_agg(jsonb_build_object('id', e.id, 'categoria', e.categoria, 'tema', e.tema) order by e.orden, e.id)
          from public.portal2027_evaluaciones e
          where e.asignacion_id = a.id and e.trimestre_id = p_trimestre and e.eliminada_en is null
        ), '[]'::jsonb) else '[]'::jsonb end,
      'notas', case when coalesce(p.publicada, false) then coalesce((
          select jsonb_agg(jsonb_build_object('evaluacion_id', n.evaluacion_id, 'matricula_id', n.matricula_id, 'valor', n.valor))
          from public.portal2027_notas n
          join public.portal2027_evaluaciones e on e.id = n.evaluacion_id
          where e.asignacion_id = a.id and e.trimestre_id = p_trimestre and e.eliminada_en is null and n.valor is not null
        ), '[]'::jsonb) else '[]'::jsonb end
    ) as m
    from public.portal2027_asignaciones a
    join public.portal2027_materias mt on mt.id = a.materia_id
    left join public.portal2027_publicaciones p on p.asignacion_id = a.id and p.trimestre_id = p_trimestre
    left join public.portal2027_cierres c on c.asignacion_id = a.id and c.trimestre_id = p_trimestre
    where a.salon_id = p_salon
  ) z;
  return jsonb_build_object('materias', v_res);
end $$;

revoke execute on function public.portal2027_notas_salon(uuid, uuid) from public, anon;
grant execute on function public.portal2027_notas_salon(uuid, uuid) to authenticated;
