# División de libreta — Paso 6: papelera e historial de notas

## Instalación

Requiere las etapas 1 a 5 y el paso 5 de división de libreta. No necesita SQL.

1. Subir el nuevo js/modulos/portal2027-libreta-historial.js.
2. Reemplazar js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html con los de este ZIP. Subir los tres archivos web juntos.
3. Conservar los módulos de importación, teclado y vista de los pasos anteriores y el cargador/respaldo Excel.
4. Publicar y recargar con Ctrl+F5. Todos los módulos de apoyo se cargan antes de la libreta; el principal usa ?v=20261014&division=6.

## Cambio

Se trasladan dibujarPapelera, botonRecuperar, recuperar y dibujarHistorial a portal2027-libreta-historial.js, conservando el bloque original. El módulo recibe las mismas referencias al estado, servicios de la libreta y conexión existente.

La consulta mantiene los filtros de asignación/trimestre, el orden por fecha y el límite de 100 cambios. Recuperar conserva el motivo obligatorio y la versión actual de la nota, llama a la misma RPC portal2027_recuperar_nota y vuelve a cargar/redibujar tras un resultado exitoso.

La acción aPapelera permanece en la libreta: restaurar una columna desde la papelera delega en ella. Se mantienen las restricciones de trimestre cerrado, columna bloqueada o en papelera y nota inexistente. La base sigue validando permisos y versiones; esta extracción no amplía los permisos ni altera las RPC.

No se modifican cálculos, ponderaciones ni estados pendientes/exentos. No se ejecutó una recuperación o restauración en Supabase real desde este entorno.

## Pruebas manuales

1. Abrir Papelera y verificar sus columnas. En una columna de prueba, restaurar una y comprobar que sigue utilizando las notas existentes.
2. Abrir Historial y comprobar estudiante, columna, valores antes/después, versión y motivo del trimestre seleccionado.
3. Pulsar Recuperar y cancelar: no debe guardar nada. Repetir con motivo vacío: debe pedirlo.
4. En una nota de prueba, recuperar con motivo y verificar el valor anterior y el nuevo registro de historial.
5. Comprobar que un trimestre cerrado, columna bloqueada/en papelera o nota inexistente mantiene Recuperar deshabilitado.
6. Cambiar grupo o trimestre y volver a abrir Historial: debe consultar la nueva selección. Si hay un conflicto de versión, no debe anunciar una recuperación exitosa.

## Verificación realizada

```
node tests/portal2027-libreta-historial.test.cjs
```

Comparación opcional con la libreta del paso 5:

```
node tests/portal2027-libreta-historial.test.cjs RUTA_LIBRETA_ANTERIOR
```

Las pruebas usan el módulo real con DOM y Supabase simulados. Cubren papelera y restauración delegada, restricciones, cancelación/motivo, versión enviada, éxito y error/conflicto de RPC, estado de historial vacío, fallo de consulta, filtros por selección y texto seguro.

Se verificó que el bloque trasladado conserva su contenido original y que el resto de la libreta permanece idéntico. También se ejecutan las pruebas de vista, teclado, importación, horario, Excel, archivos y entregas.

Faltan revisión visual y pruebas de permisos/versiones en Supabase real.

La siguiente extracción propuesta es el desglose de apreciaciones y descuentos, conservando todas sus reglas existentes. No se realizó en este ZIP.
