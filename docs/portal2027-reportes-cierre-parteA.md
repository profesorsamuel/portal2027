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
