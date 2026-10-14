# Revisión HTML y CSP — pendiente de implementación

No añadir una CSP estricta a producción sin inventariar primero scripts, estilos en línea, CDNs, imágenes, conexiones a Supabase y páginas existentes.

1. Identificar HTML construido con datos de base en seguimiento y demás módulos.
2. Usar `textContent` para texto y escape consistente en HTML y atributos cuando sea imprescindible usar `innerHTML`.
3. Probar una política CSP en modo Report-Only antes de hacerla obligatoria.
4. Verificar inicio de sesión, navegación, PDF, archivos, gráficos y formularios en escritorio y celular.
5. No declarar CSP implementada ni XSS corregido hasta revisar cada punto de inserción.
