// Juego «Origen del universo, del sistema solar y de la Luna» · Ciencias Naturales 9.° · Clase 1.
// Tipo 1: quiz con vidas y racha. Contenido basado SOLO en el PDF «Clase 1 · 14 al 25 de septiembre».
// Cumple docs/portal2027-integracion-ejercicios.md: solo usa iniciarEjercicio y guardarIntento.
// Sin estilos ni scripts en línea, sin asignar HTML con texto del contenido, sin almacenamiento del navegador.
// Se carga después de portal2027-integracion-ejercicios.js.
(function () {
  'use strict';
  var P = window.portal2027, el = P.el, E = P.ejercicios;
  var cont = document.getElementById('contenido');

  /* ---------------- Parámetros del juego ---------------- */
  var CUPO = { 1: 3, 2: 4, 3: 3 };           // por partida: 30 % recordar, 40 % comprender, 30 % aplicar/analizar
  var TOTAL = 10;                             // preguntas por partida
  var PUNTOS_BASE = 10;                       // primera oportunidad
  var PUNTOS_REPASO = 5;                      // segunda oportunidad (la mitad)
  var COSTO_PISTA = 2;                        // por pista, primera oportunidad
  var COSTO_PISTA_REPASO = 1;                 // por pista, segunda oportunidad
  var VIDAS = 3;
  var PUNTOS_MAX = TOTAL * PUNTOS_BASE;       // 100 → nota = puntos / 100 × 5

  var NIVELES = { 1: 'Nivel 1 · Recordar', 2: 'Nivel 2 · Comprender', 3: 'Nivel 3 · Aplicar y analizar' };
  var PARTES = {
    1: 'Parte 1 · El origen del universo y del sistema solar',
    2: 'Parte 2 · ¿Cómo se formó el sistema solar?',
    3: 'Parte 3 · La teoría moderna de la nebulosa',
    4: 'Parte 4 · El origen de la Luna'
  };
  var ACIERTOS = ['¡Correcto!', '¡Muy bien!', '¡Así es!', '¡Bien pensado!', '¡Excelente!'];
  var ANIMOS = [
    'Equivocarse también es aprender: lee la explicación y sigue.',
    'Cada error te muestra qué repasar. ¡Ánimo!',
    'Vas bien, sigue con calma: no hay límite de tiempo.',
    'Esta pregunta volverá y tendrás otra oportunidad.'
  ];

  var IDEAS_CLAVE = [
    'El Big Bang es el modelo científico más aceptado: hace unos 13 800 millones de años toda la materia, la energía y el espacio estaban en una singularidad que se expandió. Lo respaldan la expansión de las galaxias, la radiación cósmica de fondo y la formación de elementos.',
    'El sistema solar (4568 millones de años) se explica sobre todo con la teoría de la nebulosa: el colapso gravitacional de parte de una nube de gas y polvo formó el protosol y un disco protoplanetario, donde los granos de polvo se aglutinaron hasta formar los planetas. Otras teorías son acreción, planetesimales, Laplace y captura.',
    'La Luna se explica con la teoría del gran impacto: el choque de Tea, un protoplaneta del tamaño de Marte, contra la Tierra. La Luna tiene unos 4600 millones de años y su composición geológica similar a la de la Tierra apoya esta teoría.'
  ];

  var REFLEXION = [
    { parte: 1, texto: '¿Cómo creen que las personas explicaban el origen del universo antes de tener telescopios o naves espaciales? ¿Por qué crees que hoy seguimos investigando algo que “ya tiene una teoría aceptada”?' },
    { parte: 2, texto: 'Si hay tantas teorías distintas sobre cómo se formó el sistema solar, ¿significa que los científicos “no saben” la respuesta? ¿Qué papel juega el descubrimiento de nuevos planetas y sistemas en poner a prueba estas teorías?' },
    { parte: 3, texto: 'Si toda la materia del sistema solar viene de una misma nube de gas y polvo, ¿por qué el Sol, la Tierra y un cometa terminaron siendo tan distintos entre sí?' },
    { parte: 4, texto: 'Si la Luna y la Tierra tienen una composición geológica parecida, ¿qué nos dice eso sobre cómo se pudo haber formado la Luna? ¿Por qué esa similitud no encaja tan bien con la teoría de la captura?' }
  ];

  /* ---------------- Banco de preguntas (30 = 3 × las 10 que se usan) ----------------
     nv: 1 recordar · 2 comprender · 3 aplicar/analizar.  parte: parte del PDF (1 a 4; una parte por página).
     ok: respuesta correcta · mal: 3 distractores · pista: pista 1 · por: por qué es correcta (según el PDF). */
  var BANCO = [
    // ---- Nivel 1 · Recordar (9) ----
    { nv: 1, parte: 1, q: '¿Cuál es el modelo científico más aceptado sobre el origen, la evolución y la expansión del universo?',
      ok: 'La teoría del Big Bang', mal: ['La teoría de la captura', 'La teoría de Laplace', 'La teoría del gran impacto'],
      pista: 'Se menciona en la Parte 1. Habla de un punto inicial que se expandió.',
      por: 'El PDF presenta el Big Bang como el modelo científico más aceptado sobre el origen, la evolución y la expansión del universo. Las otras teorías explican el sistema solar o la Luna.' },
    { nv: 1, parte: 1, q: '¿Hace cuánto tiempo ocurrió el Big Bang, según el PDF?',
      ok: 'Hace unos 13 800 millones de años', mal: ['Hace unos 4568 millones de años', 'Hace unos 4600 millones de años', 'Hace unos 13 800 años'],
      pista: 'Es la cifra más grande de todas las que aparecen en el PDF. Revisa la Parte 1.',
      por: 'La antigüedad estimada del universo es de unos 13 800 millones de años. La cifra de 4568 millones corresponde al sistema solar y la de 4600 millones a la Luna.' },
    { nv: 1, parte: 1, q: 'Antes de la expansión, toda la materia, la energía y el espacio estaban concentrados en un punto de densidad infinita. ¿Cómo se llama ese punto?',
      ok: 'Singularidad', mal: ['Nebulosa', 'Protosol', 'Supernova'],
      pista: 'Es el «estado inicial» que aparece en el cuadro de datos de la Parte 1.',
      por: 'El PDF llama singularidad al estado inicial: un punto de densidad infinita que se expandió y dio origen al universo actual.' },
    { nv: 1, parte: 1, q: 'Según la definición del PDF, ¿cuántos planetas orbitan alrededor del Sol en el sistema solar?',
      ok: 'Ocho', mal: ['Cinco', 'Siete', 'Diez'],
      pista: 'Está en la definición de «sistema solar» al inicio de la Parte 1.',
      por: 'El sistema solar está formado por el Sol como estrella central, ocho planetas con sus satélites y otros cuerpos celestes, como planetoides, cometas y asteroides.' },
    { nv: 1, parte: 3, q: '¿Quiénes descubrieron la radiación cósmica de fondo?',
      ok: 'Arno Penzias y Robert Wilson', mal: ['René Descartes y Kant', 'Swedenborg y Laplace', 'La NASA y la ESA'],
      pista: 'Fue en 1965. Mira el cuadro de datos de la Parte 3.',
      por: 'El cuadro de la Parte 3 indica que la radiación cósmica de fondo fue descubierta en 1965 por Arno Penzias y Robert Wilson.' },
    { nv: 1, parte: 3, q: '¿Cómo ocurrió el hallazgo de la radiación cósmica de fondo?',
      ok: 'De forma accidental', mal: ['Estaba planificado desde el siglo XVII', 'Se encontró durante la exploración de la Luna', 'Lo predijo Descartes y se confirmó en el siglo XX'],
      pista: 'Busca «Forma de hallazgo» en el cuadro de datos de la Parte 3.',
      por: 'El cuadro de la Parte 3 señala que el hallazgo fue accidental.' },
    { nv: 1, parte: 4, q: 'Según la teoría del gran impacto, ¿cómo se llamaba el protoplaneta que chocó contra la Tierra?',
      ok: 'Tea', mal: ['Marte', 'Beta Pictoris', 'Protosol'],
      pista: 'Su tamaño era parecido al de Marte, pero tenía otro nombre.',
      por: 'El PDF explica que un protoplaneta del tamaño de Marte, llamado Tea, chocó contra la Tierra. Marte solo se menciona para comparar el tamaño.' },
    { nv: 1, parte: 4, q: '¿Cuál es la teoría más aceptada actualmente sobre el origen de la Luna?',
      ok: 'El gran impacto', mal: ['La captura', 'La fisión', 'La conformación lunar'],
      pista: 'Está en la Parte 4 y involucra una colisión con un protoplaneta.',
      por: 'El PDF indica que el gran impacto es la teoría más aceptada sobre el origen de la Luna.' },
    { nv: 1, parte: 2, q: '¿Cuál es la teoría más aceptada actualmente sobre cómo se formó el sistema solar?',
      ok: 'La teoría de la nebulosa', mal: ['La teoría de la captura', 'La teoría de la acreción', 'La teoría de Laplace'],
      pista: 'Su nombre se relaciona con una nube de gas y polvo (Parte 2).',
      por: 'El PDF señala que la teoría de la nebulosa es la explicación más aceptada. Acreción, planetesimales, captura y Laplace son otras teorías.' },

    // ---- Nivel 2 · Comprender (12) ----
    { nv: 2, parte: 1, q: 'Las galaxias distantes se alejan entre sí. ¿Qué indica esto sobre el universo?',
      ok: 'Que el universo sigue expandiéndose desde su inicio', mal: ['Que el universo se está encogiendo', 'Que las galaxias dejaron de existir', 'Que el universo no tuvo un inicio'],
      pista: 'Es la primera evidencia de la lista de la Parte 1.',
      por: 'Según el PDF, que las galaxias distantes se alejen entre sí muestra que el universo sigue expandiéndose desde su inicio.' },
    { nv: 2, parte: 1, q: '¿Por qué la radiación cósmica de fondo se considera una evidencia del Big Bang?',
      ok: 'Porque es un remanente de la fase caliente y densa inicial del universo, enfriado al expandirse', mal: ['Porque solo se detecta alrededor del Sol', 'Porque la produjo la explosión de una supernova cercana', 'Porque se encontró únicamente en la Luna'],
      pista: 'Piensa en el «calor residual» que se detecta en todas las direcciones.',
      por: 'El PDF la describe como un remanente de la fase caliente y densa inicial del universo, que se enfrió al expandirse y puede detectarse en cualquier parte del universo observable.' },
    { nv: 2, parte: 1, q: 'Aunque el Big Bang cuenta con amplia evidencia, ¿qué aún no se comprende del todo?',
      ok: 'Los primeros instantes y lo que pudo haber pasado antes', mal: ['Que el universo se está expandiendo', 'Que existe la radiación cósmica de fondo', 'Que las galaxias distantes se alejan'],
      pista: 'Fíjate en la última frase del texto sobre la teoría del Big Bang.',
      por: 'El PDF aclara que aún no se comprenden del todo los primeros instantes ni qué pudo haber sucedido antes. La expansión, la radiación de fondo y el alejamiento de las galaxias sí son evidencias.' },
    { nv: 2, parte: 1, q: 'Según la evidencia del Big Bang, ¿cómo se formaron los elementos?',
      ok: 'El hidrógeno y el helio se formaron en las primeras etapas del universo; los elementos más pesados, después, en las estrellas', mal: ['Todos los elementos aparecieron a la vez dentro de la singularidad', 'Los elementos pesados se formaron primero y el hidrógeno y el helio después', 'Los elementos se formaron cuando se creó la Luna'],
      pista: 'La lista de evidencias de la Parte 1 habla de nucleosíntesis estelar.',
      por: 'El PDF explica que el hidrógeno y el helio se formaron en las primeras etapas del universo y que luego la nucleosíntesis estelar generó los elementos más pesados.' },
    { nv: 2, parte: 1, q: '¿Cómo ha cambiado la manera de explicar el universo a lo largo de la historia?',
      ok: 'Primero con explicaciones mitológicas o religiosas y más tarde con explicaciones científicas', mal: ['Primero fue científica y después mitológica', 'Solo una cultura propuso explicaciones', 'Nunca ha cambiado: siempre se explicó igual'],
      pista: 'Lee el párrafo «El origen del universo» de la Parte 1.',
      por: 'El PDF dice que todas las culturas propusieron representaciones del cosmos: primero de tipo mitológico o religioso y más tarde desde un punto de vista científico.' },
    { nv: 2, parte: 2, q: '¿Cuál es la diferencia principal entre la teoría de la nebulosa y la teoría de la captura?',
      ok: 'En la nebulosa los planetas salen de una gran nube de gas y polvo en rotación; en la captura el Sol extrae materia de una protoestrella cercana',
      mal: ['En la nebulosa el Sol extrae materia de una protoestrella cercana; en la captura los planetas salen de una nube de gas y polvo', 'En la nebulosa los planetas se forman por el choque con Tea; en la captura, por una supernova', 'No hay diferencia: son dos nombres de la misma teoría'],
      pista: 'Revisa la tabla resumen de la Parte 2.',
      por: 'La tabla de la Parte 2 resume que en la nebulosa los planetas se forman de una gran nube de gas y polvo en rotación alrededor del Sol, y en la captura el Sol extrae materia de una protoestrella cercana.' },
    { nv: 2, parte: 2, q: '¿Cómo se forman los planetas según la teoría de los planetesimales (protoplanetas)?',
      ok: 'Por choques y atracción gravitacional entre cuerpos pequeños que se van acumulando', mal: ['Por un solo gran choque entre la Tierra y Tea', 'Porque una nebulosa en rotación se enfría y forma anillos', 'Porque el Sol extrae un filamento de una protoestrella'],
      pista: 'Los planetesimales son cuerpos pequeños. ¿Qué les pasa entre sí? (Parte 2).',
      por: 'El PDF explica que los planetesimales (hasta 1 km de diámetro) colisionan y se atraen entre sí, y que los impactos acumulados forman gradualmente los planetas.' },
    { nv: 2, parte: 2, q: 'Según la teoría de Laplace, ¿cómo se originan los planetas?',
      ok: 'Una nebulosa en rotación se enfría y se condensa en anillos que originan los planetas', mal: ['Una protoestrella cercana entrega un filamento de materia al Sol', 'Planetesimales de hasta 1 km chocan y se acumulan', 'Un protoplaneta del tamaño de Marte choca con la Tierra'],
      pista: 'Piensa en anillos que se forman alrededor de una masa central que será el Sol.',
      por: 'El PDF resume la idea de Laplace así: una nebulosa en rotación se enfría y se condensa en anillos, que originan los planetas, mientras la masa central se convierte en el Sol.' },
    { nv: 2, parte: 3, q: 'Según la teoría moderna de la nebulosa, ¿qué pudo haber desencadenado la formación del Sol?',
      ok: 'La onda de choque de una supernova cercana', mal: ['El choque de Tea contra la Tierra', 'La captura de la Luna por la gravedad terrestre', 'La rápida rotación de la Tierra primitiva'],
      pista: 'Es la explosión de una estrella (mira el «Vocabulario clave» de la Parte 3).',
      por: 'Los elementos observados indican que hubo una supernova cercana, cuya onda de choque pudo haber desencadenado la formación del Sol.' },
    { nv: 2, parte: 3, q: '¿Qué es una protoestrella?',
      ok: 'La fase temprana de formación de una estrella, antes de que inicie la fusión nuclear', mal: ['Una estrella que explota y expulsa materia a gran velocidad', 'Un planeta del tamaño de Marte', 'La ciencia que estudia los cuerpos celestes'],
      pista: 'Busca «Protoestrella» en el «Vocabulario clave» de la Parte 3.',
      por: 'El vocabulario del PDF define la protoestrella como la fase temprana de formación de una estrella, antes de la fusión nuclear. La explosión de una estrella es una supernova y la ciencia que estudia los astros es la astronomía.' },
    { nv: 2, parte: 3, q: 'La teoría moderna de la nebulosa se basa en el descubrimiento de otros sistemas planetarios, como Beta Pictoris. ¿Qué se observa en las estrellas jóvenes de esos sistemas?',
      ok: 'Están rodeadas de densos discos de polvo', mal: ['No tienen ningún material a su alrededor', 'Giran alrededor del Sol', 'Son más antiguas que el universo'],
      pista: 'Mira el primer párrafo de la Parte 3.',
      por: 'El PDF explica que las estrellas jóvenes observadas están rodeadas de densos discos de polvo, y esa observación sirve de base a la teoría moderna de la nebulosa.' },
    { nv: 2, parte: 4, q: 'Según la teoría del gran impacto, ¿qué pasó con las rocas que salieron proyectadas por la colisión?',
      ok: 'Orbitaron la Tierra y formaron una masa fundida que, con millones de años, se solidificó hasta formar la Luna', mal: ['Se alejaron del sistema solar y nunca regresaron', 'Formaron el Sol', 'Se solidificaron en pocos días y formaron la Tierra'],
      pista: 'Piensa en cuánto tiempo tardó en solidificarse: el PDF habla de millones de años.',
      por: 'El PDF dice que la colisión proyectó enormes cantidades de rocas que orbitaron el planeta y se concentraron en una masa fundida que, a lo largo de millones de años, se solidificó hasta formar el satélite.' },

    // ---- Nivel 3 · Aplicar y analizar (9) ----
    { nv: 3, parte: 4, q: 'Las expediciones lunares revelaron que la Luna y la Tierra tienen una composición geológica similar. ¿Qué teoría sustenta mejor este hallazgo?',
      ok: 'La teoría del gran impacto', mal: ['La teoría de la captura', 'La teoría de Laplace', 'Ninguna: la composición no dice nada sobre su origen'],
      pista: 'Mira «La exploración lunar como evidencia» en la Parte 4.',
      por: 'El PDF afirma que esa similitud es un hallazgo clave para sustentar la teoría del gran impacto. En la captura, en cambio, la Luna se habría formado en otro lugar del sistema solar.' },
    { nv: 3, parte: 2, q: 'Un astrónomo describe planetas rocosos cerca del Sol y gigantes gaseosos más allá de las 3 UA. ¿Con qué teoría del PDF se relaciona esta descripción?',
      ok: 'La teoría de los planetesimales (protoplanetas)', mal: ['La teoría de la captura', 'La teoría de Laplace', 'La teoría de la acreción'],
      pista: 'En la Parte 2 hay un esquema de cuatro pasos que termina con esta distribución.',
      por: 'La teoría de los planetesimales dice que los impactos acumulados formaron planetas rocosos cerca del Sol y gigantes gaseosos más allá de las 3 UA.' },
    { nv: 3, parte: 2, q: 'Quieres explicar por qué el Sol tiene una baja velocidad de rotación. ¿Qué teoría del PDF lo explica?',
      ok: 'La teoría de la captura', mal: ['La teoría del gran impacto', 'La teoría de Laplace', 'La teoría de la acreción'],
      pista: 'Es la teoría en la que el Sol interactuó con una protoestrella cercana.',
      por: 'El PDF indica que la teoría de la captura explica la baja velocidad de rotación del Sol y la formación de los planetas terrestres por colisiones.' },
    { nv: 3, parte: 2, q: 'Se descubren planetas con órbitas muy alargadas o inversas. ¿Cuál teoría del PDF tiene dificultad para explicarlo?',
      ok: 'La de los protoplanetas (discos protoplanetarios)', mal: ['La teoría de la captura', 'La teoría de Laplace', 'La teoría del gran impacto'],
      pista: 'Revisa «Otras teorías» en la Parte 2: una de ellas no explica bien esas órbitas.',
      por: 'El PDF señala que la teoría de los protoplanetas (discos protoplanetarios) no explica bien las órbitas alargadas o inversas de algunos planetas descubiertos.' },
    { nv: 3, parte: 1, q: '¿Cuál de estas afirmaciones NO es una evidencia a favor del Big Bang según el PDF?',
      ok: 'Los planetas rocosos se forman cerca del Sol', mal: ['Las galaxias distantes se alejan entre sí', 'Existe radiación cósmica de fondo en todas direcciones', 'El hidrógeno y el helio se formaron en las primeras etapas del universo'],
      pista: 'Tres afirmaciones están en la lista de evidencias de la Parte 1; una pertenece a otro tema.',
      por: 'Las evidencias del Big Bang son la expansión, la radiación cósmica de fondo y la formación de elementos. Los planetas rocosos cerca del Sol se relacionan con la formación del sistema solar.' },
    { nv: 3, parte: 3, q: 'Un texto dice: «Una parte de una nebulosa gigante colapsó por gravedad; la mayor parte de la masa formó un protosol y el resto se aplanó en un disco». ¿Qué teoría describe esto?',
      ok: 'La teoría moderna de la nebulosa', mal: ['La teoría del gran impacto', 'La teoría de la fisión', 'El modelo del Big Bang'],
      pista: 'Se trata de la formación del Sol y de los planetas (Parte 3).',
      por: 'Es la descripción de la teoría moderna de la nebulosa: colapso gravitacional de una parte de una nebulosa gigante, con un protosol y un disco protoplanetario.' },
    { nv: 3, parte: 3, q: '¿Cuál es el orden correcto de formación del sistema solar según la teoría moderna de la nebulosa?',
      ok: 'Colapso de una parte de la nebulosa → protosol y disco protoplanetario → granos de polvo que se aglutinan → planetas',
      mal: ['Planetas → disco protoplanetario → colapso de la nebulosa → protosol', 'Granos de polvo → planetas → protosol → colapso de la nebulosa', 'Disco protoplanetario → colapso de la nebulosa → planetas → protosol'],
      pista: 'Empieza con el colapso gravitacional y termina con los planetas.',
      por: 'Según el PDF, todo comenzó con el colapso gravitacional de parte de una nebulosa; se formó un protosol y el resto se aplanó en un disco protoplanetario, donde los granos de polvo se aglutinaron durante millones de años hasta formar planetas.' },
    { nv: 3, parte: 3, q: 'Compara las edades que aparecen en el PDF. ¿Cuál afirmación es correcta?',
      ok: 'El universo (unos 13 800 millones de años) es más antiguo que el sistema solar (4568 millones)', mal: ['El sistema solar es más antiguo que el universo', 'La Luna (unos 4600 millones de años) es más antigua que el universo', 'El universo y el sistema solar tienen la misma edad'],
      pista: 'Compara las cifras: 13 800, 4568 y 4600 millones de años.',
      por: 'El PDF da unos 13 800 millones de años para el universo, 4568 millones para el sistema solar y unos 4600 millones para la Luna: el universo es el más antiguo.' },
    { nv: 3, parte: 4, q: 'Imagina que una nueva misión descubre que la Luna es muy distinta de la Tierra en su composición. ¿Qué teoría perdería uno de sus apoyos más importantes?',
      ok: 'La teoría del gran impacto', mal: ['La teoría del Big Bang', 'La teoría de Laplace', 'Ninguna: la exploración lunar no sirve como evidencia'],
      pista: 'Recuerda qué hallazgo se llama «clave» en la Parte 4.',
      por: 'El PDF dice que la composición geológica similar entre la Luna y la Tierra es un hallazgo clave para sustentar el gran impacto; si cambiara, esa teoría perdería un apoyo importante.' }
  ];

  /* ---------------- Utilidades ---------------- */
  function mezclar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function azar(lista) { return lista[Math.floor(Math.random() * lista.length)]; }
  function dos(n) { return Number(n).toFixed(2); }

  /* ---------------- Sonido (Web Audio API, sin archivos) ---------------- */
  var ctx = null, desbloqueado = false, silencio = false;
  var SONIDOS = {
    acierto:  { tipo: 'triangle', vol: 0.16, notas: [[660, 0, 0.12], [880, 0.1, 0.2]] },
    error:    { tipo: 'sine',     vol: 0.14, notas: [[330, 0, 0.18], [262, 0.16, 0.28]] },
    racha:    { tipo: 'triangle', vol: 0.15, notas: [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.3]] },
    nivel:    { tipo: 'square',   vol: 0.07, notas: [[392, 0, 0.14], [523, 0.13, 0.14], [659, 0.26, 0.3]] },
    victoria: { tipo: 'triangle', vol: 0.17, notas: [[523, 0, 0.14], [659, 0.13, 0.14], [784, 0.26, 0.14], [1047, 0.39, 0.2], [784, 0.58, 0.12], [1047, 0.7, 0.45]] },
    fin:      { tipo: 'sine',     vol: 0.14, notas: [[392, 0, 0.2], [330, 0.2, 0.2], [262, 0.4, 0.4]] }
  };
  function desbloquear() {
    if (desbloqueado) { return; }
    desbloqueado = true;   // el sonido empieza solo después del primer toque o tecla
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) { ctx = new C(); if (ctx.state === 'suspended') { ctx.resume(); } }
    } catch (e) { ctx = null; }
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, desbloquear, true); });
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, desbloquear, true); });
  function sonar(nombre) {
    if (!ctx || silencio || !SONIDOS[nombre]) { return; }
    try {
      if (ctx.state === 'suspended') { ctx.resume(); }
      var s = SONIDOS[nombre];
      s.notas.forEach(function (n) {
        var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + n[1];
        o.type = s.tipo; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(s.vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[2]);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + n[2] + 0.05);
      });
    } catch (e) { /* si el navegador bloquea el audio, el juego sigue sin sonido */ }
  }

  /* ---------------- Pantallas ---------------- */
  var tecla = null;   // manejador de teclado de la pantalla actual (1 a 4 eligen una opción)
  document.addEventListener('keydown', function (ev) {
    if (tecla && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { tecla(ev); }
  });

  function salida(nodos, enfocar) {
    tecla = null;
    cont.textContent = '';
    nodos.forEach(function (n) { cont.appendChild(n); });
    window.scrollTo(0, 0);
    if (enfocar) { enfocar.setAttribute('tabindex', '-1'); enfocar.focus(); }
  }
  function volver() { return el('a', { clase: 'c1-boton c1-secundario', href: P.rutaPanel('estudiante'), texto: 'Volver a mi panel' }); }
  function boton(texto, alClic, secundario) {
    return el('button', { type: 'button', clase: 'c1-boton' + (secundario ? ' c1-secundario' : ''), texto: texto, onclick: alClic });
  }
  function botonSonido() {
    var b = el('button', { type: 'button', clase: 'c1-sonido', 'aria-pressed': silencio ? 'false' : 'true' });
    function pintar() { b.textContent = silencio ? '🔇 Sonido: apagado' : '🔊 Sonido: encendido'; b.setAttribute('aria-pressed', silencio ? 'false' : 'true'); }
    pintar();
    b.addEventListener('click', function () { silencio = !silencio; pintar(); if (!silencio) { sonar('acierto'); } });
    return b;
  }
  function cabecera(titulo) {
    return el('header', { clase: 'panel-cabecera' }, [el('div', null, [
      el('p', { clase: 'panel-centro', texto: 'C.E.B.G. El Jiral · Ejercicio virtual · Ciencias Naturales 9.°' }),
      el('h1', { texto: titulo || 'Origen del universo, del sistema solar y de la Luna' }),
      el('p', { clase: 'panel-datos', texto: 'Clase 1 · Introducción · Semana 1' })])]);
  }
  function barra() { return el('div', { clase: 'c1-barra-superior' }, [botonSonido()]); }
  function error(texto) { salida([cabecera(), el('p', { clase: 'mensaje error', role: 'alert', texto: texto }), el('div', { clase: 'c1-acciones' }, [volver()])]); }

  /* ---------------- Flujo del portal ---------------- */
  var ejercicioId = null;

  async function abrir(esRepeticion) {
    var ini = await E.iniciarEjercicio(ejercicioId);
    if (!ini.ok) { error('No se pudo abrir el ejercicio. ' + ini.error); return; }
    if (!ini.puedeJugar) { error('No puede jugar ahora: ' + ini.motivo + '.'); return; }
    intro(ini, esRepeticion);
  }

  async function iniciar() {
    if (!P.db) { error(P.errorCarga); return; }
    var info;
    try { info = await P.cargarSesion(); } catch (e) { error(P.traducirError(e)); return; }
    if (!info || info.roles.indexOf('estudiante') === -1) { window.location.replace(P.rutaInicio()); return; }
    ejercicioId = new URLSearchParams(window.location.search).get('ejercicio');
    if (!ejercicioId) { error('Falta indicar el ejercicio. Abra el juego desde «Mis ejercicios virtuales».'); return; }
    abrir(false);
  }

  function intro(ini) {
    var titulo = el('h2', { texto: 'Antes de empezar' });
    var reglas = el('ul', null, [
      el('li', { texto: TOTAL + ' preguntas, de más fáciles a más difíciles. No hay límite de tiempo.' }),
      el('li', { texto: 'Tienes ' + VIDAS + ' vidas (♥). Si se acaban, se recargan: aquí nadie queda fuera.' }),
      el('li', { texto: 'Puedes usar hasta 2 pistas por pregunta. Cada pista descuenta puntos.' }),
      el('li', { texto: 'Las preguntas que falles vuelven al final y valen la mitad de los puntos.' }),
      el('li', { texto: 'Tu nota va de 0 a 5: puntos obtenidos ÷ ' + PUNTOS_MAX + ' × 5. La racha es solo para animarte: no cambia la nota.' })
    ]);
    var estadoNota = el('p', { clase: 'mensaje info', texto: ini.cuentaNota
      ? 'Este ejercicio cuenta para la nota: se conserva tu mejor intento.' + (ini.mejorNota !== null ? ' Tu mejor nota guardada hasta ahora: ' + dos(ini.mejorNota) + '.' : '')
      : 'Es una práctica: se guarda el intento, pero no da nota.' + (ini.mejorNota !== null ? ' Tu mejor resultado guardado: ' + dos(ini.mejorNota) + '.' : '') });
    var comenzar = boton('Comenzar', function () { nuevaPartida(ini); });
    salida([cabecera(ini.titulo), barra(), el('section', { clase: 'c1-tarjeta c1-intro' }, [titulo, reglas, estadoNota, el('div', { clase: 'c1-acciones' }, [comenzar, volver()])])], titulo);
  }

  /* ---------------- Partida ---------------- */
  var S = null;

  function preparar(b) {
    var ops = [{ texto: b.ok, ok: true }].concat(b.mal.map(function (t) { return { texto: t, ok: false }; }));
    return { b: b, opciones: mezclar(ops), pistas: 0, sel: null };
  }

  function nuevaPartida(ini) {
    var porNivel = { 1: [], 2: [], 3: [] };
    BANCO.forEach(function (b) { porNivel[b.nv].push(b); });
    var cola = [];
    [1, 2, 3].forEach(function (nv) { mezclar(porNivel[nv]).slice(0, CUPO[nv]).forEach(function (b) { cola.push(preparar(b)); }); });
    S = { ini: ini, cola: cola, pos: 0, ronda: 1, fallidas: [], partesFalladas: {}, puntos: 0, vidas: VIDAS,
          racha: 0, mejorRacha: 0, aciertosPrimera: 0, recuperadas: 0, recargaVidas: false };
    pintarPregunta();
  }

  function pintarPregunta() {
    var q = S.cola[S.pos], total = S.cola.length, repaso = S.ronda === 2;
    var costo = repaso ? COSTO_PISTA_REPASO : COSTO_PISTA;
    var comprobada = false;
    if (S.recargaVidas) { S.vidas = VIDAS; S.recargaVidas = false; }

    var anterior = S.pos > 0 ? S.cola[S.pos - 1].b.nv : 0;
    var nuevoNivel = !repaso && q.b.nv !== anterior;

    var vidasTexto = '';
    for (var v = 0; v < VIDAS; v++) { vidasTexto += v < S.vidas ? '♥' : '♡'; }
    var estado = el('div', { clase: 'c1-estado' }, [
      repaso ? el('span', { clase: 'c1-etiqueta', texto: 'Segunda oportunidad: sin vidas, con calma' })
             : el('span', { clase: 'c1-vidas', 'aria-label': 'Vidas: ' + S.vidas + ' de ' + VIDAS, texto: vidasTexto }),
      el('span', { texto: 'Racha: ' + S.racha }),
      el('span', { texto: 'Puntos: ' + S.puntos })
    ]);
    var progreso = el('progress', { clase: 'c1-progreso', max: String(total), value: S.pos, 'aria-label': 'Progreso del ejercicio' });
    var progresoTexto = el('p', { clase: 'c1-progreso-texto', texto: (repaso ? 'Segunda oportunidad · ' : '') + 'Pregunta ' + (S.pos + 1) + ' de ' + total });

    var enunciado = el('h2', { clase: 'c1-enunciado', id: 'c1-enunciado', texto: q.b.q });
    var nivel = el('p', { clase: 'c1-nivel', texto: repaso ? 'Repaso · ' + NIVELES[q.b.nv] : NIVELES[q.b.nv] });
    var subida = nuevoNivel ? el('p', { clase: 'c1-subida', role: 'status', texto: S.pos === 0 ? '¡Empezamos! ' + NIVELES[q.b.nv] + '.' : '¡Subiste de nivel! Ahora: ' + NIVELES[q.b.nv] + '.' }) : null;

    var botones = q.opciones.map(function (o, i) {
      var b = el('button', { type: 'button', clase: 'c1-opcion', 'aria-pressed': 'false' }, [
        el('span', { clase: 'c1-letra', 'aria-hidden': 'true', texto: String.fromCharCode(65 + i) }),
        el('span', { clase: 'c1-texto', texto: o.texto }),
        el('span', { clase: 'c1-marca' })
      ]);
      b.addEventListener('click', function () { elegir(i); });
      return b;
    });
    var grupo = el('div', { clase: 'c1-opciones', role: 'group', 'aria-labelledby': 'c1-enunciado' }, botones);

    var aviso = el('p', { clase: 'mensaje info', role: 'status', 'aria-live': 'polite', hidden: true });
    var pistaCaja = el('div', { role: 'status', 'aria-live': 'polite' });
    var retro = el('div', { role: 'status', 'aria-live': 'polite' });

    var bP1 = el('button', { type: 'button', clase: 'c1-boton c1-secundario', texto: 'Pista 1: ver una pista (−' + costo + ' pts)' });
    var bP2 = el('button', { type: 'button', clase: 'c1-boton c1-secundario', texto: 'Pista 2: descartar dos opciones (−' + costo + ' pts)' });
    var pistas = el('div', { clase: 'c1-pistas' }, [bP1, bP2]);
    var bComprobar = el('button', { type: 'button', clase: 'c1-boton', texto: 'Comprobar' });
    var acciones = el('div', { clase: 'c1-acciones' }, [bComprobar]);

    function marca(i, texto) { botones[i].lastChild.textContent = texto; }

    function elegir(i) {
      if (comprobada || botones[i].disabled) { return; }
      if (q.sel !== null) { botones[q.sel].classList.remove('c1-elegida'); botones[q.sel].setAttribute('aria-pressed', 'false'); marca(q.sel, ''); }
      q.sel = i;
      botones[i].classList.add('c1-elegida'); botones[i].setAttribute('aria-pressed', 'true'); marca(i, '● Elegida');
      aviso.hidden = true;
      bComprobar.focus();
    }

    function usarPista(n) {
      if (comprobada) { return; }
      if (n === 1) {
        bP1.disabled = true; q.pistas++;
        pistaCaja.appendChild(el('p', { clase: 'c1-pista-texto', texto: 'Pista: ' + q.b.pista }));
      } else {
        bP2.disabled = true; q.pistas++;
        var malas = [];
        q.opciones.forEach(function (o, i) { if (!o.ok && i !== q.sel) { malas.push(i); } });
        mezclar(malas).slice(0, 2).forEach(function (i) {
          botones[i].disabled = true; botones[i].classList.add('c1-descartada'); marca(i, 'Descartada');
        });
      }
    }
    bP1.addEventListener('click', function () { usarPista(1); });
    bP2.addEventListener('click', function () { usarPista(2); });

    bComprobar.addEventListener('click', function () {
      if (comprobada) { return; }
      if (q.sel === null) { aviso.textContent = 'Elige una respuesta antes de comprobar.'; aviso.hidden = false; return; }
      comprobada = true; tecla = null;
      var acierto = q.opciones[q.sel].ok;
      var base = repaso ? PUNTOS_REPASO : PUNTOS_BASE;
      var ganado = acierto ? Math.max(0, base - costo * q.pistas) : 0;
      S.puntos += ganado;

      botones.forEach(function (b, i) {
        b.disabled = true;
        b.classList.remove('c1-elegida');
        if (q.opciones[i].ok) { b.classList.add('c1-correcta'); marca(i, '✔ Correcta'); }
        else if (i === q.sel) { b.classList.add('c1-incorrecta'); marca(i, '✘ Tu respuesta'); }
      });
      bP1.disabled = true; bP2.disabled = true; bComprobar.hidden = true;

      var caja;
      if (acierto) {
        S.racha++; if (S.racha > S.mejorRacha) { S.mejorRacha = S.racha; }
        if (repaso) { S.recuperadas++; } else { S.aciertosPrimera++; }
        sonar(S.racha % 3 === 0 ? 'racha' : 'acierto');
        caja = el('div', { clase: 'c1-retro c1-bien' }, [
          el('strong', { texto: '✔ ' + azar(ACIERTOS) + ' +' + ganado + (ganado === 1 ? ' punto' : ' puntos') }),
          S.racha >= 3 ? el('p', { texto: '¡Racha de ' + S.racha + ' respuestas seguidas!' }) : null]);
      } else {
        S.racha = 0; sonar('error');
        var hijos = [
          el('strong', { texto: '✘ Todavía no' }),
          el('p', { texto: 'La respuesta correcta es: «' + q.b.ok + '».' }),
          el('p', { texto: 'Por qué: ' + q.b.por })];
        if (!repaso) {
          S.fallidas.push(q.b); S.partesFalladas[q.b.parte] = true; S.vidas--;
          hijos.push(el('p', { texto: 'Esta pregunta volverá al final para que tengas otra oportunidad (con la mitad de los puntos).' }));
          if (S.vidas <= 0) { S.recargaVidas = true; hijos.push(el('p', { texto: 'Se acabaron las vidas, pero no pasa nada: se recargan y sigues jugando.' })); }
        }
        hijos.push(el('p', { texto: azar(ANIMOS) }));
        caja = el('div', { clase: 'c1-retro c1-mal' }, hijos);
      }
      retro.appendChild(caja);
      var ultima = S.pos === total - 1;
      var sig = boton(ultima ? (!repaso && S.fallidas.length ? 'Continuar' : 'Ver resultados') : 'Siguiente', function () { S.pos++; if (S.pos < total) { pintarPregunta(); } else { finRonda(); } });
      acciones.appendChild(sig);
      sig.focus();
    });

    var tarjeta = el('section', { clase: 'c1-tarjeta' }, [nivel, subida, enunciado, grupo, aviso, pistas, pistaCaja, acciones, retro]);
    salida([cabecera(S.ini.titulo), barra(), estado, progreso, progresoTexto, tarjeta], enunciado);
    tecla = function (ev) {   // se asigna después de salida(), que limpia el manejador anterior
      if (comprobada) { return; }
      var n = Number(ev.key);
      if (n >= 1 && n <= botones.length) { ev.preventDefault(); elegir(n - 1); }
    };
    if (nuevoNivel) { sonar('nivel'); }
  }

  function finRonda() {
    if (S.ronda === 1 && S.fallidas.length > 0) { segundaOportunidad(); } else { terminar(); }
  }

  function segundaOportunidad() {
    S.ronda = 2; S.cola = S.fallidas.map(preparar); S.pos = 0;
    var titulo = el('h2', { texto: '¡Segunda oportunidad!' });
    var n = S.cola.length;
    var seguir = boton('Continuar', function () { pintarPregunta(); });
    sonar('nivel');
    salida([cabecera(S.ini.titulo), barra(), el('section', { clase: 'c1-tarjeta c1-intro' }, [
      titulo,
      el('p', { texto: 'Terminaste las ' + TOTAL + ' preguntas. Vuelven ' + n + (n === 1 ? ' pregunta' : ' preguntas') + ' para que lo intentes otra vez: valen la mitad de los puntos y las pistas descuentan menos.' }),
      el('p', { texto: 'Llevas ' + S.puntos + ' puntos. Con calma, ¡tú puedes!' }),
      el('div', { clase: 'c1-acciones' }, [seguir])])], titulo);
  }

  /* ---------------- Resultado, nota y guardado ---------------- */
  function terminar() {
    var nota = Number(((S.puntos / PUNTOS_MAX) * 5).toFixed(2));
    var ini = S.ini;
    sonar(nota >= 3 ? 'victoria' : 'fin');

    var titulo = el('h2', { texto: '¡Terminaste!' });
    var mensaje = nota >= 4.5 ? '¡Excelente trabajo!' : nota >= 3.5 ? '¡Muy buen trabajo!' : nota >= 3 ? '¡Buen trabajo! Repasa los temas de abajo para seguir mejorando.' : 'Aún puedes mejorar: repasa los temas de abajo y vuelve a intentarlo. ¡Lo lograrás!';
    var aviso = el('p', { clase: 'mensaje info', role: 'status', 'aria-live': 'polite' });

    var resumen = el('div', { clase: 'c1-resumen' }, [
      el('span', { clase: 'c1-dato', texto: 'Puntos: ' + S.puntos + ' de ' + PUNTOS_MAX }),
      el('span', { clase: 'c1-dato', texto: 'Acertadas a la primera: ' + S.aciertosPrimera + ' de ' + TOTAL }),
      el('span', { clase: 'c1-dato', texto: 'Recuperadas en la segunda oportunidad: ' + S.recuperadas }),
      el('span', { clase: 'c1-dato', texto: 'Mejor racha: ' + S.mejorRacha })
    ]);

    var ideas = el('ol', null, IDEAS_CLAVE.map(function (t) { return el('li', { texto: t }); }));

    var partes = Object.keys(S.partesFalladas).sort();
    var repasar = partes.length
      ? el('ul', null, partes.map(function (p) { return el('li', { texto: PARTES[p] + ' (página ' + p + ' del PDF)' }); }))
      : el('p', { texto: '¡No tienes temas pendientes! Acertaste todas las preguntas a la primera.' });

    var reflexion = el('section', { clase: 'c1-reflexion' }, [
      el('h3', { texto: 'Para reflexionar (sin nota)' }),
      el('p', { texto: 'Piensa estas preguntas o coméntalas con tu profesor y tus compañeros. No se califican.' }),
      el('ol', null, REFLEXION.map(function (r) {
        return el('li', null, [el('span', { clase: 'c1-parte', texto: PARTES[r.parte] }), r.texto]);
      }))
    ]);

    var otra = boton('Jugar otra vez', function () { otra.disabled = true; abrir(true); }, true);
    otra.disabled = true;     // se habilita solo cuando el intento quedó guardado
    var acciones = el('div', { clase: 'c1-acciones' }, [otra, volver()]);

    salida([cabecera(ini.titulo), barra(), el('section', { clase: 'c1-tarjeta c1-resultado' }, [
      titulo,
      el('p', { clase: 'c1-nota-grande', texto: 'Nota: ' + dos(nota) + ' / 5' }),
      el('p', { texto: mensaje }),
      resumen, aviso,
      el('h3', { texto: 'Las 3 ideas clave' }), ideas,
      el('h3', { texto: 'Temas para repasar' }), repasar,
      reflexion, acciones])], titulo);

    guardar(ini, nota, aviso, otra);
  }

  // Reintentar con la MISMA clave es seguro: si el primer envío sí llegó, la base no crea otro intento.
  async function guardar(ini, nota, aviso, otra) {
    aviso.className = 'mensaje info'; aviso.textContent = 'Guardando tu resultado…';
    var r = await E.guardarIntento(ini.ejercicioId, ini.claveEnvio, nota);
    if (r.ok) {
      aviso.className = 'mensaje ok';
      var mejor = r.mejorNota === null ? 'aún sin registro' : dos(r.mejorNota);
      aviso.textContent = 'Guardado. Nota de este intento: ' + dos(nota) + ' de 5. Tu mejor nota guardada: ' + mejor + '.'
        + (r.cuentaNota ? '' : ' Esto es una práctica: no da nota.');
      otra.disabled = false;
      return;
    }
    aviso.className = 'mensaje error';
    aviso.textContent = 'NO se guardó tu resultado. ' + r.error + ' ';
    var de = el('button', { type: 'button', clase: 'c1-boton c1-secundario', texto: 'Reintentar guardar' });
    de.addEventListener('click', function () { de.remove(); guardar(ini, nota, aviso, otra); });
    aviso.appendChild(de);
  }

  iniciar();
})();
