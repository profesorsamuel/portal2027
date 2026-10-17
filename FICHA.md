# FICHA · Ejercicio virtual · Ciencias Naturales 9.° (A, B y C)

| Campo | Valor |
|---|---|
| **Título sugerido** | Origen del universo, del sistema solar y de la Luna |
| **Slug para el campo «Juego»** | `ciencias9-clase1-origen` |
| **Grado y salones** | 9.° A, B y C (mismo ejercicio y misma dificultad) |
| **Clase / semana** | Clase 1 · Introducción · Semana 1 |
| **Tipo de juego** | 1 · Quiz con vidas y racha (elegido con AUTO) |
| **Modo** | Lo define el campo «Modo» al crear el ejercicio en el portal (obligatorio = da nota · práctica = no da nota). El juego lee `cuentaNota` y se adapta solo; no hay que cambiar código. |
| **Duración estimada** | 8 a 12 minutos (10 preguntas + segunda oportunidad + cierre). Sin límite de tiempo. |

## Objetivo de aprendizaje
Explicar, con apoyo de la evidencia, cómo se originaron el universo (Big Bang), el sistema solar (teoría de la nebulosa y otras teorías) y la Luna (gran impacto), distinguiendo qué teoría es la más aceptada y qué evidencia la respalda.

## Cómo se registra en el portal
1. Crear el ejercicio en el periodo/semana correspondiente.
2. Campo **Juego (página)**: `ciencias9-clase1-origen` (la página se abre como `pages/ejercicios/portal2027-ciencias9-clase1-origen.html`).
3. Elegir **Modo** (obligatorio o práctica) y asignarlo a 9.° A, B y C.

## Estructura de cada partida
- 10 preguntas por partida, tomadas de un banco de **30** (3 veces las usadas; el mínimo pedido era 2.5).
- Bloom por partida: 3 Recordar (30 %) + 4 Comprender (40 %) + 3 Aplicar/Analizar (30 %). Banco: 9 / 12 / 9.
- Orden de dificultad: Recordar → Comprender → Aplicar y analizar. Preguntas y opciones se mezclan en cada partida.
- Puntaje: 10 por pregunta (1.ª oportunidad), 5 en la segunda oportunidad; cada pista descuenta 2 (1 en la segunda oportunidad). Máximo 100 puntos.
- Nota = puntos ÷ 100 × 5, con 2 decimales. La racha no cambia la nota.
- Vidas: 3; si se acaban, se recargan (nadie queda fuera).

## Qué página del PDF usó cada grupo de preguntas
| Página / Parte | Contenido del PDF | Preguntas del banco |
|---|---|---|
| **Pág. 1 · Parte 1** El origen del universo y del sistema solar | Definición de sistema solar, Big Bang, singularidad, 13 800 millones de años, 3 evidencias, evolución de las explicaciones | 10 (4 recordar · 5 comprender · 1 aplicar/analizar) |
| **Pág. 2 · Parte 2** ¿Cómo se formó el sistema solar? | Nebulosa, acreción, planetesimales, Laplace, captura y tabla resumen | 7 (1 · 3 · 3) |
| **Pág. 3 · Parte 3** La teoría moderna de la nebulosa | Beta Pictoris, colapso gravitacional, supernova, vocabulario clave, radiación cósmica de fondo (1965, Penzias y Wilson) | 8 (2 · 3 · 3) |
| **Pág. 4 · Parte 4** El origen de la Luna | Cinco teorías, gran impacto (Tea), exploración lunar como evidencia | 5 (2 · 1 · 2) |
| **«PARA REFLEXIONAR»** (págs. 1 a 4) | Las 4 preguntas del PDF, tal cual | Se muestran al final, sin calificar |

*Nota: el PDF tiene 4 páginas y cada parte ocupa una página.*

## Cierre
- Las 3 ideas clave (Big Bang · teoría de la nebulosa · gran impacto).
- Temas para repasar: partes del PDF donde falló alguna pregunta a la primera.
- Preguntas «Para reflexionar» sin nota.

## Guardado (contrato del portal)
`iniciarEjercicio` → si `!ok` o `!puedeJugar`, muestra el motivo y no inicia → al terminar, `guardarIntento(ejercicioId, claveEnvio, nota)`.
«Guardado» solo si `ok:true`; si falla, dice que NO se guardó y ofrece «Reintentar guardar» con la MISMA `claveEnvio`. Muestra `mejorNota` y avisa si es práctica. No pide nombre; sin localStorage ni sessionStorage; no escribe notas finales.

## Notas de instalación
- La página copia la estructura y la CSP de `portal2027-ejemplo-suma.html` (incluye el script de supabase-js desde jsDelivr, igual que el ejemplo; el juego en sí no usa ningún recurso externo).
- Usa `?v=20261023`, igual que el resto de páginas de ejercicios.
- La prueba `portal2027-csp-inventario` cuenta las páginas HTML y debe actualizarse (+1 página) al instalar esta. Ya fallaba antes por otras causas del repositorio (`portal2027-clases.js`, versiones `?v=` mezcladas); el juego nuevo no agrega fallos nuevos.
