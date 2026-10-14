# Portal2027 — Trabajo restante y orden seguro

Base revisada: portal2027-main(20261014-194228).zip. Los paquetes anteriores pueden haber cambiado el repositorio: antes de reemplazar código, descargar un ZIP NUEVO de GitHub.

## A. Accesos temporales (bloqueante)
- Comparar el panel de claves instalado con el repositorio actual; confirmar que nunca persiste contraseñas en localStorage, sessionStorage, BD, URL o logs.
- Implementar recuperación individual mediante Edge Function autenticada, autorización estricta de administrador y auditoría SIN contraseña; nunca restablecimiento masivo.
- Verificar en una cuenta ficticia: creación, primer ingreso, bloqueo de datos hasta cambio de clave, cambio obligatorio, cierre de sesión y nuevo acceso.
- Confirmar manejo de lotes fallidos y entrega individual. Activar PORTAL2027_CLAVES_TEMPORALES solo tras superar pruebas en Supabase real.

## B. Seguridad de Supabase (bloqueante)
- Comprobar historial real de migraciones 0047, 0048 y 0049; la presencia en ZIP no confirma ejecución.
- Revisar y desplegar versiones vigentes de las Edge Functions con sus secretos y JWT apropiados; no desactivar JWT como solución general.
- Ensayar límites de solicitudes desde varias IP y cuentas; verificar que la IP se deriva de una cabecera confiable del proxy y no de X-Forwarded-For aportado por cliente sin validación.
- Completar mitigación de fuerza bruta en login de Supabase Auth, con controles del proveedor y sin bloquear usuarios legítimos.
- Auditar políticas RLS de cada tabla y RPC SECURITY DEFINER: search_path explícito, autorización interna y EXECUTE mínimo. Crear migraciones nuevas a partir del número libre; no editar migraciones ejecutadas.

## C. Navegador
- Revisar cada uso de innerHTML / insertAdjacentHTML y datos de BD; usar textContent cuando corresponda y un escape único probado para los casos que exigen HTML.
- Añadir CSP primero en modo Report-Only por encabezados HTTP del hosting cuando sea posible; GitHub Pages limita configuración de encabezados. Evaluar meta CSP con cuidado y compatibilidad con scripts inline, CDN y Supabase.

## D. Calidad y mantenimiento
- Confirmar que npm test ejecuta TODOS los archivos de tests, incluidos .cjs y .mjs; ejecutar CI en GitHub Actions.
- Añadir pruebas funcionales de cédula, permisos, aprobados/reprobados, escape y primer acceso.
- Unificar versiones de caché tras inventario de archivos; limitar service worker a recursos estáticos, evitando datos privados y respuestas de Auth.
- Revisar .gitignore, historial de secretos, respaldos cifrados y ensayo de restauración en proyecto aislado.
- Refactorizar módulos grandes por partes y con pruebas, sin alterar interfaz ni cálculos.

## Pruebas manuales finales
1. Administrador: importar un alumno ficticio y verificar acceso temporal, copiar y descarga individual.
2. Alumno: intentar abrir datos antes de cambiar clave (debe bloquear), cambiar y entrar de nuevo.
3. Usuario existente: comprobar que conserva contraseña y notas.
4. Roles distintos: verificar denegación efectiva desde Supabase, no solo botones ocultos.
5. Ejecutar npm test y comprobar GitHub Actions; probar en móvil y escritorio.
6. Revisar consola y registros para confirmar que no aparecen contraseñas.

## Precaución
Este documento es una planificación: NO certifica que los puntos estén implementados, ni ejecuta SQL, ni prueba Supabase real. Mantener PORTAL2027_CLAVES_TEMPORALES desactivado hasta completar A y B.
