# Etapa 3 — Instalación y pruebas

## Qué se entrega

- 0045_portal2027_entregas_multiples.sql: lista JSONB en entregas, copia de los adjuntos existentes, nueva RPC transaccional, control de versión y compatibilidad con la RPC antigua; amplía la respuesta de mis_clases conservando la agrupación de 0044.
- portal2027-clases-estudiante.js: hasta 15 fotos o un documento individual, compresión compartida, vista previa y quitar archivos antes de iniciar la subida. El registro solo se realiza tras subir la tanda completa. Los reintentos conservan las rutas exitosas.
- portal2027-clases.js: el profesor puede abrir cada adjunto, sin cambiar la revisión o las notas.
- Páginas de clases y estudiante: actualizan referencias de caché. La página de clases agrega &etapa=3 porque ya utilizó ?v=20261014 en la etapa 2.
- Prueba automática sin dependencias externas: tests/portal2027-entregas.test.cjs.

## Instalación

Requiere haber instalado las etapas 1 y 2 y las migraciones anteriores hasta 0044.

1. En Supabase > SQL Editor, ejecutar el archivo completo supabase/migrations/0045_portal2027_entregas_multiples.sql. Contiene una transacción; si falla, no publicar los archivos web y conservar el mensaje de error para revisarlo.
2. Copiar los archivos de js/ y pages/ sobre las mismas rutas del proyecto; conservar assets/css/portal2027-clases.css de la etapa 2.
3. Publicar en GitHub Pages y recargar con Ctrl+F5. Las carpetas docs/ y tests/ son documentación y comprobaciones; no sustituyen los módulos.

No se cambia ningún bucket ni se amplían permisos de borrado. Los objetos anteriores o subidos sin registro se conservan según la política existente de evidencia. Los archivos subidos durante un intento pueden reutilizarse al reintentar mientras siga abierto el formulario; si se abandona o recarga antes de registrar, esa memoria de rutas se pierde. No hay limpieza automática de entregas en esta etapa.

Los campos archivo_ruta/archivo_nombre continúan apuntando al primer adjunto. La RPC anterior sigue funcionando con un archivo individual. El cliente nuevo usa versión de entrega y la nueva RPC. La migración no crea notas ni cambia su cálculo.

## Pruebas manuales

1. Abrir una entrega anterior con ambos roles. Su archivo y comentario deben seguir disponibles.
2. Seleccionar tres fotos, comprobar miniaturas y tamaños, quitar una, enviar y abrir las dos restantes como estudiante y profesor. Probar una foto vertical con EXIF y un PNG transparente.
3. Elegir 16 fotos o mezclar fotos con PDF: debe rechazar la selección. Un PDF individual debe poder entregarse sin transformación.
4. Cortar la conexión durante la tanda. La entrega no debe registrarse incompleta. Restaurar la conexión y pulsar Reintentar: los éxitos no deben subirse de nuevo. Si falló la confirmación, reintentar el registro sin subir los adjuntos otra vez.
5. Reemplazar una entrega no revisada: cambia la lista vigente. Revisarla como profesor: el estudiante deja de tener formulario para reemplazarla.
6. Abrir dos pestañas con la misma versión y reenviar desde ambas: la segunda debe pedir recargar si la entrega cambió. En una copia de prueba, intentar enviar rutas de otro alumno, objetos inexistentes o 16 archivos directamente a la RPC: no debe modificar la entrega.

Comprobación de datos opcional, después de instalar (solo lectura):

```sql
select id, jsonb_array_length(archivos) as cantidad, version, estado
from public.portal2027_entregas
order by entregada_en desc
limit 20;

-- Debe devolver cero: compatibilidad del primer adjunto.
select count(*) as incompatibles
from public.portal2027_entregas
where archivo_ruta is distinct from archivos->0->>'ruta'
   or archivo_nombre is distinct from archivos->0->>'nombre';
```

## Verificación realizada

Sintaxis de los módulos JavaScript y pruebas del código real con DOM y Supabase simulados: interrupción parcial, reintento sin duplicar subidas, envío de versión, lectura de entregas antiguas, límite de 15, documento individual, entrega revisada y apertura de adjuntos por el profesor.

Ejecutar localmente: `node tests/portal2027-entregas.test.cjs`.

No se ejecutó la migración en PostgreSQL ni se probó contra Supabase real: este entorno no dispone de esa instancia ni de acceso al proyecto Supabase. Las pruebas de permisos, concurrencia y funciones SQL deben hacerse en una copia de prueba antes de usar el portal con estudiantes. Tampoco se realizó prueba visual en un navegador real.
