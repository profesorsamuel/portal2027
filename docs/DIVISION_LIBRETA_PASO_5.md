# División de libreta — Paso 5: preferencias visuales y anchos

## Instalación

Requiere las etapas 1 a 5 y el paso 4 de división de libreta. No necesita SQL.

1. Subir el nuevo js/modulos/portal2027-libreta-vista.js.
2. Reemplazar js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html con los de este ZIP. Subir los tres archivos web juntos.
3. Conservar los módulos de importación y teclado de los pasos anteriores y el cargador/respaldo Excel.
4. Publicar y recargar con Ctrl+F5. Los módulos de apoyo se cargan antes de la libreta; la libreta usa ?v=20261014&division=5.

## Cambio

Se trasladan tres bloques existentes: preferencias de visibilidad y selección de estudiantes, barra de ganchos de columnas y redimensionamiento de columnas. Sus contenidos originales se conservan en portal2027-libreta-vista.js.

El módulo recibe referencias al estado y servicios actuales y mantiene sus preferencias privadas. La lista de estudiantes consulta estudianteOculto para evitar retener una copia desactualizada cuando se cambia la selección.

Se conservan las claves de localStorage por asignación y trimestre, los anchos guardados, la selección de estudiantes, los filtros y los límites de ancho anteriores. Si el almacenamiento está bloqueado o contiene JSON inválido, conserva el manejo previo del error.

No hay escrituras a Supabase en este módulo. El cálculo de notas, el guardado, la tabla y los demás servicios permanecen en la libreta. No se definen ponderaciones ni estados académicos nuevos.

## Pruebas manuales

1. Desmarcar y marcar ganchos de columnas. Comprobar que las columnas ocultas se pueden volver a mostrar.
2. Abrir la selección de estudiantes, buscar un nombre, quitar y poner un gancho. Probar Todos, Ninguno y Cerrar.
3. Arrastrar el borde de una columna y usar la opción de igualar anchos. Recargar: los anchos deben conservarse.
4. Cambiar grupo y trimestre: comprobar que cada selección conserva sus preferencias anteriores al volver.
5. Editar y guardar una nota, navegar con Enter y abrir la importación: deben seguir funcionando como antes.

## Verificación realizada

```
node tests/portal2027-libreta-vista.test.cjs
```

Comparación opcional con la libreta del paso 4:

```
node tests/portal2027-libreta-vista.test.cjs RUTA_LIBRETA_ANTERIOR
```

Las pruebas usan el módulo real, P.el y DOM/almacenamiento simulados. Cubren ganchos, papelera, estudiantes y búsqueda, acceso al estado vivo, preferencias por grupo/trimestre, arrastre, límites existentes, igualación, persistencia y almacenamiento inválido/bloqueado. Se verifica que los tres bloques trasladados conservan el contenido original.

También se ejecutan las pruebas anteriores de teclado, importación, horario, Excel, archivos y entregas. La revisión visual y el guardado real quedan pendientes en el portal publicado.

La siguiente extracción propuesta es papelera e historial de notas. No se realizó en este ZIP.
