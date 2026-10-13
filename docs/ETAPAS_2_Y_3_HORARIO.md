# Etapas 2 y 3: horario y calendario

1. Ejecute primero `0032_portal2027_horario.sql` (etapa 1).
2. Ejecute `0033_portal2027_calendario.sql` en Supabase SQL Editor (etapa 3).
3. Suba los archivos de este ZIP a GitHub respetando carpetas y nombres.
4. Entre como profesor y abra **Horario y calendario** desde Mis grupos y materias.
5. Seleccione año y profesor. Importe el JSON preparado desde la foto o agregue franjas manualmente. Revise antes de reemplazar: la importación sustituye todo el horario.
6. Seleccione trimestre (sus fechas se configuran en Administración), registre feriados y días sin clases y elija cómo contar bloques dobles.
7. El calendario se recalcula sin crear registros de sesiones. La integración con Asistencia y Planificación corresponde a etapas posteriores.

**Nota:** esta versión no interpreta imágenes JPG ni modifica todavía el módulo de asistencia. La importación acepta JSON. No se ha podido probar contra la base de datos real.
