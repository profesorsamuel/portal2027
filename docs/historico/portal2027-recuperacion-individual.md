# Recuperación individual de acceso — propuesta, NO implementada

Estado: diseño pendiente de implementación y prueba. No activar claves temporales.

1. El administrador verifica la identidad del estudiante o acudiente autorizado y confirma el código.
2. Busca únicamente la cuenta vinculada a ese código. Nunca se restablecen cuentas en lote.
3. Una futura Edge Function protegida por autorización administrativa deberá generar una clave aleatoria nueva y actualizar solo ese usuario en Supabase Auth.
4. La función deberá exigir cambio obligatorio de clave y devolver el secreto una sola vez, exclusivamente al administrador autorizado.
5. Entregarla individualmente y no almacenarla en tablas, localStorage, consola ni logs.
6. Registrar solo el hecho administrativo de la operación (sin clave), con acceso restringido.
7. Probar que la contraseña antigua deja de funcionar, que la nueva obliga al cambio y que otras cuentas no se alteran.

**Importante:** La función actual `portal2027-crear-accesos` no recupera ni cambia claves de cuentas vinculadas. No intentar reutilizarla para recuperar contraseñas. El correo interno del estudiante no es un buzón para recuperación por email.

## Antes de programar

- Revisar el control de administrador y la protección contra abuso.
- Diseñar confirmación explícita y auditoría sin secretos.
- Preparar pruebas para código inexistente, cuenta sin vínculo, usuario no autorizado y error parcial.
- No aplicar cambios a cuentas reales hasta aprobar pruebas con cuenta ficticia.
