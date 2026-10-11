# portal2027 — estructura (etapa 1)

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
| `supabase/migrations/` | SQL numerado (ver `portal2027-base-de-datos.md`). |

## Qué ya es real

- Inicio y cierre de sesión con Supabase Auth, y recuperación de contraseña por correo.
- Redirección según el rol; con varios roles se elige el panel.
- Administración: personas y roles, años, grupos, materias y asignaciones.
- Profesor: lista de sus grupos y materias.
- Los permisos los aplica la base (RLS); la interfaz solo decide qué mostrar.

## Qué falta o es provisional

- Panel de estudiante y de consejero: solo mensaje de cuenta activa. El grupo y las notas llegan con las etapas 2 y 3.
- Las cuentas nuevas se crean en Supabase (Authentication → Users); la invitación desde el portal llega en la etapa 2.
- El año lectivo del pie de página (`data-anio`) está escrito a mano.
- La vista simulada de la etapa 0 se retiró del `index.html`.
