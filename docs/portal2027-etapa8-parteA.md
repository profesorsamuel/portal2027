# portal2027 — Documentos privados (etapa 8 de la guía), parte A: base, permisos y bucket

Requiere `0001`–`0013` aplicados. Esta parte **no tiene pantallas** (las trae la parte B).

## Qué incluye
- `supabase/migrations/0014_portal2027_documentos.sql` (único archivo nuevo).
- Tablas: `portal2027_tipos_documento`, `portal2027_documentos`, `portal2027_historial_documentos`.
- Bucket privado `portal2027-documentos`: máximo 5 MB; solo PDF, JPG y PNG.
- Funciones: `portal2027_registrar_documento`, `portal2027_revisar_documento`, `portal2027_faltantes_documentos` y funciones auxiliares de permisos.

## Instalación
Supabase → SQL Editor → ejecute `0014_portal2027_documentos.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga. Suba el archivo y esta guía a GitHub.

## Cómo funciona
1. **Tipos**: administración crea los tipos (código, nombre, si es obligatorio, activo). No se inventó ninguno: hasta que los cree no habrá faltantes.
2. **Subir**: el estudiante sube el archivo a `estudiante/año/tipo/archivo` y luego llama a `portal2027_registrar_documento`. La base toma tamaño y tipo del archivo guardado, no de lo que diga el navegador, y comprueba que la ruta corresponda.
3. **Sustituir**: un documento nuevo del mismo tipo reemplaza al vigente, vuelve a «pendiente» y el anterior queda en el historial con su ruta. Los archivos viejos no se borran.
4. **Revisar**: administración o el consejero del grupo aprueban o rechazan; rechazar exige observación. Una revisión sobre una versión vieja se rechaza con «CONFLICTO».
5. **Faltantes**: obligatorio y activo, sin documento o rechazado, del año y grupo pedidos. Los pendientes de revisión no cuentan como faltantes, pero se informan aparte.
6. **Lectura**: sin URL públicas. La parte B abrirá cada archivo con consulta autenticada o enlace temporal.

## Supuestos que debe confirmar
- Ven y revisan documentos **administración y el consejero del grupo**. Los profesores no tienen acceso.
- El estudiante no puede sustituir un documento ya **aprobado**; administración sí.
- El límite es 5 MB y los formatos PDF, JPG y PNG.
- Un archivo subido sin registrarse queda sin referencia en la base (huérfano). No afecta nada; se puede limpiar luego.

## Pruebas (por hacer en base de prueba, con datos ficticios)
- [ ] 0014 se aplica sin errores.
- [ ] Estudiante A sube y registra su documento; estudiante B no puede leerlo ni listar su carpeta.
- [ ] Subir a la carpeta de otro estudiante falla.
- [ ] Un archivo de más de 5 MB o de otro formato se rechaza.
- [ ] Registrar con una ruta ajena o inexistente falla.
- [ ] Sustituir deja el registro anterior en el historial.
- [ ] El estudiante no sustituye un documento aprobado.
- [ ] Rechazar sin observación falla.
- [ ] Faltantes de un grupo solo cuenta el año pedido; un consejero de otro grupo recibe «No tiene permiso».
- [ ] Un profesor no ve documentos.

Verificado aquí solo la **sintaxis** del SQL (no se ejecutó contra Supabase).
