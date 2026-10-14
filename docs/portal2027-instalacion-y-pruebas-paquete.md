# Instalación del paquete ampliado

1. Hacer una copia de seguridad del repositorio.
2. Descomprimir el ZIP y mantener la estructura de carpetas.
3. En GitHub reemplazar únicamente `js/modulos/portal2027-estudiantes.js` y añadir los archivos `docs/`.
4. Confirmar los cambios y esperar publicación de GitHub Pages.
5. Abrir panel administrativo y verificar carga de estudiantes y funcionamiento anterior.
6. Si `crear-accesos` devuelve claves en un entorno de ensayo, comprobar copiar, descargar y borrar; verificar que un lote fallido no borre claves anteriores.
7. Revisar que la consola no imprima claves y que no aparezcan en localStorage.

**No ejecutar SQL. No activar `PORTAL2027_CLAVES_TEMPORALES`.** Las pruebas con Supabase real y el flujo de recuperación todavía están pendientes.
