/* portal2027-libreta.js — etapa 3, parte B: libreta por año/grupo/materia/trimestre.
   Todos los cálculos salen del motor único (portal2027.evaluacion). Todo cambio se guarda con las
   funciones de la base (permisos, bloqueo, versión e historial); aquí solo se muestra el resultado real. */
(function () {
  'use strict';

  var P = window.portal2027;
  var el = P.el;
  var db = P.db;
  var M = P.evaluacion;
  var contenido = document.getElementById('contenido');

  var S = {
    info: null, asig: null, trimestres: [], trimestreId: null,
    evals: [], mats: [], notas: {},            // notas: clave evalId|matId -> {valor, version}
    filtroCat: '', verOcultas: false, verPapelera: false, buscar: '', historial: null, publicada: false
  };
  var estado = null;
  var zonaTabla = null;
  var filasEst = {};                            // matId -> { celdasFinal(), }

  /* ---------- utilidades ---------- */
  async function consultar(q) {
    var r = await q;
    if (r.error) { throw r.error; }
    return r.data;
  }
  async function todas(fabrica) {
    var salida = [], desde = 0;
    for (;;) {
      var lote = await consultar(fabrica().range(desde, desde + 999));
      salida = salida.concat(lote);
      if (lote.length < 1000) { return salida; }
      desde += 1000;
    }
  }
  function aviso(texto, tipo) {
    estado.textContent = texto;
    estado.className = 'mensaje estado-panel ' + (tipo || 'info');
    estado.hidden = !texto;
  }
  function textoError(e) {
    var m = (e && e.message) || '';
    if (/^CONFLICTO/.test(m)) { return m.replace(/^CONFLICTO:\s*/, 'Conflicto: ') + ' Pulse «Recargar».'; }
    if (/ya existe|bloqueada|papelera|motivo|entre 0 y 5|No tiene permiso|no pertenece/i.test(m) && !/duplicate key/i.test(m)) {
      return m.replace(/\s*\(row-level security\)/, '');
    }
    return P.traducirError(e);
  }
  function clave(e, m) { return e + '|' + m; }
  function nombreEst(e) { return ((e.apellidos || '') + ', ' + (e.nombres || '')).replace(/^, |, $/g, ''); }
  function evalPorId(id) { return S.evals.filter(function (e) { return e.id === id; })[0]; }
  function trimestreActual() { return S.trimestres.filter(function (t) { return t.id === S.trimestreId; })[0]; }

  function notasDe(matId) {
    var o = {};
    S.evals.forEach(function (e) {
      var n = S.notas[clave(e.id, matId)];
      if (n && n.valor !== null && n.valor !== undefined) { o[e.id] = n.valor; }
    });
    return o;
  }
  function resultado(matId) { return M.calcular(S.evals, notasDe(matId)); }

  /* ---------- carga ---------- */
  async function cargarAsignacion(id) {
    var d = await consultar(db.from('portal2027_asignaciones')
      .select('id, salon:portal2027_salones(id,nombre,anio_id,anio:portal2027_anios(anio)), materia:portal2027_materias(nombre)')
      .eq('id', id).maybeSingle());
    return d;
  }

  async function cargarLibreta() {
    var asigId = S.asig.id, trId = S.trimestreId;
    var r = await Promise.all([
      todas(function () {
        return db.from('portal2027_evaluaciones')
          .select('id,categoria,tema,orden,bloqueada,oculta,eliminada_en,version')
          .eq('asignacion_id', asigId).eq('trimestre_id', trId).order('orden').order('id');
      }),
      todas(function () {
        return db.from('portal2027_matriculas')
          .select('id,estado,estudiante:portal2027_estudiantes(codigo,nombres,apellidos)')
          .eq('salon_id', S.asig.salon.id).eq('anio_id', S.asig.salon.anio_id).order('id');
      }),
      todas(function () {
        return db.from('portal2027_notas')
          .select('evaluacion_id,matricula_id,valor,version,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id)')
          .eq('evaluacion.asignacion_id', asigId).eq('evaluacion.trimestre_id', trId).order('id');
      }),
      consultar(db.from('portal2027_publicaciones').select('publicada').eq('asignacion_id', asigId).eq('trimestre_id', trId).maybeSingle())
    ]);
    S.publicada = !!(r[3] && r[3].publicada);
    S.evals = r[0];
    S.mats = r[1].filter(function (m) { return m.estudiante; }).sort(function (a, b) {
      return a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es') || a.estudiante.nombres.localeCompare(b.estudiante.nombres, 'es');
    });
    S.notas = {};
    r[2].forEach(function (n) { S.notas[clave(n.evaluacion_id, n.matricula_id)] = { valor: n.valor === null ? null : Number(n.valor), version: n.version }; });
    S.historial = null;
  }

  async function recargar(mensaje) {
    aviso('Cargando libreta…', 'info');
    try {
      await cargarLibreta();
      dibujar();
      aviso(mensaje || '', mensaje ? 'ok' : 'info');
    } catch (e) { aviso('No se pudo cargar la libreta. ' + textoError(e), 'error'); }
  }

  /* ---------- acciones sobre columnas ---------- */
  async function llamar(nombre, args, textoOk) {
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc(nombre, args);
      if (r.error) { throw r.error; }
      await cargarLibreta();
      dibujar();
      aviso(textoOk, 'ok');
    } catch (e) {
      aviso('No se guardó. ' + textoError(e), 'error');
    }
  }

  function agregarColumna(cat) {
    var tema = window.prompt('Tema de la nueva columna de ' + M.ETIQUETAS[cat].toLowerCase() + ' (puede dejarlo vacío):', '');
    if (tema === null) { return; }
    llamar('portal2027_crear_evaluacion', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_categoria: cat, p_tema: tema }, 'Columna agregada.');
  }
  function cambiarTema(ev, input) {
    if (input.value.trim() === (ev.tema || '')) { return; }
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: input.value, p_oculta: null, p_bloqueada: null }, 'Tema guardado.');
  }
  function alternarBloqueo(ev) {
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: null, p_oculta: null, p_bloqueada: !ev.bloqueada },
      ev.bloqueada ? 'Columna desbloqueada.' : 'Columna bloqueada.');
  }
  function alternarOculta(ev) {
    llamar('portal2027_actualizar_evaluacion', { p_id: ev.id, p_version: ev.version, p_tema: null, p_oculta: !ev.oculta, p_bloqueada: null },
      ev.oculta ? 'Columna visible otra vez. El cálculo no cambia.' : 'Columna oculta. Sigue contando en el cálculo.');
  }
  function aPapelera(ev, si) {
    if (si && !window.confirm('¿Enviar esta columna a la papelera? Dejará de contar en el cálculo y podrá restaurarla.')) { return; }
    llamar('portal2027_papelera_evaluacion', { p_id: ev.id, p_version: ev.version, p_a_papelera: si }, si ? 'Columna enviada a la papelera.' : 'Columna restaurada.');
  }

  /* ---------- guardar una nota ---------- */
  async function guardarCelda(ev, mat, input, marca) {
    var k = clave(ev.id, mat.id);
    var previa = S.notas[k] || { valor: null, version: 0 };
    var crudo = input.value.trim().replace(',', '.');
    var valor = crudo === '' ? null : Number(crudo);

    if (valor !== null && (!isFinite(valor) || valor < 0 || valor > 5 || Math.round(valor * 100) / 100 !== valor)) {
      aviso('La nota debe ser un número de 0 a 5 (hasta 2 decimales).', 'error');
      input.value = previa.valor === null ? '' : String(previa.valor);
      return;
    }
    if (valor === previa.valor) { return; }

    var motivo = null;
    if (previa.valor !== null) {
      motivo = window.prompt('Esta nota ya estaba escrita (' + previa.valor + '). Motivo del cambio:', '');
      if (motivo === null || motivo.trim() === '') {
        aviso('No se cambió la nota: falta el motivo.', 'info');
        input.value = String(previa.valor);
        return;
      }
    }

    marca('guardando');
    aviso('Guardando…', 'info');
    try {
      var r = await db.rpc('portal2027_guardar_nota', {
        p_evaluacion: ev.id, p_matricula: mat.id, p_valor: valor, p_version: previa.version, p_motivo: motivo
      });
      if (r.error) { throw r.error; }
      var d = r.data;
      S.notas[k] = { valor: d.valor === null ? null : Number(d.valor), version: d.version };
      S.historial = null;
      marca('ok');
      actualizarFila(mat.id);
      aviso('Nota guardada.', 'ok');
    } catch (e) {
      marca('error');
      aviso('NO se guardó la nota de ' + nombreEst(mat.estudiante) + '. ' + textoError(e), 'error');
    }
  }

  /* ---------- dibujo ---------- */
  function visibles() {
    return S.evals.filter(function (e) {
      if (e.eliminada_en) { return false; }
      if (e.oculta && !S.verOcultas) { return false; }
      if (S.filtroCat && e.categoria !== S.filtroCat) { return false; }
      return true;
    });
  }

  function actualizarFila(matId) {
    var f = filasEst[matId];
    if (!f) { return; }
    var r = resultado(matId);
    M.CATEGORIAS.forEach(function (c) { if (f.cat[c]) { f.cat[c].textContent = r.categorias[c].texto || '—'; } });
    f.final.textContent = r.textoFinal;
  }

  function celdaNota(ev, mat) {
    var n = S.notas[clave(ev.id, mat.id)];
    var input = el('input', {
      type: 'text', inputmode: 'decimal', clase: 'nota-input', maxlength: '4',
      value: n && n.valor !== null ? String(n.valor) : '',
      disabled: ev.bloqueada,
      'aria-label': 'Nota de ' + nombreEst(mat.estudiante) + ' en ' + (ev.tema || M.ETIQUETAS[ev.categoria])
    });
    var td = el('td', { clase: 'celda-nota' }, [input]);
    function marca(tipo) { td.className = 'celda-nota' + (tipo ? ' celda-' + tipo : ''); }
    input.addEventListener('change', function () { guardarCelda(ev, mat, input, marca); });
    input.addEventListener('keydown', function (k) { if (k.key === 'Enter') { input.blur(); } });
    return td;
  }

  function cabeceraColumna(ev) {
    var tema = el('input', { type: 'text', clase: 'tema-input', value: ev.tema || '', placeholder: 'Tema', maxlength: '120', disabled: ev.bloqueada, 'aria-label': 'Tema de la columna' });
    tema.addEventListener('change', function () { cambiarTema(ev, tema); });
    function boton(texto, titulo, fn) { return el('button', { clase: 'mini', type: 'button', texto: texto, title: titulo, 'aria-label': titulo, onclick: fn }); }
    return el('th', { scope: 'col', clase: 'col-eval' + (ev.oculta ? ' col-oculta' : '') }, [
      tema,
      el('div', { clase: 'col-acciones' }, [
        boton(ev.bloqueada ? '🔒' : '🔓', ev.bloqueada ? 'Desbloquear columna' : 'Bloquear columna', function () { alternarBloqueo(ev); }),
        boton(ev.oculta ? '👁' : '🙈', ev.oculta ? 'Mostrar columna' : 'Ocultar columna (sigue contando)', function () { alternarOculta(ev); }),
        boton('🗑', 'Enviar a la papelera', function () { aPapelera(ev, true); })
      ])
    ]);
  }

  function dibujarTabla() {
    zonaTabla.textContent = '';
    filasEst = {};
    var cols = visibles();
    var cats = S.filtroCat ? [S.filtroCat] : M.CATEGORIAS;

    // Primera fila: grupos por categoría con botón +. Segunda: columnas.
    var fila1 = [el('th', { scope: 'col', rowspan: '2', clase: 'col-nombre', texto: 'Estudiante' })];
    var fila2 = [];
    cats.forEach(function (c) {
      var delCat = cols.filter(function (e) { return e.categoria === c; });
      var mas = el('button', { clase: 'mini mas', type: 'button', texto: '+', title: 'Agregar columna de ' + M.ETIQUETAS[c].toLowerCase(), 'aria-label': 'Agregar columna de ' + M.ETIQUETAS[c].toLowerCase(), onclick: function () { agregarColumna(c); } });
      fila1.push(el('th', { scope: 'colgroup', colspan: String(delCat.length + 1), clase: 'grupo-cat' }, [M.ETIQUETAS[c] + ' ', mas]));
      delCat.forEach(function (e) { fila2.push(cabeceraColumna(e)); });
      fila2.push(el('th', { scope: 'col', clase: 'col-prom', texto: 'Prom.' }));
    });
    fila1.push(el('th', { scope: 'col', rowspan: '2', clase: 'col-final', texto: 'Final' }));

    var q = S.buscar.trim().toLowerCase();
    var mats = S.mats.filter(function (m) {
      return !q || (m.estudiante.codigo + ' ' + nombreEst(m.estudiante)).toLowerCase().indexOf(q) !== -1;
    });

    var cuerpo = mats.map(function (m) {
      var celdas = [el('th', { scope: 'row', clase: 'col-nombre' }, [nombreEst(m.estudiante), m.estado && m.estado !== 'activo' ? el('small', { texto: ' (' + m.estado + ')' }) : null])];
      var f = { cat: {}, final: null };
      cats.forEach(function (c) {
        cols.filter(function (e) { return e.categoria === c; }).forEach(function (e) { celdas.push(celdaNota(e, m)); });
        var tdP = el('td', { clase: 'col-prom' });
        f.cat[c] = tdP;
        celdas.push(tdP);
      });
      f.final = el('td', { clase: 'col-final' });
      celdas.push(f.final);
      filasEst[m.id] = f;
      return el('tr', null, celdas);
    });

    var tabla = el('table', { clase: 'tabla-libreta' }, [
      el('thead', null, [el('tr', null, fila1), el('tr', null, fila2)]),
      el('tbody', null, cuerpo)
    ]);
    zonaTabla.appendChild(el('div', { clase: 'libreta-scroll' }, [tabla]));
    S.mats.forEach(function (m) { actualizarFila(m.id); });
    if (S.mats.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Este grupo todavía no tiene estudiantes matriculados en el año.' }));
    }
    if (cols.length === 0) {
      zonaTabla.appendChild(el('p', { clase: 'vacio-texto', texto: 'Aún no hay columnas. Use el botón + de cada categoría.' }));
    }
  }

  function dibujarPapelera() {
    var lista = S.evals.filter(function (e) { return e.eliminada_en; });
    var sec = el('section', { clase: 'bloque' }, [el('h3', { texto: 'Papelera (' + lista.length + ')' })]);
    if (lista.length === 0) { sec.appendChild(el('p', { clase: 'vacio-texto', texto: 'La papelera está vacía.' })); return sec; }
    sec.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
      el('thead', null, [el('tr', null, ['Categoría', 'Tema', ''].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
      el('tbody', null, lista.map(function (e) {
        return el('tr', null, [el('td', { texto: M.ETIQUETAS[e.categoria] }), el('td', { texto: e.tema || '(sin tema)' }),
          el('td', null, [el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Restaurar', onclick: function () { aPapelera(e, false); } })])]);
      }))
    ])]));
    return sec;
  }

  async function dibujarHistorial(contenedor) {
    contenedor.textContent = '';
    contenedor.appendChild(el('p', { clase: 'texto-estado', texto: 'Cargando historial…' }));
    try {
      var h = await consultar(db.from('portal2027_historial_notas')
        .select('matricula_id,evaluacion_id,valor_anterior,valor_nuevo,version,motivo,creado_en,evaluacion:portal2027_evaluaciones!inner(asignacion_id,trimestre_id)')
        .eq('evaluacion.asignacion_id', S.asig.id).eq('evaluacion.trimestre_id', S.trimestreId)
        .order('creado_en', { ascending: false }).limit(100));
      contenedor.textContent = '';
      if (h.length === 0) { contenedor.appendChild(el('p', { clase: 'vacio-texto', texto: 'Todavía no hay cambios de notas en este trimestre.' })); return; }
      var porMat = {};
      S.mats.forEach(function (m) { porMat[m.id] = m; });
      contenedor.appendChild(el('p', { clase: 'bloque-ayuda', texto: 'Últimos ' + h.length + ' cambios (máximo 100).' }));
      contenedor.appendChild(el('div', { clase: 'tabla-contenedor' }, [el('table', { clase: 'tabla-datos' }, [
        el('thead', null, [el('tr', null, ['Fecha', 'Estudiante', 'Columna', 'Antes', 'Ahora', 'Versión', 'Motivo'].map(function (t) { return el('th', { scope: 'col', texto: t }); }))]),
        el('tbody', null, h.map(function (x) {
          var e = evalPorId(x.evaluacion_id), m = porMat[x.matricula_id];
          return el('tr', null, [
            el('td', { texto: new Date(x.creado_en).toLocaleString('es-PA') }),
            el('td', { texto: m ? nombreEst(m.estudiante) : '' }),
            el('td', { texto: e ? M.ETIQUETAS[e.categoria] + (e.tema ? ': ' + e.tema : '') : '' }),
            el('td', { texto: x.valor_anterior === null ? '—' : String(Number(x.valor_anterior)) }),
            el('td', { texto: x.valor_nuevo === null ? '(vacía)' : String(Number(x.valor_nuevo)) }),
            el('td', { texto: String(x.version) }), el('td', { texto: x.motivo || '' })
          ]);
        }))
      ])]));
    } catch (e) {
      contenedor.textContent = '';
      contenedor.appendChild(el('p', { clase: 'mensaje error', texto: 'No se pudo cargar el historial. ' + textoError(e) }));
    }
  }

  function dibujar() {
    var previo = contenido.querySelector('.libreta-cuerpo');
    if (previo) { previo.remove(); }
    var tr = trimestreActual();

    var selTrim = el('select', { 'aria-label': 'Trimestre' }, S.trimestres.map(function (t) {
      return el('option', { value: t.id, texto: 'Trimestre ' + t.numero, selected: t.id === S.trimestreId });
    }));
    selTrim.addEventListener('change', function () { S.trimestreId = selTrim.value; recargar(); });

    var selCat = el('select', { 'aria-label': 'Filtrar por categoría' }, [el('option', { value: '', texto: 'Todas las categorías' })]
      .concat(M.CATEGORIAS.map(function (c) { return el('option', { value: c, texto: M.ETIQUETAS[c], selected: S.filtroCat === c }); })));
    selCat.addEventListener('change', function () { S.filtroCat = selCat.value; dibujarTabla(); });

    var buscar = el('input', { type: 'search', placeholder: 'Buscar estudiante', value: S.buscar, 'aria-label': 'Buscar estudiante' });
    buscar.addEventListener('input', function () { S.buscar = buscar.value; dibujarTabla(); });

    var ocultas = S.evals.filter(function (e) { return e.oculta && !e.eliminada_en; }).length;
    var cbOc = el('input', { type: 'checkbox', checked: S.verOcultas });
    cbOc.addEventListener('change', function () { S.verOcultas = cbOc.checked; dibujarTabla(); });

    var btnHist = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Historial de notas' });
    var btnPap = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Papelera' });
    var btnPub = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: S.publicada ? 'Retirar publicación' : 'Publicar a estudiantes', onclick: function () {
      var txt = S.publicada ? '¿Retirar la publicación? Los estudiantes dejarán de ver las notas de esta materia en este trimestre.'
        : '¿Publicar las notas de este trimestre? Cada estudiante verá solo sus propias notas, y los cambios que haga después también se verán.';
      if (!window.confirm(txt)) { return; }
      llamar('portal2027_publicar_notas', { p_asignacion: S.asig.id, p_trimestre: S.trimestreId, p_publicar: !S.publicada },
        S.publicada ? 'Publicación retirada.' : 'Notas publicadas a los estudiantes.');
    } });
    var btnRec = el('button', { clase: 'boton boton-secundario boton-chico', type: 'button', texto: 'Recargar', onclick: function () { recargar('Libreta recargada.'); } });

    zonaTabla = el('div');
    var zonaExtra = el('div');
    btnHist.addEventListener('click', function () { zonaExtra.textContent = ''; var c = el('div'); zonaExtra.appendChild(el('section', { clase: 'bloque' }, [el('h3', { texto: 'Historial de notas' }), c])); dibujarHistorial(c); });
    btnPap.addEventListener('click', function () { zonaExtra.textContent = ''; zonaExtra.appendChild(dibujarPapelera()); });

    var cuerpo = el('div', { clase: 'libreta-cuerpo secciones' }, [
      el('section', { clase: 'bloque' }, [
        el('div', { clase: 'formulario-fila' }, [
          el('label', null, ['Trimestre', selTrim]), el('label', null, ['Categoría', selCat]), el('label', null, ['Estudiante', buscar]),
          el('label', { clase: 'etiqueta-check' }, [cbOc, ' Mostrar ocultas (' + ocultas + ')']),
          btnHist, btnPap, btnRec, btnPub
        ]),
        el('p', { clase: 'bloque-ayuda', texto: S.publicada ? 'Estado: notas PUBLICADAS a los estudiantes en este trimestre.' : 'Estado: notas no publicadas (los estudiantes no las ven).' }),
        el('p', { clase: 'bloque-ayuda', texto: 'Escriba la nota y pulse Enter o cambie de casilla. Vacío no es cero. Promedio por categoría con las notas existentes; Final = promedio de las categorías con nota. Las columnas ocultas siguen contando.' }),
        zonaTabla
      ]),
      zonaExtra
    ]);
    contenido.appendChild(cuerpo);
    dibujarTabla();
    if (!tr) { aviso('Este año no tiene trimestres.', 'error'); }
  }

  /* ---------- inicio ---------- */
  function errorPantalla(texto) {
    contenido.textContent = '';
    contenido.appendChild(el('p', { clase: 'mensaje error', role: 'alert', texto: texto }));
    contenido.appendChild(el('a', { clase: 'boton boton-secundario', href: P.rutaInicio(), texto: 'Volver al inicio' }));
  }

  async function iniciar() {
    if (!db) { errorPantalla(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { errorPantalla(P.traducirError(e)); return; }
    var rolPanel = info && (info.roles.indexOf('profesor') !== -1 ? 'profesor' : (info.roles.indexOf('administrador') !== -1 ? 'administrador' : null));
    if (!info || !rolPanel) { window.location.replace(P.rutaInicio()); return; }
    db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') { window.location.replace(P.rutaInicio()); } });
    S.info = info;

    var params = new URLSearchParams(window.location.search);
    var asigId = params.get('asignacion');
    contenido.textContent = '';
    estado = el('p', { clase: 'mensaje estado-panel', role: 'status', 'aria-live': 'polite', hidden: true });

    try {
      S.asig = asigId ? await cargarAsignacion(asigId) : null;
      if (!S.asig) { errorPantalla('No se encontró esta libreta o no tiene acceso a ella.'); return; }
      S.trimestres = await consultar(db.from('portal2027_trimestres').select('id,numero').eq('anio_id', S.asig.salon.anio_id).order('numero'));
      S.trimestreId = (params.get('trimestre') && S.trimestres.some(function (t) { return t.id === params.get('trimestre'); }))
        ? params.get('trimestre') : (S.trimestres[0] ? S.trimestres[0].id : null);
      if (!S.trimestreId) { errorPantalla('Este año no tiene trimestres.'); return; }

      contenido.appendChild(el('header', { clase: 'panel-cabecera' }, [
        el('div', null, [
          el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Libreta' }),
          el('h1', { texto: S.asig.materia.nombre + ' · ' + S.asig.salon.nombre }),
          el('p', { clase: 'panel-datos', texto: 'Año lectivo ' + S.asig.salon.anio.anio })
        ]),
        el('div', { clase: 'cabecera-acciones' }, [
          el('a', { clase: 'boton boton-secundario', href: P.rutaPanel(rolPanel), texto: 'Volver al panel' }),
          el('button', { clase: 'boton boton-secundario', type: 'button', texto: 'Cerrar sesión', onclick: P.cerrarSesion })
        ])
      ]));
      contenido.appendChild(estado);
      await cargarLibreta();
      dibujar();
    } catch (e) {
      errorPantalla('No se pudo abrir la libreta. ' + textoError(e));
    }
  }

  iniciar();
})();
