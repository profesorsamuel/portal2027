-- 0002_portal2027_permisos.sql
-- Etapa 1, parte A: funciones de rol y políticas RLS.

-- Funciones de rol (leen la tabla sin pasar por RLS y respetan cuentas inactivas).
create function public.portal2027_tiene_rol(p_rol text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.portal2027_roles_usuario r
    join public.portal2027_perfiles p on p.id = r.usuario_id
    where r.usuario_id = auth.uid() and r.rol = p_rol and p.activo
  );
$$;

create function public.portal2027_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal2027_tiene_rol('administrador');
$$;

create function public.portal2027_tiene_algun_rol()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.portal2027_roles_usuario r
    join public.portal2027_perfiles p on p.id = r.usuario_id
    where r.usuario_id = auth.uid() and p.activo
  );
$$;

revoke execute on function public.portal2027_tiene_rol(text), public.portal2027_es_admin(),
  public.portal2027_tiene_algun_rol() from public, anon;
grant execute on function public.portal2027_tiene_rol(text), public.portal2027_es_admin(),
  public.portal2027_tiene_algun_rol() to authenticated;

-- Una persona sin rol de administrador no puede cambiar su id, correo ni estado activo.
create function public.portal2027_proteger_perfil()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.portal2027_es_admin() then
    new.id := old.id;
    new.correo := old.correo;
    new.activo := old.activo;
    new.creado_en := old.creado_en;
  end if;
  return new;
end $$;

create trigger portal2027_perfiles_proteger
  before update on public.portal2027_perfiles
  for each row execute function public.portal2027_proteger_perfil();

-- Privilegios: sin acceso anónimo; usuarios con sesión solo lo que permitan las políticas.
revoke all on public.portal2027_perfiles, public.portal2027_roles_usuario, public.portal2027_anios,
  public.portal2027_trimestres, public.portal2027_salones, public.portal2027_materias,
  public.portal2027_asignaciones from anon;
revoke truncate, references, trigger on public.portal2027_perfiles, public.portal2027_roles_usuario,
  public.portal2027_anios, public.portal2027_trimestres, public.portal2027_salones,
  public.portal2027_materias, public.portal2027_asignaciones from authenticated;

alter table public.portal2027_perfiles      enable row level security;
alter table public.portal2027_roles_usuario enable row level security;
alter table public.portal2027_anios         enable row level security;
alter table public.portal2027_trimestres    enable row level security;
alter table public.portal2027_salones       enable row level security;
alter table public.portal2027_materias      enable row level security;
alter table public.portal2027_asignaciones  enable row level security;

-- Perfiles: cada persona ve y edita (nombres y apellidos) el suyo; administración ve todos.
create policy portal2027_perfiles_ver on public.portal2027_perfiles
  for select to authenticated using (id = auth.uid() or public.portal2027_es_admin());
create policy portal2027_perfiles_editar on public.portal2027_perfiles
  for update to authenticated
  using (id = auth.uid() or public.portal2027_es_admin())
  with check (id = auth.uid() or public.portal2027_es_admin());

-- Roles: cada persona ve los suyos; solo administración los asigna o quita.
create policy portal2027_roles_ver on public.portal2027_roles_usuario
  for select to authenticated using (usuario_id = auth.uid() or public.portal2027_es_admin());
create policy portal2027_roles_crear on public.portal2027_roles_usuario
  for insert to authenticated with check (public.portal2027_es_admin());
create policy portal2027_roles_editar on public.portal2027_roles_usuario
  for update to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());
create policy portal2027_roles_borrar on public.portal2027_roles_usuario
  for delete to authenticated using (public.portal2027_es_admin());

-- Años, trimestres y materias: las ve cualquier persona con rol; solo administración las modifica.
create policy portal2027_anios_ver on public.portal2027_anios
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_anios_admin on public.portal2027_anios
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_trimestres_ver on public.portal2027_trimestres
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_trimestres_admin on public.portal2027_trimestres
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_materias_ver on public.portal2027_materias
  for select to authenticated using (public.portal2027_tiene_algun_rol());
create policy portal2027_materias_admin on public.portal2027_materias
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

-- Grupos y asignaciones: administración ve todo; cada profesor solo lo suyo.
create policy portal2027_salones_ver on public.portal2027_salones
  for select to authenticated using (
    public.portal2027_es_admin()
    or exists (
      select 1 from public.portal2027_asignaciones a
      where a.salon_id = portal2027_salones.id and a.profesor_id = auth.uid()
    )
  );
create policy portal2027_salones_admin on public.portal2027_salones
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());

create policy portal2027_asignaciones_ver on public.portal2027_asignaciones
  for select to authenticated using (public.portal2027_es_admin() or profesor_id = auth.uid());
create policy portal2027_asignaciones_admin on public.portal2027_asignaciones
  for all to authenticated using (public.portal2027_es_admin()) with check (public.portal2027_es_admin());
