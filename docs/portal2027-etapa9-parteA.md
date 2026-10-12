# portal2027 — Respaldos y pruebas finales (etapa 9 de la guía), parte A: base, copias y plan

Requiere `0001`–`0014` aplicados. Esta parte **no cambia pantallas** (las trae la parte B).

## Qué incluye
- `supabase/migrations/0015_portal2027_respaldos_recuperacion.sql` (se puede ejecutar varias veces).
- `scripts/portal2027-respaldo-db.sh` (copia de la base) y `scripts/portal2027-respaldo-storage.mjs` (copia de los archivos).
- `docs/portal2027-etapa9-parteA.md` (esta guía) y `docs/portal2027-base-de-datos.md` actualizado.
- **Ya existía y se conserva:** historial de notas desde la primera edición, papelera de columnas, sesiones, materiales y tareas, y el historial de documentos. Lo nuevo es poder **recuperar una nota** y **registrar los respaldos**.

## Instalación
1. Supabase → SQL Editor → ejecute `0015_portal2027_respaldos_recuperacion.sql` (debe terminar en «Success»).
2. Suba a GitHub: la migración a `supabase/migrations/`, el doc a `docs/` y los scripts a `scripts/`. **Nunca suba copias de respaldo ni claves.**

## Lo más importante (léalo antes de usar datos reales)
- **El plan gratuito de Supabase no hace copias automáticas.** Las copias diarias existen solo en planes de pago, y aun ahí los **archivos de Storage no están incluidos** en la copia de la base. Por eso este paquete trae las dos copias manuales.
- **El repositorio es público** (GitHub Pages gratis lo exige): no guarde copias en el repositorio ni como artefactos de GitHub Actions; contienen datos de estudiantes.
- Un proyecto gratuito se **pausa tras 7 días sin actividad**: haga una copia antes de vacaciones largas.
- Los scripts se probaron aquí solo con un servidor simulado (Storage) y revisión de sintaxis (base). **Falta ensayarlos contra su Supabase real**; ese es el ensayo de restauración de abajo.

## Cómo usar las copias
**Base de datos** (en su computadora, con `pg_dump` instalado):
```
export SUPABASE_DB_URL='postgresql://...'      # Supabase > Connect; si no conecta, use «Session pooler»
./scripts/portal2027-respaldo-db.sh ./respaldos diaria
```
Genera `public.dump` (estructura y datos) y `auth-datos.dump` (cuentas), comprueba que se puedan leer y guarda sus huellas (`SHA256.txt`).

**Archivos** (Node 18+):
```
export SUPABASE_URL='https://xxxx.supabase.co'
export SUPABASE_SERVICE_KEY='...'              # clave secret; solo en su equipo, nunca en el navegador ni en GitHub
node scripts/portal2027-respaldo-storage.mjs ./respaldos
```
Dice «N de M archivos» por bucket y termina con error si falta alguno. Solo lee; no borra nada.

Luego copie la carpeta **fuera del equipo** (disco externo o nube privada) y anótela en el portal con el resultado **real**:
```sql
select public.portal2027_registrar_respaldo('diaria', 'exitoso', 'Prof. Samuel Ortega', 'disco externo A, carpeta 2027-10', null, null, null);
-- tipos: diaria | previa_importacion | previa_cierre | manual | storage | restauracion_prueba
-- resultados: exitoso | parcial | fallido  (parcial y fallido exigen describir qué pasó en detalle)
```
(En la parte B esto será un formulario y un aviso en pantalla.) Estado actual: `select public.portal2027_estado_respaldos();` — un tipo sin copia exitosa aparece vacío; nunca se presume que existe.

## Recuperar una nota
En el historial de la celda, cada fila tiene un `id`. Para devolver la nota al valor **anterior** a ese cambio:
```sql
select public.portal2027_recuperar_nota('<id del historial>', <versión actual de la nota>, 'Motivo');
```
Usa el guardado común: mismos permisos (profesor de la asignación o administración), rechaza columna bloqueada, en papelera o **trimestre cerrado**, y da `CONFLICTO` si la nota cambió. Deja una fila nueva en el historial; el historial viejo no se toca. Columnas, sesiones, materiales y tareas en la papelera ya se restauran desde sus pantallas.

## Propuesta que debe confirmar (la guía pide acordarla)
- **Cuándo:** una copia completa (base + archivos) **al final de cada semana de clases**, y **obligatoria justo antes** de cada importación de estudiantes y de cada cierre trimestral.
- **Retención:** las últimas 4 semanales, una por mes durante el año lectivo y una al cierre de cada trimestre (se conserva todo el año).
- **Responsable:** una persona titular y una suplente, con quien tenga acceso a la copia fuera del equipo. **Pendiente de definir: nombres.**
- Cuenta de la clave de servicio y de la cadena de conexión: solo la persona responsable; si se sospecha que se filtró, regenerarla en Supabase.

## Ensayo de restauración (obligatorio antes de datos reales)
1. Cree un proyecto Supabase **de prueba** distinto del real, vacío.
2. Ejecute allí `0001`–`0015` en orden (incluida la 0004 con un administrador de prueba si hace falta).
3. Restaure las cuentas y luego los datos: `pg_restore --data-only --no-owner -d "<url de prueba>" auth-datos.dump` y después `pg_restore --data-only --no-owner -d "<url de prueba>" public.dump`. Si el disparador de cuentas nuevas crea perfiles duplicados o falla, **copie el error completo**: se ajusta el orden.
4. Suba los archivos de `respaldos/portal2027-storage-.../` a los mismos buckets de prueba y compare cantidades con `resumen.json`.
5. Compruebe: mismo número de estudiantes, notas e historial; el estudiante de prueba abre su documento. Anote el ensayo como `restauracion_prueba` con el resultado real.

## Pruebas finales (casillas)
- [ ] 0015 sin errores.
- [ ] Recuperar una nota: cambiar 4.0 → 3.5 con motivo, recuperar, vuelve a 4.0 y el historial tiene una fila nueva.
- [ ] Recuperar en columna bloqueada o trimestre cerrado se rechaza; versión vieja da CONFLICTO.
- [ ] Un profesor ajeno no puede recuperar la nota; un profesor o estudiante no ve ni registra respaldos.
- [ ] Copia de la base y de Storage con datos ficticios; «N de M» coincide.
- [ ] Ensayo de restauración en otra base y registro con resultado real.
- [ ] Permisos (alumno solo lo suyo), cálculos (4,5 y 3 y vacío → 3,8; todo vacío → sin nota), importar dos veces sin duplicar.
- [ ] Celular: libreta, entrega y documentos. Cortar la red al guardar una nota o subir un documento **no** muestra «guardado».
