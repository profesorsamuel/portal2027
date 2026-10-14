/* Cargador compartido de SheetJS: versión fija, SRI y respaldo local con los mismos bytes. */
(function () {
  'use strict';
  var P = window.portal2027;
  var rutaLocal = new URL('../vendor/xlsx-0.20.3.full.min.js?v=20261016', document.currentScript.src).href;
  var carga = null;
  var VERSION = '0.20.3';
  var SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  function disponible() {
    return window.XLSX && window.XLSX.version === VERSION && window.XLSX.read && window.XLSX.utils;
  }
  function cargar(url) {
    return new Promise(function (ok, fallo) {
      var script = document.createElement('script'), terminado = false;
      var temporizador = setTimeout(function () { finalizar(new Error('Tiempo agotado al cargar Excel.')); }, 10000);
      function finalizar(error) {
        if (terminado) { return; }
        terminado = true; clearTimeout(temporizador);
        script.onload = script.onerror = null;
        if (error) { script.remove(); fallo(error); } else { ok(window.XLSX); }
      }
      script.src = url; script.integrity = SRI; script.crossOrigin = 'anonymous'; script.referrerPolicy = 'no-referrer';
      script.onload = function () { finalizar(disponible() ? null : new Error('El lector de Excel no está disponible o tiene otra versión.')); };
      script.onerror = function () { finalizar(new Error('No se pudo cargar Excel o verificar su integridad.')); };
      document.head.appendChild(script);
    });
  }
  P.cargarExcel = function () {
    if (disponible()) { return Promise.resolve(window.XLSX); }
    if (!carga) {
      carga = (async function () {
        try { return await cargar('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'); }
        catch (e) { console.error('Excel: se intentará la copia local', e); }
        try { return await cargar(rutaLocal); }
        catch (e) {
          console.error('Excel: tampoco se pudo cargar la copia local', e);
          throw new Error('No se pudo abrir Excel. Recargue la página. En la libreta puede pegar las notas copiadas de Excel.');
        }
      })();
      carga.catch(function () { carga = null; });
    }
    return carga;
  };
})();
