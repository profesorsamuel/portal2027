# Etapa 5 — Instalación y pruebas

## Instalación del ZIP incremental

Requiere las etapas 1 a 4. Esta etapa no incorpora SQL nuevo que deba ejecutarse.

1. Copiar js/, pages/, docs/, tests/ y README.md sobre las mismas rutas del proyecto.
2. Incluir js/core/portal2027-excel.js, js/vendor/xlsx-0.20.3.full.min.js y js/vendor/LICENSE-SheetJS.txt. El respaldo de Excel necesita el archivo local completo, sin modificar sus bytes.
3. Subir los cuatro archivos de supabase/especificas/ y comprobar que existen. Eliminar de supabase/migrations/ solo las copias anteriores de esos cuatro archivos, indicadas abajo. El contenido de los SQL movidos es idéntico al original.
4. Publicar en GitHub Pages y recargar con Ctrl+F5. Los tres módulos/páginas modificados actualizan la caché a ?v=20261014&etapa=5. Los demás módulos conservan las versiones de la etapa 4.

Copias antiguas que hay que quitar del repositorio después de subir las nuevas:

- supabase/migrations/0003_portal2027_datos_ficticios.sql
- supabase/migrations/0034_portal2027_corregir_horario_existente.sql
- supabase/migrations/0035_portal2027_asignaciones_samuel_2027.sql
- supabase/migrations/0043_portal2027_restaurar_clase3_9B.sql

No borrar los archivos equivalentes de supabase/especificas/. No volver a ejecutar esos scripts solo por haberlos movido. Un ZIP incremental no elimina por sí mismo las rutas antiguas en GitHub.

Si utiliza Supabase CLI en una base con estas migraciones ya registradas, comprobar el historial con `supabase migration list` antes de un próximo `db push`: separar los archivos locales no modifica el historial remoto, y puede requerir conciliar ese historial según cómo se aplicaron originalmente. No se ejecutó ninguna reparación del historial ni se tocó una base remota en esta etapa.

## Cambios

Horario: reemplazo de todos los innerHTML por nodos creados con P.el. Nombres, motivos, etiquetas, opciones e identificadores se asignan como texto o atributos. Los data-editar, data-borrar y data-excluir ya no se interpolan dentro de cadenas HTML. Se mantienen los eventos delegados, la generación de sesiones, los bloques dobles y las vistas.

Excel: SheetJS 0.20.3, obtenido del CDN oficial, con SRI SHA-384 verificado contra los bytes descargados. El cargador compartido intenta https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js y, si falla o vence el tiempo de carga de 10 segundos, usa la copia local con el mismo SRI. La versión y API se comprueban después de cargar. La licencia Apache 2.0 se incluye en js/vendor/.

SRI verificado:

```
sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT
```

Administración espera al cargador antes de mostrar sus herramientas de importación. Si fallan ambos orígenes, muestra un aviso y las demás funciones del panel siguen disponibles. Libreta carga Excel al importar; el pegado de notas sigue disponible si no se puede cargar.

La propuesta de división de la libreta está en ETAPA_5_DIVISION_LIBRETA.md. No se ejecutó esa división. No se cambiaron ponderaciones ni reglas de pendientes/exentos.

## Pruebas manuales

1. Abrir Horario: verificar semana, franjas, sesiones y editor fácil. Editar y eliminar una franja. Cambiar el filtro de sesiones y usar Ver más.
2. Registrar una etiqueta o motivo ficticio con caracteres como `<`, `>`, comillas y `&`: debe mostrarse como texto, sin crear etiquetas o ejecutar código. Eliminar esa exclusión después de la prueba.
3. Importar y descargar una plantilla de Excel en administración; importar notas y comprobar la vista previa en libreta. Cancelar una importación antes de guardar.
4. En herramientas del navegador bloquear la URL del CDN de SheetJS y recargar: administración y libreta deben funcionar con js/vendor/xlsx-0.20.3.full.min.js. Comprobar la solicitud local en Red.
5. Comprobar que en el repositorio los cuatro SQL están solo en supabase/especificas/ y que las migraciones generales conservan 0045 y 0046.

## Pruebas realizadas y límites

- node tests/portal2027-seguridad-horario.test.cjs: textos maliciosos permanecen como texto; atributos data-* conservan el identificador; semana, editor fácil, sesiones, agrupación de bloques dobles y estados vacíos.
- node tests/portal2027-excel.test.cjs: hash de la copia local, lectura/escritura real de XLSX, versión fija, respaldo, concurrencia, timeout y reintento del cargador.
- Regresión: tests/portal2027-archivos.test.cjs y tests/portal2027-entregas.test.cjs.
- Sintaxis de archivos JS modificados; referencias y orden de scripts en páginas; copia idéntica de los cuatro SQL trasladados.

Las pruebas de DOM y de red usan simulaciones. No se realizó revisión visual en navegador real ni pruebas en Supabase real. El cambio de lector Excel de la libreta de 0.18.5 a 0.20.3 debe comprobarse también con sus archivos habituales.
