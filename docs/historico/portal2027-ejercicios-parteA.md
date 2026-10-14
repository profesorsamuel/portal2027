# portal2027 — Ejercicios virtuales (etapa 6 de la guía), parte A: base, permisos y contrato

Requiere `0001`–`0015` aplicados. **No cambia pantallas ni crea ningún juego** (eso es la parte B). No se modifica ninguna tabla antigua.

## Qué incluye
- `supabase/migrations/0016_portal2027_ejercicios_virtuales.sql` (se puede ejecutar varias veces).
- `js/core/portal2027-integracion-ejercicios.js` (nuevo) y `docs/portal2027-integracion-ejercicios.md` (contrato para los juegos).

## Instalación
1. Supabase → SQL Editor → ejecute `0016_portal2027_ejercicios_virtuales.sql`. Debe terminar en «Success»; si falla, copie el error completo y no siga.
2. Suba a GitHub: la migración a `supabase/migrations/`, el JS a `js/core/` y los dos docs a `docs/`.

## Qué queda en la base
Tablas: `portal2027_periodos_ejercicio` (semanal o quincenal, vinculado a **una** columna de apreciación), `portal2027_ejercicios` (obligatorio o práctica; individual o equipo de 2/3/4), `portal2027_equipos_ejercicio` y `portal2027_equipo_integrantes` (cada integrante confirma), `portal2027_intentos` (solo se agregan), `portal2027_consolidaciones` (una por estudiante y periodo) y `portal2027_config_ejercicios` (por año).
Funciones: crear periodo, cerrar/reabrir periodo, crear ejercicio, papelera de ejercicio, crear/disolver equipo (profesor o administración); mis ejercicios, confirmar equipo, iniciar ejercicio y guardar intento (estudiante); consolidar periodo (profesor de la asignación o administración). El profesor solo ve y escribe lo de sus asignaciones; el estudiante no lee las tablas, solo recibe lo suyo por funciones.

## La consolidación está BLOQUEADA a propósito
La guía pide no activarla sin acordar cómo combinar ejercicios distintos y qué hacer con los faltantes. Mientras administración no lo defina, `portal2027_consolidar_periodo` responde «Falta definir cómo se combinan los ejercicios…». Para activarla, **después de decidirlo**, administración ejecuta por año:
```sql
insert into public.portal2027_config_ejercicios (anio_id, metodo, faltantes)
select id, 'promedio_mejores', 'no_cuenta' from public.portal2027_anios where anio = 2027
on conflict (anio_id) do update set metodo = excluded.metodo, faltantes = excluded.faltantes;
```
Solo existen dos valores permitidos, los de la propuesta de la guía: `promedio_mejores` (promedio de la mejor nota de cada ejercicio obligatorio; 4.0 y 4.8 dan 4.4) y `no_cuenta` (un ejercicio sin intentos no entra en el promedio; no es cero). **No ejecute esto hasta decidirlo.** Cualquier otra regla requiere otra migración.

## Cómo funciona la consolidación (cuando esté activa)
Por cada estudiante del grupo: promedio de la mejor nota de cada ejercicio obligatorio del periodo; la práctica no cuenta; sin ningún ejercicio con nota no se escribe nada y **no se borra** una nota que ya exista. Escribe en la columna del periodo con el guardado común (permisos, columna bloqueada, trimestre cerrado, versión e historial, motivo automático) y todo en una sola transacción. Repetirla con los mismos intentos no cambia nada. El detalle de cada cálculo queda en `portal2027_consolidaciones.detalle`.

## Supuestos que debe confirmar
1. **Redondeo:** la columna de notas guarda 2 decimales, así que el promedio se guarda redondeado a 2 decimales (el motor único luego muestra 1). La guía pide no redondear de forma intermedia; con esta columna no es posible sin cambiarla.
2. **Fechas:** un periodo acepta intentos hasta que el profesor lo **cierre**; las fechas no los bloquean por sí solas. ¿Prefiere rechazar fuera de fechas?
3. Si la columna del periodo ya tenía una nota escrita a mano, la consolidación la reemplaza (con motivo e historial).
4. Los estudiantes ven sus ejercicios en cuanto el profesor los crea (sin paso de publicación).
5. Un equipo lo forma el profesor o administración; cada integrante confirma desde su cuenta.

## Pendiente (no se inventa)
- **Decisión de la guía:** método de combinación, faltantes, aprobación, cálculo anual y criterios de honor.
- Parte B: pantallas (profesor: periodos, ejercicios, equipos y consolidar; estudiante: lista, confirmar equipo) y el primer juego de ejemplo con datos ficticios.
- Validación de la jugada en el servidor (una función por juego) si se quiere impedir notas falsas.
- Esta migración **no se pudo ejecutar aquí** (no hay base disponible); se revisó su sintaxis básica. Pruébela con datos ficticios.

## Pruebas (con datos ficticios, en SQL Editor o desde la parte B)
- [ ] 0016 sin errores; ejecutarla dos veces también.
- [ ] Intentos 3.0, 4.6 y 4.0 en un ejercicio: la mejor nota es 4.6.
- [ ] Enviar dos veces el mismo intento (misma clave): un solo registro.
- [ ] Periodo cerrado: el intento se rechaza; reabrir y volver a probar.
- [ ] Equipo de 3 con uno sin confirmar: nadie puede jugar; con los tres confirmados: sí, y la nota llega a los tres.
- [ ] Un estudiante ajeno al equipo o a otro grupo no puede jugar ni confirmar.
- [ ] Consolidar con la configuración sin definir: se rechaza. Con ella definida: 4.0 y 4.8 en la columna dan 4.4; repetir no cambia nada; en trimestre cerrado se rechaza.
- [ ] Práctica sin nota: guarda intentos pero no cambia la columna.
