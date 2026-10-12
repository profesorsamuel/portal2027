-- 0012_portal2027_cierre_trimestral.sql
-- Etapa 7 (guía), parte A: cierre trimestral por asignación (materia + grupo) y trimestre.
-- VERSIÓN REPETIBLE: se puede ejecutar varias veces sin error "already exists".
-- Ejecutar en Supabase > SQL Editor del proyecto meduca2027, después de 0001-0011.
-- Al cerrar se guarda una COPIA versionada de lo que había (columnas, notas y conteo de asistencia) y la base
-- bloquea todo cambio de columnas, notas y asistencia de ese trimestre. Solo administración puede reabrir, con motivo.
-- Aquí NO se calcula ningún promedio: el resultado se obtiene aplicando el motor único (portal2027-evaluacion.js)
-- a la copia. No hay promedio anual ni criterios de honor (pendientes de definir).

-- ---------- Tablas ----------
create table if not exists public.portal2027_cierres (
  asignacion_id   uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id    uuid not null references public.portal2027_trimestres (id) on delete restrict,
  cerrado         boolean not null default false,
  actualizado_por uuid references public.portal2027_perfiles (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  primary key (asignacion_id, trimestre_id)
);

-- Copias del cierre: una por cierre, numeradas (1, 2, … si se reabre y se vuelve a cerrar). Solo se agregan.
create table if not exists public.portal2027_resultados_cierre (
  id            uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id  uuid not null references public.portal2027_trimestres (id) on delete restrict,
  version       integer not null,
  datos         jsonb not null,
  creado_por    uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en     timestamptz not null default now(),
  unique (asignacion_id, trimestre_id, version)
);

create table if not exists public.portal2027_historial_cierres (
  id            uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.portal2027_asignaciones (id) on delete restrict,
  trimestre_id  uuid not null references public.portal2027_trimestres (id) on delete restrict,
  accion        text not null check (accion in ('cerrar', 'reabrir')),
  motivo        text,
  version_resultado integer,
  usuario_id    uuid default auth.uid() references public.portal2027_perfiles (id) on delete set null,
  creado_en     timestamptz not null default now()
);

drop trigger if exists portal2027_resultados_cierre_inmutable on public.portal2027_resultados_cierre;
create trigger portal2027_resultados_cierre_inmutable before update or delete on public.portal2027_resultados_cierre
  for each row execute function public.portal2027_historial_inmutable();
drop trigger if exists portal2027_historial_cierres_inmutable on public.portal2027_historial_cierres;
create trigger portal2027_historial_cierres_inmutable before update or delete on public.portal2027_historial_cierres
  for each row execute function public.portal2027_historial_inmutable();

-- ---------- Consulta de estado ----------
create or replace function public.portal2027_trimestre_cerrado(p_asignacion uuid, p_trimestre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select c.cerrado from public.portal2027_cierres c
                   where c.asignacion_id = p_asignacion and c.trimestre_id = p_trimestre), false);
$$;

-- ---------- Bloqueo en la base ----------
-- Columnas, notas, sesiones y marcas de asistencia no se pueden insertar, cambiar ni borrar con el trimestre cerrado,
-- sin importar quién escriba ni por qué función pase.
create or replace function public.portal2027_bloquear_si_cerrado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_asig uuid; v_tr uuid; r record; i integer;
begin
  for i in 1..2 loop
    if i = 1 then
      if tg_op = 'DELETE' then r := old; else r := new; end if;
    else
      if tg_op <> 'UPDATE' then exit; end if;
      r := old;
    end if;
    if tg_table_name in ('portal2027_evaluaciones', 'portal2027_sesiones_asistencia') then
      v_asig := r.asignacion_id; v_tr := r.trimestre_id;
    elsif tg_table_name = 'portal2027_notas' then
      select e.asignacion_id, e.trimestre_id into v_asig, v_tr from public.portal2027_evaluaciones e where e.id = r.evaluacion_id;
    elsif tg_table_name = 'portal2027_asistencia' then
      select s.asignacion_id, s.trimestre_id into v_asig, v_tr from public.portal2027_sesiones_asistencia s where s.id = r.sesion_id;
    end if;
    if v_asig is not null and public.portal2027_trimestre_cerrado(v_asig, v_tr) then
      raise exception 'El trimestre está cerrado: no se pueden cambiar columnas, notas ni asistencia. La administración puede reabrirlo';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists portal2027_evaluaciones_cierre on public.portal2027_evaluaciones;
create trigger portal2027_evaluaciones_cierre before insert or update or delete on public.portal2027_evaluaciones
  for each row execute function public.portal2027_bloquear_si_cerrado();
drop trigger if exists portal2027_notas_cierre on public.portal2027_notas;
create trigger portal2027_notas_cierre before insert or update or delete on public.portal2027_notas
  for each row execute function public.portal2027_bloquear_si_cerrado();
drop trigger if exists portal2027_sesiones_cierre on public.portal2027_sesiones_asistencia;
create trigger portal2027_sesiones_cierre before insert or update or delete on public.portal2027_sesiones_asistencia
  for each row execute function public.portal2027_bloquear_si_cerrado();
drop trigger if exists portal2027_asistencia_cierre on public.portal2027_asistencia;
create trigger portal2027_asistencia_cierre before insert or update or delete on public.portal2027_asistencia
  for each row execute function public.portal2027_bloquear_si_cerrado();

-- ---------- Permisos de lectura ----------
revoke all on public.portal2027_cierres, public.portal2027_resultados_cierre, public.portal2027_historial_cierres from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.portal2027_cierres, public.portal2027_resultados_cierre, public.portal2027_historial_cierres from authenticated;
grant select on public.portal2027_cierres, public.portal2027_resultados_cierre, public.portal2027_historial_cierres to authenticated;
alter table public.portal2027_cierres            enable row level security;
alter table public.portal2027_resultados_cierre  enable row level security;
alter table public.portal2027_historial_cierres  enable row level security;
drop policy if exists portal2027_cierres_ver on public.portal2027_cierres;
create policy portal2027_cierres_ver on public.portal2027_cierres
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
drop policy if exists portal2027_resultados_cierre_ver on public.portal2027_resultados_cierre;
create policy portal2027_resultados_cierre_ver on public.portal2027_resultados_cierre
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));
drop policy if exists portal2027_historial_cierres_ver on public.portal2027_historial_cierres;
create policy portal2027_historial_cierres_ver on public.portal2027_historial_cierres
  for select to authenticated using (public.portal2027_puede_editar_asignacion(asignacion_id));

-- ---------- Revisión previa ----------
-- Solo cuenta; no impide cerrar (qué es obligatorio lo decide el colegio). Vacío no es cero.
create or replace function public.portal2027_revision_cierre(p_asignacion uuid, p_trimestre uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_est integer; v_ev integer; v_con_nota integer; v_por_ev jsonb; v_sin_rev integer; v_ses integer; v_marcas integer;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  select count(*) into v_est from public.portal2027_matriculas m
    join public.portal2027_asignaciones a on a.salon_id = m.salon_id where a.id = p_asignacion;
  select count(*) into v_ev from public.portal2027_evaluaciones e
    where e.asignacion_id = p_asignacion and e.trimestre_id = p_trimestre and e.eliminada_en is null;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'categoria', x.categoria, 'tema', x.tema,
           'sin_nota', greatest(v_est - x.con_nota, 0)) order by x.orden, x.id), '[]'::jsonb),
         coalesce(sum(x.con_nota), 0)
    into v_por_ev, v_con_nota
  from (
    select e.id, e.categoria, e.tema, e.orden,
           (select count(*) from public.portal2027_notas n join public.portal2027_matriculas m on m.id = n.matricula_id
             join public.portal2027_asignaciones a on a.salon_id = m.salon_id and a.id = p_asignacion
             where n.evaluacion_id = e.id and n.valor is not null) as con_nota
    from public.portal2027_evaluaciones e
    where e.asignacion_id = p_asignacion and e.trimestre_id = p_trimestre and e.eliminada_en is null
  ) x;
  select count(*) into v_sin_rev from public.portal2027_entregas en
    join public.portal2027_tareas t on t.id = en.tarea_id
    where t.asignacion_id = p_asignacion and t.trimestre_id = p_trimestre and t.eliminada_en is null and en.estado = 'entregada';
  select count(*) into v_ses from public.portal2027_sesiones_asistencia s
    where s.asignacion_id = p_asignacion and s.trimestre_id = p_trimestre and s.eliminada_en is null;
  select count(*) into v_marcas from public.portal2027_asistencia a
    join public.portal2027_sesiones_asistencia s on s.id = a.sesion_id
    where s.asignacion_id = p_asignacion and s.trimestre_id = p_trimestre and s.eliminada_en is null and a.estado is not null;
  return jsonb_build_object(
    'cerrado', public.portal2027_trimestre_cerrado(p_asignacion, p_trimestre),
    'estudiantes', v_est, 'evaluaciones', v_ev, 'celdas_sin_nota', greatest(v_est * v_ev - v_con_nota, 0),
    'por_evaluacion', v_por_ev, 'entregas_sin_revisar', v_sin_rev,
    'sesiones', v_ses, 'marcas_asistencia_faltantes', greatest(v_ses * v_est - v_marcas, 0));
end $$;

-- ---------- Cerrar ----------
create or replace function public.portal2027_cerrar_trimestre(p_asignacion uuid, p_trimestre uuid, p_confirmar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_version integer; v_datos jsonb;
begin
  if not public.portal2027_puede_editar_asignacion(p_asignacion) then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if not coalesce(p_confirmar, false) then raise exception 'Debe confirmar el cierre'; end if;
  if not exists (
    select 1 from public.portal2027_asignaciones a
    join public.portal2027_salones s on s.id = a.salon_id
    join public.portal2027_trimestres t on t.anio_id = s.anio_id
    where a.id = p_asignacion and t.id = p_trimestre
  ) then
    raise exception 'El trimestre no corresponde al año del grupo';
  end if;

  insert into public.portal2027_cierres (asignacion_id, trimestre_id) values (p_asignacion, p_trimestre)
    on conflict (asignacion_id, trimestre_id) do nothing;
  perform 1 from public.portal2027_cierres where asignacion_id = p_asignacion and trimestre_id = p_trimestre for update;
  if public.portal2027_trimestre_cerrado(p_asignacion, p_trimestre) then
    raise exception 'El trimestre ya está cerrado';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.portal2027_resultados_cierre
    where asignacion_id = p_asignacion and trimestre_id = p_trimestre;

  v_datos := jsonb_build_object(
    'version', v_version, 'asignacion_id', p_asignacion, 'trimestre_id', p_trimestre, 'cerrado_en', now(),
    'evaluaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'categoria', e.categoria, 'tema', e.tema,
                       'orden', e.orden, 'oculta', e.oculta) order by e.orden, e.id), '[]'::jsonb)
                     from public.portal2027_evaluaciones e
                     where e.asignacion_id = p_asignacion and e.trimestre_id = p_trimestre and e.eliminada_en is null),
    'estudiantes', (select coalesce(jsonb_agg(jsonb_build_object('matricula_id', m.id, 'codigo', es.codigo,
                       'nombres', es.nombres, 'apellidos', es.apellidos) order by es.apellidos, es.nombres, m.id), '[]'::jsonb)
                    from public.portal2027_matriculas m
                    join public.portal2027_asignaciones a on a.salon_id = m.salon_id
                    join public.portal2027_estudiantes es on es.id = m.estudiante_id
                    where a.id = p_asignacion),
    'notas', (select coalesce(jsonb_agg(jsonb_build_object('evaluacion_id', n.evaluacion_id, 'matricula_id', n.matricula_id,
                       'valor', n.valor)), '[]'::jsonb)
              from public.portal2027_notas n
              join public.portal2027_evaluaciones e on e.id = n.evaluacion_id
              where e.asignacion_id = p_asignacion and e.trimestre_id = p_trimestre and e.eliminada_en is null and n.valor is not null),
    'asistencia', jsonb_build_object(
      'sesiones', (select count(*) from public.portal2027_sesiones_asistencia s
                   where s.asignacion_id = p_asignacion and s.trimestre_id = p_trimestre and s.eliminada_en is null),
      'conteos', (select coalesce(jsonb_agg(jsonb_build_object('matricula_id', x.matricula_id, 'estado', x.estado, 'cantidad', x.c)), '[]'::jsonb)
                  from (select a.matricula_id, a.estado, count(*) as c
                        from public.portal2027_asistencia a
                        join public.portal2027_sesiones_asistencia s on s.id = a.sesion_id
                        where s.asignacion_id = p_asignacion and s.trimestre_id = p_trimestre and s.eliminada_en is null and a.estado is not null
                        group by a.matricula_id, a.estado) x))
  );

  insert into public.portal2027_resultados_cierre (asignacion_id, trimestre_id, version, datos)
    values (p_asignacion, p_trimestre, v_version, v_datos);
  update public.portal2027_cierres set cerrado = true, actualizado_por = auth.uid(), actualizado_en = now()
    where asignacion_id = p_asignacion and trimestre_id = p_trimestre;
  insert into public.portal2027_historial_cierres (asignacion_id, trimestre_id, accion, version_resultado)
    values (p_asignacion, p_trimestre, 'cerrar', v_version);
  return jsonb_build_object('version', v_version);
end $$;

-- ---------- Reabrir (solo administración, con motivo) ----------
create or replace function public.portal2027_reabrir_trimestre(p_asignacion uuid, p_trimestre uuid, p_motivo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if not public.portal2027_es_admin() then
    raise exception 'No tiene permiso para esta acción (row-level security)';
  end if;
  if v_motivo is null then raise exception 'Escriba el motivo de la reapertura'; end if;
  perform 1 from public.portal2027_cierres where asignacion_id = p_asignacion and trimestre_id = p_trimestre for update;
  if not public.portal2027_trimestre_cerrado(p_asignacion, p_trimestre) then
    raise exception 'El trimestre no está cerrado';
  end if;
  update public.portal2027_cierres set cerrado = false, actualizado_por = auth.uid(), actualizado_en = now()
    where asignacion_id = p_asignacion and trimestre_id = p_trimestre;
  insert into public.portal2027_historial_cierres (asignacion_id, trimestre_id, accion, motivo)
    values (p_asignacion, p_trimestre, 'reabrir', left(v_motivo, 300));
  return true;
end $$;

revoke execute on function public.portal2027_trimestre_cerrado(uuid, uuid), public.portal2027_revision_cierre(uuid, uuid),
  public.portal2027_cerrar_trimestre(uuid, uuid, boolean), public.portal2027_reabrir_trimestre(uuid, uuid, text) from public, anon;
grant execute on function public.portal2027_trimestre_cerrado(uuid, uuid), public.portal2027_revision_cierre(uuid, uuid),
  public.portal2027_cerrar_trimestre(uuid, uuid, boolean), public.portal2027_reabrir_trimestre(uuid, uuid, text) to authenticated;
