-- Contador persistente, exclusivo de las Edge Functions (service_role).
-- No almacena contraseñas, nombres, correos ni direcciones IP originales.
begin;

create table public.portal2027_control_intentos (
  ambito text not null,
  clave_hash text not null check (clave_hash ~ '^[a-f0-9]{64}$'),
  inicio timestamptz not null,
  intentos integer not null check (intentos > 0),
  expira_en timestamptz not null,
  primary key (ambito, clave_hash)
);
create index portal2027_control_intentos_expira
  on public.portal2027_control_intentos (expira_en);
alter table public.portal2027_control_intentos enable row level security;
-- Sin políticas para el navegador: solo el servidor maneja este contador.
revoke all on public.portal2027_control_intentos from public, anon, authenticated, service_role;

create function public.portal2027_consumir_intento(p_ambito text, p_clave_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite integer;
  v_segundos integer;
  v_ahora timestamptz := statement_timestamp();
  v_inicio timestamptz;
  v_intentos integer;
  v_espera integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operación exclusiva del servidor.' using errcode = '42501';
  end if;
  if p_clave_hash is null or p_clave_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de control no válido.' using errcode = '22023';
  end if;
  -- Los límites no pueden elegirse desde el navegador.
  case p_ambito
    when 'buscar_ip' then v_limite := 300; v_segundos := 60;
    when 'buscar_nombre' then v_limite := 30; v_segundos := 300;
    when 'cambiar_clave' then v_limite := 5; v_segundos := 900;
    else raise exception 'Ámbito de control no válido.' using errcode = '22023';
  end case;

  -- Limpieza acotada al utilizar el contador; retención de 24 horas.
  delete from public.portal2027_control_intentos
  where (ambito, clave_hash) in (
    select c.ambito, c.clave_hash from public.portal2027_control_intentos c
    where c.expira_en < v_ahora order by c.expira_en limit 200
  );

  -- El conflicto bloquea la fila y actualiza el contador de forma atómica.
  insert into public.portal2027_control_intentos as c
    (ambito, clave_hash, inicio, intentos, expira_en)
  values (p_ambito, p_clave_hash, v_ahora, 1, v_ahora + interval '24 hours')
  on conflict (ambito, clave_hash) do update set
    inicio = case when c.inicio + make_interval(secs => v_segundos) <= v_ahora
      then v_ahora else c.inicio end,
    intentos = case when c.inicio + make_interval(secs => v_segundos) <= v_ahora
      then 1 else least(c.intentos + 1, v_limite + 1) end,
    expira_en = v_ahora + interval '24 hours'
  returning c.inicio, c.intentos into v_inicio, v_intentos;

  v_espera := greatest(1, ceil(extract(epoch from
    (v_inicio + make_interval(secs => v_segundos) - v_ahora)))::integer);
  return jsonb_build_object(
    'permitido', v_intentos <= v_limite,
    'restantes', greatest(0, v_limite - v_intentos),
    'reintentar_en', case when v_intentos <= v_limite then 0 else v_espera end
  );
end;
$$;
revoke all on function public.portal2027_consumir_intento(text, text) from public, anon, authenticated;
grant execute on function public.portal2027_consumir_intento(text, text) to service_role;
comment on function public.portal2027_consumir_intento(text, text) is
  'Contador exclusivo del servidor. Requiere hash HMAC de 64 caracteres; no recibir claves de control del navegador.';
notify pgrst, 'reload schema';
commit;
