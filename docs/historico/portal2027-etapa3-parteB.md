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
