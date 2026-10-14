# Respaldo y restauración: ensayo seguro

Scripts existentes revisados por nombre: `scripts/portal2027-respaldo-db.sh` y `scripts/portal2027-respaldo-storage.mjs`.

## Ensayo recomendado
1. Crear un proyecto Supabase **de prueba** separado de producción.
2. Verificar que el respaldo esté cifrado, protegido y fuera de GitHub.
3. Restaurar exclusivamente en el proyecto de prueba siguiendo la documentación oficial de Supabase correspondiente al formato del respaldo.
4. Validar tablas, conteos, políticas RLS, usuarios y archivos de Storage; nunca enviar correos a familias durante el ensayo.
5. Documentar fecha, duración, incidencias y resultado.
6. No borrar respaldos hasta comprobar una restauración satisfactoria.

**Estado:** procedimiento propuesto, restauración real no ejecutada.
