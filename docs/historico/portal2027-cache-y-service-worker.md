# Caché y service worker — propuesta sin activar

El portal usa recursos con versiones en la URL (por ejemplo `assets/css/portal2027-componentes.css?v=20261012`).

- Mantener una versión central de despliegue antes de cambiar todas las URLs.
- No cachear respuestas de Supabase, sesiones, contraseñas, archivos privados ni páginas con datos académicos.
- Si se crea un service worker, limitarlo a CSS, JS, iconos y otros recursos estáticos públicos.
- Probar actualización y cierre de sesión desde móvil antes de publicarlo.

**Estado:** evaluación, sin instalar service worker ni cambiar la caché actual.
