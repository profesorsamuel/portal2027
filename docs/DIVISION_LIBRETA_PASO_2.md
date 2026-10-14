# División de libreta — Paso 2: planificador de importación

## Instalación

Requiere las cinco etapas principales. Este ZIP trae el módulo de importación completo actualizado, incluidas las funciones del paso 1. Si ya aplicó el paso 1, sustituir los mismos archivos.

No necesita SQL.

1. Subir juntos js/modulos/portal2027-libreta-importacion.js, js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html, conservando las rutas.
2. Conservar js/core/portal2027-excel.js y js/vendor/ de la etapa 5.
3. Publicar y recargar con Ctrl+F5. Ambos módulos usan ?v=20261014&division=2. El módulo de importación se carga antes que la libreta.

La carpeta docs/, README.md y el test actualizan la documentación y permiten comprobar el cambio localmente.

## Cambio

La función planificar se traslada al módulo portal2027-libreta-importacion.js conservando su cuerpo original. Crear el planificador requiere un contexto explícito con referencias a:

- estado de la libreta (S), sin duplicarlo;
- matsVisibles, para consultar la lista actual;
- clave, para localizar la nota actual;
- nombreEst, para mantener las mismas etiquetas.

La libreta crea una referencia local a ese planificador. Se mantienen los emparejamientos por código, nombre completo y nombres parciales, las filas vacías, el inicio elegido y los avisos existentes de duplicados, nombres ambiguos, notas inválidas y filas sobrantes.

El planificador solo lee el estado y construye la vista previa. No escribe en Supabase, no modifica las notas y no calcula promedios ni ponderaciones. La interfaz de revisión, los botones y guardarImportacion siguen en portal2027-libreta.js con su contenido previo.

No se añadieron reglas de pendientes/exentos ni se reinterpretaron estados de la importación; se conservan los que ya tenía el proyecto.

## Pruebas manuales

1. Pegar notas con y sin nombres, incluyendo una fila vacía. Revisar que el estudiante y el valor asignados coincidan con la versión anterior.
2. Usar códigos de estudiantes en una importación de prueba; comprobar notas nuevas, iguales y cambiadas en la vista previa.
3. Probar un nombre ambiguo, uno repetido y una nota fuera de rango: comprobar los avisos antes de guardar.
4. Cambiar una nota manualmente, volver a abrir la importación y comprobar que compara contra la nota actual.
5. Cambiar grupo o trimestre y abrir la vista previa: debe usar los estudiantes y notas de la selección actual. Probar Cancelar.

## Verificación realizada

```
node tests/portal2027-libreta-importacion.test.cjs
```

Comparación opcional con una copia anterior que todavía contenga planificar:

```
node tests/portal2027-libreta-importacion.test.cjs RUTA_LIBRETA_ANTERIOR
```

Si esa copia es del paso 1, conservar junto a ella su portal2027-libreta-importacion.js anterior para la comparación.

- Comparados 24 escenarios con el paso 1 y otros 24 con la versión previa a la división: resultados idénticos.
- Verificado que el cuerpo del planificador y la interfaz/guardado originales no cambian.
- Comprobado que no escribe notas, lee actualizaciones del estado y mantiene contextos independientes.
- Sintaxis, orden y referencias de scripts; regresión de horario, Excel, límites de archivos y entregas.

Estas comprobaciones son locales, con datos ficticios. La prueba visual en navegador y el guardado real en Supabase siguen pendientes.

El siguiente paso de esta división será trasladar la interfaz de importación, pasando sus dependencias explícitamente. No se hizo ese traslado en este ZIP.
