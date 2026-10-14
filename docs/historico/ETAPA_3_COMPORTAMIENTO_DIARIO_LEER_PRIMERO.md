# Etapa 3 — comportamiento diario (solo base de datos)

Este paquete incorpora una migración SQL nueva, sin reemplazar las migraciones 0022/0023 anteriores.

**No ejecutar en producción todavía:** 0022 y 0023 siguen siendo borradores sin integración completa. La migración 0024 debe revisarse junto a ellas antes de instalar.

La función `portal2027_guardar_comportamiento(sesion, matricula, estado, version)` admite `bien`, `mal` o NULL. Usa permisos, trimestre cerrado, bloqueo de sesión, control de versión e historial inmutable. Las tablas solo permiten SELECT al docente autorizado.

Pendiente: agregar selector Bien/Mal en asistencia.js, botones Traer asistencia/comportamiento en libreta.js, sincronización semanal, corrección manual y pruebas integrales.
