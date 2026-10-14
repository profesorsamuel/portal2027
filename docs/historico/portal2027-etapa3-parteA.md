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
