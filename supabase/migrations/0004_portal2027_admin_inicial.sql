-- 0004_portal2027_admin_inicial.sql
-- EJECUTAR A MANO una sola vez, después de crear la cuenta en Authentication > Users.
-- Cambie CORREO_DEL_ADMINISTRADOR por el correo de esa cuenta (conserve las comillas).
insert into public.portal2027_roles_usuario (usuario_id, rol)
select id, 'administrador'
from public.portal2027_perfiles
where lower(correo) = lower('CORREO_DEL_ADMINISTRADOR')
on conflict do nothing;

-- Verificación: debe devolver 1 fila.
select p.correo, r.rol
from public.portal2027_roles_usuario r
join public.portal2027_perfiles p on p.id = r.usuario_id
where r.rol = 'administrador';
