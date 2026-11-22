// Diseñador del tablero de marcadores ArUco de la bandeja (T4.4, D4): ids, lado y posición de cada marcador en el marco de la
// bandeja; las cuatro esquinas de cada uno en el orden de OpenCV; y el aviso «los centros quedan sobre una recta» (la pose con
// varios marcadores es degenerada). Sin DOM, sin three y sin red: lo que se le pasa son números. El YAML con las esquinas lo
// escribe EXPORTAR.tablero (src/exportar.js), el único formateador. Se prueba con node:test (tests/unit/tablero-t44.test.mjs) y se
// concatena en app.js con el marcador @@TABLERO@@.
// Marcador: { id, lado, x, y, yaw } en metros y radianes, en el marco de la bandeja (x e y sobre su cara de arriba, yaw hacia
// +y); el tablero es plano, en z = 0. El patrón de un marcador tiene el convenio de ArUco de OpenCV: x a la derecha, y hacia
// arriba y z saliendo de la cara impresa; con yaw = 0 sus ejes son los de la bandeja.
// Fuentes. El estudio «percepcion-bandeja-personas» no está en el repo: solo se cita lo que da la ficha de T4.4 del plan (el
// aviso de marcadores alineados sobre un solo borde, «pose con varios marcadores») y la aritmética (el diccionario DICT_4X4_50
// tiene 50 ids, de 0 a 49; las esquinas son el centro más el medio lado girado). La tolerancia de «alineados» no tiene fuente
// comprobable: es un SUPUESTO SIN VALIDAR y editable.
const TABLERO = (() => {
  const PLAN = 'percepcion-bandeja-personas «pose con varios marcadores», cita del plan sin comprobar aquí (el estudio no está en el repo)';
  const SIN = 'sin fuente comprobable; SUPUESTO [SIN VALIDAR]';
  const DICCIONARIO = 'DICT_4X4_50', MAX_ID = 49, EPS = 1e-9;
  // Esquinas de OpenCV: arriba-izquierda, arriba-derecha, abajo-derecha y abajo-izquierda del patrón, con sus signos (x, y)
  const ORDEN = ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda'];
  const SIGNOS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  const P = (id, nombre, unidad, valor, origen, fuente, editable = true) => ({ id, nombre, unidad, valor, origen, fuente, editable });
  const PARAMS = [
    P('alineacion.fraccion', 'Alineación: desvío máximo de los centros a la recta', '× lado medio', 0.5, 'SUPUESTO', `medio lado de los marcadores; ${SIN}`),
  ];
  const POR_ID = new Map(PARAMS.map(p => [p.id, p]));
  function cfgDefecto() {
    const cfg = {};
    for (const p of PARAMS) { const [g, k] = p.id.split('.'); (cfg[g] = cfg[g] || {})[k] = p.valor; }
    return cfg;
  }
  // Cambia un valor editable (devuelve una configuración nueva); un id desconocido o un valor que no sea un número positivo falla
  function fijar(cfg, id, valor) {
    const p = POR_ID.get(id); if (!p) throw new Error(`parámetro desconocido (${JSON.stringify(id)})`);
    if (!p.editable) throw new Error(`«${p.nombre}» lo fija el plan y no se edita`);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || !(valor > 0)) throw new Error(`«${p.nombre}»: ${JSON.stringify(valor)} no es un número positivo`);
    const n = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, { ...v }])), [g, k] = id.split('.'); n[g][k] = valor; return n;
  }

  const fmt1 = x => x.toFixed(1).replace('.', ',');
  const txt = v => typeof v === 'number' ? String(v) : JSON.stringify(v);
  // Los campos de un marcador: el id entero de 0 a 49, el lado positivo y x, y y yaw finitos. Error claro con el id (o el número de fila)
  function campos(m, n) {
    if (m === null || typeof m !== 'object') throw new Error(`marcador ${n}: no es un objeto { id, lado, x, y, yaw }`);
    if (!Number.isInteger(m.id) || m.id < 0 || m.id > MAX_ID) throw new Error(`marcador ${n}: el id ${txt(m.id)} no es un entero de 0 a ${MAX_ID} (${DICCIONARIO})`);
    if (typeof m.lado !== 'number' || !Number.isFinite(m.lado) || !(m.lado > 0)) throw new Error(`marcador con id ${m.id}: el lado ${txt(m.lado)} no es un número positivo (m)`);
    for (const c of ['x', 'y', 'yaw']) if (typeof m[c] !== 'number' || !Number.isFinite(m[c])) throw new Error(`marcador con id ${m.id}: ${c} ${txt(m[c])} no es un número finito`);
    return m;
  }
  // Una lista de marcadores: al menos uno, cada uno válido y los ids únicos (si no, falla con un error y no devuelve nada a medias)
  function validar(marcadores) {
    if (!Array.isArray(marcadores)) throw new Error('se esperaba una lista de marcadores');
    if (!marcadores.length) throw new Error('el tablero no tiene ningún marcador');
    const vistos = new Set();
    marcadores.forEach((m, i) => { campos(m, i + 1); if (vistos.has(m.id)) throw new Error(`el id ${m.id} está repetido (los ids del tablero son únicos)`); vistos.add(m.id); });
    return marcadores;
  }
  // Las cuatro esquinas [x, y, z] del marcador en la bandeja (z = 0), en el orden de ORDEN: centro + R(yaw)·(±lado/2, ±lado/2)
  function esquinas(m) {
    campos(m, 1);
    const h = m.lado / 2, c = Math.cos(m.yaw), s = Math.sin(m.yaw);
    return SIGNOS.map(([a, b]) => { const u = a * h, v = b * h; return [m.x + c * u - s * v, m.y + s * u + c * v, 0]; });
  }
  // El aviso de centros alineados: con dos marcadores o menos siempre lo están; con más, el desvío máximo de los centros a la
  // recta entre los dos más separados (el primero de ellos en caso de empate) no pasa de la tolerancia: fracción × lado medio.
  // → { n, alineado, motivo: 'pocos' | 'recta' | null, desvio, tolerancia, texto: null si no hay aviso }
  function alineacion(marcadores, cfg) {
    validar(marcadores);
    const n = marcadores.length, frac = cfg.alineacion.fraccion, tolerancia = frac * marcadores.reduce((s, m) => s + m.lado, 0) / n;
    let desvio = 0, motivo = null;
    if (n <= 2) motivo = 'pocos';
    else {
      let a = 0, b = 1, dmax = -1;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = Math.hypot(marcadores[j].x - marcadores[i].x, marcadores[j].y - marcadores[i].y); if (d > dmax) { dmax = d; a = i; b = j; } }
      if (dmax > 0) {
        const A = marcadores[a], B = marcadores[b];
        for (const m of marcadores) desvio = Math.max(desvio, Math.abs((B.x - A.x) * (m.y - A.y) - (B.y - A.y) * (m.x - A.x)) / dmax);
      }
      if (desvio <= tolerancia * (1 + EPS)) motivo = 'recta';
    }
    const alineado = motivo !== null, cita = `(${PLAN})`;
    const texto = !alineado ? null : motivo === 'pocos'
      ? `con ${n} ${n === 1 ? 'marcador' : 'marcadores'} los centros siempre quedan sobre una recta: la pose del tablero con varios marcadores es degenerada; añade marcadores fuera de esa recta ${cita}`
      : `los ${n} centros quedan sobre una recta (el mayor desvío es ${fmt1(desvio * 1000)} mm, dentro de la tolerancia de ${fmt1(tolerancia * 1000)} mm = ${String(frac).replace('.', ',')} lados de media, SUPUESTO SIN VALIDAR): la pose del tablero con varios marcadores es degenerada; separa algún marcador de la recta en el otro eje ${cita}`;
    return { n, alineado, motivo, desvio, tolerancia, texto };
  }
  // El modelo que formatea EXPORTAR.tablero: cada marcador con sus esquinas, el diccionario, el orden y la alineación
  function modelo(marcadores, cfg) {
    validar(marcadores);
    return { diccionario: DICCIONARIO, orden: ORDEN, marcadores: marcadores.map(m => ({ id: m.id, lado: m.lado, x: m.x, y: m.y, yaw: m.yaw, esquinas: esquinas(m) })), alineacion: alineacion(marcadores, cfg) };
  }

  return { DICCIONARIO, MAX_ID, ORDEN, PARAMS, cfgDefecto, fijar, validar, esquinas, alineacion, modelo };
})();
if (typeof module !== 'undefined') module.exports = TABLERO;
