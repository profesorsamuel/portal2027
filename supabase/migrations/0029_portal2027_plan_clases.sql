-- 0029: Planificación del trimestre por clases (semanas).
-- Requiere 0006, 0012, 0021, 0022 y 0025. Ejecutable varias veces.
-- Cada clase tiene número, tema, fecha de inicio y fecha de fin. Al guardarla se crea (o se actualiza)
-- la «Apreciación semanal» con ese mismo número y esas mismas fechas en la libreta.
-- La asistencia de la clase es la de las sesiones cuya fecha cae dentro de sus fechas.

create table if not exists public.portal2027_plan_clases (
  id             uuid primary key default gen_random_uuid(),
  asignacion_id  uuid not null references public.portal2027_asignaciones(id) on delete restrict,
  trimestre_id   uuid not null references public.portal2027_trimestres(id) on delete restrict,
  numero         integer not null check (numero between 1 and 60),
  tema           text not null check (length(trim(tema)) between 1 and 120),
  fecha_inicio   date not null,
  fecha_fin      date not null,
  evaluacion_id  uuid references public.portal2027_evaluaciones(id) on delete set null,
  version        integer not null default 1,
  eliminada_en   timestamptz,
  creado_por     uuid default auth.uid() references public.portal2027_perfiles(id) on delete set null,
  actualizado_en timestamptz not null default now(),
  constraint portal2027_plan_fechas_validas check (fecha_inicio <= fecha_fin)
);
create unique index if not exists portal2027_plan_numero_unico
  on public.portal2027_plan_clases(asignacion_id, trimestre_id, numero) where eliminada_en is null;
create index if not exists portal2027_plan_fechas_idx
  on public.portal2027_plan_clases(asignacion_id, trimestre_id, fecha_inicio);

alter table public.portal2027_plan_clases enable row level security;
drop policy if exists portal2027_plan_clases_ver on public.portal2027_plan_clases;
create policy portal2027_plan_clases_ver on public.portal2027_plan_clases for select to authenticated
  using (public.portal2027_puede_editar_asignacion(asignacion_id));
revoke all on public.portal2027_plan_clases from public, anon, authenticated;
grant select on public.portal2027_plan_clases to authenticated;

-- Crear (p_id nulo) o editar (tema y fechas) una clase. El número solo se elige al crearla;
-- si p_numero es nulo se usa el siguiente libre.
create or replace function public.portal2027_guardar_plan_clase(
  p_id uuid, p_asignacion uuid, p_trimestre uuid, p_numero integer,
  p_tema text, p_inicio date, p_fin date, p_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record; pl record; o record; ev record;
  v_id uuid; v_num integer; v_tema text; v_ev uuid; v_ver integer; v_sync boolean := true;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(p_asignacion, p_trimestre) then
    raise exception 'El trimestre está cerrado';
  end if;
  v_tema := trim(coalesce(p_tema, ''));
  if length(v_tema) not between 1 and 120 then
    raise exception 'Escriba el tema de la clase (máximo 120 caracteres)';
  end if;
  if p_inicio is null or p_fin is null or p_inicio > p_fin then
    raise exception 'Fechas inválidas: el inicio no puede ser posterior al final';
  end if;

  select * into t from public.portal2027_trimestres where id = p_trimestre;
  if not found then raise exception 'El trimestre no existe'; end if;
  if not exists (select 1 from public.portal2027_asignaciones a join public.portal2027_salones s on s.id = a.salon_id
                  where a.id = p_asignacion and s.anio_id = t.anio_id) then
    raise exception 'El trimestre no corresponde a esta asignación';
  end if;
  if (t.fecha_inicio is not null and p_inicio < t.fecha_inicio) or (t.fecha_fin is not null and p_fin > t.fecha_fin) then
    raise exception 'Las fechas deben estar dentro del trimestre (% a %)',
      coalesce(to_char(t.fecha_inicio, 'DD/MM/YYYY'), 'sin definir'), coalesce(to_char(t.fecha_fin, 'DD/MM/YYYY'), 'sin definir');
  end if;

  perform pg_advisory_xact_lock(hashtext('plan' || p_asignacion::text || p_trimestre::text));

  if p_id is null then
    v_num := coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.portal2027_plan_clases
                                  where asignacion_id = p_asignacion and trimestre_id = p_trimestre and eliminada_en is null));
    if v_num not between 1 and 60 then raise exception 'El número de clase debe estar entre 1 y 60'; end if;
    if exists (select 1 from public.portal2027_plan_clases
                where asignacion_id = p_asignacion and trimestre_id = p_trimestre and numero = v_num and eliminada_en is null) then
      raise exception 'Ya existe la clase %', v_num;
    end if;
  else
    select * into pl from public.portal2027_plan_clases where id = p_id for update;
    if not found or pl.eliminada_en is not null or pl.asignacion_id <> p_asignacion or pl.trimestre_id <> p_trimestre then
      raise exception 'La clase no existe';
    end if;
    if pl.version is distinct from p_version then
      raise exception 'CONFLICTO: la planificación cambió desde que la abrió.';
    end if;
    v_num := pl.numero;
  end if;

  select * into o from public.portal2027_plan_clases
   where asignacion_id = p_asignacion and trimestre_id = p_trimestre and eliminada_en is null
     and (p_id is null or id <> p_id) and fecha_inicio <= p_fin and fecha_fin >= p_inicio
   limit 1;
  if found then
    raise exception 'Las fechas se cruzan con la clase % (% a %)', o.numero,
      to_char(o.fecha_inicio, 'DD/MM/YYYY'), to_char(o.fecha_fin, 'DD/MM/YYYY');
  end if;

  -- Apreciación semanal con el mismo número: se reutiliza si ya existe; si no, se crea.
  select * into ev from public.portal2027_evaluaciones
   where asignacion_id = p_asignacion and trimestre_id = p_trimestre and categoria = 'apreciacion'
     and semana = v_num and eliminada_en is null for update;
  if found then
    v_ev := ev.id;
    v_sync := not ev.bloqueada;
  else
    v_ev := public.portal2027_crear_evaluacion(p_asignacion, p_trimestre, 'apreciacion', 'Semana ' || v_num, '');
  end if;
  if v_sync then
    update public.portal2027_evaluaciones
       set semana = v_num, semana_inicio = p_inicio, semana_fin = p_fin,
           tema = left('Semana ' || v_num || ' · ' || v_tema, 120)
     where id = v_ev;
  end if;

  if p_id is null then
    insert into public.portal2027_plan_clases(asignacion_id, trimestre_id, numero, tema, fecha_inicio, fecha_fin, evaluacion_id)
      values (p_asignacion, p_trimestre, v_num, v_tema, p_inicio, p_fin, v_ev)
      returning id, version into v_id, v_ver;
  else
    update public.portal2027_plan_clases
       set tema = v_tema, fecha_inicio = p_inicio, fecha_fin = p_fin, evaluacion_id = v_ev,
           version = version + 1, actualizado_en = now()
     where id = p_id returning id, version into v_id, v_ver;
  end if;

  return jsonb_build_object('id', v_id, 'version', v_ver, 'numero', v_num, 'evaluacion_id', v_ev,
                            'apreciacion_actualizada', v_sync);
end $$;

-- Quitar una clase de la planificación. Su apreciación semanal pasa a la PAPELERA de la libreta
-- (no se borra: deja de contar y se puede restaurar). Si esa columna está bloqueada, se queda donde está.
create or replace function public.portal2027_eliminar_plan_clase(p_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pl record; ev record; v_pap boolean := false;
begin
  select * into pl from public.portal2027_plan_clases where id = p_id for update;
  if not found or pl.eliminada_en is not null then raise exception 'La clase no existe'; end if;
  if not public.portal2027_puede_editar_asignacion(pl.asignacion_id) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if public.portal2027_trimestre_cerrado(pl.asignacion_id, pl.trimestre_id) then
    raise exception 'El trimestre está cerrado';
  end if;
  if pl.version is distinct from p_version then
    raise exception 'CONFLICTO: la planificación cambió desde que la abrió.';
  end if;
  update public.portal2027_plan_clases set eliminada_en = now(), version = version + 1, actualizado_en = now() where id = p_id;
  if pl.evaluacion_id is not null then
    select * into ev from public.portal2027_evaluaciones where id = pl.evaluacion_id for update;
    if found and ev.eliminada_en is null and not ev.bloqueada then
      update public.portal2027_evaluaciones set eliminada_en = now(), version = version + 1, actualizado_en = now() where id = ev.id;
      insert into public.portal2027_historial_evaluaciones (evaluacion_id, accion, version) values (ev.id, 'papelera', ev.version + 1);
      v_pap := true;
    end if;
  end if;
  return jsonb_build_object('eliminada', true, 'apreciacion_en_papelera', v_pap);
end $$;

revoke execute on function public.portal2027_guardar_plan_clase(uuid, uuid, uuid, integer, text, date, date, integer),
  public.portal2027_eliminar_plan_clase(uuid, integer) from public, anon;
grant execute on function public.portal2027_guardar_plan_clase(uuid, uuid, uuid, integer, text, date, date, integer),
  public.portal2027_eliminar_plan_clase(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
