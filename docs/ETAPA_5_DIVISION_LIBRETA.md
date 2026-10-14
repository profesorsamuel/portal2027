# División gradual propuesta para portal2027-libreta.js

La etapa 5 reemplazó el cargador de Excel por P.cargarExcel. Después se realizó un primer paso acotado: las siete funciones puras de lectura y normalización de importaciones se movieron a portal2027-libreta-importacion.js sin cambiar sus cuerpos. Véase DIVISION_LIBRETA_PASO_1.md. En el paso 2 se trasladó también planificar, con el mismo cuerpo y dependencias explícitas (DIVISION_LIBRETA_PASO_2.md). En el paso 3 se trasladó la interfaz de revisión (DIVISION_LIBRETA_PASO_3.md), conservando su cuerpo y eventos. En el paso 4 se separaron las tres funciones de navegación de la tabla principal (DIVISION_LIBRETA_PASO_4.md). En el paso 5 se separaron las preferencias visuales y anchos (DIVISION_LIBRETA_PASO_5.md). En el paso 6 se separaron papelera e historial manteniendo los servicios y validaciones existentes (DIVISION_LIBRETA_PASO_6.md). El guardado de importación y el resto de la división siguen pendientes; los cálculos, estados, teclado y presentación no se cambiaron.

## Estrategia

Mantener portal2027-libreta.js como punto de entrada. Extraer una sección por sesión, con cambios mecánicos y pruebas antes de seguir. Las funciones extraídas reciben sus dependencias por un contexto explícito, sin duplicar el estado S ni convertirlo en variables globales nuevas. No hay migraciones de base para esta división.

| Orden | Módulo propuesto | Funciones actuales y dependencias | Prueba antes de continuar |
| --- | --- | --- | --- |
| 1 | portal2027-libreta-importacion.js | esNum, aNumero, tokensNombre, claveNombre, filasDeTexto, leerFilas, validar, planificar, abrirImportacion y guardarImportacion; recibe alumnos, evaluaciones, db, diálogos y funciones de guardado. Excel ya usa el cargador compartido. | Pegado de números, archivo con nombres/códigos, vista previa, cancelar y guardar una importación; mismo resultado antes/después. |
| 2 | portal2027-libreta-teclado.js | inputDeFila, celdaVecina y moverFoco; recibe la tabla y conserva los eventos existentes. | Enter y flechas mantienen el movimiento y guardado actuales; scroll no cambia números. |
| 3 | portal2027-libreta-vista.js | claveVista, leerVista, guardarVista, panelColumnas, barraGanchosColumnas, claveAnchos, leerAnchos e iniciarRedimension; recibe contexto de grupo/trimestre y redibujado. | Ganchos, tamaños de columnas, persistencia tras recargar, cambiar grupo y trimestre. |
| 4 | portal2027-libreta-historial.js | dibujarPapelera, botonRecuperar, recuperar y dibujarHistorial; recibe permisos, versiones y recargar. | Papelera, restauración y recuperación de nota con motivo; conflictos no sobrescriben cambios nuevos. |
| 5 | portal2027-libreta-desglose.js | abrirDescuentos, semanaActiva y abrirDesglose; recibe el estado y operaciones actuales, sin reinterpretar descuentos, asistencias ni comportamiento. | Abrir dos apreciaciones, registrar cambios y verificar que se conservan exactamente las reglas existentes. |
| 6 | portal2027-libreta-tabla.js | cabeceraColumna, celdaNota, actualizarFila y dibujarTabla; recibe los servicios ya separados. | Edición y guardado de una celda, publicación, columna bloqueada, tabla móvil y recarga. |

El punto de entrada conserva cargarAsignacion, cargarLibreta, recargar, iniciar y la coordinación de dibujar. Las acciones de columnas y guardarCelda se extraen solo después de estabilizar los módulos anteriores, como servicio de comandos compartido.

## Cómo hacerlo sin cambiar comportamiento

1. Guardar el avance actual en un commit.
2. Para cada sección, identificar llamadas hacia fuera y registrar casos de entrada/salida con datos ficticios antes de moverla. El contexto pasa referencias a S y a las funciones existentes; no crea una segunda fuente de estado.
3. Mover las funciones completas conservando sus nombres y cuerpo. Dejar delegaciones desde el punto de entrada cuando sean necesarias para que los eventos sigan llamando igual.
4. Cargar el módulo nuevo antes del punto de entrada y actualizar ?v=AAAAMMDD en todas las páginas que lo usen.
5. Comparar los casos de antes/después y realizar la prueba manual de la fila correspondiente. Confirmar el commit de esa sección antes de seguir.

No modificar M.calcular, ponderaciones, estados pendientes/exentos ni decisiones académicas durante la extracción. Si una sección necesita redefinir esas reglas, detener esa sección y tratarla como trabajo separado con las definiciones del profesor.

## Reversión

Cada extracción debe caber en un commit que se pueda revertir junto con su referencia HTML. No mezclar cambios de apariencia, de SQL ni de reglas en ese commit. Esta propuesta no requiere sustituir ahora el archivo completo ni modificar la base.
