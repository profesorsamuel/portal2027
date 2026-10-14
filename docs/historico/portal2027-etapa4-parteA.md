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
