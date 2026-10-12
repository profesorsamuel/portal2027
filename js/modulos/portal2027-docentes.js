/* portal2027-docentes.js — Administración: directorio de docentes por nivel (Premedia y Primaria), con búsqueda y descarga en Excel.
   Los datos están en js/datos/portal2027-docentes-2026.js. No incluye teléfonos (la página es pública). */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;

  var NIVELES = [
    { id: 'todos', texto: 'Todos' },
    { id: 'Premedia', texto: 'Premedia' },
    { id: 'Primaria', texto: 'Primaria' },
    { id: 'Apoyo', texto: 'Apoyo (psicología)' }
  ];
  var CAB = ['N.°', 'Nombre del docente', 'Nivel', 'Tipo', 'Grupo', 'Asignatura'];

  function sinTildes(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function fila(d) { return [d.n, d.nombre, d.nivel === 'Apoyo' ? 'Apoyo' : d.nivel, d.tipo, d.grupo || '', d.asignatura || '']; }

  P.renderDocentesAdmin = async function (zona) {
    var todos = (P.docentes2026 || []).slice().sort(function (a, b) { return a.n - b.n; });
    var nivel = 'todos';
    var texto = '';
    var aviso = el('p', { clase: 'mensaje', role: 'status', hidden: true });
    var botones = {};
    var cuerpo = el('tbody');
    var resumen = el('p', { clase: 'bloque-ayuda' });
    var buscador = el('input', { type: 'search', placeholder: 'Buscar por nombre, grupo o asignatura', 'aria-label': 'Buscar docente' });

    function visibles() {
      var q = sinTildes(texto.trim());
      return todos.filter(function (d) {
        if (nivel !== 'todos' && d.nivel !== nivel) { return false; }
        return !q || sinTildes([d.nombre, d.tipo, d.grupo, d.asignatura].join(' ')).indexOf(q) !== -1;
      });
    }

    function pintar() {
      var lista = visibles();
      cuerpo.textContent = '';
      lista.forEach(function (d) {
        cuerpo.appendChild(el('tr', null, fila(d).map(function (v) { return el('td', { texto: String(v) }); })));
      });
      if (lista.length === 0) { cuerpo.appendChild(el('tr', null, [el('td', { colspan: String(CAB.length), clase: 'vacio-texto', texto: 'No hay docentes con ese filtro.' })])); }
      var cuenta = {};
      todos.forEach(function (d) { cuenta[d.nivel] = (cuenta[d.nivel] || 0) + 1; });
      resumen.textContent = 'Mostrando ' + lista.length + ' de ' + todos.length + ' docentes · Premedia: ' + (cuenta.Premedia || 0) + ' · Primaria: ' + (cuenta.Primaria || 0) + ' · Apoyo: ' + (cuenta.Apoyo || 0);
      Object.keys(botones).forEach(function (id) {
        var on = id === nivel;
        botones[id].classList.toggle('activa', on);
        botones[id].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function descargar(soloVista) {
      if (!window.XLSX) { aviso.textContent = 'No se cargó la biblioteca de Excel. Revise su internet y recargue la página.'; aviso.className = 'mensaje error'; aviso.hidden = false; return; }
      var libro = window.XLSX.utils.book_new();
      function agregar(nombreHoja, lista) {
        var hoja = window.XLSX.utils.aoa_to_sheet([CAB].concat(lista.map(fila)));
        hoja['!cols'] = [6, 30, 10, 20, 9, 28].map(function (w) { return { wch: w }; });
        window.XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
      }
      var nombreArchivo;
      if (soloVista) {
        agregar(nivel === 'todos' ? 'Docentes' : nivel, visibles());
        nombreArchivo = 'docentes-jiral-2026-' + sinTildes(nivel) + '.xlsx';
      } else {
        ['Premedia', 'Primaria', 'Apoyo'].forEach(function (n) { agregar(n, todos.filter(function (d) { return d.nivel === n; })); });
        agregar('Todos', todos);
        nombreArchivo = 'docentes-jiral-2026.xlsx';
      }
      window.XLSX.writeFile(libro, nombreArchivo);
    }

    NIVELES.forEach(function (n) {
      var b = el('button', { clase: 'pestana', type: 'button', texto: n.texto, 'aria-pressed': 'false' });
      b.addEventListener('click', function () { nivel = n.id; pintar(); });
      botones[n.id] = b;
    });
    buscador.addEventListener('input', function () { texto = buscador.value; pintar(); });

    var bTodo = el('button', { clase: 'boton boton-chico', type: 'button', texto: 'Descargar Excel (todos los niveles)' });
    bTodo.addEventListener('click', function () { descargar(false); });
    var bVista = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Descargar lo que se ve' });
    bVista.addEventListener('click', function () { descargar(true); });

    var tabla = el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, CAB.map(function (c) { return el('th', { scope: 'col', texto: c }); }))]),
      cuerpo
    ])]);

    zona.appendChild(el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Directorio de docentes' }),
      el('p', { clase: 'bloque-ayuda', texto: 'Lista de docentes 2026 separada por Premedia y Primaria. El Excel «todos los niveles» trae una hoja por nivel y una hoja con todos.' }),
      el('div', { clase: 'filtro-docentes' }, NIVELES.map(function (n) { return botones[n.id]; })),
      el('div', { clase: 'cabecera-acciones' }, [buscador, bTodo, bVista]),
      aviso, resumen, tabla
    ]));
    pintar();
  };
})();
