# Instalación acumulativa — Etapas 1 a 5

El ZIP acumulativo contiene todos los archivos nuevos o modificados respecto al ZIP portal2027-main(20261014-161812).zip. Se puede aplicar directamente sobre esa versión original; no necesita aplicar los cinco ZIP intermedios. También puede aplicarse sobre una versión que ya tenga esas etapas, si no se han hecho otros cambios después.

## Orden

1. Si todavía no instaló 0045, ejecutar supabase/migrations/0045_portal2027_entregas_multiples.sql en Supabase SQL Editor, después de 0044. Verificar que termine sin error.
2. Si todavía no instaló 0046, ejecutar supabase/migrations/0046_portal2027_limites_archivos.sql después de 0045. Verificar el resultado antes de publicar. Si ya instaló ambas, no es necesario repetirlas para subir este ZIP.
3. Copiar js/, assets/, pages/, docs/, tests/ y README.md sobre las mismas rutas del proyecto. Incluir los dos nuevos archivos core portal2027-archivos.js y portal2027-excel.js y la carpeta js/vendor/ completa.
4. Subir supabase/especificas/ y confirmar que están los cuatro SQL originales. Retirar solo sus copias antiguas de supabase/migrations/:
   - 0003_portal2027_datos_ficticios.sql
   - 0034_portal2027_corregir_horario_existente.sql
   - 0035_portal2027_asignaciones_samuel_2027.sql
   - 0043_portal2027_restaurar_clase3_9B.sql
5. Publicar en GitHub Pages y recargar con Ctrl+F5.

Mover los cuatro SQL no los ejecuta y no altera la base instalada. El ZIP tampoco elimina sus copias anteriores de GitHub. Si utiliza Supabase CLI, consulte la nota de historial en ETAPA_5_INSTALACION_Y_PRUEBAS.md antes de un próximo db push.

## Qué incluye

| Etapa | Resultado |
| --- | --- |
| 1 | Compresión compartida de imágenes; integración de foto de perfil manteniendo sus opciones. |
| 2 | Hasta 15 fotos por clase, vista previa, tamaños, títulos opcionales, progreso y reintentos. |
| 3 | Adjuntos múltiples en una entrega y apertura de cada adjunto por estudiante y profesor; migración 0045. |
| 4 | Peso previo del PDF, avisos de exceso, configuración común y límites de buckets; migración 0046. |
| 5 | Horario sin innerHTML, Excel con SRI y respaldo local, separación de scripts específicos y propuesta de división de libreta. |

Límites por archivo: foto de perfil 2 MB; documentos administrativos 5 MB; materiales, entregas y planificación 15 MB. MB equivale a 1024 × 1024 bytes. Los PDF no se comprimen automáticamente. Los PNG transparentes y las imágenes pequeñas conservan sus archivos según la función compartida.

El ZIP de etapas 1 a 5 dejó la división de portal2027-libreta.js como propuesta. Los pasos posteriores de lectura/normalización y planificación de importaciones tienen sus propios ZIP e instrucciones en DIVISION_LIBRETA_PASO_1.md y DIVISION_LIBRETA_PASO_2.md; la interfaz de revisión y el guardado permanecen en la libreta. No se añadieron ponderaciones ni reglas de pendientes/exentos.

## Pruebas manuales finales

1. Subir una foto vertical grande al perfil y comprobar orientación, guardado y eliminación.
2. Agregar varias fotos a una clase, quitar una en la vista previa y verificar nombres o título numerado. Interrumpir y reintentar una tanda sin duplicar los éxitos.
3. Como estudiante, entregar varias fotos. Como profesor, abrirlas y revisar. Verificar que una entrega antigua sigue disponible y una revisada no se reemplaza.
4. Probar PDF de 12 MB y 18 MB en materiales y entregas; el segundo debe bloquearse con aviso de 15 MB. Documento administrativo de 6 MB debe mostrar máximo de 5 MB. En planificación revisar el peso antes de confirmar.
5. Editar/eliminar franjas y exclusiones del horario; revisar semana, filtro de sesiones y editor fácil.
6. Importar Excel en administración y libreta. Bloquear el CDN de SheetJS en las herramientas del navegador y comprobar que se usa la copia local.

## Revisión integrada realizada

- Sintaxis de los 35 módulos JS del proyecto y existencia de referencias locales en todas las páginas HTML.
- Pruebas específicas de horario, Excel, límites/PDF y entregas múltiples: correctas.
- SRI de la copia local de Excel y lectura/escritura real de un archivo XLSX: correctos.
- Cuatro SQL específicos trasladados con contenido idéntico; 42 migraciones generales restantes.
- La lógica de generación de sesiones se mantiene idéntica a la original; solo cambia su representación con DOM.

Comandos de pruebas locales:

```
node tests/portal2027-seguridad-horario.test.cjs
node tests/portal2027-excel.test.cjs
node tests/portal2027-archivos.test.cjs
node tests/portal2027-entregas.test.cjs
```

Las pruebas de interfaz y red usan simulaciones. La revisión visual en navegador real y la ejecución/validación de las migraciones en Supabase real siguen pendientes. No se publicó el sitio ni se modificó una base remota desde este entorno.
