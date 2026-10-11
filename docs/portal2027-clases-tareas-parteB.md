# portal2027 — Clases y tareas (etapa 5 de la guía), parte B: interfaz

Requiere `0011` aplicado (parte A). No hay migración nueva.

## Archivos
Nuevos: `pages/portal2027-clases.html`, `js/modulos/portal2027-clases.js`, `js/modulos/portal2027-clases-comun.js`,
`js/modulos/portal2027-clases-estudiante.js`, `assets/css/portal2027-clases.css`.
Cambiados: `pages/portal2027-estudiante.html`, `js/modulos/portal2027-panel.js` (botón «Clases y tareas» del profesor y sección del estudiante),
`js/modulos/portal2027-admin.js` (botón «Clases y tareas» en asignaciones), `docs/portal2027-estructura.md`.

## Instalación
1. Confirme que `0011` está aplicado y que los buckets `portal2027-materiales` y `portal2027-entregas` son privados.
2. Suba los archivos a GitHub conservando carpetas (también `docs/`). Espere a que GitHub Pages publique.

## Cómo se usa
- **Profesor / administración:** en la lista de grupos, botón **Clases y tareas** (abre la clase de esa materia y grupo).
  - *Materiales:* título, descripción, archivo opcional (PDF, JPG, PNG, TXT, Word, PowerPoint o Excel, hasta 10 MB) y visible u oculto. Se pueden ocultar o enviar a la papelera y restaurar.
  - *Tareas:* título, instrucciones, plazo opcional y, si cuenta para nota, la columna de la libreta (una columna solo en una tarea). Nacen sin publicar: use **Publicar**.
  - *Entregas:* **Ver entregas** lista a todo el grupo (sin entrega, entregada, tardía, revisada). **Revisar** abre el archivo, permite comentar y poner nota. Si ya había nota y la cambia, pide motivo. **Devolver para corregir** deja al estudiante reemplazar su archivo.
- **Estudiante:** en su panel, «Mis clases y tareas»: materiales publicados, tareas, su estado y el comentario del profesor. Entrega o reemplaza su archivo mientras no esté revisada.

## Reglas
- La pantalla solo dice «guardado» cuando la base confirmó; si algo falla muestra «No se guardó…» con la causa.
- Si falla el registro de un material después de subir el archivo, el archivo se retira. En las entregas el archivo subido no se borra (queda como evidencia).
- Cada subida usa un nombre nuevo, así reenviar no pisa el archivo anterior.
- Los archivos se abren con un enlace temporal de 10 minutos.
- La nota de una tarea se guarda con el guardado común de la libreta; revisar otra vez con la misma nota no la duplica.
- La nota no se muestra al estudiante aquí; la ve en «Mis notas» cuando el profesor publica la libreta.

## Supuestos que debe confirmar
- Una entrega tardía se acepta y se marca «tardía».
- Los archivos viejos de entregas reemplazadas permanecen en Storage (ocupan espacio; limpieza para la etapa de respaldos).
- Los estudiantes no ven nombres ni entregas de compañeros.

## Pruebas
Hechas con datos ficticios (navegador simulado y base de prueba):
- [x] La pantalla del profesor dibuja materiales, tareas, conteo de entregas y la lista del grupo.
- [x] Revisar con nota «4,5» envía 4.5 a `portal2027_revisar_entrega` y muestra «Revisión guardada».
- [x] El estudiante ve solo el formulario en tareas sin revisar y el comentario del profesor en la revisada.
- [x] Subir «Tarea ñandú.pdf» crea la ruta `<tarea>/<matrícula>/<tiempo>-Tarea_nandu.pdf` y registra la entrega.
- [x] Se rechazan .exe, archivos vacíos y de más de 10 MB.

Pendientes en su Supabase y GitHub Pages (hágalas con datos ficticios):
1. Como profesor: cree un material con PDF, publíquelo; cree una tarea vinculada a una columna y publíquela.
2. Como estudiante: abra el material, entregue un PDF y recargue: debe seguir como «Entregada».
3. Como profesor: revise con nota 4.5. Revise otra vez igual: la libreta sigue con una sola nota y un solo registro en el historial.
4. Cambie la nota a 3.0 sin motivo: debe pedir el motivo.
5. Con otro estudiante y otro profesor: no deben ver archivos ni entregas ajenas.
6. Pruebe en el celular y con el internet cortado al entregar: no debe decir «recibida».

## Revisión de la etapa 5
- [ ] Alumno ve su clase, entrega y recibe comentario.
- [ ] Revisar dos veces no duplica la nota.
- [ ] Los adjuntos no abren sin sesión ni con otra cuenta.
