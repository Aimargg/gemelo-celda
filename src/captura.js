// Captura sintética de una cámara con anotaciones 2D (T4.6, D4, D10): la vista de 640 × 480 px de una cámara, las cajas y esquinas de
// lo que se ve (ArUco, platos, fruta) por la proyección estenopeica y el texto JSON que las lleva con el origen de cada valor. Sirve para
// probar pipelines de visión, no para sustituir datos reales. Sin personas: no hay clase «persona» (la figura de la persona del gemelo no
// se dibuja en la captura ni se anota). Sin DOM ni three: la geometría la calcula el que llama (app.js) y aquí solo se proyecta, se
// recorta y se escribe; se prueba con node:test (tests/unit/captura-t46.test.mjs) y se concatena en app.js con el marcador @@CAPTURA@@.
// No tiene óptica propia: la distancia focal en píxeles sale de SENSOR.mmPorPx (T1.7) y la profundidad a lo largo del eje óptico, de
// TAREAS.profundidad (T4.1): la misma proyección estenopeica que los píxeles por tarea del panel.
// Convención de píxel (la de OpenCV y la de los camera_info que exporta el gemelo, cx = (ancho − 1) / 2): el centro del píxel de la
// esquina superior izquierda es (0, 0); u crece a la derecha y v hacia abajo; la imagen cubre u de −0,5 a 639,5 y v de −0,5 a 479,5.
// Marco de la cámara (el de OpenCV): x a la derecha, y hacia abajo y z al frente, los tres en el mundo: cam = { o, x, y, z, near, far }.
// Campo: el de la cámara (focal y ancho del sensor, el mismo en todos los modos) con la relación 4:3 de 640 × 480; con un modo 16:9 la
// captura enseña más alto que la cámara en ese modo (el ancho completo del sensor, como en un modo 4:3 de la ELP).
// Oclusión: solo la del campo y los bordes. Lo que otro objeto o el brazo tapa dentro del campo sigue anotado como visible (la oclusión
// por el brazo es T4.2 y no está hecha). Sin distorsión (la de T4.5 no se aplica a la captura).
const CAPTURA = (() => {
  const S_ = typeof SENSOR !== 'undefined' ? SENSOR : require('./sensor.js');
  const T_ = typeof TAREAS !== 'undefined' ? TAREAS : require('./tareas.js');
  const O_ = typeof ORIGEN !== 'undefined' ? ORIGEN : require('./origen.js');
  const ANCHO = 640, ALTO = 480;
  const AVISO = 'sirve para probar pipelines, no para sustituir datos reales';
  const ESQUEMA = 'gemelo-celda/captura-sintetica/1';
  const CLASES = ['aruco', 'plato', 'fruta'];
  // Las esquinas de un ArUco, en el orden de OpenCV (las devuelve detectMarkers): arriba-izquierda, arriba-derecha, abajo-derecha y
  // abajo-izquierda del marcador tal como está impreso
  const ORDEN_ESQUINAS = ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda'];
  // El plano de un marcador del gemelo mide `lado` y arucoTex dibuja el cuadrado negro (las 6 × 6 celdas del patrón) en 80 de sus 96 px:
  // las esquinas que da un detector son las del cuadrado negro, no las del plano
  const ARUCO_NEGRO = 80 / 96;
  const OCLUSION = 'solo la del campo y los bordes: un objeto tapado por otro o por el brazo dentro del campo se anota como visible; la oclusión por el brazo (T4.2) no está hecha';
  const PERSONAS = 'sin personas: la figura de la persona del gemelo no se dibuja en la captura ni se anota; no hay ninguna clase de persona';
  const DISTORSION = 'ninguna: proyección estenopeica de lente ideal; la distorsión de T4.5 no se aplica a la captura';
  const CONVENCION = 'OpenCV: el centro del píxel superior izquierdo es (0, 0), u a la derecha y v hacia abajo; la imagen cubre u de −0,5 a 639,5 y v de −0,5 a 479,5; la caja de un objeto cortado por el borde se recorta a la imagen';
  const CAJA = 'proyección de los puntos del objeto (ArUco: las cuatro esquinas del cuadrado negro; plato: su perfil; fruta: su caja 3D alineada con los ejes del mundo): no es el contorno exacto';

  // Vista de 640 × 480 con la focal y el ancho del área activa (mm) de la cámara: fx = fy en píxeles de la proyección estenopeica
  function vista(w, f) {
    if (![w, f].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) throw new Error('el ancho del sensor y la focal tienen que ser números positivos');
    const fx = 1000 / S_.mmPorPx(1, w, f, ANCHO), tanX = ANCHO / 2 / fx, tanY = ALTO / 2 / fx;
    return { ancho: ANCHO, alto: ALTO, fx, fy: fx, cx: (ANCHO - 1) / 2, cy: (ALTO - 1) / 2, tanX, tanY, hfov: 2 * Math.atan(tanX), vfov: 2 * Math.atan(tanY) };
  }
  // Punto del mundo → píxel (u, v) y profundidad a lo largo del eje óptico (m)
  function proyectar(v, cam, p) {
    const d = [p[0] - cam.o[0], p[1] - cam.o[1], p[2] - cam.o[2]], prof = T_.profundidad(p, cam.o, cam.z);
    return { u: v.cx + v.fx * T_.dot(d, cam.x) / prof, v: v.cy + v.fy * T_.dot(d, cam.y) / prof, prof };
  }
  // Las cuatro esquinas del cuadrado negro de un marcador de lado `lado` (m), en su marco local (x a la derecha, y hacia arriba, z = 0 y
  // la normal hacia quien lo mira) y en el orden de ORDEN_ESQUINAS
  function esquinasAruco(lado) {
    const h = lado * ARUCO_NEGRO / 2; return [[-h, h, 0], [h, h, 0], [h, -h, 0], [-h, -h, 0]];
  }
  const media = P => [0, 1, 2].map(i => P.reduce((s, p) => s + p[i], 0) / P.length);

  // Anota los objetos que se ven. Cada objeto: { clase, id (o null), nombre, puntos [[x, y, z]…] en el mundo y, si es un ArUco,
  // esquinas (4, en el orden de ORDEN_ESQUINAS) y normal (hacia fuera de su cara impresa) }. Devuelve { anotados, omitidos }, en el orden
  // de entrada. Un objeto que cae del todo fuera de la imagen, que está de espaldas a la cámara (un ArUco) o que tiene algún punto fuera
  // de los planos near y far no se anota: va a omitidos con su motivo. Uno cortado por el borde sale con parcial = true y la caja recortada.
  function anotar(v, cam, objetos) {
    const x0 = -0.5, x1 = v.ancho - 0.5, y0 = -0.5, y1 = v.alto - 0.5, anotados = [], omitidos = [];
    for (const o of objetos) {
      const omitir = motivo => omitidos.push({ clase: o.clase, id: o.id ?? null, nombre: o.nombre, motivo });
      const aruco = o.clase === 'aruco', pts = aruco ? o.esquinas : o.puntos;
      if (!CLASES.includes(o.clase)) throw new Error(`clase desconocida (${JSON.stringify(o.clase)})`);
      if (!Array.isArray(pts) || !pts.length || (aruco && pts.length !== 4)) throw new Error(`${o.nombre}: faltan los puntos del objeto`);
      if (aruco) { const c = media(pts); if (T_.dot(o.normal, [cam.o[0] - c[0], cam.o[1] - c[1], cam.o[2] - c[2]]) <= 0) { omitir('de espaldas a la cámara'); continue; } }
      const P = pts.map(p => proyectar(v, cam, p));
      if (P.some(q => !(q.prof >= cam.near && q.prof <= cam.far))) { omitir('fuera de los planos de la cámara (detrás o a más de su alcance)'); continue; }
      const us = P.map(q => q.u), vs = P.map(q => q.v), minu = Math.min(...us), maxu = Math.max(...us), minv = Math.min(...vs), maxv = Math.max(...vs);
      if (maxu <= x0 || minu >= x1 || maxv <= y0 || minv >= y1) { omitir('fuera del campo'); continue; }
      const parcial = minu < x0 || maxu > x1 || minv < y0 || maxv > y1, a = Math.max(minu, x0), b = Math.max(minv, y0), c = Math.min(maxu, x1), d = Math.min(maxv, y1);
      anotados.push({ clase: o.clase, id: o.id ?? null, nombre: o.nombre, visible: true, parcial, caja: { x: a, y: b, ancho: c - a, alto: d - b }, esquinas: aruco ? P.map(q => [q.u, q.v]) : null });
    }
    return { anotados, omitidos };
  }

  // El documento JSON (objeto con las claves en su orden fijo). camara = { clave, nombre, grupo, focal, modo (el de la cámara) },
  // sensor = { id, w (mm) }, ctx = el contexto de ORIGEN (src/origen.js), r = { anotados, omitidos } de anotar.
  const r2 = x => (Math.round(x * 100) / 100) || 0, r4 = x => (Math.round(x * 1e4) / 1e4) || 0;
  const orig = (clave, ctx) => { const e = O_.entrada(clave, ctx); return { tipo: e.tipo, valor: e.valor, fuente: e.fuente }; };
  function documento(camara, sensor, v, ctx, r) {
    const origen = { camara: orig('camaras', ctx), campo_vision: orig('campo_vision', ctx), aruco: orig('marcadores', ctx), plato: orig('plato_bandeja_persona', ctx), fruta: orig('fruta', ctx) };
    const deClase = { aruco: 'aruco', plato: 'plato', fruta: 'fruta' };
    return {
      esquema: ESQUEMA,
      aviso: AVISO,
      camara: { clave: camara.clave, nombre: camara.nombre, grupo: camara.grupo, modo_de_la_camara: camara.modo, focal_mm: camara.focal, sensor: sensor.id, ancho_sensor_mm: sensor.w },
      imagen: { modo: `${v.ancho}x${v.alto}`, ancho: v.ancho, alto: v.alto, convencion_pixel: CONVENCION },
      proyeccion: { modelo: 'estenopeica', distorsion: DISTORSION, fx: r4(v.fx), fy: r4(v.fy), cx: v.cx, cy: v.cy, campo_horizontal_grados: r2(v.hfov * 180 / Math.PI), campo_vertical_grados: r2(v.vfov * 180 / Math.PI) },
      oclusion: OCLUSION,
      personas: PERSONAS,
      caja_2d: CAJA,
      orden_esquinas_aruco: ORDEN_ESQUINAS.slice(),
      origen,
      objetos: r.anotados.map(a => ({ clase: a.clase, id: a.id, nombre: a.nombre, origen: origen[deClase[a.clase]].tipo, visible: a.visible, parcial: a.parcial, caja: { x: r2(a.caja.x), y: r2(a.caja.y), ancho: r2(a.caja.ancho), alto: r2(a.caja.alto) }, esquinas: a.esquinas ? a.esquinas.map(q => [r2(q[0]), r2(q[1])]) : null })),
      omitidos: r.omitidos.map(o => ({ clase: o.clase, id: o.id, nombre: o.nombre, motivo: o.motivo })),
    };
  }
  // Texto del JSON: sangrado de 2 espacios, cada esquina «[u, v]» y cada caja en una sola línea y un salto de línea al final; sin fechas ni
  // nada que cambie de una vez a otra
  const NUM = '-?\\d+(?:\\.\\d+)?';
  const texto = doc => JSON.stringify(doc, null, 2)
    .replace(new RegExp(`\\[\\s+(${NUM}),\\s+(${NUM})\\s+\\]`, 'g'), '[$1, $2]')
    .replace(new RegExp(`\\{\\s+"x": (${NUM}),\\s+"y": (${NUM}),\\s+"ancho": (${NUM}),\\s+"alto": (${NUM})\\s+\\}`, 'g'), '{ "x": $1, "y": $2, "ancho": $3, "alto": $4 }') + '\n';

  return { ANCHO, ALTO, AVISO, ESQUEMA, CLASES, ORDEN_ESQUINAS, ARUCO_NEGRO, OCLUSION, PERSONAS, vista, proyectar, esquinasAruco, anotar, documento, texto };
})();
if (typeof module !== 'undefined') module.exports = CAPTURA;
