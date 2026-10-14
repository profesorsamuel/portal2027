-- Etapa 4. Ejecutar después de 0045 y antes de publicar los archivos web.
-- Espejo de P.archivos.LIMITES. 1 MB en la interfaz equivale a 1024 * 1024 bytes.
-- Conserva privacidad, MIME y RLS; no modifica ni elimina archivos existentes.
begin;
do $$
begin
  if (select count(*) from storage.buckets where id in (
    'portal2027-fotos', 'portal2027-documentos', 'portal2027-materiales',
    'portal2027-entregas', 'portal2027-planificaciones')) <> 5 then
    raise exception 'Faltan buckets del portal. Instale las migraciones anteriores antes de ejecutar 0046';
  end if;
end $$;
update storage.buckets b set file_size_limit = limites.max_bytes
from (values
  ('portal2027-fotos', 2097152::bigint),
  ('portal2027-documentos', 5242880::bigint),
  ('portal2027-materiales', 15728640::bigint),
  ('portal2027-entregas', 15728640::bigint),
  ('portal2027-planificaciones', 15728640::bigint)
) as limites(id, max_bytes)
where b.id = limites.id;
-- portal2027_registrar_documento mantiene su validación de 5242880 bytes,
-- coherente con documentos administrativos. Materiales/entregas se validan en Storage.
notify pgrst, 'reload schema';
commit;
