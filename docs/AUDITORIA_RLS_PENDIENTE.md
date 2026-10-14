# Auditoría RLS y SECURITY DEFINER — plan seguro

No se han verificado políticas contra Supabase real. No ejecutar migraciones nuevas basadas únicamente en este documento.

- Inventariar tablas con RLS y políticas por rol (anon, authenticated, service_role).
- Verificar que el profesor solo acceda a sus asignaciones y que el estudiante solo vea lo autorizado.
- Revisar funciones SECURITY DEFINER: `search_path` fijo, permisos EXECUTE mínimos y validación explícita de identidad y rol.
- Registrar los hallazgos y preparar migración con el siguiente número libre, **0050 solo si está disponible**.
- Probar primero con usuarios ficticios de distintos roles y conservar un plan de reversión.
