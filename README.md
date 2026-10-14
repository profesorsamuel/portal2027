# Portal 2027

Portal escolar en HTML, CSS y JavaScript, con Supabase para autenticación, base de datos y archivos privados. Publicación: https://profesorsamuel.github.io/portal2027/.

## Cambios de las etapas 1 a 5 (14 de octubre de 2026)

- Imágenes: compresión compartida y tandas de hasta 15 fotos; entregas con múltiples adjuntos.
- Archivos: configuración común en `js/core/portal2027-archivos.js`; límites de 2 MB para foto, 5 MB para documentos administrativos y 15 MB para materiales, entregas y planificación. Instalar 0045 y 0046 antes de publicar los módulos de esas etapas.
- Horario: todos los datos se muestran con nodos de texto y atributos del DOM; el módulo ya no usa innerHTML.
- Excel: cargador compartido `js/core/portal2027-excel.js`, SheetJS 0.20.3 del CDN oficial con SRI SHA-384, y copia local de los mismos bytes en `js/vendor/` con licencia Apache 2.0. Administración espera la carga; libreta la solicita al importar. Si falla CDN/SRI o transcurren 10 segundos, se intenta la copia local, también con SRI. No se usa la antigua carga dinámica 0.18.5 sin integridad.
- La libreta conserva sus funciones y cálculos. La división gradual está descrita en [ETAPA_5_DIVISION_LIBRETA.md](docs/ETAPA_5_DIVISION_LIBRETA.md). Ya se separaron la lectura/normalización ([paso 1](docs/DIVISION_LIBRETA_PASO_1.md)) y el planificador de importación ([paso 2](docs/DIVISION_LIBRETA_PASO_2.md)). También se separó la interfaz de revisión ([paso 3](docs/DIVISION_LIBRETA_PASO_3.md)); el guardado permanece en la libreta. La navegación de la tabla principal también está separada ([paso 4](docs/DIVISION_LIBRETA_PASO_4.md)).

La etapa 5 no añade SQL para ejecutar. Para instalar el ZIP incremental, ver [ETAPA_5_INSTALACION_Y_PRUEBAS.md](docs/ETAPA_5_INSTALACION_Y_PRUEBAS.md). Es necesario quitar las cuatro copias antiguas de `supabase/migrations/` después de verificar sus copias nuevas; un ZIP por sí solo no elimina archivos de GitHub.

Prueba del teclado: `node tests/portal2027-libreta-teclado.test.cjs`.

Pruebas de importación: `node tests/portal2027-libreta-importacion.test.cjs` y `node tests/portal2027-libreta-interfaz.test.cjs`.

Pruebas locales específicas sin dependencias: `node tests/portal2027-seguridad-horario.test.cjs`, `node tests/portal2027-excel.test.cjs`, `node tests/portal2027-archivos.test.cjs` y `node tests/portal2027-entregas.test.cjs`. No sustituyen la validación de Supabase ni la revisión visual del sitio publicado.

## Requisitos

- Un proyecto Supabase y acceso a SQL Editor, Authentication, Storage y Edge Functions.
- Alojamiento estático que conserve las carpetas; el proyecto utiliza GitHub Pages desde la raíz.
- Navegador con conexión a internet: las bibliotecas externas se cargan desde CDN con integridad SRI.
- Para despliegue por terminal: Supabase CLI autenticada y vinculada al proyecto correspondiente.
- Para respaldos: Bash, PostgreSQL (`pg_dump` y `pg_restore`) y Node.js 18 o superior.

## Instalación de la base de datos

La carpeta `supabase/migrations/` contiene 42 archivos de estructura y funciones numerados hasta 0046. Los scripts específicos 0003, 0034, 0035 y 0043 están en `supabase/especificas/` y quedan fuera de las migraciones generales. En una base nueva, aplique las migraciones generales por número ascendente, uno por uno, sin exigir números consecutivos. Verifique el resultado antes de continuar. En una base existente, identifique primero los que ya se aplicaron; no vuelva a ejecutar indiscriminadamente los scripts de datos y reparación.

Casos que requieren atención:

| Número | Uso |
| --- | --- |
| 0003 | Datos ficticios para pruebas; opcional para una instalación sin datos de demostración. |
| 0004 | Administrador inicial: primero cree la cuenta en Authentication y sustituya `CORREO_DEL_ADMINISTRADOR` en el SQL. Compruebe que la consulta final devuelve el administrador. |
| 0034 | Reparación del horario existente; revise su pertinencia para la base que instala. |
| 0035 | Asignaciones específicas de Samuel 2027; opcional y dependiente de sus grupos y cuenta. |
| 0043 | Restauración específica de la clase 3 de 9B; opcional, solo para el caso que corrige. |
| 0044 | Relaciona materiales y tareas con cada clase; necesaria para la pantalla de recursos por clase incorporada a este proyecto. |

El traslado conserva los SQL originales sin cambios. No ejecute `supabase/especificas/` en lote: revise cada caso y sus requisitos. Si los cuatro archivos todavía están en `supabase/migrations/` en su repositorio, elimine solo esas copias antiguas después de subirlos a `supabase/especificas/`. Moverlos no ejecuta SQL ni cambia la base ya instalada. La ejecución integral en una base de prueba y las pruebas de permisos siguen pendientes.

Orden de archivos disponibles:

- `supabase/migrations/0001_portal2027_tablas.sql`
- `supabase/migrations/0002_portal2027_permisos.sql`
- `supabase/migrations/0004_portal2027_admin_inicial.sql`
- `supabase/migrations/0005_portal2027_estudiantes.sql`
- `supabase/migrations/0006_portal2027_libreta.sql`
- `supabase/migrations/0007_portal2027_asistencia.sql`
- `supabase/migrations/0008_portal2027_configuracion.sql`
- `supabase/migrations/0009_portal2027_consejeria.sql`
- `supabase/migrations/0010_portal2027_estudiante_academico.sql`
- `supabase/migrations/0011_portal2027_clases_tareas.sql`
- `supabase/migrations/0012_portal2027_cierre_trimestral.sql`
- `supabase/migrations/0013_portal2027_consejeria_notas.sql`
- `supabase/migrations/0014_portal2027_documentos.sql`
- `supabase/migrations/0015_portal2027_respaldos_recuperacion.sql`
- `supabase/migrations/0016_portal2027_ejercicios_virtuales.sql`
- `supabase/migrations/0017_portal2027_sexo_estudiante.sql`
- `supabase/migrations/0018_portal2027_nombre_completo.sql`
- `supabase/migrations/0019_portal2027_profesores_telefono.sql`
- `supabase/migrations/0020_portal2027_contacto_estudiante.sql`
- `supabase/migrations/0021_portal2027_tipo_nota.sql`
- `supabase/migrations/0022_portal2027_apreciacion_semanal.sql`
- `supabase/migrations/0023_portal2027_consolidacion_semanal.sql`
- `supabase/migrations/0024_portal2027_comportamiento.sql`
- `supabase/migrations/0025_portal2027_correcciones_semanales.sql`
- `supabase/migrations/0026_portal2027_columna_registro_y_cierre.sql`
- `supabase/migrations/0027_portal2027_apreciacion_automatica.sql`
- `supabase/migrations/0028_portal2027_sincronizar_apreciaciones.sql`
- `supabase/migrations/0029_portal2027_plan_clases.sql`
- `supabase/migrations/0030_portal2027_plan_quitar_a_papelera.sql`
- `supabase/migrations/0031_portal2027_plan_grupos_hermanos.sql`
- `supabase/migrations/0032_portal2027_horario.sql`
- `supabase/migrations/0033_portal2027_calendario.sql`
- `supabase/migrations/0036_portal2027_evitar_personal_duplicado.sql`
- `supabase/migrations/0037_portal2027_guardar_registro_semana_produccion.sql`
- `supabase/migrations/0038_portal2027_consolidacion_sin_ambiguedad.sql`
- `supabase/migrations/0039_portal2027_plan_pdf.sql`
- `supabase/migrations/0040_portal2027_datos_boletin.sql`
- `supabase/migrations/0041_portal2027_proteger_semanas_plan.sql`
- `supabase/migrations/0042_portal2027_asegurar_semanas_plan.sql`
- `supabase/migrations/0044_portal2027_recursos_por_clase.sql`
- `supabase/migrations/0045_portal2027_entregas_multiples.sql`
- `supabase/migrations/0046_portal2027_limites_archivos.sql`

Scripts específicos, fuera del orden general:

- `supabase/especificas/0003_portal2027_datos_ficticios.sql`
- `supabase/especificas/0034_portal2027_corregir_horario_existente.sql`
- `supabase/especificas/0035_portal2027_asignaciones_samuel_2027.sql`
- `supabase/especificas/0043_portal2027_restaurar_clase3_9B.sql`

## Autenticación y configuración de la web

1. Configure el acceso por correo y contraseña y desactive el registro libre de usuarios; la administración crea las cuentas.
2. Configure Site URL y Redirect URLs para `https://profesorsamuel.github.io/portal2027/`.
3. Configure la URL del proyecto y la clave pública/publicable en `js/core/portal2027-conexion.js`. Nunca coloque claves secretas o `service_role` en la interfaz o el repositorio.
4. Publique las carpetas y archivos conservando rutas. `manifest.webmanifest` va en la raíz, junto a `index.html`.
5. Recargue con Ctrl+F5 tras publicar. Los scripts modificados en estas etapas usan `?v=20261014`, con `&etapa=N` cuando se publican varias versiones el mismo día. Actualice todas las páginas que cargan un módulo modificado; las referencias de otros archivos conservan su versión previa.

## Funciones de servidor que se deben desplegar

Las cuatro funciones están en `supabase/functions/`. Desde una terminal vinculada al proyecto:

```bash
supabase functions deploy portal2027-buscar-estudiante --no-verify-jwt
supabase functions deploy portal2027-crear-accesos --no-verify-jwt
supabase functions deploy portal2027-importar-profesores --no-verify-jwt
supabase functions deploy portal2027-invitar-estudiante --no-verify-jwt
```

La búsqueda de estudiantes es pública. Las otras funciones comprueban la identidad y el rol administrador dentro del servidor; desactivar la verificación externa no sustituye esa validación. Si utiliza el editor del panel, configure Verify JWT de forma equivalente. Algunas guías históricas indicaban una configuración diferente para invitaciones; para esta entrega use las instrucciones de esta sección.

En `portal2027-buscar-estudiante/index.ts`, `ALLOWED_ORIGIN` contiene `https://profesorsamuel.github.io`: si cambia el alojamiento, use su origen final sin rutas y vuelva a desplegar la función. Las credenciales de servidor permanecen en el entorno de Supabase.

## Hacer y comprobar un respaldo

Ejecute los scripts desde la raíz del proyecto en su computadora, con las credenciales suministradas mediante variables de entorno. Sustituya los ejemplos por los datos del proyecto:

```bash
export SUPABASE_DB_URL='postgresql://...'
bash scripts/portal2027-respaldo-db.sh /ruta/privada/respaldos diaria

export SUPABASE_URL='https://su-proyecto.supabase.co'
export SUPABASE_SERVICE_KEY='clave-solo-en-su-equipo'
node scripts/portal2027-respaldo-storage.mjs /ruta/privada/respaldos
```

La copia de la base genera `public.dump`, `auth-datos.dump` y huellas de verificación. La copia de Storage descarga los archivos por bucket y su resumen. Conserve ambos conjuntos fuera del repositorio y del sitio público; una copia de la base por sí sola no contiene los archivos descargados de Storage.

Compruebe el resultado y guarde una copia externa. En Administración → Respaldos anote su ubicación y el resultado real (exitoso, parcial o fallido). El formulario registra la copia realizada; no la crea. Haga una copia antes de importar datos o cerrar un trimestre.

Ensaye la restauración en otro proyecto de prueba: prepare el esquema correspondiente, restaure cuentas y datos con `pg_restore`, reponga los archivos en sus buckets privados y compare estudiantes, notas, historial y cantidades de archivos. La guía histórica de respaldos al final incluye los comandos y criterios de comprobación; su referencia a 0015 corresponde a una versión anterior del proyecto.

## Verificación y mantenimiento

La etapa 6 verifica sintaxis JavaScript, referencias HTML y que el formato de `horario.js` conserva el mismo árbol de código. La etapa 7 añade las pruebas automáticas descritas a continuación. La instalación completa en una base vacía se comprueba manualmente. Esta entrega no ejecuta migraciones ni despliega funciones.

## Pruebas automáticas (etapa 7)

Desde la raíz, con Node.js 20 o superior:

```bash
npm ci
npx playwright install chromium
npm test
```

En Linux, si Chromium requiere bibliotecas del sistema, instálelas con `npx playwright install-deps chromium` en un equipo donde tenga permisos de administración.

`npm test` comprueba la sintaxis de todos los JavaScript (incluidos `.mjs` y `.cjs`, excluyendo dependencias), todas las referencias `src`/`href` locales de los HTML y abre cada HTML con Chromium a 390 × 844. Falla si `document.documentElement.scrollWidth > window.innerWidth`.

La prueba móvil utiliza JavaScript desactivado y bloquea solicitudes externas. Así comprueba HTML/CSS sin consultar Supabase ni permitir que la falta de sesión redirija las páginas privadas al inicio. **No comprueba tablas generadas, estados autenticados, guardado ni permisos.** Esos flujos requieren las pruebas manuales de [docs/ETAPA_7_PRUEBAS_MANUALES.md](docs/ETAPA_7_PRUEBAS_MANUALES.md). No se omite la comprobación móvil si falta Chromium: el comando falla y debe instalarlo.

## Documentación histórica reunida

Los documentos siguientes se conservan íntegros como referencia de cada entrega anterior. Sus avisos, versiones, cantidades de migraciones y tareas pendientes describen aquel momento; no son instrucciones adicionales para ejecutar todas las etapas de nuevo. Las instrucciones principales de este README tienen prioridad para instalar esta entrega. Los originales de `docs/` permanecen sin cambios.


---

## Documento original: COMO_CARGAR_HORARIO_2027.md

# Horario editable 2027

Suba las carpetas `data`, `pages` y `js` a la raíz de GitHub respetando las rutas. No cargue el JSON en Supabase SQL Editor.

En Horario y calendario pulse **Cargar horario de Samuel 2027 (editable)**. El portal leerá `data/horarios/horario-samuel-2027.json`, buscará las asignaciones reales en Supabase y rellenará el cuadro JSON. Si faltan 9A Naturales, 8A Naturales, 8A Informática o 8B Informática, debe crearlas primero en Administración; de lo contrario la importación se rechazará sin reemplazar el horario.

Revise las franjas y pulse **Validar y reemplazar horario**. Después podrá modificar cada franja con **Editar**, **Guardar franja**, **Nueva franja** y **Eliminar**. No hace falta editar archivos para cambiar un horario ya guardado.

El archivo JSON de plantilla se puede editar en GitHub para cambiar el horario de referencia. Importarlo reemplaza el horario guardado de ese profesor y año, por lo que confirme antes de hacerlo.

---

## Documento original: ETAPAS_2_Y_3_HORARIO.md

# Etapas 2 y 3: horario y calendario

1. Ejecute primero `0032_portal2027_horario.sql` (etapa 1).
2. Ejecute `0033_portal2027_calendario.sql` en Supabase SQL Editor (etapa 3).
3. Suba los archivos de este ZIP a GitHub respetando carpetas y nombres.
4. Entre como profesor y abra **Horario y calendario** desde Mis grupos y materias.
5. Seleccione año y profesor. Importe el JSON preparado desde la foto o agregue franjas manualmente. Revise antes de reemplazar: la importación sustituye todo el horario.
6. Seleccione trimestre (sus fechas se configuran en Administración), registre feriados y días sin clases y elija cómo contar bloques dobles.
7. El calendario se recalcula sin crear registros de sesiones. La integración con Asistencia y Planificación corresponde a etapas posteriores.

**Nota:** esta versión no interpreta imágenes JPG ni modifica todavía el módulo de asistencia. La importación acepta JSON. No se ha podido probar contra la base de datos real.

---

## Documento original: INSTALAR_BOLETIN_PDF.md

# Boletín de notas en PDF — Portal2027

Botones **«Descargar boletín en PDF»** e **«Imprimir boletín»** (abre el mismo PDF en otra pestaña) en Seguimiento académico → pestaña **Notas trimestrales**.
Genera una sola página carta vertical, con texto seleccionable y el logo integrado. Solo lee datos: no guarda ni modifica nada.

## Dónde colocar los archivos (respetando carpetas)
| Archivo del ZIP | Destino en el proyecto | Acción |
|---|---|---|
| `js/modulos/portal2027-boletin-pdf.js` | `js/modulos/` | archivo NUEVO |
| `js/modulos/portal2027-seguimiento.js` | `js/modulos/` | REEMPLAZA el existente |
| `pages/portal2027-seguimiento.html` | `pages/` | REEMPLAZA el existente |
| `assets/img/meduca-logo.png` | `assets/img/` (carpeta nueva) | logo real de MEDUCA |
| `supabase/migrations/0040_portal2027_datos_boletin.sql` | `supabase/migrations/` | archivo NUEVO (y ejecutar, ver abajo) |

## SQL
Sí hay que ejecutar **un** script: `0040_portal2027_datos_boletin.sql` (Supabase > SQL Editor > pegar > Run).
- Solo crea una función de lectura; no crea tablas, no cambia ni borra datos. Es seguro repetirlo.
- Es necesario para que salga el **profesor consejero**: la tabla de consejeros solo la ve la administración, y esta función entrega únicamente los nombres a quien puede ver esa asignación.
- Si no se ejecuta, el PDF igual se descarga (con la firma del profesor), pero la línea del consejero queda en blanco para completar a mano.

## Logo
El ZIP ya incluye el logo real de MEDUCA (recortado) en `assets/img/meduca-logo.png`.
Reemplace `assets/img/meduca-logo.png` por el logo real (mismo nombre, PNG o JPG renombrado no; use PNG). Se coloca arriba a la derecha conservando su proporción, sin deformarlo. Lo ideal es un PNG de al menos 600 px de ancho.

## Reglas aplicadas
- Estudiantes: todos los de la asignación, en orden alfabético (el mismo orden de la pantalla).
- Notas con 1 decimal; el cálculo usa los valores originales del motor único (`portal2027.evaluacion`).
- Reprobada = valor **original** menor que 3.0 (el mínimo `MIN` ya definido en `portal2027-seguimiento.js`): rojo con fondo rosado. Por eso una nota 2.96 se muestra «3.0» pero sale en rojo.
- Sin datos = celda en blanco (nunca 0). Ausencias/tardanzas en 0 también quedan en blanco; la ausencia justificada no cuenta.
- Nota final anual: promedio de los trimestres **solo si todos tienen nota**; si falta alguno, queda en blanco.
- Totales de A y T: suma por separado de los trimestres.
- Archivo: `Boletin_<MATERIA>_<GRUPO>_<AÑO>.pdf`.

## Ajuste a una página
Márgenes, anchos, alto de fila y letra se calculan según la cantidad de estudiantes (probado de 0 a 80). Hasta ~45 estudiantes la letra queda en ~7 pt o más.

## Dependencia
Usa jsPDF 2.5.2 desde jsDelivr (con verificación de integridad), igual que el proyecto ya usa Supabase desde CDN. Requiere internet al abrir la página.

---

## Documento original: INSTALAR_HORARIO_SAMUEL_2027.md

# Horario Samuel Ortega 2027 — instalación

1. En Supabase SQL Editor ejecute `supabase/especificas/0035_portal2027_asignaciones_samuel_2027.sql`. Deben existir los grupos 9A, 8A y 8B del año 2027. El SQL no elimina notas ni asignaciones existentes. Compruebe que aparecen las seis asignaciones del profesor.
2. En GitHub suba las carpetas `js/modulos/`, `data/horarios/` y `supabase/migrations/` conservando las rutas. El SQL no se ejecuta por subirlo a GitHub: hay que ejecutarlo en Supabase.
3. Actualice la página del horario con Ctrl+Shift+R, elija 2027 y Samuel Ortega, y pulse **Cargar horario de Samuel 2027 (editable)**. También puede arrastrar el archivo JSON.
4. Revise las 30 franjas y pulse **Validar y reemplazar horario**. El sistema identifica las asignaciones por grupo y materia; si falta alguna, impedirá guardar.
5. Para modificar después, use **Editar**, **Eliminar**, **Nueva franja** y **Guardar franja**. El botón de importar reemplaza el horario completo: úselo solo cuando quiera sustituirlo.

Nota: este ZIP no ejecuta cambios en su Supabase; debe realizar el paso 1. La prueba real de escritura queda pendiente hasta hacerlo.

---

## Documento original: INSTALAR_PDF_POR_CLASE.md

# Planificaciones PDF por clase — Portal2027

1. Abra Supabase > SQL Editor y ejecute `supabase/migrations/0039_portal2027_plan_pdf.sql` una sola vez.
2. Suba los archivos modificados a GitHub respetando las carpetas.
3. Recargue la pantalla Planificación (Ctrl+F5). En «Clases del trimestre» aparece la columna «Planificación PDF».
4. Cada clase permite subir un PDF de hasta 15 MB, verlo, reemplazarlo o eliminarlo.
5. Los archivos se guardan de forma privada en Supabase Storage; no son públicos.

Nota: cada clase tiene un PDF propio, sea de una o dos semanas. Al sincronizar clases entre grupos, las clases hermanas tienen identificadores distintos y sus PDFs no se comparten automáticamente en esta versión. Tampoco hay exportación ZIP de PDFs ni indicador de PDF en los cuadros del calendario todavía.

---

## Documento original: LEEME-horario-ejemplo.txt

COMO USAR EL ARCHIVO horario-ejemplo-otro-anio.json
===================================================

Este archivo es un EJEMPLO. Tiene un horario de lunes a viernes con clases,
consejería y recreo. Copie el archivo, cámbiele los datos y súbalo al portal.

CADA LÍNEA { ... } ES UNA FRANJA DEL HORARIO
--------------------------------------------
  "dia"      : número del día. 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
  "inicio"   : hora de inicio en formato de 24 horas, con dos dígitos. Ej.: "07:30", "13:05"
  "fin"      : hora de fin, mismo formato. Debe ser mayor que "inicio".
  "tipo"     : uno de estos cuatro, en minúsculas y sin tilde:
                 "clase"       -> una clase (pide grupo y materia)
                 "consejeria"  -> hora de consejería
                 "recreo"      -> recreo
                 "otro"        -> cualquier otra cosa (reunión, almuerzo, etc.)
  "grupo"    : solo para clases. Ej.: "9A", "8B"
  "materia"  : solo para clases. Ej.: "Ciencias Naturales" o "Informática"
  "etiqueta" : texto corto que se ve en el horario (máximo 60 letras).
               En las clases se deja vacío: "".

EJEMPLO DE UNA CLASE:
  {
    "dia": 1,
    "inicio": "12:55",
    "fin": "13:30",
    "tipo": "clase",
    "grupo": "9C",
    "materia": "Ciencias Naturales",
    "etiqueta": ""
  }

EJEMPLO DE UN RECREO:
  {
    "dia": 1,
    "inicio": "14:40",
    "fin": "15:00",
    "tipo": "recreo",
    "etiqueta": "Recreo"
  }

REGLAS IMPORTANTES
------------------
1. Todas las franjas van dentro de [ ] y cada una termina con coma, menos la última.
2. Use comillas rectas " (no comillas curvas “ ”). Si edita en Word, se dañan:
   use el Bloc de notas o el editor de GitHub.
3. Las franjas de un mismo día no se pueden superponer.
4. Máximo 80 franjas.
5. Las materias que reconoce la carga automática son SOLO "Ciencias Naturales"
   e "Informática". Si da otra materia, el portal la tomará como Ciencias Naturales
   por error. Para otras materias, cree esas clases con el botón "Agregar clase"
   del portal, o pídale a Claude que ajuste el programa.
6. Cada grupo y materia que use debe estar creado en Administración como
   "Profesores por grupo" para el AÑO que va a cargar (por ejemplo 2028). Si no,
   el portal avisa "faltan asignaciones" y no guarda nada.

PASOS PARA SUBIRLO AL PORTAL
----------------------------
1. Copie este archivo y póngale otro nombre, por ejemplo horario-2028.json.
2. Ábralo con el Bloc de notas, cambie los días, horas, grupos y materias.
3. En Administración cree el año nuevo, los grupos y las asignaciones del profesor.
4. Entre al portal -> Profesor -> Horario.
5. Arriba elija el AÑO correcto en el selector.
6. Pulse "Más opciones" -> "Importar y configurar".
7. Arrastre el archivo .json a la zona de carga (o púlsela y elíjalo).
8. Revise las franjas que aparecen. Si el portal avisa de asignaciones faltantes, NO guarde.
9. Pulse "Validar y reemplazar horario".

OJO: importar REEMPLAZA todo el horario guardado de ese profesor para ese año.
Después puede ajustar cada franja con "Editar" o "Eliminar", sin tocar el archivo.

---

## Documento original: LEER-ANTES-DE-INSTALAR.md

# Portal2027 — Etapa 2 (parcial)

Se incluye el SQL 0023 para redirigir la consolidación de ejercicios virtuales a un registro semanal.

**NO EJECUTAR TODAVÍA EN SUPABASE:** la migración 0022 entregada previamente era un borrador y aún no se ha validado.

El SQL 0023 preserva la validación de configuración `sin_definir`, permisos y cierre de trimestre; solo acepta columnas semanales. Mantiene una entrada por periodo y matrícula usando su identificador en la descripción.

Pendiente antes de producción: completar 0022, comportamiento diario, nota manual, lectura estudiantil, interfaz de desglose, pruebas de integración.

---

## Documento original: LEER_PRIMERO.md

# Etapa 3 — comportamiento diario (solo base de datos)

Este paquete incorpora una migración SQL nueva, sin reemplazar las migraciones 0022/0023 anteriores.

**No ejecutar en producción todavía:** 0022 y 0023 siguen siendo borradores sin integración completa. La migración 0024 debe revisarse junto a ellas antes de instalar.

La función `portal2027_guardar_comportamiento(sesion, matricula, estado, version)` admite `bien`, `mal` o NULL. Usa permisos, trimestre cerrado, bloqueo de sesión, control de versión e historial inmutable. Las tablas solo permiten SELECT al docente autorizado.

Pendiente: agregar selector Bien/Mal en asistencia.js, botones Traer asistencia/comportamiento en libreta.js, sincronización semanal, corrección manual y pruebas integrales.

---

## Documento original: PROMPT_PLANIFICACION_MEDUCA_QUINCENAL_2027.md

# Plantilla reutilizable — secuencia didáctica MEDUCA

DATOS QUE YO TE DOY:
TEMA: [escribe aquí]
QUINCENA: del [día] al [día] de [mes] [año]
TRIMESTRE: [I / II / III]
INDICACIONES ESPECIALES: [recursos, laboratorio, feriados, días sin clase, etc.]

Actúa como asesor curricular y planificador docente experto en MEDUCA (Panamá), especialista en Ciencias Naturales de premedia. Elabora mi SECUENCIA DIDÁCTICA QUINCENAL (2 semanas, 10 horas) en Word (.docx), lista para imprimir y firmar, en UNA SOLA PÁGINA horizontal, con logos de MEDUCA, siguiendo mi planificación modelo.

ARCHIVOS QUE DEBO ADJUNTAR: (1) Programa curricular oficial de Ciencias Naturales 7°, 8° y 9° correspondiente al año; fuente única de área, competencias y rasgos, objetivos, contenidos, indicadores y actividades sugeridas; consultar también normas de evaluación auténtica y formatos. (2) Formato MEDUCA de secuencia didáctica semanal o quincenal e instructivo, numerales 1 al 16. (3) Mi planificación modelo para diseño, tablas, tipografía y estilo, sin copiar contenido.

DATOS FIJOS: MINISTERIO DE EDUCACIÓN / DIRECCIÓN REGIONAL DE EDUCACIÓN DE COLÓN. Asignatura: CIENCIAS NATURALES; horas semanales: 5; grado: 9° A B C; docente: SAMUEL ORTEGA. Estos datos son predeterminados y se deben adaptar si la materia o grupos seleccionados en el portal son otros.

PASO 1 — INVESTIGAR EN EL PROGRAMA: Localiza el tema en el grado correcto y extrae fielmente área, competencias con rasgos, objetivos, contenidos conceptuales/procedimentales/actitudinales, indicadores y actividades sugeridas. Solo ajusta un objetivo o indicador si carece de Acción, Objeto, Condición o Finalidad, indicando el ajuste. Distribuye los contenidos entre semana 1 y semana 2. Si el tema no aparece, avisa y propone el contenido curricular más cercano; nunca inventes contenido, competencias o indicadores. Utiliza la competencia y rasgos que correspondan según el programa.

PASO 2 — ESTRUCTURA OFICIAL: Encabezado con logos MEDUCA, MINISTERIO DE EDUCACIÓN / DIRECCIÓN REGIONAL DE EDUCACIÓN DE COLÓN y título SECUENCIA DIDÁCTICA SEMANAL O QUINCENAL DE EDUCACIÓN PREMEDIA. Línea de datos: (1) Asignatura (2) Horas semanales (3) Grado (4) Docente(s) (5) Semana: del __ al __ (6) Trimestre y TEMA. (7) ÁREA. (8) COMPETENCIA(S) y rasgos | (9) OBJETIVO(S) DE APRENDIZAJE. (10) CONTENIDOS: Conceptual, Procedimental, Actitudinal | (11) INDICADOR(ES) DE LOGRO. (12) ACTIVIDADES: Inicio, Desarrollo, Cierre | (13) EVALUACIÓN: (13.1) Evidencias: Actuaciones directas y Entregables | (13.2) Criterios | (13.3) Diagnóstica, Formativa, Sumativa con técnica e instrumento. (14) OBSERVACIONES, con líneas en blanco. (15) Firma del docente | (16) Firma del Coordinador o Subdirector Técnico Docente.

DISEÑO OBLIGATORIO: Una sola página, papel oficio/legal horizontal 35.56 × 21.59 cm (20160 × 12240 twips), márgenes aproximados de 1 cm. Extrae de la página 125 del programa el logo oficial MEDUCA «Gobierno Nacional · Con paso firme | Ministerio de Educación» (imagen 530 × 120 px con máscara de transparencia); colócalo arriba centrado. Si no se puede extraer, reserva espacio e informa. Arial; tablas 7.5–8 pt; títulos de sección 8–9 pt negrita; título principal 10–11 pt; nunca menos de 7 pt. Bordes finos, encabezados negrita, proporciones semejantes al modelo. Convierte el DOCX a PDF para verificar exactamente una página y revisa visualmente que no haya cortes, solapes ni texto ilegible. Si desborda: acorta redacción, reduce letra sin bajar de 7 pt, y reduce interlineado/espacios; nunca suprimas numerales.

REDACCIÓN: En (12) separa actividades S1/S2 en Inicio, Desarrollo y Cierre para 10 horas, con verbos en presente, tercera persona y acciones observables («Identifica», «Explica», «Elabora»). Inicio: saberes previos, lluvia de ideas, observación, preguntas. Desarrollo: lecturas, talleres, investigación, experimentos sencillos, estudios de caso, indagación guiada, ABP cuando corresponda; recursos viables en aula pública. Cierre: productos y sustentaciones que permitan comprobar objetivos. (13.1) Incluye actuaciones directas y entregables, con al menos una evidencia por indicador. (13.2) Asigna criterios específicos por evidencia: puntualidad, presentación, colaboración, contenido, creatividad, expresión oral, redacción, originalidad, claridad y precisión; evita repetir siempre los mismos. (13.3) Incluye SIEMPRE diagnóstica (técnica e instrumento), formativa (técnica e instrumento) y sumativa (técnica e instrumento). Para cada evidencia sumativa identifica instrumento: rúbrica, lista de cotejo o prueba escrita. Emplea evaluación auténtica: tareas reales, proceso y producto, criterios claros conocidos antes de evaluar. Sé breve y científico; viñetas cortas.

CONTROL DE CALIDAD: Tema coherente en todas las secciones; objetivos e indicadores con Acción, Objeto, Condición y Finalidad; actividades S1/S2 en inicio/desarrollo/cierre; tres evaluaciones con técnica e instrumento; criterios por evidencia; evidencia por indicador; ortografía científica; una página horizontal legible con logo y sin cortes.

ENTREGA: Proporciona el .docx final listo para imprimir y firmar. Al final indica en máximo cuatro líneas qué parte y página del programa utilizaste y qué ajustes realizaste. Si falta un dato imprescindible, pregunta una sola vez; de lo contrario usa supuestos razonables y decláralos. No atribuyas al programa información que no esté en los documentos adjuntos.

NOTA DE USO: Este texto es una plantilla para copiar a una IA. La página del portal no genera automáticamente archivos Word ni verifica el programa curricular; para ello se deben adjuntar los documentos fuente en la conversación que produzca la planificación.

---

## Documento original: portal2027-acceso-estudiantes-cedula.md

# Acceso de estudiantes con grado, nombre y cédula

El estudiante entra en `index.html` (pestaña «Soy estudiante»): elige su grado, escribe su nombre y apellido,
y usa su número de cédula como contraseña. Docentes y familias siguen entrando con correo (pestaña «Docente o familia»).

## Cómo funciona
- `portal2027-crear-accesos` (solo administración): por cada estudiante crea una cuenta interna
  (`codigo@estudiantes.portal2027.app`, sin correo real) con la cédula como contraseña, la vincula a la ficha y le da el rol estudiante.
  La cédula **no se guarda en ninguna tabla**; Supabase Auth solo guarda su hash.
- `portal2027-buscar-estudiante` (pública): da la lista de grados y, con grado + nombre y apellido, devuelve el correo interno
  de quien coincide. Nunca recibe ni devuelve la cédula.
- El navegador verifica la cédula directamente con Supabase Auth (`signInWithPassword`).
- "8-123-456", "8123456" y "8 123 456" valen igual (se quitan guiones y espacios y se pasa a mayúsculas). Mínimo 6 letras o números.

## Instalación (una sola vez, en este orden)
0. **Primero la base:** en Supabase > SQL Editor ejecute, en este orden, `0017_portal2027_sexo_estudiante.sql`
   (agrega la columna `sexo`) y `0018_portal2027_nombre_completo.sql` (permite apellidos vacíos y ajusta la importación).
   Si sube la web antes de hacerlo, la pantalla de Estudiantes dará error.
1. Desplegar dos funciones:

```bash
supabase functions deploy portal2027-crear-accesos --no-verify-jwt
supabase functions deploy portal2027-buscar-estudiante --no-verify-jwt
```

Si despliega desde el panel web de Supabase: en **las dos** funciones desactive **Verify JWT**.
- `portal2027-buscar-estudiante` es pública (se usa antes de iniciar sesión).
- `portal2027-crear-accesos` también debe ir sin Verify JWT: con él activado, el navegador es bloqueado por CORS porque la
  consulta previa (OPTIONS) no lleva sesión. No pierde seguridad: la función misma comprueba en el servidor que quien llama
  sea administrador activo (igual que `portal2027-invitar-estudiante`).

## Uso
1. Descargue la plantilla nueva (Administración → Estudiantes → «Descargar plantilla de Excel»). Trae la columna `cedula`
   (formato Texto, para que Excel no quite guiones ni ceros).
2. Llene una fila por estudiante, incluida su cédula, y súbala. La vista previa muestra la cédula oculta (`••••456`).
3. Al confirmar, se importan los estudiantes **y** se crean sus accesos en el mismo paso. Ya pueden entrar.

Columna `nombres` (nombre completo, ya no hay columna `apellidos`): escriba «Apellidos, Nombres» con coma o punto y coma
(`Abrego, Yerlyn` o `BEST; LIANELYS`). El portal separa el apellido (antes del signo) del nombre (después) y, si todo viene en
MAYÚSCULAS, lo pasa a formato normal (`Best, Lianelys`). Sin coma ni punto y coma, todo queda como nombre y el apellido vacío
(las listas se ordenarán peor). Un Excel antiguo que aún traiga la columna `apellidos` también se acepta.

Columna `sexo`: escriba **Femenino** o **Masculino** (también vale F o M). Es obligatoria para estudiantes nuevos o que aún no
tienen sexo registrado; en la plantilla trae una lista desplegable. Se muestra en la lista de estudiantes.

Reglas de la columna `cedula`:
- Obligatoria para estudiantes que aún no tienen acceso. Si ya lo tienen, puede quedar vacía (si viene, cambia su contraseña).
- Mínimo 6 letras o números (se ignoran guiones y espacios). No puede repetirse dentro del archivo.
- Un Excel antiguo sin esa columna se rechaza con un aviso para descargar la plantilla nueva.
- La cédula no se envía a la función de importación de la base ni se guarda en tablas.

El bloque «Accesos de estudiantes con cédula» queda solo para corregir o cambiar cédulas después
(Excel/CSV con `codigo_estudiante` y `cedula`).

## Seguridad: lo que conviene saber
- La cédula es un dato conocido por compañeros y familiares: quien sepa el grado, el nombre y la cédula de otro estudiante
  puede ver sus notas. Para este portal (notas, asistencia, tareas) el riesgo es aceptable para muchos centros, pero es una decisión de la dirección.
- Recomendado: pedir al estudiante que cambie su contraseña tras el primer ingreso (queda como mejora futura).
- Supabase limita los intentos de inicio de sesión por IP (Authentication → Rate Limits); no lo desactive.
- Dos estudiantes del mismo grado con el mismo nombre y apellido funcionan: se prueba la cédula con cada uno.

---

## Documento original: portal2027-base-de-datos.md

# portal2027 — inventario de base de datos (etapas 1 a 9, parte A)

Proyecto Supabase: meduca2027 (nuevo, separado de control-notas-jiral). Todo lo propio lleva el prefijo `portal2027`.

## Tablas

| Tabla | Contenido |
|---|---|
| `portal2027_perfiles` | Un perfil por cuenta de Auth: nombres, apellidos, correo, activo. |
| `portal2027_roles_usuario` | Roles múltiples: administrador, profesor, consejero, estudiante. |
| `portal2027_anios` | Años lectivos (un solo año activo a la vez). |
| `portal2027_trimestres` | Tres trimestres por año, creados automáticamente. |
| `portal2027_salones` | Grupos por año: grado + sección (9 + C = 9C). |
| `portal2027_materias` | Materias (nombre único sin distinguir mayúsculas). |
| `portal2027_asignaciones` | Profesor + materia + grupo. |
| `portal2027_estudiantes` | Ficha única por código: nombres, apellidos, correo (opcional), acudiente, cuenta vinculada, ruta de foto. |
| `portal2027_matriculas` | Una por estudiante y año: grupo y estado. El grupo debe ser del mismo año. |
| `portal2027_evaluaciones` | Columnas de la libreta (categoría, tema, bloqueo, ocultar, papelera, versión) por asignación y trimestre. |
| `portal2027_notas` | Una nota por columna y matrícula; vacío no es cero; con versión. |
| `portal2027_historial_notas` | Historial inmutable de cada cambio de nota (anterior, nuevo, motivo, versión). |
| `portal2027_historial_evaluaciones` | Historial inmutable de acciones sobre columnas. |
| `portal2027_estados_asistencia` | Estados de asistencia configurables (código, etiqueta, abreviatura, orden, activo). Sin efecto en cálculos todavía. |
| `portal2027_sesiones_asistencia` | Una sesión de clase: asignación + trimestre + fecha + bloque; descripción, bloqueo, papelera y versión. |
| `portal2027_asistencia` | Una marca por sesión y matrícula; sin fila o estado nulo = sin marcar (no es ausencia); con versión. |
| `portal2027_pesos_categoria` | Peso por año y categoría (nulo = sin definir). Solo se guarda; no entra en ningún cálculo. |
| `portal2027_estados_nota` | Estados de nota (pendiente, exento) con efecto «sin definir». Solo catálogo. |
| `portal2027_consejeros_salon` | Consejero + grupo (solo personas con rol consejero). |
| `portal2027_publicaciones` | Si las notas de una asignación y trimestre están publicadas a los estudiantes. |
| `portal2027_materiales` | Materiales por asignación y trimestre (archivo opcional en `portal2027-materiales`, publicado, papelera). |
| `portal2027_tareas` | Tareas con plazo, publicación, papelera, versión y vínculo opcional a una columna de la libreta. |
| `portal2027_entregas` | Una por tarea y matrícula: archivo en `portal2027-entregas`, tardía, estado, comentario del profesor, versión. |
| `portal2027_cierres` | Estado cerrado/abierto por asignación y trimestre. |
| `portal2027_resultados_cierre` | Copias numeradas del cierre (columnas, estudiantes, notas, conteo de asistencia); solo se agregan. |
| `portal2027_historial_cierres` | Historial inmutable de cierres y reaperturas (quién, cuándo, motivo). |
| `portal2027_respaldos` | Registro (solo se agrega, solo administración lo ve) de cada copia hecha fuera de Supabase: tipo, resultado real, responsable, ubicación. Sin claves. |
| `portal2027_historial_asistencia` | Historial inmutable de cada cambio de marca (anterior, nuevo, versión, quién, cuándo). |

## Funciones y disparadores

- Etapa 2: `portal2027_es_profesor_de_salon`, `portal2027_es_mi_ficha`, `portal2027_ve_estudiante`, `portal2027_es_salon_de_mi_ficha`, `portal2027_puede_gestionar_foto` (apoyo a RLS); `portal2027_guardar_foto_ruta` (único modo de cambiar la ruta de la foto); `portal2027_importar_estudiantes(jsonb)` (solo administración, una transacción, sin duplicados).

- `portal2027_tiene_rol(rol)`, `portal2027_es_admin()`, `portal2027_tiene_algun_rol()`: consultan el rol de la sesión; una cuenta inactiva no tiene roles.
- `portal2027_nuevo_usuario` (disparador sobre `auth.users`): crea el perfil, sin roles.
- `portal2027_crear_trimestres`: crea los 3 trimestres al crear un año.
- `portal2027_validar_asignacion`: exige rol profesor en la asignación.
- `portal2027_proteger_perfil`: quien no es administrador no cambia id, correo ni estado activo.

## Quién puede qué (RLS activo en todas las tablas)

| Tabla | Administración | Profesor | Estudiante / consejero | Sin sesión |
|---|---|---|---|---|
| perfiles | ve y edita todos | solo el suyo | solo el suyo | nada |
| roles_usuario | ve y gestiona todos | ve los suyos | ve los suyos | nada |
| anios, trimestres, materias | gestiona | solo lectura | solo lectura | nada |
| salones | gestiona | solo los suyos | ninguno por ahora | nada |
| asignaciones | gestiona | solo las suyas | ninguna | nada |
| estudiantes | gestiona | solo los de sus grupos | estudiante: solo su ficha | nada |
| matriculas | gestiona | solo las de sus grupos | estudiante: solo las suyas | nada |
| salones | (ver arriba) | (ver arriba) | estudiante: el grupo donde está matriculado | nada |
| Storage `portal2027-fotos` (privado) | ve/sube/quita todas | las de sus estudiantes | solo la suya | nada |

Etapa 5: el consejero ve (solo lectura) sus grupos, las matrículas y fichas de sus estudiantes y el conteo de asistencia del grupo con `portal2027_resumen_asistencia_salon`. No ve notas.

Etapa 6: el estudiante no lee las tablas de notas ni de asistencia; recibe solo lo suyo con `portal2027_mis_notas` (solo materias publicadas) y `portal2027_mi_asistencia`. Profesor y administración publican o retiran con `portal2027_publicar_notas`. Ver `portal2027-etapa6.md`.

## Migraciones

`0001` tablas y disparadores · `0002` funciones y RLS · `0003` datos ficticios de configuración (año 2027, 3 materias, grupo 9C) · `0004` administrador inicial (manual) · `0005` estudiantes, matrículas, importación, fotos y permisos · `0006` libreta (base) · `0007` asistencia por sesión (incluye el permiso de lectura de las tablas de la libreta) · `0008` configuración: pesos, estados de nota y validación de fechas de trimestres · `0009` consejería · `0010` estudiante: publicación de notas y vistas propias · `0011` clases y tareas (materiales, tareas, entregas y buckets privados) · `0012` cierre trimestral (copia versionada y bloqueo en la base). · `0013` consejería: notas del grupo (solo materias publicadas) · `0014` documentos privados · `0015` respaldos y recuperación de notas. Las migraciones generales viven en `supabase/migrations/`; 0003 y las reparaciones específicas 0034, 0035 y 0043 viven en `supabase/especificas/`.

Etapa 3A: las tablas de la libreta se leen directamente (administración y profesor de la asignación) y se escriben solo con `portal2027_crear_evaluacion`, `_actualizar_evaluacion`, `_papelera_evaluacion` y `_guardar_nota`. Ver `portal2027-etapa3-parteA.md`.

Etapa 4A: la asistencia se lee directamente (administración y profesor de la asignación) y se escribe solo con `portal2027_crear_sesion`, `_actualizar_sesion`, `_papelera_sesion`, `_guardar_asistencia` y `_marcar_pendientes`. Ver `portal2027-etapa4-parteA.md`.

Etapa 4B: pesos y estados de nota se leen con cualquier rol y los cambia solo administración (RLS). El disparador `portal2027_validar_trimestre` impide fechas cruzadas y sesiones de asistencia fuera de las fechas. Ver `portal2027-etapa4-parteB.md`.

Clases y tareas (guía, etapa 5, parte A): se leen con RLS (personal de la asignación; el estudiante solo su entrega) y se escriben solo con `portal2027_crear_material`, `_actualizar_material`, `_crear_tarea`, `_actualizar_tarea`, `_entregar_tarea`, `_revisar_entrega`, `_reabrir_entrega`; el estudiante recibe su clase con `portal2027_mis_clases`. Buckets privados `portal2027-materiales` y `portal2027-entregas`. Ver `portal2027-clases-tareas-parteA.md`.

Cierre trimestral (guía, etapa 7, parte A): se cierra con `portal2027_cerrar_trimestre` (copia previa versionada) y solo administración reabre con `portal2027_reabrir_trimestre` (motivo obligatorio). Disparadores `portal2027_*_cierre` bloquean columnas, notas, sesiones y asistencia del trimestre cerrado. Ver `portal2027-reportes-cierre-parteA.md`.

Consejería con notas (guía, etapa 7, parte B): `portal2027_notas_salon(salon, trimestre)` (migración 0013) devuelve al consejero del grupo (o a administración) las columnas y notas SOLO de las materias que el profesor publicó; las materias sin publicar llegan sin columnas ni notas. No calcula nada: el motor único lo hace en la pantalla.

Documentos privados (guía, etapa 8, parte A, migración 0014): tablas `portal2027_tipos_documento` (los define administración), `portal2027_documentos` (uno vigente por estudiante, año y tipo) y `portal2027_historial_documentos` (solo se agrega). Bucket privado `portal2027-documentos` (5 MB; PDF, JPG, PNG; ruta `estudiante/año/tipo/archivo`). Se leen con RLS (el propio estudiante, administración y el consejero del grupo) y se escriben solo con `portal2027_registrar_documento` y `portal2027_revisar_documento`; `portal2027_faltantes_documentos(salon, año)` lista los obligatorios sin documento o rechazados.

Respaldos y recuperación (guía, etapa 9, parte A, migración 0015): `portal2027_recuperar_nota(historial, versión, motivo)` devuelve una nota al valor anterior a un cambio usando el guardado común (permisos, bloqueo, cierre y versión iguales; deja nueva fila de historial). `portal2027_registrar_respaldo` y `portal2027_estado_respaldos` (solo administración). Ver `portal2027-etapa9-parteA.md`.

## Edge Function

`portal2027-invitar-estudiante` (servidor): valida que quien llama sea administrador activo, invita al correo de la ficha o vincula una cuenta existente, y asigna el rol estudiante.

Ejercicios virtuales (guía, etapa 6, parte A, migración 0016): tablas `portal2027_periodos_ejercicio`, `portal2027_ejercicios`, `portal2027_equipos_ejercicio`, `portal2027_equipo_integrantes`, `portal2027_intentos` (solo se agregan), `portal2027_consolidaciones` y `portal2027_config_ejercicios` (método y faltantes por año, «sin definir» hasta que administración los fije). Se leen con RLS (profesor de la asignación y administración) y se escriben solo con funciones `portal2027_*` (`crear_periodo_ejercicio`, `cerrar_periodo_ejercicio`, `crear_ejercicio`, `papelera_ejercicio`, `crear_equipo`, `disolver_equipo`, `confirmar_equipo`, `mis_ejercicios`, `iniciar_ejercicio`, `guardar_intento`, `consolidar_periodo`). El juego nunca escribe notas; la consolidación usa `portal2027_guardar_nota`. Ver `portal2027-ejercicios-parteA.md` y `portal2027-integracion-ejercicios.md`.

---

## Documento original: portal2027-clases-tareas-parteA.md

# portal2027 — Clases y tareas (etapa 5 de la guía), parte A: base, permisos y Storage

Nota de numeración: los documentos anteriores llamaron «etapa 5» a consejería y «etapa 6» a «Ver mis notas».
Esta entrega corresponde a la **Etapa 5 de la guía (Clases y tareas)**. Requiere `0001`–`0010` aplicados.

## Qué incluye
- `supabase/migrations/0011_portal2027_clases_tareas.sql` (único archivo nuevo; no cambia código existente).
- Tablas: `portal2027_materiales`, `portal2027_tareas`, `portal2027_entregas`.
- Buckets privados: `portal2027-materiales` y `portal2027-entregas` (10 MB; PDF, JPG, PNG, TXT, Word, PowerPoint, Excel).
- Funciones: `portal2027_crear_material`, `_actualizar_material`, `_crear_tarea`, `_actualizar_tarea`, `_entregar_tarea`, `_revisar_entrega`, `_reabrir_entrega`, `_mis_clases`.

## Instalación
1. Supabase → SQL Editor → pegue y ejecute `0011_portal2027_clases_tareas.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga.
2. En Storage deben aparecer los dos buckets, ambos **privados**.
3. Suba el archivo a GitHub conservando carpetas. Esta parte todavía **no tiene pantallas** (las trae la parte B).

## Reglas ya aplicadas en la base
- Las tablas solo se leen; se escriben únicamente con las funciones (permisos, versión y conflictos validados).
- Profesor: solo materiales, tareas y entregas de **sus asignaciones**. Administración: todas.
- Estudiante: recibe su clase con `portal2027_mis_clases` (materiales publicados y tareas publicadas de su grupo, con su propia entrega). Solo puede leer su entrega y subir a la carpeta `<tarea>/<su matrícula>/`.
- Entrega: una por tarea y estudiante; reenviar reemplaza el archivo hasta que se revise. Los archivos viejos no se borran desde el navegador.
- Tarea con nota: se vincula a una columna de la libreta (una columna solo a una tarea, misma materia, grupo y trimestre). Al revisar, la nota se guarda con `portal2027_guardar_nota` (versión e historial). Revisar otra vez con la misma nota **no** crea otra; cambiarla exige motivo.
- Los materiales en papelera y las tareas en papelera dejan de verse para el estudiante.

## Supuestos que debe confirmar
- Una entrega después del plazo **se acepta y se marca «tardía»**; no se bloquea ni se penaliza.
- Tareas nuevas empiezan **sin publicar**; materiales nuevos, publicados.
- Un solo archivo por entrega, hasta 10 MB (el límite de fotos sigue siendo 2 MB).
- «Devolver para corregir» deja la nota ya guardada como está.

## Pruebas (hechas en una base de prueba con datos ficticios)
- [x] 0001–0011 se aplican en orden sin errores.
- [x] Una columna de la libreta no se vincula a dos tareas.
- [x] El alumno no puede entregar con la ruta de otro alumno.
- [x] Alumno 2 y profesor ajeno ven 0 entregas y 0 archivos de otros; alumno 1 y el profesor de la asignación ven la entrega.
- [x] Profesor ajeno no puede revisar.
- [x] Revisar dos veces con 4.5 deja 1 nota y 1 registro de historial.
- [x] Cambiar la nota sin motivo se rechaza.
- [ ] Pendiente en Supabase real: confirmar que los buckets aparecen privados y que una subida real funciona (parte B).

## Qué conservar para la parte B
`0011` aplicado. Parte B (interfaz): página `pages/portal2027-clases.html` con materiales, tareas y revisión para el profesor; sección «Mis clases y tareas» en el panel del estudiante; subida de archivos con nombre único.

---

## Documento original: portal2027-clases-tareas-parteB.md

# portal2027 — Clases y tareas (etapa 5 de la guía), parte B: interfaz

Requiere `0011` aplicado (parte A). No hay migración nueva.

## Archivos
Nuevos: `pages/portal2027-clases.html`, `js/modulos/portal2027-clases.js`, `js/modulos/portal2027-clases-comun.js`,
`js/modulos/portal2027-clases-estudiante.js`, `assets/css/portal2027-clases.css`.
Cambiados: `pages/portal2027-estudiante.html`, `js/modulos/portal2027-panel.js` (botón «Clases y tareas» del profesor y sección del estudiante),
`js/modulos/portal2027-admin.js` (botón «Clases y tareas» en asignaciones), `docs/portal2027-estructura.md`.

## Instalación
1. Confirme que `0011` está aplicado y que los buckets `portal2027-materiales` y `portal2027-entregas` son privados.
2. Suba los archivos a GitHub conservando carpetas (también `docs/`). Espere a que GitHub Pages publique.

## Cómo se usa
- **Profesor / administración:** en la lista de grupos, botón **Clases y tareas** (abre la clase de esa materia y grupo).
  - *Materiales:* título, descripción, archivo opcional (PDF, JPG, PNG, TXT, Word, PowerPoint o Excel, hasta 10 MB) y visible u oculto. Se pueden ocultar o enviar a la papelera y restaurar.
  - *Tareas:* título, instrucciones, plazo opcional y, si cuenta para nota, la columna de la libreta (una columna solo en una tarea). Nacen sin publicar: use **Publicar**.
  - *Entregas:* **Ver entregas** lista a todo el grupo (sin entrega, entregada, tardía, revisada). **Revisar** abre el archivo, permite comentar y poner nota. Si ya había nota y la cambia, pide motivo. **Devolver para corregir** deja al estudiante reemplazar su archivo.
- **Estudiante:** en su panel, «Mis clases y tareas»: materiales publicados, tareas, su estado y el comentario del profesor. Entrega o reemplaza su archivo mientras no esté revisada.

## Reglas
- La pantalla solo dice «guardado» cuando la base confirmó; si algo falla muestra «No se guardó…» con la causa.
- Si falla el registro de un material después de subir el archivo, el archivo se retira. En las entregas el archivo subido no se borra (queda como evidencia).
- Cada subida usa un nombre nuevo, así reenviar no pisa el archivo anterior.
- Los archivos se abren con un enlace temporal de 10 minutos.
- La nota de una tarea se guarda con el guardado común de la libreta; revisar otra vez con la misma nota no la duplica.
- La nota no se muestra al estudiante aquí; la ve en «Mis notas» cuando el profesor publica la libreta.

## Supuestos que debe confirmar
- Una entrega tardía se acepta y se marca «tardía».
- Los archivos viejos de entregas reemplazadas permanecen en Storage (ocupan espacio; limpieza para la etapa de respaldos).
- Los estudiantes no ven nombres ni entregas de compañeros.

## Pruebas
Hechas con datos ficticios (navegador simulado y base de prueba):
- [x] La pantalla del profesor dibuja materiales, tareas, conteo de entregas y la lista del grupo.
- [x] Revisar con nota «4,5» envía 4.5 a `portal2027_revisar_entrega` y muestra «Revisión guardada».
- [x] El estudiante ve solo el formulario en tareas sin revisar y el comentario del profesor en la revisada.
- [x] Subir «Tarea ñandú.pdf» crea la ruta `<tarea>/<matrícula>/<tiempo>-Tarea_nandu.pdf` y registra la entrega.
- [x] Se rechazan .exe, archivos vacíos y de más de 10 MB.

Pendientes en su Supabase y GitHub Pages (hágalas con datos ficticios):
1. Como profesor: cree un material con PDF, publíquelo; cree una tarea vinculada a una columna y publíquela.
2. Como estudiante: abra el material, entregue un PDF y recargue: debe seguir como «Entregada».
3. Como profesor: revise con nota 4.5. Revise otra vez igual: la libreta sigue con una sola nota y un solo registro en el historial.
4. Cambie la nota a 3.0 sin motivo: debe pedir el motivo.
5. Con otro estudiante y otro profesor: no deben ver archivos ni entregas ajenas.
6. Pruebe en el celular y con el internet cortado al entregar: no debe decir «recibida».

## Revisión de la etapa 5
- [ ] Alumno ve su clase, entrega y recibe comentario.
- [ ] Revisar dos veces no duplica la nota.
- [ ] Los adjuntos no abren sin sesión ni con otra cuenta.

---

## Documento original: portal2027-ejercicios-parteA.md

# portal2027 — Ejercicios virtuales (etapa 6 de la guía), parte A: base, permisos y contrato

Requiere `0001`–`0015` aplicados. **No cambia pantallas ni crea ningún juego** (eso es la parte B). No se modifica ninguna tabla antigua.

## Qué incluye
- `supabase/migrations/0016_portal2027_ejercicios_virtuales.sql` (se puede ejecutar varias veces).
- `js/core/portal2027-integracion-ejercicios.js` (nuevo) y `docs/portal2027-integracion-ejercicios.md` (contrato para los juegos).

## Instalación
1. Supabase → SQL Editor → ejecute `0016_portal2027_ejercicios_virtuales.sql`. Debe terminar en «Success»; si falla, copie el error completo y no siga.
2. Suba a GitHub: la migración a `supabase/migrations/`, el JS a `js/core/` y los dos docs a `docs/`.

## Qué queda en la base
Tablas: `portal2027_periodos_ejercicio` (semanal o quincenal, vinculado a **una** columna de apreciación), `portal2027_ejercicios` (obligatorio o práctica; individual o equipo de 2/3/4), `portal2027_equipos_ejercicio` y `portal2027_equipo_integrantes` (cada integrante confirma), `portal2027_intentos` (solo se agregan), `portal2027_consolidaciones` (una por estudiante y periodo) y `portal2027_config_ejercicios` (por año).
Funciones: crear periodo, cerrar/reabrir periodo, crear ejercicio, papelera de ejercicio, crear/disolver equipo (profesor o administración); mis ejercicios, confirmar equipo, iniciar ejercicio y guardar intento (estudiante); consolidar periodo (profesor de la asignación o administración). El profesor solo ve y escribe lo de sus asignaciones; el estudiante no lee las tablas, solo recibe lo suyo por funciones.

## La consolidación está BLOQUEADA a propósito
La guía pide no activarla sin acordar cómo combinar ejercicios distintos y qué hacer con los faltantes. Mientras administración no lo defina, `portal2027_consolidar_periodo` responde «Falta definir cómo se combinan los ejercicios…». Para activarla, **después de decidirlo**, administración ejecuta por año:
```sql
insert into public.portal2027_config_ejercicios (anio_id, metodo, faltantes)
select id, 'promedio_mejores', 'no_cuenta' from public.portal2027_anios where anio = 2027
on conflict (anio_id) do update set metodo = excluded.metodo, faltantes = excluded.faltantes;
```
Solo existen dos valores permitidos, los de la propuesta de la guía: `promedio_mejores` (promedio de la mejor nota de cada ejercicio obligatorio; 4.0 y 4.8 dan 4.4) y `no_cuenta` (un ejercicio sin intentos no entra en el promedio; no es cero). **No ejecute esto hasta decidirlo.** Cualquier otra regla requiere otra migración.

## Cómo funciona la consolidación (cuando esté activa)
Por cada estudiante del grupo: promedio de la mejor nota de cada ejercicio obligatorio del periodo; la práctica no cuenta; sin ningún ejercicio con nota no se escribe nada y **no se borra** una nota que ya exista. Escribe en la columna del periodo con el guardado común (permisos, columna bloqueada, trimestre cerrado, versión e historial, motivo automático) y todo en una sola transacción. Repetirla con los mismos intentos no cambia nada. El detalle de cada cálculo queda en `portal2027_consolidaciones.detalle`.

## Supuestos que debe confirmar
1. **Redondeo:** la columna de notas guarda 2 decimales, así que el promedio se guarda redondeado a 2 decimales (el motor único luego muestra 1). La guía pide no redondear de forma intermedia; con esta columna no es posible sin cambiarla.
2. **Fechas:** un periodo acepta intentos hasta que el profesor lo **cierre**; las fechas no los bloquean por sí solas. ¿Prefiere rechazar fuera de fechas?
3. Si la columna del periodo ya tenía una nota escrita a mano, la consolidación la reemplaza (con motivo e historial).
4. Los estudiantes ven sus ejercicios en cuanto el profesor los crea (sin paso de publicación).
5. Un equipo lo forma el profesor o administración; cada integrante confirma desde su cuenta.

## Pendiente (no se inventa)
- **Decisión de la guía:** método de combinación, faltantes, aprobación, cálculo anual y criterios de honor.
- Parte B: pantallas (profesor: periodos, ejercicios, equipos y consolidar; estudiante: lista, confirmar equipo) y el primer juego de ejemplo con datos ficticios.
- Validación de la jugada en el servidor (una función por juego) si se quiere impedir notas falsas.
- Esta migración **no se pudo ejecutar aquí** (no hay base disponible); se revisó su sintaxis básica. Pruébela con datos ficticios.

## Pruebas (con datos ficticios, en SQL Editor o desde la parte B)
- [ ] 0016 sin errores; ejecutarla dos veces también.
- [ ] Intentos 3.0, 4.6 y 4.0 en un ejercicio: la mejor nota es 4.6.
- [ ] Enviar dos veces el mismo intento (misma clave): un solo registro.
- [ ] Periodo cerrado: el intento se rechaza; reabrir y volver a probar.
- [ ] Equipo de 3 con uno sin confirmar: nadie puede jugar; con los tres confirmados: sí, y la nota llega a los tres.
- [ ] Un estudiante ajeno al equipo o a otro grupo no puede jugar ni confirmar.
- [ ] Consolidar con la configuración sin definir: se rechaza. Con ella definida: 4.0 y 4.8 en la columna dan 4.4; repetir no cambia nada; en trimestre cerrado se rechaza.
- [ ] Práctica sin nota: guarda intentos pero no cambia la columna.

---

## Documento original: portal2027-ejercicios-parteB.md

# portal2027 — Ejercicios virtuales (etapa 6 de la guía), parte B: pantallas y juego de ejemplo

Requiere `0001`–`0016` aplicados (la 0016 es de la parte A). **No hay migración nueva.**

## Qué incluye
- Nuevos: `pages/portal2027-ejercicios.html`, `js/modulos/portal2027-ejercicios.js` (profesor y administración), `js/modulos/portal2027-estudiante-ejercicios.js` (estudiante), `assets/css/portal2027-ejercicios.css`, `pages/ejercicios/portal2027-ejemplo-suma.html` (juego de ejemplo con datos ficticios).
- Cambiados: `js/modulos/portal2027-panel.js` (botón «Ejercicios virtuales» en cada materia del profesor y sección del estudiante), `pages/portal2027-estudiante.html`.
- Docs: esta guía y `portal2027-estructura.md`.

## Instalación
Suba los archivos a GitHub conservando carpetas (incluida `pages/ejercicios/`), espere a que Pages publique y recargue con Ctrl+F5. Si abre la pantalla sin haber ejecutado la 0016, verá un error que lo indica.

## Profesor (o administración, con la dirección `pages/portal2027-ejercicios.html?asignacion=<id>`)
Panel del profesor → «Ejercicios virtuales» en la fila de la materia.
1. **Periodo:** elija semanal o quincenal, las fechas (máximo 15 días) y la columna de **Apreciación** que alimenta (créela antes en la libreta; cada periodo usa una columna distinta).
2. **Ejercicio:** título, juego (de momento `ejemplo-suma`), obligatorio o práctica, individual o en equipo de 2, 3 o 4.
3. **Equipos:** botón «Equipos» del ejercicio; marque exactamente el tamaño pedido. Cada integrante debe **confirmar** desde su cuenta; hasta entonces nadie del equipo puede jugar.
4. **Cerrar periodo:** los estudiantes dejan de poder guardar intentos; se puede reabrir.
5. **Consolidar a la libreta:** escribe la nota de cada estudiante en la columna del periodo. **Está bloqueado hasta que administración defina el método** (ver `portal2027-ejercicios-parteA.md`); la pantalla lo dice. Después muestra una tabla con la nota escrita y la mejor nota por ejercicio, para que usted la revise antes de publicar las notas.
- El trimestre cerrado deja todo en solo lectura. Los ejercicios en papelera se restauran con «Mostrar ejercicios en la papelera».

## Estudiante
En su panel, «Mis ejercicios virtuales» (selector de trimestre): materia, periodo, si cuenta para la nota o es práctica, su mejor nota guardada, estado del equipo (con botón «Confirmar mi equipo») y el botón **Jugar** o el motivo por el que no puede. No ve nombres de compañeros.

## Juego de ejemplo
`ejemplo-suma`: cinco sumas; la nota es el número de aciertos (0 a 5). Solo usa `iniciarEjercicio` y `guardarIntento`. Dice «Guardado» únicamente si la base confirmó; si falla la red dice «NO se guardó» y ofrece reintentar con la misma clave (no duplica). Para otro juego siga `portal2027-integracion-ejercicios.md`.

## Qué es simulado
El juego de ejemplo es ficticio. Todo lo demás usa la base real, pero **no se probó aquí contra Supabase**: solo se revisó la sintaxis de los archivos y se probó la capa de integración con una base simulada.

## Pruebas (datos ficticios; marque las casillas)
- [ ] Crear periodo con columna de apreciación; no deja elegir una columna ya usada ni fechas de más de 15 días.
- [ ] Ejercicio individual obligatorio: jugar tres veces con notas 3.0, 4.6 y 4.0 (puede probar con la parte A en SQL o ajustando el juego): «mejor nota» = 4.6.
- [ ] Doble clic en «Terminar» o «Reintentar guardar»: un solo intento más.
- [ ] Equipo de 3 con uno sin confirmar: «No disponible: Su equipo aún no está confirmado…»; al confirmar los tres, juegan y la mejor nota se ve en los tres. Un cuarto estudiante no lo ve ni puede jugar.
- [ ] Práctica: el intento se guarda y dice que no da nota; la consolidación no lo usa.
- [ ] Cerrar el periodo: el juego muestra «El periodo está cerrado»; reabrir y jugar funciona.
- [ ] Consolidar sin la configuración del año: mensaje de bloqueo. Con ella: 4.0 y 4.8 → 4.4 en la columna de apreciación de la libreta; repetir no cambia nada.
- [ ] Cerrar el trimestre: crear, jugar y consolidar se rechazan.
- [ ] Cortar la red al terminar: dice «NO se guardó» y no cambia nada.
- [ ] Celular: la lista, la pantalla del profesor y el juego se ven y se usan.

## Pendiente
Definir método de combinación, faltantes, aprobación, cálculo anual y honor (decisión de la guía); confirmar los supuestos de la parte A (redondeo a 2 decimales, fechas, reemplazo de nota manual); más juegos; validación de jugadas en el servidor si se quiere impedir notas falsas.

---

## Documento original: portal2027-estructura.md

# portal2027 — estructura (etapas 1 a 8)

Portal del C.E.B.G. El Jiral. HTML/CSS/JS modular, publicado con GitHub Pages desde `main` / raíz, con Supabase (Auth y base de datos).

## Archivos

| Ruta | Función |
|---|---|
| `index.html` | Entrada: inicio de sesión, recuperación de contraseña, elección de panel. |
| `pages/portal2027-admin.html`, `-profesor.html`, `-estudiante.html`, `-consejero.html` | Un panel por rol. |
| `assets/css/portal2027-base.css` | Estilos base (etapa 0). |
| `assets/css/portal2027-componentes.css` | Formularios, mensajes y tablas de datos. |
| `js/core/portal2027-conexion.js` | Conexión con Supabase: URL y clave publicable. |
| `js/core/portal2027-permisos.js` | Sesión, roles y utilidades comunes. |
| `js/modulos/portal2027-acceso.js` | Lógica de `index.html`. |
| `js/modulos/portal2027-panel.js` | Estructura de los paneles y vistas de profesor, estudiante y consejero. |
| `js/modulos/portal2027-admin.js` | Panel de administración. |
| `js/modulos/portal2027-estudiantes.js` | Etapa 2: importación de Excel, lista, invitación y foto de perfil (administración, profesor y estudiante). |
| `pages/portal2027-libreta.html` | Libreta por año/grupo/materia/trimestre (profesor y administración). |
| `js/core/portal2027-evaluacion.js` | Motor único de cálculo de notas. |
| `js/modulos/portal2027-libreta.js` | Pantalla de la libreta. |
| `assets/css/portal2027-libreta.css` | Estilos de la libreta. |
| `pages/portal2027-asistencia.html` | Etapa 4A: asistencia por sesión (profesor y administración). |
| `js/modulos/portal2027-asistencia.js` | Pantalla de asistencia. |
| `assets/css/portal2027-asistencia.css` | Estilos de la asistencia (usa también los de la libreta). |
| `js/modulos/portal2027-config.js` | Etapa 4B: configuración académica (periodos, pesos, estados) en el panel de administración. |
| `js/modulos/portal2027-consejeria.js` | Etapa 5: consejeros por grupo (administración) y vista del grupo (consejero). |
| `js/modulos/portal2027-estudiante-academico.js` | Etapa 6: notas publicadas y asistencia del propio estudiante. |
| `pages/portal2027-clases.html` | Clases y tareas por asignación (profesor y administración). |
| `js/modulos/portal2027-clases.js` | Materiales, tareas, entregas y revisión. |
| `js/modulos/portal2027-clases-comun.js` | Validación y apertura segura de archivos. |
| `js/modulos/portal2027-clases-estudiante.js` | «Mis clases y tareas» del estudiante. |
| `assets/css/portal2027-clases.css` | Estilos de clases y tareas. |
| `js/modulos/portal2027-cierre.js` | Etapa 7B: panel de cierre trimestral dentro de la libreta (revisión previa, cerrar, reabrir, copias e historial). |
| `pages/portal2027-reporte.html`, `js/modulos/portal2027-reporte.js` | Etapa 7B: reporte del trimestre por materia y grupo (copia de cierre o datos actuales), imprimible, con avisos en borrador. |
| `js/modulos/portal2027-avisos.js` | Etapa 7B: avisos a acudientes como borradores editables y copiables; no envía nada. |
| `assets/css/portal2027-reportes.css` | Estilos de reportes, avisos e impresión. |
| `js/modulos/portal2027-documentos.js` | Etapa 8B: documentos privados. Estudiante sube y sustituye; administración define tipos, revisa y ve faltantes; consejero revisa su grupo. |
| `js/datos/portal2027-docentes-2026.js`, `js/modulos/portal2027-docentes.js` | Directorio de docentes 2026 por nivel (Premedia, Primaria, Apoyo) en «Personas», con búsqueda y descarga en Excel. Sin teléfonos: el sitio es público. |
| `pages/portal2027-seguimiento.html`, `js/modulos/portal2027-seguimiento.js`, `assets/css/portal2027-seguimiento.css` | Seguimiento por asignación (solo lectura): estudiantes en riesgo (por trimestre o acumulado T1+T2 → qué necesita en T3, con borradores de aviso), planilla de notas trimestrales con ausencias y tardanzas (imprimible) y cuadro de fracaso escolar con meta. Usa el motor único; no escribe en la base. Se abre desde «Seguimiento» en el panel del profesor. |
| `js/modulos/portal2027-respaldos.js` | Etapa 9B: sección «Respaldos» de administración (anotar copias externas con resultado real y ver el estado por tipo). La recuperación de notas está en el historial de la libreta. |
| `js/core/portal2027-integracion-ejercicios.js` | Etapa 6A (guía): contrato de los juegos: `iniciarEjercicio` y `guardarIntento`. Nunca escribe notas; ver `docs/portal2027-integracion-ejercicios.md`. |
| `js/modulos/portal2027-ejercicios.js` | Etapa 6B (guía): pantalla del profesor/administración: periodos, ejercicios, equipos, cierre y consolidación a la libreta. |
| `js/modulos/portal2027-estudiante-ejercicios.js` | Etapa 6B: «Mis ejercicios virtuales» del estudiante (confirmar equipo y abrir el juego). |
| `pages/ejercicios/portal2027-ejemplo-suma.html` | Juego de ejemplo con datos ficticios; modelo para otros juegos. |
| `assets/css/portal2027-documentos.css` | Estilos de documentos. |
| `supabase/functions/portal2027-invitar-estudiante/` | Etapa 2: invitación validada en el servidor. |
| `supabase/migrations/` | SQL numerado (ver `portal2027-base-de-datos.md`). |

## Qué ya es real

- Inicio y cierre de sesión con Supabase Auth, y recuperación de contraseña por correo.
- Redirección según el rol; con varios roles se elige el panel.
- Administración: personas y roles, años, grupos, materias y asignaciones.
- Profesor: lista de sus grupos y materias; sus estudiantes y ayuda con la foto (etapa 2).
- Libreta (etapa 3): columnas por categoría con tema, +, bloqueo, ocultar y papelera; notas con guardado real, versión e historial; promedios y final con el motor único.
- Asistencia (etapa 4A): sesiones por fecha y bloque, marca por estudiante con estados configurables, conteo por estado, bloqueo, papelera e historial. Sin porcentajes ni pesos.
- Administración (etapa 4B): fechas de trimestres, pesos por categoría y estados de asistencia y de nota. Solo se guardan; no se calculan.
- Consejería (etapa 5): administración asigna consejeros a grupos; el consejero ve estudiantes, acudiente y conteo de asistencia por estado.
- Estudiante (etapa 6): ve sus notas solo de materias publicadas por el profesor y su asistencia, por trimestre. El profesor publica o retira desde la libreta.
- Clases y tareas (guía, etapa 5): el profesor publica materiales y tareas con plazo, revisa entregas y, si la tarea cuenta para nota, la guarda en la libreta con historial; el estudiante entrega sus archivos en Storage privado.
- Documentos (guía, etapa 8): el estudiante sube sus documentos (PDF, JPG o PNG, hasta 5 MB) al bucket privado y los sustituye mientras no estén aprobados; administración define los tipos, revisa y ve los faltantes por grupo; el consejero revisa su grupo. Los archivos se abren con enlace temporal.
- Estudiante: su ficha, grupo y foto propia (etapa 2).
- Administración: importación de estudiantes desde Excel con vista previa, invitación de cuentas y fotos (etapa 2).
- Los permisos los aplica la base (RLS); la interfaz solo decide qué mostrar.

## Qué falta o es provisional

- Consejería: ve su grupo en solo lectura (fichas, asistencia y, desde la etapa 7B, las notas de las materias publicadas).
- Cuentas de personal: se crean en Supabase (Authentication → Users). Las de estudiantes se invitan desde el portal.
- El año lectivo del pie de página (`data-anio`) está escrito a mano.
- La vista simulada de la etapa 0 se retiró del `index.html`.

---

## Documento original: portal2027-etapa1-instalacion.md

# portal2027 — instalación y pruebas (etapa 1, parte A)

## 1. Aplicar la base de datos

En Supabase (proyecto meduca2027) abra **SQL Editor** y ejecute, uno por uno y en orden, los archivos de `supabase/migrations/`: `0001` y `0002`. `0003` es opcional y está en `supabase/especificas/`. Cada uno debe terminar con «Success». Si alguno falla, no siga: copie el error completo.

## 2. Configurar Auth

En **Authentication**:
- **Sign In / Providers → Email**: deje activado el acceso con correo y contraseña. Desactive **Allow new users to sign up** para que nadie se registre solo; las cuentas las crea la administración.
- **URL Configuration**: Site URL `https://profesorsamuel.github.io/portal2027/` y, en Redirect URLs, la misma dirección. Sin esto, los enlaces de recuperación de contraseña no vuelven al portal.

## 3. Administrador inicial

1. En **Authentication → Users → Add user → Create new user**, escriba su correo y una contraseña, y marque **Auto Confirm User**.
2. Abra `0004_portal2027_admin_inicial.sql`, cambie `CORREO_DEL_ADMINISTRADOR` por ese correo y ejecútelo.
3. La consulta final debe mostrar su correo con el rol `administrador`.

Los demás roles solo los asigna una cuenta administradora.

## 4. Datos del proyecto para la interfaz (parte B)

- URL del proyecto: `https://gwxghgpsgvaletrqmwcn.supabase.co`
- Clave publicable: en **Project Settings → API Keys**, la que empieza por `sb_publishable_`. Es pública por diseño.
- Nunca ponga la clave `secret` ni `service_role` en el repositorio.

## 5. GitHub Pages

Ya publicado desde `main` / raíz: `https://profesorsamuel.github.io/portal2027/`.

## 6. Pruebas de permisos

Cree dos cuentas ficticias más en Authentication → Users: un profesor y un alumno. Copie el UUID de cada una (columna *User UID*). Asigne roles en el SQL Editor:

```sql
insert into public.portal2027_roles_usuario (usuario_id, rol) values
  ('UUID_PROFESOR', 'profesor'),
  ('UUID_ALUMNO', 'estudiante');

insert into public.portal2027_asignaciones (salon_id, materia_id, profesor_id)
select s.id, m.id, 'UUID_PROFESOR'
from public.portal2027_salones s, public.portal2027_materias m
where s.nombre = '9C' and m.nombre = 'Matemática';
```

Cada prueba va en su propio bloque y termina con `rollback`, así no cambia nada. Cambie el UUID según quién pruebe.

**Como alumno** (esperado: 1 perfil, 0 grupos, 0 asignaciones, y el último comando falla):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_ALUMNO","role":"authenticated"}', true);
select count(*) as perfiles from public.portal2027_perfiles;
select count(*) as salones from public.portal2027_salones;
select count(*) as asignaciones from public.portal2027_asignaciones;
insert into public.portal2027_roles_usuario (usuario_id, rol) values ('UUID_ALUMNO', 'administrador');
rollback;
```

**Como profesor** (esperado: 1 perfil, 1 grupo, 1 asignación):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_PROFESOR","role":"authenticated"}', true);
select count(*) as perfiles from public.portal2027_perfiles;
select count(*) as salones from public.portal2027_salones;
select count(*) as asignaciones from public.portal2027_asignaciones;
rollback;
```

**Como administrador** (esperado: ve todos los perfiles, roles, grupos y asignaciones):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_ADMIN","role":"authenticated"}', true);
select count(*) from public.portal2027_perfiles;
select count(*) from public.portal2027_asignaciones;
rollback;
```

**Sin sesión** (esperado: error «permission denied»):

```sql
begin;
set local role anon;
select count(*) from public.portal2027_perfiles;
rollback;
```

Las pruebas de cerrar sesión y de recuperación de contraseña se hacen en la interfaz (parte B).

## Revisión de la etapa 1 (parte A)

- [ ] 0001 y 0002 sin errores; 0003 solo si se necesitan datos ficticios.
- [ ] Administrador inicial creado y verificado.
- [ ] Alumno: solo su perfil, sin grupos ni asignaciones; no puede darse un rol.
- [ ] Profesor: solo su grupo y su asignación.
- [ ] Sin sesión: «permission denied».

---

## Documento original: portal2027-etapa1-parteB.md

# portal2027 — etapa 1, parte B: publicación y pruebas

## Archivos a subir a GitHub

Suba, conservando carpetas y reemplazando lo existente:
`index.html`, `pages/`, `assets/css/portal2027-componentes.css`, `js/` y `docs/`.
No hace falta volver a subir `portal2027-base.css` ni `supabase/`.

## Antes de probar

En Supabase, **Authentication**:
- **URL Configuration**: Site URL y Redirect URLs con `https://profesorsamuel.github.io/portal2027/`.
- Registros nuevos desactivados (Allow new users to sign up).

Espere uno o dos minutos tras subir a GitHub y recargue con Ctrl + F5.

## Pruebas

1. **Entrar como administrador.** Debe abrir «Panel de administración» y mostrar su cuenta en Personas y roles.
2. **Contraseña incorrecta.** Debe decir «Correo o contraseña incorrectos.».
3. **Configuración.** Debe aparecer el año 2027 (activo, 3 trimestres), el grupo 9C y las 3 materias de prueba.
4. **Cerrar sesión.** Vuelve al inicio. Escribir la dirección `.../pages/portal2027-admin.html` sin sesión debe devolver al inicio, sin mostrar datos.
5. **Recuperación.** En «¿Olvidó su contraseña?» pida el enlace, ábralo desde el correo, elija otra contraseña y compruebe que entra. Un enlace ya usado debe mostrar el aviso de enlace vencido.
6. **Profesor y alumno ficticios.** Cree dos cuentas en Authentication → Users, márqueles roles en «Personas y roles» y asigne el profesor a 9C + Matemática. El profesor debe ver solo esa fila; el alumno solo su mensaje de cuenta activa; una cuenta sin rol debe ver «Su cuenta aún no tiene un rol».
7. **Varios roles.** Dé dos roles a una cuenta: al entrar debe ofrecer elegir panel.

## Revisión de la etapa 1

- [ ] Alumno sin acceso a datos de otros; profesor solo a sus grupos.
- [ ] Cerrar sesión bloquea consultas.
- [ ] Los enlaces de recuperación funcionan.
- [ ] Pruebas SQL de la parte A (documento de instalación, sección 6) con resultado esperado.

## Notas

- El correo de recuperación usa el servicio de correo incluido en Supabase, que tiene un límite bajo de envíos por hora. Si no llega, espere y revise correo no deseado.
- La biblioteca `supabase-js` se carga desde jsDelivr con versión fija (2.57.4). Si la consola del navegador muestra que no cargó, avise.

---

## Documento original: portal2027-etapa2-instalacion.md

# portal2027 — etapa 2: Excel y fotografía (instalación y pruebas)

## Archivos a subir a GitHub (conservando carpetas)

`assets/css/portal2027-componentes.css`, `pages/` (admin, profesor y estudiante), `js/modulos/` (`portal2027-estudiantes.js` nuevo; `portal2027-panel.js` y `portal2027-acceso.js` cambiados), `supabase/` y `docs/`.

## 1. Base de datos

En Supabase → **SQL Editor**, ejecute `supabase/migrations/0005_portal2027_estudiantes.sql`. Debe terminar con «Success». Si falla, copie el error completo y no siga.
Crea: `portal2027_estudiantes`, `portal2027_matriculas`, la función de importación, los permisos y el bucket privado `portal2027-fotos` (JPG/PNG, 2 MB).

## 2. Función de invitación (servidor)

La invitación se valida en el servidor con una Edge Function. En Supabase → **Edge Functions → Deploy a new function → Via Editor**:
- Nombre: `portal2027-invitar-estudiante`
- Pegue el contenido de `supabase/functions/portal2027-invitar-estudiante/index.ts` y despliegue.
- Deje activada la verificación de JWT. La clave `service_role` la inyecta Supabase en la función; **no se escribe en ningún archivo**.

## 3. Auth

En **Authentication → URL Configuration** confirme que `https://profesorsamuel.github.io/portal2027/` está en Site URL y Redirect URLs (el enlace de invitación vuelve a esa dirección y pide elegir contraseña).

## 4. Pruebas (use datos ficticios)

1. Cree en el Excel una hoja **Importar** con las columnas `codigo_estudiante, nombres, apellidos, grado, seccion, anio_lectivo, correo_estudiante, nombre_acudiente, telefono_acudiente, estado` y 3–4 filas de prueba (una sin correo; grado 9, sección C; año 2027).
2. **Administración → Estudiantes:** cargue el archivo. Debe mostrar la vista previa. Cambie una fila para que tenga un grado inválido: debe marcar el error y no ofrecer «Confirmar».
3. Confirme la importación del archivo correcto. Esperado: estudiantes y matrículas nuevos; el grupo aparece como **9C**.
4. **Reimporte el mismo archivo:** todo debe aparecer «Sin cambios» y los totales no cambian (sin duplicados).
5. Sin correo: la ficha aparece con «Sin correo» y botón Invitar desactivado; el resto funciona.
6. **Invitar** a un estudiante con correo propio de prueba: llega el correo, el enlace pide elegir contraseña y luego abre el panel de estudiante con su grupo.
7. **Foto:** como estudiante suba un JPG/PNG de menos de 2 MB → se ve. Un archivo de más de 2 MB o un PDF renombrado → mensaje de error.
8. **Foto ajena protegida:** con el alumno ficticio, en el SQL Editor:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_ALUMNO","role":"authenticated"}', true);
select count(*) as fichas from public.portal2027_estudiantes;   -- esperado: 1
select count(*) as fotos_visibles from storage.objects where bucket_id = 'portal2027-fotos'; -- esperado: solo la suya
rollback;
```
9. **Profesor** asignado a 9C: ve solo los estudiantes de sus grupos y puede ayudar con la foto. Otro profesor sin asignación: lista vacía.
10. Sin sesión (`set local role anon`): «permission denied».

## Revisión de la etapa 2

- [ ] Reimportar no duplica.
- [ ] Grado 9 y sección C forman 9C.
- [ ] Ficha sin correo funciona.
- [ ] Foto ajena protegida (alumno, profesor sin asignación, sin sesión).
- [ ] Invitación solo la envía un administrador (un alumno que llame a la función recibe 403).

## Supuestos que debe confirmar

- **estado** se guarda en la matrícula (por año), en minúsculas; vacío = `activo`. No se fijó una lista de valores porque la guía no la define.
- Si el grupo (grado+sección) no existe en ese año, la importación lo crea; la vista previa lo avisa.
- Reimportar actualiza nombres, correo y datos del acudiente, y cambia el grupo/estado de la matrícula del año si difieren.
- Fichas no se borran desde el portal en esta etapa.
- Excel usa SheetJS 0.20.3 desde su CDN oficial, con SRI SHA-384 verificado y respaldo local de los mismos bytes en `js/vendor/`. El cargador `js/core/portal2027-excel.js` lo comparten administración y libreta.

---

## Documento original: portal2027-etapa3-parteA.md

# portal2027 — etapa 3, parte A: base de la libreta y motor de cálculo

## Qué incluye
- `supabase/migrations/0006_portal2027_libreta.sql`: tablas `portal2027_evaluaciones` (columnas), `portal2027_notas`, `portal2027_historial_notas`, `portal2027_historial_evaluaciones`, permisos y funciones de guardado.
- `js/core/portal2027-evaluacion.js`: motor único de cálculo (la interfaz de la parte B y los reportes de la etapa 7 lo usarán; no se calcula en otro lugar).

Nada de esto cambia aún las pantallas: la libreta visible llega en la parte B.

## Instalación
1. Suba `js/core/portal2027-evaluacion.js` y `docs/` a GitHub.
2. En Supabase → SQL Editor ejecute `0006_portal2027_libreta.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga.

## Reglas aplicadas
- Categorías: apreciación, ejercicio escrito y examen. Promedio por categoría con las notas existentes; final = promedio de las categorías con nota; vacío no es cero; 1 decimal solo al mostrar.
- Columnas: tema, orden, bloqueo, ocultar, papelera recuperable. Ocultar **no** cambia el cálculo; la papelera sí lo excluye.
- Las tablas solo se leen directamente; se escribe únicamente con `portal2027_crear_evaluacion`, `_actualizar_evaluacion`, `_papelera_evaluacion` y `_guardar_nota`.
- Cada nota tiene versión: si otra persona la cambió, el guardado se rechaza con «CONFLICTO».
- Una columna bloqueada o en papelera rechaza cambios de notas en la base.
- Historial desde la primera nota guardada (valor anterior, nuevo, versión, quién, cuándo). No se puede editar ni borrar.
- Una asignación con libreta no se puede quitar (protege las notas).
- Acceso: administración y el profesor de esa asignación. Estudiantes y consejeros no leen notas todavía (etapa 7).

## Supuestos que debe confirmar
- Escala permitida 0 a 5 (hasta 2 decimales). Si la escala real es 1 a 5, se cambia en una línea.
- Para cambiar o borrar una nota ya escrita se exige **motivo**; la primera escritura no lo pide.
- La administración también puede editar notas (queda registrada en el historial).

## Pruebas del motor (ya ejecutadas)
Apreciaciones 4 y 5, ejercicio 3, examen vacío → **3.8**. Todo vacío → «Sin nota». Ocultar no cambia; papelera sí. 4.45 → 4.5; 4.449 → 4.4; 0 cuenta como nota.

## Pruebas de la base (haga en SQL Editor, con datos ficticios)
Reemplace los UUID: profesor asignado a 9C + Matemática (etapa 1), un `matricula_id` de 9C (etapa 2) y el `trimestre_id` del año 2027.
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_PROFESOR","role":"authenticated"}', true);
select public.portal2027_crear_evaluacion('ID_ASIGNACION','ID_TRIMESTRE','apreciacion','Tema 1') as columna;  -- anote el id
-- con ese id:
select public.portal2027_guardar_nota('ID_COLUMNA','ID_MATRICULA',4.5,0,null);       -- version 1
select public.portal2027_guardar_nota('ID_COLUMNA','ID_MATRICULA',5,1,null);         -- ERROR: motivo
select public.portal2027_guardar_nota('ID_COLUMNA','ID_MATRICULA',5,1,'Corrección'); -- version 2
select public.portal2027_guardar_nota('ID_COLUMNA','ID_MATRICULA',3,1,'Corrección'); -- ERROR: CONFLICTO
select count(*) from public.portal2027_historial_notas;                              -- 2
select public.portal2027_actualizar_evaluacion('ID_COLUMNA',1,null,null,true);       -- bloquea
select public.portal2027_guardar_nota('ID_COLUMNA','ID_MATRICULA',2,2,'Prueba');     -- ERROR: bloqueada
insert into public.portal2027_notas (evaluacion_id, matricula_id, valor) values ('ID_COLUMNA','ID_MATRICULA',1); -- ERROR: permiso
rollback;
```
Con otro profesor (sin asignación) o con la cuenta del alumno, `portal2027_crear_evaluacion` y `portal2027_guardar_nota` deben dar «No tiene permiso» y `select count(*) from portal2027_notas` debe dar 0. Sin sesión (`role anon`): «permission denied».

## Revisión de la parte A
- [ ] 0006 sin errores.
- [ ] Motivo obligatorio al cambiar una nota; conflicto de versión rechazado.
- [ ] Columna bloqueada rechaza cambios; historial con 2 filas.
- [ ] Profesor ajeno, alumno y sin sesión no ven ni escriben.

---

## Documento original: portal2027-etapa3-parteB.md

# portal2027 — etapa 3, parte B: pantalla de la libreta

Requiere la parte A (migración `0006` aplicada y `js/core/portal2027-evaluacion.js` subido).

## Archivos a subir a GitHub (conservando carpetas)
`pages/portal2027-libreta.html` (nuevo), `assets/css/portal2027-libreta.css` (nuevo), `js/modulos/portal2027-libreta.js` (nuevo), `js/modulos/portal2027-panel.js` y `js/modulos/portal2027-admin.js` (cambiados: botón «Abrir libreta» / «Libreta»), `docs/`.

## Cómo se usa
- Profesor: en su panel, «Abrir libreta» junto a cada grupo y materia. Administración: botón «Libreta» en la tabla de Asignaciones.
- Elija el trimestre. El botón **+** de cada categoría agrega una columna (pide el tema).
- Cada columna tiene tema editable y tres botones: bloquear/desbloquear, ocultar/mostrar y papelera. Una columna oculta **sigue contando**; una en papelera no cuenta y se restaura desde «Papelera».
- Escriba la nota y pulse Enter. La casilla se pone amarilla al guardar, verde si se guardó y roja si **no** se guardó (con el motivo arriba). Nunca se marca como guardado sin respuesta de la base.
- Cambiar o borrar una nota ya escrita pide el motivo.
- Filtros: trimestre, categoría, buscar estudiante, mostrar ocultas. «Historial de notas» muestra los últimos 100 cambios del trimestre.
- Si otra persona cambió algo antes, aparece «Conflicto» y se pulsa «Recargar».

## Pruebas
1. Con la cuenta del profesor ficticio (asignado a 9C + Matemática) y estudiantes importados en 9C, abra la libreta.
2. Agregue 2 columnas de apreciación, 1 de ejercicio escrito y 1 de examen. Ponga 4 y 5 en apreciaciones y 3 en el ejercicio; deje el examen vacío → Final **3.8**. Un estudiante sin ninguna nota → «Sin nota».
3. Oculte una columna → el Final no cambia. Envíela a la papelera → el Final cambia. Restáurela → vuelve.
4. Bloquee una columna → sus casillas no se pueden editar.
5. Cambie la nota 4 por 4.5 → pide motivo; en «Historial de notas» aparece con antes 4 y ahora 4.5.
6. Escriba 9 o «abc» → mensaje de error y no se guarda.
7. Desconecte internet y guarde una nota → casilla roja y aviso «NO se guardó».
8. Abra la misma libreta en dos ventanas, cambie una nota en una y luego la misma en la otra → «Conflicto».
9. Otro profesor (sin asignación) con la dirección de esa libreta: «No se encontró esta libreta o no tiene acceso». Alumno: vuelve al inicio.
10. Celular: la tabla se desplaza lateralmente y la columna del estudiante queda fija.

## Revisión de la etapa 3
- [ ] Apreciaciones 4 y 5, ejercicio 3 y examen vacío: final 3.8. Todo vacío: sin nota.
- [ ] Ocultar no cambia el cálculo.
- [ ] Historial con motivo y versión; conflictos y columnas bloqueadas rechazados.
- [ ] El estado de guardado refleja el resultado real.

## Pendiente de acuerdos (no inventado)
Peso entre categorías, aprobación y promedio anual no están definidos: el final es el promedio simple de las categorías con nota, como pide la guía.

---

## Documento original: portal2027-etapa4-parteA.md

# portal2027 — etapa 4, parte A: asistencia por sesión

## Qué incluye
- `supabase/migrations/0007_portal2027_asistencia.sql`: tablas de estados, sesiones, asistencia e historial; permisos; funciones de guardado. Incluye el **permiso de lectura** (`grant select`) de las tablas nuevas y también de las de la libreta (0006), por si faltó; repetirlo es seguro.
- `pages/portal2027-asistencia.html`, `js/modulos/portal2027-asistencia.js`, `assets/css/portal2027-asistencia.css`.
- Cambiados: `js/modulos/portal2027-panel.js` (botón «Asistencia» en el panel de profesor) y `js/modulos/portal2027-admin.js` (botón «Asistencia» en Asignaciones).

## Instalación
1. Suba los archivos a GitHub conservando carpetas (también `docs/`).
2. En Supabase → SQL Editor ejecute `0007_portal2027_asistencia.sql` completo. Debe terminar con «Success»; si falla, copie el error completo y no siga.

## Cómo se usa
- Profesor: en «Mis grupos y materias», botón **Asistencia**. Administración: botón «Asistencia» en Asignaciones.
- Elija el trimestre y agregue una **sesión** (fecha, bloque 1 a 12 y descripción opcional). No se repite fecha + bloque en la misma asignación.
- Cada casilla es un selector de estado; se guarda al instante y se pone amarilla (guardando), verde (guardado) o roja (**no** se guardó, con el motivo arriba). Vacío = «sin marcar», no es ausencia.
- «Marcar sin registro» pone un mismo estado a todos los estudiantes que aún no tienen marca en una sesión (no cambia los ya marcados).
- Cada sesión se puede bloquear (no admite cambios) o enviar a la papelera (recuperable; sus marcas se conservan).
- Columnas de la derecha: cuántas sesiones tiene cada estudiante en cada estado y cuántas sin marcar. Solo conteo.
- «Historial» muestra los últimos 100 cambios del trimestre. Si otra persona cambió algo antes, aparece «Conflicto» y se pulsa «Recargar».

## Lo que NO se calcula (condición de la guía)
No hay porcentaje de asistencia, pesos, estados pendientes/exentos ni descuentos de nota. Los **estados** son una tabla configurable; hoy traen cuatro valores iniciales (Presente P, Ausente A, Tardanza T, Ausencia justificada J) que son un punto de partida, no una regla. La pantalla para configurarlos y definir cómo cuentan llega en la 4B.

## Supuestos que debe confirmar
- Los cuatro estados iniciales y sus abreviaturas.
- Una sesión se identifica por fecha + bloque (hasta 12 bloques por día).
- Cambiar una marca ya escrita **no** pide motivo (queda en el historial); en notas sí se pide.
- Si el trimestre tiene fechas definidas, la fecha de la sesión debe caer dentro; hoy los trimestres no tienen fechas, así que no se valida.
- Estudiantes y consejeros aún no ven asistencia (etapa 7).

## Pruebas
1. Con 9C + Matemática asignada a su usuario profesor y estudiantes importados, abra «Asistencia».
2. Agregue una sesión de hoy bloque 1; repítala → «Ya existe una sesión en esa fecha y bloque».
3. Marque Presente/Ausente en varios estudiantes → casilla verde y conteos a la derecha actualizados.
4. «Marcar sin registro» con Presente → solo cambian los vacíos.
5. Cambie una marca → en «Historial» aparece con antes y ahora.
6. Bloquee la sesión → las casillas quedan deshabilitadas; envíela a la papelera y restáurela.
7. Desconecte internet y marque una casilla → roja y aviso «NO se guardó».
8. Dos ventanas, misma casilla → la segunda da «Conflicto».
9. Otro profesor sin asignación con esa dirección: «No se encontró esta asistencia o no tiene acceso». Estudiante: vuelve al inicio.

## Prueba de la base (SQL Editor, datos ficticios; reemplace los UUID)
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_PROFESOR","role":"authenticated"}', true);
select public.portal2027_crear_sesion('ID_ASIGNACION','ID_TRIMESTRE', current_date, 1, 'Prueba');  -- anote el id
select public.portal2027_guardar_asistencia('ID_SESION','ID_MATRICULA','presente',0);              -- version 1
select public.portal2027_guardar_asistencia('ID_SESION','ID_MATRICULA','ausente',0);               -- ERROR: CONFLICTO
select public.portal2027_guardar_asistencia('ID_SESION','ID_MATRICULA','ausente',1);               -- version 2
select count(*) from public.portal2027_historial_asistencia;                                       -- 2
insert into public.portal2027_asistencia (sesion_id, matricula_id, estado) values ('ID_SESION','ID_MATRICULA','presente'); -- ERROR: permiso
rollback;
```

## Revisión de la 4A
- [ ] 0007 sin errores.
- [ ] Sesión repetida rechazada; conflicto de versión rechazado.
- [ ] Sesión bloqueada rechaza cambios; historial con las marcas.
- [ ] Profesor ajeno, estudiante y sin sesión no ven ni escriben.
- [ ] Ningún porcentaje ni peso aparece en pantalla.

---

## Documento original: portal2027-etapa4-parteB.md

# portal2027 — etapa 4, parte B: configuración académica

Requiere la 4A (`0007` aplicado).

## Qué incluye
- `supabase/migrations/0008_portal2027_configuracion.sql`: tablas `portal2027_pesos_categoria` y `portal2027_estados_nota`, quién/cuándo cambió cada configuración, y validación de fechas de trimestres.
- `js/modulos/portal2027-config.js` (nuevo): sección «Configuración académica» al final del panel de administración.
- Cambiados: `js/modulos/portal2027-panel.js` y `pages/portal2027-admin.html`.

## Instalación
1. Suba los archivos a GitHub conservando carpetas (también `docs/`).
2. En Supabase → SQL Editor ejecute `0008_portal2027_configuracion.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga.

## Qué se puede configurar (solo administración)
- **Periodos:** fecha de inicio y fin de cada trimestre (opcionales). Los trimestres no pueden cruzarse, y no se puede dejar una sesión de asistencia fuera de las fechas.
- **Pesos por categoría:** apreciación, ejercicio escrito y examen, por año. Vacío = sin definir. Se muestra la suma y se avisa si no da 100; se puede guardar igual.
- **Estados de asistencia:** nombre, abreviatura, orden y activo; se pueden agregar nuevos. El código no cambia.
- **Estados de nota:** «Pendiente» y «Exento» iniciales, con efecto **sin definir**. Todavía no se pueden marcar en la libreta.

## Lo que NO se calcula (condición de la guía)
Ningún peso ni estado se usa aún en notas ni en asistencia. El final sigue siendo el promedio simple de las categorías con nota y la asistencia solo cuenta sesiones por estado. Conectar pesos y estados al motor se hará cuando usted los defina.

## Apreciaciones
La apreciación ya existe como categoría de la libreta (etapa 3). En esta parte no se agregó nada más porque no está especificado qué más debe incluir; ver la pregunta pendiente.

## Pruebas
1. Administración: abra el panel; al final aparece «Configuración académica».
2. Periodos: ponga T1 del 1/3 al 31/5 y guarde; ponga T2 desde el 15/5 → «Las fechas se cruzan con el trimestre 1».
3. Con una sesión de asistencia del 10/6 en T1, intente poner el fin de T1 el 31/5 → «Hay sesiones de asistencia fuera de esas fechas».
4. Pesos: escriba 30, 30 y 40 → suma 100; recargue y verifique que persisten. Borre un peso y guarde → vuelve a «sin definir».
5. Estados: agregue «Retiro anticipado» (RA) → aparece en la lista de estados de asistencia; desactívelo → deja de ofrecerse en las casillas nuevas.
6. Un profesor no ve la sección de configuración y no puede escribir en esas tablas.
7. Compruebe que las notas finales de la libreta no cambian al guardar pesos.

## Revisión de la 4B
- [ ] 0008 sin errores.
- [ ] Fechas cruzadas y sesiones fuera de fechas rechazadas.
- [ ] Pesos y estados persisten; vacío queda «sin definir».
- [ ] La libreta y la asistencia no cambian su resultado.

---

## Documento original: portal2027-etapa5.md

# portal2027 — etapa 5: consejería

Requiere `0007` y `0008` aplicados.

## Qué incluye
- `supabase/migrations/0009_portal2027_consejeria.sql`: tabla `portal2027_consejeros_salon`, permisos del consejero y la función `portal2027_resumen_asistencia_salon`.
- `js/modulos/portal2027-consejeria.js` (nuevo).
- Cambiados: `js/modulos/portal2027-panel.js`, `pages/portal2027-admin.html`, `pages/portal2027-consejero.html`.

## Instalación
1. Suba los archivos a GitHub conservando carpetas (también `docs/`).
2. En Supabase → SQL Editor ejecute `0009_portal2027_consejeria.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga.

## Cómo se usa
- Administración: en «Personas y roles» marque el rol Consejero a alguien. Luego, en «Consejeros por grupo», elija grupo y consejero y pulse «Asignar consejero».
- Consejero: su panel muestra «Mi grupo» con selector de grupo y trimestre y una tabla de solo lectura: estudiante, código, acudiente, teléfono, conteo por estado de asistencia y «Sin marcar».
- La asistencia suma todas las materias del grupo. «Sin marcar» = sesiones del trimestre sin marca (no es ausencia). No hay porcentajes.

## Reglas
- El consejero solo ve los grupos que se le asignaron. Un consejero sin grupo ve «Aún no tiene un grupo asignado».
- No ve notas ni escribe nada (no tiene permisos de escritura en ninguna tabla).
- Solo se puede asignar a personas con el rol consejero.

## Supuestos que debe confirmar
- Que el consejero vea el nombre y el teléfono del acudiente.
- Que no vea notas por ahora (la decisión de publicar notas a estudiantes y consejeros queda para otra etapa).
- Un grupo puede tener varios consejeros, y un consejero varios grupos.

## Pruebas
1. Cree una cuenta de prueba en Authentication → Users y dele el rol Consejero.
2. Asígnela a 9C. Entre con ella: debe ver los estudiantes importados y los conteos de asistencia (con sesiones marcadas por el profesor).
3. Sin asignación: «Aún no tiene un grupo asignado».
4. Con otro consejero asignado a otro grupo: no ve estos estudiantes.
5. Intente asignar a alguien sin rol consejero (SQL) → «La persona asignada no tiene el rol consejero».
6. Las pantallas de profesor y estudiante siguen igual.

## Revisión de la etapa 5
- [ ] 0009 sin errores.
- [ ] El consejero ve solo su grupo y no ve notas.
- [ ] Los conteos coinciden con la pantalla de asistencia.
- [ ] El panel de administración muestra «Consejeros por grupo».

---

## Documento original: portal2027-etapa6.md

# portal2027 — etapa 6: el estudiante ve sus notas y asistencia

Requiere `0007`, `0008` y `0009` aplicados.

## Qué incluye
- `supabase/migrations/0010_portal2027_estudiante_academico.sql`: tabla `portal2027_publicaciones` y funciones `portal2027_publicar_notas`, `portal2027_mis_notas` y `portal2027_mi_asistencia`.
- `js/modulos/portal2027-estudiante-academico.js` (nuevo).
- Cambiados: `js/modulos/portal2027-libreta.js` (botón de publicar), `js/modulos/portal2027-panel.js`, `pages/portal2027-estudiante.html`.

## Instalación (en este orden)
1. En Supabase → SQL Editor ejecute `0010_portal2027_estudiante_academico.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga.
2. Suba los archivos a GitHub conservando carpetas (también `docs/`). Importante: la libreta nueva consulta la tabla de publicaciones; sin el paso 1 no abriría.

## Cómo se usa
- Profesor o administración: en la libreta, botón **Publicar a estudiantes** (por materia y trimestre); el mismo botón dice **Retirar publicación** cuando ya está publicada. Arriba se indica el estado.
- Estudiante: en su panel, «Mis notas y asistencia» con selector de trimestre.
  - Notas: por materia, solo si está publicada; si no, «El profesor aún no ha publicado las notas…». Muestra cada columna con su nota, el promedio por categoría y el Final (motor único).
  - Asistencia: total de sesiones del trimestre, conteo por estado, «Sin marcar» y la lista de sesiones con marca. Sin porcentajes.

## Reglas
- El estudiante solo recibe sus propios datos; no puede leer las tablas de notas ni de asistencia directamente.
- Las columnas en papelera no se muestran. Los cambios de notas hechos después de publicar se ven de inmediato (no es una copia congelada).
- Consejería sigue sin ver notas.

## Supuestos que debe confirmar
- Que la asistencia sea visible para el estudiante sin necesidad de publicarla.
- Que las columnas ocultas en la libreta también se muestren al estudiante (ocultar solo afecta la vista del profesor; sigue contando en el cálculo).
- Que publicar sea por materia y trimestre, y no por grupo completo.
- Que lo publicado se actualice en vivo.

## Pruebas
1. Cuenta de estudiante vinculada a una ficha de 9C (invitación de la etapa 2) y notas puestas por el profesor.
2. Sin publicar: en «Mis notas y asistencia» la materia dice «aún no ha publicado»; la asistencia sí aparece.
3. Profesor publica: el estudiante recarga y ve sus columnas, promedios y Final (apreciaciones 4 y 5, ejercicio 3, examen vacío → 3.8).
4. Profesor retira la publicación: vuelve el aviso.
5. Cambie una nota después de publicar: el estudiante ve el cambio al recargar.
6. Envíe una columna a la papelera: desaparece de la vista del estudiante y el Final se recalcula.
7. Dos estudiantes: cada uno ve solo lo suyo.
8. Un profesor ajeno a la asignación no puede publicar («No tiene permiso»).

## Revisión de la etapa 6
- [ ] 0010 sin errores y libreta abre.
- [ ] Sin publicar, el estudiante no ve notas; publicadas, solo las suyas.
- [ ] Papelera y retiro de publicación se reflejan.
- [ ] Ningún porcentaje ni peso aparece.

---

## Documento original: portal2027-etapa8-parteA.md

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

---

## Documento original: portal2027-etapa8-parteB.md

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

---

## Documento original: portal2027-etapa9-parteA.md

# portal2027 — Respaldos y pruebas finales (etapa 9 de la guía), parte A: base, copias y plan

Requiere `0001`–`0014` aplicados. Esta parte **no cambia pantallas** (las trae la parte B).

## Qué incluye
- `supabase/migrations/0015_portal2027_respaldos_recuperacion.sql` (se puede ejecutar varias veces).
- `scripts/portal2027-respaldo-db.sh` (copia de la base) y `scripts/portal2027-respaldo-storage.mjs` (copia de los archivos).
- `docs/portal2027-etapa9-parteA.md` (esta guía) y `docs/portal2027-base-de-datos.md` actualizado.
- **Ya existía y se conserva:** historial de notas desde la primera edición, papelera de columnas, sesiones, materiales y tareas, y el historial de documentos. Lo nuevo es poder **recuperar una nota** y **registrar los respaldos**.

## Instalación
1. Supabase → SQL Editor → ejecute `0015_portal2027_respaldos_recuperacion.sql` (debe terminar en «Success»).
2. Suba a GitHub: la migración a `supabase/migrations/`, el doc a `docs/` y los scripts a `scripts/`. **Nunca suba copias de respaldo ni claves.**

## Lo más importante (léalo antes de usar datos reales)
- **El plan gratuito de Supabase no hace copias automáticas.** Las copias diarias existen solo en planes de pago, y aun ahí los **archivos de Storage no están incluidos** en la copia de la base. Por eso este paquete trae las dos copias manuales.
- **El repositorio es público** (GitHub Pages gratis lo exige): no guarde copias en el repositorio ni como artefactos de GitHub Actions; contienen datos de estudiantes.
- Un proyecto gratuito se **pausa tras 7 días sin actividad**: haga una copia antes de vacaciones largas.
- Los scripts se probaron aquí solo con un servidor simulado (Storage) y revisión de sintaxis (base). **Falta ensayarlos contra su Supabase real**; ese es el ensayo de restauración de abajo.

## Cómo usar las copias
**Base de datos** (en su computadora, con `pg_dump` instalado):
```
export SUPABASE_DB_URL='postgresql://...'      # Supabase > Connect; si no conecta, use «Session pooler»
./scripts/portal2027-respaldo-db.sh ./respaldos diaria
```
Genera `public.dump` (estructura y datos) y `auth-datos.dump` (cuentas), comprueba que se puedan leer y guarda sus huellas (`SHA256.txt`).

**Archivos** (Node 18+):
```
export SUPABASE_URL='https://xxxx.supabase.co'
export SUPABASE_SERVICE_KEY='...'              # clave secret; solo en su equipo, nunca en el navegador ni en GitHub
node scripts/portal2027-respaldo-storage.mjs ./respaldos
```
Dice «N de M archivos» por bucket y termina con error si falta alguno. Solo lee; no borra nada.

Luego copie la carpeta **fuera del equipo** (disco externo o nube privada) y anótela en el portal con el resultado **real**:
```sql
select public.portal2027_registrar_respaldo('diaria', 'exitoso', 'Prof. Samuel Ortega', 'disco externo A, carpeta 2027-10', null, null, null);
-- tipos: diaria | previa_importacion | previa_cierre | manual | storage | restauracion_prueba
-- resultados: exitoso | parcial | fallido  (parcial y fallido exigen describir qué pasó en detalle)
```
(En la parte B esto será un formulario y un aviso en pantalla.) Estado actual: `select public.portal2027_estado_respaldos();` — un tipo sin copia exitosa aparece vacío; nunca se presume que existe.

## Recuperar una nota
En el historial de la celda, cada fila tiene un `id`. Para devolver la nota al valor **anterior** a ese cambio:
```sql
select public.portal2027_recuperar_nota('<id del historial>', <versión actual de la nota>, 'Motivo');
```
Usa el guardado común: mismos permisos (profesor de la asignación o administración), rechaza columna bloqueada, en papelera o **trimestre cerrado**, y da `CONFLICTO` si la nota cambió. Deja una fila nueva en el historial; el historial viejo no se toca. Columnas, sesiones, materiales y tareas en la papelera ya se restauran desde sus pantallas.

## Propuesta que debe confirmar (la guía pide acordarla)
- **Cuándo:** una copia completa (base + archivos) **al final de cada semana de clases**, y **obligatoria justo antes** de cada importación de estudiantes y de cada cierre trimestral.
- **Retención:** las últimas 4 semanales, una por mes durante el año lectivo y una al cierre de cada trimestre (se conserva todo el año).
- **Responsable:** una persona titular y una suplente, con quien tenga acceso a la copia fuera del equipo. **Pendiente de definir: nombres.**
- Cuenta de la clave de servicio y de la cadena de conexión: solo la persona responsable; si se sospecha que se filtró, regenerarla en Supabase.

## Ensayo de restauración (obligatorio antes de datos reales)
1. Cree un proyecto Supabase **de prueba** distinto del real, vacío.
2. Ejecute allí `0001`–`0015` en orden (incluida la 0004 con un administrador de prueba si hace falta).
3. Restaure las cuentas y luego los datos: `pg_restore --data-only --no-owner -d "<url de prueba>" auth-datos.dump` y después `pg_restore --data-only --no-owner -d "<url de prueba>" public.dump`. Si el disparador de cuentas nuevas crea perfiles duplicados o falla, **copie el error completo**: se ajusta el orden.
4. Suba los archivos de `respaldos/portal2027-storage-.../` a los mismos buckets de prueba y compare cantidades con `resumen.json`.
5. Compruebe: mismo número de estudiantes, notas e historial; el estudiante de prueba abre su documento. Anote el ensayo como `restauracion_prueba` con el resultado real.

## Pruebas finales (casillas)
- [ ] 0015 sin errores.
- [ ] Recuperar una nota: cambiar 4.0 → 3.5 con motivo, recuperar, vuelve a 4.0 y el historial tiene una fila nueva.
- [ ] Recuperar en columna bloqueada o trimestre cerrado se rechaza; versión vieja da CONFLICTO.
- [ ] Un profesor ajeno no puede recuperar la nota; un profesor o estudiante no ve ni registra respaldos.
- [ ] Copia de la base y de Storage con datos ficticios; «N de M» coincide.
- [ ] Ensayo de restauración en otra base y registro con resultado real.
- [ ] Permisos (alumno solo lo suyo), cálculos (4,5 y 3 y vacío → 3,8; todo vacío → sin nota), importar dos veces sin duplicar.
- [ ] Celular: libreta, entrega y documentos. Cortar la red al guardar una nota o subir un documento **no** muestra «guardado».

---

## Documento original: portal2027-etapa9-parteB.md

# portal2027 — Respaldos y pruebas finales (etapa 9 de la guía), parte B: pantallas

Requiere `0001`–`0015` aplicados (la 0015 es de la parte A). **No hay migración nueva.**

## Qué incluye
- `js/modulos/portal2027-respaldos.js` (nuevo): sección «Respaldos» en el panel de administración.
- Cambiados: `js/modulos/portal2027-libreta.js` (botón **Recuperar** en el historial), `js/modulos/portal2027-panel.js`, `pages/portal2027-admin.html`.

## Instalación
1. Suba los 5 archivos a GitHub conservando carpetas (también `docs/`).
2. Espere a que GitHub Pages publique y recargue con Ctrl+F5.

## Cómo se usa
**Respaldos (administración).** Al final del panel:
- Tabla con la última copia **exitosa** y el último intento de cada tipo. Un tipo sin copia dice «Ninguna registrada».
- Aviso rojo si la base o los archivos no tienen copia exitosa anotada.
- Formulario «Anotar un respaldo»: tipo, resultado real, responsable, dónde quedó, tamaño, fecha (vacío = ahora) y detalle. Si el resultado es parcial o fallido, el detalle es obligatorio.
- «Últimos registros»: los 20 más recientes. Solo se agregan; no se editan ni se borran.
- El portal **no hace** la copia: usted la hace con los scripts de la parte A y luego la anota aquí.

**Recuperar una nota (profesor de la asignación o administración).** Libreta → «Historial de notas» → botón **Recuperar** en la fila elegida → escribir el motivo. La nota vuelve al valor que tenía **antes** de ese cambio y queda una fila nueva en el historial.
- El botón está desactivado si el trimestre está cerrado o la columna está bloqueada o en la papelera (la base también lo rechaza).
- Si alguien cambió la nota mientras tanto, la base responde CONFLICTO: pulse «Recargar» y repita.
- Tras recuperar, la libreta se recarga y el historial se vuelve a abrir.

## Pruebas (con datos ficticios)
- [ ] Anotar un respaldo «exitoso»: aparece en la tabla y desaparece el aviso del tipo correspondiente (diaria o storage).
- [ ] Anotar «fallido» sin detalle: se rechaza con mensaje claro. Con detalle: se guarda y **no** cuenta como copia exitosa.
- [ ] Un profesor o estudiante no ve la sección (solo está en el panel de administración).
- [ ] Cambiar una nota de 4.0 a 3.5, abrir historial, Recuperar con motivo: vuelve a 4.0 y el historial suma una fila.
- [ ] Recuperar con trimestre cerrado, columna bloqueada o en papelera: botón desactivado.
- [ ] Cortar la red y pulsar Recuperar: muestra «No hay conexión…» y la nota no cambia.
- [ ] Celular: la tabla de respaldos y el historial se desplazan sin romper la pantalla.

## Qué sigue pendiente (no se inventa)
- Definir **nombres del responsable titular y suplente**, y confirmar la propuesta de frecuencia y retención de la parte A.
- Ensayar las copias y la **restauración en otra base** (parte A); anotar el ensayo como `restauracion_prueba`.
- Recordatorios automáticos de copia previa a importaciones y cierres: por ahora solo se anotan a mano.
- De la guía, la etapa 6 (ejercicios virtuales: `portal2027-integracion-ejercicios.js`) no existe en el proyecto y exige antes acordar pesos y faltantes.

---

## Documento original: portal2027-integracion-ejercicios.md

# portal2027 — contrato de integración de ejercicios virtuales

Para cualquier página de juego en `pages/ejercicios/`. Archivo del portal: `js/core/portal2027-integracion-ejercicios.js` (expone `window.portal2027.ejercicios`).

## Qué puede y qué no puede hacer un juego
- **Puede:** pedir permiso para jugar (`iniciarEjercicio`) y guardar un intento (`guardarIntento`).
- **No puede:** escribir notas finales, ver notas de otros ni tocar la libreta. La nota de la libreta solo cambia cuando el profesor **consolida el periodo**.

## Cómo se carga
En la página del juego, en este orden: supabase-js, `js/core/portal2027-conexion.js`, `js/core/portal2027-permisos.js`, `js/core/portal2027-integracion-ejercicios.js`. El estudiante debe tener sesión iniciada.

## Funciones
```js
const ini = await portal2027.ejercicios.iniciarEjercicio(ejercicioId);
// { ok, puedeJugar, motivo, claveEnvio, cuentaNota, mejorNota, participacion, tamanoEquipo, ... }
// ok:false → { ok:false, error } (sin conexión, sin permiso...). No guarda nada.
// puedeJugar:false → mostrar `motivo` (periodo cerrado, trimestre cerrado, equipo sin confirmar...) y no iniciar el juego.

const res = await portal2027.ejercicios.guardarIntento(ejercicioId, ini.claveEnvio, nota); // nota de 0 a 5
// { ok:true, repetido, cuentaNota, intentos, mejorNota }  |  { ok:false, error }
```
- `claveEnvio` la entrega `iniciarEjercicio`, una por partida. **Reenviar con la misma clave es seguro**: no crea otro intento (`repetido:true`).
- Mostrar «guardado» **solo** si `ok:true`. Si `ok:false` por red, avisar que **no se guardó** y ofrecer reintentar con la misma clave.
- `cuentaNota:false` (modo práctica): el intento se guarda pero nunca da nota; el juego debe decirlo.
- `mejorNota` es la mejor nota guardada del estudiante (o de su equipo) en ese ejercicio; el juego solo la muestra.

## Reglas que aplica la base (el juego no puede saltárselas)
- Periodo cerrado, trimestre cerrado o ejercicio en papelera: se rechaza el intento.
- Ejercicio de equipo: solo juegan integrantes de un equipo de 2, 3 o 4 con **todos confirmados**; el intento cuenta para todo el equipo y solo los integrantes confirmados reciben la nota.
- Se conserva la mejor nota por ejercicio (3.0, 4.6, 4.0 → 4.6). Los intentos nunca se borran ni se editan.

## Limitación importante
La nota del intento **la calcula la página del juego en el navegador**; la base solo verifica que esté entre 0 y 5. Un estudiante con conocimientos técnicos podría enviar una nota falsa. Por eso el profesor revisa cada consolidación (la ve con su detalle) y la nota queda con historial. Validar la jugada en el servidor requiere una función por juego (ver «Pendiente»).

## Para un juego nuevo
Entregar la página en `pages/ejercicios/portal2027-<nombre>.html`, usar solo las dos funciones de arriba, y registrar el ejercicio en el portal (el campo `juego` guarda `<nombre>`).

---

## Documento original: portal2027-pruebas-finales.md

# portal2027 — pruebas finales y decisiones pendientes

Todas las etapas de la guía (0 a 9) tienen su implementación. Antes de usar **datos reales**, falta probarlas con **datos ficticios** y cerrar las decisiones de abajo. Marque cada casilla con fecha; no avance si alguna falla (use el prompt «Corregir un fallo» de la guía).

## Revisión estática hecha (sin base de datos)
- Todos los `src` y `href` de `index.html` y `pages/` apuntan a archivos que existen; todos los `.js` pasan la revisión de sintaxis.
- Todas las tablas creadas en `supabase/migrations/` tienen RLS activado.
- No hay claves secretas en el código del navegador; la clave secret solo se usa en los scripts de respaldo (variable de entorno) y en la función del servidor.
- Todos los archivos propios llevan el prefijo `portal2027-`.
- **Para limpiar (decida usted):** existe `migrations/0012_portal2027_cierre_trimestral.sql` en la raíz, fuera de `supabase/migrations/`. Es la versión no repetible; la correcta es la de `supabase/migrations/`. Conviene borrar la de la raíz para no ejecutarla por error.
- **Lo que esta revisión NO prueba:** ninguna migración se ha ejecutado aquí ni se ha abierto ninguna pantalla en un navegador. Eso lo cubren las casillas siguientes.

## Orden de instalación en un proyecto nuevo (o de prueba)
Ejecutar en el SQL Editor, en orden: las migraciones generales de `0001` a `0017` de `supabase/migrations/` (0003 está separado y es opcional) (la 0004 crea el administrador inicial). Luego publicar el repositorio en GitHub Pages desde `main`/root.

## Casillas por etapa (resumen de las revisiones de la guía)
- [ ] **0 Primera vista:** abre en computadora y celular; el CSS carga.
- [ ] **1 Acceso:** un alumno no ve a otros; un profesor solo ve sus grupos; cerrar sesión bloquea las consultas; los enlaces de recuperación funcionan.
- [ ] **2 Excel y foto:** reimportar no duplica; grado 9 y sección C forman 9C; una ficha sin correo funciona; la foto ajena está protegida.
- [ ] **3 Libreta:** apreciaciones 4 y 5, ejercicio escrito 3 y examen vacío dan final 3.8; todo vacío da «sin nota»; ocultar no cambia el cálculo.
- [ ] **4 Asistencia:** periodo y trimestre correctos; una ausencia no se vuelve cero; no hay dos registros de la misma sesión.
- [ ] **5 Clases y tareas:** el alumno entrega y recibe comentario; revisar dos veces no duplica la nota; los adjuntos están protegidos.
- [ ] **6 Ejercicios virtuales:** intentos 3.0, 4.6, 4.0 conservan 4.6; solo integrantes confirmados reciben nota; dos envíos no duplican (casillas detalladas en `portal2027-ejercicios-parteB.md`).
- [ ] **7 Reportes y cierre:** libreta y reporte coinciden; el cierre bloquea cambios; el siguiente trimestre no borra el anterior.
- [ ] **8 Documentos:** no se leen documentos ajenos; los faltantes corresponden al año; una carga inválida muestra un error.
- [ ] **9 Respaldos:** se recupera una nota; la copia de prueba restaura registros y archivos; un fallo de red no indica guardado exitoso (ver `portal2027-etapa9-parteA.md` y `-parteB.md`).

## Pruebas transversales (la guía las pide antes de datos reales)
- [ ] Permisos con cuatro cuentas de prueba: administrador, profesor, consejero y alumno; cada una solo ve lo suyo.
- [ ] Cálculos en pantalla, en el reporte y en el cierre dan el mismo número.
- [ ] Duplicados: importar dos veces, enviar dos veces, consolidar dos veces.
- [ ] Celular real: libreta, entrega de tarea, documentos y juego.
- [ ] Fallos de red en cada guardado: nunca aparece «guardado» si no se guardó.
- [ ] Respaldo diario y archivos hechos y **restaurados en otra base**; anotados en «Respaldos» con el resultado real.

## Decisiones que solo usted puede tomar (no se inventaron)
1. **Cómo se combinan los ejercicios virtuales y qué pasa con los faltantes** (la propuesta de la guía: promedio de las mejores notas, el ejercicio sin intentos no cuenta). Hasta decidirlo, la consolidación sigue bloqueada.
2. Supuestos de la parte A de ejercicios: guardar el promedio con 2 decimales; si las fechas del periodo bloquean intentos; si la consolidación puede reemplazar una nota escrita a mano.
3. **Aprobación, cálculo anual y criterios de honor.** El portal no calcula promedio anual ni honor.
4. **Respaldos:** nombres del responsable titular y suplente, frecuencia y retención (propuesta en `portal2027-etapa9-parteA.md`).
5. Otros supuestos marcados en los docs de cada etapa (por ejemplo, que el consejero vea el teléfono del acudiente).

## Limitaciones conocidas
- La nota de un intento de ejercicio virtual la calcula el navegador; la base solo comprueba que esté entre 0 y 5.
- El plan gratuito de Supabase no hace copias automáticas y pausa el proyecto tras 7 días sin actividad.
- Los scripts de respaldo y la restauración no se han ensayado contra su Supabase real.

---

## Documento original: portal2027-reportes-cierre-parteA.md

# portal2027 — Reportes y cierre (etapa 7 de la guía), parte A: cierre trimestral en la base

Requiere `0001`–`0011` aplicados. Esta parte **no tiene pantallas** todavía (las trae la parte B).

## Qué incluye
- `supabase/migrations/0012_portal2027_cierre_trimestral.sql` (único archivo nuevo; no cambia código existente).
- Tablas: `portal2027_cierres` (estado por materia+grupo y trimestre), `portal2027_resultados_cierre` (copias numeradas, solo se agregan) y `portal2027_historial_cierres` (quién cerró o reabrió, cuándo y por qué; solo se agrega).
- Funciones: `portal2027_revision_cierre`, `portal2027_cerrar_trimestre`, `portal2027_reabrir_trimestre`, `portal2027_trimestre_cerrado`.
- Cuatro disparadores que bloquean columnas, notas, sesiones de asistencia y marcas de asistencia de un trimestre cerrado.

## Instalación
Supabase → SQL Editor → ejecute `0012_portal2027_cierre_trimestral.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga. Suba el archivo y esta guía a GitHub.

## Cómo funciona
1. **Revisión previa** (`portal2027_revision_cierre`): cuenta estudiantes, columnas, celdas sin nota, entregas sin revisar y marcas de asistencia faltantes. Solo informa; no impide cerrar. Vacío no es cero.
2. **Cerrar** (`portal2027_cerrar_trimestre`): profesor de la asignación o administración, con confirmación. Guarda la **copia previa**: columnas (sin papelera), estudiantes del grupo, notas y conteo de asistencia por estudiante y estado. Es la versión 1; si se reabre y se vuelve a cerrar, la versión 2, y así. Las copias anteriores nunca cambian.
3. **Bloqueo en la base**: con el trimestre cerrado no se puede crear, cambiar, ocultar, bloquear, enviar a la papelera ni restaurar columnas; ni guardar notas; ni crear ni cambiar sesiones o marcas de asistencia. Vale para cualquier función o usuario, no solo para la pantalla. Publicar notas y revisar entregas **sin nota** siguen permitidos.
4. **Reabrir** (`portal2027_reabrir_trimestre`): solo administración y con motivo obligatorio. Queda en el historial.
5. **Resultado**: no se calcula en la base. La parte B aplicará el motor único (`portal2027-evaluacion.js`) a la copia guardada, así libreta y reporte coinciden.
6. Cerrar un trimestre no toca los demás ni los años anteriores: nada se borra.

## Supuestos que debe confirmar
- El cierre es **por materia y grupo en cada trimestre** (lo cierra el profesor de esa materia o administración), no por colegio completo.
- La revisión previa **no impide** cerrar con notas vacías o entregas sin revisar; solo avisa.
- La asistencia queda bloqueada junto con las notas.
- Solo administración reabre.

## Pruebas (hechas en base de prueba con datos ficticios)
- [x] 0001–0012 se aplican en orden sin errores.
- [x] Cerrar sin confirmar y cerrar con un profesor ajeno se rechazan; cerrar dos veces se rechaza.
- [x] Cerrado: se rechazan guardar nota, crear columna, cambiar tema, enviar a la papelera, crear sesión y marcar asistencia.
- [x] El trimestre 2 sigue libre mientras el 1 está cerrado.
- [x] El profesor no puede reabrir; el administrador necesita motivo.
- [x] Tras reabrir y corregir, el segundo cierre es la versión 2; la versión 1 conserva la nota anterior (3.0) y la 2 la corregida (3.5).
- [x] La copia no se puede modificar; un alumno no lee cierres.

## Pendiente (parte B)
Botones «Revisar y cerrar» y «Reabrir» en la libreta, indicador de trimestre cerrado, «Ver mis notas» con reporte, consejería del grupo con notas por el motor común, y avisos como borradores sin envío automático. No se inventa promedio anual ni honor.

---

## Documento original: portal2027-reportes-cierre-parteB.md

# portal2027 — Reportes y cierre (etapa 7 de la guía), parte B: pantallas

Requiere `0001`–`0012` aplicados y, para las notas en consejería, `0013`.

## Qué incluye
- `supabase/migrations/0013_portal2027_consejeria_notas.sql`: función `portal2027_notas_salon`. Si usted ya aplicó una migración equivalente de consejería con notas, **no** ejecute esta; compare los nombres antes.
- **Libreta** (`portal2027-libreta.js`, `pages/portal2027-libreta.html`): con el trimestre cerrado la libreta queda en solo lectura (casillas, temas y botones de columnas desactivados; la base ya lo bloquea). Nuevo panel **Cierre del trimestre**: «Revisar antes de cerrar», casilla de confirmación y «Cerrar trimestre»; copias guardadas e historial; «Reabrir» solo para administración y con motivo.
- **Reporte** (`pages/portal2027-reporte.html`): por materia, grupo y trimestre. Trimestre cerrado → muestra la última copia (o la versión elegida); abierto → datos actuales marcados como NO definitivos. Promedios con el motor único. Botón «Imprimir / guardar PDF».
- **Consejería** (`portal2027-consejeria.js`, `pages/portal2027-consejero.html`): tabla de notas por materia publicada, solo lectura.
- **Estudiante** (`portal2027-estudiante-academico.js`, `pages/portal2027-estudiante.html`): «Ver mis notas» con botón de reporte imprimible.
- **Avisos como borradores** (`portal2027-avisos.js`): en el reporte (resumen y notas pendientes) y en consejería (resumen por estudiante). Se editan y se copian; el portal no envía nada.
- Estilos: `assets/css/portal2027-reportes.css`.

## Instalación
1. Supabase → SQL Editor → `0013_portal2027_consejeria_notas.sql` (debe terminar en «Success»).
2. Suba a GitHub los archivos nuevos y cambiados (ver la lista del paquete). Espere a que GitHub Pages publique y recargue con Ctrl+F5.

## Supuestos que debe confirmar
- Una materia sin publicar no muestra notas a consejería (igual que al estudiante).
- El reporte del estudiante usa los datos publicados actuales; con el trimestre cerrado no cambian.
- No se calcula promedio anual ni criterios de honor, ni se marca aprobado/reprobado (falta acordarlos).
- Los avisos no incluyen correo del acudiente: la ficha solo guarda nombre y teléfono.

## Pruebas
Hechas aquí con datos simulados (sin base real): el reporte de una copia da apreciaciones 4 y 5 (una oculta), ejercicio 3 y examen vacío → final 3.8 y «Sin nota» para quien no tiene notas; el panel de cierre exige la casilla para cerrar, llama a la función con confirmación y pide motivo para reabrir. **Sin probar contra Supabase real**: ejecute la lista siguiente.
- [ ] Profesor: cierre → casillas bloqueadas; recargar y seguir bloqueado; guardar nota por otra vía falla.
- [ ] Reporte del trimestre cerrado coincide con la libreta (mismos finales).
- [ ] Reabrir como profesor no se ofrece; como administrador exige motivo y queda en el historial.
- [ ] Segundo cierre → versión 2; la versión 1 conserva sus notas.
- [ ] Trimestre 2 sigue libre con el 1 cerrado.
- [ ] Consejero: ve notas solo de materias publicadas; un consejero de otro grupo recibe «No tiene permiso».
- [ ] Estudiante: imprime solo su reporte (no la ficha ni las clases).


## Continuacion prevista
Ver `portal2027-reportes-cierre-parteC-aprobados-reprobados.md` para el prompt completo del cuadro de aprobados y reprobados. Aun no implementado.

---

## Documento original: portal2027-reportes-cierre-parteC-aprobados-reprobados.md

# Etapa 7 — Parte C: Cuadro de estudiantes aprobados y reprobados

## Propósito
Implementar en Portal2027 el cuadro de aprobados y reprobados del C.E.B.G. El Jiral, tomando como referencia el PDF «Cuadro_Aprobados_Ciencias_Naturales_Trimestre_2.pdf» del sistema anterior. **Este documento es un prompt de implementación pendiente; no significa que la funcionalidad esté instalada.**

## Integración y dependencias
- Continuar la etapa 7, partes A y B (`docs/portal2027-reportes-cierre-parteA.md` y `...parteB.md`).
- Reutilizar `js/core/portal2027-evaluacion.js` y la nota final oficial de la libreta; nunca calcular una segunda nota contradictoria.
- Reutilizar las asignaciones de profesor, materias, grupos, año, jornada y estado de matrícula de Supabase. Respetar RLS y permisos.
- Trimestre abierto: resultados provisionales calculados con notas actuales. Cerrado: utilizar la copia de cierre seleccionada y etiquetar la versión.
- No cambiar migraciones ni pantallas existentes sin analizar dependencias; no duplicar tablas ni notas.

## Pantalla
Agregar al panel del docente «Aprobados y reprobados». Filtros: año lectivo (2027 por defecto), trimestre 1/2/3, materia asignada, jornada y casillas de grupos impartidos; selección de uno, varios o todos. Botones «Generar cuadro», «Descargar PDF», «Imprimir» y «Regresar a Docente». Actualizar cuando cambien filtros o notas, sin perder observaciones guardadas.

## Clasificación de estudiantes
- Cada estudiante matriculado se cuenta una sola vez por materia/grupo/trimestre.
- Aprobado: nota final oficial >= 3.0; reprobado: nota final oficial < 3.0; sin calificaciones: ninguna nota válida; retirado: estado de retiro documentado.
- No convertir automáticamente en retirado a quien no tenga notas. Si la nota es provisional, indicarlo claramente.
- El motor de evaluación y sus reglas actuales de ponderación, ausencias, celdas vacías, redondeo y cierres prevalecen sobre ejemplos del sistema anterior.
- Verificar si los retirados forman parte de la matrícula estadística oficial; documentar y aplicar un criterio único sin contarlos dos veces. Mostrar aviso cuando falte sexo o haya registros inconsistentes; nunca inferirlo.

## Tabla oficial
Encabezado: «MINISTERIO DE EDUCACIÓN – DIRECCIÓN REGIONAL DE COLÓN – C.E.B.G. EL JIRAL»; «CUADRO DE ESTUDIANTES APROBADOS Y REPROBADOS»; «NOMBRE DEL PROFESOR». Metadatos: ASIGNATURA, NIVELES, TRIMESTRE, AÑO LECTIVO, JORNADA.

Columnas agrupadas, con una fila por grupo y fila final TOTALES:
1. GRADO
2. MATRÍCULA POR GRADO
3. APROBADOS: M, F, TOTAL, %
4. REPROBADOS HASTA LA FECHA: M, F, TOTAL, %
5. SIN CALIFICACIONES: H, M, TOTAL, %
6. RETIRADOS: H, M

Mantener las etiquetas tal como figuran en el PDF, aunque en la implementación se normalicen internamente los códigos de sexo. Si hay registros de sexo desconocido, incluirlos en totales generales y advertir que el desglose no coincide.

## Fórmulas y controles
% aprobados = aprobados / matrícula × 100; % reprobados = reprobados / matrícula × 100; % sin calificaciones = sin calificaciones / matrícula × 100. Mostrar dos decimales; si matrícula = 0, mostrar 0.00% y evitar división entre cero. En TOTALES, sumar conteos y calcular porcentajes sobre la matrícula total (nunca promediar porcentajes de grupos). Comprobar conciliación entre matrícula y categorías según el criterio definido para retirados.

**Ejemplo del PDF original (2026, Ciencias Naturales, trimestre 2, 8.º A):** matrícula 26; aprobados 24 (92.31%); reprobados 2 (7.69%); sin calificaciones 0 (0.00%); retirados 0. Este ejemplo es de referencia, no debe precargarse como datos reales de 2027.

## Estudiantes que deben cuidar su nota de examen
Bajo la tabla, sección «Estudiantes que deben cuidar su nota de Examen»: mostrar grupo, estudiante, promedios pertinentes y nota mínima de examen para aprobar. Solo incluir estudiantes pendientes de examen cuando se pueda calcular con seguridad. En el sistema de ejemplo, si las tres categorías pesan igual, nota mínima = 3×3.0 − promedio apreciación − promedio ejercicios escritos; **no aplicar esa fórmula si Portal2027 utiliza otra ponderación**. Cuando no haya estudiantes, mostrar «No hay estudiantes aprobados a la espera de nota de Examen en los grados seleccionados».

## Retirados, notas y firmas
Incluir «CAUSAS DEL RETIRO DEL ALUMNO SIN CALIFICACIONES:», con observaciones editables y persistentes en Supabase por año, materia, trimestre y grupo, con permisos y auditoría. No guardar información personal innecesaria.

NOTA:
1. Haga el % de cada nivel y por asignatura.
2. Deberá remitir a la Dirección 1 original y 1 copia.
3. El/la profesor(a) de la asignatura y la dirección deberán conservar una copia.
4. En la columna de reprobados anotar la cantidad hasta la fecha.

Añadir líneas «FIRMA DEL PROFESOR» y «FIRMA DEL DIRECTOR».

## Exportación
PDF A4 horizontal, fondo blanco, encabezados morados/azules, tabla con bordes, porcentajes a dos decimales, totales destacados, observaciones, notas y firmas. Vista previa idéntica a impresión. Evitar cortes de filas; si ocupa más de una página, paginar y repetir encabezados. Nombre `Cuadro_Aprobados_[Materia]_[Trimestre]_[Año]_[Grupo].pdf`; usar `Varios_Grupos` si aplica. Puede utilizar jsPDF/html2canvas u otra solución estable; comprobar legibilidad y ajuste a la página.

## Mejoras solicitadas
Indicadores de matrícula, aprobados, reprobados y sin notas; informe por grupo o consolidado por materia; exportación masiva opcional de un PDF por materia/trimestre; alertas de estudiantes en riesgo y registros incompletos; historial de generación con fecha y usuario; diseño responsive; actualización automática cuando cambien notas, sin modificar las calificaciones originales.

## Entregables al implementar esta etapa
Archivos HTML/CSS/JS separados siguiendo la estructura del proyecto, migración SQL solo si realmente es necesaria, documentación de instalación, pruebas de cálculo con varios grupos, notas faltantes, retirados, sexo no registrado, trimestre abierto/cerrado y comparación PDF/pantalla. Entregar únicamente archivos nuevos o modificados en ZIP. No tocar funciones ajenas que ya trabajan correctamente.
