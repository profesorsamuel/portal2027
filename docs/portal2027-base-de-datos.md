# portal2027 — inventario de base de datos (etapas 1 a 4A)

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

El consejero verá su grupo asignado en la etapa 7.

## Migraciones

`0001` tablas y disparadores · `0002` funciones y RLS · `0003` datos ficticios de configuración (año 2027, 3 materias, grupo 9C) · `0004` administrador inicial (manual) · `0005` estudiantes, matrículas, importación, fotos y permisos · `0006` libreta (base) · `0007` asistencia por sesión (incluye el permiso de lectura de las tablas de la libreta).

Etapa 3A: las tablas de la libreta se leen directamente (administración y profesor de la asignación) y se escriben solo con `portal2027_crear_evaluacion`, `_actualizar_evaluacion`, `_papelera_evaluacion` y `_guardar_nota`. Ver `portal2027-etapa3-parteA.md`.

Etapa 4A: la asistencia se lee directamente (administración y profesor de la asignación) y se escribe solo con `portal2027_crear_sesion`, `_actualizar_sesion`, `_papelera_sesion`, `_guardar_asistencia` y `_marcar_pendientes`. Ver `portal2027-etapa4-parteA.md`.

## Edge Function

`portal2027-invitar-estudiante` (servidor): valida que quien llama sea administrador activo, invita al correo de la ficha o vincula una cuenta existente, y asigna el rol estudiante.
