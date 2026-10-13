-- 0039: PDF de planificación por clase. Ejecutar en Supabase SQL Editor.
-- Archivos privados: máximo 15 MB, PDF, un registro por clase.
create table if not exists public.portal2027_plan_pdf (
 clase_id uuid primary key references public.portal2027_plan_clases(id) on delete cascade,
 ruta text not null unique,
 nombre_archivo text not null,
 actualizado_en timestamptz not null default now(),
 constraint pdf_nombre_valido check (length(nombre_archivo) between 1 and 255),
 constraint pdf_ruta_clase check (split_part(ruta,'/',1) = clase_id::text and ruta ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$')
);
alter table public.portal2027_plan_pdf enable row level security;
drop policy if exists plan_pdf_leer on public.portal2027_plan_pdf;
create policy plan_pdf_leer on public.portal2027_plan_pdf for select to authenticated using (
 exists(select 1 from public.portal2027_plan_clases c where c.id=clase_id and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
drop policy if exists plan_pdf_insertar on public.portal2027_plan_pdf;
create policy plan_pdf_insertar on public.portal2027_plan_pdf for insert to authenticated with check (
 exists(select 1 from public.portal2027_plan_clases c where c.id=clase_id and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
drop policy if exists plan_pdf_actualizar on public.portal2027_plan_pdf;
create policy plan_pdf_actualizar on public.portal2027_plan_pdf for update to authenticated using (
 exists(select 1 from public.portal2027_plan_clases c where c.id=clase_id and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
) with check (
 exists(select 1 from public.portal2027_plan_clases c where c.id=clase_id and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
drop policy if exists plan_pdf_eliminar on public.portal2027_plan_pdf;
create policy plan_pdf_eliminar on public.portal2027_plan_pdf for delete to authenticated using (
 exists(select 1 from public.portal2027_plan_clases c where c.id=clase_id and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
grant select,insert,update,delete on public.portal2027_plan_pdf to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('portal2027-planificaciones','portal2027-planificaciones',false,15728640,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['application/pdf'];
-- El primer segmento de cada ruta debe ser un UUID de clase existente y autorizada.
drop policy if exists planificacion_pdf_storage_select on storage.objects;
create policy planificacion_pdf_storage_select on storage.objects for select to authenticated using (
 bucket_id='portal2027-planificaciones' and exists (
 select 1 from public.portal2027_plan_clases c where c.id::text=split_part(name,'/',1) and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
drop policy if exists planificacion_pdf_storage_insert on storage.objects;
create policy planificacion_pdf_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id='portal2027-planificaciones' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and exists (
 select 1 from public.portal2027_plan_clases c where c.id::text=split_part(name,'/',1) and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
drop policy if exists planificacion_pdf_storage_delete on storage.objects;
create policy planificacion_pdf_storage_delete on storage.objects for delete to authenticated using (
 bucket_id='portal2027-planificaciones' and exists (
 select 1 from public.portal2027_plan_clases c where c.id::text=split_part(name,'/',1) and c.eliminada_en is null and public.portal2027_puede_editar_asignacion(c.asignacion_id))
);
