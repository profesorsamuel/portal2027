-- Ejecutar una vez en Supabase > SQL Editor antes de subir los archivos.
begin;
alter table public.portal2027_estudiantes add column if not exists telefono_estudiante text;
alter table public.portal2027_estudiantes add column if not exists direccion text;
create or replace function public.portal2027_completar_mis_datos(
  p_correo text, p_telefono text, p_acudiente text, p_telefono_acudiente text, p_direccion text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.portal2027_tiene_rol('estudiante') then
    raise exception 'Debe entrar con una cuenta activa de estudiante.';
  end if;
  if length(coalesce(p_correo,'')) > 254 or length(coalesce(p_telefono,'')) > 100
    or length(coalesce(p_acudiente,'')) > 150 or length(coalesce(p_telefono_acudiente,'')) > 200
    or length(coalesce(p_direccion,'')) > 500 then
    raise exception 'Uno de los datos supera el tamaño permitido.';
  end if;
  if nullif(trim(p_correo),'') is not null and trim(p_correo) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Revise el correo electrónico.';
  end if;
  if nullif(trim(p_acudiente),'') is null or nullif(trim(p_telefono_acudiente),'') is null then
    raise exception 'Complete el nombre y teléfono de su acudiente.';
  end if;
  update public.portal2027_estudiantes set
    correo_estudiante = nullif(trim(p_correo),''), telefono_estudiante = nullif(trim(p_telefono),''),
    nombre_acudiente = trim(p_acudiente), telefono_acudiente = trim(p_telefono_acudiente),
    direccion = nullif(trim(p_direccion),'')
    where usuario_id = auth.uid();
  if not found then raise exception 'Su cuenta no tiene una ficha de estudiante vinculada.'; end if;
end;
$$;
revoke all on function public.portal2027_completar_mis_datos(text,text,text,text,text) from public, anon;
grant execute on function public.portal2027_completar_mis_datos(text,text,text,text,text) to authenticated;
commit;
