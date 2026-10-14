/* portal2027-libreta-teclado.js — navegación existente entre celdas.
   No escribe notas: conserva el foco y los eventos change de los inputs.
   Cargar antes de portal2027-libreta.js. */
(function () {
  'use strict';
  var P = window.portal2027;

  function inputDeFila(fila, i) {
    var c = fila && fila.querySelectorAll('td.celda-nota')[i];
    var inp = c && c.querySelector('input');
    return inp && !inp.disabled ? inp : null;
  }
  function celdaVecina(input, df, dc) {
    var td = input.closest('td'), tr = td.parentNode;
    var celdas = Array.prototype.slice.call(tr.querySelectorAll('td.celda-nota'));
    var idx = celdas.indexOf(td);
    if (df) {
      var f = df > 0 ? tr.nextElementSibling : tr.previousElementSibling;
      while (f) {
        var x = inputDeFila(f, idx);
        if (x) { return x; }
        f = df > 0 ? f.nextElementSibling : f.previousElementSibling;
      }
      return null;
    }
    for (var i = idx + dc; i >= 0 && i < celdas.length; i += dc) {
      var y = inputDeFila(tr, i);
      if (y) { return y; }
    }
    return null;
  }
  function moverFoco(input, df, dc) {
    var v = celdaVecina(input, df, dc);
    if (!v) { return false; }
    v.focus(); v.select();   // al salir de la casilla anterior se guarda sola (evento change)
    return true;
  }

  P.libretaTeclado = Object.freeze({ moverFoco: moverFoco });
})();
