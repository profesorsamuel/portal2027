-- 0052: crea una columna semanal por tarea asociada a una clase planificada.
-- No modifica las notas existentes ni el cálculo de promedios.
create table if not exists public.portal2027_tareas_desglose (
 tarea_id uuid primary key references public.portal2027_tareas(id) on delete cascade,
 evaluacion_id uuid not null references public.portal2027_evaluaciones(id),
 grupo uuid not null default gen_random_uuid(),
 creado_en timestamptz not null default now(),
 unique(evaluacion_id,grupo)
);
revoke all on public.portal2027_tareas_desglose from public, anon, authenticated;

create or replace function public.portal2027_vincular_tarea_desglose()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_eval uuid; v_grupo uuid; v_clase record;
begin
 if new.clase_id is null or new.eliminada_en is not null then return new; end if;
 if exists(select 1 from public.portal2027_tareas_desglose where tarea_id=new.id) then return new; end if;
 select * into v_clase from public.portal2027_plan_clases
 where id=new.clase_id and asignacion_id=new.asignacion_id and trimestre_id=new.trimestre_id and eliminada_en is null;
 if not found then return new; end if;
 select id into v_eval from public.portal2027_evaluaciones
 where asignacion_id=new.asignacion_id and trimestre_id=new.trimestre_id
 and categoria='apreciacion' and semana=v_clase.numero and eliminada_en is null limit 1;
 if v_eval is null then
   perform public.portal2027_asegurar_semanas_plan_interna(new.asignacion_id,new.trimestre_id);
   select id into v_eval from public.portal2027_evaluaciones
   where asignacion_id=new.asignacion_id and trimestre_id=new.trimestre_id
   and categoria='apreciacion' and semana=v_clase.numero and eliminada_en is null limit 1;
 end if;
 if v_eval is null then raise exception 'No se encontró la semana de apreciación de esta clase'; end if;
 insert into public.portal2027_tareas_desglose(tarea_id,evaluacion_id)
 values(new.id,v_eval) on conflict(tarea_id) do nothing returning grupo into v_grupo;
 if v_grupo is not null then
   perform public.portal2027_crear_columna_registro_semana(v_eval,'Tarea',left(new.titulo,120),v_grupo);
 end if;
 return new;
end $$;
revoke all on function public.portal2027_vincular_tarea_desglose() from public,anon,authenticated;
drop trigger if exists portal2027_tarea_desglose_automatico on public.portal2027_tareas;
create trigger portal2027_tarea_desglose_automatico
 after insert or update of clase_id on public.portal2027_tareas
 for each row execute function public.portal2027_vincular_tarea_desglose();
