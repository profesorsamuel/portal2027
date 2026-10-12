# portal2027 — Respaldos y pruebas finales (etapa 9 de la guía), parte B: pantallas

Requiere `0001`–`0015` aplicados (la 0015 es de la parte A). **No hay migración nueva.**

## Qué incluye
- `js/modulos/portal2027-respaldos.js` (nuevo): sección «Respaldos» en el panel de administración.
- Cambiados: `js/modulos/portal2027-libreta.js` (botón **Recuperar** en el historial), `js/modulos/portal2027-panel.js`, `pages/portal2027-admin.html`.

## Instalación
1. Suba los 5 archivos a GitHub conservando carpetas (también `docs/`).
2. Espere a que GitHub Pages publique y recargue con Ctrl+F5.

## Cómo se usa
**Respaldos (administración).** Al final del panel:
- Tabla con la última copia **exitosa** y el último intento de cada tipo. Un tipo sin copia dice «Ninguna registrada».
- Aviso rojo si la base o los archivos no tienen copia exitosa anotada.
- Formulario «Anotar un respaldo»: tipo, resultado real, responsable, dónde quedó, tamaño, fecha (vacío = ahora) y detalle. Si el resultado es parcial o fallido, el detalle es obligatorio.
- «Últimos registros»: los 20 más recientes. Solo se agregan; no se editan ni se borran.
- El portal **no hace** la copia: usted la hace con los scripts de la parte A y luego la anota aquí.

**Recuperar una nota (profesor de la asignación o administración).** Libreta → «Historial de notas» → botón **Recuperar** en la fila elegida → escribir el motivo. La nota vuelve al valor que tenía **antes** de ese cambio y queda una fila nueva en el historial.
- El botón está desactivado si el trimestre está cerrado o la columna está bloqueada o en la papelera (la base también lo rechaza).
- Si alguien cambió la nota mientras tanto, la base responde CONFLICTO: pulse «Recargar» y repita.
- Tras recuperar, la libreta se recarga y el historial se vuelve a abrir.

## Pruebas (con datos ficticios)
- [ ] Anotar un respaldo «exitoso»: aparece en la tabla y desaparece el aviso del tipo correspondiente (diaria o storage).
- [ ] Anotar «fallido» sin detalle: se rechaza con mensaje claro. Con detalle: se guarda y **no** cuenta como copia exitosa.
- [ ] Un profesor o estudiante no ve la sección (solo está en el panel de administración).
- [ ] Cambiar una nota de 4.0 a 3.5, abrir historial, Recuperar con motivo: vuelve a 4.0 y el historial suma una fila.
- [ ] Recuperar con trimestre cerrado, columna bloqueada o en papelera: botón desactivado.
- [ ] Cortar la red y pulsar Recuperar: muestra «No hay conexión…» y la nota no cambia.
- [ ] Celular: la tabla de respaldos y el historial se desplazan sin romper la pantalla.

## Qué sigue pendiente (no se inventa)
- Definir **nombres del responsable titular y suplente**, y confirmar la propuesta de frecuencia y retención de la parte A.
- Ensayar las copias y la **restauración en otra base** (parte A); anotar el ensayo como `restauracion_prueba`.
- Recordatorios automáticos de copia previa a importaciones y cierres: por ahora solo se anotan a mano.
- De la guía, la etapa 6 (ejercicios virtuales: `portal2027-integracion-ejercicios.js`) no existe en el proyecto y exige antes acordar pesos y faltantes.
