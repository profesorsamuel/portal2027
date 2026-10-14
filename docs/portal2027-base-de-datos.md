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
