# Acceso de estudiantes con grado, nombre y cédula

El estudiante entra en `index.html` (pestaña «Soy estudiante»): elige su grado, escribe su nombre y apellido,
y usa su número de cédula como contraseña. Docentes y familias siguen entrando con correo (pestaña «Docente o familia»).

## Cómo funciona
- `portal2027-crear-accesos` (solo administración): por cada estudiante crea una cuenta interna
  (`codigo@estudiantes.portal2027.app`, sin correo real) con la cédula como contraseña, la vincula a la ficha y le da el rol estudiante.
  La cédula **no se guarda en ninguna tabla**; Supabase Auth solo guarda su hash.
- `portal2027-buscar-estudiante` (pública): da la lista de grados y, con grado + nombre y apellido, devuelve el correo interno
  de quien coincide. Nunca recibe ni devuelve la cédula.
- El navegador verifica la cédula directamente con Supabase Auth (`signInWithPassword`).
- "8-123-456", "8123456" y "8 123 456" valen igual (se quitan guiones y espacios y se pasa a mayúsculas). Mínimo 6 letras o números.

## Instalación (una sola vez, en este orden)
0. **Primero la base:** en Supabase > SQL Editor ejecute, en este orden, `0017_portal2027_sexo_estudiante.sql`
   (agrega la columna `sexo`) y `0018_portal2027_nombre_completo.sql` (permite apellidos vacíos y ajusta la importación).
   Si sube la web antes de hacerlo, la pantalla de Estudiantes dará error.
1. Desplegar dos funciones:

```bash
supabase functions deploy portal2027-crear-accesos --no-verify-jwt
supabase functions deploy portal2027-buscar-estudiante --no-verify-jwt
```

Si despliega desde el panel web de Supabase: en **las dos** funciones desactive **Verify JWT**.
- `portal2027-buscar-estudiante` es pública (se usa antes de iniciar sesión).
- `portal2027-crear-accesos` también debe ir sin Verify JWT: con él activado, el navegador es bloqueado por CORS porque la
  consulta previa (OPTIONS) no lleva sesión. No pierde seguridad: la función misma comprueba en el servidor que quien llama
  sea administrador activo (igual que `portal2027-invitar-estudiante`).

## Uso
1. Descargue la plantilla nueva (Administración → Estudiantes → «Descargar plantilla de Excel»). Trae la columna `cedula`
   (formato Texto, para que Excel no quite guiones ni ceros).
2. Llene una fila por estudiante, incluida su cédula, y súbala. La vista previa muestra la cédula oculta (`••••456`).
3. Al confirmar, se importan los estudiantes **y** se crean sus accesos en el mismo paso. Ya pueden entrar.

Columna `nombres` (nombre completo, ya no hay columna `apellidos`): escriba «Apellidos, Nombres» con coma o punto y coma
(`Abrego, Yerlyn` o `BEST; LIANELYS`). El portal separa el apellido (antes del signo) del nombre (después) y, si todo viene en
MAYÚSCULAS, lo pasa a formato normal (`Best, Lianelys`). Sin coma ni punto y coma, todo queda como nombre y el apellido vacío
(las listas se ordenarán peor). Un Excel antiguo que aún traiga la columna `apellidos` también se acepta.

Columna `sexo`: escriba **Femenino** o **Masculino** (también vale F o M). Es obligatoria para estudiantes nuevos o que aún no
tienen sexo registrado; en la plantilla trae una lista desplegable. Se muestra en la lista de estudiantes.

Reglas de la columna `cedula`:
- Obligatoria para estudiantes que aún no tienen acceso. Si ya lo tienen, puede quedar vacía (si viene, cambia su contraseña).
- Mínimo 6 letras o números (se ignoran guiones y espacios). No puede repetirse dentro del archivo.
- Un Excel antiguo sin esa columna se rechaza con un aviso para descargar la plantilla nueva.
- La cédula no se envía a la función de importación de la base ni se guarda en tablas.

El bloque «Accesos de estudiantes con cédula» queda solo para corregir o cambiar cédulas después
(Excel/CSV con `codigo_estudiante` y `cedula`).

## Seguridad: lo que conviene saber
- La cédula es un dato conocido por compañeros y familiares: quien sepa el grado, el nombre y la cédula de otro estudiante
  puede ver sus notas. Para este portal (notas, asistencia, tareas) el riesgo es aceptable para muchos centros, pero es una decisión de la dirección.
- Recomendado: pedir al estudiante que cambie su contraseña tras el primer ingreso (queda como mejora futura).
- Supabase limita los intentos de inicio de sesión por IP (Authentication → Rate Limits); no lo desactive.
- Dos estudiantes del mismo grado con el mismo nombre y apellido funcionan: se prueba la cédula con cada uno.
