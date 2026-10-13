-- 0031: la planificación se repite sola en los grupos del mismo nivel.
-- Requiere 0029 (y 0030). Ejecutable varias veces.
-- «Mismo nivel» = misma materia, mismo profesor, mismo grado y mismo año lectivo (ej. 9B y 9C).
-- Al agregar o editar una clase en un grupo, se agrega o corrige la clase con ese mismo número en los demás.
-- Al quitarla, se quita en todos. Todo ocurre en una sola transacción: o se aplica a todos o a ninguno.
-- Los grupos con el trimestre cerrado, o donde no tenga permiso, se omiten y se informan.

-- 1) Las funciones de 0029/0030 pasan a ser internas (una sola asignación).
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'portal2027_guardar_plan_clase_una') then
    alter function public.portal2027_guardar_plan_clase(uuid, uuid, uuid, integer, text, date, date, integer)
      rename to portal2027_guardar_plan_clase_una;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'portal2027_eliminar_plan_clase_una') then
    alter function public.portal2027_eliminar_plan_clase(uuid, integer)
      rename to portal2027_eliminar_plan_clase_una;
  end if;
end $$;

revoke execute on function public.portal2027_guardar_plan_clase_una(uuid, uuid, uuid, integer, text, date, date, integer),
  public.portal2027_eliminar_plan_clase_una(uuid, integer) from public, anon, authenticated;

-- 2) Guardar: crea o edita en este grupo y repite en los hermanos.
create or replace function public.portal2027_guardar_plan_clase(
  p_id uuid, p_asignacion uuid, p_trimestre uuid, p_numero integer,
  p_tema text, p_inicio date, p_fin date, p_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_num integer; me record; sib record; o record;
  v_tema text := trim(coalesce(p_tema, ''));
  v_aplic integer := 0; v_omit text[] := '{}';
begin
  r := public.portal2027_guardar_plan_clase_una(p_id, p_asignacion, p_trimestre, p_numero, p_tema, p_inicio, p_fin, p_version);
  v_num := (r->>'numero')::integer;

  select a.materia_id, a.profesor_id, s.grado, s.anio_id into me
    from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id
   where a.id = p_asignacion;

  for sib in
    select a.id, s.nombre
      from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id
     where a.id <> p_asignacion and a.materia_id = me.materia_id
       and a.profesor_id is not distinct from me.profesor_id
       and s.grado = me.grado and s.anio_id = me.anio_id
     order by s.nombre
  loop
    if not public.portal2027_puede_editar_asignacion(sib.id)
       or public.portal2027_trimestre_cerrado(sib.id, p_trimestre) then
      v_omit := v_omit || sib.nombre::text; continue;
    end if;
    begin
      select * into o from public.portal2027_plan_clases
       where asignacion_id = sib.id and trimestre_id = p_trimestre and numero = v_num and eliminada_en is null;
      if found then
        if o.tema = v_tema and o.fecha_inicio = p_inicio and o.fecha_fin = p_fin then continue; end if;
        perform public.portal2027_guardar_plan_clase_una(o.id, sib.id, p_trimestre, null, p_tema, p_inicio, p_fin, o.version);
      else
        perform public.portal2027_guardar_plan_clase_una(null, sib.id, p_trimestre, v_num, p_tema, p_inicio, p_fin, 0);
      end if;
      v_aplic := v_aplic + 1;
    exception when others then
      raise exception 'Grupo %: %', sib.nombre, sqlerrm;
    end;
  end loop;

  return r || jsonb_build_object('grupos_aplicados', v_aplic, 'grupos_omitidos', to_jsonb(v_omit));
end $$;

-- 3) Quitar: quita en este grupo y en los hermanos que tengan esa misma clase.
create or replace function public.portal2027_eliminar_plan_clase(p_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pl record; r jsonb; me record; sib record; c record;
  v_aplic integer := 0; v_omit text[] := '{}';
begin
  select * into pl from public.portal2027_plan_clases where id = p_id;
  r := public.portal2027_eliminar_plan_clase_una(p_id, p_version);
  if pl.id is null then return r; end if;

  select a.materia_id, a.profesor_id, s.grado, s.anio_id into me
    from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id
   where a.id = pl.asignacion_id;

  for sib in
    select a.id, s.nombre
      from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id
     where a.id <> pl.asignacion_id and a.materia_id = me.materia_id
       and a.profesor_id is not distinct from me.profesor_id
       and s.grado = me.grado and s.anio_id = me.anio_id
     order by s.nombre
  loop
    select * into c from public.portal2027_plan_clases
     where asignacion_id = sib.id and trimestre_id = pl.trimestre_id and numero = pl.numero and eliminada_en is null;
    if not found then continue; end if;
    if not public.portal2027_puede_editar_asignacion(sib.id)
       or public.portal2027_trimestre_cerrado(sib.id, pl.trimestre_id) then
      v_omit := v_omit || sib.nombre::text; continue;
    end if;
    begin
      perform public.portal2027_eliminar_plan_clase_una(c.id, c.version);
      v_aplic := v_aplic + 1;
    exception when others then
      raise exception 'Grupo %: %', sib.nombre, sqlerrm;
    end;
  end loop;

  return r || jsonb_build_object('grupos_aplicados', v_aplic, 'grupos_omitidos', to_jsonb(v_omit));
end $$;

revoke execute on function public.portal2027_guardar_plan_clase(uuid, uuid, uuid, integer, text, date, date, integer),
  public.portal2027_eliminar_plan_clase(uuid, integer) from public, anon;
grant execute on function public.portal2027_guardar_plan_clase(uuid, uuid, uuid, integer, text, date, date, integer),
  public.portal2027_eliminar_plan_clase(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
