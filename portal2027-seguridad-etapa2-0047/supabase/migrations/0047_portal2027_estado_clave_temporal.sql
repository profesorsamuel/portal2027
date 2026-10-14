-- Preparación del cambio obligatorio de contraseña.
-- Solo consulta el estado propio; no modifica cuentas ni contraseñas.
begin;

create or replace function public.portal2027_requiere_cambio_clave()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Debe iniciar sesión.' using errcode = '42501';
  end if;

  return coalesce((
    select u.raw_app_meta_data ->> 'portal2027_requiere_cambio_clave' = 'true'
    from auth.users as u
    where u.id = v_usuario
  ), false);
end;
$$;

revoke all on function public.portal2027_requiere_cambio_clave() from public, anon;
grant execute on function public.portal2027_requiere_cambio_clave() to authenticated;

comment on function public.portal2027_requiere_cambio_clave() is
  'Consulta el indicador de contraseña temporal de la cuenta actual. No aplica por sí sola un bloqueo de acceso.';

commit;
