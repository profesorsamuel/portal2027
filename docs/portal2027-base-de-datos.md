# portal2027 — inventario de base de datos (etapa 1, parte A)

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

## Funciones y disparadores

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

Los estudiantes verán su grupo cuando existan fichas y matrículas (etapa 2). El consejero verá su grupo asignado en la etapa 7.

## Migraciones

`0001` tablas y disparadores · `0002` funciones y RLS · `0003` datos ficticios de configuración (año 2027, 3 materias, grupo 9C) · `0004` administrador inicial (manual).
