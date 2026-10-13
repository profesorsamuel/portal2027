# Horario Samuel Ortega 2027 — instalación

1. En Supabase SQL Editor ejecute `supabase/migrations/0035_portal2027_asignaciones_samuel_2027.sql`. Deben existir los grupos 9A, 8A y 8B del año 2027. El SQL no elimina notas ni asignaciones existentes. Compruebe que aparecen las seis asignaciones del profesor.
2. En GitHub suba las carpetas `js/modulos/`, `data/horarios/` y `supabase/migrations/` conservando las rutas. El SQL no se ejecuta por subirlo a GitHub: hay que ejecutarlo en Supabase.
3. Actualice la página del horario con Ctrl+Shift+R, elija 2027 y Samuel Ortega, y pulse **Cargar horario de Samuel 2027 (editable)**. También puede arrastrar el archivo JSON.
4. Revise las 30 franjas y pulse **Validar y reemplazar horario**. El sistema identifica las asignaciones por grupo y materia; si falta alguna, impedirá guardar.
5. Para modificar después, use **Editar**, **Eliminar**, **Nueva franja** y **Guardar franja**. El botón de importar reemplaza el horario completo: úselo solo cuando quiera sustituirlo.

Nota: este ZIP no ejecuta cambios en su Supabase; debe realizar el paso 1. La prueba real de escritura queda pendiente hasta hacerlo.
