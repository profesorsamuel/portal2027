# Estado de seguridad — Portal2027

## Comprobado en el código del ZIP original
- El inicio de sesión tiene un segundo intento con cédula normalizada para cuentas antiguas. **No retirarlo todavía**: hacerlo sin transición bloquearía usuarios.
- El cliente consulta `portal2027_requiere_cambio_clave` y falla de forma cerrada cuando no puede comprobar el estado.
- Existen Edge Functions `portal2027-crear-accesos` y `portal2027-cambiar-clave`.

## Pendientes que NO quedan resueltos con este paquete
- Recuperación individual desde administración, con autorización robusta y registro de acción sin registrar contraseñas.
- Verificar migraciones 0047–0049 y RLS en el proyecto Supabase real.
- Verificar protección contra fuerza bruta y cabeceras de IP confiables.
- Probar con cuenta ficticia antes de habilitar contraseñas temporales.
- Revisar CSP y HTML de los demás módulos.

## Plan de transición de cédulas
1. Mantener compatibilidad actual mientras se prepara un flujo de cambio individual.
2. Probarlo con una cuenta ficticia y permisos de profesor y estudiante.
3. Notificar a los usuarios y dar un período de transición.
4. Retirar el segundo intento con cédula únicamente después de verificar que ya no se necesita.
