-- 0040: datos del boletín PDF (profesor y profesor consejero de una asignación).
-- Ejecutar UNA vez en Supabase > SQL Editor. Es seguro repetirla: solo crea/reemplaza una función.
-- NO crea tablas, NO modifica ni borra datos, NO cambia permisos de ninguna tabla.
--
-- Por qué hace falta: la tabla portal2027_consejeros_salon solo la ve la administración (y cada consejero sus filas),
-- así que un profesor no puede leer quién es el consejero de su grupo. Esta función devuelve SOLO los nombres
-- (nunca correos ni teléfonos) y únicamente a quien puede ver esa asignación (su profesor o la administración).

create or replace function public.portal2027_datos_boletin(p_asignacion uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_salon uuid;
  v_prof  uuid;
  v_nombre_prof text;
  v_nombre_cons text;
begin
  select a.salon_id, a.profesor_id into v_salon, v_prof
  from public.portal2027_asignaciones a
  where a.id = p_asignacion;

  if v_salon is null then
    raise exception 'No se encontró la asignación';
  end if;

  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;

  select nullif(trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')), '')
    into v_nombre_prof
  from public.portal2027_perfiles p
  where p.id = v_prof;

  -- Si el grupo tuviera más de un consejero, se listan todos separados por « / ».
  select string_agg(n.nombre, ' / ' order by n.nombre)
    into v_nombre_cons
  from (
    select nullif(trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')), '') as nombre
    from public.portal2027_consejeros_salon c
    join public.portal2027_perfiles p on p.id = c.consejero_id
    where c.salon_id = v_salon
  ) n
  where n.nombre is not null;

  return jsonb_build_object('profesor', coalesce(v_nombre_prof, ''), 'consejero', coalesce(v_nombre_cons, ''));
end;
$$;

revoke execute on function public.portal2027_datos_boletin(uuid) from public, anon;
grant execute on function public.portal2027_datos_boletin(uuid) to authenticated;
