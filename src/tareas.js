// Métricas por tarea de cada cámara (T4.1, D4, D10): píxeles que tiene cada objetivo de una tarea (fruta, ArUco, pupilas, mano,
// bandeja en movimiento), si cumple (cumple, límite, no cumple) y la profundidad de campo, con el origen de cada valor y la
// fuente de cada umbral. Sin DOM ni three: se prueba con node:test (tests/unit/tareas.test.mjs) y se concatena en app.js con
// el marcador @@TAREAS@@. Lee SENSOR (src/sensor.js) para los mm/px: no tiene otra óptica.
// Fuentes. El estudio «camaras-colocacion» no está en el repo: solo se citan los umbrales que da la ficha de T4.1 del plan
// (ArUco ≥ 14 px, mínimo de OpenCV 4.6; zona fiable de 32 a 50 px; velocidad de la bandeja de 0,1 m/s, supuesta). Todo lo
// demás (entradas de las redes, mínimos de fruta, pupilas y mano, tamaños, F, exposición, límites del desenfoque) es SUPUESTO
// SIN VALIDAR y editable: no hay fuente comprobable y no se cita ninguna.
// Geometría (la calcula el que llama, con three): cada punto lleva la profundidad a lo largo del eje óptico y un escorzo c (1 =
// de frente). px = tamaño / mmPorPx(profundidad, w, f, N, c): proyección estenopeica, la misma fórmula que el panel (T1.7).
const TAREAS = (() => {
  const S_ = typeof SENSOR !== 'undefined' ? SENSOR : require('./sensor.js');
  const PLAN = 'ficha de T4.1 del plan (estudio «camaras-colocacion», que no está en el repo: cita sin comprobar aquí)';
  const SIN = 'sin fuente comprobable; SUPUESTO [SIN VALIDAR]';
  // Parámetros: el valor de partida, su origen ('PLAN' = lo da el plan; 'SUPUESTO' = sin fuente) y si el panel lo deja editar.
  const P = (id, nombre, unidad, valor, origen, fuente, editable = true) => ({ id, nombre, unidad, valor, origen, fuente, editable });
  const PARAMS = [
    P('aruco.min', 'ArUco: mínimo', 'px', 14, 'PLAN', `mínimo de OpenCV 4.6; ${PLAN}`, false),
    P('aruco.bien', 'ArUco: zona fiable desde', 'px', 32, 'PLAN', `zona fiable de 32 a 50 px; ${PLAN}`, false),
    P('aruco.techo', 'ArUco: zona fiable hasta', 'px', 50, 'PLAN', `zona fiable de 32 a 50 px; ${PLAN}`, false),
    P('fruta.ladoMm', 'Fruta: lado de la pieza', 'mm', 45, 'SUPUESTO', 'la pieza más pequeña de las de 4,5–7 cm del grupo, sin medir (ORIGEN «fruta») · SIN VALIDAR'),
    P('fruta.red', 'Fruta: entrada de la red', 'px', 640, 'SUPUESTO', `red de detección aún sin elegir; ${SIN}`),
    P('fruta.min', 'Fruta: mínimo en la entrada de la red', 'px', 16, 'SUPUESTO', SIN),
    P('fruta.bien', 'Fruta: fiable desde, en la entrada de la red', 'px', 32, 'SUPUESTO', SIN),
    P('pupilas.ipdMm', 'Pupilas: distancia entre ellas', 'mm', 63, 'SUPUESTO', SIN),
    P('pupilas.min', 'Pupilas: mínimo entre ellas', 'px', 20, 'SUPUESTO', SIN),
    P('pupilas.bien', 'Pupilas: fiable desde', 'px', 40, 'SUPUESTO', SIN),
    P('mano.anchoMm', 'Mano: ancho de la palma', 'mm', 85, 'SUPUESTO', SIN),
    P('mano.red', 'Mano: entrada de la red de palma', 'px', 192, 'SUPUESTO', `red de palma aún sin elegir; ${SIN}`),
    P('mano.min', 'Mano: mínimo en la entrada de la red', 'px', 20, 'SUPUESTO', SIN),
    P('mano.bien', 'Mano: fiable desde, en la entrada de la red', 'px', 40, 'SUPUESTO', SIN),
    P('desenfoque.velMs', 'Bandeja: velocidad', 'm/s', 0.1, 'SUPUESTO', 'supuesta por la ficha de T4.1 del plan: 0,1 m/s · SIN VALIDAR'),
    P('desenfoque.expMs', 'Exposición', 'ms', 5, 'SUPUESTO', 'la de usb_cam de los ficheros exportados (ORIGEN «exposicion»), sin medir · SIN VALIDAR'),
    P('desenfoque.ok', 'Desenfoque: cumple hasta', 'px', 1, 'SUPUESTO', SIN),
    P('desenfoque.limite', 'Desenfoque: límite hasta', 'px', 2, 'SUPUESTO', SIN),
    P('campo.F', 'Objetivo: número F', 'F', 2.8, 'SUPUESTO', `la ficha de la lente no se ha consultado; ${SIN}`),
    P('campo.cocPx', 'Círculo de confusión', 'px', 1, 'SUPUESTO', `un píxel del sensor; ${SIN}`),
  ];
  const POR_ID = new Map(PARAMS.map(p => [p.id, p]));
  const copia = cfg => Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, { ...v }]));
  function cfgDefecto() {
    const cfg = {};
    for (const p of PARAMS) { const [g, k] = p.id.split('.'); (cfg[g] = cfg[g] || {})[k] = p.valor; }
    return cfg;
  }
  // Cambia un valor editable (devuelve una configuración nueva); un id desconocido, uno fijo del plan o un valor que no sea
  // un número positivo falla con un error claro
  function fijar(cfg, id, valor) {
    const p = POR_ID.get(id); if (!p) throw new Error(`parámetro desconocido (${JSON.stringify(id)})`);
    if (!p.editable) throw new Error(`«${p.nombre}» lo fija el plan y no se edita`);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || !(valor > 0)) throw new Error(`«${p.nombre}»: ${JSON.stringify(valor)} no es un número positivo`);
    const n = copia(cfg), [g, k] = id.split('.'); n[g][k] = valor; return n;
  }

  // Estados y su clase de la etiqueta del panel
  const ESTADOS = { ok: { txt: 'cumple', cls: 'ok' }, limite: { txt: 'límite', cls: 'warn' }, no: { txt: 'no cumple', cls: 'bad' }, fuera: { txt: 'fuera de campo', cls: 'bad' } };
  const ORDEN = { ok: 0, limite: 1, no: 2, fuera: 3 };
  // Más es mejor (ArUco, fruta, pupilas, mano): cumple desde «bien», límite desde «min». Menos es mejor (desenfoque)
  // Con una tolerancia relativa de 1e-9: un marcador que mide 32 px «de verdad» puede salir 31,99999999999 por el redondeo
  const EPS = 1e-9;
  const clasificar = (px, u) => px >= u.bien * (1 - EPS) ? 'ok' : px >= u.min * (1 - EPS) ? 'limite' : 'no';
  const clasificarInv = (px, u) => px <= u.ok * (1 + EPS) ? 'ok' : px <= u.limite * (1 + EPS) ? 'limite' : 'no';

  // Geometría. Vectores como [x, y, z]; el rayo y el eje, unitarios.
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Profundidad de un punto a lo largo del eje óptico (m): en el eje coincide con la distancia
  const profundidad = (p, o, eje) => dot([p[0] - o[0], p[1] - o[1], p[2] - o[2]], eje);
  // Escorzo de un plano visto por un rayo: |cos| entre el rayo y la normal, con el mínimo de 0,2 de la v8 (metricasCam)
  const escorzoPlano = (rayo, normal, min = 0.2) => Math.max(min, Math.abs(dot(rayo, normal)));
  // Escorzo de un segmento de eje e: su largo aparente es √(1 − (rayo·e)²) de su largo real
  const escorzoSegmento = (rayo, eje, min = 0.2) => Math.max(min, Math.sqrt(Math.max(0, 1 - dot(rayo, eje) ** 2)));
  // Píxeles de un objeto en la entrada de una red que reescala la imagen con bandas (letterbox): px × entrada / máx(ancho, alto)
  const enRed = (px, N, Nh, entrada) => px * entrada / Math.max(N, Nh);
  // Desenfoque de movimiento (px): v (m/s) × t (ms) son mm recorridos durante la exposición
  const desenfoquePx = (velMs, expMs, mmpx) => velMs * expMs / mmpx;
  // Profundidad de campo (f y c en mm, F sin unidad, enfoque s en m): hiperfocal h = f²/(F·c) (+ f), límites cercano y lejano
  // en m (Infinity si el enfoque llega a la hiperfocal)
  function profundidadCampo(f, F, c, s) {
    const h = f * f / (F * c), sm = s * 1000;
    const cerca = sm * h / (h + sm - f), lejos = sm - f < h ? sm * h / (h - sm + f) : Infinity;
    return { hiperfocal: (h + f) / 1000, cerca: cerca / 1000, lejos: lejos / 1000 };
  }

  // Qué tarea es cada id: nombre, clave del tamaño en ORIGEN (null = SUPUESTO sin entrada propia) y el umbral con su texto
  const f1 = (x, d = 0) => x.toFixed(d).replace('.', ',');
  const DEF = {
    aruco: { nombre: 'ArUco', clave: 'marcadores', umbral: c => ({ texto: `≥ ${c.aruco.min} px mínimo de OpenCV 4.6; zona fiable de ${c.aruco.bien} a ${c.aruco.techo} px (más grande también cumple)`, origen: 'PLAN', fuente: PLAN }) },
    fruta: { nombre: 'Fruta', clave: 'fruta', umbral: c => ({ texto: `en la entrada de la red de ${c.fruta.red} px: cumple desde ${c.fruta.bien} px, límite desde ${c.fruta.min} px`, origen: 'SUPUESTO', fuente: SIN }) },
    pupilas: { nombre: 'Cara: distancia entre pupilas', clave: null, umbral: c => ({ texto: `cumple desde ${c.pupilas.bien} px, límite desde ${c.pupilas.min} px`, origen: 'SUPUESTO', fuente: SIN }) },
    mano: { nombre: 'Mano', clave: null, umbral: c => ({ texto: `en la entrada de la red de palma de ${c.mano.red} px: cumple desde ${c.mano.bien} px, límite desde ${c.mano.min} px`, origen: 'SUPUESTO', fuente: SIN }) },
    desenfoque: { nombre: 'Bandeja en movimiento: desenfoque', clave: 'exposicion', umbral: c => ({ texto: `a ${f1(c.desenfoque.velMs * 1000)} mm/s con ${f1(c.desenfoque.expMs, 1)} ms: cumple hasta ${c.desenfoque.ok} px, límite hasta ${c.desenfoque.limite} px`, origen: 'SUPUESTO', fuente: SIN }) },
    campo: { nombre: 'Profundidad de campo', clave: null, umbral: c => ({ texto: `F ${f1(c.campo.F, 1)} y círculo de confusión de ${c.campo.cocPx} px, enfocada en el punto de mira`, origen: 'SUPUESTO', fuente: SIN }) },
  };
  const IDS = Object.keys(DEF);

  // Un punto de una tarea: geo = { nombre, prof (m), c (escorzo), dentro, ladoMm (solo ArUco), oculto (texto: no se ve) }
  // cam = { w (mm, área activa), f (mm), N, Nh (píxeles del modo) }
  function evaluar(id, geo, cam, cfg) {
    const d = DEF[id]; if (!d || id === 'campo') throw new Error(`tarea desconocida (${JSON.stringify(id)})`);
    const mmpx = S_.mmPorPx(geo.prof, cam.w, cam.f, cam.N, geo.c ?? 1);
    const r = { id, punto: geo.nombre, mmpx, umbral: d.umbral(cfg), px: null, pxImagen: null, estado: 'fuera', nota: null };
    let tam;
    if (id === 'aruco') tam = geo.ladoMm; else if (id === 'fruta') tam = cfg.fruta.ladoMm; else if (id === 'pupilas') tam = cfg.pupilas.ipdMm; else if (id === 'mano') tam = cfg.mano.anchoMm;
    if (id === 'desenfoque') { r.px = r.pxImagen = desenfoquePx(cfg.desenfoque.velMs, cfg.desenfoque.expMs, mmpx); r.estado = clasificarInv(r.px, cfg.desenfoque); }
    else {
      r.pxImagen = tam / mmpx; r.px = id === 'fruta' || id === 'mano' ? enRed(r.pxImagen, cam.N, cam.Nh, cfg[id].red) : r.pxImagen;
      r.estado = clasificar(r.px, cfg[id]);
    }
    if (geo.oculto) { r.estado = 'no'; r.px = null; r.nota = geo.oculto; }
    if (geo.dentro === false) r.estado = 'fuera';
    return r;
  }
  // El peor punto visible de una tarea (el de menos px; en el desenfoque, el de más) con cuántos puntos quedan fuera del campo.
  // Todos fuera: «fuera de campo»
  function evaluarVarios(id, geos, cam, cfg) {
    const todos = geos.map(g => evaluar(id, g, cam, cfg)), vis = todos.filter(r => r.estado !== 'fuera');
    const nFuera = todos.length - vis.length;
    if (!vis.length) return { ...todos[0], estado: 'fuera', nFuera, nPuntos: todos.length };
    // a es peor que b si su estado lo es o, con el mismo, si tiene menos px (en el desenfoque, más)
    const peorQue = (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || (id === 'desenfoque' ? a.px - b.px : (b.px ?? 0) - (a.px ?? 0));
    const peor = vis.reduce((a, b) => peorQue(b, a) > 0 ? b : a);
    return { ...peor, nFuera, nPuntos: todos.length };
  }
  // Profundidad de campo de una cámara: el enfoque (m, el del punto de mira) y la profundidad de los objetivos visibles
  // [{ nombre, prof }]. Cumple si caben todos, límite si cabe la mitad o más
  function evaluarCampo(enfoque, objetivos, cam, cfg) {
    const c = cfg.campo.cocPx * cam.w / cam.N; // lado de un píxel (mm) × píxeles de confusión
    const pc = profundidadCampo(cam.f, cfg.campo.F, c, enfoque), dentro = objetivos.filter(o => o.prof >= pc.cerca && o.prof <= pc.lejos);
    const estado = !objetivos.length ? 'fuera' : dentro.length === objetivos.length ? 'ok' : dentro.length * 2 >= objetivos.length ? 'limite' : 'no';
    return { id: 'campo', ...pc, enfoque, dentro: dentro.length, total: objetivos.length, fuera: objetivos.filter(o => !dentro.includes(o)).map(o => o.nombre), umbral: DEF.campo.umbral(cfg), estado, px: null };
  }
  return { PARAMS, IDS, DEF, ESTADOS, cfgDefecto, fijar, clasificar, clasificarInv, dot, profundidad, escorzoPlano, escorzoSegmento, enRed, desenfoquePx, profundidadCampo, evaluar, evaluarVarios, evaluarCampo };
})();
if (typeof module !== 'undefined') module.exports = TAREAS;
