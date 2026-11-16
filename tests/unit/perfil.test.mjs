// Unitario de los perfiles de movimiento (src/perfil.js, sin navegador; T1.6, D6): temporización de «curso» y «gemelo»,
// pasos y punto medio de la ruta cartesiana de «curso» y entrada de la semilla del RRT.
// Las cifras esperadas salen de las fórmulas, escritas aquí aparte, no de la salida del gemelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const PERFIL = req('../../src/perfil.js');
const RNG = req('../../src/rng.js');

const D2R = Math.PI / 180;
const VMAX = [180, 180, 180, 360, 360, 360].map(v => v * D2R); // URDF de ur_description, como VMAX del gemelo (SIN VALIDAR)
const q0 = () => [0, 0, 0, 0, 0, 0];
const mover = (q, cambios) => { const r = q.slice(); for (const [i, d] of Object.entries(cambios)) r[i] += d; return r; };
// Trapecio de una articulación partiendo y acabando parada: v máxima, a aceleración
const trap = (d, v, a) => d >= v * v / a ? d / v + v / a : 2 * Math.sqrt(d / a);
// «curso»: v_i = 0,1·vmax_i y a = 5·0,1 rad/s² (joint_limits.yaml del curso y escala 0,1)
const V_CURSO = i => 0.1 * VMAX[i], A_CURSO = 5 * 0.1;
// «gemelo», copiada de duracion() de src/colision.js en v9-dev (892e336), con ACC_MAX = 3
function duracionV9(ruta, vel, factor) {
  let S = 0, maxRec = 0; const acum = [0], rec = [0, 0, 0, 0, 0, 0];
  for (let k = 1; k < ruta.length; k++) { let d = 0; for (let i = 0; i < 6; i++) { const dq = Math.abs(ruta[k][i] - ruta[k - 1][i]); d = Math.max(d, dq / VMAX[i]); rec[i] += dq; } S += d; acum.push(S); }
  maxRec = Math.max(...rec); const v = vel * factor;
  return { S, acum, T: Math.max(0.25, 1.5 * S / v, Math.sqrt(6 * maxRec / (3 * v))) };
}
const dur = (ruta, perfil, vel = 0.25, factor = 1) => PERFIL.duracion(ruta, { perfil, vel, factor, vmax: VMAX });

test('tabla de perfiles: «curso» a escala 0,1 con 5 rad/s²; «gemelo» con 3 rad/s²; sin perfil, la petición falla', () => {
  assert.deepEqual(PERFIL.NOMBRES.sort(), ['curso', 'gemelo']);
  assert.equal(PERFIL.de('curso').escala, 0.1); assert.equal(PERFIL.de('curso').acc, 5);
  assert.deepEqual({ ...PERFIL.de('curso').cart, maxNivel: undefined }, { maxStep: 0.01, tolP: 0.001, tolR: 0.01, maxNivel: undefined });
  assert.equal(PERFIL.de('gemelo').acc, 3); assert.equal(PERFIL.de('gemelo').escala, null);
  for (const p of [undefined, null, '', 'rapido', 'toString']) assert.throws(() => PERFIL.de(p), /sin perfil de movimiento válido/, String(p));
  assert.throws(() => dur([q0(), q0()], undefined), /sin perfil/);
});

test('T1.6-2: 90° de hombro en un tramo: «curso» 5,628 s y «gemelo» 3,545 s (±0,005 s), de las fórmulas', () => {
  const ruta = [q0(), mover(q0(), { 1: Math.PI / 2 })];
  const d = Math.PI / 2;
  const curso = trap(d, V_CURSO(1), A_CURSO); // trapecio: d ≥ v²/a
  assert.ok(d >= V_CURSO(1) ** 2 / A_CURSO, 'el tramo llega a la velocidad máxima');
  const S = d / VMAX[1], v = 0.25, gemelo = Math.max(0.25, 1.5 * S / v, Math.sqrt(6 * d / (3 * v)));
  assert.ok(Math.abs(curso - 5.628) <= 0.005 && Math.abs(gemelo - 3.545) <= 0.005, `fórmulas: ${curso} y ${gemelo}`);
  const c = dur(ruta, 'curso'), g = dur(ruta, 'gemelo');
  assert.ok(Math.abs(c.T - curso) < 1e-12, `curso ${c.T}`); assert.ok(Math.abs(g.T - gemelo) < 1e-12, `gemelo ${g.T}`);
  assert.equal(c.limita, 1, 'limita el hombro');
  // en «curso», ni la velocidad de la demo ni el factor de la persona cambian el tiempo; en «gemelo», sí
  assert.equal(dur(ruta, 'curso', 1, 0.5).T, c.T); assert.notEqual(dur(ruta, 'gemelo', 1, 0.5).T, g.T);
});

test('T1.6-2: un tramo corto en el que el trapecio de «curso» es un triángulo', () => {
  const d = 0.1; // rad de codo: v²/a = (0,1·π)²/0,5 ≈ 0,197 rad > d
  assert.ok(d < V_CURSO(2) ** 2 / A_CURSO);
  const T = dur([q0(), mover(q0(), { 2: -d })], 'curso').T, esperado = 2 * Math.sqrt(d / A_CURSO);
  assert.ok(Math.abs(T - esperado) < 1e-12, `${T} frente a 2·√(d/a) = ${esperado}`);
  assert.ok(Math.abs(T - (d / V_CURSO(2) + V_CURSO(2) / A_CURSO)) > 0.05, 'no es la fórmula del trapecio');
});

test('T1.6-2: en una ruta de tres articulaciones limita la de menor velocidad, sobre su recorrido acumulado', () => {
  // base (180°/s): +0,6 y después −0,4 rad (1,0 rad acumulado); muñeca 1 (360°/s): 1,2 rad; muñeca 3 (360°/s): 0,3 rad
  const a = q0(), b = mover(a, { 0: 0.6, 3: 0.7, 5: 0.3 }), c = mover(b, { 0: -0.4, 3: 0.5 });
  const T = [trap(1.0, V_CURSO(0), A_CURSO), trap(1.2, V_CURSO(3), A_CURSO), trap(0.3, V_CURSO(5), A_CURSO)];
  assert.ok(T[0] > T[1] && T[0] > T[2], `la base es la que más tarda: ${T.map(t => t.toFixed(3))}`);
  assert.ok(1.2 > 1.0, 'aunque la muñeca 1 recorre más radianes');
  const r = dur([a, b, c], 'curso');
  assert.equal(r.limita, 0); assert.ok(Math.abs(r.T - T[0]) < 1e-12, `${r.T} frente a ${T[0]}`);
  assert.ok(Math.abs(r.rec[0] - 1.0) < 1e-12, 'recorrido acumulado de la base');
  assert.deepEqual(r.acum.length, 3, 'un instante por punto de la ruta (sin paradas en los puntos de paso)');
});

test('T1.6-3: «gemelo» da exactamente la temporización de la v9 anterior (rutas al azar)', () => {
  const r = RNG.aleat(12345);
  for (let n = 0; n < 200; n++) {
    const ruta = []; let q = q0(); const pts = 2 + Math.floor(r() * 6);
    for (let k = 0; k < pts; k++) { q = q.map(v => v + (r() - 0.5) * 2 * (r() < 0.2 ? 0 : 1)); ruta.push(q); }
    const vel = 0.1 + 0.9 * r(), factor = r() < 0.5 ? 1 : 0.5;
    const a = dur(ruta, 'gemelo', vel, factor), b = duracionV9(ruta, vel, factor);
    assert.deepEqual({ S: a.S, acum: a.acum, T: a.T }, b);
  }
});

test('T1.6-1: pasos de la ruta cartesiana: «curso» cada 0,01 m de traslación (al menos uno, también si solo gira)', () => {
  for (const d of [0, 0.004, 0.01, 0.05, 0.07, 0.123, 0.4]) {
    const n = PERFIL.pasosTramo('curso', d, 0.7);
    assert.ok(n >= 1 && d / n <= 0.01 + 1e-12, `${d} m en ${n} pasos`);
    assert.equal(n, Math.floor(d / 0.01) + 1, `${d} m`);
    assert.equal(PERFIL.pasosTramo('curso', d, 0), n, 'el giro no cuenta');
  }
  assert.equal(PERFIL.pasosTramo('curso', 0, 1.0), 1, 'solo gira: un paso');
  assert.equal(PERFIL.pasosTramo('gemelo', 0, 1.0), 50, 'gemelo: cada 0,02 rad'); assert.equal(PERFIL.pasosTramo('gemelo', 0.05, 0), 13, 'gemelo: cada 4 mm');
});

// Matriz 4×4 por filas (como KIN.fk): giro θ alrededor de z y traslación p
const T = (th, p) => [Math.cos(th), -Math.sin(th), 0, p[0], Math.sin(th), Math.cos(th), 0, p[1], 0, 0, 1, p[2], 0, 0, 0, 1];
// giro θ alrededor de x (para el TCP a lo largo de z de la herramienta)
const Tx = (th, p) => [1, 0, 0, p[0], 0, Math.cos(th), -Math.sin(th), p[1], 0, Math.sin(th), Math.cos(th), p[2], 0, 0, 0, 1];

test('T1.6-1: desvío del punto medio frente a la interpolación cartesiana entre las dos poses (mm y rad)', () => {
  // posición: el TCP del punto medio articular a 2 mm del punto medio de la recta
  let d = PERFIL.desvioMedio(T(0, [0, 0, 0]), T(0, [0.01, 0, 0]), T(0, [0.005, 0.002, 0]), 0);
  assert.ok(Math.abs(d.dp - 0.002) < 1e-12 && d.dr < 1e-9, JSON.stringify(d));
  // giro: de 0 a 0,2 rad alrededor de z, el punto medio debería estar a 0,1; a 0,13 se aparta 0,03 rad
  d = PERFIL.desvioMedio(T(0, [0, 0, 0]), T(0.2, [0, 0, 0]), T(0.13, [0, 0, 0]), 0);
  assert.ok(Math.abs(d.dr - 0.03) < 1e-9 && d.dp < 1e-12, JSON.stringify(d));
  // el TCP va a lo largo de z de la herramienta: con tz = 0,2 m, un giro de 0,01 rad en x mueve el TCP 2 mm
  d = PERFIL.desvioMedio(Tx(0, [0, 0, 0]), Tx(0, [0, 0, 0]), Tx(0.01, [0, 0, 0]), 0.2);
  assert.ok(Math.abs(d.dp - 0.2 * Math.sin(0.01)) < 1e-6 && Math.abs(d.dr - 0.01) < 1e-9, JSON.stringify(d));
  // cuaternión con w ≈ 0 (giro de π) y el signo opuesto (q y −q son la misma rotación)
  d = PERFIL.desvioMedio(T(Math.PI - 0.1, [0, 0, 0]), T(-Math.PI + 0.1, [0, 0, 0]), T(Math.PI, [0, 0, 0]), 0);
  assert.ok(d.dr < 1e-9, `el punto medio de ±(π − 0,1) es π: ${d.dr}`);
});

// Robot de juguete de una articulación: la IK es lineal en t y el desvío del punto medio crece con el cuadrado del paso,
// como el de una articulación de verdad lejos de una singularidad
const juguete = (k, sinIK = () => false) => ({ ik: (t, qc) => sinIK(t) ? null : [t], desvio: (qa, qb) => ({ dp: k * (qb[0] - qa[0]) ** 2, dr: 0 }) });
const C = PERFIL.TABLA.curso.cart;

test('T1.6-1: punto medio de «curso»: acepta, subdivide hasta maxNivel y corta con lo hecho', () => {
  // dentro de 1 mm: se acepta sin subdividir
  assert.deepEqual(PERFIL.subdividir([0], 0, [1], 1, juguete(0.0009)), { qs: [[1, [1]]] });
  // 4 veces la tolerancia: con un nivel (dos mitades, desvío ÷ 4) basta
  const r1 = PERFIL.subdividir([0], 0, [1], 1, juguete(0.004));
  assert.deepEqual(r1, { qs: [[0.5, [0.5]], [1, [1]]] });
  // con maxNivel niveles: 4^maxNivel veces la tolerancia todavía pasa; un poco más, ya no
  const ok = PERFIL.subdividir([0], 0, [1], 1, juguete(0.001 * 4 ** C.maxNivel * 0.999));
  assert.equal(ok.fallo, undefined); assert.equal(ok.qs.length, 2 ** C.maxNivel); assert.deepEqual(ok.qs.at(-1), [1, [1]]);
  const mal = PERFIL.subdividir([0], 0, [1], 1, juguete(0.001 * 4 ** C.maxNivel * 1.01));
  assert.ok(mal.fallo && mal.fallo.t === 0 && mal.qs.length === 0 && mal.fallo.nivel === C.maxNivel, JSON.stringify(mal.fallo));
  // el desvío solo en los subtramos que acaban más allá de la mitad: se acepta la primera mitad y se corta en t = 0,5
  const f = { ik: t => [t], desvio: (qa, qb) => ({ dp: qb[0] > 0.5 ? 1 : 0, dr: 0 }) };
  const media = PERFIL.subdividir([0], 0, [1], 1, f);
  assert.deepEqual({ qs: media.qs, t: media.fallo.t }, { qs: [[0.5, [0.5]]], t: 0.5 });
  // sin IK en el punto medio: se corta
  const sin = PERFIL.subdividir([0], 0, [1], 1, juguete(0.004, t => Math.abs(t - 0.5) < 1e-12));
  assert.ok(sin.fallo.sinIK && sin.fallo.t === 0 && !sin.qs.length);
  // el giro también cuenta (0,01 rad)
  const giro = PERFIL.subdividir([0], 0, [1], 1, { ik: t => [t], desvio: () => ({ dp: 0, dr: 0.011 }) });
  assert.ok(giro.fallo && giro.fallo.dr === 0.011);
});

test('T1.6-3: la entrada de la semilla de una petición «gemelo» es la de v9-dev; con «curso», otra semilla', () => {
  const PET = { qa: [0.1, -1.6, 1.2, -1.1, -1.57, 0.3], qb: [1.3, -1.2, 0.9, -1.3, -1.57, -0.2], w: 0.06, carga: null, permitir: ['plato:plato1', 'caja:plato1'], conBlandos: true, sinEntorno: false, sinAuto: false,
    obst: [{ t: 0, x: -0.434, y: -0.269, z: 0, hx: 0.59, hy: 0.415, tag: 'mesa', m: 0.004, R: 9 }, { t: 1, x: 0.1, y: -0.2, z: 0.05, r: 0.016, tag: 'plato:plato2', m: 0.002, blando: false, R: 0.016 }] };
  // v9-dev (semillaDe en 892e336) pasaba estos campos con perfil: PERFIL_PLAN = 'gemelo'
  const v9 = RNG.semillaPlan({ ...PET, perfil: 'gemelo' });
  const g = RNG.semillaPlan(PERFIL.entradaSemilla({ ...PET, perfil: 'gemelo' })), c = RNG.semillaPlan(PERFIL.entradaSemilla({ ...PET, perfil: 'curso' }));
  assert.equal(RNG.canonico(PERFIL.entradaSemilla({ ...PET, perfil: 'gemelo' })), RNG.canonico({ ...PET, perfil: 'gemelo' }));
  assert.equal(g, v9); assert.equal(g, 1051553382, 'valor de la semilla con el código de v9-dev');
  assert.notEqual(c, g, 'dos peticiones iguales salvo el perfil dan semillas distintas');
  assert.throws(() => PERFIL.entradaSemilla({ ...PET }), /sin perfil/);
});
