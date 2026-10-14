# portal2027 — instalación y pruebas (etapa 1, parte A)

## 1. Aplicar la base de datos

En Supabase (proyecto meduca2027) abra **SQL Editor** y ejecute, uno por uno y en orden, los archivos de `supabase/migrations/`: `0001` y `0002`. `0003` es opcional y está en `supabase/especificas/`. Cada uno debe terminar con «Success». Si alguno falla, no siga: copie el error completo.

## 2. Configurar Auth

En **Authentication**:
- **Sign In / Providers → Email**: deje activado el acceso con correo y contraseña. Desactive **Allow new users to sign up** para que nadie se registre solo; las cuentas las crea la administración.
- **URL Configuration**: Site URL `https://profesorsamuel.github.io/portal2027/` y, en Redirect URLs, la misma dirección. Sin esto, los enlaces de recuperación de contraseña no vuelven al portal.

## 3. Administrador inicial

1. En **Authentication → Users → Add user → Create new user**, escriba su correo y una contraseña, y marque **Auto Confirm User**.
2. Abra `0004_portal2027_admin_inicial.sql`, cambie `CORREO_DEL_ADMINISTRADOR` por ese correo y ejecútelo.
3. La consulta final debe mostrar su correo con el rol `administrador`.

Los demás roles solo los asigna una cuenta administradora.

## 4. Datos del proyecto para la interfaz (parte B)

- URL del proyecto: `https://gwxghgpsgvaletrqmwcn.supabase.co`
- Clave publicable: en **Project Settings → API Keys**, la que empieza por `sb_publishable_`. Es pública por diseño.
- Nunca ponga la clave `secret` ni `service_role` en el repositorio.

## 5. GitHub Pages

Ya publicado desde `main` / raíz: `https://profesorsamuel.github.io/portal2027/`.

## 6. Pruebas de permisos

Cree dos cuentas ficticias más en Authentication → Users: un profesor y un alumno. Copie el UUID de cada una (columna *User UID*). Asigne roles en el SQL Editor:

```sql
insert into public.portal2027_roles_usuario (usuario_id, rol) values
  ('UUID_PROFESOR', 'profesor'),
  ('UUID_ALUMNO', 'estudiante');

insert into public.portal2027_asignaciones (salon_id, materia_id, profesor_id)
select s.id, m.id, 'UUID_PROFESOR'
from public.portal2027_salones s, public.portal2027_materias m
where s.nombre = '9C' and m.nombre = 'Matemática';
```

Cada prueba va en su propio bloque y termina con `rollback`, así no cambia nada. Cambie el UUID según quién pruebe.

**Como alumno** (esperado: 1 perfil, 0 grupos, 0 asignaciones, y el último comando falla):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_ALUMNO","role":"authenticated"}', true);
select count(*) as perfiles from public.portal2027_perfiles;
select count(*) as salones from public.portal2027_salones;
select count(*) as asignaciones from public.portal2027_asignaciones;
insert into public.portal2027_roles_usuario (usuario_id, rol) values ('UUID_ALUMNO', 'administrador');
rollback;
```

**Como profesor** (esperado: 1 perfil, 1 grupo, 1 asignación):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_PROFESOR","role":"authenticated"}', true);
select count(*) as perfiles from public.portal2027_perfiles;
select count(*) as salones from public.portal2027_salones;
select count(*) as asignaciones from public.portal2027_asignaciones;
rollback;
```

**Como administrador** (esperado: ve todos los perfiles, roles, grupos y asignaciones):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_ADMIN","role":"authenticated"}', true);
select count(*) from public.portal2027_perfiles;
select count(*) from public.portal2027_asignaciones;
rollback;
```

**Sin sesión** (esperado: error «permission denied»):

```sql
begin;
set local role anon;
select count(*) from public.portal2027_perfiles;
rollback;
```

Las pruebas de cerrar sesión y de recuperación de contraseña se hacen en la interfaz (parte B).

## Revisión de la etapa 1 (parte A)

- [ ] 0001 y 0002 sin errores; 0003 solo si se necesitan datos ficticios.
- [ ] Administrador inicial creado y verificado.
- [ ] Alumno: solo su perfil, sin grupos ni asignaciones; no puede darse un rol.
- [ ] Profesor: solo su grupo y su asignación.
- [ ] Sin sesión: «permission denied».
