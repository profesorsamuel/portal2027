# Portal2027 — comprobaciones pendientes en Supabase

Estas pruebas automáticas son **estáticas**: no comprueban el servidor real, las políticas RLS ni el funcionamiento de Auth.

## Orden seguro para pruebas con cuenta ficticia
1. Confirmar en Supabase qué migraciones están aplicadas; no volver a ejecutar una migración sin comprobar su historial.
2. Revisar que las 4 Edge Functions estén desplegadas y con las variables de entorno esperadas.
3. Verificar permisos RLS desde un usuario ficticio estudiante, uno docente y una sesión anónima; probar lectura y escritura no autorizadas.
4. Probar el límite de solicitudes desde distintas sesiones y comprobar que cabeceras IP aportadas por el cliente no lo evadan.
5. Revisar los límites de Auth en Supabase y comprobar intentos repetidos con cuentas ficticias, sin bloquear usuarios reales.
6. Probar cambio obligatorio de contraseña y posterior nuevo inicio de sesión.
7. Probar recuperación de una sola cuenta ficticia sin cambiar ninguna otra.
8. Activar PORTAL2027_CLAVES_TEMPORALES **solo después** de pasar todas las pruebas y disponer de una reversión documentada.

**No publicar** contraseñas, tokens, correos personales, cédulas ni resultados con datos de estudiantes en incidencias o capturas.

## Resultado actual
Pendiente: no hay acceso autenticado al proyecto Supabase desde este paquete. No se ha ejecutado ninguna migración ni se ha cambiado ninguna configuración.
