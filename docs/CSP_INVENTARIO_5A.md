# CSP — inventario previo (Paso 5a)

Estado: **inventario hecho, CSP todavía NO aplicada**. Este documento no certifica que ninguna página funcione bajo una CSP; eso se prueba en el paso 5c.

## Limitación de la CSP por `<meta>` (GitHub Pages)

GitHub Pages no permite cabeceras HTTP propias, así que solo se puede usar `<meta http-equiv="Content-Security-Policy">`. Una meta CSP **no admite** `report-uri`/`report-to`, `frame-ancestors` ni `sandbox`, y **no existe modo Report-Only**. Consecuencias:

- No se pueden recibir informes de violaciones: hay que probar antes de publicar y no hay red de seguridad después.
- No hay protección contra que otro sitio incruste el portal (`frame-ancestors`).
- La meta solo vale para lo que se carga **después** de ella: debe ser lo primero del `<head>`, antes de cualquier `<script>` o `<link>`.

## Hecho en este paso

| Cambio | Archivo nuevo | Página |
| --- | --- | --- |
| Script de `window.portal2027_hashInicial` | `js/core/portal2027-hash-inicial.js` | `index.html` (primer script, sin `defer`, antes de supabase-js) |
| Paneles semana/editar/calendario | `js/modulos/portal2027-horario-paneles.js` | `pages/portal2027-horario.html` (misma posición que tenía) |
| Juego «Sumas» | `js/modulos/portal2027-ejemplo-suma.js` | `pages/ejercicios/portal2027-ejemplo-suma.html` (misma posición) |

El código de los tres scripts se movió **sin cambios**. Antes de este paso eran 3 las páginas con script en línea, no solo `index.html`.

## Inventario (15 páginas: `index.html`, 13 en `pages/`, 1 en `pages/ejercicios/`)

| Elemento | Resultado |
| --- | --- |
| `<script>` en línea | 0 (tras este paso) |
| Manejadores `on*=` / `javascript:` en HTML | 0 |
| `eval`, `new Function`, `document.write`, `setTimeout("texto")` | 0 en JS propio; 0 en `js/vendor/xlsx-0.20.3.full.min.js` |
| `on*=` o `style=` dentro de cadenas HTML del JS | 0 |
| `setAttribute('style')` / `.style.cssText` | 0 |
| Bloques `<style>` | 2: `portal2027-estudiante.html` (~7,6 KB de CSS) y `portal2027-prompt-planificacion.html` (~0,8 KB) |
| Atributos `style=""` | 3: 2 en `portal2027-planificacion.html`, 1 en `portal2027-prompt-planificacion.html` |
| `<style>` creado por JS | 1: `js/modulos/portal2027-seguimiento.js` (~línea 309), pone `@page{size:A4 landscape}` al imprimir el cuadro |
| `<script>` creado por JS | 1: `js/core/portal2027-excel.js` (CDN y copia local, ambos con SRI) |
| `<iframe>`, `<form action>` | 0 |
| Fuentes web, `@font-face`, `@import`, `url()` en CSS | 0 |
| Realtime de Supabase (`.channel(`, `.subscribe(`) | 0 usos |

### Orígenes y para qué se usan

| Origen | Uso | Directiva | Páginas |
| --- | --- | --- | --- |
| `self` | HTML, JS, CSS, imágenes, logo, JSON de horario (`fetch`), copia local de SheetJS | script/style/img/connect/font | todas |
| `https://cdn.jsdelivr.net` | supabase-js 2.57.4 (SRI) | script-src | 14 (todas menos `prompt-planificacion`, que no usa Supabase) |
| `https://cdn.jsdelivr.net` | html2canvas 1.4.1 y jspdf 2.5.2 (SRI) | script-src | solo `seguimiento` |
| `https://cdn.sheetjs.com` | SheetJS 0.20.3, primera opción (SRI); si falla, copia local | script-src | solo `admin` y `libreta` (las que cargan `portal2027-excel.js`) |
| `https://gwxghgpsgvaletrqmwcn.supabase.co` | API, Auth, Storage y Edge Functions | connect-src | 14 (todas menos `prompt-planificacion`) |
| `https://gwxghgpsgvaletrqmwcn.supabase.co` | **fotos y materiales con URL firmada, usados como `<img src>`** | **img-src** | `admin`, `clases`, `estudiante`, `profesor` (cargan `portal2027-estudiantes.js` o `portal2027-clases-comun.js`) |
| `data:` | logo del boletín leído con `FileReader` (el `canvas.toDataURL` de `seguimiento` no es una carga de imagen) | img-src | `seguimiento` |
| `blob:` | vistas previas (`createObjectURL`), descargas CSV, **PDF del boletín abierto en pestaña nueva** | img-src, object-src | varias; PDF en `seguimiento` |

Origen que **no** aparece como conexión del navegador: `https://wa.me`, `https://smallpdf.com` y `https://www.ilovepdf.com` son enlaces o textos de ayuda (navegación), no los gobierna `connect-src`.

## Decisiones y riesgos para el paso 5c

1. **`wss://…supabase.co` no hace falta**: el código no usa Realtime. Se propone omitirlo (mínimo privilegio). Si algún día se usa Realtime, añadirlo.
2. **`img-src` debe incluir el origen de Supabase**. Sin eso, las fotos y miniaturas de Storage dejarían de verse sin ningún error visible en la interfaz.
3. **`style-src` necesitará `'unsafe-inline'`** mientras exista alguno de estos motivos. Queda como **deuda pendiente declarada**:
   - 2 bloques `<style>` y 3 atributos `style=""` (extraíbles a CSS, sin cambiar la interfaz).
   - El `<style>` que crea `portal2027-seguimiento.js` al imprimir (necesita cambio de diseño).
   - html2canvas 1.4.1 inserta `<style>` en su documento clonado; no se controla desde este código.
   - Los estilos asignados con `elemento.style.x = …` (CSSOM) **no** necesitan `unsafe-inline`.
4. **PDF del boletín por `blob:`** (`portal2027-boletin-pdf.js`): el documento `blob:` hereda la CSP y el visor PDF del navegador se carga como objeto. Con `object-src 'none'` el PDF puede salir en blanco. Por eso se propone `object-src blob:`. **Esto no se puede probar con Chromium sin interfaz (no trae visor PDF)**: requiere prueba manual en Chrome y Firefox reales.
5. `https://cdn.sheetjs.com`: si se omitiera, la carga fallaría y se usaría la copia local, pero con una violación de CSP en consola. Se propone mantenerlo solo en `admin` y `libreta`.
6. Las URLs firmadas se abren en pestaña nueva con `window.open('')` y luego `location.href`: es navegación, no escribe HTML dentro de la ventana; no se ve afectada.

## Guardas automáticas

`tests/portal2027-csp-inventario.test.cjs` falla si aparece un `<script>` en línea, un `on*=`, un `javascript:`, `eval`/`new Function`, o si **aumenta** la deuda de estilos en línea. `tests/portal2027-hash-inicial.test.cjs` comprueba que el fragmento de la URL se guarda antes que supabase-js.


## Actualización 2026-10-16
Se extrajeron los estilos inline de HTML a CSS. `style-src` ya no requiere `unsafe-inline`; la prueba automatizada impide su reaparición. **GitHub Pages no permite configurar mediante meta la directiva `frame-ancestors`: la protección anti-clickjacking requiere cabeceras HTTP en un hosting compatible (por ejemplo Cloudflare o Netlify).** Esta revisión estática no confirma comportamiento en navegador real.
