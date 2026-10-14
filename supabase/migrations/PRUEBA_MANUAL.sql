-- Ejecutar DESPUÉS de 0049. Todo se revierte al terminar.
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  k text := md5(clock_timestamp()::text || random()::text) || md5(random()::text);
  r jsonb;
  i integer;
begin
  for i in 1..6 loop
    r := public.portal2027_consumir_intento('cambiar_clave', k);
    if (r->>'permitido')::boolean is distinct from (i <= 5) then
      raise exception 'Falló el control en el intento %', i;
    end if;
  end loop;
  if (r->>'reintentar_en')::integer < 1 then
    raise exception 'Falta tiempo de espera.';
  end if;
  raise notice 'Correcto: permite 5 intentos y rechaza el sexto.';
end;
$$;
rollback;
