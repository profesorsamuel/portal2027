# División gradual de JavaScript (propuesta)

No dividir módulos todavía. Para cada módulo grande:
1. Registrar sus funciones públicas y dependencias.
2. Añadir pruebas de comportamiento antes de extraer código.
3. Extraer primero utilidades puras sin acceso a DOM ni Supabase.
4. Mantener nombres, orden de carga y contratos existentes.
5. Probar las páginas afectadas y revertir ante cualquier diferencia.

**Estado:** planificación; ningún archivo JS modificado.
