# Portal 2027 — Pendientes reales y guía de cierre

Fecha de revisión: 14 de octubre de 2026. Basado en el ZIP del proyecto y el paquete de actualización 20261016.

## Estado
Las cinco tareas del paquete anterior ya están preparadas. No reinstalar sin comparar con el ZIP publicado en GitHub. Este documento no afirma que estén publicadas ni validadas en producción.

## 1. Antes de nuevos cambios
- Subir el paquete anterior conservando rutas y borrar de docs/ los originales enumerados en ARCHIVOS_A_MOVER.txt (las copias están en docs/historico/).
- Confirmar en GitHub que `.github/dependabot.yml` y `.github/workflows/pruebas.yml` están presentes.
- Comprobar en GitHub Actions que npm ci y npm test terminan correctamente. Si falla Playwright por navegador ausente, instalar Chromium de Playwright en el flujo CI, sin dar por fallado el producto.
- Descargar un ZIP NUEVO desde GitHub tras publicar, para que cualquier arreglo siguiente parta de la versión instalada.

## 2. Verificación real del navegador
- Abrir index.html y cada una de las 15 páginas con Chrome en PC y móvil; abrir F12 > Console.
- Revisar que no existan violaciones CSP ni errores 404 de CSS/JS, y que funcionen inicio de sesión, menús, horarios, planificación, libreta, asistencia y reportes.
- Probar con JavaScript desactivado para confirmar el mensaje noscript.
- Confirmar versión de caché 20261016 y forzar recarga Ctrl+F5; revisar service worker si existe.
- GitHub Pages no puede imponer `frame-ancestors` por meta CSP. Si se requiere, evaluar alojamiento con cabeceras HTTP.

## 3. Verificación real de Supabase (sin ejecutar SQL aquí)
- Revisar en el panel de Supabase si 0047, 0048 y 0049 están aplicadas; no asumirlo por ver los .sql en el repositorio.
- Comprobar RLS y privilegios de SELECT/INSERT/UPDATE/DELETE para anónimo, alumno, docente y administrador, sobre datos de prueba.
- Comprobar versiones desplegadas de las Edge Functions, configuración de JWT, permisos internos, secretos y límites de intentos.
- Probar errores y auditoría sin exponer contraseñas ni datos privados.
- No activar PORTAL2027_CLAVES_TEMPORALES hasta completar pruebas con una cuenta ficticia. Mantener el segundo intento con cédula normalizada.

## 4. Trabajo de seguridad que aún necesita implementación/decisión
- Recuperación individual de acceso temporal por administrador, con autorización y registro sin guardar contraseñas.
- Auditoría completa de RLS, funciones SECURITY DEFINER y permisos EXECUTE.
- Protección contra fuerza bruta y validación de IP de origen confiable.
- Revisión de inserción HTML dinámico (innerHTML/insertAdjacentHTML), priorizando datos externos o de Supabase.
- Revisión de almacenamiento local, service worker, historial de secretos y respaldos.
- Decidir si los 52 nombres de docentes seguirán públicos o pasarán a Supabase. No hay decisión tomada: ver docs/DECISION_LISTA_DOCENTES.md.
- Solo crear nuevas migraciones después de comprobar el siguiente número libre. No editar migraciones existentes.

## 5. Pruebas funcionales de regresión
- Acceso: usuario existente con cédula normalizada, cambio de contraseña, recuperación y denegación de roles.
- Docencia: crear/editar clase, asistencia, planificación, horario y recursos PDF.
- Notas: captura, promedio, apreciación, boletín PDF, aprobados/reprobados; comparar con resultados previos, sin modificar fórmulas.
- Seguridad: usuario sin permisos no puede leer ni modificar datos mediante llamadas directas a Supabase.
- Documentación: vínculos del README e INDICE, rutas de docs/historico, CSP y Dependabot.

## 6. Limitaciones de esta revisión
- `npm ci --offline` no completó porque playwright-core 1.64.1 no está en caché.
- `npm ci` con red no completó por error DNS EAI_AGAIN contra registry.npmjs.org.
- Por lo tanto no se pudo ejecutar el `npm test` completo ni la suite Playwright.
- Chromium del sistema sí está en /usr/bin/chromium, pero no se verificó su integración con Playwright.
- No se accedió al proyecto Supabase real ni a su despliegue de Edge Functions.
- No se modificó SQL, notas, interfaz ni conexión de Supabase.

## Próximo paquete de código recomendado
Primero obtener el ZIP actualizado de GitHub y resultados de GitHub Actions. Después implementar la recuperación individual segura, por separado y con pruebas, sin activar claves temporales. No mezclarlo con migraciones ni cambios de interfaz.
