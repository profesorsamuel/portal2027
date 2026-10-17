-- DIAGNÓSTICO NO DESTRUCTIVO. Ejecutar en Supabase SQL Editor.
-- No borra ni altera notas, estudiantes o actividad.
select to_regclass('public.portal2027_actividad') as tabla_actividad,
       to_regprocedure('public.portal2027_registrar_actividad(text,text)') as registrar_evento,
       to_regprocedure('public.portal2027_consultar_actividad(uuid,timestamptz,timestamptz)') as consultar_eventos;
select evento, count(*) as total, max(ocurrido_en) as ultima_actividad
from public.portal2027_actividad group by evento order by total desc;
