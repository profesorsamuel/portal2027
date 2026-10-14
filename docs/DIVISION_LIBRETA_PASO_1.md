# División de libreta — Paso 1: lectura y normalización de importaciones

Este documento describe el paso 1. Su continuación, con el planificador separado, está en DIVISION_LIBRETA_PASO_2.md.

## Instalación

Requiere tener instaladas las cinco etapas anteriores. No necesita SQL.

1. Subir js/modulos/portal2027-libreta-importacion.js como archivo nuevo.
2. Reemplazar js/modulos/portal2027-libreta.js y pages/portal2027-libreta.html por los de este ZIP.
3. Conservar js/core/portal2027-excel.js y js/vendor/ de la etapa 5.
4. Publicar y recargar con Ctrl+F5. La página carga el módulo nuevo antes de la libreta. La libreta usa ?v=20261014&division=1 para evitar reutilizar la versión de la etapa 5.

El nuevo módulo es obligatorio: subir solo la libreta o solo su página puede dejar una dependencia sin cargar. Subir los tres archivos web juntos.

Los archivos de docs/, README.md y tests/ actualizan la documentación y permiten comprobar el cambio localmente.

## Cambio acotado

Se extraen estas siete funciones, sin alterar sus cuerpos:

- esNum y aNumero: reconocimiento y conversión de los números del archivo.
- tokensNombre y claveNombre: normalización de nombres y acentos.
- filasDeTexto: texto pegado a filas de celdas.
- leerFilas: lectura de encabezados y filas vacías.
- validar: comprobación existente del valor individual de una nota, conservada literalmente.

P.libretaImportacion reúne estas funciones. La libreta conserva referencias locales a ellas, por lo que las llamadas existentes siguen iguales.

El módulo nuevo no tiene acceso al DOM, a Supabase ni al cálculo de promedios. Planificar, la vista previa, guardarImportacion, guardarCelda y el resto del módulo permanecen en la libreta con su contenido previo. No se definieron nuevos pesos ni estados pendientes/exentos.

Este paso es una parte de la primera extracción propuesta: aún no se trasladó el flujo completo de importación. El próximo paso de ese módulo requerirá pasar sus dependencias explícitamente y conservar la revisión previa al guardado.

## Pruebas manuales

1. En Cargar notas, pegar una columna con 4,5, una fila vacía y 3. Comprobar el estudiante asignado a cada fila y que la fila vacía conserva su lugar.
2. Pegar nombres con acentos y notas; comprobar la coincidencia, la vista previa y los avisos de nombres ambiguos o repetidos. No guardar una prueba en una lista real sin revisar la vista previa.
3. Importar su archivo Excel habitual y comparar la vista previa con la versión anterior. Probar Cancelar.
4. En una columna de prueba, guardar una importación corta y comprobar que las celdas siguen guardándose igual.
5. Editar una celda manualmente y probar Enter/flechas: este paso no modifica el teclado ni el guardado habitual.

## Verificación

Comando sin dependencias externas:

```
node tests/portal2027-libreta-importacion.test.cjs
```

Comparación opcional con una copia local anterior del módulo:

```
node tests/portal2027-libreta-importacion.test.cjs RUTA_LIBRETA_ANTERIOR
```

Realizado: sintaxis, comprobación de orden de carga/referencias, pruebas de lectura y vista previa con datos ficticios y comparación de 24 escenarios con la versión anterior. Los cuerpos de las siete funciones y el resto de la libreta se verificaron idénticos, salvo las referencias locales que sustituyen las definiciones extraídas.

También se ejecutaron las pruebas de horario, Excel, límites de archivos y entregas de las etapas anteriores. No se probó en navegador real ni se guardaron notas en Supabase real desde este entorno.
