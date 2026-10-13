# Horario editable 2027

Suba las carpetas `data`, `pages` y `js` a la raíz de GitHub respetando las rutas. No cargue el JSON en Supabase SQL Editor.

En Horario y calendario pulse **Cargar horario de Samuel 2027 (editable)**. El portal leerá `data/horarios/horario-samuel-2027.json`, buscará las asignaciones reales en Supabase y rellenará el cuadro JSON. Si faltan 9A Naturales, 8A Naturales, 8A Informática o 8B Informática, debe crearlas primero en Administración; de lo contrario la importación se rechazará sin reemplazar el horario.

Revise las franjas y pulse **Validar y reemplazar horario**. Después podrá modificar cada franja con **Editar**, **Guardar franja**, **Nueva franja** y **Eliminar**. No hace falta editar archivos para cambiar un horario ya guardado.

El archivo JSON de plantilla se puede editar en GitHub para cambiar el horario de referencia. Importarlo reemplaza el horario guardado de ese profesor y año, por lo que confirme antes de hacerlo.
