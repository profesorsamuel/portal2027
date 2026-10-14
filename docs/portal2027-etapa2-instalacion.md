# portal2027 — etapa 2: Excel y fotografía (instalación y pruebas)

## Archivos a subir a GitHub (conservando carpetas)

`assets/css/portal2027-componentes.css`, `pages/` (admin, profesor y estudiante), `js/modulos/` (`portal2027-estudiantes.js` nuevo; `portal2027-panel.js` y `portal2027-acceso.js` cambiados), `supabase/` y `docs/`.

## 1. Base de datos

En Supabase → **SQL Editor**, ejecute `supabase/migrations/0005_portal2027_estudiantes.sql`. Debe terminar con «Success». Si falla, copie el error completo y no siga.
Crea: `portal2027_estudiantes`, `portal2027_matriculas`, la función de importación, los permisos y el bucket privado `portal2027-fotos` (JPG/PNG, 2 MB).

## 2. Función de invitación (servidor)

La invitación se valida en el servidor con una Edge Function. En Supabase → **Edge Functions → Deploy a new function → Via Editor**:
- Nombre: `portal2027-invitar-estudiante`
- Pegue el contenido de `supabase/functions/portal2027-invitar-estudiante/index.ts` y despliegue.
- Deje activada la verificación de JWT. La clave `service_role` la inyecta Supabase en la función; **no se escribe en ningún archivo**.

## 3. Auth

En **Authentication → URL Configuration** confirme que `https://profesorsamuel.github.io/portal2027/` está en Site URL y Redirect URLs (el enlace de invitación vuelve a esa dirección y pide elegir contraseña).

## 4. Pruebas (use datos ficticios)

1. Cree en el Excel una hoja **Importar** con las columnas `codigo_estudiante, nombres, apellidos, grado, seccion, anio_lectivo, correo_estudiante, nombre_acudiente, telefono_acudiente, estado` y 3–4 filas de prueba (una sin correo; grado 9, sección C; año 2027).
2. **Administración → Estudiantes:** cargue el archivo. Debe mostrar la vista previa. Cambie una fila para que tenga un grado inválido: debe marcar el error y no ofrecer «Confirmar».
3. Confirme la importación del archivo correcto. Esperado: estudiantes y matrículas nuevos; el grupo aparece como **9C**.
4. **Reimporte el mismo archivo:** todo debe aparecer «Sin cambios» y los totales no cambian (sin duplicados).
5. Sin correo: la ficha aparece con «Sin correo» y botón Invitar desactivado; el resto funciona.
6. **Invitar** a un estudiante con correo propio de prueba: llega el correo, el enlace pide elegir contraseña y luego abre el panel de estudiante con su grupo.
7. **Foto:** como estudiante suba un JPG/PNG de menos de 2 MB → se ve. Un archivo de más de 2 MB o un PDF renombrado → mensaje de error.
8. **Foto ajena protegida:** con el alumno ficticio, en el SQL Editor:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_ALUMNO","role":"authenticated"}', true);
select count(*) as fichas from public.portal2027_estudiantes;   -- esperado: 1
select count(*) as fotos_visibles from storage.objects where bucket_id = 'portal2027-fotos'; -- esperado: solo la suya
rollback;
```
9. **Profesor** asignado a 9C: ve solo los estudiantes de sus grupos y puede ayudar con la foto. Otro profesor sin asignación: lista vacía.
10. Sin sesión (`set local role anon`): «permission denied».

## Revisión de la etapa 2

- [ ] Reimportar no duplica.
- [ ] Grado 9 y sección C forman 9C.
- [ ] Ficha sin correo funciona.
- [ ] Foto ajena protegida (alumno, profesor sin asignación, sin sesión).
- [ ] Invitación solo la envía un administrador (un alumno que llame a la función recibe 403).

## Supuestos que debe confirmar

- **estado** se guarda en la matrícula (por año), en minúsculas; vacío = `activo`. No se fijó una lista de valores porque la guía no la define.
- Si el grupo (grado+sección) no existe en ese año, la importación lo crea; la vista previa lo avisa.
- Reimportar actualiza nombres, correo y datos del acudiente, y cambia el grupo/estado de la matrícula del año si difieren.
- Fichas no se borran desde el portal en esta etapa.
- Excel usa SheetJS 0.20.3 desde su CDN oficial, con SRI SHA-384 verificado y respaldo local de los mismos bytes en `js/vendor/`. El cargador `js/core/portal2027-excel.js` lo comparten administración y libreta.
