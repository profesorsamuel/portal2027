# Etapa 3 — Propuesta mínima antes de modificar el código

## Resultado de la revisión

La migración 0011 define una entrega por tarea y matrícula con dos campos obligatorios: archivo_ruta y archivo_nombre. La RPC portal2027_entregar_tarea(uuid,text,text,text) acepta un solo archivo y reemplaza esos campos al reenviar. La versión vigente de portal2027_mis_clases está en 0044 y devuelve también un único archivo. Repetir la RPC por cada foto no permite guardar varias fotos en una misma entrega.

Las políticas de Storage permiten insertar y leer archivos en <tarea>/<matricula>/<archivo>. No permiten eliminar entregas desde el navegador: los archivos se conservan como evidencia. No se debe ampliar ese permiso para habilitar fotos múltiples.

## Migración propuesta: 0045_portal2027_entregas_multiples.sql

1. Agregar `archivos jsonb` a `portal2027_entregas`. Cada elemento contiene `ruta` y `nombre`. Una lista de 1 a 15 archivos por entrega. Mantener archivo_ruta y archivo_nombre como el primer elemento, para conservar compatibilidad con los paneles existentes.
2. Copiar los campos actuales a una lista de un elemento en cada entrega existente, sin alterar fechas, versiones, revisión, comentarios ni notas.
3. Incorporar `portal2027_entregar_tarea_archivos(p_tarea uuid, p_archivos jsonb, p_comentario text, p_version integer)` con permisos solo para usuarios autenticados. Validar sesión, matrícula propia, tarea publicada y no eliminada, entrega no revisada, versión esperada, cantidad, nombres, rutas propias sin duplicados y existencia de todos los objetos en el bucket privado. Bloquear escrituras concurrentes de la misma tarea y matrícula. Guardar toda la lista en una transacción; nunca registrar una entrega parcial.
4. Conservar la firma original de portal2027_entregar_tarea para clientes antiguos. Su ejecución debe actualizar la lista a un solo elemento junto con los campos anteriores; debe respetar el mismo bloqueo y la prohibición de modificar entregas revisadas.
5. Actualizar portal2027_mis_clases para devolver `archivos` junto con los campos actuales. Conservar filtros, permisos y agrupación de clases de la versión 0044.
6. Mantener RLS, bucket privado y políticas de evidencia. No cambiar límites de tamaño en esta etapa: se unificarán en la etapa 4.

Una columna JSONB evita crear una tabla adicional y sus políticas. Los alumnos siguen teniendo una sola entrega y el profesor una sola revisión por tarea.

## Cambios de interfaz posteriores a esta migración

- js/modulos/portal2027-clases-estudiante.js: elegir varias fotos JPG/PNG (hasta 15) o un documento individual; vista previa con miniatura, nombre y tamaños original/final; quitar fotos; usar P.clases.reducirImagen. Mantener PDF y demás documentos sin transformación.
- js/modulos/portal2027-clases.js: mostrar y abrir todos los adjuntos en la revisión del profesor, con compatibilidad para entregas antiguas.
- assets/css/portal2027-clases.css: reutilizar los estilos de vista previa de la etapa 2; agregar solo los ajustes necesarios.
- pages/portal2027-estudiante.html y pages/portal2027-clases.html: versiones ?v=20261014 para scripts modificados y estilos si cambian.
- La subida debe conservar las rutas ya subidas durante los reintentos. Si falla una foto, no enviar la RPC hasta completar la tanda; el reintento debe reutilizar los archivos exitosos. No anunciar entrega recibida hasta confirmar el registro. Si se reemplaza una entrega, conservar los objetos anteriores como evidencia.

## Orden de instalación previsto

Primero ejecutar la migración completa en Supabase; después publicar los módulos y páginas. La migración y el código se prepararán juntos en el siguiente paso. Este documento no contiene SQL para ejecutar ni instala la función nueva.

## Pruebas manuales al implementar

1. Abrir una entrega antigua como estudiante y profesor: su archivo debe seguir disponible.
2. Enviar tres fotos, quitar una antes de enviar y comprobar que ambos roles pueden abrir las dos restantes.
3. Reenviar una entrega no revisada y comprobar que la lista vigente cambia; bloquear el reenvío tras la revisión del profesor.
4. Interrumpir una subida y reintentar sin duplicar las fotos ya subidas ni registrar una entrega incompleta.
5. Intentar enviar rutas de otro alumno, archivos inexistentes o más de 15 adjuntos: la función debe rechazarlos sin modificar la entrega.
6. Enviar un PDF individual y verificar que no se transforma y sigue funcionando la revisión habitual.
7. Abrir dos pestañas y reenviar desde ambas: la versión debe impedir sobrescribir cambios más recientes.

## Alcance de esta entrega

Solo propuesta basada en el ZIP revisado. No se conectó ni modificó el Supabase real. La etapa 3 aún no está implementada. No se modificaron ponderaciones académicas ni reglas de pendientes o exentos.
