# Portal2027 — Validaciones agrupadas de acceso

## Alcance
Se agregan dos archivos de pruebas; no se modifica el login, Supabase, las notas ni el diseño. Las pruebas no demuestran que la autenticación real sea segura ni activan contraseñas temporales.

## Instalación
Copiar ambos archivos `tests/*.test.cjs` del paquete a la carpeta `tests/` del repositorio. Mantener la versión previamente instalada de `package.json` que ejecuta `node --test tests/*.test.cjs && node tests/portal2027.test.mjs`.

## Pruebas manuales
1. Ejecutar `node --test tests/portal2027-cedula-validacion.test.cjs tests/portal2027-acceso-temporal-config.test.cjs`.
2. Ejecutar `npm test` en el repositorio completo con las dependencias instaladas.
3. Abrir el portal en navegador, verificar que el acceso de estudiantes sigue visible.
4. Confirmar en Supabase que `PORTAL2027_CLAVES_TEMPORALES` NO se ha activado.
5. No ensayar credenciales reales ni divulgar contraseñas en capturas.

## Pendientes que estas pruebas NO resuelven
Recuperación individual, cambio obligatorio, bloqueo de datos antes del cambio, límites en Supabase real, revisión de JWT de la Edge Function y migración de cuentas existentes. Requieren pruebas controladas y revisión adicional del código.
