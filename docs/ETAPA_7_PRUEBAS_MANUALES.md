# Etapa 7 — comprobaciones manuales en Supabase de prueba

Estado de la entrega: las pruebas manuales de Supabase están pendientes.

Validación local realizada:
- Sintaxis: 35 archivos JavaScript correctos.
- Rutas: 171 referencias locales de HTML existentes.
- Comprobaciones de fallo: un JavaScript inválido y una referencia inexistente fueron detectados; los archivos temporales de prueba se retiraron.
- Chromium: la descarga oficial llegó truncada; una instalación alternativa falló al arrancar. La prueba móvil no llegó a ejecutarse y no se declara aprobada. Ejecute los comandos del README en su equipo.
- Los SQL no se ejecutaron; solo se añadieron comentarios a las tres migraciones opcionales.

## Preparar una base vacía

1. Cree un proyecto Supabase de prueba separado. Utilice cuentas y estudiantes ficticios.
2. En `supabase/migrations/` hay **44** archivos (la 0044 añadió recursos por clase). Aplique por número ascendente las migraciones de estructura; anote cada resultado y deténgase ante el primer error.
3. `0003`, `0035` y `0043` están marcadas como **opcionales**. Puede omitirlas en una base nueva: son datos de prueba, asignaciones de Samuel y una reparación específica. Si prueba 0035, primero prepare sus grupos, año y asignaciones requeridos. No ejecútela en una base vacía esperando que cree toda esa configuración.
4. Antes de `0004`, cree el administrador ficticio en Authentication y sustituya el correo de ejemplo. Compruebe el rol resultante.
5. Configure los años, grupos, materias, fechas y asignaciones que necesite. Despliegue las funciones y configure Auth según el README. Use una copia local del portal conectada exclusivamente al proyecto de prueba.

## Recorrer los roles

| Rol | Flujo que se debe comprobar | Resultado esperado |
| --- | --- | --- |
| Administración | Configurar año, grupos, materias, profesores y consejería | Datos válidos guardados; cancelaciones sin cambios. |
| Administración | Importar Excel y repetirlo | Validaciones claras; estudiantes sin duplicados. |
| Profesor | Abrir sus grupos, asistencia, notas, planificación y horario | Solo sus asignaciones; guardado y recarga coherentes. |
| Profesor | Siete clases con PDF, imágenes y enlaces de tareas | Cada recurso aparece en la clase seleccionada. |
| Profesor | Diálogos: cancelar, aceptar, Escape, doble clic | Cancelar no escribe; aceptar ejecuta una sola operación. |
| Profesor | Nota con motivo, historial, papelera y recuperación | Se conserva el historial y se respetan versiones y bloqueos. |
| Profesor | Publicar notas y cerrar trimestre | Lectura estudiantil correcta; escritura bloqueada tras el cierre. |
| Consejero | Notas y documentos de su grupo | Acceso limitado a sus grupos y publicaciones permitidas. |
| Estudiante | Notas propias, tareas, entregas, foto y documentos | Solo sus datos y las clases que le corresponden. |
| Sin sesión | Abrir páginas privadas y llamar consultas | Sin acceso a datos privados. |

## Aislamiento entre estudiantes

1. Cree estudiantes ficticios A y B con matrículas y notas distinguibles.
2. Abra sesiones separadas (perfiles de navegador distintos). Entre como A y compruebe sus notas, documentos, foto y entregas.
3. Intente consultar los identificadores de B mediante las mismas consultas/RPC autenticadas del portal, usando la sesión de A. Compruebe también las rutas de Storage y sus enlaces privados.
4. Resultado esperado: la respuesta no contiene datos privados de B; las escrituras ajenas fallan. Repita invirtiendo A y B y con un profesor sin asignación. Registre la respuesta exacta, sin contraseñas ni tokens.
5. La revisión de la interfaz por sí sola no demuestra aislamiento: deben probarse las consultas directas con la identidad del estudiante.

## Celular y errores

Abra las pantallas autenticadas a 390 × 844 y, si es posible, a 360 px de ancho. Revise tablas cargadas, nombres largos, controles y diálogos. Solo los contenedores de tablas deben desplazarse horizontalmente. Corte la red durante un guardado/subida: no debe aparecer un éxito falso. Compruebe también teclado, foco y Escape.

## Registro de resultados

Copie una fila por prueba y por migración. No marque «correcto» hasta ejecutarla.

| Fecha | Migración o rol/pantalla | Pasos y datos ficticios | Esperado | Resultado real / error | Estado |
| --- | --- | --- | --- | --- | --- |
| — | Instalación 0001–0044 | Base nueva; opcionales según requisitos | Sin errores | Pendiente | Pendiente |
| — | Estudiante A → datos de B | Consulta directa autenticada | Sin acceso | Pendiente | Pendiente |
| — | Profesor / libreta móvil | Notas cargadas a 390 × 844 | Sin scroll general | Pendiente | Pendiente |

No utilice esta base como producción hasta revisar los resultados. Las pruebas automáticas de esta entrega no modifican Supabase.
