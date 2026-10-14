# portal2027 — contrato de integración de ejercicios virtuales

Para cualquier página de juego en `pages/ejercicios/`. Archivo del portal: `js/core/portal2027-integracion-ejercicios.js` (expone `window.portal2027.ejercicios`).

## Qué puede y qué no puede hacer un juego
- **Puede:** pedir permiso para jugar (`iniciarEjercicio`) y guardar un intento (`guardarIntento`).
- **No puede:** escribir notas finales, ver notas de otros ni tocar la libreta. La nota de la libreta solo cambia cuando el profesor **consolida el periodo**.

## Cómo se carga
En la página del juego, en este orden: supabase-js, `js/core/portal2027-conexion.js`, `js/core/portal2027-permisos.js`, `js/core/portal2027-integracion-ejercicios.js`. El estudiante debe tener sesión iniciada.

## Funciones
```js
const ini = await portal2027.ejercicios.iniciarEjercicio(ejercicioId);
// { ok, puedeJugar, motivo, claveEnvio, cuentaNota, mejorNota, participacion, tamanoEquipo, ... }
// ok:false → { ok:false, error } (sin conexión, sin permiso...). No guarda nada.
// puedeJugar:false → mostrar `motivo` (periodo cerrado, trimestre cerrado, equipo sin confirmar...) y no iniciar el juego.

const res = await portal2027.ejercicios.guardarIntento(ejercicioId, ini.claveEnvio, nota); // nota de 0 a 5
// { ok:true, repetido, cuentaNota, intentos, mejorNota }  |  { ok:false, error }
```
- `claveEnvio` la entrega `iniciarEjercicio`, una por partida. **Reenviar con la misma clave es seguro**: no crea otro intento (`repetido:true`).
- Mostrar «guardado» **solo** si `ok:true`. Si `ok:false` por red, avisar que **no se guardó** y ofrecer reintentar con la misma clave.
- `cuentaNota:false` (modo práctica): el intento se guarda pero nunca da nota; el juego debe decirlo.
- `mejorNota` es la mejor nota guardada del estudiante (o de su equipo) en ese ejercicio; el juego solo la muestra.

## Reglas que aplica la base (el juego no puede saltárselas)
- Periodo cerrado, trimestre cerrado o ejercicio en papelera: se rechaza el intento.
- Ejercicio de equipo: solo juegan integrantes de un equipo de 2, 3 o 4 con **todos confirmados**; el intento cuenta para todo el equipo y solo los integrantes confirmados reciben la nota.
- Se conserva la mejor nota por ejercicio (3.0, 4.6, 4.0 → 4.6). Los intentos nunca se borran ni se editan.

## Limitación importante
La nota del intento **la calcula la página del juego en el navegador**; la base solo verifica que esté entre 0 y 5. Un estudiante con conocimientos técnicos podría enviar una nota falsa. Por eso el profesor revisa cada consolidación (la ve con su detalle) y la nota queda con historial. Validar la jugada en el servidor requiere una función por juego (ver «Pendiente»).

## Para un juego nuevo
Entregar la página en `pages/ejercicios/portal2027-<nombre>.html`, usar solo las dos funciones de arriba, y registrar el ejercicio en el portal (el campo `juego` guarda `<nombre>`).
