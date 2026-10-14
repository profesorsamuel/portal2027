# Portal2027 — Etapa 2 (parcial)

Se incluye el SQL 0023 para redirigir la consolidación de ejercicios virtuales a un registro semanal.

**NO EJECUTAR TODAVÍA EN SUPABASE:** la migración 0022 entregada previamente era un borrador y aún no se ha validado.

El SQL 0023 preserva la validación de configuración `sin_definir`, permisos y cierre de trimestre; solo acepta columnas semanales. Mantiene una entrada por periodo y matrícula usando su identificador en la descripción.

Pendiente antes de producción: completar 0022, comportamiento diario, nota manual, lectura estudiantil, interfaz de desglose, pruebas de integración.
