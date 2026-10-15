-- 0053: permite vincular tareas ya revisadas sin eliminar sus entregas.
-- Protege notas preexistentes; NO copia notas al desglose semanal.
create or replace function public.portal2027_actualizar_tarea(
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
  -- Nunca reasignar notas que ya existen en la evaluación anterior.
  if (p_limpiar_evaluacion or (p_evaluacion is not null and p_evaluacion is distinct from t.evaluacion_id))
     and t.evaluacion_id is not null
     and exists (select 1 from public.portal2027_notas n where n.evaluacion_id=t.evaluacion_id) then
    raise exception 'La evaluación anterior ya contiene notas. Conserve ese vínculo para evitar mover o perder calificaciones.';
  end if;
  -- No compartir una misma evaluación tradicional entre tareas diferentes.
  if p_evaluacion is not null and exists (
    select 1 from public.portal2027_tareas otra where otra.evaluacion_id=p_evaluacion
    and otra.id<>p_id and otra.eliminada_en is null) then
    raise exception 'Esta evaluación ya está vinculada a otra tarea';
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
