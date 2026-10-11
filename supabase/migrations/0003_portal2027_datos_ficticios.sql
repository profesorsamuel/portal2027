-- 0003_portal2027_datos_ficticios.sql
-- Datos de configuración de PRUEBA (sin personas). Se pueden borrar antes de usar datos reales.
insert into public.portal2027_anios (anio, activo) values (2027, true) on conflict (anio) do nothing;

insert into public.portal2027_materias (nombre)
select v from (values ('Matemática'), ('Español'), ('Ciencias Naturales')) as t(v)
where not exists (select 1 from public.portal2027_materias m where lower(m.nombre) = lower(v));

insert into public.portal2027_salones (anio_id, grado, seccion)
select a.id, '9', 'C' from public.portal2027_anios a where a.anio = 2027
on conflict (anio_id, grado, seccion) do nothing;
