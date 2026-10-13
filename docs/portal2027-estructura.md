# portal2027 — estructura (etapas 1 a 8)

Portal del C.E.B.G. El Jiral. HTML/CSS/JS modular, publicado con GitHub Pages desde `main` / raíz, con Supabase (Auth y base de datos).

## Archivos

| Ruta | Función |
|---|---|
| `index.html` | Entrada: inicio de sesión, recuperación de contraseña, elección de panel. |
| `pages/portal2027-admin.html`, `-profesor.html`, `-estudiante.html`, `-consejero.html` | Un panel por rol. |
| `assets/css/portal2027-base.css` | Estilos base (etapa 0). |
| `assets/css/portal2027-componentes.css` | Formularios, mensajes y tablas de datos. |
| `js/core/portal2027-conexion.js` | Conexión con Supabase: URL y clave publicable. |
| `js/core/portal2027-permisos.js` | Sesión, roles y utilidades comunes. |
| `js/modulos/portal2027-acceso.js` | Lógica de `index.html`. |
| `js/modulos/portal2027-panel.js` | Estructura de los paneles y vistas de profesor, estudiante y consejero. |
| `js/modulos/portal2027-admin.js` | Panel de administración. |
| `js/modulos/portal2027-estudiantes.js` | Etapa 2: importación de Excel, lista, invitación y foto de perfil (administración, profesor y estudiante). |
| `pages/portal2027-libreta.html` | Libreta por año/grupo/materia/trimestre (profesor y administración). |
| `js/core/portal2027-evaluacion.js` | Motor único de cálculo de notas. |
| `js/modulos/portal2027-libreta.js` | Pantalla de la libreta. |
| `assets/css/portal2027-libreta.css` | Estilos de la libreta. |
| `pages/portal2027-asistencia.html` | Etapa 4A: asistencia por sesión (profesor y administración). |
| `js/modulos/portal2027-asistencia.js` | Pantalla de asistencia. |
| `assets/css/portal2027-asistencia.css` | Estilos de la asistencia (usa también los de la libreta). |
| `js/modulos/portal2027-config.js` | Etapa 4B: configuración académica (periodos, pesos, estados) en el panel de administración. |
| `js/modulos/portal2027-consejeria.js` | Etapa 5: consejeros por grupo (administración) y vista del grupo (consejero). |
| `js/modulos/portal2027-estudiante-academico.js` | Etapa 6: notas publicadas y asistencia del propio estudiante. |
| `pages/portal2027-clases.html` | Clases y tareas por asignación (profesor y administración). |
| `js/modulos/portal2027-clases.js` | Materiales, tareas, entregas y revisión. |
| `js/modulos/portal2027-clases-comun.js` | Validación y apertura segura de archivos. |
| `js/modulos/portal2027-clases-estudiante.js` | «Mis clases y tareas» del estudiante. |
| `assets/css/portal2027-clases.css` | Estilos de clases y tareas. |
| `js/modulos/portal2027-cierre.js` | Etapa 7B: panel de cierre trimestral dentro de la libreta (revisión previa, cerrar, reabrir, copias e historial). |
| `pages/portal2027-reporte.html`, `js/modulos/portal2027-reporte.js` | Etapa 7B: reporte del trimestre por materia y grupo (copia de cierre o datos actuales), imprimible, con avisos en borrador. |
| `js/modulos/portal2027-avisos.js` | Etapa 7B: avisos a acudientes como borradores editables y copiables; no envía nada. |
| `assets/css/portal2027-reportes.css` | Estilos de reportes, avisos e impresión. |
| `js/modulos/portal2027-documentos.js` | Etapa 8B: documentos privados. Estudiante sube y sustituye; administración define tipos, revisa y ve faltantes; consejero revisa su grupo. |
| `js/datos/portal2027-docentes-2026.js`, `js/modulos/portal2027-docentes.js` | Directorio de docentes 2026 por nivel (Premedia, Primaria, Apoyo) en «Personas», con búsqueda y descarga en Excel. Sin teléfonos: el sitio es público. |
| `pages/portal2027-seguimiento.html`, `js/modulos/portal2027-seguimiento.js`, `assets/css/portal2027-seguimiento.css` | Seguimiento por asignación (solo lectura): estudiantes en riesgo (por trimestre o acumulado T1+T2 → qué necesita en T3, con borradores de aviso), planilla de notas trimestrales con ausencias y tardanzas (imprimible) y cuadro de fracaso escolar con meta. Usa el motor único; no escribe en la base. Se abre desde «Seguimiento» en el panel del profesor. |
| `js/modulos/portal2027-respaldos.js` | Etapa 9B: sección «Respaldos» de administración (anotar copias externas con resultado real y ver el estado por tipo). La recuperación de notas está en el historial de la libreta. |
| `js/core/portal2027-integracion-ejercicios.js` | Etapa 6A (guía): contrato de los juegos: `iniciarEjercicio` y `guardarIntento`. Nunca escribe notas; ver `docs/portal2027-integracion-ejercicios.md`. |
| `js/modulos/portal2027-ejercicios.js` | Etapa 6B (guía): pantalla del profesor/administración: periodos, ejercicios, equipos, cierre y consolidación a la libreta. |
| `js/modulos/portal2027-estudiante-ejercicios.js` | Etapa 6B: «Mis ejercicios virtuales» del estudiante (confirmar equipo y abrir el juego). |
| `pages/ejercicios/portal2027-ejemplo-suma.html` | Juego de ejemplo con datos ficticios; modelo para otros juegos. |
| `assets/css/portal2027-documentos.css` | Estilos de documentos. |
| `supabase/functions/portal2027-invitar-estudiante/` | Etapa 2: invitación validada en el servidor. |
| `supabase/migrations/` | SQL numerado (ver `portal2027-base-de-datos.md`). |

## Qué ya es real

- Inicio y cierre de sesión con Supabase Auth, y recuperación de contraseña por correo.
- Redirección según el rol; con varios roles se elige el panel.
- Administración: personas y roles, años, grupos, materias y asignaciones.
- Profesor: lista de sus grupos y materias; sus estudiantes y ayuda con la foto (etapa 2).
- Libreta (etapa 3): columnas por categoría con tema, +, bloqueo, ocultar y papelera; notas con guardado real, versión e historial; promedios y final con el motor único.
- Asistencia (etapa 4A): sesiones por fecha y bloque, marca por estudiante con estados configurables, conteo por estado, bloqueo, papelera e historial. Sin porcentajes ni pesos.
- Administración (etapa 4B): fechas de trimestres, pesos por categoría y estados de asistencia y de nota. Solo se guardan; no se calculan.
- Consejería (etapa 5): administración asigna consejeros a grupos; el consejero ve estudiantes, acudiente y conteo de asistencia por estado.
- Estudiante (etapa 6): ve sus notas solo de materias publicadas por el profesor y su asistencia, por trimestre. El profesor publica o retira desde la libreta.
- Clases y tareas (guía, etapa 5): el profesor publica materiales y tareas con plazo, revisa entregas y, si la tarea cuenta para nota, la guarda en la libreta con historial; el estudiante entrega sus archivos en Storage privado.
- Documentos (guía, etapa 8): el estudiante sube sus documentos (PDF, JPG o PNG, hasta 5 MB) al bucket privado y los sustituye mientras no estén aprobados; administración define los tipos, revisa y ve los faltantes por grupo; el consejero revisa su grupo. Los archivos se abren con enlace temporal.
- Estudiante: su ficha, grupo y foto propia (etapa 2).
- Administración: importación de estudiantes desde Excel con vista previa, invitación de cuentas y fotos (etapa 2).
- Los permisos los aplica la base (RLS); la interfaz solo decide qué mostrar.

## Qué falta o es provisional

- Consejería: ve su grupo en solo lectura (fichas, asistencia y, desde la etapa 7B, las notas de las materias publicadas).
- Cuentas de personal: se crean en Supabase (Authentication → Users). Las de estudiantes se invitan desde el portal.
- El año lectivo del pie de página (`data-anio`) está escrito a mano.
- La vista simulada de la etapa 0 se retiró del `index.html`.
