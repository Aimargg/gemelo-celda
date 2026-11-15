// Cinemática UR3e: FK por la cadena URDF (ur_description) y por DH, IK analítica (8 soluciones).
// Matrices 4x4 en arrays planos de 16, por filas (row-major).
const KIN = (() => {
  const D1 = 0.15185, A2 = -0.24355, A3 = -0.2132, D4 = 0.13105, D5 = 0.08535, D6 = 0.0921;
  const PI = Math.PI;
  const I = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  function mul(a, b) {
    const r = new Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      r[i*4+j] = a[i*4]*b[j] + a[i*4+1]*b[4+j] + a[i*4+2]*b[8+j] + a[i*4+3]*b[12+j];
    }
    return r;
  }
  function inv(m) { // transformada rígida
    const R = [m[0],m[4],m[8], m[1],m[5],m[9], m[2],m[6],m[10]];
    const t = [m[3],m[7],m[11]];
    const ti = [-(R[0]*t[0]+R[1]*t[1]+R[2]*t[2]), -(R[3]*t[0]+R[4]*t[1]+R[5]*t[2]), -(R[6]*t[0]+R[7]*t[1]+R[8]*t[2])];
    return [R[0],R[1],R[2],ti[0], R[3],R[4],R[5],ti[1], R[6],R[7],R[8],ti[2], 0,0,0,1];
  }
  function rz(t) { const c = Math.cos(t), s = Math.sin(t); return [c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]; }
  function rx(t) { const c = Math.cos(t), s = Math.sin(t); return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]; }
  function ry(t) { const c = Math.cos(t), s = Math.sin(t); return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]; }
  function tr(x, y, z) { return [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]; }
  // URDF origin: xyz + rpy (R = Rz(yaw) Ry(pitch) Rx(roll))
  function org(x, y, z, r, p, yw) { return mul(tr(x, y, z), mul(rz(yw), mul(ry(p), rx(r)))); }
  // Orígenes de las articulaciones (default_kinematics.yaml del UR3e)
  const JO = [
    mul(org(0,0,0, 0,0,PI), org(0,0,D1, 0,0,0)),   // base_link -> base_link_inertia (yaw pi) -> shoulder_pan
    org(0,0,0, PI/2,0,0),                           // shoulder_lift
    org(A2,0,0, 0,0,0),                             // elbow
    org(A3,0,D4, 0,0,0),                            // wrist_1
    org(0,-D5,0, PI/2,0,0),                         // wrist_2
    org(0,D6,0, PI/2,PI,PI),                        // wrist_3
  ];
  const W3_TOOL0 = mul(org(0,0,0, 0,-PI/2,-PI/2), org(0,0,0, PI/2,0,PI/2)); // wrist_3 -> flange -> tool0
  // FK URDF: devuelve las 6 transformadas de los eslabones y tool0 respecto a base_link
  function fkLinks(q) {
    const out = []; let T = I();
    for (let i = 0; i < 6; i++) { T = mul(T, mul(JO[i], rz(q[i]))); out.push(T); }
    out.push(mul(T, W3_TOOL0));
    return out;
  }
  function fk(q) { return fkLinks(q)[6]; }
  // DH estándar
  const d = [D1,0,0,D4,D5,D6], a = [0,A2,A3,0,0,0], al = [PI/2,0,0,PI/2,-PI/2,0];
  function A(i, t) { return mul(mul(tr(0,0,d[i]), rz(t)), mul(tr(a[i],0,0), rx(al[i]))); }
  function fkDH(q) { let T = I(); for (let i = 0; i < 6; i++) T = mul(T, A(i, q[i])); return T; }
  // IK analítica (Hawkins / Keating) en el marco DH. Devuelve hasta 8 soluciones válidas.
  // holgura (solo para las semillas de la IK refinada; 0 en la nominal, que da los mismos números que antes): admite poses
  // que se salen del espacio de trabajo nominal por poco y las proyecta a su borde (cosenos recortados a ±1). Si se pasa
  // `forzadas`, recibe por cada solución si ha hecho falta esa proyección.
  function ikDH(T, holgura = 0, forzadas = null) {
    const sols = [];
    const p05 = [T[3] - D6*T[2], T[7] - D6*T[6], T[11] - D6*T[10]];
    const r05 = Math.hypot(p05[0], p05[1]);
    if (r05 < D4 - 1e-9 - holgura * D4) return sols;
    const f1 = r05 < D4 - 1e-9;
    const psi = Math.atan2(p05[1], p05[0]);
    const phi = Math.acos(Math.min(1, D4 / r05));
    for (const s1 of [1, -1]) {
      const t1 = PI/2 + psi + s1*phi;
      const T10 = inv(A(0, t1));
      const T16 = mul(T10, T);
      const c5 = (T16[11] - D4) / D6;
      if (Math.abs(c5) > 1 + 1e-9 + holgura) continue;
      const f5 = f1 || Math.abs(c5) > 1 + 1e-9;
      const a5 = Math.acos(Math.max(-1, Math.min(1, c5)));
      for (const s5 of [1, -1]) {
        const t5 = s5*a5;
        const s5v = Math.sin(t5);
        let t6;
        const T61 = inv(T16);
        if (Math.abs(s5v) < 1e-7) t6 = 0; // singularidad de muñeca: t6 libre
        else t6 = Math.atan2(-T61[6]/s5v, T61[2]/s5v);
        const T65 = A(5, t6), T54 = A(4, t5);
        const T14 = mul(T16, inv(mul(T54, T65)));
        const P13 = [T14[0]*0 + T14[1]*(-D4) + T14[3], T14[4]*0 + T14[5]*(-D4) + T14[7], T14[8]*0 + T14[9]*(-D4) + T14[11]];
        const n13 = Math.hypot(P13[0], P13[1], P13[2]);
        const c3 = (n13*n13 - A2*A2 - A3*A3) / (2*A2*A3);
        if (Math.abs(c3) > 1 + 1e-9 + holgura) continue;
        const f3 = f5 || Math.abs(c3) > 1 + 1e-9;
        const a3 = Math.acos(Math.max(-1, Math.min(1, c3)));
        for (const s3 of [1, -1]) {
          const t3 = s3*a3;
          const t2 = -Math.atan2(P13[1], -P13[0]) + Math.asin(Math.max(-1, Math.min(1, A3*Math.sin(t3)/n13)));
          const T32 = inv(A(2, t3)), T21 = inv(A(1, t2));
          const T34 = mul(mul(T32, T21), T14);
          const t4 = Math.atan2(T34[4], T34[0]);
          sols.push([t1, t2, t3, t4, t5, t6].map(wrap));
          if (forzadas) forzadas.push(f3);
        }
      }
    }
    return sols;
  }
  function wrap(t) { while (t > PI) t -= 2*PI; while (t <= -PI) t += 2*PI; return t; }
  // Relación URDF <-> DH: T_urdf(q) = PRE * T_dh(q) * POST (se comprueba en el test)
  const PRE = rz(PI), POST = I();
  function ik(T_base_tool0) { return ikDH(mul(mul(inv(PRE), T_base_tool0), inv(POST))); }
  function ikHolgura(T_base_tool0, holgura, forzadas) { return ikDH(mul(mul(inv(PRE), T_base_tool0), inv(POST)), holgura, forzadas); }
  // Jacobiano geométrico numérico (posición+orientación) para manipulabilidad
  function manip(q) { return manipDe(fk, q); }
  function manipDe(fk, q) {
    const h = 1e-5; const T0 = fk(q); const J = [];
    for (let i = 0; i < 6; i++) {
      const qp = q.slice(); qp[i] += h; const T1 = fk(qp);
      const dp = [(T1[3]-T0[3])/h, (T1[7]-T0[7])/h, (T1[11]-T0[11])/h];
      // dR R^T ~ skew(w)
      const R0 = [T0[0],T0[1],T0[2],T0[4],T0[5],T0[6],T0[8],T0[9],T0[10]];
      const R1 = [T1[0],T1[1],T1[2],T1[4],T1[5],T1[6],T1[8],T1[9],T1[10]];
      const M = new Array(9).fill(0);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        let s = 0; for (let k = 0; k < 3; k++) s += (R1[r*3+k]-R0[r*3+k])/h * R0[c*3+k]; M[r*3+c] = s;
      }
      J.push([dp[0], dp[1], dp[2], M[7], M[2], M[3]]);
    }
    // det(J) (6x6, columnas = articulaciones)
    const m = []; for (let r = 0; r < 6; r++) { m.push([]); for (let c = 0; c < 6; c++) m[r].push(J[c][r]); }
    let det = 1;
    for (let c = 0; c < 6; c++) {
      let p = c; for (let r = c+1; r < 6; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      if (Math.abs(m[p][c]) < 1e-12) return 0;
      if (p !== c) { [m[p], m[c]] = [m[c], m[p]]; det = -det; }
      det *= m[c][c];
      for (let r = c+1; r < 6; r++) { const f = m[r][c]/m[c][c]; for (let k = c; k < 6; k++) m[r][k] -= f*m[c][k]; }
    }
    return Math.abs(det);
  }

  // ======== Cinemática por robot (T1.4, D7) ========
  // Un objeto de cinemática tiene { calibrada, JO, W3T, fk, fkLinks, ik, ikDetalle, manip, stats }. El nominal es el de
  // arriba tal cual (mismas funciones y mismos números: I8). Uno calibrado se construye con los orígenes de articulación de
  // su calibration_<id>.yaml (src/datos/calibracion.js), con la misma convención que el URDF del curso: origen
  // Trans·Rz(yaw)·Ry(pitch)·Rx(roll) y después el giro de la articulación en su eje z; base_link → base_link_inertia gira π
  // (ur_macro.xacro), como en JO[0]. tool0 cuelga de wrist_3 igual que en el nominal (la calibración no lo cambia).
  const CLAVES_CAL = ['shoulder', 'upper_arm', 'forearm', 'wrist_1', 'wrist_2', 'wrist_3'];
  // IK refinada: cada rama de la IK analítica nominal es una semilla que se refina con Levenberg–Marquardt sobre la FK
  // calibrada hasta TOL_POS y TOL_ROT, con MAX_ITER iteraciones como mucho. Las ramas que no llegan se descartan y se cuentan.
  // HOLGURA_SEMILLA: además de las ramas analíticas, se refinan las que salen al proyectar al borde del espacio de trabajo
  // nominal una pose que se sale de él por poco (coseno hasta 1,05; unos 5 mm junto al codo estirado). Una calibración
  // mueve el borde unos milímetros, y sin ellas las poses junto al codo o la muñeca estirados se quedaban sin semilla.
  // Solo cuentan como «ramas analíticas» (`semillas`) las de la IK nominal estricta: si no hay ninguna, el punto está fuera
  // de alcance; si las hay y ninguna converge, «IK calibrada no converge» (T1.4-5).
  const TOL_POS = 1e-6, TOL_ROT = 1e-6, MAX_ITER = 30, HOLGURA_SEMILLA = 0.05;
  function mulR(a, b) { // producto de dos transformadas rígidas (la última fila es 0 0 0 1)
    return [a[0]*b[0] + a[1]*b[4] + a[2]*b[8], a[0]*b[1] + a[1]*b[5] + a[2]*b[9], a[0]*b[2] + a[1]*b[6] + a[2]*b[10], a[0]*b[3] + a[1]*b[7] + a[2]*b[11] + a[3],
      a[4]*b[0] + a[5]*b[4] + a[6]*b[8], a[4]*b[1] + a[5]*b[5] + a[6]*b[9], a[4]*b[2] + a[5]*b[6] + a[6]*b[10], a[4]*b[3] + a[5]*b[7] + a[6]*b[11] + a[7],
      a[8]*b[0] + a[9]*b[4] + a[10]*b[8], a[8]*b[1] + a[9]*b[5] + a[10]*b[9], a[8]*b[2] + a[9]*b[6] + a[10]*b[10], a[8]*b[3] + a[9]*b[7] + a[10]*b[11] + a[11], 0, 0, 0, 1];
  }
  // Eslabones y tool0 en base_link para unos orígenes de articulación jo: T_i = T_(i−1) · jo[i] · Rz(q_i). jo[i] · Rz(q) solo
  // cambia las dos primeras columnas de jo[i], así que se calcula directamente (es lo que más cuesta en la IK refinada).
  function cadena(jo, q) {
    const out = []; let T = null;
    for (let i = 0; i < 6; i++) {
      const J = jo[i], c = Math.cos(q[i]), s = Math.sin(q[i]);
      const M = [J[0]*c + J[1]*s, J[1]*c - J[0]*s, J[2], J[3], J[4]*c + J[5]*s, J[5]*c - J[4]*s, J[6], J[7], J[8]*c + J[9]*s, J[9]*c - J[8]*s, J[10], J[11], 0, 0, 0, 1];
      T = T ? mulR(T, M) : M; out.push(T);
    }
    out.push(mulR(T, W3_TOOL0));
    return out;
  }
  // Error de pose de T (actual) respecto a D (deseada) en base_link: posición D − T y vector de giro de D·Tᵀ
  function errorPose(T, D) {
    const ep = [D[3] - T[3], D[7] - T[7], D[11] - T[11]];
    const M = new Array(9); // D·Tᵀ (solo la rotación)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M[r * 3 + c] = D[r * 4] * T[c * 4] + D[r * 4 + 1] * T[c * 4 + 1] + D[r * 4 + 2] * T[c * 4 + 2];
    const v = [M[7] - M[5], M[2] - M[6], M[3] - M[1]]; const s = Math.hypot(v[0], v[1], v[2]) / 2, c = (M[0] + M[4] + M[8] - 1) / 2;
    const th = Math.atan2(s, c); let er;
    if (s > 1e-9) er = v.map(x => x / 2 * th / s);
    else if (c > 0) er = v.map(x => x / 2); // giro casi nulo
    else { // casi media vuelta: eje desde la diagonal de (M + I) / 2
      const k = [0, 4, 8].reduce((a, b) => M[b] > M[a] ? b : a, 0) / 4; const ax = [0, 0, 0];
      ax[k] = Math.sqrt(Math.max(0, (M[k * 4] + 1) / 2)); for (let j = 0; j < 3; j++) if (j !== k) ax[j] = (M[j * 3 + k] + M[k * 3 + j]) / 4 / ax[k];
      er = ax.map(x => x * th);
    }
    return { ep, er, p: Math.hypot(ep[0], ep[1], ep[2]), r: Math.hypot(er[0], er[1], er[2]) };
  }
  // Búferes de trabajo de refinar (la página tiene un solo hilo y refinar no se llama a sí misma)
  const _J = new Float64Array(36), _A = new Float64Array(36), _g = new Float64Array(6), _dq = new Float64Array(6);
  function cholesky6(A, b, x) { // A·x = b con A simétrica definida positiva (JᵀJ + λI), en el sitio; false si no lo es
    for (let j = 0; j < 6; j++) {
      let d = A[j * 6 + j]; for (let k = 0; k < j; k++) d -= A[j * 6 + k] * A[j * 6 + k];
      if (!(d > 0)) return false; d = Math.sqrt(d); A[j * 6 + j] = d;
      for (let i = j + 1; i < 6; i++) { let s = A[i * 6 + j]; for (let k = 0; k < j; k++) s -= A[i * 6 + k] * A[j * 6 + k]; A[i * 6 + j] = s / d; }
    }
    for (let i = 0; i < 6; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= A[i * 6 + k] * x[k]; x[i] = s / A[i * 6 + i]; }
    for (let i = 5; i >= 0; i--) { let s = x[i]; for (let k = i + 1; k < 6; k++) s -= A[k * 6 + i] * x[k]; x[i] = s / A[i * 6 + i]; }
    return true;
  }
  // Levenberg–Marquardt desde q0 hacia la pose D con los orígenes jo: (JᵀJ + λI)·Δq = Jᵀe, con J el jacobiano geométrico
  // en base_link y e el error de posición y de giro. λ baja si el paso mejora y sube si no. Devuelve { q, it, p, r, ok }.
  function refinar(jo, q0, D) {
    let q = q0.slice(), Ls = cadena(jo, q), e = errorPose(Ls[6], D), n2 = e.p * e.p + e.r * e.r, lam = 1e-6, it = 0;
    const J = _J, A = _A, g = _g, dq = _dq;
    while (!(e.p <= TOL_POS && e.r <= TOL_ROT) && it < MAX_ITER) {
      it++;
      const P = Ls[6], px = P[3], py = P[7], pz = P[11];
      for (let i = 0; i < 6; i++) { // columna i: [z × (p − o); z]
        const T = Ls[i], zx = T[2], zy = T[6], zz = T[10], dx = px - T[3], dy = py - T[7], dz = pz - T[11], k = i * 6;
        J[k] = zy * dz - zz * dy; J[k + 1] = zz * dx - zx * dz; J[k + 2] = zx * dy - zy * dx; J[k + 3] = zx; J[k + 4] = zy; J[k + 5] = zz;
      }
      const ep = e.ep, er = e.er;
      for (let i = 0; i < 6; i++) {
        const a = i * 6; g[i] = J[a] * ep[0] + J[a + 1] * ep[1] + J[a + 2] * ep[2] + J[a + 3] * er[0] + J[a + 4] * er[1] + J[a + 5] * er[2];
        for (let j = 0; j <= i; j++) { const b = j * 6; const t = J[a] * J[b] + J[a + 1] * J[b + 1] + J[a + 2] * J[b + 2] + J[a + 3] * J[b + 3] + J[a + 4] * J[b + 4] + J[a + 5] * J[b + 5]; A[i * 6 + j] = A[j * 6 + i] = t; }
        A[i * 6 + i] += lam;
      }
      if (!cholesky6(A, g, dq)) { lam = Math.min(lam * 10, 1e6); continue; }
      const qn = [q[0] + dq[0], q[1] + dq[1], q[2] + dq[2], q[3] + dq[3], q[4] + dq[4], q[5] + dq[5]];
      const Ln = cadena(jo, qn), en = errorPose(Ln[6], D), nn = en.p * en.p + en.r * en.r;
      if (nn < n2) { q = qn; Ls = Ln; e = en; n2 = nn; lam = Math.max(lam / 10, 1e-12); } else lam = Math.min(lam * 10, 1e6);
    }
    return { q: q.map(wrap), it, p: e.p, r: e.r, ok: e.p <= TOL_POS && e.r <= TOL_ROT };
  }
  const NOMINAL = { calibrada: false, JO, W3T: W3_TOOL0, fk, fkLinks, ik, manip, stats: null,
    ikDetalle: T => { const sols = ik(T); return { sols, semillas: sols.length, descartadas: 0, errPos: 0, errRot: 0 }; } };
  // kinematics: la entrada `kinematics` de CALIBRACION.robots[id] (clave → { x, y, z, roll, pitch, yaw })
  function calibrada(kinematics) {
    const jo = CLAVES_CAL.map((k, i) => { const o = kinematics[k]; const m = org(o.x, o.y, o.z, o.roll, o.pitch, o.yaw); return i === 0 ? mul(rz(PI), m) : m; });
    const fkLinksC = q => cadena(jo, q), fkC = q => cadena(jo, q)[6];
    // stats se puede leer desde fuera: llamadas, ramas analíticas (semillas), semillas proyectadas al borde (extra),
    // ramas que convergen, descartadas (no convergen) e iteraciones de LM
    const stats = { llamadas: 0, semillas: 0, extra: 0, convergidas: 0, descartadas: 0, iteraciones: 0 };
    function ikDetalle(T) {
      const forz = [], sem = ikHolgura(T, HOLGURA_SEMILLA, forz), sols = []; let desc = 0, errPos = 0, errRot = 0;
      sem.forEach((s, k) => { const r = refinar(jo, s, T); stats.iteraciones += r.it; if (!r.ok) { desc++; return; } sols.push(r.q); errPos = Math.max(errPos, r.p); errRot = Math.max(errRot, r.r); });
      const extra = forz.filter(Boolean).length, semillas = sem.length - extra;
      stats.llamadas++; stats.semillas += semillas; stats.extra += extra; stats.convergidas += sols.length; stats.descartadas += desc;
      return { sols, semillas, extra, descartadas: desc, errPos, errRot };
    }
    return { calibrada: true, JO: jo, W3T: W3_TOOL0, fk: fkC, fkLinks: fkLinksC, ik: T => ikDetalle(T).sols, ikDetalle, manip: q => manipDe(fkC, q), stats };
  }

  // ======== world ↔ base_link (T1.4 y T1.5) ========
  // world: ejes de la mesa (el marco de la escena del gemelo) con origen en (x0, y0, z0), el centro de la base sobre el
  // tablero. base_link gira yaw alrededor de z respecto a world (mount_yaw − π del xacro del curso). Es la única conversión
  // entre los dos marcos. Con yaw = 0 es una resta (o una suma) exacta, sin pasar por senos y cosenos: con el robot nominal
  // los números no cambian ni en el último bit (I8).
  function marcoBase(x0, y0, z0, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), giro = yaw !== 0;
    return {
      x0, y0, z0, yaw,
      aBase: (x, y, z) => { const dx = x - x0, dy = y - y0; return giro ? [c * dx + s * dy, -s * dx + c * dy, z - z0] : [dx, dy, z - z0]; },
      aMundo: (x, y, z) => giro ? [c * x - s * y + x0, s * x + c * y + y0, z + z0] : [x + x0, y + y0, z + z0],
      vecAMundo: (x, y, z) => giro ? [c * x - s * y, s * x + c * y, z] : [x, y, z],
      yawABase: a => a - yaw, yawAMundo: a => a + yaw,
    };
  }
  return { fk, fkLinks, fkDH, ik, ikDH, mul, inv, rz, rx, ry, tr, org, manip, wrap, D1, A2, A3, D4, D5, D6, PRE, JO, W3T: W3_TOOL0,
    nominal: NOMINAL, calibrada, marcoBase, TOL_POS, TOL_ROT, MAX_ITER };
})();
if (typeof module !== 'undefined') module.exports = KIN;
