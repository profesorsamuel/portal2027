/* portal2027-clases-comun.js — utilidades compartidas de materiales, tareas y entregas (profesor y estudiante).
   Valida archivos en el navegador (la base y Storage vuelven a validar), construye nombres seguros y abre
   archivos privados con un enlace temporal de 10 minutos. */
(function () {
  'use strict';

  var P = window.portal2027;
  var db = P.db;
  var F = P.archivos;

  var MIME = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  var C = (P.clases = {
    BUCKET_MATERIALES: F.LIMITES.materiales.bucket,
    BUCKET_ENTREGAS: F.LIMITES.entregas.bucket,
    MAX: F.LIMITES.materiales.maxBytes,
    ACEPTAR: '.pdf,.jpg,.jpeg,.png,.txt,.docx,.pptx,.xlsx'
  });

  // Conserva archivos pequeños, documentos y PNG transparentes. El decodificador
  // del navegador aplica EXIF antes de dibujar; no se aplica una segunda rotación.
  C.reducirImagen = async function (archivo, opciones) {
    var o = opciones || {};
    var umbral = o.umbralBytes == null ? F.COMPRESION.umbralBytes : o.umbralBytes;
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
      var limite = o.maxBytes || F.COMPRESION.maxBytes;
      var lado = Math.min(o.maxLado || F.COMPRESION.maxLado, Math.max(ancho, alto));
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

  C.visorImagenes = function(materiales, inicial) {
    var fotos = materiales.filter(function(m) { return m.archivo_ruta && /\.(jpe?g|png)$/i.test(m.archivo_nombre || '') && !m.eliminado_en; });
    var indice = fotos.findIndex(function(m) { return m.id === inicial.id; });
    if (indice < 0) return;
    var escala = 1, inicioX = null;
    var capa = P.el('div', { clase: 'visor-clases', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Presentación de imágenes' });
    var imagen = P.el('img', { alt: '' }), titulo = P.el('p'), contador = P.el('p');
    var controles = P.el('div', { clase: 'controles' });
    function btn(nombre, fn) { var b = P.el('button', { type:'button', texto:nombre }); b.addEventListener('click', fn); controles.appendChild(b); }
    function cerrar() { document.removeEventListener('keydown', teclado); capa.remove(); }
    function mostrar() {
      var m = fotos[indice]; imagen.removeAttribute('src'); imagen.alt = m.titulo || 'Imagen de clase'; titulo.textContent = m.titulo || ''; contador.textContent = (indice + 1) + ' / ' + fotos.length;
      escala = 1; imagen.style.transform = 'scale(1)';
      db.storage.from(C.BUCKET_MATERIALES).createSignedUrl(m.archivo_ruta, 600).then(function(r) { if (!r.error && capa.isConnected && fotos[indice].id === m.id) imagen.src = r.data.signedUrl; });
    }
    function pasar(n) { indice = (indice + n + fotos.length) % fotos.length; mostrar(); }
    function zoom(n) { escala = Math.max(1, Math.min(5, escala + n)); imagen.style.transform = 'scale(' + escala + ')'; }
    function teclado(e) { if(e.key === 'Escape') cerrar(); if(e.key === 'ArrowRight') pasar(1); if(e.key === 'ArrowLeft') pasar(-1); if(e.key === '+') zoom(.25); if(e.key === '-') zoom(-.25); }
    btn('Cerrar ✕', cerrar); btn('◀ Anterior', function(){ pasar(-1); }); btn('Siguiente ▶', function(){ pasar(1); }); btn('Zoom +', function(){ zoom(.25); }); btn('Zoom −', function(){ zoom(-.25); }); btn('Restablecer', function(){ escala=1; imagen.style.transform='scale(1)'; });
    btn('Pantalla completa', function(){ if(capa.requestFullscreen) capa.requestFullscreen().catch(function(){}); });
    btn('Descargar imagen', async function(){ try { var r = await db.storage.from(C.BUCKET_MATERIALES).download(fotos[indice].archivo_ruta); if(r.error) throw r.error; var url = URL.createObjectURL(r.data); var a=document.createElement('a'); a.href=url; a.download=fotos[indice].archivo_nombre || 'imagen.jpg'; a.click(); setTimeout(function(){ URL.revokeObjectURL(url); },1000); } catch(e){ contador.textContent='No se pudo descargar la imagen.'; } });
    imagen.addEventListener('touchstart', function(e){ inicioX=e.touches[0].clientX; }, {passive:true});
    imagen.addEventListener('touchend', function(e){ if(inicioX !== null && e.changedTouches.length){ var d=e.changedTouches[0].clientX-inicioX; if(Math.abs(d)>55) pasar(d<0?1:-1); } inicioX=null; }, {passive:true});
    capa.appendChild(titulo); capa.appendChild(imagen); capa.appendChild(contador); capa.appendChild(controles); document.body.appendChild(capa); document.addEventListener('keydown', teclado); mostrar();
  };

  C.miniatura = function(m) {
    if (!m.archivo_ruta || !/\.(jpe?g|png)$/i.test(m.archivo_nombre || '')) return null;
    var img = P.el('img', { alt: m.titulo, loading: 'lazy', clase: 'recurso-miniatura', hidden: true });
    db.storage.from(C.BUCKET_MATERIALES).createSignedUrl(m.archivo_ruta, 600).then(function(r) { if (!r.error && r.data) { img.src = r.data.signedUrl; img.hidden = false; } }).catch(function() {});
    return img;
  };

  // Devuelve { tipo } si el archivo es válido, o { error }.
  C.validar = function (archivo, uso) {
    if (!archivo) { return { error: 'Elija un archivo.' }; }
    var m = /\.([A-Za-z0-9]+)$/.exec(archivo.name || '');
    var tipo = m ? MIME[m[1].toLowerCase()] : null;
    if (!tipo) { return { error: 'Tipo de archivo no permitido. Use PDF, JPG, PNG, TXT, Word, PowerPoint o Excel.' }; }
    var problema = F.errorTamano(archivo, uso || 'materiales');
    if (problema) { return { error: problema }; }
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

  C.textoError = function (e, uso) { return F.textoError(e, uso || 'materiales'); };
})();
