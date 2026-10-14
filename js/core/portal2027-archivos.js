/* portal2027-archivos.js — configuración común de archivos.
   Cargar después de permisos y antes de los módulos. Cambios en límites requieren
   una migración de buckets y, cuando corresponda, de las RPC que validan tamaños. */
(function () {
  'use strict';
  var P = window.portal2027;
  var MB = 1024 * 1024;
  var F = P.archivos = {};
  F.LIMITES = Object.freeze({
    fotos: Object.freeze({ bucket: 'portal2027-fotos', maxBytes: 2 * MB }),
    documentos: Object.freeze({ bucket: 'portal2027-documentos', maxBytes: 5 * MB }),
    materiales: Object.freeze({ bucket: 'portal2027-materiales', maxBytes: 15 * MB }),
    entregas: Object.freeze({ bucket: 'portal2027-entregas', maxBytes: 15 * MB }),
    planificacion: Object.freeze({ bucket: 'portal2027-planificaciones', maxBytes: 15 * MB })
  });
  F.COMPRESION = Object.freeze({ umbralBytes: MB, maxBytes: 1.5 * MB, maxLado: 1600 });
  F.maxMB = function (uso) { return F.LIMITES[uso].maxBytes / MB; };
  F.peso = function (bytes) {
    // Redondear hacia arriba impide que un archivo apenas excesivo parezca permitido.
    return (Math.ceil(bytes / MB * 100) / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') + ' MB';
  };
  F.esPDF = function (archivo) { return !!archivo && (/\.pdf$/i.test(archivo.name || '') || archivo.type === 'application/pdf'); };
  F.errorTamano = function (archivo, uso) {
    if (!archivo) { return 'Elija un archivo.'; }
    if (archivo.size === 0) { return 'El archivo está vacío. Elija otro.'; }
    if (archivo.size <= F.LIMITES[uso].maxBytes) { return ''; }
    return 'Pesa ' + F.peso(archivo.size) + ', el máximo es ' + F.maxMB(uso) + ' MB. ' +
      (F.esPDF(archivo) ? 'Comprímalo en ilovepdf.com o smallpdf.com y vuelva a subirlo.' : 'Reduzca el tamaño del archivo y vuelva a subirlo.');
  };
  F.detalleArchivo = function (archivo, uso) {
    var cont = P.el('div', { clase: 'bloque-ayuda' });
    if (!archivo) { return cont; }
    var problema = F.errorTamano(archivo, uso);
    cont.appendChild(P.el('p', { clase: problema ? 'mensaje error' : 'bloque-ayuda', texto: problema || archivo.name + ' · Pesa ' + F.peso(archivo.size) + ' · Máximo: ' + F.maxMB(uso) + ' MB.' }));
    if (problema && F.esPDF(archivo)) {
      cont.appendChild(P.el('p', null, [
        P.el('a', { href: 'https://www.ilovepdf.com/compress_pdf', target: '_blank', rel: 'noopener noreferrer', texto: 'Abrir iLovePDF' }), ' · ',
        P.el('a', { href: 'https://smallpdf.com/compress-pdf', target: '_blank', rel: 'noopener noreferrer', texto: 'Abrir Smallpdf' })
      ]));
    }
    return cont;
  };
  F.vincularPeso = function (entrada, uso) {
    var cont = P.el('div', { role: 'status', 'aria-live': 'polite' });
    entrada.addEventListener('change', function () {
      cont.textContent = '';
      var archivo = entrada.files && entrada.files[0];
      if (archivo) { cont.appendChild(F.detalleArchivo(archivo, uso)); }
    });
    return cont;
  };
  // Nunca devuelve detalles del proveedor, nombres de tablas ni mensajes técnicos.
  F.textoError = function (e, uso) {
    console.error('Operación de archivos (' + (uso || 'general') + ')', e);
    var m = (e && e.message) || '', estado = Number(e && (e.statusCode || e.status));
    if (/^CONFLICTO/i.test(m)) { return 'Los datos cambiaron. Recargue la página antes de intentar nuevamente.'; }
    if (/ya fue revisada/i.test(m)) { return 'El profesor ya revisó la entrega; no se puede reemplazar.'; }
    if (/ya fue aprobado/i.test(m)) { return 'El documento ya fue aprobado. Comuníquese con la administración para cambiarlo.'; }
    if (/maximum allowed size|too large|payload|pesa más|exceeds.*size/i.test(m) || estado === 413) {
      return 'El archivo supera el tamaño permitido' + (uso ? ' (máximo ' + F.maxMB(uso) + ' MB)' : '') + '. Reduzca su tamaño y vuelva a subirlo.';
    }
    if (/mime type|not supported|invalid_mime|tipo.*no permitido/i.test(m)) { return 'Este formato de archivo no está permitido. Elija uno de los indicados en el formulario.'; }
    if (/Failed to fetch|NetworkError|Load failed|network|timeout/i.test(m)) { return 'No hay conexión con el servidor. Revise su internet e intente de nuevo.'; }
    if (/jwt|session.*expired|token.*expired/i.test(m) || estado === 401) { return 'Su sesión venció. Inicie sesión nuevamente.'; }
    if (/row-level security|permission denied|No tiene permiso/i.test(m) || estado === 403) { return 'No tiene permiso para esta acción. Consulte al profesor o a la administración.'; }
    if (/no se encontró|not found|no existe/i.test(m)) { return 'No se encontró el archivo o registro solicitado. Recargue la página e intente nuevamente.'; }
    if (/no está disponible|eliminad|papelera/i.test(m)) { return 'Este recurso ya no está disponible. Recargue la página.'; }
    if (/no corresponde|no pertenece|misma materia/i.test(m)) { return 'El archivo o recurso no corresponde a esta clase o estudiante. Revise la selección.'; }
    if (/evaluacion_uq|vinculada/i.test(m)) { return 'Esa columna de notas ya está vinculada a otra tarea.'; }
    if (/bloqueada|cerrado/i.test(m)) { return 'Este registro está cerrado o bloqueado. Consulte al profesor o a la administración.'; }
    if (/motivo|observación/i.test(m)) { return 'Escriba el motivo solicitado para completar el cambio.'; }
    if (/entre 0 y 5/i.test(m)) { return 'La nota debe estar entre 0 y 5.'; }
    if (/matriculado/i.test(m)) { return 'El estudiante no tiene una matrícula disponible para esta acción.'; }
    return 'No se pudo completar la acción. Recargue la página e intente de nuevo. Si continúa, comuníquese con la administración.';
  };
})();
