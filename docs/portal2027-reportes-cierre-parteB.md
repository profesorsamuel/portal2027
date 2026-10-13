# portal2027 — Reportes y cierre (etapa 7 de la guía), parte B: pantallas

Requiere `0001`–`0012` aplicados y, para las notas en consejería, `0013`.

## Qué incluye
- `supabase/migrations/0013_portal2027_consejeria_notas.sql`: función `portal2027_notas_salon`. Si usted ya aplicó una migración equivalente de consejería con notas, **no** ejecute esta; compare los nombres antes.
- **Libreta** (`portal2027-libreta.js`, `pages/portal2027-libreta.html`): con el trimestre cerrado la libreta queda en solo lectura (casillas, temas y botones de columnas desactivados; la base ya lo bloquea). Nuevo panel **Cierre del trimestre**: «Revisar antes de cerrar», casilla de confirmación y «Cerrar trimestre»; copias guardadas e historial; «Reabrir» solo para administración y con motivo.
- **Reporte** (`pages/portal2027-reporte.html`): por materia, grupo y trimestre. Trimestre cerrado → muestra la última copia (o la versión elegida); abierto → datos actuales marcados como NO definitivos. Promedios con el motor único. Botón «Imprimir / guardar PDF».
- **Consejería** (`portal2027-consejeria.js`, `pages/portal2027-consejero.html`): tabla de notas por materia publicada, solo lectura.
- **Estudiante** (`portal2027-estudiante-academico.js`, `pages/portal2027-estudiante.html`): «Ver mis notas» con botón de reporte imprimible.
- **Avisos como borradores** (`portal2027-avisos.js`): en el reporte (resumen y notas pendientes) y en consejería (resumen por estudiante). Se editan y se copian; el portal no envía nada.
- Estilos: `assets/css/portal2027-reportes.css`.

## Instalación
1. Supabase → SQL Editor → `0013_portal2027_consejeria_notas.sql` (debe terminar en «Success»).
2. Suba a GitHub los archivos nuevos y cambiados (ver la lista del paquete). Espere a que GitHub Pages publique y recargue con Ctrl+F5.

## Supuestos que debe confirmar
- Una materia sin publicar no muestra notas a consejería (igual que al estudiante).
- El reporte del estudiante usa los datos publicados actuales; con el trimestre cerrado no cambian.
- No se calcula promedio anual ni criterios de honor, ni se marca aprobado/reprobado (falta acordarlos).
- Los avisos no incluyen correo del acudiente: la ficha solo guarda nombre y teléfono.

## Pruebas
Hechas aquí con datos simulados (sin base real): el reporte de una copia da apreciaciones 4 y 5 (una oculta), ejercicio 3 y examen vacío → final 3.8 y «Sin nota» para quien no tiene notas; el panel de cierre exige la casilla para cerrar, llama a la función con confirmación y pide motivo para reabrir. **Sin probar contra Supabase real**: ejecute la lista siguiente.
- [ ] Profesor: cierre → casillas bloqueadas; recargar y seguir bloqueado; guardar nota por otra vía falla.
- [ ] Reporte del trimestre cerrado coincide con la libreta (mismos finales).
- [ ] Reabrir como profesor no se ofrece; como administrador exige motivo y queda en el historial.
- [ ] Segundo cierre → versión 2; la versión 1 conserva sus notas.
- [ ] Trimestre 2 sigue libre con el 1 cerrado.
- [ ] Consejero: ve notas solo de materias publicadas; un consejero de otro grupo recibe «No tiene permiso».
- [ ] Estudiante: imprime solo su reporte (no la ficha ni las clases).


## Continuacion prevista
Ver `portal2027-reportes-cierre-parteC-aprobados-reprobados.md` para el prompt completo del cuadro de aprobados y reprobados. Aun no implementado.
