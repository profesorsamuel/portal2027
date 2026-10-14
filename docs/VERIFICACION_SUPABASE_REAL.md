# Verificación pendiente en Supabase real

**Este documento no certifica pruebas realizadas.** Requiere acceso autorizado al proyecto real y una cuenta ficticia.

1. Verificar en el historial de migraciones la aplicación de 0047, 0048 y 0049. No volver a ejecutarlas sin revisar su estado.
2. Confirmar despliegue y variables necesarias de las Edge Functions en el proyecto correcto. Nunca copiar claves secretas a GitHub.
3. Crear cuenta ficticia, probar acceso inicial y bloqueo de información protegida hasta cambio de contraseña.
4. Probar límites de solicitudes sin afectar usuarios reales. Documentar respuesta HTTP, hora y resultados sin almacenar contraseñas.
5. Revisar cómo se determina la IP de origen: no confiar en encabezados suministrados directamente por el cliente sin una cadena de proxies confiables.
6. Evaluar protección adicional para intentos contra Supabase Auth directo; un límite solo en una Edge Function no cubre necesariamente Auth.
7. **No activar** PORTAL2027_CLAVES_TEMPORALES hasta terminar y aprobar las pruebas.
