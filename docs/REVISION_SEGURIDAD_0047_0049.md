# Portal2027 — Comprobaciones pendientes de seguridad

## Hallazgo que requiere revisión

En el ZIP de referencia, `0047_portal2027_estado_clave_temporal.sql` está dentro de `portal2027-seguridad-etapa2-0047/supabase/migrations/`, mientras que 0048 y 0049 están en `supabase/migrations/`. Esto NO demuestra si 0047 fue aplicada o no. Antes de desplegar migraciones, revisar el historial real de Supabase. No ejecutar 0047 por duplicado.

## Verificación en Supabase (manual)

1. En el panel de Supabase, consultar el historial de migraciones y comprobar 0047, 0048 y 0049.
2. Revisar que las Edge Functions estén desplegadas y probar con una cuenta ficticia.
3. Probar límites de solicitudes desde clientes distintos; no inferir protección por la sola presencia del SQL.
4. Confirmar con configuración del proxy que el identificador IP usado no sea un encabezado controlado por el cliente.
5. Revisar la protección del login directo de Supabase Auth frente a fuerza bruta.
6. No activar `PORTAL2027_CLAVES_TEMPORALES` hasta completar las pruebas del primer ingreso, cambio obligatorio y recuperación individual.

## Alcance

Este paquete añade comprobaciones locales y documentación. No cambia funciones, migraciones, políticas RLS ni credenciales. No confirma el estado del servidor Supabase.
