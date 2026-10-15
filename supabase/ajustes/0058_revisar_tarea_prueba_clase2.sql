-- Portal 2027: revisión de la tarea de prueba que aparece como «clase 2».
-- Ejecutar en Supabase > SQL Editor.
-- Primero muestra el registro candidato. No borra clases ni entregas.

select
  t.id as tarea_id,
  t.titulo,
  t.publicada,
  t.eliminada_en,
  t.creado_en,
  t.trimestre_id,
  t.asignacion_id,
  c.numero as numero_clase,
  c.tema as tema_clase,
  t.evaluacion_id
from public.portal2027_tareas t
left join public.portal2027_plan_clases c
  on c.id = t.clase_id
 and c.asignacion_id = t.asignacion_id
 and c.trimestre_id = t.trimestre_id
where lower(trim(t.titulo)) = 'clase 2'
order by t.creado_en desc;

-- Si el resultado anterior confirma que «clase 2» es una tarea de prueba sobrante,
-- descomenta y ejecuta este bloque para ocultarla del portal del estudiante.
-- Es una baja lógica: no elimina la fila ni las entregas asociadas y se puede revertir.
-- No ejecutes este bloque si esa tarea sí debe entregarse.

-- begin;
-- update public.portal2027_tareas
-- set publicada = false,
--     eliminada_en = coalesce(eliminada_en, now()),
--     actualizado_en = now(),
--     version = version + 1
-- where lower(trim(titulo)) = 'clase 2'
--   and publicada = true
--   and eliminada_en is null;
-- commit;

-- Para comprobar las tareas activas que el estudiante debería ver en un trimestre:
-- sustituye el UUID del trimestre por el que estás probando.
-- select t.titulo, t.creado_en, c.numero as numero_clase, c.tema as tema_clase
-- from public.portal2027_tareas t
-- left join public.portal2027_plan_clases c
--   on c.id = t.clase_id and c.asignacion_id = t.asignacion_id
--  and c.trimestre_id = t.trimestre_id and c.eliminada_en is null
-- where t.trimestre_id = 'UUID-DEL-TRIMESTRE'::uuid
--   and t.publicada = true and t.eliminada_en is null
-- order by t.creado_en, t.id;
