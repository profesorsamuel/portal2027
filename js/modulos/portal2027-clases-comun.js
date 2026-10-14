/* portal2027-clases-comun.js — utilidades compartidas de materiales, tareas y entregas (profesor y estudiante).
   Valida archivos en el navegador (la base y Storage vuelven a validar), construye nombres seguros y abre
   archivos privados con un enlace temporal de 10 minutos. */
(function () {
  'use strict';

  var P = window.portal2027;
  var db = P.db;

  var MIME = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  var C = (P.clases = {
    BUCKET_MATERIALES: 'portal2027-materiales',
    BUCKET_ENTREGAS: 'portal2027-entregas',
    MAX: 10 * 1024 * 1024,
    ACEPTAR: '.pdf,.jpg,.jpeg,.png,.txt,.docx,.pptx,.xlsx'
  });

  // Conserva archivos pequeños, documentos y PNG transparentes. El decodificador
  // del navegador aplica EXIF antes de dibujar; no se aplica una segunda rotación.
  C.reducirImagen = async function (archivo, opciones) {
    var o = opciones || {};
    var umbral = o.umbralBytes == null ? 1024 * 1024 : o.umbralBytes;
    if (!archivo || !/^image\//i.test(archivo.type || '') || archivo.size <= umbral) { return archivo; }
    var origen;
    try {
      if (window.createImageBitmap) {
        try { origen = await window.createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch (e) { /* alternativa abajo */ }
      }
      if (!origen) {
        origen = await new Promise(function (ok, mal) {
          var url = URL.createObjectURL(archivo), img = new Image();
          img.onload = function () { URL.revokeObjectURL(url); ok(img); };
          img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
          img.src = url;
        });
      }
      var ancho = origen.width || origen.naturalWidth, alto = origen.height || origen.naturalHeight;
      if (Math.max(ancho, alto) <= 320 && !o.pasos) { return archivo; }
      var canvas = document.createElement('canvas'), cx = canvas.getContext('2d');
      if (!cx) { throw new Error('No se pudo preparar la imagen.'); }
      if (archivo.type === 'image/png') {
        canvas.width = ancho; canvas.height = alto;
        cx.drawImage(origen, 0, 0);
        var datos = cx.getImageData(0, 0, ancho, alto).data;
        for (var a = 3; a < datos.length; a += 4) {
          if (datos[a] < 255) { return archivo; }
        }
      }
      var limite = o.maxBytes || 1.5 * 1024 * 1024;
      var lado = Math.min(o.maxLado || 1600, Math.max(ancho, alto));
      var pasos = o.pasos || [];
      if (!o.pasos) {
        while (true) {
          [0.85, 0.7, 0.6].forEach(function (q) { pasos.push([lado, q]); });
          if (lado <= 160) { break; }
          lado = Math.max(160, Math.floor(lado * 0.8));
        }
      }
      for (var i = 0; i < pasos.length; i++) {
        var k = Math.min(1, pasos[i][0] / Math.max(ancho, alto));
        canvas.width = Math.max(1, Math.round(ancho * k));
        canvas.height = Math.max(1, Math.round(alto * k));
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
        cx.drawImage(origen, 0, 0, canvas.width, canvas.height);
        var blob = await new Promise(function (ok) { canvas.toBlob(ok, 'image/jpeg', pasos[i][1]); });
        if (blob && blob.size < limite) {
          return new File([blob], (archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: archivo.lastModified });
        }
      }
      throw new Error('No se pudo reducir la imagen al tamaño permitido.');
    } finally {
      if (origen && origen.close) { origen.close(); }
    }
  };

  C.urlSegura = function(valor) { try { var u = new URL(valor); return /^https?:$/.test(u.protocol) ? u.href : null; } catch(e) { return null; } };
  C.enlace = function(valor, titulo) { var url = C.urlSegura(valor); return url ? P.el('a', { clase: 'boton boton-secundario boton-chico', href: url, target: '_blank', rel: 'noopener noreferrer', texto: titulo || 'Abrir enlace' }) : null; };

  C.miniatura = function(m) {
    if (!m.archivo_ruta || !/\.(jpe?g|png)$/i.test(m.archivo_nombre || '')) return null;
    var img = P.el('img', { alt: m.titulo, loading: 'lazy', clase: 'recurso-miniatura', hidden: true });
    db.storage.from(C.BUCKET_MATERIALES).createSignedUrl(m.archivo_ruta, 600).then(function(r) { if (!r.error && r.data) { img.src = r.data.signedUrl; img.hidden = false; } }).catch(function() {});
    return img;
  };

  // Devuelve { tipo } si el archivo es válido, o { error }.
  C.validar = function (archivo) {
    if (!archivo) { return { error: 'Elija un archivo.' }; }
    var m = /\.([A-Za-z0-9]+)$/.exec(archivo.name || '');
    var tipo = m ? MIME[m[1].toLowerCase()] : null;
    if (!tipo) { return { error: 'Tipo de archivo no permitido. Use PDF, JPG, PNG, TXT, Word, PowerPoint o Excel.' }; }
    if (archivo.size === 0) { return { error: 'El archivo está vacío.' }; }
    if (archivo.size > C.MAX) { return { error: 'El archivo pesa más de 10 MB.' }; }
    return { tipo: tipo };
  };

  // Nombre apto para la ruta de Storage: sin acentos, espacios ni símbolos; conserva la extensión.
  C.nombreSeguro = function (nombre) {
    var limpio = String(nombre || 'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_');
    var m = /(\.[A-Za-z0-9]+)$/.exec(limpio);
    var ext = m ? m[1] : '';
    var base = ext ? limpio.slice(0, -ext.length) : limpio;
    return (base.slice(0, 60) || 'archivo') + ext.toLowerCase();
  };

  // Abre un archivo privado en otra pestaña con enlace temporal.
  C.abrir = async function (bucket, ruta) {
    var w = window.open('', '_blank');
    try {
      var r = await db.storage.from(bucket).createSignedUrl(ruta, 600);
      if (r.error) { throw r.error; }
      if (w) { w.location.href = r.data.signedUrl; } else { window.location.assign(r.data.signedUrl); }
    } catch (e) {
      if (w) { w.close(); }
      throw e;
    }
  };

  C.fechaHora = function (iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    return d.toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // ISO → valor para <input type="datetime-local"> (hora local).
  C.aInputFecha = function (iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  // <input datetime-local> → ISO (o null si está vacío).
  C.deInputFecha = function (valor) {
    if (!valor) { return null; }
    var d = new Date(valor);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  // Mensajes de la base que sí se muestran tal cual (están en español y son claros).
  C.textoError = function (e) {
    var m = (e && e.message) || '';
    if (/^CONFLICTO/.test(m)) { return m.replace(/^CONFLICTO:\s*/, 'Conflicto: ') + ' Pulse «Recargar».'; }
    if (/mime type|not supported/i.test(m)) { return 'Tipo de archivo no permitido.'; }
    if (/maximum allowed size|too large|payload/i.test(m)) { return 'El archivo pesa más de 10 MB.'; }
    if (/already exists|duplicate key/i.test(m) && /evaluacion_uq/.test(m)) { return 'Esa columna de la libreta ya está vinculada a otra tarea.'; }
    if (/ya fue revisada|no está disponible|no corresponde|no se encontró|motivo|vinculada|bloqueada|papelera|entre 0 y 5|revisadas|misma materia|no pertenece|No tiene permiso/i.test(m)
        && !/duplicate key/i.test(m)) {
      return m.replace(/\s*\(row-level security\)/, '');
    }
    return P.traducirError(e);
  };
})();
