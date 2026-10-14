# portal2027 — Documentos privados (etapa 8 de la guía), parte B: pantallas

Requiere `0001`–`0013` y `0014` aplicados. **Importante:** el archivo `0014_portal2027_documentos.sql` no venía en el ZIP recibido; este paquete trae una versión **reconstruida desde `portal2027-etapa8-parteA.md`**. Si usted ya aplicó una 0014 propia en Supabase, **no ejecute esta**: envíela y se ajusta la interfaz a sus nombres.

## Qué incluye
- `supabase/migrations/0014_portal2027_documentos.sql` (reconstruida; tablas, funciones, políticas y bucket de la parte A).
- `js/modulos/portal2027-documentos.js` y `assets/css/portal2027-documentos.css` (nuevos).
- Cambiados: `js/modulos/portal2027-panel.js` y `pages/portal2027-admin.html`, `-consejero.html`, `-estudiante.html`.
- Docs: `portal2027-estructura.md` y `portal2027-base-de-datos.md` actualizados.
- `supabase/migrations/0012_portal2027_cierre_trimestral.sql`: solo cambia de carpeta (estaba en `migrations/` de la raíz). **Borre la carpeta `migrations/` de la raíz** del repositorio.

## Instalación
1. Supabase → SQL Editor → ejecute `0014_portal2027_documentos.sql` (debe terminar en «Success»). En Storage debe aparecer `portal2027-documentos`, **privado**.
2. Suba los archivos a GitHub conservando carpetas; espere GitHub Pages y recargue con Ctrl+F5.
3. Entre como administración → «Documentos de estudiantes» → cree los tipos (ej. `cedula` · «Cédula del estudiante»). Hasta entonces no hay nada que subir ni faltantes.

## Cómo se usa
- **Estudiante** («Mis documentos»): una tarjeta por tipo activo con su estado (Sin subir, En revisión, Aprobado, Rechazado), el motivo si fue rechazado, «Abrir mi archivo» y subir/sustituir. Aprobado ya no se puede sustituir.
- **Administración**: tipos (crear, obligatorio/opcional, activar/desactivar; no se borran), y por grupo: tabla de documentos con filtro (por defecto «Por revisar»), observación, Abrir, Aprobar y Rechazar, más los faltantes.
- **Consejero**: lo mismo que administración, solo para sus grupos y sin tipos.
- Rechazar exige observación. Si el estudiante sustituyó el archivo mientras usted lo revisaba, aparece «Conflicto… Recargar».

## Supuestos que debe confirmar
- Revisan administración y el consejero del grupo; los profesores no ven documentos.
- Faltantes: tipos obligatorios y activos sin documento o con documento rechazado; **incluye todas las matrículas del grupo, sea cual sea su estado** (la matrícula tiene estado de texto libre). Los pendientes se informan aparte.
- 5 MB; PDF, JPG y PNG. Archivos subidos y no registrados quedan huérfanos y no afectan nada.
- Los tipos no se borran (solo se desactivan) para no perder el historial.
- La interfaz del estudiante usa su matrícula del año más reciente.

## Pruebas
Hechas aquí en un Postgres local con Auth y Storage simulados (0001–0014 aplicadas en orden), con datos ficticios: A no lee ni sube a la carpeta de B; consejero de otro grupo y profesor no ven ni revisan; registrar dos veces la misma ruta no duplica; ruta ajena, archivo inexistente, más de 5 MB y tipo no permitido se rechazan; rechazar sin observación falla; revisar con versión vieja da CONFLICTO; sustituir deja la ruta anterior en el historial; el estudiante no sustituye un aprobado (ni por función ni por Storage) y administración sí; faltantes por grupo y año con permisos; el historial no se puede modificar. Las pantallas se probaron con un navegador simulado y datos falsos (render, subida, revisión y validaciones).
**Sin probar contra Supabase real**: en especial que la subida real guarda `size` y `mimetype` en los metadatos (la base depende de ellos).
- [ ] 0014 sin errores; bucket privado.
- [ ] Estudiante A sube; B no lo ve; carpeta ajena falla.
- [ ] Archivo de más de 5 MB o de otro formato muestra error y no se registra.
- [ ] Rechazar → el estudiante ve el motivo y puede sustituir; aprobar → ya no.
- [ ] Faltantes del grupo coinciden con lo subido; consejero de otro grupo recibe «No tiene permiso».
- [ ] Cortar la red al subir no muestra «Documento recibido».
