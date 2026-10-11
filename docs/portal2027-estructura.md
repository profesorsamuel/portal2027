# portal2027 — estructura (etapa 0)

Portal del C.E.B.G. El Jiral. HTML/CSS/JS modular, publicado con GitHub Pages desde `main` / raíz.

## Archivos de esta etapa

| Ruta | Función |
|---|---|
| `index.html` | Entrada del portal: acceso visual y panel de ejemplo. Nombre obligatorio, queda en la raíz. |
| `assets/css/portal2027-base.css` | Estilos base (colores, tipografía, acceso, panel, tabla, celular). |
| `docs/portal2027-estructura.md` | Este documento. |

Todas las rutas son relativas, así que funciona abriendo el archivo o en GitHub Pages.

## Qué está simulado

- Nombre, grupo y notas del panel (datos ficticios).
- El botón «Entrar»: abre el panel de ejemplo sin validar nada. Se alterna con el ancla `#panel` / `#acceso`, sin JavaScript.
- Los resultados finales de la tabla (3.8, 4.0, «Sin nota») ilustran las reglas de cálculo; aún no hay motor de cálculo.
- «¿Olvidó su contraseña?» no hace nada todavía.
- El año lectivo (`data-anio`) está escrito a mano; será un dato de la base.

## Sin conexión todavía

No hay Supabase, usuarios reales, roles ni datos reales.

## Estructura prevista

```
index.html
pages/            portal2027-profesor.html, -estudiante.html, -consejero.html, -admin.html
assets/css/       portal2027-base.css, portal2027-componentes.css
assets/img/       logos/, iconos/, clases/
js/core/          portal2027-conexion.js, -permisos.js, -evaluacion.js, -integracion-ejercicios.js
js/modulos/       portal2027-<función>.js
supabase/         migrations/ (SQL numerado), functions/ (servidor)
docs/             inventario y contratos
```

## Revisión de la etapa 0

- [ ] `index.html` abre en computadora y celular.
- [ ] El CSS carga (fondo claro, acceso en dos columnas en pantalla ancha).
- [ ] Se identifican los datos ficticios (franja amarilla y bloque «Qué está simulado»).
