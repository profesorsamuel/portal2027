# portal2027 — Adjuntos de tareas y lista de alumnos

Requiere `0050_portal2027_adjuntos_tareas.sql` aplicada después de `0049`.

## Qué hace
- **Profesor / administración:** en cada tarea, la sección «Archivos y enlaces de la tarea» permite agregar un PDF, una imagen JPG/PNG o un enlace https. Hasta 10 adjuntos por tarea.
  - En una tarea nueva, los adjuntos se guardan al presionar **Crear tarea**. Si alguno no se puede subir, la pantalla lo indica y la tarea queda creada para completarla con **Editar**.
  - En una tarea existente, cada adjunto se guarda al agregarlo. **Quitar** pide confirmación y borra el archivo del servidor.
- **Copiar alumnos:** el botón **Copiar lista de alumnos** (encima de las tareas) y el botón **Copiar alumnos** de cada tarea copian la lista del salón en el portapapeles, en el formato `1. Apellidos, Nombres`, una línea por estudiante.
- **Estudiante:** dentro de la tarea aparece «Material de la tarea» con sus adjuntos. Los PDF e imágenes se abren con un enlace temporal de 10 minutos; los enlaces abren en otra pestaña.

## Dónde se guarda
- Archivos: bucket privado `portal2027-materiales`, en `<asignacion>/tareas/<tarea>/<tiempo>-<nombre>`.
- Registro: tabla `portal2027_tareas_adjuntos`, sin escritura directa. Se escribe solo con `portal2027_agregar_adjunto_tarea` y `portal2027_quitar_adjunto_tarea`.
- Lectura de Storage: `portal2027_puede_leer_material` ahora también reconoce los adjuntos de tareas publicadas. Quien edita la asignación o un estudiante del grupo puede leer el archivo; nadie más.
- Estudiantes: reciben los adjuntos solo dentro de `portal2027_mis_clases`, en tareas publicadas de su grupo.

## Instalación
1. Ejecute `supabase/migrations/0050_portal2027_adjuntos_tareas.sql` en el SQL Editor, sin errores.
2. Actualice la versión de caché con `node scripts/portal2027-version.mjs AAAAMMDD` y suba los archivos conservando carpetas.
3. Recargue con Ctrl+F5.

## Pruebas manuales sugeridas (con datos ficticios)
- [ ] Crear una tarea con un PDF, una imagen y un enlace. Verificar que aparecen en la tarea.
- [ ] Como estudiante del grupo, abrir los tres adjuntos y confirmar que se abren.
- [ ] Como estudiante de otro grupo, confirmar que no puede abrir esos archivos.
- [ ] Quitar un adjunto y confirmar que desaparece al recargar.
- [ ] Probar «Copiar alumnos» y pegar la lista en un documento.
- [ ] Probar un enlace sin https:// y un PDF de más de 50 MB: deben rechazarse con mensaje claro.
