# Revisión limitada de seguimiento (paquete adicional)

Se revisó `js/modulos/portal2027-seguimiento.js` del ZIP original del 14 de octubre.

- Las celdas de la tabla se crean con `el('td', {texto: ...})`, sin concatenar directamente HTML de estudiantes.
- Se encontró una asignación `hoja.innerHTML = C.htmlCuadro(...)` para el reporte de aprobados; depende de que `portal2027-aprobados-core.js` escape los campos correctamente.
- Las pruebas agregadas vigilan que no aparezcan otras asignaciones `innerHTML` sin revisión.

## Pendiente

Esta prueba estática NO demuestra ausencia de XSS en todas las páginas. Falta auditar otros módulos, validar CSP en navegador y comprobar políticas reales de Supabase. No activar claves temporales todavía.
