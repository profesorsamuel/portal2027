# Plan de pruebas y transición a contraseñas temporales

Estado: lista de comprobación; **no certifica pruebas realizadas en Supabase real**.

## Prueba con cuenta ficticia

- [ ] Crear estudiante ficticio sin acceso previo, en entorno controlado.
- [ ] Confirmar que solo el administrador puede crear el acceso.
- [ ] Con modo temporal habilitado exclusivamente para una prueba controlada, comprobar que la respuesta incluye clave_temporal solo para una cuenta nueva.
- [ ] Confirmar que el panel muestra y permite copiar la clave, sin exponerla a otros roles.
- [ ] Simular segundo lote fallido y comprobar que el panel conserva las claves recibidas.
- [ ] Comprobar que no se registra la clave en consola, localStorage ni tablas.
- [ ] Iniciar sesión con la clave temporal; comprobar bloqueo de notas y datos privados hasta cambio obligatorio.
- [ ] Cambiar la clave, cerrar sesión y comprobar que la antigua falla y la nueva funciona.
- [ ] Reimportar la cuenta y confirmar que la contraseña no se restablece.
- [ ] Comprobar que una cuenta distinta no resulta afectada.
- [ ] Desactivar modo temporal al terminar la prueba si se usó en un entorno de ensayo.

## Cuentas existentes que todavía usan cédula

1. Obtener un recuento administrativo de cuentas existentes sin extraer ni mostrar contraseñas.
2. No asumir que puede identificarse la contraseña actual a partir de Supabase Auth: las contraseñas no son legibles.
3. Preparar un flujo de cambio individual con verificación de identidad, sin reset masivo.
4. Informar a estudiantes y acudientes antes de iniciar el cambio.
5. Migrar gradualmente por grupos pequeños y con soporte de recuperación individual.
6. Registrar solamente estado y fecha de transición, nunca la clave.
7. Mantener intactas las cuentas que todavía no han pasado por el procedimiento aprobado.

## Bloqueos de activación

No activar `PORTAL2027_CLAVES_TEMPORALES` en producción hasta verificar el bloqueo efectivo de datos privados, el cambio obligatorio, la recuperación individual y las pruebas anteriores con Supabase real. La documentación por sí sola no constituye una implementación ni una prueba.
