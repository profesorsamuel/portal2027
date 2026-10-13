# Etapa 7 — Parte C: Cuadro de estudiantes aprobados y reprobados

## Propósito
Implementar en Portal2027 el cuadro de aprobados y reprobados del C.E.B.G. El Jiral, tomando como referencia el PDF «Cuadro_Aprobados_Ciencias_Naturales_Trimestre_2.pdf» del sistema anterior. **Este documento es un prompt de implementación pendiente; no significa que la funcionalidad esté instalada.**

## Integración y dependencias
- Continuar la etapa 7, partes A y B (`docs/portal2027-reportes-cierre-parteA.md` y `...parteB.md`).
- Reutilizar `js/core/portal2027-evaluacion.js` y la nota final oficial de la libreta; nunca calcular una segunda nota contradictoria.
- Reutilizar las asignaciones de profesor, materias, grupos, año, jornada y estado de matrícula de Supabase. Respetar RLS y permisos.
- Trimestre abierto: resultados provisionales calculados con notas actuales. Cerrado: utilizar la copia de cierre seleccionada y etiquetar la versión.
- No cambiar migraciones ni pantallas existentes sin analizar dependencias; no duplicar tablas ni notas.

## Pantalla
Agregar al panel del docente «Aprobados y reprobados». Filtros: año lectivo (2027 por defecto), trimestre 1/2/3, materia asignada, jornada y casillas de grupos impartidos; selección de uno, varios o todos. Botones «Generar cuadro», «Descargar PDF», «Imprimir» y «Regresar a Docente». Actualizar cuando cambien filtros o notas, sin perder observaciones guardadas.

## Clasificación de estudiantes
- Cada estudiante matriculado se cuenta una sola vez por materia/grupo/trimestre.
- Aprobado: nota final oficial >= 3.0; reprobado: nota final oficial < 3.0; sin calificaciones: ninguna nota válida; retirado: estado de retiro documentado.
- No convertir automáticamente en retirado a quien no tenga notas. Si la nota es provisional, indicarlo claramente.
- El motor de evaluación y sus reglas actuales de ponderación, ausencias, celdas vacías, redondeo y cierres prevalecen sobre ejemplos del sistema anterior.
- Verificar si los retirados forman parte de la matrícula estadística oficial; documentar y aplicar un criterio único sin contarlos dos veces. Mostrar aviso cuando falte sexo o haya registros inconsistentes; nunca inferirlo.

## Tabla oficial
Encabezado: «MINISTERIO DE EDUCACIÓN – DIRECCIÓN REGIONAL DE COLÓN – C.E.B.G. EL JIRAL»; «CUADRO DE ESTUDIANTES APROBADOS Y REPROBADOS»; «NOMBRE DEL PROFESOR». Metadatos: ASIGNATURA, NIVELES, TRIMESTRE, AÑO LECTIVO, JORNADA.

Columnas agrupadas, con una fila por grupo y fila final TOTALES:
1. GRADO
2. MATRÍCULA POR GRADO
3. APROBADOS: M, F, TOTAL, %
4. REPROBADOS HASTA LA FECHA: M, F, TOTAL, %
5. SIN CALIFICACIONES: H, M, TOTAL, %
6. RETIRADOS: H, M

Mantener las etiquetas tal como figuran en el PDF, aunque en la implementación se normalicen internamente los códigos de sexo. Si hay registros de sexo desconocido, incluirlos en totales generales y advertir que el desglose no coincide.

## Fórmulas y controles
% aprobados = aprobados / matrícula × 100; % reprobados = reprobados / matrícula × 100; % sin calificaciones = sin calificaciones / matrícula × 100. Mostrar dos decimales; si matrícula = 0, mostrar 0.00% y evitar división entre cero. En TOTALES, sumar conteos y calcular porcentajes sobre la matrícula total (nunca promediar porcentajes de grupos). Comprobar conciliación entre matrícula y categorías según el criterio definido para retirados.

**Ejemplo del PDF original (2026, Ciencias Naturales, trimestre 2, 8.º A):** matrícula 26; aprobados 24 (92.31%); reprobados 2 (7.69%); sin calificaciones 0 (0.00%); retirados 0. Este ejemplo es de referencia, no debe precargarse como datos reales de 2027.

## Estudiantes que deben cuidar su nota de examen
Bajo la tabla, sección «Estudiantes que deben cuidar su nota de Examen»: mostrar grupo, estudiante, promedios pertinentes y nota mínima de examen para aprobar. Solo incluir estudiantes pendientes de examen cuando se pueda calcular con seguridad. En el sistema de ejemplo, si las tres categorías pesan igual, nota mínima = 3×3.0 − promedio apreciación − promedio ejercicios escritos; **no aplicar esa fórmula si Portal2027 utiliza otra ponderación**. Cuando no haya estudiantes, mostrar «No hay estudiantes aprobados a la espera de nota de Examen en los grados seleccionados».

## Retirados, notas y firmas
Incluir «CAUSAS DEL RETIRO DEL ALUMNO SIN CALIFICACIONES:», con observaciones editables y persistentes en Supabase por año, materia, trimestre y grupo, con permisos y auditoría. No guardar información personal innecesaria.

NOTA:
1. Haga el % de cada nivel y por asignatura.
2. Deberá remitir a la Dirección 1 original y 1 copia.
3. El/la profesor(a) de la asignatura y la dirección deberán conservar una copia.
4. En la columna de reprobados anotar la cantidad hasta la fecha.

Añadir líneas «FIRMA DEL PROFESOR» y «FIRMA DEL DIRECTOR».

## Exportación
PDF A4 horizontal, fondo blanco, encabezados morados/azules, tabla con bordes, porcentajes a dos decimales, totales destacados, observaciones, notas y firmas. Vista previa idéntica a impresión. Evitar cortes de filas; si ocupa más de una página, paginar y repetir encabezados. Nombre `Cuadro_Aprobados_[Materia]_[Trimestre]_[Año]_[Grupo].pdf`; usar `Varios_Grupos` si aplica. Puede utilizar jsPDF/html2canvas u otra solución estable; comprobar legibilidad y ajuste a la página.

## Mejoras solicitadas
Indicadores de matrícula, aprobados, reprobados y sin notas; informe por grupo o consolidado por materia; exportación masiva opcional de un PDF por materia/trimestre; alertas de estudiantes en riesgo y registros incompletos; historial de generación con fecha y usuario; diseño responsive; actualización automática cuando cambien notas, sin modificar las calificaciones originales.

## Entregables al implementar esta etapa
Archivos HTML/CSS/JS separados siguiendo la estructura del proyecto, migración SQL solo si realmente es necesaria, documentación de instalación, pruebas de cálculo con varios grupos, notas faltantes, retirados, sexo no registrado, trimestre abierto/cerrado y comparación PDF/pantalla. Entregar únicamente archivos nuevos o modificados en ZIP. No tocar funciones ajenas que ya trabajan correctamente.
