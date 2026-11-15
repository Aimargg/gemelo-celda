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
  function ikDH(T) {
    const sols = [];
    const p05 = [T[3] - D6*T[2], T[7] - D6*T[6], T[11] - D6*T[10]];
    const r05 = Math.hypot(p05[0], p05[1]);
    if (r05 < D4 - 1e-9) return sols;
    const psi = Math.atan2(p05[1], p05[0]);
    const phi = Math.acos(Math.min(1, D4 / r05));
    for (const s1 of [1, -1]) {
      const t1 = PI/2 + psi + s1*phi;
      const T10 = inv(A(0, t1));
      const T16 = mul(T10, T);
      const c5 = (T16[11] - D4) / D6;
      if (Math.abs(c5) > 1 + 1e-9) continue;
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
        if (Math.abs(c3) > 1 + 1e-9) continue;
        const a3 = Math.acos(Math.max(-1, Math.min(1, c3)));
        for (const s3 of [1, -1]) {
          const t3 = s3*a3;
          const t2 = -Math.atan2(P13[1], -P13[0]) + Math.asin(Math.max(-1, Math.min(1, A3*Math.sin(t3)/n13)));
          const T32 = inv(A(2, t3)), T21 = inv(A(1, t2));
          const T34 = mul(mul(T32, T21), T14);
          const t4 = Math.atan2(T34[4], T34[0]);
          sols.push([t1, t2, t3, t4, t5, t6].map(wrap));
        }
      }
    }
    return sols;
  }
  function wrap(t) { while (t > PI) t -= 2*PI; while (t <= -PI) t += 2*PI; return t; }
  // Relación URDF <-> DH: T_urdf(q) = PRE * T_dh(q) * POST (se comprueba en el test)
  const PRE = rz(PI), POST = I();
  function ik(T_base_tool0) { return ikDH(mul(mul(inv(PRE), T_base_tool0), inv(POST))); }
  // Jacobiano geométrico numérico (posición+orientación) para manipulabilidad
  function manip(q) {
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
  return { fk, fkLinks, fkDH, ik, ikDH, mul, inv, rz, rx, ry, tr, org, manip, wrap, D1, A2, A3, D4, D5, D6, PRE, JO, W3T: W3_TOOL0 };
})();
if (typeof module !== 'undefined') module.exports = KIN;
