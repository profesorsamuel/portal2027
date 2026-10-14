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
