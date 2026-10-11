# portal2027 — etapa 1, parte B: publicación y pruebas

## Archivos a subir a GitHub

Suba, conservando carpetas y reemplazando lo existente:
`index.html`, `pages/`, `assets/css/portal2027-componentes.css`, `js/` y `docs/`.
No hace falta volver a subir `portal2027-base.css` ni `supabase/`.

## Antes de probar

En Supabase, **Authentication**:
- **URL Configuration**: Site URL y Redirect URLs con `https://profesorsamuel.github.io/portal2027/`.
- Registros nuevos desactivados (Allow new users to sign up).

Espere uno o dos minutos tras subir a GitHub y recargue con Ctrl + F5.

## Pruebas

1. **Entrar como administrador.** Debe abrir «Panel de administración» y mostrar su cuenta en Personas y roles.
2. **Contraseña incorrecta.** Debe decir «Correo o contraseña incorrectos.».
3. **Configuración.** Debe aparecer el año 2027 (activo, 3 trimestres), el grupo 9C y las 3 materias de prueba.
4. **Cerrar sesión.** Vuelve al inicio. Escribir la dirección `.../pages/portal2027-admin.html` sin sesión debe devolver al inicio, sin mostrar datos.
5. **Recuperación.** En «¿Olvidó su contraseña?» pida el enlace, ábralo desde el correo, elija otra contraseña y compruebe que entra. Un enlace ya usado debe mostrar el aviso de enlace vencido.
6. **Profesor y alumno ficticios.** Cree dos cuentas en Authentication → Users, márqueles roles en «Personas y roles» y asigne el profesor a 9C + Matemática. El profesor debe ver solo esa fila; el alumno solo su mensaje de cuenta activa; una cuenta sin rol debe ver «Su cuenta aún no tiene un rol».
7. **Varios roles.** Dé dos roles a una cuenta: al entrar debe ofrecer elegir panel.

## Revisión de la etapa 1

- [ ] Alumno sin acceso a datos de otros; profesor solo a sus grupos.
- [ ] Cerrar sesión bloquea consultas.
- [ ] Los enlaces de recuperación funcionan.
- [ ] Pruebas SQL de la parte A (documento de instalación, sección 6) con resultado esperado.

## Notas

- El correo de recuperación usa el servicio de correo incluido en Supabase, que tiene un límite bajo de envíos por hora. Si no llega, espere y revise correo no deseado.
- La biblioteca `supabase-js` se carga desde jsDelivr con versión fija (2.57.4). Si la consola del navegador muestra que no cargó, avise.
