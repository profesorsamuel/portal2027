# Mejora de tareas del estudiante y vínculo con calificaciones

## Archivos web incluidos

- `assets/css/portal2027-estudiante-juvenil.css`: mejora de presentación adaptable para tarjetas, instrucciones, materiales, estados y formularios de entrega.
- `pages/portal2027-estudiante.html`: versión de caché alineada con el resto del portal.
- `supabase/migrations/0057_portal2027_vinculo_tarea_estudiante.sql`: corrige el indicador «Cuenta para la nota» para consultar el vínculo real de `portal2027_tareas_desglose` con `portal2027_evaluaciones`.

## Instalación

1. Hacer una copia de seguridad del repositorio y de la base de datos antes de publicar cambios.
2. En Supabase, abrir **SQL Editor** y ejecutar `supabase/migrations/0057_portal2027_vinculo_tarea_estudiante.sql` después de haber instalado las migraciones 0055 y 0056.
3. Publicar los archivos del repositorio conservando sus rutas.
4. Abrir el portal del estudiante y recargar sin caché (Ctrl+F5).
5. Probar con una cuenta de estudiante de prueba: una tarea publicada, sus materiales, una entrega y una tarea vinculada a una apreciación.
6. En la libreta del profesor, verificar que la tarea vinculada aparece en el desglose de la apreciación semanal y que la calificación se refleja según las reglas ya existentes del portal.

La migración no cambia ni recalcula notas existentes; solo corrige cómo el panel identifica si la tarea está vinculada a una evaluación. No se pudo comprobar desde este paquete si la migración ya está aplicada en el proyecto Supabase de producción.
