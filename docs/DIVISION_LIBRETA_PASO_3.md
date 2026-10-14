# División de libreta — Paso 3: interfaz de importación

La continuación de navegación por teclado está en DIVISION_LIBRETA_PASO_4.md.

## Instalación

Requiere las cinco etapas principales. Incluye el módulo de importación completo con los pasos 1 y 2 anteriores. Si ya aplicó esos pasos, sustituir los mismos archivos.

No necesita SQL.

1. Subir juntos js/modulos/portal2027-libreta-importacion.js, js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html, conservando las rutas.
2. Conservar js/core/portal2027-excel.js y js/vendor/ de la etapa 5.
3. Publicar y recargar con Ctrl+F5. Los dos módulos usan ?v=20261014&division=3; el de importación se carga antes que la libreta.

## Cambio

abrirImportacion y sus etiquetas de resultados se trasladan al módulo de importación. Sus cuerpos se mantienen intactos. crearInterfaz recibe el estado y los servicios existentes de la libreta: elementos del DOM, evaluaciones, estudiantes visibles, nombres, carga de Excel, mensajes y guardado.

La libreta conserva una referencia local a abrirImportacion. La interfaz sigue ofreciendo selección de columna, inicio de lista, pegado, archivo, Revisar, Guardar y Cerrar, con los mismos eventos y texto. Se mantiene la lectura de la primera hoja de Excel y el tratamiento de TXT/TSV.

GuardarImportacion permanece en portal2027-libreta.js sin cambios. El módulo de importación no crea su propia conexión a Supabase ni escribe notas directamente: el botón delega en el servicio original. No se cambiaron cálculos, ponderaciones, reglas de pendientes/exentos ni estados existentes de la importación.

## Pruebas manuales

1. Abrir Cargar notas, pegar una columna de números y pulsar Revisar. Comprobar las filas, los valores actuales y nuevos, y que todavía no se guardó nada.
2. Elegir otra columna e inicio de lista, revisar de nuevo y comprobar los estudiantes asignados.
3. Subir el Excel habitual y un TXT/TSV. Confirmar que el Excel usa la primera hoja y muestra la vista previa.
4. Probar una nota inválida o un nombre duplicado: debe mostrar el mismo aviso y excluir esa fila del guardado.
5. Pulsar Cerrar sin guardar y reabrir. En una columna de prueba, guardar una importación corta y comprobar que sigue solicitando motivo si cambia notas existentes.
6. Probar un trimestre cerrado o columnas bloqueadas: el acceso y las opciones deben conservar las restricciones anteriores.

## Verificación realizada

```
node tests/portal2027-libreta-interfaz.test.cjs
node tests/portal2027-libreta-importacion.test.cjs
```

Las pruebas de interfaz usan el módulo real y P.el con un DOM simulado. Cubren cierre, columnas disponibles, texto con etiquetas tratado como texto, revisión sin escritura, llamada al servicio original de guardado, TXT, lectura de un XLSX real, fallo del lector y botón de guardar deshabilitado para notas iguales.

Se verificó que el bloque de interfaz original está conservado y que guardarImportacion y el arranque del módulo permanecen idénticos. También pasan las pruebas anteriores de horario, Excel, límites de archivos y entregas.

La prueba visual en navegador y el guardado real en Supabase quedan pendientes; no se modificó una base remota en este entorno.

Con este paso, lectura, planificador e interfaz de importación ya están separados. La escritura de la importación se conserva en la libreta para mantener el servicio de guardado compartido. La siguiente extracción propuesta es el teclado de navegación entre celdas.
