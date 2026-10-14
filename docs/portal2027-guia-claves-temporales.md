# Portal 2027 — Guía de entrega de claves temporales

**Estado:** procedimiento preparado; NO activar `PORTAL2027_CLAVES_TEMPORALES` todavía.

## 1. Antes de comenzar

- Trabaje exclusivamente desde una cuenta administradora autorizada, en un equipo privado.
- Verifique que el código de estudiante corresponde a la persona correcta.
- No publique listas de contraseñas en grupos de WhatsApp, fotografías, impresiones compartidas ni carpetas públicas.
- No use estudiantes reales para la primera prueba.

## 2. Entrega individual

1. Cuando se habilite el sistema, cree el acceso desde el panel administrativo.
2. Revise el resultado de cada estudiante. Solo una respuesta que incluya `clave_temporal` proporciona una clave para entregar.
3. Copie únicamente la clave del estudiante correspondiente y entréguela por un canal privado, tras verificar su identidad o la de su acudiente autorizado.
4. Si necesita un CSV, guárdelo temporalmente en un equipo privado; el archivo contiene secretos en texto legible. Elimínelo de Descargas, papelera y copias sincronizadas cuando termine la entrega.
5. Borre las claves visibles del panel y cierre la sesión. Evite capturas de pantalla y no use la consola del navegador para mostrar las claves.
6. Si un lote posterior falla, conserve los resultados previos mientras completa la entrega; no recargue la página hasta terminar.

## 3. Primer ingreso (solo cuando se active y se pruebe)

1. El estudiante abre el portal oficial e ingresa con su código y la clave temporal entregada.
2. El sistema debe impedir el acceso a datos privados hasta que cambie esa clave.
3. El estudiante elige una contraseña nueva, personal y no basada en su cédula.
4. Cierra sesión e ingresa otra vez con la contraseña nueva.
5. Verifique que la clave temporal anterior ya no funciona y que el estudiante solo ve sus propios datos.

**No entregar claves reales ni activar el modo temporal antes de comprobar todo este recorrido con una cuenta ficticia.**

## 4. Clave perdida o no recibida

- **Antes del primer ingreso:** no es posible volver a consultar la clave temporal después de cerrar o recargar el panel; no se almacena para recuperarla.
- **Después de cambiarla:** la contraseña personal tampoco puede consultarse.
- Verifique primero la identidad del estudiante o acudiente autorizado. Remita el caso al administrador para un procedimiento de restablecimiento individual que todavía debe implementarse y probarse.
- No vuelva a importar el estudiante esperando que cambie la clave: `crear-accesos` conserva la contraseña de cuentas ya vinculadas.
- No restablezca todas las cuentas, no use la cédula como contraseña de emergencia y no modifique manualmente datos de Auth sin un procedimiento aprobado.
- El correo interno `@estudiantes.portal2027.app` no implica que el estudiante tenga un buzón real; no dependa del enlace de recuperación por correo sin verificar que funciona para esa cuenta.

## 5. Lista de comprobación antes de activar

- [ ] Las migraciones y Edge Functions requeridas están desplegadas y verificadas.
- [ ] El panel muestra las claves devueltas y permite copiar y descargar individualmente de forma segura.
- [ ] Un lote fallido no borra las claves ya recibidas.
- [ ] No hay contraseñas en localStorage, base de datos ni logs de la aplicación.
- [ ] Cuenta ficticia: crear, bloquear datos privados, obligar cambio, cerrar sesión y volver a entrar.
- [ ] Cuenta ficticia: comprobar que la clave antigua no funciona.
- [ ] Existe un procedimiento probado de recuperación individual.
- [ ] Existe un plan separado para cuentas antiguas que aún usan cédula, sin restablecimiento masivo.
- [ ] La dirección o administración autoriza la activación.

**Hasta completar la lista, mantener desactivado `PORTAL2027_CLAVES_TEMPORALES`.**
