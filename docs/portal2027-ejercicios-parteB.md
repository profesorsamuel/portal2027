# portal2027 — Ejercicios virtuales (etapa 6 de la guía), parte B: pantallas y juego de ejemplo

Requiere `0001`–`0016` aplicados (la 0016 es de la parte A). **No hay migración nueva.**

## Qué incluye
- Nuevos: `pages/portal2027-ejercicios.html`, `js/modulos/portal2027-ejercicios.js` (profesor y administración), `js/modulos/portal2027-estudiante-ejercicios.js` (estudiante), `assets/css/portal2027-ejercicios.css`, `pages/ejercicios/portal2027-ejemplo-suma.html` (juego de ejemplo con datos ficticios).
- Cambiados: `js/modulos/portal2027-panel.js` (botón «Ejercicios virtuales» en cada materia del profesor y sección del estudiante), `pages/portal2027-estudiante.html`.
- Docs: esta guía y `portal2027-estructura.md`.

## Instalación
Suba los archivos a GitHub conservando carpetas (incluida `pages/ejercicios/`), espere a que Pages publique y recargue con Ctrl+F5. Si abre la pantalla sin haber ejecutado la 0016, verá un error que lo indica.

## Profesor (o administración, con la dirección `pages/portal2027-ejercicios.html?asignacion=<id>`)
Panel del profesor → «Ejercicios virtuales» en la fila de la materia.
1. **Periodo:** elija semanal o quincenal, las fechas (máximo 15 días) y la columna de **Apreciación** que alimenta (créela antes en la libreta; cada periodo usa una columna distinta).
2. **Ejercicio:** título, juego (de momento `ejemplo-suma`), obligatorio o práctica, individual o en equipo de 2, 3 o 4.
3. **Equipos:** botón «Equipos» del ejercicio; marque exactamente el tamaño pedido. Cada integrante debe **confirmar** desde su cuenta; hasta entonces nadie del equipo puede jugar.
4. **Cerrar periodo:** los estudiantes dejan de poder guardar intentos; se puede reabrir.
5. **Consolidar a la libreta:** escribe la nota de cada estudiante en la columna del periodo. **Está bloqueado hasta que administración defina el método** (ver `portal2027-ejercicios-parteA.md`); la pantalla lo dice. Después muestra una tabla con la nota escrita y la mejor nota por ejercicio, para que usted la revise antes de publicar las notas.
- El trimestre cerrado deja todo en solo lectura. Los ejercicios en papelera se restauran con «Mostrar ejercicios en la papelera».

## Estudiante
En su panel, «Mis ejercicios virtuales» (selector de trimestre): materia, periodo, si cuenta para la nota o es práctica, su mejor nota guardada, estado del equipo (con botón «Confirmar mi equipo») y el botón **Jugar** o el motivo por el que no puede. No ve nombres de compañeros.

## Juego de ejemplo
`ejemplo-suma`: cinco sumas; la nota es el número de aciertos (0 a 5). Solo usa `iniciarEjercicio` y `guardarIntento`. Dice «Guardado» únicamente si la base confirmó; si falla la red dice «NO se guardó» y ofrece reintentar con la misma clave (no duplica). Para otro juego siga `portal2027-integracion-ejercicios.md`.

## Qué es simulado
El juego de ejemplo es ficticio. Todo lo demás usa la base real, pero **no se probó aquí contra Supabase**: solo se revisó la sintaxis de los archivos y se probó la capa de integración con una base simulada.

## Pruebas (datos ficticios; marque las casillas)
- [ ] Crear periodo con columna de apreciación; no deja elegir una columna ya usada ni fechas de más de 15 días.
- [ ] Ejercicio individual obligatorio: jugar tres veces con notas 3.0, 4.6 y 4.0 (puede probar con la parte A en SQL o ajustando el juego): «mejor nota» = 4.6.
- [ ] Doble clic en «Terminar» o «Reintentar guardar»: un solo intento más.
- [ ] Equipo de 3 con uno sin confirmar: «No disponible: Su equipo aún no está confirmado…»; al confirmar los tres, juegan y la mejor nota se ve en los tres. Un cuarto estudiante no lo ve ni puede jugar.
- [ ] Práctica: el intento se guarda y dice que no da nota; la consolidación no lo usa.
- [ ] Cerrar el periodo: el juego muestra «El periodo está cerrado»; reabrir y jugar funciona.
- [ ] Consolidar sin la configuración del año: mensaje de bloqueo. Con ella: 4.0 y 4.8 → 4.4 en la columna de apreciación de la libreta; repetir no cambia nada.
- [ ] Cerrar el trimestre: crear, jugar y consolidar se rechazan.
- [ ] Cortar la red al terminar: dice «NO se guardó» y no cambia nada.
- [ ] Celular: la lista, la pantalla del profesor y el juego se ven y se usan.

## Pendiente
Definir método de combinación, faltantes, aprobación, cálculo anual y honor (decisión de la guía); confirmar los supuestos de la parte A (redondeo a 2 decimales, fechas, reemplazo de nota manual); más juegos; validación de jugadas en el servidor si se quiere impedir notas falsas.
