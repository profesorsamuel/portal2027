# División de libreta — Paso 8: tabla principal

## Instalación

Requiere las etapas 1 a 5 y el paso 7 de división de libreta. No necesita SQL.

1. Subir el nuevo js/modulos/portal2027-libreta-tabla.js.
2. Reemplazar js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html. Subir los tres archivos web juntos.
3. Conservar los módulos de importación, teclado, vista, historial y desglose, y el cargador/respaldo Excel.
4. Publicar y recargar con Ctrl+F5. Los módulos de apoyo se cargan antes de la libreta; el principal usa ?v=20261014&division=8.

## Cambio

Se trasladan visibles, actualizarFila, celdaNota, cabeceraColumna y dibujarTabla al módulo de tabla. Los dos bloques originales se conservan íntegros.

El módulo mantiene sus referencias de filas y zona de tabla privadas. La libreta conserva delegaciones para dibujarTabla y actualizarFila y pasa los servicios de guardado, cálculo, filtros, estudiantes, desglose y preferencias existentes. La navegación usa el módulo de teclado ya cargado, evitando capturar una referencia local todavía sin inicializar.

El cálculo sigue siendo el servicio resultado existente, y la edición sigue pasando por guardarCelda. No se definen pesos, promedios ni estados académicos nuevos. Las celdas, encabezados y eventos mantienen el contenido original.

## Pruebas manuales

1. Abrir la libreta y comprobar categorías, columnas, estudiantes y resultados de notas existentes.
2. Editar una celda de prueba, salir y comprobar el guardado y actualización de su fila. Una apreciación semanal debe seguir abriendo Desglose y estar bloqueada para edición directa.
3. Cambiar categoría y buscar un estudiante. Probar ganchos y cambiar de grupo/trimestre.
4. Cambiar un tema, abrir Desglose, usar los controles de ancho y comprobar Enter/flechas y pegado.
5. Probar trimestre cerrado, columna bloqueada y columna ligada a planificación: conservar sus restricciones. Revisar que un grupo sin estudiantes o sin columnas muestra su aviso.

## Verificación realizada

```
node tests/portal2027-libreta-tabla.test.cjs
```

Comparación opcional con la libreta del paso 7:

```
node tests/portal2027-libreta-tabla.test.cjs RUTA_LIBRETA_ANTERIOR
```

Pruebas del módulo real con DOM simulado y servicios de guardado/cálculo sustituidos por espías o respuestas ficticias. Cubren tabla, filtros, restricciones, texto seguro, pegado delegado, eventos de encabezado, ancho, actualización de resultados y referencias a la tabla nueva tras redibujar.

Se verifica el contenido original de los bloques trasladados y un arranque completo con módulos cargados en orden hasta la comprobación de conexión. Esa prueba de arranque no inicia sesión ni consulta Supabase.

También pasan las pruebas anteriores de desglose, historial, vista, teclado, importación, horario, Excel, límites y entregas. La revisión visual, inicio de sesión y guardado real en Supabase siguen pendientes.

Con este paso se completa la separación propuesta de los bloques de importación, teclado, preferencias, historial, desglose y tabla. El punto de entrada conserva carga, coordinación y servicios compartidos de escritura/cálculo. La revisión integrada y un ZIP acumulativo de la división pueden realizarse antes de seguir extrayendo servicios.
