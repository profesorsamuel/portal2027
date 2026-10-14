# Materiales de clase: instalación

1. Suba los archivos de este paquete a GitHub conservando las carpetas.
2. Ejecute `supabase/migrations/0048_portal2027_materiales_50mb.sql` una sola vez en Supabase SQL Editor (o mediante migraciones).
3. Verifique que el límite global de subida de Supabase permita 50 MB. No se modifican los límites de tareas ni de planificación.
4. Abra Clases y tareas, seleccione PDF y arrastre un PDF de 20 MB. Seleccione Imágenes y agregue hasta 40 JPG/PNG.
5. Compruebe el botón Presentar imágenes, flechas, zoom, pantalla completa, gestos laterales y descarga desde la cuenta del profesor y la del estudiante.

Las imágenes se comprimen en el navegador antes de subir cuando superan el umbral configurado; los PDF no se comprimen. Los archivos privados se abren mediante URL firmadas.
