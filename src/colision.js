// ======================= Colisiones y planificación de trayectorias (lo que hará MoveIt en el robot real) =======================
// Esferas ajustadas a las mallas de colisión oficiales del UR3e (ur_description/meshes/ur3e/collision), en el marco de cada eslabón.
// Cubren toda la malla; como mucho sobresalen 11–17 mm (23 mm en la base, que no se mueve). Se generan con esferas/cubrir2.py.
const ESF_UR = {"base":[[0.004,0.0001,0.048,0.071],[-0.012,0.0121,0.04,0.064],[-0.008,-0.0199,0.036,0.06],[0.028,0.0001,0.032,0.0556],[0.012,0.0321,0.024,0.048],[0.008,-0.0359,0.024,0.048],[-0.056,-0.0039,0.008,0.0319]],"shoulder":[[0.001,-0.0069,0.0109,0.0598],[0.001,-0.0189,-0.0131,0.0597],[0.001,0.0091,-0.0211,0.0517],[0.001,-0.0189,0.0109,0.0597],[-0.003,-0.0029,0.0109,0.0592],[-0.019,0.0051,-0.0331,0.0397],[0.021,0.0051,-0.0331,0.0396],[-0.023,-0.0389,-0.0011,0.0382],[0.017,-0.0349,-0.0011,0.0437],[-0.003,0.0211,-0.0331,0.0397],[-0.039,-0.0269,-0.0451,0.019],[-0.039,-0.0589,0.0109,0.0197],[0.001,0.0131,-0.0251,0.0477]],"upperarm":[[-0.0067,0.001,0.1269,0.0634],[-0.2347,0.001,0.1349,0.0565],[-0.0907,0.001,0.1069,0.0607],[-0.1587,0.001,0.1349,0.0591],[-0.2427,0.001,0.1029,0.0554],[0.0053,0.001,0.1029,0.0581],[-0.0787,0.001,0.1349,0.0609],[-0.1707,0.001,0.1029,0.0565],[-0.0427,0.001,0.1069,0.0621],[-0.1347,-0.003,0.1029,0.0569],[-0.0387,-0.003,0.1349,0.0609],[0.0053,-0.019,0.0869,0.0421],[-0.2067,0.001,0.1029,0.056],[-0.1347,0.001,0.1349,0.0599],[-0.0027,0.017,0.0909,0.0461],[-0.2067,0.001,0.1389,0.0559],[-0.0507,-0.027,0.0789,0.0339],[-0.1307,0.013,0.0909,0.045],[-0.0827,0.017,0.0869,0.0416],[-0.1107,-0.031,0.0749,0.0291],[-0.1787,-0.023,0.0829,0.0352],[-0.2747,-0.011,0.1549,0.0219],[0.0093,0.001,0.0989,0.0541],[-0.0427,-0.035,0.0709,0.0259],[-0.2107,0.009,0.0949,0.048]],"forearm":[[-0.2049,-0.0015,0.0124,0.0472],[-0.0249,-0.0015,0.0364,0.0489],[-0.0889,-0.0015,0.0364,0.0501],[-0.2129,-0.0015,0.0484,0.0454],[-0.1489,-0.0015,0.0244,0.0487],[0.0111,0.0025,0.0484,0.0354],[-0.1529,-0.0015,0.0444,0.0479],[-0.0649,-0.0015,0.0364,0.0501],[-0.1129,-0.0015,0.0324,0.0496],[0.0071,-0.0135,0.0484,0.0352],[-0.1889,-0.0015,0.0484,0.0454],[-0.1169,-0.0015,0.0404,0.0494],[-0.0009,0.0105,0.0444,0.0396],[-0.0569,0.0105,0.0444,0.042],[-0.1969,-0.0015,0.0124,0.0474],[-0.1129,0.0145,0.0524,0.0366],[-0.0369,-0.0015,0.0364,0.0494],[-0.0489,0.0105,0.0444,0.0421]],"wrist1":[[-0.0002,0.0141,-0.0017,0.0431],[-0.0002,-0.0179,-0.0177,0.0434],[-0.0002,0.0061,-0.0217,0.0436],[-0.0002,-0.0259,0.0063,0.036],[0.0118,-0.0299,0.0023,0.0317],[-0.0122,-0.0299,0.0023,0.0312],[0.0158,-0.0019,-0.0377,0.0278],[-0.0162,-0.0019,-0.0377,0.0274],[-0.0002,-0.0339,0.0143,0.028],[-0.0002,0.0101,-0.0217,0.0436],[0.0038,-0.0419,0.0183,0.02]],"wrist2":[[-0.0002,-0.0106,-0.0034,0.044],[-0.0002,0.0174,-0.0034,0.0438],[-0.0042,0.0254,0.0046,0.0372],[-0.0002,-0.0186,0.0006,0.0382],[0.0078,0.0254,-0.0114,0.036],[0.0118,0.0334,0.0086,0.029],[-0.0122,0.0334,-0.0074,0.0292],[0.0078,-0.0026,-0.0114,0.0362],[-0.0282,0.0014,-0.0314,0.0156],[-0.0082,0.0374,0.0166,0.0249],[-0.0202,0.0454,-0.0194,0.0172]],"wrist3":[[-0.0077,0.0064,-0.0217,0.032],[0.0043,-0.0096,-0.0217,0.032],[0.0083,0.0064,-0.0217,0.032],[-0.0077,-0.0096,-0.0217,0.0311],[0.0123,-0.0016,-0.0217,0.031],[0.0003,0.0104,-0.0217,0.032],[-0.0117,-0.0016,-0.0217,0.0316],[-0.0197,0.0144,-0.0057,0.0176]]};
const ESLAB = ['base', 'shoulder', 'upperarm', 'forearm', 'wrist1', 'wrist2', 'wrist3'];
const G_NOM = ['la base', 'el hombro', 'el brazo', 'el antebrazo', 'la muñeca 1', 'la muñeca 2', 'la muñeca 3', 'el cuerpo de la pinza', 'un dedo de la pinza', 'un dedo de la pinza', 'lo que lleva la pinza'];
const LIM = [[-2 * PI, 2 * PI], [-2 * PI, 2 * PI], [-PI, PI], [-2 * PI, 2 * PI], [-2 * PI, 2 * PI], [-Infinity, Infinity]]; // joint_limits.yaml del UR3e
const ACC_MAX = 3; // rad/s² a velocidad 100 % [SUPUESTO]: el yaml del UR3e no fija aceleraciones
const PESO_J = [1, 1, 1, 0.7, 0.7, 0.4]; // las muñecas mueven menos masa: cuestan menos en el planificador
const NC_MAX = 48; // esferas máximas del objeto que lleva la pinza
const ADY = new Set(['0-1', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '6-8', '6-9', '7-8', '7-9', '8-9', '7-10', '8-10', '9-10']);
const COL = { listo: false };


// Esferas de la pinza RG2 en el marco de cada pieza: el cuerpo no se mueve; dedos y puntas siguen la apertura
function defPinza() {
  const d = [];
  d.push({ o: pinza.g, x: 0, y: 0, z: 0.011, r: 0.037, g: 7 }); // cambiador rápido
  for (const x of [-0.016, 0.016]) for (const z of [0.035, 0.06, 0.085, 0.11]) d.push({ o: pinza.g, x, y: 0, z, r: 0.029, g: 7 });
  pinza.dedos.forEach((f, k) => {
    for (const y of [-0.0102, 0, 0.0102]) for (let i = 0; i < 6; i++) d.push({ o: f.f, x: -f.s * 0.002, y, z: 0.0054 + 0.0108 * i, r: 0.010, g: 8 + k });
    for (const y of [-0.0108, 0, 0.0108]) for (let i = 0; i < 4; i++) d.push({ o: f.tip, x: -f.s * 0.002, y, z: -0.003 + 0.00525 * (2 * i + 1), r: 0.011, g: 8 + k });
  });
  return d;
}
const _cacheP = new Map();
function esferasPinza(w) { // en el marco de tool0 (la pinza va atornillada a la brida)
  const key = Math.round(w * 1000); if (_cacheP.has(key)) return _cacheP.get(key);
  const w0 = pinza.w; pinza.setApertura(w); pinza.g.updateMatrixWorld(true);
  const inv = pinza.g.matrixWorld.clone().invert(); const v = new THREE.Vector3(); const out = new Float64Array(COL.def.length * 4);
  COL.def.forEach((s, i) => { v.set(s.x, s.y, s.z).applyMatrix4(s.o.matrixWorld).applyMatrix4(inv); out.set([v.x, v.y, v.z, s.r], i * 4); });
  pinza.setApertura(w0); pinza.g.updateMatrixWorld(true); _cacheP.set(key, out); return out;
}
// Esferas de un objeto suelto, en el marco que se pida (matriz inversa del marco de referencia)
function esferasObjeto(obj, invRef) {
  obj.updateMatrixWorld(true); const out = []; const v = new THREE.Vector3();
  const add = (o, x, y, z, r) => { v.set(x, y, z).applyMatrix4(o.matrixWorld); if (invRef) v.applyMatrix4(invRef); out.push(v.x, v.y, v.z, r); };
  const pz = piezas.find(p => p.obj === obj);
  if (pz) { add(obj, 0, 0, 0, pz.F.r); return out; }
  add(obj, 0, 0, 0.008, 0.016); // plato: centro, anillo interior y ala
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; add(obj, 0.032 * Math.cos(a), 0.032 * Math.sin(a), 0.008, 0.017); }
  for (let i = 0; i < 10; i++) { const a = i * PI / 5; add(obj, 0.066 * Math.cos(a), 0.066 * Math.sin(a), 0.016, 0.016); }
  for (const c of obj.children) { const p2 = piezas.find(p => p.obj === c); if (p2) add(c, 0, 0, 0, p2.F.r); }
  return out;
}
function cargaDe(obj) { robot.tool0.updateMatrixWorld(true); return new Float64Array(esferasObjeto(obj, robot.tool0.matrixWorld.clone().invert())); }

function iniciarColision() {
  COL.def = defPinza();
  const loc = [], grp = [];
  ESLAB.forEach((n, g) => { for (const s of ESF_UR[n]) { loc.push(...s); grp.push(g); } });
  COL.n0 = grp.length; COL.nP = COL.def.length; COL.N = COL.n0 + COL.nP;
  for (const s of COL.def) grp.push(s.g); for (let i = 0; i < NC_MAX; i++) grp.push(10);
  COL.loc = new Float64Array((COL.N + NC_MAX) * 4); COL.loc.set(loc);
  COL.grp = Int8Array.from(grp); COL.X = new Float64Array(grp.length * 4);
  COL.ini = []; COL.fin = []; for (let g = 0; g <= 10; g++) { COL.ini[g] = grp.indexOf(g); COL.fin[g] = grp.lastIndexOf(g) + 1; }
  // Pares de esferas que no se comprueban: grupos contiguos y pares que se tocan en posturas reales del robot o casi siempre
  // (son solapes del modelo junto a las articulaciones, no choques). Es lo que hace el asistente de MoveIt con la matriz de colisiones permitidas.
  const N = COL.N; COL.des = new Uint8Array(N * N); const cuenta = new Uint16Array(N * N);
  const seguras = [[0, -PI / 2, 0, -PI / 2, 0, 0], [0, 0, 0, 0, 0, 0], [0, -PI / 2, PI / 2, -PI / 2, -PI / 2, 0], [0, -1.9, 1.9, -1.57, -1.57, 0]]; // posturas reales sin choque
  const marcar = (q, w, contar) => { colocar(q, w, null); const X = COL.X; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const gi = COL.grp[i], gj = COL.grp[j]; if (gi === gj) continue; const dx = X[i * 4] - X[j * 4], dy = X[i * 4 + 1] - X[j * 4 + 1], dz = X[i * 4 + 2] - X[j * 4 + 2], rr = X[i * 4 + 3] + X[j * 4 + 3]; if (dx * dx + dy * dy + dz * dz < rr * rr) { if (contar) cuenta[i * N + j]++; else COL.des[i * N + j] = 1; } } };
  for (const q of seguras) for (const w of [0, 0.06, 0.11]) marcar(q, w, false);
  const r = aleat(31); const M = 600;
  for (let k = 0; k < M; k++) marcar([0, 1, 2, 3, 4, 5].map(i => (i === 2 ? 0.95 : 1) * PI * (2 * r() - 1)), 0.06, true);
  for (let i = 0; i < N * N; i++) if (cuenta[i] > 0.9 * M) COL.des[i] = 1;
  // pares de grupos que sí se comprueban y, dentro de cada uno, sus pares de esferas
  COL.pg = [];
  for (let a = 0; a <= 9; a++) for (let b = a + 1; b <= 9; b++) {
    if (ADY.has(`${a}-${b}`)) continue; const pares = [];
    for (let i = COL.ini[a]; i < COL.fin[a]; i++) for (let j = COL.ini[b]; j < COL.fin[b]; j++) if (!COL.des[i * N + j]) pares.push(i, j);
    if (pares.length) COL.pg.push({ a, b, pares: Int16Array.from(pares) });
  }
  COL.desactivados = COL.des.reduce((s, v) => s + v, 0);
  COL.listo = true;
}
// Coloca todas las esferas para una postura q (marco base_link). Devuelve cuántas hay activas.
// kin: la cinemática del brazo (la del robot activo, CIN; el brazo «otro» usa la nominal, T1.4)
function colocar(q, w, carga, kin = CIN) {
  const Ls = kin.fkLinks(q); COL.loc.set(esferasPinza(w), COL.n0 * 4);
  let nC = 0; if (carga) { nC = Math.min(carga.length / 4, NC_MAX); COL.loc.set(carga.subarray(0, nC * 4), COL.N * 4); }
  const n = COL.N + nC, Lc = COL.loc, X = COL.X, G = COL.grp;
  for (let i = 0; i < n; i++) {
    const g = G[i], k = i * 4, x = Lc[k], y = Lc[k + 1], z = Lc[k + 2];
    if (g === 0) { X[k] = x; X[k + 1] = y; X[k + 2] = z; }
    else { const T = g <= 6 ? Ls[g - 1] : Ls[6]; X[k] = T[0] * x + T[1] * y + T[2] * z + T[3]; X[k + 1] = T[4] * x + T[5] * y + T[6] * z + T[7]; X[k + 2] = T[8] * x + T[9] * y + T[10] * z + T[11]; }
    X[k + 3] = Lc[k + 3];
  }
  // esfera envolvente de cada grupo, para descartar rápido los pares lejanos
  const B = COL.bs || (COL.bs = new Float64Array(11 * 4));
  for (let g = 0; g <= 10; g++) {
    const a = COL.ini[g], e = g === 10 ? n : COL.fin[g]; if (a < 0 || e <= a) { B[g * 4 + 3] = -1; continue; }
    let cx = 0, cy = 0, cz = 0; for (let i = a; i < e; i++) { cx += X[i * 4]; cy += X[i * 4 + 1]; cz += X[i * 4 + 2]; } const m = e - a; cx /= m; cy /= m; cz /= m;
    let R = 0; for (let i = a; i < e; i++) R = Math.max(R, Math.hypot(X[i * 4] - cx, X[i * 4 + 1] - cy, X[i * 4 + 2] - cz) + X[i * 4 + 3]);
    B[g * 4] = cx; B[g * 4 + 1] = cy; B[g * 4 + 2] = cz; B[g * 4 + 3] = R;
  }
  COL.nAct = n; COL.nC = nC; return n;
}

// Obstáculos en el marco base_link: mesa, cajas, platos, fruta, bandeja, persona, cámaras y el otro robot.
// Pasan del mundo a base_link con marco() (traslación y giro de la base, T1.4); con el nominal, la misma resta que antes.
let _obsCache = { key: '', lista: null }, _otroCache = { key: '', lista: null };
function obstaculos() {
  const key = `${VERSION_ESCENA}|${L.robot}|${ROB.id}|${simT.toFixed(4)}`; if (_obsCache.key === key) return _obsCache.lista;
  const mb = marco(), o = [];
  const esf = (x, y, z, r, tag, m, blando) => { const p = mb.aBase(x, y, z); o.push({ t: 1, x: p[0], y: p[1], z: p[2], r, tag, m, blando, R: r }); };
  const cap = (a, c, r, tag, m) => { const pa = mb.aBase(a.x, a.y, a.z), pc = mb.aBase(c.x, c.y, c.z); const ax = pa[0], ay = pa[1], az = pa[2], cx = pc[0], cy = pc[1], cz = pc[2]; o.push({ t: 2, ax, ay, az, cx, cy, cz, r, tag, m, x: (ax + cx) / 2, y: (ay + cy) / 2, z: (az + cz) / 2, R: r + Math.hypot(cx - ax, cy - ay, cz - az) / 2 }); };
  const obb = (cxw, cyw, czw, hx, hy, hz, yaw, tag, m) => { const p = mb.aBase(cxw, cyw, czw), yb = mb.yawABase(yaw); o.push({ t: 3, x: p[0], y: p[1], z: p[2], hx, hy, hz, c: Math.cos(yb), s: Math.sin(yb), tag, m, R: Math.hypot(hx, hy, hz) }); };
  { // tablero: sus ejes son los del mundo; en base_link giran −yaw de la base. El giro solo se añade si lo hay: todos los
    // campos de un obstáculo entran en la semilla del RRT (RNG.semillaPlan) y con el nominal no debe cambiar (I8)
    const p = mb.aBase(0, 0, MESA.h), yb = mb.yawABase(0), mesa = { t: 0, x: p[0], y: p[1], z: p[2], hx: MESA.w / 2, hy: MESA.d / 2, tag: 'mesa', m: 0.004, R: 9 };
    if (yb !== 0) Object.assign(mesa, { giro: true, c: Math.cos(yb), s: Math.sin(yb) }); o.push(mesa); }
  if (L.caja.on) for (const k of ['1', '2']) { const cj = OBJ['caja' + k]; if (!cj.visible) continue; obb(cj.position.x, cj.position.y, MESA.h + L.caja.h / 2, CAJA_LADO / 2, CAJA_LADO / 2, L.caja.h / 2, cj.rotation.z, 'caja:plato' + k, 0.002); }
  const v = new THREE.Vector3();
  for (const pk of ['plato1', 'plato2']) { const P = OBJ[pk]; if (P.parent === pinza.tcp || !P.visible) continue; const e = esferasObjeto(P, null); const enBandeja = P.parent === bandeja; for (let i = 0; i < e.length; i += 4) esf(e[i], e[i + 1], e[i + 2], e[i + 3], 'plato:' + pk, 0.002, enBandeja); }
  for (const e of OBS_EXTRA) esf(e[0], e[1], e[2], e[3], e[4], 0.002, false);
  for (const pz of piezas) if (!pz.usada && !pz.enPinza) { pz.obj.getWorldPosition(v); esf(v.x, v.y, v.z, pz.F.r * 0.9, 'pieza:' + pz.id, 0.003, true); }
  bandeja.updateMatrixWorld(true); { const c = new THREE.Vector3(0, 0, -0.006).applyMatrix4(bandeja.matrixWorld); obb(c.x, c.y, c.z, BAND.d / 2 + 0.008, BAND.w / 2 + 0.008, 0.009, bandeja.rotation.z, 'bandeja', 0.004); }
  persona.updateMatrixWorld(true); const pw = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(persona.matrixWorld);
  for (const s of [-1, 1]) cap(pw(0, s * 0.1, 0.1), pw(0, s * 0.1, 0.8), 0.07, 'persona', 0.03);
  cap(pw(0, 0, 0.97), pw(0, 0, 1.38), 0.17, 'persona', 0.03); { const h = pw(0, 0, 1.63); esf(h.x, h.y, h.z, 0.12, 'persona', 0.03); }
  for (let k = 0; k < 4; k++) { const m = brazos[k]; const d = new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion); const l = m.scale.y / 2; const a = m.position.clone().addScaledVector(d, -l), c = m.position.clone().addScaledVector(d, l); if (k % 2) { c.addScaledVector(d, -0.03); cap(a, c, 0.03, 'manos', 0.005); } else cap(a, c, 0.035, 'persona', 0.03); }
  for (const k in CAMS) { const R = CAMS[k]; R.cam.updateMatrixWorld(true); for (const [z, r] of [[0.008, 0.032], [-0.02, 0.022]]) { const p = new THREE.Vector3(0, 0, z).applyMatrix4(R.cam.matrixWorld); esf(p.x, p.y, p.z, r, 'camara:' + k, 0.01); } for (const s of R.seg) { const d = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quaternion); const l = s.scale.y / 2; cap(s.position.clone().addScaledVector(d, -l), s.position.clone().addScaledVector(d, l), 0.0115, 'camara:' + k, 0.01); } esf(R.codo.position.x, R.codo.position.y, R.codo.position.z, 0.03, 'camara:' + k, 0.01); esf(R.clamp.position.x, R.clamp.position.y, R.clamp.position.z, 0.045, 'camara:' + k, 0.005); }
  if (otro && otro.root.visible) { const ob = otro.root.position; const kq = `${ob.x}|${ob.y}|${otro.q.join(',')}`; if (_otroCache.key !== kq) { colocar(otro.q, 0.06, null, KIN.nominal); const l = []; for (let i = 0; i < COL.N; i++) l.push(COL.X[i * 4] + ob.x, COL.X[i * 4 + 1] + ob.y, COL.X[i * 4 + 2] + MESA.h, COL.X[i * 4 + 3]); _otroCache = { key: kq, lista: l }; } const l = _otroCache.lista; for (let i = 0; i < l.length; i += 4) esf(l[i], l[i + 1], l[i + 2], l[i + 3], 'robot A', 0.01); }
  _obsCache = { key, lista: o }; return o;
}
const NOM_OBS = t => t === 'mesa' ? 'la mesa' : t.startsWith('caja') ? 'una caja' : t.startsWith('plato') ? 'un plato' : t.startsWith('pieza') ? 'una pieza de fruta' : t === 'bandeja' ? 'la bandeja' : t === 'manos' ? 'las manos de la persona' : t === 'persona' ? 'la persona' : t.startsWith('camara') ? `la cámara ${t.split(':')[1]} o su brazo` : 'el robot A';

function distObs(o, x, y, z) { // distancia del punto al obstáculo (negativa = dentro)
  if (o.t === 1) return Math.hypot(x - o.x, y - o.y, z - o.z) - o.r;
  if (o.t === 2) { const ux = o.cx - o.ax, uy = o.cy - o.ay, uz = o.cz - o.az; const l2 = ux * ux + uy * uy + uz * uz; let t = l2 > 0 ? ((x - o.ax) * ux + (y - o.ay) * uy + (z - o.az) * uz) / l2 : 0; t = clamp(t, 0, 1); return Math.hypot(x - o.ax - ux * t, y - o.ay - uy * t, z - o.az - uz * t) - o.r; }
  if (o.t === 3) { const dx = x - o.x, dy = y - o.y, lx = dx * o.c + dy * o.s, ly = -dx * o.s + dy * o.c, lz = z - o.z; const qx = Math.abs(lx) - o.hx, qy = Math.abs(ly) - o.hy, qz = Math.abs(lz) - o.hz; const fuera = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)); return fuera > 0 ? fuera : Math.max(qx, qy, qz); }
  return 1;
}
// ¿Choca la postura q? ctx: w (apertura), carga (esferas de lo que lleva), permitir (etiquetas de obstáculos que puede tocar),
// conBlandos (fruta y platos de la bandeja también cuentan), sinEntorno, sinAuto. Devuelve null o la descripción del choque.
function choqueEn(q, ctx = {}) {
  if (!COL.listo) return null;
  const obs = ctx.sinEntorno ? null : (ctx.obst || obstaculos()); // antes de colocar: obstaculos() puede usar el mismo búfer para el robot A
  const carga = ctx.carga === undefined ? D.carga : ctx.carga; const n = colocar(q, ctx.w ?? pinza.w, carga); const X = COL.X, G = COL.grp, B = COL.bs;
  const lejos = (a, b) => { const dx = B[a * 4] - B[b * 4], dy = B[a * 4 + 1] - B[b * 4 + 1], dz = B[a * 4 + 2] - B[b * 4 + 2], rr = B[a * 4 + 3] + B[b * 4 + 3]; return dx * dx + dy * dy + dz * dz > rr * rr; };
  if (!ctx.sinAuto) {
    for (const pg of COL.pg) { if (lejos(pg.a, pg.b)) continue; const P = pg.pares; for (let k = 0; k < P.length; k += 2) { const i = P[k] * 4, j = P[k + 1] * 4; const dx = X[i] - X[j], dy = X[i + 1] - X[j + 1], dz = X[i + 2] - X[j + 2], rr = X[i + 3] + X[j + 3]; if (dx * dx + dy * dy + dz * dz < rr * rr) return { tipo: 'auto', a: pg.a, b: pg.b, p: [(X[i] + X[j]) / 2, (X[i + 1] + X[j + 1]) / 2, (X[i + 2] + X[j + 2]) / 2] }; } }
    if (n > COL.N) for (let i = COL.N; i < n; i++) for (let j = 0; j < COL.fin[6]; j++) { const a = i * 4, c = j * 4; const dx = X[a] - X[c], dy = X[a + 1] - X[c + 1], dz = X[a + 2] - X[c + 2], rr = X[a + 3] + X[c + 3]; if (dx * dx + dy * dy + dz * dz < rr * rr) return { tipo: 'auto', a: 10, b: G[j], p: [X[a], X[a + 1], X[a + 2]] }; }
  }
  if (obs) {
    const perm = ctx.permitir || [];
    for (const o of obs) {
      if (o.blando && !ctx.conBlandos) continue; if (perm.length && perm.some(t => o.tag === t || (t.endsWith('*') && o.tag.startsWith(t.slice(0, -1))))) continue;
      for (let g = 2; g <= 10; g++) { // descarte por grupos
        if (B[g * 4 + 3] < 0) continue; const ga = COL.ini[g], ge = g === 10 ? n : COL.fin[g];
        if (o.t !== 0) { const dx = B[g * 4] - o.x, dy = B[g * 4 + 1] - o.y, dz = B[g * 4 + 2] - o.z, lim = o.R + B[g * 4 + 3] + o.m; if (dx * dx + dy * dy + dz * dz > lim * lim) continue; }
        else if (B[g * 4 + 2] - B[g * 4 + 3] > o.m) continue;
      for (let i = ga; i < ge; i++) {
        const k = i * 4, x = X[k], y = X[k + 1], z = X[k + 2], r = X[k + 3];
        if (o.t === 0) { const dx = x - o.x, dy = y - o.y, lx = o.giro ? dx * o.c + dy * o.s : dx, ly = o.giro ? -dx * o.s + dy * o.c : dy; if (Math.abs(lx) < o.hx && Math.abs(ly) < o.hy && z - r < o.m) return { tipo: 'entorno', a: G[i], b: o.tag, p: [x, y, z - r] }; continue; }
        const dx = x - o.x, dy = y - o.y, dz = z - o.z, lim = o.R + r + o.m; if (dx * dx + dy * dy + dz * dz > lim * lim) continue; // descarte rápido
        if (distObs(o, x, y, z) < r + o.m) return { tipo: 'entorno', a: G[i], b: o.tag, p: [x, y, z] };
      }
      }
    }
  }
  return null;
}
// Holgura mínima (m) de una postura: contra sí mismo y contra el entorno no permitido. Sirve para elegir posturas con margen.
function holguraTotal(q, ctx = {}) {
  const obs = ctx.sinEntorno ? null : (ctx.obst || obstaculos()); const carga = ctx.carga === undefined ? D.carga : ctx.carga; const n = colocar(q, ctx.w ?? pinza.w, carga); const X = COL.X; let m = Infinity;
  for (const pg of COL.pg) { const P = pg.pares; for (let k = 0; k < P.length; k += 2) { const i = P[k] * 4, j = P[k + 1] * 4; m = Math.min(m, Math.hypot(X[i] - X[j], X[i + 1] - X[j + 1], X[i + 2] - X[j + 2]) - X[i + 3] - X[j + 3]); } }
  if (obs) { const perm = ctx.permitir || []; for (const o of obs) { if (o.blando || o.t === 0 || perm.some(t => o.tag === t || (t.endsWith('*') && o.tag.startsWith(t.slice(0, -1))))) continue; for (let i = COL.ini[2]; i < n; i++) { const k = i * 4; m = Math.min(m, distObs(o, X[k], X[k + 1], X[k + 2]) - X[k + 3] - o.m); } } }
  return m;
}
function textoChoque(c) { return c.tipo === 'auto' ? `${G_NOM[c.a]} con ${G_NOM[c.b]}` : `${G_NOM[c.a]} con ${NOM_OBS(c.b)}`; }
function ctxDe(o = {}) { return { w: o.w ?? pinza.w, carga: o.carga === undefined ? D.carga : o.carga, permitir: o.permitir, conBlandos: o.conBlandos, sinEntorno: o.sinEntorno, sinAuto: o.sinAuto }; }
function enLimites(q) { for (let i = 0; i < 6; i++) { if (q[i] >= LIM[i][0] && q[i] <= LIM[i][1]) continue; const alt = q[i] - Math.sign(q[i]) * 2 * PI; if (alt >= LIM[i][0] && alt <= LIM[i][1]) q[i] = alt; else return null; } return q; }

// Tramo articular libre: se comprueba cada 1,4° como máximo (a 0,5 m del eje son 12 mm, menos que cualquier obstáculo)
function tramoLibre(a, b, ctx) {
  let m = 0; for (let i = 0; i < 6; i++) m = Math.max(m, Math.abs(b[i] - a[i])); const n = Math.max(1, Math.ceil(m / 0.025)); const q = new Array(6);
  for (let k = 1; k <= n; k++) { const t = k / n; for (let i = 0; i < 6; i++) q[i] = a[i] + (b[i] - a[i]) * t; if (choqueEn(q, ctx)) return false; }
  return true;
}
const distJ = (a, b) => { let s = 0; for (let i = 0; i < 6; i++) s += PESO_J[i] * (a[i] - b[i]) ** 2; return Math.sqrt(s); };
// RRT-Connect (el planificador por defecto de MoveIt con OMPL) seguido de atajos aleatorios
function rrtConnect(qa, qb, ctx, rnd, holgura, iter) {
  const lo = [], hi = []; for (let i = 0; i < 6; i++) { lo[i] = Math.max(LIM[i][0], Math.min(qa[i], qb[i]) - holgura); hi[i] = Math.min(LIM[i][1], Math.max(qa[i], qb[i]) + holgura); }
  const PASO = 0.25; let A = [{ q: qa, p: -1 }], B = [{ q: qb, p: -1 }], invertido = false;
  const cercano = (T, q) => { let m = Infinity, k = 0; for (let i = 0; i < T.length; i++) { const d = distJ(T[i].q, q); if (d < m) { m = d; k = i; } } return [k, m]; };
  const extender = (T, q) => { const [k, d] = cercano(T, q); const qn = d > PASO ? T[k].q.map((v, i) => v + (q[i] - v) * PASO / d) : q.slice(); if (!tramoLibre(T[k].q, qn, ctx)) return [-1, false]; T.push({ q: qn, p: k }); return [T.length - 1, d <= PASO]; };
  const camino = (T, k) => { const c = []; while (k >= 0) { c.push(T[k].q); k = T[k].p; } return c; };
  for (let it = 0; it < iter; it++) {
    const qr = lo.map((l, i) => l + rnd() * (hi[i] - l));
    const [ka] = extender(A, qr);
    if (ka >= 0) { let kb = -1, llego = false; do { [kb, llego] = extender(B, A[ka].q); } while (kb >= 0 && !llego); if (kb >= 0 && llego) { let c1 = camino(A, ka).reverse(), c2 = camino(B, kb); c2.shift(); let ruta = c1.concat(c2); if (invertido) ruta.reverse(); return ruta; } }
    [A, B] = [B, A]; invertido = !invertido;
  }
  return null;
}
function atajar(ruta, ctx, rnd) {
  for (let it = 0; it < 80 && ruta.length > 2; it++) { const i = Math.floor(rnd() * (ruta.length - 2)), j = i + 2 + Math.floor(rnd() * (ruta.length - i - 2)); if (j < ruta.length && tramoLibre(ruta[i], ruta[j], ctx)) ruta.splice(i + 1, j - i - 1); }
  return ruta;
}
// Perfil de movimiento con el que planifica el gemelo; entra en la semilla (D5). Hoy solo existe «gemelo»: el campo
// `perfil` del layout aún no tiene efecto (T1.1). T1.6 pondrá aquí el perfil de la petición.
const PERFIL_PLAN = 'gemelo';
// Semilla por petición (T1.2, D5, I6): hash de la entrada canónica del plan (src/rng.js) con los mismos valores por
// defecto que choqueEn. La misma petición da el mismo plan, se calcule en el orden que se calcule.
function semillaDe(qa, qb, ctx) {
  return RNG.semillaPlan({ qa, qb, w: ctx.w ?? pinza.w, carga: ctx.carga === undefined ? D.carga : ctx.carga, obst: ctx.sinEntorno ? null : (ctx.obst || obstaculos()),
    permitir: ctx.permitir, conBlandos: ctx.conBlandos, sinEntorno: ctx.sinEntorno, sinAuto: ctx.sinAuto, perfil: PERFIL_PLAN });
}
function planificar(qa, qb, ctx) {
  if (D.sinPlanificador || tramoLibre(qa, qb, ctx)) return { ruta: [qa, qb], plan: false };
  if (choqueEn(qb, ctx)) return null;
  const rnd = RNG.aleat(semillaDe(qa, qb, ctx)); // una sola semilla: si con ella no hay camino, no hay plan (sin reintentos)
  for (const [h, it] of [[PI / 2, 1500], [PI, 3000]]) { const r = rrtConnect(qa, qb, ctx, rnd, h, it); if (r) return { ruta: atajar(r, ctx, rnd), plan: true }; }
  return null;
}
// Reparto del tiempo: perfil suave con la velocidad articular del UR3e (escalada) y aceleración limitada
function duracion(ruta, factor) {
  let S = 0, maxRec = 0; const acum = [0], rec = [0, 0, 0, 0, 0, 0];
  for (let k = 1; k < ruta.length; k++) { let d = 0; for (let i = 0; i < 6; i++) { const dq = Math.abs(ruta[k][i] - ruta[k - 1][i]); d = Math.max(d, dq / VMAX[i]); rec[i] += dq; } S += d; acum.push(S); }
  maxRec = Math.max(...rec); const v = D.vel * factor;
  return { S, acum, T: Math.max(0.25, 1.5 * S / v, Math.sqrt(6 * maxRec / (ACC_MAX * v))) };
}
async function ejecutar(ruta, factor = 1, Tmin = 0) {
  const { S, acum, T: T0 } = duracion(ruta, factor); const T = Math.max(T0, Tmin); D.motion += T;
  await anim(T, s => {
    const u = smooth(s) * S; let k = 1; while (k < acum.length - 1 && acum[k] < u) k++;
    const a = ruta[k - 1], b = ruta[k], f = acum[k] > acum[k - 1] ? clamp((u - acum[k - 1]) / (acum[k] - acum[k - 1]), 0, 1) : 1;
    robot.setQ(a.map((v, i) => v + (b[i] - v) * f));
  });
}
// Movimiento articular planificado (como move_group con OMPL)
async function moveJ(qT, factor = 1, opts = {}, desc = 'el destino') {
  const ctx = ctxDe({ ...opts, conBlandos: true }); const q0 = robot.q.slice();
  if (choqueEn(q0, ctx) || choqueEn(qT, ctx)) ctx.conBlandos = false; // si sale o llega tocando fruta o un plato de la bandeja, esos no cuentan
  // si sale en contacto (acaba de soltar algo), se permite separarse de eso, como el adaptador FixStartStateCollision de MoveIt
  ctx.permitir = [...(ctx.permitir || [])]; for (let k = 0; k < 3; k++) { const c = choqueEn(q0, ctx); if (!c || c.tipo !== 'entorno') break; ctx.permitir.push(c.b); }
  const r = planificar(q0, qT, ctx);
  if (!r) throw new FalloDemo(`No encuentro una trayectoria sin colisiones hasta ${desc}.`, 'fallo', { causa: 'sin_trayectoria', q: qT });
  if (r.plan) { D.planes++; $('#dPlanes').textContent = D.planes; publicar('/movimiento/plan [PROPUESTA]', ['accion'], { destino: desc, planificador: 'RRTConnect + atajos', puntos_de_paso: r.ruta.length - 2 }); }
  await ejecutar(r.ruta, factor);
}
// Ruta cartesiana por puntos de paso {p, yaw} (computeCartesianPath): IK cada 4 mm sin saltos de configuración ni choques
function rutaCartesiana(q0, puntos, opts) {
  const ctx = ctxDe(opts); const ruta = [q0.slice()]; let largo = 0; for (let k = 1; k < puntos.length; k++) largo += puntos[k].p.distanceTo(puntos[k - 1].p); let hecho = 0;
  const mal = (f, extra = {}) => ({ fallo: f, pct: Math.round(100 * hecho / Math.max(largo, 1e-6)), ...extra });
  for (let s = 1; s < puntos.length; s++) {
    const a = puntos[s - 1], b = puntos[s], d = a.p.distanceTo(b.p), dy = angDiff(b.yaw, a.yaw); const n = Math.max(1, Math.ceil(Math.max(d / 0.004, Math.abs(dy) / 0.02)));
    for (let k = 1; k <= n; k++) {
      const prev = ruta[ruta.length - 1], t = k / n; const q = ikTCP(a.p.clone().lerp(b.p, t), a.yaw + dy * t, prev, opts);
      if (!q) { const pp = a.p.clone().lerp(b.p, t); const q2 = ikTCP(pp, a.yaw + dy * t, prev, { ...opts, sinColision: true }); const c = q2 && choqueEn(q2, ctx); return mal(c ? `chocaría ${textoChoque(c)}` : 'se sale del alcance', { causa: causaDe(c) || (q2 ? 'alcance' : causaSinIK(pp, a.yaw + dy * t, opts)), choque: c || null, q: q2 || prev, p: pp }); }
      if (Math.max(...q.map((v, i) => Math.abs(v - prev[i]))) > 0.15) { const q2 = ikTCP(a.p.clone().lerp(b.p, t), a.yaw + dy * t, prev, { ...opts, sinColision: true }); const c = q2 && Math.max(...q2.map((v, i) => Math.abs(v - prev[i]))) <= 0.15 && choqueEn(q2, ctx); const m = mal(c ? `chocaría ${textoChoque(c)}` : 'la postura salta (cerca de una singularidad)', { causa: causaDe(c) || 'singularidad', choque: c || null, q: q2 || q, p: a.p.clone().lerp(b.p, t) }); m.dbg = { prev: prev.map(v => +(v * R2D).toFixed(1)), q: q.map(v => +(v * R2D).toFixed(1)), p: a.p.clone().lerp(b.p, t), seg: s, n: puntos.length }; return m; }
      if (!tramoLibre(prev, q, ctx)) { const c = choqueEn(q, ctx) || choqueEn(prev.map((v, i) => (v + q[i]) / 2), ctx); return mal(c ? `chocaría ${textoChoque(c)}` : 'chocaría en el camino', { causa: causaDe(c) || 'choque', choque: c, q, p: a.p.clone().lerp(b.p, t) }); }
      ruta.push(q); hecho += d / n;
    }
  }
  return { ruta, largo };
}
// TCP (en el mundo) y ejes de la herramienta para una postura, con la cinemática activa y marco() (T1.4)
function tcpDeQ(q, w = pinza.w) { const T = CIN.fk(q), tz = pinza.tcpZ(w), mb = marco(); const z = mb.vecAMundo(T[2], T[6], T[10]), x = mb.vecAMundo(T[0], T[4], T[8]); return { p: baseAMundo(T[3] + T[2] * tz, T[7] + T[6] * tz, T[11] + T[10] * tz), ejeZ: new THREE.Vector3(z[0], z[1], z[2]), ejeX: new THREE.Vector3(x[0], x[1], x[2]) }; }
function yawDeQ(q, horiz) { const t = tcpDeQ(q); return horiz ? Math.atan2(t.ejeZ.y, t.ejeZ.x) : Math.atan2(t.ejeX.y, t.ejeX.x); }
// Movimiento recto de la pinza; si no es posible, movimiento articular planificado (salvo opts.estricto)
async function moveL(p, yaw, opts = {}, desc = 'un punto') {
  const p0 = tcpMundo(); let y0 = yawDeQ(robot.q, !!opts.horiz); if (!opts.horiz && opts.sym !== false && Math.abs(angDiff(yaw, y0)) > PI / 2) y0 += PI; // pinza vertical: yaw y yaw+180° son la misma
  const r = rutaCartesiana(robot.q, [{ p: p0, yaw: y0 }, { p, yaw }], opts); const f = factorPersona(p);
  if (!r.ruta) {
    if (opts.estricto) throw new FalloDemo(`La pinza no puede ir en línea recta hasta ${desc}: ${r.fallo} (llega al ${r.pct} %).`, 'fallo', { causa: r.causa, choque: r.choque, q: r.q, punto: r.p || p, pct: r.pct, horiz: !!opts.horiz });
    const qF = ikTCP(p, yaw, robot.q, opts); if (!qF) throw new FalloDemo(`No llego a ${desc} sin chocar: ${donde(p)}`, 'fallo', diagnosticarPunto(p, yaw, opts));
    D.sustituidos++; pintarCalidad(); publicar('/movimiento/aviso [PROPUESTA]', ['accion'], { tramo: desc, recta_hasta: `${r.pct} %`, motivo: r.fallo, se_usa: 'movimiento articular planificado' });
    return moveJ(qF, f, opts, desc);
  }
  await ejecutar(r.ruta, f, 1.5 * r.largo / (0.5 * D.vel * f)); // 0,5 m/s de TCP al 100 %
}
// Transporte del plato nivelado: sube, gira alrededor de la base a altura constante y baja, sin inclinar el plato
function rutaNivelada(q0, p1, yaw1, opts) {
  const t0 = tcpDeQ(q0); const p0 = t0.p, yaw0 = Math.atan2(t0.ejeZ.y, t0.ejeZ.x); const b = BASES[L.robot]; let ult = null;
  const pol = p => ({ r: Math.hypot(p.x - b.x, p.y - b.y), f: Math.atan2(p.y - b.y, p.x - b.x) });
  // Variantes, de la más simple a la más rebuscada: el giro de la pinza respecto al radio puede pasar por tangencial (aleja la muñeca
  // del eje de la base, donde está la singularidad del hombro) y el camino puede abrirse hacia fuera
  const VAR = [[null, 0], [null, 0.06]];
  for (const extra of [0.05, 0.12]) for (const [mid, bulto] of VAR) {
    const zs = Math.max(p0.z, p1.z) + extra; const A = pol(p0), B = pol(p1); const df = angDiff(B.f, A.f); const rel0 = angDiff(yaw0, A.f), rel1 = angDiff(yaw1, B.f);
    const rel = t => mid === null ? rel0 + angDiff(rel1, rel0) * t : t < 0.3 ? rel0 + angDiff(mid, rel0) * t / 0.3 : t > 0.7 ? mid + angDiff(rel1, mid) * (t - 0.7) / 0.3 : mid;
    const pts = [{ p: p0, yaw: yaw0 }]; const n = Math.max(4, Math.ceil(Math.abs(df) * Math.max(A.r, B.r) / 0.02));
    for (let k = 0; k <= n; k++) { const t = k / n, f = A.f + df * t, r = A.r + (B.r - A.r) * t + bulto * Math.sin(PI * t); pts.push({ p: new THREE.Vector3(b.x + r * Math.cos(f), b.y + r * Math.sin(f), zs), yaw: f + rel(t) }); }
    pts.push({ p: p1, yaw: yaw1 });
    const r = rutaCartesiana(q0, pts, opts); if (r.ruta) return r; if (!ult || r.pct > ult.pct) ult = r;
  }
  return ult;
}
async function moveNivelado(p1, yaw1, opts, desc) {
  const r = rutaNivelada(robot.q, p1, yaw1, opts);
  if (!r.ruta) throw new FalloDemo(`No puedo llevar el plato nivelado hasta ${desc}: ${r.fallo} (llega al ${r.pct} %).`);
  publicar('/movimiento/transporte [PROPUESTA]', ['accion'], { destino: desc, restriccion: 'plato nivelado', largo_mm: mm(r.largo) });
  const f = factorPersona(p1); await ejecutar(r.ruta, f, 1.5 * r.largo / (0.5 * D.vel * f));
}
// Servo para seguir la bandeja: cada paso limita la velocidad de cada articulación y comprueba choques (parada de protección)
function servo(qObj, dt, ctx, desc) {
  const q = robot.q.slice(); for (let i = 0; i < 6; i++) { const l = VMAX[i] * D.vel * dt; q[i] += clamp(qObj[i] - q[i], -l, l); }
  const c = choqueEn(q, ctx); if (c) throw new FalloDemo(`Parada de protección ${desc}: ${textoChoque(c)}.`, 'abort', { causa: causaDe(c), choque: c, q, punto: tcpMundo(), horiz: true });
  robot.setQ(q);
}
// Vigilancia independiente de autocolisiones en lo que se ve (debe quedarse en 0)
function vigilarAuto() {
  const c = choqueEn(robot.q, { sinEntorno: true });
  if (c && !D.autoAhora) { D.autocol++; $('#dAuto').textContent = D.autocol; pintarCalidad(); marcaChoque.position.copy(baseAMundo(c.p[0], c.p[1], c.p[2])); marcaChoque.visible = true; D.marcaHasta = simT + 2; publicar('/seguridad/autocolision [PROPUESTA]', ['segur'], { fase: D.estado, entre: textoChoque(c) }); }
  D.autoAhora = !!c;
}
// Volúmenes de colisión visibles (capa de la escena)
const volCol = []; const volMat = new THREE.MeshBasicMaterial({ color: '#2f8fd0', transparent: true, opacity: 0.22, depthWrite: false });
function crearVolumenes() {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  ESLAB.forEach((n, g) => { const padre = g === 0 ? robot.root : robot.j[g - 1]; for (const s of ESF_UR[n]) { const m = new THREE.Mesh(geo, volMat); m.position.set(s[0], s[1], s[2]); m.scale.setScalar(s[3]); m.visible = false; padre.add(m); volCol.push(m); } });
  for (const s of COL.def) { const m = new THREE.Mesh(geo, volMat); m.position.set(s.x, s.y, s.z); m.scale.setScalar(s.r); m.visible = false; s.o.add(m); volCol.push(m); }
}
function pintarCalidad() {
  const el = $('#dCalidad'); if (!el) return;
  el.innerHTML = `<dt>Autocolisiones vistas</dt><dd><span class="pill ${D.autocol ? 'bad' : 'ok'}" id="dAuto">${D.autocol}</span></dd><dt>Trayectorias planificadas (RRT)</dt><dd id="dPlanes">${D.planes}</dd><dt>Rectas sustituidas por articular</dt><dd id="dSust">${D.sustituidos}</dd><dt>Modelo de colisión</dt><dd>${COL.N || 0} esferas · ${COL.desactivados || 0} pares permitidos</dd>`;
}
