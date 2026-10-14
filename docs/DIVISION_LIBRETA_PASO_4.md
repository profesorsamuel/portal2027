# División de libreta — Paso 4: navegación por teclado

## Instalación

Requiere las etapas 1 a 5 y el paso 3 de división de libreta (que incluye los pasos 1 y 2). No necesita SQL.

1. Subir el nuevo js/modulos/portal2027-libreta-teclado.js.
2. Reemplazar js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html con los de este ZIP. Subir los tres archivos web juntos.
3. Conservar portal2027-libreta-importacion.js del paso 3 y el cargador/respaldo de Excel.
4. Publicar y recargar con Ctrl+F5. La página carga ambos módulos de apoyo antes de la libreta; el módulo principal usa ?v=20261014&division=4.

## Cambio

inputDeFila, celdaVecina y moverFoco se trasladan a portal2027-libreta-teclado.js sin modificar sus cuerpos. La libreta mantiene una referencia local a moverFoco. Los eventos keydown de las celdas permanecen exactamente como estaban.

Se conservan Enter/Shift+Enter, flechas verticales, flechas horizontales solo en el extremo del texto, salto de celdas deshabilitadas y límites de tabla. La celda destino recibe focus/select. Enter al final conserva blur. El guardado sigue dependiendo del evento change y de los servicios de la libreta; el módulo nuevo no escribe notas.

No se modifica el teclado de la ventana de desglose, el comportamiento del scroll, el cálculo de notas ni reglas académicas. Este paso separa solo las tres funciones de navegación de la tabla principal.

## Pruebas manuales

1. Escribir una nota y pulsar Enter: debe bajar a la siguiente celda habilitada de la misma columna y conservar el guardado habitual. Shift+Enter debe subir.
2. Probar flechas arriba/abajo y una columna con celdas deshabilitadas: debe saltarlas igual que antes.
3. Probar flechas izquierda/derecha dentro del número y en sus extremos: dentro edita la posición del cursor; al extremo pasa a una celda vecina cuando existe.
4. En la última fila pulsar Enter: debe salir de la celda sin error. En bordes de la tabla no debe saltar a otra columna o fila inesperada.
5. Cambiar de grupo/trimestre y repetir el movimiento. Abrir Cargar notas y comprobar que la importación sigue funcionando.

## Verificación realizada

```
node tests/portal2027-libreta-teclado.test.cjs
```

Comparación opcional con la libreta del paso 3:

```
node tests/portal2027-libreta-teclado.test.cjs RUTA_LIBRETA_ANTERIOR
```

Las pruebas cubren el servicio extraído y los eventos reales de keydown del módulo principal usando una tabla simulada. Se verificó que las funciones originales, el resto de la libreta y los eventos permanecen idénticos. La simulación comprueba salida de foco, no un guardado real en Supabase.

También se ejecutan las pruebas de interfaz/importación, horario, Excel, límites y entregas. La revisión visual y el guardado real deben comprobarse en el portal publicado.

La siguiente extracción propuesta es la configuración de vista y ancho de columnas; no se hizo en este ZIP.
