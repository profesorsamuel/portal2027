# portal2027 — pruebas finales y decisiones pendientes

Todas las etapas de la guía (0 a 9) tienen su implementación. Antes de usar **datos reales**, falta probarlas con **datos ficticios** y cerrar las decisiones de abajo. Marque cada casilla con fecha; no avance si alguna falla (use el prompt «Corregir un fallo» de la guía).

## Revisión estática hecha (sin base de datos)
- Todos los `src` y `href` de `index.html` y `pages/` apuntan a archivos que existen; todos los `.js` pasan la revisión de sintaxis.
- Todas las tablas creadas en `supabase/migrations/` tienen RLS activado.
- No hay claves secretas en el código del navegador; la clave secret solo se usa en los scripts de respaldo (variable de entorno) y en la función del servidor.
- Todos los archivos propios llevan el prefijo `portal2027-`.
- **Para limpiar (decida usted):** existe `migrations/0012_portal2027_cierre_trimestral.sql` en la raíz, fuera de `supabase/migrations/`. Es la versión no repetible; la correcta es la de `supabase/migrations/`. Conviene borrar la de la raíz para no ejecutarla por error.
- **Lo que esta revisión NO prueba:** ninguna migración se ha ejecutado aquí ni se ha abierto ninguna pantalla en un navegador. Eso lo cubren las casillas siguientes.

## Orden de instalación en un proyecto nuevo (o de prueba)
Ejecutar en el SQL Editor, en orden: `0001` a `0016` de `supabase/migrations/` (la 0004 crea el administrador inicial). Luego publicar el repositorio en GitHub Pages desde `main`/root.

## Casillas por etapa (resumen de las revisiones de la guía)
- [ ] **0 Primera vista:** abre en computadora y celular; el CSS carga.
- [ ] **1 Acceso:** un alumno no ve a otros; un profesor solo ve sus grupos; cerrar sesión bloquea las consultas; los enlaces de recuperación funcionan.
- [ ] **2 Excel y foto:** reimportar no duplica; grado 9 y sección C forman 9C; una ficha sin correo funciona; la foto ajena está protegida.
- [ ] **3 Libreta:** apreciaciones 4 y 5, ejercicio escrito 3 y examen vacío dan final 3.8; todo vacío da «sin nota»; ocultar no cambia el cálculo.
- [ ] **4 Asistencia:** periodo y trimestre correctos; una ausencia no se vuelve cero; no hay dos registros de la misma sesión.
- [ ] **5 Clases y tareas:** el alumno entrega y recibe comentario; revisar dos veces no duplica la nota; los adjuntos están protegidos.
- [ ] **6 Ejercicios virtuales:** intentos 3.0, 4.6, 4.0 conservan 4.6; solo integrantes confirmados reciben nota; dos envíos no duplican (casillas detalladas en `portal2027-ejercicios-parteB.md`).
- [ ] **7 Reportes y cierre:** libreta y reporte coinciden; el cierre bloquea cambios; el siguiente trimestre no borra el anterior.
- [ ] **8 Documentos:** no se leen documentos ajenos; los faltantes corresponden al año; una carga inválida muestra un error.
- [ ] **9 Respaldos:** se recupera una nota; la copia de prueba restaura registros y archivos; un fallo de red no indica guardado exitoso (ver `portal2027-etapa9-parteA.md` y `-parteB.md`).

## Pruebas transversales (la guía las pide antes de datos reales)
- [ ] Permisos con cuatro cuentas de prueba: administrador, profesor, consejero y alumno; cada una solo ve lo suyo.
- [ ] Cálculos en pantalla, en el reporte y en el cierre dan el mismo número.
- [ ] Duplicados: importar dos veces, enviar dos veces, consolidar dos veces.
- [ ] Celular real: libreta, entrega de tarea, documentos y juego.
- [ ] Fallos de red en cada guardado: nunca aparece «guardado» si no se guardó.
- [ ] Respaldo diario y archivos hechos y **restaurados en otra base**; anotados en «Respaldos» con el resultado real.

## Decisiones que solo usted puede tomar (no se inventaron)
1. **Cómo se combinan los ejercicios virtuales y qué pasa con los faltantes** (la propuesta de la guía: promedio de las mejores notas, el ejercicio sin intentos no cuenta). Hasta decidirlo, la consolidación sigue bloqueada.
2. Supuestos de la parte A de ejercicios: guardar el promedio con 2 decimales; si las fechas del periodo bloquean intentos; si la consolidación puede reemplazar una nota escrita a mano.
3. **Aprobación, cálculo anual y criterios de honor.** El portal no calcula promedio anual ni honor.
4. **Respaldos:** nombres del responsable titular y suplente, frecuencia y retención (propuesta en `portal2027-etapa9-parteA.md`).
5. Otros supuestos marcados en los docs de cada etapa (por ejemplo, que el consejero vea el teléfono del acudiente).

## Limitaciones conocidas
- La nota de un intento de ejercicio virtual la calcula el navegador; la base solo comprueba que esté entre 0 y 5.
- El plan gratuito de Supabase no hace copias automáticas y pausa el proyecto tras 7 días sin actividad.
- Los scripts de respaldo y la restauración no se han ensayado contra su Supabase real.
