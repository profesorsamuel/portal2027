(() => {
  'use strict';
  const P = window.portal2027,
    db = P?.db,
    $ = (id) => document.getElementById(id),
    dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const el = P.el;
  let user,
    admin = false,
    asignaciones = [],
    horario = [],
    trimestres = [],
    exclusiones = [],
    opciones = [];
  function msg(t, bad = false) {
    $('estado').textContent = t;
    $('estado').className = 'barra-estado ' + (bad ? 'error' : 'ok');
  }
  // Los datos se asignan como texto/atributos del DOM, nunca como HTML.
  function poner(nodo, hijos) {
    nodo.textContent = '';
    hijos.forEach((h) => nodo.appendChild(h));
  }
  function filaVacia(nodo, texto, columnas) {
    poner(nodo, [el('tr', null, [el('td', { colspan: String(columnas), texto })])]);
  }
  function claseTipo(tipo) { return ['clase', 'recreo', 'consejeria', 'otro'].includes(tipo) ? tipo : 'otro'; }
  function fichas(nodo, total, etiqueta, conteo) {
    const hijos = [el('div', { clase: 'ficha total' }, [el('b', { texto: String(total) }), el('span', { texto: etiqueta })])];
    Object.entries(conteo).forEach(([id, n]) => hijos.push(el('div', { clase: 'ficha ' + colorDe(id) }, [
      el('b', { texto: String(n) }), el('span', { texto: nombre(asignaciones.find((a) => a.id === id) || {}) })
    ])));
    poner(nodo, hijos);
  }
  async function query(q) {
    let r = await q;
    if (r.error) throw r.error;
    return r.data;
  }
  async function rpc(n, args) {
    return query(db.rpc(n, args));
  }
  function sel(id, arr, label) {
    poner($(id), arr.map((x) => el('option', { value: String(x.id ?? ''), texto: String(label(x) ?? '') })));
  }
  function nombre(a) {
    return `${a.salon?.nombre || '?'} · ${a.materia?.nombre || '?'}`;
  }
  function asigs() {
    return asignaciones.filter(
      (a) =>
        a.profesor_id === $('profesor').value &&
        a.salon?.anio_id === $('anio').value
    );
  }
  function syncAsigs() {
    let a = asigs();
    sel('asignacion', a, nombre);
    sel('doble-asignacion', a, nombre);
    $('asignacion').disabled = !a.length;
  }
  function dateISO(d) {
    let y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, '0'),
      day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function parseDate(s) {
    let [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function formato(f) {
    return f.toLocaleDateString('es-PA', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  function validar(filas) {
    if (!Array.isArray(filas) || filas.length > 80)
      throw Error('Se requiere un arreglo de máximo 80 franjas');
    const a = asigs();
    let porDia = {};
    return filas
      .map((f, i) => {
        let dia = Number(f.dia),
          inicio = f.inicio || f.hora_inicio,
          fin = f.fin || f.hora_fin,
          tipo = f.tipo,
          asignacion_id = f.asignacion_id || null;
        if (
          !Number.isInteger(dia) ||
          dia < 1 ||
          dia > 5 ||
          !/^[0-2]\d:[0-5]\d(?::[0-5]\d)?$/.test(inicio || '') ||
          !/^[0-2]\d:[0-5]\d(?::[0-5]\d)?$/.test(fin || '') ||
          inicio >= fin ||
          !['clase', 'recreo', 'consejeria', 'otro'].includes(tipo)
        )
          throw Error('Franja ' + (i + 1) + ' inválida');
        if (tipo === 'clase' && !a.some((x) => x.id === asignacion_id))
          throw Error(
            'La asignación de la franja ' +
              (i + 1) +
              ' no está disponible para este profesor/año. Encontradas: ' +
              a.length +
              '. Revise el año seleccionado y recargue la página.'
          );
        if (tipo !== 'clase') asignacion_id = null;
        (porDia[dia] ??= []).push({ inicio, fin });
        return {
          dia,
          inicio,
          fin,
          tipo,
          asignacion_id,
          etiqueta: String(f.etiqueta || '').slice(0, 60)
        };
      })
      .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
      .map((f, i, arr) => {
        if (i && arr[i - 1].dia === f.dia && arr[i - 1].fin > f.inicio)
          throw Error('Hay horarios superpuestos');
        return f;
      });
  }
  function f12(t) {
    let [h, m] = String(t).slice(0, 5).split(':').map(Number),
      x = h % 12 || 12;
    return `${x}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p. m.' : 'a. m.'}`;
  }
  const confirmacionesHorario = new Set();
  async function confirmarHorario(llave, titulo, texto, textoBoton, fn) {
    if (confirmacionesHorario.has(llave)) return;
    confirmacionesHorario.add(llave);
    try {
      if (!(await P.confirmar(titulo, texto, textoBoton))) return;
      await fn();
    } finally {
      confirmacionesHorario.delete(llave);
    }
  }

  function rango(a, b) {
    let [h1, m1] = String(a).slice(0, 5).split(':').map(Number),
      [h2, m2] = String(b).slice(0, 5).split(':').map(Number),
      n = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, '0')}`,
      sfx = (h) => (h >= 12 ? 'p.\u00a0m.' : 'a.\u00a0m.');
    return h1 >= 12 === h2 >= 12
      ? `${n(h1, m1)} – ${n(h2, m2)} ${sfx(h2)}`
      : `${n(h1, m1)} ${sfx(h1)} – ${n(h2, m2)} ${sfx(h2)}`;
  }
  function colorDe(id) {
    let i = asigs().findIndex((a) => a.id === id);
    return i < 0 ? '' : 'c' + (i % 6);
  }
  function tipoTxt(t) {
    return (
      {
        clase: 'Clase',
        recreo: 'Recreo',
        consejeria: 'Consejería',
        otro: 'Otro'
      }[t] || t
    );
  }
  function renderFranjas() {
    const tb = $('franjas');
    if (!$('anio').value || !$('profesor').value) { filaVacia(tb, 'Seleccione año y profesor.', 5); return; }
    const filas = []; let dia = 0;
    for (const h of horario) {
      if (h.dia !== dia) {
        dia = h.dia;
        filas.push(el('tr', { clase: 'dia-fila' }, [el('th', { colspan: '5', texto: dias[dia] || '' })]));
      }
      const a = asignaciones.find((x) => x.id === h.asignacion_id);
      const descripcion = h.tipo === 'clase'
        ? el('td', null, [el('span', { clase: 'grupo-marca ' + colorDe(h.asignacion_id) }), nombre(a || {})])
        : el('td', { texto: h.etiqueta || tipoTxt(h.tipo) });
      filas.push(el('tr', null, [
        el('td', { texto: f12(h.hora_inicio) }), el('td', { texto: f12(h.hora_fin) }),
        el('td', null, [el('span', { clase: 'insignia ' + claseTipo(h.tipo), texto: tipoTxt(h.tipo) })]), descripcion,
        el('td', null, [el('button', { type: 'button', clase: 'boton', 'data-editar': String(h.id), texto: 'Editar' }),
          el('button', { type: 'button', clase: 'boton', 'data-borrar': String(h.id), texto: 'Eliminar' })])
      ]));
    }
    if (filas.length) poner(tb, filas);
    else filaVacia(tb, 'Todavía no hay franjas. Use «Preparar el horario de 2027 con un clic» o agregue una franja.', 5);
  }
  function renderSemana() {
    const g = $('semana-grid'), res = $('resumen-semana'), hoy = new Date().getDay(), cl = horario.filter((h) => h.tipo === 'clase');
    if (!horario.length) {
      res.textContent = '';
      const vacio = el('p', { clase: 'dia-vacio', texto: 'Todavía no hay horario guardado. Baje a «Editar horario» y presione «Preparar mis clases».' });
      vacio.style.gridColumn = '1/-1'; poner(g, [vacio]); return;
    }
    const conteo = {};
    cl.forEach((h) => (conteo[h.asignacion_id] = (conteo[h.asignacion_id] || 0) + 1));
    fichas(res, cl.length, 'clases por semana', conteo);
    poner(g, [1, 2, 3, 4, 5].map((d) => {
      const hs = horario.filter((h) => h.dia === d);
      const titulo = el('h4', { texto: dias[d] });
      if (d === hoy) titulo.appendChild(el('small', { texto: 'Hoy' }));
      const tarjetas = hs.map((h) => {
        const a = asignaciones.find((x) => x.id === h.asignacion_id);
        const hora = el('span', { clase: 'hora', texto: rango(h.hora_inicio, h.hora_fin) });
        const n = h.tipo === 'clase'
          ? el('span', { clase: 'nombre' }, [a?.salon?.nombre || '?', el('span', { clase: 'materia', texto: a?.materia?.nombre || '?' })])
          : el('span', { clase: 'nombre', texto: h.etiqueta || tipoTxt(h.tipo) });
        return el('div', { clase: 'franja-tarjeta ' + (h.tipo === 'clase' ? colorDe(h.asignacion_id) : claseTipo(h.tipo)) }, [hora, n]);
      });
      if (!tarjetas.length) tarjetas.push(el('p', { clase: 'dia-vacio', texto: 'Sin franjas' }));
      return el('div', { clase: 'dia-col' + (d === hoy ? ' hoy' : '') }, [titulo, ...tarjetas]);
    }));
  }
  async function cargarHorario() {
    if (!$('anio').value || !$('profesor').value) {
      horario = [];
      renderFranjas();
      renderSemana();
      generar();
      return;
    }
    horario = await query(
      db
        .from('portal2027_horario')
        .select('*')
        .eq('anio_id', $('anio').value)
        .eq('profesor_id', $('profesor').value)
        .order('dia')
        .order('hora_inicio')
    );
    renderFranjas();
    renderSemana();
    $('detalle-facil').open = !horario.length;
    generar();
  }
  async function cargarCalendario() {
    if (!$('anio').value) {
      trimestres = [];
      generar();
      return;
    }
    trimestres = await query(
      db
        .from('portal2027_trimestres')
        .select('id,numero,fecha_inicio,fecha_fin')
        .eq('anio_id', $('anio').value)
        .order('numero')
    );
    sel(
      'trimestre',
      trimestres,
      (t) => `Trimestre ${t.numero} (${t.fecha_inicio} a ${t.fecha_fin})`
    );
    exclusiones = await query(
      db
        .from('portal2027_dias_sin_clases')
        .select('*')
        .eq('anio_id', $('anio').value)
        .order('fecha')
    );
    opciones = await query(
      db.from('portal2027_calendario_opciones').select('*')
    );
    renderExclusiones();
    syncDoble();
    generar();
  }
  function fechaCorta(f) {
    return parseDate(f).toLocaleDateString('es-PA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }
  function renderExclusiones() {
    const l = exclusiones.filter((x) => x.profesor_id === null || x.profesor_id === $('profesor').value);
    poner($('exclusiones'), l.length ? l.map((x) => el('span', { clase: 'exclusion' }, [
      fechaCorta(x.fecha) + ' · ' + (x.motivo ?? '') + ' ', el('em', { texto: '(' + (x.profesor_id ? 'personal' : 'colegio') + ')' }),
      el('button', { type: 'button', clase: 'boton', 'data-excluir': String(x.id), 'aria-label': 'Eliminar día sin clases', title: 'Eliminar', texto: '×' })
    ])) : [el('p', { clase: 'vacio-texto', texto: 'Todavía no hay días sin clases registrados.' })]);
  }
  function syncDoble() {
    $('doble').value =
      opciones.find((o) => o.asignacion_id === $('doble-asignacion').value)
        ?.bloque_doble || 'una';
  }
  let sesionesCalc = [],
    visibles = 40;
  function generar() {
    let t = trimestres.find((x) => x.id === $('trimestre').value);
    if (!t) {
      sesionesCalc = [];
      poner($('resumen'), [el('p', { clase: 'vacio-texto', texto: 'Configure las fechas del trimestre en Administración.' })]);
      renderSesiones();
      return;
    }
    let fuera = new Set(
        exclusiones
          .filter(
            (x) =>
              x.profesor_id === null || x.profesor_id === $('profesor').value
          )
          .map((x) => x.fecha)
      ),
      salida = [],
      conteo = {};
    for (
      let d = parseDate(t.fecha_inicio), fin = parseDate(t.fecha_fin);
      d <= fin;
      d.setDate(d.getDate() + 1)
    ) {
      let dow = d.getDay();
      if (dow < 1 || dow > 5 || fuera.has(dateISO(d))) continue;
      let hs = horario
        .filter((h) => h.dia === dow && h.tipo === 'clase')
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      let ultimo = null;
      for (let h of hs) {
        let a = asignaciones.find((x) => x.id === h.asignacion_id);
        if (!a) continue;
        let doble =
          opciones.find((o) => o.asignacion_id === h.asignacion_id)
            ?.bloque_doble || 'una';
        if (
          doble === 'una' &&
          ultimo &&
          ultimo.asignacion_id === h.asignacion_id &&
          ultimo.hora_fin === h.hora_inicio
        ) {
          ultimo.hora_fin = h.hora_fin;
          continue;
        }
        conteo[h.asignacion_id] = (conteo[h.asignacion_id] || 0) + 1;
        let item = {
          fecha: dateISO(d),
          inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          asignacion_id: h.asignacion_id,
          nombre: nombre(a),
          numero: conteo[h.asignacion_id]
        };
        salida.push(item);
        ultimo = item;
      }
    }
    sesionesCalc = salida;
    if (salida.length) fichas($('resumen'), salida.length, 'sesiones en el trimestre', conteo);
    else $('resumen').textContent = '';
    const f = $('filtro-sesiones'), prev = f.value;
    poner(f, [el('option', { value: '', texto: 'Todos los grupos' }), ...Object.keys(conteo).map((id) =>
      el('option', { value: id, texto: nombre(asignaciones.find((a) => a.id === id) || {}) }))]);
    f.value = conteo[prev] ? prev : '';
    visibles = 40;
    renderSesiones();
  }
  function renderSesiones() {
    const f = $('filtro-sesiones').value, l = sesionesCalc.filter((s) => !f || s.asignacion_id === f), hoy = dateISO(new Date()), vis = l.slice(0, visibles);
    const filas = []; let mes = '';
    for (const s of vis) {
      const fe = parseDate(s.fecha), m = fe.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' });
      if (m !== mes) { mes = m; filas.push(el('tr', { clase: 'mes-fila' }, [el('th', { colspan: '4', texto: m })])); }
      filas.push(el('tr', { clase: s.fecha === hoy ? 'es-hoy' : s.fecha < hoy ? 'ya-paso' : '' }, [
        el('td', { texto: fe.toLocaleDateString('es-PA', { weekday: 'short', day: '2-digit', month: 'short' }) }),
        el('td', { texto: rango(s.inicio, s.hora_fin) }),
        el('td', null, [el('span', { clase: 'grupo-marca ' + colorDe(s.asignacion_id) }), s.nombre]),
        el('td', { texto: String(s.numero) })
      ]));
    }
    if (filas.length) poner($('sesiones'), filas); else filaVacia($('sesiones'), 'No hay clases previstas.', 4);
    $('contador-sesiones').textContent = l.length ? `Mostrando ${vis.length} de ${l.length} sesiones` : '';
    $('ver-mas').hidden = vis.length >= l.length;
  }
  $('filtro-sesiones').onchange = () => {
    visibles = 40;
    renderSesiones();
  };
  $('ver-mas').onclick = () => {
    visibles += 60;
    renderSesiones();
  };
  async function init() {
    try {
      if (!db) throw Error('Sin conexión a Supabase');
      let ses = await query(db.auth.getUser());
      user = ses.user;
      if (!user) throw Error('Debe iniciar sesión');
      let roles = await query(
        db
          .from('portal2027_roles_usuario')
          .select('rol')
          .eq('usuario_id', user.id)
      );
      admin = roles.some((x) => x.rol === 'administrador');
      if (!admin && !roles.some((x) => x.rol === 'profesor'))
        throw Error('Acceso exclusivo para docentes y administración');
      let [anios, profesores, asig] = await Promise.all([
        query(
          db
            .from('portal2027_anios')
            .select('id,anio,activo')
            .order('anio', { ascending: false })
        ),
        query(
          db
            .from('portal2027_roles_usuario')
            .select('usuario_id')
            .eq('rol', 'profesor')
        ),
        query(
          db
            .from('portal2027_asignaciones')
            .select(
              'id,profesor_id,salon:portal2027_salones(nombre,anio_id),materia:portal2027_materias(nombre)'
            )
        )
      ]);
      const ids = [...new Set(profesores.map((x) => x.usuario_id))];
      if (ids.length) {
        const perfiles = await query(
          db
            .from('portal2027_perfiles')
            .select('id,nombres,apellidos')
            .in('id', ids)
        );
        const mapa = new Map(perfiles.map((p) => [p.id, p]));
        profesores.forEach((p) => (p.perfil = mapa.get(p.usuario_id) || null));
      }
      asignaciones = asig;
      sel('anio', anios, (x) => x.anio);
      let activo = anios.find((x) => x.activo);
      if (activo) $('anio').value = activo.id;
      sel('profesor', (admin ? profesores : profesores.filter((x) => x.usuario_id === user.id))
        .map((x) => ({ ...x, id: x.usuario_id })), (x) => (x.perfil?.nombres || '') + ' ' + (x.perfil?.apellidos || ''));
      if (profesores.some((x) => x.usuario_id === user.id))
        $('profesor').value = user.id;
      if (!admin) $('profesor').disabled = true;
      $('global').disabled = !admin;
      syncAsigs();
      await cargarHorario();
      await cargarCalendario();
      msg('Listo. Arriba ve su semana; más abajo puede editarla.');
    } catch (e) {
      msg(e.message, true);
    }
  }
  async function cambio() {
    try {
      syncAsigs();
      await cargarHorario();
      await cargarCalendario();
      msg('Datos actualizados');
    } catch (e) {
      msg(e.message, true);
    }
  }
  $('anio').onchange = cambio;
  $('profesor').onchange = cambio;
  $('trimestre').onchange = generar;
  $('doble-asignacion').onchange = syncDoble;
  $('importar').onclick = async () => {
    try {
      const texto = $('importacion').value.trim();
      if (!texto)
        throw Error('Primero seleccione un JSON o cargue la plantilla.');
      const res = resolverAsignaciones(JSON.parse(texto));
      if (res.faltantes.length)
        throw Error('Faltan asignaciones: ' + res.faltantes.join(', '));
      const filas = validar(res.filas),
        anio = $('anio').value,
        profesor = $('profesor').value;
      await confirmarHorario(
        'reemplazar|' + anio + '|' + profesor,
        'Reemplazar horario completo',
        'Esto reemplazará TODO el horario del profesor para el año seleccionado. ¿Continuar?',
        'Reemplazar horario',
        async () => {
          await rpc('portal2027_reemplazar_horario', {
            p_anio: anio,
            p_profesor: profesor,
            p_filas: filas
          });
          await cargarHorario();
          msg('Horario importado: ' + filas.length + ' franjas');
        }
      );
    } catch (e) {
      msg(e.message, true);
    }
  };
  $('franja').onsubmit = async (e) => {
    e.preventDefault();
    try {
      let f = validar([
        {
          dia: Number($('dia').value),
          inicio: $('inicio').value,
          fin: $('fin').value,
          tipo: $('tipo').value,
          asignacion_id: $('asignacion').value,
          etiqueta: $('etiqueta').value
        }
      ])[0];
      await rpc('portal2027_guardar_horario_franja', {
        p_id: $('franja-id').value || null,
        p_anio: $('anio').value,
        p_profesor: $('profesor').value,
        p_dia: f.dia,
        p_inicio: f.inicio,
        p_fin: f.fin,
        p_tipo: f.tipo,
        p_asignacion: f.asignacion_id,
        p_etiqueta: f.etiqueta
      });
      $('franja').reset();
      $('franja-id').value = '';
      await cargarHorario();
      msg('Franja guardada');
    } catch (x) {
      msg(x.message, true);
    }
  };
  $('limpiar').onclick = () => {
    $('franja').reset();
    $('franja-id').value = '';
  };
  $('franjas').onclick = async (e) => {
    let id = e.target.dataset.editar || e.target.dataset.borrar;
    if (!id) return;
    let h = horario.find((x) => x.id === id);
    if (e.target.dataset.editar) {
      $('franja-id').value = id;
      $('dia').value = h.dia;
      $('inicio').value = h.hora_inicio.slice(0, 5);
      $('fin').value = h.hora_fin.slice(0, 5);
      $('tipo').value = h.tipo;
      $('asignacion').value = h.asignacion_id || '';
      $('etiqueta').value = h.etiqueta || '';
      $('franja').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    try {
      await confirmarHorario(
        'franja|' + id,
        'Eliminar franja',
        '¿Eliminar esta franja?',
        'Eliminar franja',
        async () => {
          await rpc('portal2027_borrar_horario_franja', { p_id: id });
          await cargarHorario();
          msg('Franja eliminada');
        }
      );
    } catch (x) {
      msg(x.message, true);
    }
  };
  $('sinclases').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await rpc('portal2027_guardar_dias_sin_clases', {
        p_anio: $('anio').value,
        p_desde: $('desde').value,
        p_hasta: $('hasta').value,
        p_motivo: $('motivo').value,
        p_global: $('global').checked
      });
      await cargarCalendario();
      msg('Días sin clases registrados');
    } catch (x) {
      msg(x.message, true);
    }
  };
  $('exclusiones').onclick = async (e) => {
    let id = e.target.dataset.excluir;
    if (!id) return;
    try {
      await confirmarHorario(
        'exclusion|' + id,
        'Eliminar día sin clases',
        '¿Eliminar día sin clases?',
        'Eliminar día',
        async () => {
          await rpc('portal2027_borrar_dia_sin_clases', { p_id: id });
          await cargarCalendario();
          msg('Exclusión eliminada');
        }
      );
    } catch (x) {
      msg(x.message, true);
    }
  };
  $('guardar-doble').onclick = async () => {
    try {
      await rpc('portal2027_guardar_opcion_doble', {
        p_asignacion: $('doble-asignacion').value,
        p_valor: $('doble').value
      });
      await cargarCalendario();
      msg('Criterio de bloque doble guardado');
    } catch (e) {
      msg(e.message, true);
    }
  };
  const plantillaMap = {
    'REEMPLAZAR_UUID_9A_NAT': ['9A', 'naturales'],
    'PENDIENTE_ID_9A': ['9A', 'naturales'],
    'REEMPLAZAR_UUID_9B_NAT': ['9B', 'naturales'],
    'PENDIENTE_ID_9B': ['9B', 'naturales'],
    'REEMPLAZAR_UUID_9C_NAT': ['9C', 'naturales'],
    'PENDIENTE_ID_9C': ['9C', 'naturales'],
    'REEMPLAZAR_UUID_8A_NAT': ['8A', 'naturales'],
    'PENDIENTE_ID_8A_NATURALES': ['8A', 'naturales'],
    'REEMPLAZAR_UUID_8A_INF': ['8A', 'informatica'],
    'PENDIENTE_ID_8A_INFORMATICA': ['8A', 'informatica'],
    'REEMPLAZAR_UUID_8B_INF': ['8B', 'informatica'],
    'PENDIENTE_ID_8B_INFORMATICA': ['8B', 'informatica']
  };
  const normalizar = (x) =>
    String(x || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  function resolverAsignaciones(filas) {
    const faltantes = new Set();
    const res = filas.map((f) => {
      if (f.tipo !== 'clase') return { ...f, asignacion_id: null };
      const clave = String(f.asignacion_id || '');
      const destino =
        f.grupo && f.materia
          ? [
              String(f.grupo),
              normalizar(f.materia).includes('informat')
                ? 'informatica'
                : 'naturales'
            ]
          : plantillaMap[clave];
      if (!destino) return f;
      const [grupo, materia] = destino;
      const a = asigs().find(
        (x) =>
          normalizar(x.salon?.nombre).replace(/[^a-z0-9]/g, '') ===
            normalizar(grupo) && normalizar(x.materia?.nombre).includes(materia)
      );
      if (!a) {
        faltantes.add(
          grupo +
            ' · ' +
            (materia === 'naturales' ? 'Ciencias Naturales' : 'Informática')
        );
        return f;
      }
      return { ...f, asignacion_id: a.id };
    });
    return { filas: res, faltantes: [...faltantes] };
  }
  function mostrarImportacion(filas, origen) {
    const r = resolverAsignaciones(filas);
    $('importacion').value = JSON.stringify(r.filas, null, 2);
    $('detalle-importar').open = true;
    if (r.faltantes.length)
      msg(
        origen +
          ': faltan asignaciones en Administración: ' +
          r.faltantes.join(', ') +
          '. No guarde todavía.',
        true
      );
    else
      msg(
        origen +
          ': ' +
          r.filas.length +
          ' franjas preparadas. Revise y guarde cuando esté conforme.'
      );
    return r;
  }
  const zonaArchivo = $('zona-archivo'),
    inputArchivo = $('archivo-horario'),
    estadoArchivo = $('archivo-estado');
  async function cargarArchivoHorario(archivo) {
    if (!archivo) return;
    if (!/\.json$/i.test(archivo.name)) {
      estadoArchivo.textContent = 'Solo se admiten archivos JSON (.json).';
      msg(
        'Seleccione un archivo .json; las imágenes JPG y los Excel no se interpretan aquí.',
        true
      );
      return;
    }
    if (archivo.size > 1024 * 1024) {
      msg('El archivo supera 1 MB.', true);
      return;
    }
    try {
      const contenido = await archivo.text();
      const datos = JSON.parse(contenido);
      if (!Array.isArray(datos))
        throw Error('El archivo debe contener una lista JSON de franjas');
      if (datos.length > 80) throw Error('Máximo 80 franjas');
      const resultado = mostrarImportacion(datos, 'Archivo JSON');
      const pendientes = resultado.filas.filter(
        (f) =>
          f.tipo === 'clase' &&
          (!f.asignacion_id || !asigs().some((a) => a.id === f.asignacion_id))
      );
      estadoArchivo.textContent = `${archivo.name}: ${datos.length} franjas cargadas para revisar.`;
      if (pendientes.length)
        msg(
          `Archivo leído: ${datos.length} franjas, pero ${pendientes.length} clases tienen asignaciones pendientes. No guarde hasta resolverlas.`,
          true
        );
      else
        msg(`Archivo leído: ${datos.length} franjas. Revise antes de guardar.`);
    } catch (e) {
      estadoArchivo.textContent = 'No se pudo leer el archivo.';
      msg('Archivo JSON inválido: ' + e.message, true);
    }
  }
  inputArchivo.addEventListener('change', () =>
    cargarArchivoHorario(inputArchivo.files?.[0])
  );
  zonaArchivo.addEventListener('dragover', (e) => {
    e.preventDefault();
    zonaArchivo.classList.add('arrastrando');
  });
  zonaArchivo.addEventListener('dragleave', () =>
    zonaArchivo.classList.remove('arrastrando')
  );
  zonaArchivo.addEventListener('drop', (e) => {
    e.preventDefault();
    zonaArchivo.classList.remove('arrastrando');
    cargarArchivoHorario(e.dataTransfer.files?.[0]);
  });
  zonaArchivo.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === zonaArchivo) {
      e.preventDefault();
      inputArchivo.click();
    }
  });
  $('cargar-plantilla').onclick = async () => {
    try {
      const resp = await fetch('../data/horarios/horario-samuel-2027.json', {
        cache: 'no-store'
      });
      if (!resp.ok)
        throw Error('No se encontró la plantilla en data/horarios/');
      const filas = await resp.json();
      mostrarImportacion(filas, 'Plantilla 2027');
    } catch (e) {
      msg(e.message, true);
    }
  };

  let faciles = [];
  function opcionesAsignacion(seleccion) {
    return asigs().map((a) => el('option', { value: String(a.id), selected: a.id === seleccion, texto: nombre(a) }));
  }
  function renderFacil() {
    const t = $('vista-facil'); if (!t) return;
    poner(t, faciles.map((f, i) => el('tr', null, [
      el('td', { texto: dias[f.dia] || '' }),
      el('td', null, [el('input', { type: 'time', 'data-i': String(i), 'data-k': 'inicio', value: f.inicio })]),
      el('td', null, [el('input', { type: 'time', 'data-i': String(i), 'data-k': 'fin', value: f.fin })]),
      el('td', null, [el('span', { clase: 'insignia ' + claseTipo(f.tipo), texto: tipoTxt(f.tipo) })]),
      el('td', null, f.tipo === 'clase' ? [el('select', { 'data-i': String(i), 'data-k': 'asignacion_id' }, opcionesAsignacion(f.asignacion_id))] : [String(f.etiqueta || '')])
    ])));
  }
  $('vista-facil').onchange = (e) => {
    let i = Number(e.target.dataset.i),
      k = e.target.dataset.k;
    if (Number.isInteger(i) && faciles[i] && k) faciles[i][k] = e.target.value;
  };
  $('preparar-facil').onclick = async () => {
    try {
      if (!$('anio').value || !$('profesor').value)
        throw Error('Seleccione año y profesor');
      const r = await fetch('../data/horarios/horario-samuel-2027-facil.json', {
        cache: 'no-store'
      });
      if (!r.ok)
        throw Error(
          'Falta subir data/horarios/horario-samuel-2027-facil.json a GitHub'
        );
      const datos = await r.json();
      const res = resolverAsignaciones(datos);
      if (res.faltantes.length)
        throw Error('Faltan asignaciones: ' + res.faltantes.join(', '));
      faciles = validar(res.filas);
      renderFacil();
      $('panel-facil').hidden = false;
      msg(
        'Horario preparado: ' +
          faciles.length +
          ' franjas. Revise y presione Guardar horario completo.'
      );
    } catch (e) {
      msg(e.message, true);
    }
  };
  $('guardar-facil').onclick = async () => {
    try {
      const filas = validar(faciles);
      if (!filas.length) throw Error('Primero prepare el horario');
      const anio = $('anio').value,
        profesor = $('profesor').value;
      await confirmarHorario(
        'reemplazar|' + anio + '|' + profesor,
        'Guardar horario completo',
        '¿Reemplazar el horario completo de este profesor y año?',
        'Guardar horario',
        async () => {
          await rpc('portal2027_reemplazar_horario', {
            p_anio: anio,
            p_profesor: profesor,
            p_filas: filas
          });
          await cargarHorario();
          msg(
            'Horario guardado correctamente: ' +
              filas.length +
              ' franjas. Puede editar cada una debajo.'
          );
        }
      );
    } catch (e) {
      msg('No se pudo guardar: ' + e.message, true);
    }
  };

  init();
})();
