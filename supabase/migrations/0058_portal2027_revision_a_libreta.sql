-- 0058: al revisar entregas, registrar nota directamente en el desglose semanal de la libreta.
-- Requiere migraciones 0055-0057. Mantiene permisos y controles existentes.
BEGIN;
create or replace function public.portal2027_revisar_entrega(
  p_entrega uuid, p_version integer, p_comentario text,
  p_nota numeric default null, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  en record;
  t record;
  v_nv integer;
  v_res jsonb := null;
  v_desglose boolean := false;
  v_anterior numeric;
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

  select exists(select 1 from public.portal2027_tareas_desglose d where d.tarea_id=t.id) into v_desglose;
  select r.valor into v_anterior from public.portal2027_tareas_desglose d join public.portal2027_registros_semana r on r.evaluacion_id=d.evaluacion_id and r.grupo=d.grupo and r.matricula_id=en.matricula_id where d.tarea_id=t.id limit 1;
  if p_nota is not null then
    if p_nota < 0 or p_nota > 5 then raise exception 'La nota debe estar entre 0 y 5'; end if;
    if v_desglose then
      if v_anterior is not null and v_anterior is distinct from p_nota and nullif(trim(coalesce(p_motivo, '')), '') is null then raise exception 'Indique el motivo para cambiar la nota'; end if;
      perform public.portal2027_calificar_tarea_desglose(t.id,en.matricula_id,p_nota);
    elsif t.evaluacion_id is not null then
      select coalesce((select n.version from public.portal2027_notas n
        where n.evaluacion_id = t.evaluacion_id and n.matricula_id = en.matricula_id), 0)
        into v_nv;
      v_res := public.portal2027_guardar_nota(t.evaluacion_id, en.matricula_id, p_nota, v_nv, p_motivo);
    else
      if en.nota_profesor is not null and en.nota_profesor is distinct from p_nota
         and nullif(trim(coalesce(p_motivo, '')), '') is null then
        raise exception 'Indique el motivo para cambiar una nota ya guardada';
      end if;
    end if;
  end if;

  update public.portal2027_entregas
    set estado = 'revisada',
        comentario_profesor = left(trim(coalesce(p_comentario, '')), 2000),
        nota_profesor = case when p_nota is not null then p_nota else nota_profesor end,
        revisada_en = now(),
        revisada_por = auth.uid(),
        version = version + 1
    where id = p_entrega;

  return jsonb_build_object('version', en.version + 1, 'nota', v_res,
    'nota_tarea', coalesce(p_nota,en.nota_profesor));
end $$;

COMMIT;
