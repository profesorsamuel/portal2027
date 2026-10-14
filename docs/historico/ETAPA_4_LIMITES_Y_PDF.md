# Etapa 4 — Peso de PDF, límites y mensajes

## Instalación

Requiere las etapas 1, 2 y 3 y sus migraciones anteriores.

1. Ejecutar supabase/migrations/0046_portal2027_limites_archivos.sql completo en Supabase > SQL Editor, después de 0045.
2. Publicar todos los archivos de js/ y pages/ de este ZIP conservando las rutas. Incluye un nuevo archivo core: portal2027-archivos.js.
3. Recargar con Ctrl+F5. Todos los consumidores cargan la configuración después de permisos y antes de los módulos. Las referencias de los módulos cambiados llevan ?v=20261014&etapa=4 para evitar reutilizar archivos de las etapas anteriores del mismo día.

La migración comprueba que estén creados los cinco buckets y establece sus límites. No cambia RLS, privacidad, tipos MIME ni archivos existentes. No fue ejecutada contra el Supabase real en este entorno.

## Configuración común

P.archivos.LIMITES es el único objeto que define los límites del navegador. La migración 0046 contiene los mismos valores para Storage.

| Uso | Bucket | Máximo por archivo | Bytes |
| --- | --- | --- | --- |
| Foto de perfil | portal2027-fotos | 2 MB | 2097152 |
| Documentos administrativos | portal2027-documentos | 5 MB | 5242880 |
| Materiales de clase | portal2027-materiales | 15 MB | 15728640 |
| Entregas de estudiantes | portal2027-entregas | 15 MB | 15728640 |
| PDF de planificación | portal2027-planificaciones | 15 MB | 15728640 |

Los documentos administrativos conservan los 5 MB que también valida portal2027_registrar_documento; la foto conserva 2 MB. Materiales y entregas aumentan de 10 a 15 MB. Planificación ya tenía 15 MB. En la interfaz, MB significa 1024 × 1024 bytes, para coincidir con las migraciones existentes. El máximo exacto está permitido; un byte por encima se rechaza.

La configuración incluye P.archivos.COMPRESION con umbral de 1 MB, objetivo de menos de 1.5 MB y lado máximo de 1600 px. La foto de perfil mantiene sus opciones anteriores. Los PDF y documentos no se transforman.

Cambiar este objeto en el futuro exige una nueva migración con los mismos límites. Si se cambia el límite de documentos administrativos, también hay que actualizar la validación de portal2027_registrar_documento. Cambiar solo el navegador no cambia Supabase.

## Cambios visibles

- Materiales PDF y documentos administrativos: al elegir un archivo se muestran nombre, peso y máximo antes de pulsar Subir.
- Entregas: la vista previa de PDF muestra el peso y, si excede el límite, el aviso completo. No se inicia la subida hasta quitar el archivo excesivo.
- Planificación: al elegir PDF se comprueba el tamaño y se muestra el nombre y peso en el diálogo previo a subir o reemplazar. Un PDF excesivo no llega a Storage.
- Para un PDF de 18 MB en materiales/entregas/planificación: «Pesa 18 MB, el máximo es 15 MB. Comprímalo en ilovepdf.com o smallpdf.com y vuelva a subirlo». En documentos administrativos el mismo aviso indica 5 MB.
- Materiales, documentos y entregas incluyen enlaces para abrir las herramientas de compresión cuando el PDF pesa demasiado. Planificación indica sus nombres en el aviso.
- Los errores de operaciones de archivos muestran instrucciones comprensibles; el detalle técnico se registra en console.error.

No se cambiaron ponderaciones de notas ni reglas de estados pendientes/exentos.

## Pruebas manuales

1. En Materiales elegir un PDF de 12 MB: debe mostrar su peso y permitir subirlo. Elegir uno de 18 MB: debe mostrar el máximo de 15 MB y bloquear su subida.
2. En Mis entregas repetir los casos anteriores; comprobar que las fotos múltiples y el reintento de la etapa 3 siguen funcionando.
3. En Mis documentos elegir un PDF de 6 MB: debe indicar máximo de 5 MB. Uno permitido debe seguir guardándose.
4. En Planificación elegir un PDF permitido: revisar peso antes de confirmar y probar Cancelar. Uno de 18 MB debe bloquearse antes de subir.
5. Subir y quitar una foto de perfil. Probar también un PNG transparente que exceda el límite de 2 MB: debe indicar el exceso sin transformarlo.
6. Interrumpir la conexión durante una operación: el aviso debe ser comprensible, sin nombres de tablas, trazas ni mensajes del proveedor.

Comprobar en Supabase (consulta de solo lectura):

```sql
select id, file_size_limit, public
from storage.buckets
where id in ('portal2027-fotos', 'portal2027-documentos', 'portal2027-materiales',
             'portal2027-entregas', 'portal2027-planificaciones')
order by id;
```

Comparar file_size_limit con la tabla anterior. Los buckets existentes del portal son privados; 0046 conserva esa configuración.

## Verificación local

- Sintaxis de los JavaScript modificados y orden/referencias de carga de las seis páginas.
- node tests/portal2027-archivos.test.cjs: límites de frontend coinciden con los valores del SQL; límites exactos y un byte por encima; PDF sin transformación; aviso de 18 MB; formularios de materiales/planificación; errores sin detalle técnico.
- node tests/portal2027-entregas.test.cjs: regresión de entregas múltiples, PDF de 12 MB y rechazo previo de 18 MB.

Las pruebas de interfaz usan DOM y Supabase simulados. Falta la prueba visual en un navegador real y ejecutar la migración/validar límites en Supabase.
