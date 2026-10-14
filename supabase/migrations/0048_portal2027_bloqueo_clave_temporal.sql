-- Requiere 0047. No modifica contraseñas ni indicadores de cuentas.
-- Añade restricciones a tablas existentes y al acceso privado de Storage.
begin;

do $$
begin
  if to_regprocedure('public.portal2027_requiere_cambio_clave()') is null then
    raise exception 'Instale primero la migración 0047.';
  end if;
  if exists (
    select 1 from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole
    cross join lateral unnest(s.setconfig) c(valor)
    where r.rolname = 'authenticator'
      and s.setdatabase in (0, (select oid from pg_database where datname = current_database()))
      and (
        (c.valor like 'pgrst.db_pre_request=%'
         and c.valor not in ('pgrst.db_pre_request=', 'pgrst.db_pre_request=public.portal2027_comprobar_clave_temporal'))
        or (c.valor like 'pgrst.db_pre_config=%' and c.valor <> 'pgrst.db_pre_config=')
      )
  ) then
    raise exception 'Existe un control previo de API. No se modificó: hay que integrarlo antes de aplicar 0048.';
  end if;
end;
$$;

-- PostgREST ejecuta esta comprobación antes de las tablas y RPC, incluidas
-- las funciones SECURITY DEFINER que podrían saltarse RLS.
create or replace function public.portal2027_comprobar_clave_temporal()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' or auth.uid() is null then return; end if;
  -- Única consulta permitida mientras la clave está pendiente.
  if current_setting('request.path', true) = '/rpc/portal2027_requiere_cambio_clave' then
    return;
  end if;
  if public.portal2027_requiere_cambio_clave() then
    raise exception 'Debe cambiar su contraseña temporal antes de continuar.'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.portal2027_comprobar_clave_temporal() from public;
grant execute on function public.portal2027_comprobar_clave_temporal() to anon, authenticated, service_role;

-- RESTRICTIVE se combina con AND: no concede permisos ni sustituye políticas.
-- Cubre tablas actuales del portal, también cuando se consultan fuera de REST.
do $$
declare
  t record;
begin
  for t in
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and left(c.relname, 11) = 'portal2027_'
  loop
    if not t.relrowsecurity then
      raise exception 'La tabla % no tiene RLS. Corríjala antes de instalar 0048.', t.relname;
    end if;
    execute format('drop policy if exists portal2027_clave_temporal_restriccion on public.%I', t.relname);
    execute format(
      'create policy portal2027_clave_temporal_restriccion on public.%I as restrictive for all to authenticated using (not (select public.portal2027_requiere_cambio_clave())) with check (not (select public.portal2027_requiere_cambio_clave()))',
      t.relname
    );
  end loop;
end;
$$;

drop policy if exists portal2027_clave_temporal_storage on storage.objects;
create policy portal2027_clave_temporal_storage
on storage.objects as restrictive for all to authenticated
using (
  left(bucket_id, 11) <> 'portal2027-'
  or not (select public.portal2027_requiere_cambio_clave())
)
with check (
  left(bucket_id, 11) <> 'portal2027-'
  or not (select public.portal2027_requiere_cambio_clave())
);

-- No afecta a Auth ni al cambio de clave ejecutado por la Edge Function.
alter role authenticator set pgrst.db_pre_request = 'public.portal2027_comprobar_clave_temporal';
-- Usa el ámbito de esta base para evitar que una opción local vacía prevalezca.
do $$
begin
  execute format('alter role authenticator in database %I set pgrst.db_pre_request = %L',
    current_database(), 'public.portal2027_comprobar_clave_temporal');
end;
$$;
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
