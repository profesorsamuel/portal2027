-- 0036_portal2027_evitar_personal_duplicado.sql
-- Evita que la misma persona exista dos veces como personal (administrador, profesor o consejero).
-- Se puede ejecutar varias veces. NO borra ni modifica datos existentes.

-- Clave de comparación: sin tildes, minúsculas, espacios simples. «Samuel Ortega» = «samuel  ortega» = «Samuel Ortega»
create or replace function public.portal2027_clave_nombre(p_nombres text, p_apellidos text)
returns text language sql immutable as $$
  select lower(translate(
    trim(regexp_replace(coalesce(p_nombres,'') || ' ' || coalesce(p_apellidos,''), '\s+', ' ', 'g')),
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
$$;

-- Control: ¿quedan duplicados ahora mismo? Si el DO falla, resuélvalos primero (ver mensaje) y vuelva a ejecutar.
do $$
declare v_dup text;
begin
  select string_agg(clave, ', ') into v_dup from (
    select public.portal2027_clave_nombre(p.nombres, p.apellidos) as clave
    from public.portal2027_perfiles p
    where p.activo
      and exists (select 1 from public.portal2027_roles_usuario r
                  where r.usuario_id = p.id and r.rol in ('administrador','profesor','consejero'))
    group by 1 having count(*) > 1
  ) d;
  if v_dup is not null then
    raise exception 'Hay personal duplicado activo: %. Desactive o fusione el perfil sobrante y vuelva a ejecutar.', v_dup;
  end if;
end $$;

-- Impide dar un rol de personal a un perfil si OTRO perfil activo con el mismo nombre ya tiene rol de personal.
create or replace function public.portal2027_impedir_personal_duplicado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_otro record;
begin
  if new.rol not in ('administrador','profesor','consejero') then return new; end if;
  select o.id, o.correo into v_otro
  from public.portal2027_perfiles me
  join public.portal2027_perfiles o
    on o.id <> me.id and o.activo
   and public.portal2027_clave_nombre(o.nombres, o.apellidos) = public.portal2027_clave_nombre(me.nombres, me.apellidos)
  where me.id = new.usuario_id
    and public.portal2027_clave_nombre(me.nombres, me.apellidos) <> ''
    and exists (select 1 from public.portal2027_roles_usuario r
                where r.usuario_id = o.id and r.rol in ('administrador','profesor','consejero'))
  limit 1;
  if found then
    raise exception 'Ya existe otro perfil con ese nombre (%). Use ese perfil en lugar de crear uno nuevo.', coalesce(v_otro.correo, v_otro.id::text);
  end if;
  return new;
end $$;

drop trigger if exists portal2027_roles_sin_duplicados on public.portal2027_roles_usuario;
create trigger portal2027_roles_sin_duplicados
  before insert on public.portal2027_roles_usuario
  for each row execute function public.portal2027_impedir_personal_duplicado();

-- Un solo perfil por correo (sin distinguir mayúsculas).
create unique index if not exists portal2027_perfiles_correo_unico
  on public.portal2027_perfiles (lower(correo)) where correo is not null;
