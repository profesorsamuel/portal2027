# Planificaciones PDF por clase — Portal2027

1. Abra Supabase > SQL Editor y ejecute `supabase/migrations/0039_portal2027_plan_pdf.sql` una sola vez.
2. Suba los archivos modificados a GitHub respetando las carpetas.
3. Recargue la pantalla Planificación (Ctrl+F5). En «Clases del trimestre» aparece la columna «Planificación PDF».
4. Cada clase permite subir un PDF de hasta 15 MB, verlo, reemplazarlo o eliminarlo.
5. Los archivos se guardan de forma privada en Supabase Storage; no son públicos.

Nota: cada clase tiene un PDF propio, sea de una o dos semanas. Al sincronizar clases entre grupos, las clases hermanas tienen identificadores distintos y sus PDFs no se comparten automáticamente en esta versión. Tampoco hay exportación ZIP de PDFs ni indicador de PDF en los cuadros del calendario todavía.
