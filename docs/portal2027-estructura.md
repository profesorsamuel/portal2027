# portal2027 — estructura (etapas 1 a 4A)

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
| `supabase/functions/portal2027-invitar-estudiante/` | Etapa 2: invitación validada en el servidor. |
| `supabase/migrations/` | SQL numerado (ver `portal2027-base-de-datos.md`). |

## Qué ya es real

- Inicio y cierre de sesión con Supabase Auth, y recuperación de contraseña por correo.
- Redirección según el rol; con varios roles se elige el panel.
- Administración: personas y roles, años, grupos, materias y asignaciones.
- Profesor: lista de sus grupos y materias; sus estudiantes y ayuda con la foto (etapa 2).
- Libreta (etapa 3): columnas por categoría con tema, +, bloqueo, ocultar y papelera; notas con guardado real, versión e historial; promedios y final con el motor único.
- Asistencia (etapa 4A): sesiones por fecha y bloque, marca por estudiante con estados configurables, conteo por estado, bloqueo, papelera e historial. Sin porcentajes ni pesos.
- Estudiante: su ficha, grupo y foto propia (etapa 2).
- Administración: importación de estudiantes desde Excel con vista previa, invitación de cuentas y fotos (etapa 2).
- Los permisos los aplica la base (RLS); la interfaz solo decide qué mostrar.

## Qué falta o es provisional

- Panel de consejero: solo mensaje de cuenta activa (llega en la etapa 7). Las notas del estudiante llegan en la etapa 3.
- Cuentas de personal: se crean en Supabase (Authentication → Users). Las de estudiantes se invitan desde el portal.
- El año lectivo del pie de página (`data-anio`) está escrito a mano.
- La vista simulada de la etapa 0 se retiró del `index.html`.
