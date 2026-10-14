# Auditoría previa de CSP (sin activar)

Se revisó `index.html`: contiene un script en línea que guarda el fragmento de recuperación antes de cargar bibliotecas. Una CSP estricta que prohíba scripts inline puede romper la recuperación de cuentas.

## Antes de instalar CSP
1. Inventariar scripts y estilos inline en **todas** las páginas.
2. Identificar orígenes reales de Supabase, fuentes, imágenes y bibliotecas.
3. Extraer scripts inline a archivos estáticos o preparar hashes específicos; no usar `unsafe-inline` como solución definitiva.
4. Probar acceso, recuperación, paneles, impresión, PDF y archivos adjuntos.
5. Implantar CSP gradualmente después de verificar la compatibilidad.

**Estado:** solo auditoría inicial; no hay CSP aplicada.
