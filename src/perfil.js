// Perfiles de movimiento (T1.6, D6): «gemelo» (el de la v8: rápido, para explorar) y «curso» (como MoveIt 2 en la
// simulación del curso). Sin navegador ni three: se prueba con node:test (tests/unit/perfil.test.mjs) y se concatena en
// app.js con el marcador @@PERFIL@@ (D4). No hay perfil global: cada petición (planificar, la semilla, la duración, la ruta
// cartesiana y moveJ) lleva el suyo y de() falla si falta, para que un camino que lo olvide no calcule con otro perfil.
const PERFIL = (() => {
  const TABLA = {
    gemelo: {
      nombre: 'gemelo',
      acc: 3, accOrigen: 'SUPUESTO: el yaml del UR3e no fija aceleraciones (rad/s² a velocidad 100 %)',
      escala: null, escalaOrigen: 'la velocidad de la demo (#dVel) por el factor de la zona de la persona',
      // ruta cartesiana: IK cada 4 mm y 0,02 rad de giro, sin saltos de más de 0,15 rad entre dos posturas
      cart: { paso: 0.004, pasoGiro: 0.02, salto: 0.15 },
      arranque: 'separar', // si sale en contacto, se permite separarse de lo que toca (como FixStartStateCollision)
    },
    curso: {
      nombre: 'curso',
      acc: 5, accOrigen: 'config/joint_limits.yaml del curso: 5,0 rad/s² en las seis articulaciones',
      escala: 0.1, escalaOrigen: 'default_velocity_scaling_factor y default_acceleration_scaling_factor 0,1 del curso; el ejemplo del profesor usa 0,1',
      // compute_cartesian_path de MoveIt 2.11+ (el ejemplo pide max_step 0,01 m y jump_threshold 0, que se ignora):
      // pasos de 0,01 m en traslación y, entre dos posturas, punto medio articular frente al cartesiano a 1 mm y 0,01 rad
      cart: { maxStep: 0.01, tolP: 0.001, tolR: 0.01,
        maxNivel: 5 }, // SUPUESTO: niveles de bisección por paso (hasta 32 subpasos de 0,31 mm); el estudio no da la cifra
      arranque: 'fallo', // CheckStartStateCollision: START_STATE_IN_COLLISION (en Jazzy no existe FixStartStateCollision)
    },
  };
  const NOMBRES = Object.keys(TABLA);
  function de(p) { if (!Object.hasOwn(TABLA, p)) throw new Error(`petición sin perfil de movimiento válido (${JSON.stringify(p)})`); return TABLA[p]; }

  // Reparto del tiempo de una ruta articular. o: { perfil, vel (la de la demo, 0–1), factor (zona de la persona), vmax }.
  // S y acum: «tiempo» de cada punto a velocidad 1 (el paso más lento de cada tramo), para repartir el movimiento.
  // · gemelo: la fórmula de la v8, sin cambiar ningún número ni el orden de las operaciones (I8)
  // · curso: trapecio por articulación sobre su recorrido acumulado en la ruta, con v = 0,1·vmax y a = 5·0,1 rad/s²;
  //   T = el de la articulación que más tarda. Sin paradas en los puntos de paso: aproximación, no TOTG (DT4).
  //   La velocidad de la demo y el factor de la persona no cuentan: la escala es la del curso.
  function duracion(ruta, o) {
    const t = de(o.perfil), vmax = o.vmax;
    let S = 0, maxRec = 0; const acum = [0], rec = [0, 0, 0, 0, 0, 0];
    for (let k = 1; k < ruta.length; k++) { let d = 0; for (let i = 0; i < 6; i++) { const dq = Math.abs(ruta[k][i] - ruta[k - 1][i]); d = Math.max(d, dq / vmax[i]); rec[i] += dq; } S += d; acum.push(S); }
    if (t.escala === null) { maxRec = Math.max(...rec); const v = o.vel * o.factor; return { S, acum, rec, T: Math.max(0.25, 1.5 * S / v, Math.sqrt(6 * maxRec / (t.acc * v))) }; }
    const a = t.acc * t.escala; let T = 0, limita = -1;
    for (let i = 0; i < 6; i++) { const Ti = trapecio(rec[i], t.escala * vmax[i], a); if (Ti > T) { T = Ti; limita = i; } }
    return { S, acum, rec, T, limita };
  }
  // Tiempo de recorrer d (rad) partiendo y acabando parado con velocidad máxima v y aceleración a: trapecio si llega a v
  // (d ≥ v²/a), triángulo si no
  const trapecio = (d, v, a) => d >= v * v / a ? d / v + v / a : 2 * Math.sqrt(d / a);

  // Pasos de IK de un tramo cartesiano de d metros que gira dyaw rad
  // · gemelo: cada 4 mm o 0,02 rad, al menos uno
  // · curso: solo la traslación cuenta (MaxEEFStep sin giro), al menos uno por tramo aunque solo gire:
  //   floor(d / max_step) + 1, como computeCartesianPath [SUPUESTO: la fórmula exacta de MoveIt no está en el estudio]
  function pasosTramo(perfil, d, dyaw) {
    const c = de(perfil).cart;
    if (perfil === 'gemelo') return Math.max(1, Math.ceil(Math.max(d / c.paso, Math.abs(dyaw) / c.pasoGiro)));
    return Math.floor(d / c.maxStep) + 1;
  }

  // --- Punto medio («curso») ---
  // Cuaternión (w, x, y, z) de la rotación de una matriz 4×4 por filas (la de KIN.fk)
  function cuat(T) {
    const m00 = T[0], m01 = T[1], m02 = T[2], m10 = T[4], m11 = T[5], m12 = T[6], m20 = T[8], m21 = T[9], m22 = T[10], tr = m00 + m11 + m22;
    let w, x, y, z;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
    else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
    else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
    else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
    const n = Math.hypot(w, x, y, z); return [w / n, x / n, y / n, z / n];
  }
  // Ángulo (rad) entre dos rotaciones dadas como cuaterniones
  const angulo = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
  // Desvío del punto medio articular frente a la interpolación cartesiana entre las poses de las dos posturas (la del TCP
  // en línea recta y la orientación por slerp), que es lo que compara MoveIt. Ta, Tb, Tm: tool0 (4×4 por filas) en las dos
  // posturas y en su punto medio articular; tz: TCP a lo largo del eje z de la herramienta.
  // dp: distancia del TCP de Tm al punto medio de los TCP de Ta y Tb (m); dr: giro de Tm frente al slerp ½ de Ta y Tb (rad).
  function desvioMedio(Ta, Tb, Tm, tz) {
    const tcp = T => [T[3] + T[2] * tz, T[7] + T[6] * tz, T[11] + T[10] * tz], pa = tcp(Ta), pb = tcp(Tb), pm = tcp(Tm);
    const qa = cuat(Ta), qb = cuat(Tb), s = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0 ? -1 : 1;
    const h = [0, 1, 2, 3].map(i => qa[i] + s * qb[i]), n = Math.hypot(...h); // slerp a la mitad: la suma normalizada
    return { dp: Math.hypot(pm[0] - (pa[0] + pb[0]) / 2, pm[1] - (pa[1] + pb[1]) / 2, pm[2] - (pa[2] + pb[2]) / 2), dr: angulo(h.map(v => v / n), cuat(Tm)) };
  }
  // Comprobación del punto medio entre las posturas qa (parámetro ta del tramo) y qb (tb), con subdivisión por bisección
  // hasta c.maxNivel niveles. f.desvio(qa, qb) → { dp, dr }; f.ik(t, qCerca) → postura en t o null.
  // Devuelve { qs } con las posturas aceptadas en orden ([t, q]; la última es [tb, qb]) o { fallo, qs } con las aceptadas
  // hasta el corte; fallo.t es el parámetro de la última postura aceptada (ahí se corta la ruta).
  function subdividir(qa, ta, qb, tb, f, c = TABLA.curso.cart) {
    const qs = [];
    const rec = (qa, ta, qb, tb, nivel) => {
      const tm = (ta + tb) / 2, d = f.desvio(qa, qb);
      if (d.dp <= c.tolP && d.dr <= c.tolR) { qs.push([tb, qb]); return null; }
      if (nivel >= c.maxNivel) return { t: ta, dp: d.dp, dr: d.dr, nivel };
      const qm = f.ik(tm, qa); if (!qm) return { t: ta, dp: d.dp, dr: d.dr, nivel, sinIK: true };
      return rec(qa, ta, qm, tm, nivel + 1) || rec(qm, tm, qb, tb, nivel + 1);
    };
    const fallo = rec(qa, ta, qb, tb, 0);
    return fallo ? { fallo, qs } : { qs };
  }

  // Entrada de la semilla del RRT de una petición (D5): la de T1.2 con el perfil de la petición en vez de la constante
  // 'gemelo'. Con «gemelo», el texto canónico es idéntico al de la v9 anterior (T1.6-3).
  function entradaSemilla(p) {
    de(p.perfil);
    return { qa: p.qa, qb: p.qb, w: p.w, carga: p.carga, obst: p.obst, permitir: p.permitir, conBlandos: p.conBlandos, sinEntorno: p.sinEntorno, sinAuto: p.sinAuto, perfil: p.perfil };
  }

  // Motivo concreto de que un perfil falle cuando el otro pasa (T1.8): sale de la causa del fallo, no de comparar textos.
  // f: { causa, pct, txt } del fallo (el primer problema de la comprobación previa o el de la demo); t: { curso, gemelo },
  // tiempos de ciclo (s). Las causas que dependen del tiempo son las de la bandeja, que se mueve mientras el brazo llega:
  // con «curso» el brazo llega en otro momento (bandeja_movida: más de 10 s fuera de su sitio en M0; alcance_bandeja: la
  // zona sale del alcance; tiempo: la colocación no acaba en su plazo).
  const CAUSAS_TIEMPO = ['bandeja_movida', 'alcance_bandeja', 'tiempo'];
  const s1 = v => Number(v || 0).toFixed(1).replace('.', ',');
  function motivo(f, t = {}) {
    if (!f) return null;
    if (f.causa === 'arranque_contacto') return 'arranque en contacto';
    if (f.causa === 'cartesiana_incompleta') return `ruta cartesiana incompleta (${Math.round(f.pct ?? 0)} %)`;
    if (CAUSAS_TIEMPO.includes(f.causa)) return `tiempo de ciclo: ${s1(t.curso)} s en curso frente a ${s1(t.gemelo)} s en gemelo`;
    return String(f.txt || '').slice(0, 300);
  }

  return { TABLA, NOMBRES, de, duracion, trapecio, pasosTramo, cuat, desvioMedio, subdividir, entradaSemilla, CAUSAS_TIEMPO, motivo };
})();
if (typeof module !== 'undefined') module.exports = PERFIL;
