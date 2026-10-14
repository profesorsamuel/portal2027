# Boletín de notas en PDF — Portal2027

Botones **«Descargar boletín en PDF»** e **«Imprimir boletín»** (abre el mismo PDF en otra pestaña) en Seguimiento académico → pestaña **Notas trimestrales**.
Genera una sola página carta vertical, con texto seleccionable y el logo integrado. Solo lee datos: no guarda ni modifica nada.

## Dónde colocar los archivos (respetando carpetas)
| Archivo del ZIP | Destino en el proyecto | Acción |
|---|---|---|
| `js/modulos/portal2027-boletin-pdf.js` | `js/modulos/` | archivo NUEVO |
| `js/modulos/portal2027-seguimiento.js` | `js/modulos/` | REEMPLAZA el existente |
| `pages/portal2027-seguimiento.html` | `pages/` | REEMPLAZA el existente |
| `assets/img/meduca-logo.png` | `assets/img/` (carpeta nueva) | logo real de MEDUCA |
| `supabase/migrations/0040_portal2027_datos_boletin.sql` | `supabase/migrations/` | archivo NUEVO (y ejecutar, ver abajo) |

## SQL
Sí hay que ejecutar **un** script: `0040_portal2027_datos_boletin.sql` (Supabase > SQL Editor > pegar > Run).
- Solo crea una función de lectura; no crea tablas, no cambia ni borra datos. Es seguro repetirlo.
- Es necesario para que salga el **profesor consejero**: la tabla de consejeros solo la ve la administración, y esta función entrega únicamente los nombres a quien puede ver esa asignación.
- Si no se ejecuta, el PDF igual se descarga (con la firma del profesor), pero la línea del consejero queda en blanco para completar a mano.

## Logo
El ZIP ya incluye el logo real de MEDUCA (recortado) en `assets/img/meduca-logo.png`.
Reemplace `assets/img/meduca-logo.png` por el logo real (mismo nombre, PNG o JPG renombrado no; use PNG). Se coloca arriba a la derecha conservando su proporción, sin deformarlo. Lo ideal es un PNG de al menos 600 px de ancho.

## Reglas aplicadas
- Estudiantes: todos los de la asignación, en orden alfabético (el mismo orden de la pantalla).
- Notas con 1 decimal; el cálculo usa los valores originales del motor único (`portal2027.evaluacion`).
- Reprobada = valor **original** menor que 3.0 (el mínimo `MIN` ya definido en `portal2027-seguimiento.js`): rojo con fondo rosado. Por eso una nota 2.96 se muestra «3.0» pero sale en rojo.
- Sin datos = celda en blanco (nunca 0). Ausencias/tardanzas en 0 también quedan en blanco; la ausencia justificada no cuenta.
- Nota final anual: promedio de los trimestres **solo si todos tienen nota**; si falta alguno, queda en blanco.
- Totales de A y T: suma por separado de los trimestres.
- Archivo: `Boletin_<MATERIA>_<GRUPO>_<AÑO>.pdf`.

## Ajuste a una página
Márgenes, anchos, alto de fila y letra se calculan según la cantidad de estudiantes (probado de 0 a 80). Hasta ~45 estudiantes la letra queda en ~7 pt o más.

## Dependencia
Usa jsPDF 2.5.2 desde jsDelivr (con verificación de integridad), igual que el proyecto ya usa Supabase desde CDN. Requiere internet al abrir la página.
