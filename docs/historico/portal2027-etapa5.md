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
