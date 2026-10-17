-- Diagnóstico seguro: NO borra ni modifica registros.
-- Ejecute en Supabase > SQL Editor para revisar columnas sobrantes.
select a.id as asignacion_id, e.trimestre_id, e.categoria,
       count(*) filter (where e.eliminada_en is null) as columnas_activas,
       string_agg(e.orden::text || ': ' || coalesce(e.tema,''), ' | ' order by e.orden)
         filter (where e.eliminada_en is null) as detalle
from public.portal2027_evaluaciones e
join public.portal2027_asignaciones a on a.id=e.asignacion_id
group by a.id,e.trimestre_id,e.categoria
having count(*) filter (where e.eliminada_en is null)>7
order by columnas_activas desc;
