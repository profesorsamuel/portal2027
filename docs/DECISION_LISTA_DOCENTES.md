# Decisión pendiente: lista de docentes 2026

El archivo `js/datos/portal2027-docentes-2026.js` contiene 52 nombres y sus niveles, grupos y asignaturas, sin teléfonos. **No se ha tomado una decisión ni modificado el acceso.**

## A. Mantener pública
No requiere migración ni cambios de código. Ventaja: simplicidad y consulta sin iniciar sesión. Desventaja: cualquier visitante puede descargar los 52 nombres y asociaciones académicas. Pruebas: verificar información autorizada para publicación y ausencia de datos personales adicionales.

## B. Restringir con Supabase y RLS
Crear tabla para docentes, niveles, grupos y asignaturas, políticas SELECT para usuarios autenticados según roles autorizados, y migración **0050 solo si sigue libre** (comprobar antes). Modificar `js/datos/portal2027-docentes-2026.js` y los módulos/páginas que lo importan para cargar datos mediante cliente Supabase después de Auth; retirar el conjunto de datos públicos de GitHub Pages. Comprobar todos los consumidores del archivo antes de planificar el cambio. Pruebas: visitante anónimo sin SELECT, usuarios permitidos con SELECT, roles no autorizados bloqueados, carga y fallos de red, y ausencia de datos en los archivos públicos.

**Pendiente:** autorización del responsable de los datos y verificación de migraciones/RLS en Supabase real. No ejecutar SQL como parte de esta decisión.
