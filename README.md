# Portal 2027

Portal escolar del C.E.B.G. El Jiral, en HTML, CSS y JavaScript plano (sin framework). Usa Supabase para autenticación, base de datos (con RLS), archivos privados y Edge Functions (Deno). Se publica en GitHub Pages: https://profesorsamuel.github.io/portal2027/

Toda la documentación detallada está en [`docs/`](docs/INDICE.md). Los documentos de `docs/` son una **bitácora histórica**: sus avisos, cantidades de migraciones y pendientes describen el momento en que se escribieron. Para instalar, mandan las instrucciones de este README.

## Requisitos

- Un proyecto Supabase con acceso a SQL Editor, Authentication, Storage y Edge Functions.
- Alojamiento estático que conserve las carpetas (GitHub Pages desde la raíz del repositorio).
- Navegador con internet: las bibliotecas externas se cargan desde CDN con integridad SRI.
- Para desplegar funciones por terminal: Supabase CLI autenticada y vinculada al proyecto (`supabase link`).
- Para pruebas: Node.js 20 o superior.
- Para respaldos: Bash, PostgreSQL (`pg_dump` y `pg_restore`) y Node.js.

## Orden de instalación de la base de datos

Aplique en el SQL Editor, **uno por uno y en orden ascendente**, los archivos de `supabase/migrations/` (de `0001` a `0049`). Verifique que cada uno termine sin errores antes de seguir; si uno falla, no continúe.

Los números **no son consecutivos a propósito**: `0003`, `0034`, `0035` y `0043` viven en `supabase/especificas/` y no forman parte del orden general. No ejecute esa carpeta en lote.

| Número | Qué hacer |
| --- | --- |
| 0003 (`especificas/`) | Datos ficticios de prueba. Opcional; no lo use en producción. |
| 0004 | Administrador inicial. Cree primero la cuenta en Authentication y sustituya `CORREO_DEL_ADMINISTRADOR` en el SQL. Compruebe que la consulta final devuelve ese administrador. |
| 0034 (`especificas/`) | Reparación del horario existente. Revise si aplica a su base. |
| 0035 (`especificas/`) | Asignaciones específicas de Samuel 2027. Opcional; depende de sus grupos y cuenta. |
| 0043 (`especificas/`) | Restauración puntual de la clase 3 de 9B. Solo para ese caso. |
| 0044 | Relaciona materiales y tareas con cada clase. Necesaria para la pantalla de recursos por clase. |
| 0045 y 0046 | Entregas múltiples y límites de archivos. Instálelas antes de publicar los módulos que las usan. |
| 0047 | Estado de cambio obligatorio de clave. Debe estar instalada antes que 0048. |
| 0048 | Restricciones sobre tablas existentes y acceso privado a Storage. Falla a propósito si falta 0047. |
| 0049 | Tabla de control de intentos, de uso exclusivo de las Edge Functions (`service_role`). |
| 0050 | Adjuntos de tareas (PDF, imágenes y enlaces). Instálela después de 0049 y antes de publicar la pantalla de clases con adjuntos. |
| 0051 | Orden fijo de las tareas (Tarea 1, Tarea 2…) por orden de creación. Instálela después de 0050 y antes de publicar los módulos web. |

`supabase/migrations/PRUEBA_MANUAL.sql` **no es una migración**: es una prueba para ejecutar a mano **después de 0049**, que termina con `rollback`. No la incluya al aplicar las migraciones en lote.

**En una base que ya está en uso**, no vuelva a ejecutar migraciones a ciegas. Revise primero cuáles están aplicadas, en especial 0047, 0048 y 0049. Este repositorio no puede confirmar el estado de su proyecto real (ver [VERIFICACION_SUPABASE_REAL.md](docs/VERIFICACION_SUPABASE_REAL.md)).

## Autenticación y configuración de la web

1. Configure acceso por correo y contraseña y **desactive el registro libre**; la administración crea las cuentas.
2. Configure Site URL y Redirect URLs con `https://profesorsamuel.github.io/portal2027/`.
3. Escriba la URL del proyecto y la clave pública (`sb_publishable_…`) en `js/core/portal2027-conexion.js`. Esa clave es pública por diseño. **Nunca** ponga claves secretas ni `service_role` en la interfaz ni en el repositorio.
4. Publique conservando las rutas. `manifest.webmanifest` va en la raíz, junto a `index.html`.
5. Versión de caché: todas las páginas deben usar la misma `?v=AAAAMMDD`. Para cambiarla en todo el portal: `node scripts/portal2027-version.mjs AAAAMMDD`. Una prueba falla si quedan versiones mezcladas.
6. Tras publicar, recargue con Ctrl+F5.

## Edge Functions

Hay 5 funciones en `supabase/functions/` (con código compartido en `_shared/`). Despliéguelas **sin** `--no-verify-jwt`, para que se aplique `supabase/config.toml`:

```bash
supabase functions deploy portal2027-buscar-estudiante
supabase functions deploy portal2027-cambiar-clave
supabase functions deploy portal2027-crear-accesos
supabase functions deploy portal2027-importar-profesores
supabase functions deploy portal2027-invitar-estudiante
```

Verificación de JWT según `config.toml`:

| Función | `verify_jwt` | Motivo |
| --- | --- | --- |
| `portal2027-buscar-estudiante` | `false` | La llama la pantalla de entrada antes de tener sesión. Se protege con límite de intentos. |
| Las otras 4 | `true` | Exigen sesión válida. |

El indicador `--no-verify-jwt` de la CLI **sustituye** lo que diga `config.toml`; por eso no debe usarse con estas funciones. Después de desplegar, confirme en el panel de Supabase (Edge Functions → cada función) que el ajuste coincide con la tabla. Si despliega desde el editor del panel, configúrelo igual a mano.

### Secretos (solo nombres; nunca escriba valores en el repositorio)

Se definen con `supabase secrets set NOMBRE=valor` o en el panel (Edge Functions → Secrets).

| Nombre | Obligatorio | Uso |
| --- | --- | --- |
| `PORTAL2027_INTENTOS_SECRETO` | Sí | 64 caracteres hexadecimales para el control de intentos (`openssl rand -hex 32` genera uno). **Si falta o no tiene ese formato, `portal2027-buscar-estudiante` y `portal2027-cambiar-clave` responden 503** y el acceso de estudiantes deja de funcionar. |
| `PORTAL2027_ORIGEN` | No | Único origen permitido para llamadas desde el navegador (CORS): `https://...` sin ruta ni barra final. Si falta, se usa `https://profesorsamuel.github.io`. Un valor no válido impide que las funciones arranquen. Cámbielo solo si cambia el alojamiento. |
| `PORTAL2027_CLAVES_TEMPORALES` | No | **Debe permanecer sin definir.** Solo el valor exacto `true` activa las claves temporales, y no debe activarse hasta cerrar las pruebas de [criterios de activación](docs/portal2027-criterios-activacion-claves.md). |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las proporciona Supabase automáticamente a sus funciones; no las copie a ningún archivo.

## Respaldo

Ejecute desde su equipo, con las credenciales en variables de entorno (nunca en archivos del repositorio):

```bash
export SUPABASE_DB_URL='postgresql://...'
bash scripts/portal2027-respaldo-db.sh /ruta/privada/respaldos diaria

export SUPABASE_URL='https://su-proyecto.supabase.co'
export SUPABASE_SERVICE_KEY='clave-solo-en-su-equipo'
node scripts/portal2027-respaldo-storage.mjs /ruta/privada/respaldos
```

La copia de la base no incluye los archivos de Storage; haga ambas. Guárdelas fuera del repositorio (`.gitignore` ya excluye `respaldos/` y `*.dump`). Haga una copia antes de importar datos o cerrar un trimestre, y registre el resultado real en Administración → Respaldos. Ensaye la restauración en un proyecto de prueba: [portal2027-respaldos-y-restauracion.md](docs/portal2027-respaldos-y-restauracion.md).

## Pruebas

```bash
npm ci
npx playwright install chromium
npm test
```

En Linux, si Chromium pide bibliotecas del sistema: `npx playwright install-deps chromium` (requiere permisos de administrador). En GitHub, `.github/workflows/pruebas.yml` corre lo mismo en cada `push` y `pull_request`.

`npm test` ejecuta las pruebas de `tests/*.test.cjs`, comprueba la sintaxis de todos los JavaScript y las referencias locales de los HTML, y abre cada página con Chromium a 390 × 844 (falla si hay desbordamiento horizontal). Esa prueba móvil corre con JavaScript desactivado y sin red.

**Lo que las pruebas automáticas no comprueban:** estados con sesión, guardado, permisos, RLS, Edge Functions desplegadas ni que las migraciones estén aplicadas. Para eso, siga [ETAPA_7_PRUEBAS_MANUALES.md](docs/ETAPA_7_PRUEBAS_MANUALES.md) y [VERIFICACION_SUPABASE_REAL.md](docs/VERIFICACION_SUPABASE_REAL.md) en un Supabase de prueba.

## Documentación

- [docs/INDICE.md](docs/INDICE.md): lista de todos los documentos.
- Estructura de archivos: [portal2027-estructura.md](docs/portal2027-estructura.md). Base de datos: [portal2027-base-de-datos.md](docs/portal2027-base-de-datos.md).
- Seguridad pendiente de verificar: [REVISION_SEGURIDAD_0047_0049.md](docs/REVISION_SEGURIDAD_0047_0049.md), [ESTADO_REAL_SEGURIDAD_Y_SIGUIENTES_PASOS.md](docs/ESTADO_REAL_SEGURIDAD_Y_SIGUIENTES_PASOS.md), [REVISION_HTML_Y_CSP.md](docs/historico/REVISION_HTML_Y_CSP.md).

Documentación: [vigente e histórica](docs/INDICE.md). Las etapas anteriores están en `docs/historico/`.
