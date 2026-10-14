# Verificación de seguridad pendiente (sin ejecutar en producción)

## Migraciones y Edge Functions
- [ ] Consultar historial de migraciones y confirmar 0047, 0048 y 0049 aplicadas en proyecto correcto.
- [ ] Comparar nombres y despliegue de Edge Functions con el repositorio.
- [ ] Probar solicitud sin sesión, sesión de estudiante y sesión administrativa.
- [ ] Comprobar límites de solicitudes con datos ficticios, sin bloquear cuentas reales.
- [ ] Revisar en servidor que la IP provenga de una cabecera confiable del proveedor, no de `x-forwarded-for` suministrado libremente por el cliente.
- [ ] Revisar los límites de Supabase Auth y la protección del login directo; no asumir que las Edge Functions lo cubren.

**Estado:** pendiente de comprobar con acceso a Supabase real. No se declara seguridad verificada.
