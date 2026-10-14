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
