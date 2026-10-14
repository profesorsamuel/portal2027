// Paneles de la pantalla de horario (semana / editar / calendario).
// Antes era un <script> en línea de pages/portal2027-horario.html; se movió a un archivo
// para poder aplicar una CSP sin unsafe-inline. Se carga después de portal2027-horario.js.
(() => {
  const secciones = ['semana','editar','calendario'];
  const instrucciones = {semana:'Aquí puede consultar sus clases de lunes a viernes.', editar:'Seleccione Editar para corregir una clase o use Agregar clase para crear una nueva.', calendario:'Consulte las sesiones del trimestre y registre los días sin clases.'};
  function mostrar(id) {
    secciones.forEach(x => { document.getElementById(x).hidden = x !== id; });
    document.querySelectorAll('[data-panel]').forEach(b => { b.classList.toggle('activa', b.dataset.panel === id); b.setAttribute('aria-pressed', String(b.dataset.panel === id)); });
    document.getElementById('instruccion-panel').textContent = instrucciones[id];
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => mostrar(b.dataset.panel)));
  document.getElementById('accion-agregar').addEventListener('click', () => {
    mostrar('editar'); document.getElementById('limpiar').click();
    document.getElementById('titulo-agregar').scrollIntoView({behavior:'smooth',block:'start'});
    document.getElementById('dia').focus({preventScroll:true});
  });
  document.getElementById('accion-opciones').addEventListener('click', () => {
    mostrar('editar'); document.getElementById('detalle-avanzado').open = true;
    document.getElementById('detalle-avanzado').scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.getElementById('franjas').addEventListener('click', e => {
    if (e.target.closest('[data-editar]')) {
      document.getElementById('titulo-agregar').scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  if (location.hash === '#editar' || location.hash === '#calendario') mostrar(location.hash.slice(1));
})();
