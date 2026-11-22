// Oclusión por el brazo a lo largo de las trayectorias calculadas (T4.2, D4, D6, I6): en qué porcentaje del ciclo tapa el brazo
// cada objetivo de cada cámara. Se muestrea por TIEMPO el plan que ya dejó «Calcular» (nunca se planifica nada nuevo), en cada
// muestra se coloca el brazo, la pinza y lo que lleva con colocar() de colision.js (esferas de colisión, nunca las mallas) y se
// lanza un segmento de la cámara a cada punto del objetivo, acortado un margen junto al objetivo. Todo es matemática pura sobre
// las posturas: un solo pase, sin repintar la escena y sin DOM, three ni red. Se prueba con node:test
// (tests/unit/oclusion-t42.test.mjs) y se concatena en app.js con el marcador @@OCLUSION@@.
// Fuentes. La ficha de T4.2 del plan no da ningún umbral ni cifra (el estudio «camaras-colocacion» no está en el repo): el paso
// de muestreo y el margen del rayo son SUPUESTO [SIN VALIDAR] y editables; el margen de partida (20 mm) es el de metricasCam de
// la v8, sin validar. No hay umbral de «cumple/no cumple» y no se cita ninguna fuente que no se pueda comprobar aquí.
// Reparto del tiempo de cada tramo: el mismo de ejecutar() de colision.js (perfil suave smooth y reparto por articulación en
// acum/S de PERFIL.duracion), de modo que la muestra a un tiempo t es la postura que tendría la demo en ese instante.
const OCLUSION = (() => {
  const SIN = 'sin fuente comprobable; SUPUESTO [SIN VALIDAR]';
  const EPS = 1e-9;
  const MAX_MUESTRAS = 5000; // cota del cálculo: con más muestras en el ciclo no se calcula (un paso demasiado fino)
  // Parámetros: id «grupo.clave», valor de partida, mínimo y máximo (null = sin tope; siempre > 0), fuente. Todos SUPUESTO
  const P = (id, nombre, unidad, valor, min, max, fuente) => ({ id, nombre, unidad, valor, origen: 'SUPUESTO', fuente, editable: true, min, max });
  const PARAMS = [
    P('muestreo.paso', 'Paso de muestreo del ciclo', 's', 0.1, 0.01, 2, `cada tramo se parte en ⌈T / paso⌉ muestras iguales; ${SIN}`),
    P('rayo.margenMm', 'Margen del rayo junto al objetivo', 'mm', 20, null, 500, `el segmento acaba esta distancia antes del punto; el de metricasCam de la v8 (2 cm), sin validar; ${SIN}`),
  ];
  const POR_ID = new Map(PARAMS.map(p => [p.id, p]));
  const copia = cfg => Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, { ...v }]));
  function cfgDefecto() {
    const cfg = {};
    for (const p of PARAMS) { const [g, k] = p.id.split('.'); (cfg[g] = cfg[g] || {})[k] = p.valor; }
    return cfg;
  }
  // Cambia un valor (devuelve una configuración nueva): un id desconocido, un valor que no sea un número positivo o uno fuera de
  // su rango falla con un error claro y no cambia nada
  function fijar(cfg, id, valor) {
    const p = POR_ID.get(id); if (!p) throw new Error(`parámetro desconocido (${JSON.stringify(id)})`);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || !(valor > 0)) throw new Error(`«${p.nombre}»: ${JSON.stringify(valor)} no es un número positivo`);
    if ((p.min !== null && valor < p.min) || (p.max !== null && valor > p.max)) throw new Error(`«${p.nombre}»: ${valor} no está entre ${p.min ?? 0} y ${p.max} ${p.unidad}`);
    const n = copia(cfg), [g, k] = id.split('.'); n[g][k] = valor; return n;
  }

  // Los tramos del plan que entran en el ciclo, con el texto del panel. Los dos últimos no los guarda el plan (son rectas de dos
  // puntos que la demo calcula al ejecutarlas): se aproximan por interpolación articular entre sus posturas ya calculadas
  const TRAMOS = {
    acercar: 'acercarse al borde del plato (recta de 7 cm)', levantar: 'levantarlo (recta de 8 cm)', llevar: 'llevarlo nivelado a la bandeja',
    salir: 'salir de la bandeja (recta de 8 cm, aproximada por interpolación articular)', subir: 'subir tras la salida (recta de 4 cm, aproximada por interpolación articular)',
  };
  const FUERA = 'No entran: el movimiento articular desde el reposo, la fruta, el servo de la bajada hasta la bandeja ni el balanceo de la bandeja.';
  const nota = ids => `Tramos de cada plato que entran en el ciclo: ${ids.map(i => TRAMOS[i]).join(', ')}. ${FUERA}`;

  // Postura q (6 articulaciones) de un tramo en el instante t (s): la de ejecutar(), con el perfil suave sobre el recorrido
  // acumulado. tramo = { ruta: [q...], acum, S, T }; t fuera de [0, T] se recorta a los extremos
  const smooth = t => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function postura(tramo, t) {
    const { ruta, acum, S, T } = tramo;
    if (ruta.length === 1) return ruta[0].slice();
    if (!(T > 0)) return ruta[ruta.length - 1].slice(); // sin duración: ya está en el final
    const u = smooth(clamp(t / T, 0, 1)) * S; let k = 1; while (k < acum.length - 1 && acum[k] < u) k++;
    const a = ruta[k - 1], b = ruta[k], f = acum[k] > acum[k - 1] ? clamp((u - acum[k - 1]) / (acum[k] - acum[k - 1]), 0, 1) : 1;
    return a.map((v, i) => v + (b[i] - v) * f);
  }

  // Muestreo por tiempo de paso fijo: n = ⌈T / paso⌉ muestras iguales por tramo (la tolerancia evita que 0,3 / 0,1 dé 4),
  // cada una en el punto medio de su intervalo y con peso T / n; la suma de los pesos de un tramo es su duración. Un tramo sin
  // duración no da muestras. Determinista: sin azar ni reloj. Devuelve [{ tramo, k, t, peso }] en el orden del ciclo
  function muestrear(tramos, paso) {
    if (typeof paso !== 'number' || !Number.isFinite(paso) || !(paso > 0)) throw new Error(`paso de muestreo: ${JSON.stringify(paso)} no es un número positivo`);
    const ns = tramos.map(tr => tr.T > 0 ? Math.max(1, Math.ceil(tr.T / paso - EPS)) : 0), total = ns.reduce((s, n) => s + n, 0);
    if (total > MAX_MUESTRAS) throw new Error(`${total} muestras con el paso de ${paso} s: el máximo son ${MAX_MUESTRAS}; sube el paso`);
    const out = [];
    tramos.forEach((tr, i) => { const n = ns[i]; for (let k = 0; k < n; k++) out.push({ tramo: i, k, t: (k + 0.5) * tr.T / n, peso: tr.T / n }); });
    return out;
  }

  // Segmento de la cámara c al punto p, acortado `margen` (m) junto a p: { c, u (de c al final), l2 }; null si la cámara está a
  // menos del margen del punto (no queda segmento: nada puede interponerse)
  function segmento(c, p, margen) {
    const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2], L = Math.hypot(dx, dy, dz);
    if (!(L > margen)) return null;
    const k = (L - margen) / L, ux = dx * k, uy = dy * k, uz = dz * k;
    return { c, ux, uy, uz, l2: ux * ux + uy * uy + uz * uz };
  }
  // ¿Corta el segmento la esfera (x, y, z, r)? Distancia del centro al segmento (con los extremos recortados: una esfera detrás
  // del objetivo o de la cámara solo tapa si su volumen llega hasta el segmento) menor que el radio; rozar no tapa
  function cortaEsfera(s, x, y, z, r) {
    const wx = x - s.c[0], wy = y - s.c[1], wz = z - s.c[2];
    const t = clamp((wx * s.ux + wy * s.uy + wz * s.uz) / s.l2, 0, 1);
    const ex = wx - s.ux * t, ey = wy - s.uy * t, ez = wz - s.uz * t;
    return ex * ex + ey * ey + ez * ez < r * r;
  }
  // ¿Corta el segmento alguna de las n primeras esferas de X (x, y, z, r seguidos)?
  function tocaSegmento(s, X, n) {
    for (let i = 0; i < n; i++) { const k = i * 4; if (cortaEsfera(s, X[k], X[k + 1], X[k + 2], X[k + 3])) return true; }
    return false;
  }

  // Resultado de un objetivo: segundos totales, con todo tapado, con algún punto tapado y la racha más larga de todo tapado
  const nuevo = () => ({ total: 0, todo: 0, alguno: 0, racha: 0, rachaMax: 0 });
  // Una muestra de `peso` s con k de los n puntos del objetivo tapados: «todo tapado» si lo están todos (la tarea queda ciega)
  function sumar(r, peso, k, n) {
    r.total += peso;
    if (n > 0 && k === n) { r.todo += peso; r.racha += peso; if (r.racha > r.rachaMax) r.rachaMax = r.racha; } else r.racha = 0;
    if (k > 0) r.alguno += peso;
  }
  const resumen = (r, nPuntos) => nPuntos > 0 && r.total > 0 ? { nPuntos, todo: 100 * r.todo / r.total, alguno: 100 * r.alguno / r.total, racha: r.rachaMax } : { nPuntos, todo: null, alguno: null, racha: null };

  // El cálculo entero. tramos: [{ id, ruta, acum, S, T, w, carga }]; paso y margen en s y en m; colocar(q, w, carga) devuelve
  // { X, n } (las esferas activas en el mismo marco que las cámaras y los puntos); camaras: [{ id, o: [x, y, z], objetivos:
  // [{ id, puntos: [[x, y, z]...] }] }], solo con los puntos que la cámara ve. Un objetivo sin puntos sale sin número (fuera de
  // campo). Devuelve { muestras, T, camaras: [{ id, objetivos: [{ id, nPuntos, todo, alguno, racha }] }] }, con los porcentajes
  // de 0 a 100 sobre el tiempo y la racha en segundos
  function calcular({ tramos, paso, margen, colocar, camaras }) {
    if (typeof margen !== 'number' || !Number.isFinite(margen) || !(margen > 0)) throw new Error(`margen del rayo: ${JSON.stringify(margen)} no es un número positivo`);
    const ms = muestrear(tramos, paso);
    const acc = camaras.map(c => ({ id: c.id, objs: c.objetivos.map(o => ({ id: o.id, n: o.puntos.length, segs: o.puntos.map(p => segmento(c.o, p, margen)), r: nuevo() })) }));
    let T = 0;
    for (const m of ms) {
      const tr = tramos[m.tramo], { X, n } = colocar(postura(tr, m.t), tr.w, tr.carga); T += m.peso;
      for (const c of acc) for (const o of c.objs) { if (!o.n) continue; let k = 0; for (const s of o.segs) if (s && tocaSegmento(s, X, n)) k++; sumar(o.r, m.peso, k, o.n); }
    }
    return { muestras: ms.length, T, camaras: acc.map(c => ({ id: c.id, objetivos: c.objs.map(o => ({ id: o.id, ...resumen(o.r, o.n) })) })) };
  }
  return { PARAMS, TRAMOS, FUERA, MAX_MUESTRAS, cfgDefecto, fijar, nota, smooth, postura, muestrear, segmento, cortaEsfera, tocaSegmento, nuevo, sumar, resumen, calcular };
})();
if (typeof module !== 'undefined') module.exports = OCLUSION;
