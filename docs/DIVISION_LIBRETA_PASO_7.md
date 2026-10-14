# División de libreta — Paso 7: desglose y descuentos

## Instalación

Requiere las etapas 1 a 5 y el paso 6 de división de libreta. No necesita SQL.

1. Subir el nuevo js/modulos/portal2027-libreta-desglose.js.
2. Reemplazar js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html con los de este ZIP. Subir los tres archivos web juntos.
3. Conservar todos los módulos de apoyo anteriores y el cargador/respaldo Excel.
4. Publicar y recargar con Ctrl+F5. Los módulos de apoyo se cargan antes de la libreta; el principal usa ?v=20261014&division=7.

## Cambio

Se traslada completo el bloque existente de identificadores de registros, abrirDescuentos, semanaActiva y abrirDesglose. Su contenido original se conserva: fórmulas, valores por defecto, RPC, cola de guardado, control de versiones, validaciones y eventos.

El módulo recibe referencias al estado, conexión y servicios actuales. La libreta mantiene referencias locales a las funciones públicas para sus botones y para abrir una semana desde Planificación.

Se mantienen columnas separadas por grupo de registro, incluso si tienen el mismo tipo/descripción. Se conserva la nota de conducta automática, el pegado y teclado del desglose, la lectura de las notas recalculadas por la base, los mensajes y la recarga al cerrar. Los descuentos siguen usando la configuración existente de la asignación y el mismo servicio de guardado.

Este paso no define nuevos pesos, estados pendientes/exentos ni reglas de descuentos. Las operaciones de edición/eliminación/guardado siguen validándose en Supabase; no se cambió la base ni se ejecutaron operaciones sobre datos reales desde este entorno.

## Pruebas manuales

1. Abrir dos apreciaciones distintas y comprobar su presentación y registros. Probar dos registros del mismo nombre: deben seguir siendo columnas separadas.
2. En una semana de prueba, escribir una nota y salir con Enter o clic. Debe guardar una sola vez y mostrar la nota semanal como antes. Probar una nota fuera de rango: debe rechazarla.
3. Pegar una tanda corta de notas, revisar la confirmación y probar Cancelar antes de guardar.
4. Abrir Ajustar descuentos, revisar los valores actuales y cancelar. Solo guardar un cambio si realmente se desea modificar esa configuración.
5. Probar Cerrar y actualizar libreta, y abrir Desglose desde Planificación. La libreta debe actualizarse.
6. Comprobar los bloqueos de trimestre cerrado/columna bloqueada y la celda de Conducta automática. Si faltan fechas de semana, Traer asistencia y comportamiento debe seguir deshabilitado.

## Verificación realizada

```
node tests/portal2027-libreta-desglose.test.cjs
```

Comparación opcional con la libreta del paso 6:

```
node tests/portal2027-libreta-desglose.test.cjs RUTA_LIBRETA_ANTERIOR
```

Las pruebas usan el bloque real con DOM y Supabase simulados. Cubren grupos separados, guardado y versión enviada, evitar guardar dos veces el mismo valor, rechazo de nota inválida, creación de celda sin registro, recuperación del valor anterior tras conflicto, restricciones, conducta automática, cancelación y validación de configuración existente.

Se verificó que el bloque extraído y el resto de la libreta conservan su contenido. Se ejecutan además las pruebas anteriores de historial, vista, teclado, importación, horario, Excel, límites y entregas.

La revisión visual, pegado real, permisos y guardado real en Supabase siguen pendientes en el portal publicado. No se comprobó contra la base real la actualización de notas de conducta.

La siguiente extracción propuesta es la construcción de la tabla principal, manteniendo sus servicios de guardado y cálculo existentes. No se hizo en este ZIP.
