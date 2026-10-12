-- 0019_portal2027_profesores_telefono.sql
-- Agrega el teléfono a los perfiles (lo usa la importación de profesores desde Excel).
-- Ejecutar en Supabase > SQL Editor ANTES de subir la web nueva.
alter table public.portal2027_perfiles add column if not exists telefono text not null default '';
