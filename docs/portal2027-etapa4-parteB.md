# portal2027 — etapa 4, parte B: configuración académica

Requiere la 4A (`0007` aplicado).

## Qué incluye
- `supabase/migrations/0008_portal2027_configuracion.sql`: tablas `portal2027_pesos_categoria` y `portal2027_estados_nota`, quién/cuándo cambió cada configuración, y validación de fechas de trimestres.
- `js/modulos/portal2027-config.js` (nuevo): sección «Configuración académica» al final del panel de administración.
- Cambiados: `js/modulos/portal2027-panel.js` y `pages/portal2027-admin.html`.

## Instalación
1. Suba los archivos a GitHub conservando carpetas (también `docs/`).
2. En Supabase → SQL Editor ejecute `0008_portal2027_configuracion.sql`. Debe terminar con «Success»; si falla, copie el error completo y no siga.

## Qué se puede configurar (solo administración)
- **Periodos:** fecha de inicio y fin de cada trimestre (opcionales). Los trimestres no pueden cruzarse, y no se puede dejar una sesión de asistencia fuera de las fechas.
- **Pesos por categoría:** apreciación, ejercicio escrito y examen, por año. Vacío = sin definir. Se muestra la suma y se avisa si no da 100; se puede guardar igual.
- **Estados de asistencia:** nombre, abreviatura, orden y activo; se pueden agregar nuevos. El código no cambia.
- **Estados de nota:** «Pendiente» y «Exento» iniciales, con efecto **sin definir**. Todavía no se pueden marcar en la libreta.

## Lo que NO se calcula (condición de la guía)
Ningún peso ni estado se usa aún en notas ni en asistencia. El final sigue siendo el promedio simple de las categorías con nota y la asistencia solo cuenta sesiones por estado. Conectar pesos y estados al motor se hará cuando usted los defina.

## Apreciaciones
La apreciación ya existe como categoría de la libreta (etapa 3). En esta parte no se agregó nada más porque no está especificado qué más debe incluir; ver la pregunta pendiente.

## Pruebas
1. Administración: abra el panel; al final aparece «Configuración académica».
2. Periodos: ponga T1 del 1/3 al 31/5 y guarde; ponga T2 desde el 15/5 → «Las fechas se cruzan con el trimestre 1».
3. Con una sesión de asistencia del 10/6 en T1, intente poner el fin de T1 el 31/5 → «Hay sesiones de asistencia fuera de esas fechas».
4. Pesos: escriba 30, 30 y 40 → suma 100; recargue y verifique que persisten. Borre un peso y guarde → vuelve a «sin definir».
5. Estados: agregue «Retiro anticipado» (RA) → aparece en la lista de estados de asistencia; desactívelo → deja de ofrecerse en las casillas nuevas.
6. Un profesor no ve la sección de configuración y no puede escribir en esas tablas.
7. Compruebe que las notas finales de la libreta no cambian al guardar pesos.

## Revisión de la 4B
- [ ] 0008 sin errores.
- [ ] Fechas cruzadas y sesiones fuera de fechas rechazadas.
- [ ] Pesos y estados persisten; vacío queda «sin definir».
- [ ] La libreta y la asistencia no cambian su resultado.
