# Índice de documentos de `docs/`

Estos documentos son una **bitácora histórica**: describen el estado del proyecto cuando se escribieron (cantidad de migraciones, pendientes, avisos de «no ejecutar»). Para instalar y desplegar hoy, use el [README](../README.md).

Las etapas se numeraron dos veces a lo largo del proyecto (la primera guía de 9 etapas y las entregas de octubre de 2026), por eso dos documentos pueden decir «Etapa 3» o «Etapa 5» y tratar temas distintos. Use las secciones de este índice para distinguirlos.

## Empiece aquí

| Documento | Contenido |
| --- | --- |
| [ETAPA_7_PRUEBAS_MANUALES.md](ETAPA_7_PRUEBAS_MANUALES.md) | Comprobaciones manuales en un Supabase de prueba (lo que `npm test` no cubre). |
| [VERIFICACION_SUPABASE_REAL.md](VERIFICACION_SUPABASE_REAL.md) | Qué falta verificar en el Supabase real (migraciones 0047–0049, funciones, límites). No certifica pruebas hechas. |
| [PLAN_RESTANTE_PORTAL2027.md](PLAN_RESTANTE_PORTAL2027.md) | Trabajo restante y orden seguro. |
| [portal2027-estructura.md](portal2027-estructura.md) | Estructura de archivos del proyecto (etapas 1 a 8). |
| [portal2027-base-de-datos.md](portal2027-base-de-datos.md) | Inventario de tablas, funciones, RLS y migraciones. |

## Seguridad, acceso y claves

| Documento | Contenido |
| --- | --- |
| [ESTADO_REAL_SEGURIDAD_Y_SIGUIENTES_PASOS.md](ESTADO_REAL_SEGURIDAD_Y_SIGUIENTES_PASOS.md) | Estado de seguridad y siguientes pasos. |
| [REVISION_SEGURIDAD_0047_0049.md](REVISION_SEGURIDAD_0047_0049.md) | Comprobaciones pendientes de las migraciones 0047–0049. |
| [portal2027-verificacion-seguridad-pendiente.md](portal2027-verificacion-seguridad-pendiente.md) | Verificación de seguridad pendiente (sin ejecutar en producción). |
| [AUDITORIA_ACCESO_PENDIENTE.md](AUDITORIA_ACCESO_PENDIENTE.md) | Comprobaciones de acceso pendientes en Supabase. |
| [AUDITORIA_RLS_PENDIENTE.md](AUDITORIA_RLS_PENDIENTE.md) | Auditoría de RLS y SECURITY DEFINER: plan seguro. |
| [ETAPAS_ACCESO_PRUEBAS_PENDIENTES.md](ETAPAS_ACCESO_PRUEBAS_PENDIENTES.md) | Paquete agrupado de comprobaciones de acceso (sin activación). |
| [VALIDACIONES_ACCESO_ETAPAS_AGRUPADAS.md](VALIDACIONES_ACCESO_ETAPAS_AGRUPADAS.md) | Validaciones agrupadas de acceso. |
| [REVISION_SEGUIMIENTO_SEGURIDAD.md](REVISION_SEGUIMIENTO_SEGURIDAD.md) | Revisión limitada del módulo de seguimiento. |
| [REVISION_HTML_Y_CSP.md](REVISION_HTML_Y_CSP.md) | Revisión de HTML y CSP, pendiente de implementación. |
| [portal2027-auditoria-csp.md](portal2027-auditoria-csp.md) | Auditoría previa de CSP (sin activar). |
| [portal2027-acceso-estudiantes-cedula.md](portal2027-acceso-estudiantes-cedula.md) | Acceso de estudiantes con grado, nombre y cédula. |
| [portal2027-criterios-activacion-claves.md](portal2027-criterios-activacion-claves.md) | Condiciones antes de activar claves temporales. |
| [portal2027-guia-claves-temporales.md](portal2027-guia-claves-temporales.md) | Guía de entrega de claves temporales. |
| [portal2027-pruebas-y-transicion-claves.md](portal2027-pruebas-y-transicion-claves.md) | Plan de pruebas y transición a contraseñas temporales. |
| [portal2027-recuperacion-individual.md](portal2027-recuperacion-individual.md) | Recuperación individual de acceso (propuesta, no implementada). |
| [portal2027-cache-y-service-worker.md](portal2027-cache-y-service-worker.md) | Caché y service worker (propuesta sin activar). |

## Instalación y pruebas por etapa (primera guía, etapas 1 a 9)

| Documento | Contenido |
| --- | --- |
| [portal2027-etapa1-instalacion.md](portal2027-etapa1-instalacion.md) | Etapa 1, parte A: base de datos, Auth, administrador inicial y pruebas de permisos. |
| [portal2027-etapa1-parteB.md](portal2027-etapa1-parteB.md) | Etapa 1, parte B: publicación y pruebas. |
| [ETAPA_2_PARCIAL_LEER_ANTES_DE_INSTALAR.md](ETAPA_2_PARCIAL_LEER_ANTES_DE_INSTALAR.md) | Etapa 2 (parcial): SQL 0023 de consolidación semanal; aviso de no ejecutar todavía. (Antes `LEER-ANTES-DE-INSTALAR.md`.) |
| [portal2027-etapa2-instalacion.md](portal2027-etapa2-instalacion.md) | Etapa 2: Excel y fotografía. |
| [portal2027-etapa3-parteA.md](portal2027-etapa3-parteA.md) | Etapa 3, parte A: base de la libreta y motor de cálculo. |
| [portal2027-etapa3-parteB.md](portal2027-etapa3-parteB.md) | Etapa 3, parte B: pantalla de la libreta. |
| [ETAPA_3_COMPORTAMIENTO_DIARIO_LEER_PRIMERO.md](ETAPA_3_COMPORTAMIENTO_DIARIO_LEER_PRIMERO.md) | Etapa 3 (comportamiento diario): migración 0024, solo base de datos. (Antes `LEER_PRIMERO.md`.) |
| [portal2027-etapa4-parteA.md](portal2027-etapa4-parteA.md) | Etapa 4, parte A: asistencia por sesión. |
| [portal2027-etapa4-parteB.md](portal2027-etapa4-parteB.md) | Etapa 4, parte B: configuración académica. |
| [portal2027-etapa5.md](portal2027-etapa5.md) | Etapa 5: consejería. |
| [portal2027-etapa6.md](portal2027-etapa6.md) | Etapa 6: el estudiante ve sus notas y asistencia. |
| [portal2027-clases-tareas-parteA.md](portal2027-clases-tareas-parteA.md) | Clases y tareas, parte A: base, permisos y Storage. |
| [portal2027-clases-tareas-parteB.md](portal2027-clases-tareas-parteB.md) | Clases y tareas, parte B: interfaz. |
| [portal2027-ejercicios-parteA.md](portal2027-ejercicios-parteA.md) | Ejercicios virtuales, parte A: base, permisos y contrato. |
| [portal2027-ejercicios-parteB.md](portal2027-ejercicios-parteB.md) | Ejercicios virtuales, parte B: pantallas y juego de ejemplo. |
| [portal2027-integracion-ejercicios.md](portal2027-integracion-ejercicios.md) | Contrato de integración de ejercicios virtuales. |
| [portal2027-reportes-cierre-parteA.md](portal2027-reportes-cierre-parteA.md) | Reportes y cierre, parte A: cierre trimestral en la base. |
| [portal2027-reportes-cierre-parteB.md](portal2027-reportes-cierre-parteB.md) | Reportes y cierre, parte B: pantallas. |
| [portal2027-reportes-cierre-parteC-aprobados-reprobados.md](portal2027-reportes-cierre-parteC-aprobados-reprobados.md) | Reportes y cierre, parte C: cuadro de aprobados y reprobados. |
| [portal2027-etapa8-parteA.md](portal2027-etapa8-parteA.md) | Documentos privados, parte A: base, permisos y bucket. |
| [portal2027-etapa8-parteB.md](portal2027-etapa8-parteB.md) | Documentos privados, parte B: pantallas. |
| [portal2027-etapa9-parteA.md](portal2027-etapa9-parteA.md) | Respaldos y pruebas finales, parte A: base, copias y plan. |
| [portal2027-etapa9-parteB.md](portal2027-etapa9-parteB.md) | Respaldos y pruebas finales, parte B: pantallas. |
| [portal2027-pruebas-finales.md](portal2027-pruebas-finales.md) | Pruebas finales y decisiones pendientes. |
| [portal2027-respaldos-y-restauracion.md](portal2027-respaldos-y-restauracion.md) | Respaldo y restauración: ensayo seguro. |
| [portal2027-instalacion-y-pruebas-paquete.md](portal2027-instalacion-y-pruebas-paquete.md) | Instalación del paquete ampliado. |

## Entregas de octubre de 2026 (segunda numeración de etapas, 1 a 7)

| Documento | Contenido |
| --- | --- |
| [INSTALACION_ETAPAS_1_A_5.md](INSTALACION_ETAPAS_1_A_5.md) | Instalación acumulativa de las etapas 1 a 5. |
| [ETAPA_3_PROPUESTA_ENTREGAS_MULTIPLES.md](ETAPA_3_PROPUESTA_ENTREGAS_MULTIPLES.md) | Entregas múltiples: propuesta mínima antes de modificar el código. |
| [ETAPA_3_INSTALAR_ENTREGAS_MULTIPLES.md](ETAPA_3_INSTALAR_ENTREGAS_MULTIPLES.md) | Entregas múltiples: instalación y pruebas. |
| [ETAPA_4_LIMITES_Y_PDF.md](ETAPA_4_LIMITES_Y_PDF.md) | Peso de PDF, límites y mensajes. |
| [ETAPA_5_DIVISION_LIBRETA.md](ETAPA_5_DIVISION_LIBRETA.md) | División gradual propuesta de `portal2027-libreta.js`. |
| [ETAPA_5_INSTALACION_Y_PRUEBAS.md](ETAPA_5_INSTALACION_Y_PRUEBAS.md) | Etapa 5: instalación y pruebas. |
| [DIVISION_LIBRETA_PASO_1.md](DIVISION_LIBRETA_PASO_1.md) | División de libreta, paso 1: lectura y normalización de importaciones. |
| [DIVISION_LIBRETA_PASO_2.md](DIVISION_LIBRETA_PASO_2.md) | División de libreta, paso 2: planificador de importación. |
| [DIVISION_LIBRETA_PASO_3.md](DIVISION_LIBRETA_PASO_3.md) | División de libreta, paso 3: interfaz de importación. |
| [DIVISION_LIBRETA_PASO_4.md](DIVISION_LIBRETA_PASO_4.md) | División de libreta, paso 4: navegación por teclado. |
| [DIVISION_LIBRETA_PASO_5.md](DIVISION_LIBRETA_PASO_5.md) | División de libreta, paso 5: preferencias visuales y anchos. |
| [DIVISION_LIBRETA_PASO_6.md](DIVISION_LIBRETA_PASO_6.md) | División de libreta, paso 6: papelera e historial de notas. |
| [DIVISION_LIBRETA_PASO_7.md](DIVISION_LIBRETA_PASO_7.md) | División de libreta, paso 7: desglose y descuentos. |
| [DIVISION_LIBRETA_PASO_8.md](DIVISION_LIBRETA_PASO_8.md) | División de libreta, paso 8: tabla principal. |
| [portal2027-plan-division-js.md](portal2027-plan-division-js.md) | División gradual de JavaScript (propuesta). |

## Horario, boletín y planificación

| Documento | Contenido |
| --- | --- |
| [COMO_CARGAR_HORARIO_2027.md](COMO_CARGAR_HORARIO_2027.md) | Horario editable 2027. |
| [ETAPAS_2_Y_3_HORARIO.md](ETAPAS_2_Y_3_HORARIO.md) | Horario y calendario. |
| [INSTALAR_HORARIO_SAMUEL_2027.md](INSTALAR_HORARIO_SAMUEL_2027.md) | Instalación del horario de Samuel Ortega 2027. |
| [LEEME-horario-ejemplo.txt](LEEME-horario-ejemplo.txt) | Cómo usar el archivo `horario-ejemplo-otro-anio.json`. |
| [INSTALAR_BOLETIN_PDF.md](INSTALAR_BOLETIN_PDF.md) | Boletín de notas en PDF. |
| [INSTALAR_PDF_POR_CLASE.md](INSTALAR_PDF_POR_CLASE.md) | Planificaciones en PDF por clase. |
| [PROMPT_PLANIFICACION_MEDUCA_QUINCENAL_2027.md](PROMPT_PLANIFICACION_MEDUCA_QUINCENAL_2027.md) | Plantilla reutilizable de secuencia didáctica MEDUCA. |
