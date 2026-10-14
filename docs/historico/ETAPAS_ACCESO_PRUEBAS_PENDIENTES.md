# Paquete agrupado: comprobaciones de acceso (sin activación)

## Alcance
Estas pruebas locales comprueban estructura del repositorio y una protección contra la activación accidental en dos archivos. **No prueban** la seguridad real de Supabase, los límites por IP ni el primer inicio de sesión. No cambian contraseñas.

## Prueba manual obligatoria antes de activar
1. En entorno de pruebas, crear una cuenta ficticia sin datos personales reales.
2. Crear acceso y confirmar que el panel muestra la clave solo si la Edge Function la devuelve.
3. Verificar que no aparece en almacenamiento local, consola, logs ni tablas.
4. Comprobar que no permite ver datos antes de cambiar la clave, que el cambio es obligatorio y que después puede entrar con la nueva.
5. Simular un segundo lote fallido y confirmar que siguen visibles las claves ya recibidas.
6. Verificar recuperación individual y migración de una cuenta antigua sin alterar las demás.
7. Revisar RLS, permisos, rate limiting y cabeceras de IP en Supabase real.

**No activar `PORTAL2027_CLAVES_TEMPORALES` hasta superar las pruebas reales.**

## Instalación y ejecución
Copiar el test en `tests/` y ejecutar `node --test tests/portal2027-acceso-regresion.test.cjs`. Si ya instaló el paquete anterior que actualiza `package.json`, `npm test` también debe incluirlo. Subir este documento a `docs/`.
