// Unitario de la cinemática por robot (T1.4, D7; src/kin.js y src/datos/calibracion.js, sin navegador):
//  · FK calibrada de cada id frente a tests/fixtures/cinematica/<id>.json (la verdad sacada del xacro del curso, T1.3);
//  · IK refinada (semillas de la IK analítica nominal + Levenberg–Marquardt) en 2000 poses alcanzables por robot;
//  · giro de base_link respecto a world y aviso de calibración sospechosa, sacados de los datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
const KIN = req('../../src/kin.js');
const CAL = req('../../src/datos/calibracion.js');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = id => JSON.parse(fs.readFileSync(path.join(RAIZ, `tests/fixtures/cinematica/${id}.json`), 'utf8'));
const IDS = ['nominal', '203', '204', '205', '206'];

// mulberry32, como en cinematica.test.mjs: semilla fija, test repetible
function rng(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Error de posición (m) y de giro (rad) entre dos transformadas: ángulo de Rₐᵀ·R_b con atan2 (estable cerca de 0)
function errores(A, B) {
  const p = Math.hypot(A[3] - B[3], A[7] - B[7], A[11] - B[11]);
  const M = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M.push(A[r] * B[c] + A[4 + r] * B[4 + c] + A[8 + r] * B[8 + c]);
  const s = Math.hypot(M[7] - M[5], M[2] - M[6], M[3] - M[1]) / 2, co = (M[0] + M[4] + M[8] - 1) / 2;
  return { p, r: Math.atan2(s, co) };
}
const cinematica = id => id === 'nominal' ? KIN.nominal : KIN.calibrada(CAL.robots[id].kinematics);

test('los datos de calibración cubren los cinco ids con su JSON de referencia', () => {
  assert.deepEqual(Object.keys(CAL.robots).sort(), [...IDS].sort());
  for (const id of IDS) assert.equal(REF(id).robot, id);
});

test('T1.4-1: la FK de cada id coincide con su JSON en las 20 configuraciones (≤ 0,01 mm y ≤ 0,001°)', t => {
  for (const id of IDS) {
    const ref = REF(id), K = cinematica(id); let ep = 0, er = 0;
    assert.equal(ref.configuraciones.length, 20, id);
    ref.configuraciones.forEach((q, k) => { const e = errores(K.fk(q), ref.tool0_en_base_link[k]); ep = Math.max(ep, e.p); er = Math.max(er, e.r); });
    t.diagnostic(`${id}: error máximo ${(ep * 1000).toExponential(2)} mm y ${(er * 180 / Math.PI).toExponential(2)}°`);
    assert.ok(ep <= 0.01e-3, `${id}: ${ep * 1000} mm`);
    assert.ok(er * 180 / Math.PI <= 0.001, `${id}: ${er * 180 / Math.PI}°`);
  }
  // el nominal construido con los orígenes de su YAML da lo mismo que KIN.fk (< 1e-6), como comprueba comprobar_kin.js
  const N = KIN.calibrada(CAL.robots.nominal.kinematics);
  for (const q of REF('nominal').configuraciones) assert.ok(Math.max(...N.fk(q).map((v, i) => Math.abs(v - KIN.fk(q)[i]))) < 1e-6);
});

// 2000 poses alcanzables por construcción: q aleatoria en (−π, π]^6 → FK calibrada → IK refinada
function idaYVuelta(id, semilla = 20261115, N = 2000) {
  const K = cinematica(id), r = rng(semilla); let conRama = 0, errPos = 0, errRot = 0, desc = 0, semillas = 0, extra = 0, sinSemilla = 0, malas = 0, devueltas = 0, paresDup = 0;
  const ang = a => Math.atan2(Math.sin(a), Math.cos(a)), mismaPostura = (a, b) => a.every((v, i) => Math.abs(ang(v - b[i])) < 1e-4);
  for (let k = 0; k < N; k++) {
    const q = Array.from({ length: 6 }, () => (r() * 2 - 1) * Math.PI), T = K.fk(q), d = K.ikDetalle(T);
    if (d.sols.length) conRama++; if (!d.semillas) sinSemilla++;
    desc += d.descartadas; semillas += d.semillas; extra += d.extra || 0; errPos = Math.max(errPos, d.errPos); errRot = Math.max(errRot, d.errRot);
    for (const s of d.sols) { const e = errores(K.fk(s), T); if (e.p > KIN.TOL_POS || e.r > KIN.TOL_ROT) malas++; } // cada rama aceptada, comprobada aparte
    devueltas += d.sols.length; d.sols.forEach((a, i) => d.sols.forEach((b, j) => { if (j > i && mismaPostura(a, b)) paresDup++; })); // corrección 4
  }
  return { N, conRama, pct: 100 * conRama / N, errPos, errRot, desc, semillas, extra, sinSemilla, malas, devueltas, paresDup, stats: K.stats };
}

test('T1.4-2: IK refinada en 2000 poses alcanzables: ≥ 99,5 % con alguna rama en 203, 205 y 206; ramas aceptadas ≤ 1e-6 m y 1e-6 rad', t => {
  assert.deepEqual([KIN.TOL_POS, KIN.TOL_ROT], [1e-6, 1e-6]);
  for (const id of ['203', '205', '206', '204']) {
    const r = idaYVuelta(id);
    t.diagnostic(`${id}: ${r.pct.toFixed(2)} % con alguna rama (${r.conRama}/${r.N}); error máximo de las aceptadas ${r.errPos.toExponential(2)} m y ${r.errRot.toExponential(2)} rad; ` +
      `${r.semillas} ramas analíticas + ${r.extra} proyectadas al borde, ${r.desc} descartadas, ${r.stats.duplicadas} duplicadas quitadas; ${r.sinSemilla} poses sin ninguna rama analítica`);
    assert.equal(r.malas, 0, `${id}: ramas aceptadas que no reproducen la pose`);
    assert.ok(r.errPos <= 1e-6 && r.errRot <= 1e-6, `${id}: ${r.errPos} m, ${r.errRot} rad`);
    // el contador se puede leer y cuadra: cada rama probada converge o se descarta
    assert.deepEqual({ semillas: r.stats.semillas, extra: r.stats.extra, descartadas: r.stats.descartadas, llamadas: r.stats.llamadas },
      { semillas: r.semillas, extra: r.extra, descartadas: r.desc, llamadas: r.N }, id);
    assert.equal(r.stats.convergidas + r.stats.descartadas, r.stats.semillas + r.stats.extra, id);
    // ninguna postura sale dos veces (dos soluciones con todas las articulaciones a menos de 1e-4 rad); las quitadas se cuentan
    assert.equal(r.paresDup, 0, `${id}: ${r.paresDup} pares de soluciones duplicadas`);
    assert.equal(r.devueltas, r.stats.convergidas - r.stats.duplicadas, id);
    if (id !== '204') assert.ok(r.pct >= 99.5, `${id}: ${r.pct} %`); // 204: se da la cifra, sin umbral (brief T1.4-T1.5)
  }
});

test('IK refinada: determinista, y una pose sin ninguna rama analítica no tiene semillas', () => {
  const a = idaYVuelta('203', 7, 300), b = idaYVuelta('203', 7, 300);
  assert.deepEqual({ ...a, stats: null }, { ...b, stats: null });
  const K = cinematica('203'), d = K.ikDetalle(KIN.tr(2, 0, 0)); // 2 m: fuera de cualquier UR3e
  assert.deepEqual({ semillas: d.semillas, extra: d.extra, sols: d.sols.length }, { semillas: 0, extra: 0, sols: 0 });
});

test('T1.4-3: con «nominal» la cinemática es la de KIN tal cual (mismas funciones, IK sin refinar)', () => {
  const N = KIN.nominal;
  assert.equal(N.calibrada, false);
  assert.equal(N.fk, KIN.fk); assert.equal(N.fkLinks, KIN.fkLinks); assert.equal(N.ik, KIN.ik); assert.equal(N.manip, KIN.manip);
  assert.equal(N.JO, KIN.JO); assert.equal(N.W3T, KIN.W3T);
});

// Huella de KIN.fk, KIN.ik y KIN.manip en 2000 configuraciones sembradas, bit a bit (FNV-1a de los Float64). El valor fijado
// sale de ejecutar src/kin.js de v9-dev (37910c4), antes de T1.4:
//   git show 37910c4:src/kin.js > /tmp/kin-v9dev.js && node -e "<esta misma función con require('/tmp/kin-v9dev.js')>"
function huellaNominal(K) {
  const r = rng(42), b = new Float64Array(1), u = new Uint8Array(b.buffer); let h = 0x811c9dc5;
  const mete = v => { b[0] = v; for (const x of u) { h ^= x; h = Math.imul(h, 0x01000193) >>> 0; } };
  for (let k = 0; k < 2000; k++) {
    const q = Array.from({ length: 6 }, () => (r() * 2 - 1) * Math.PI); const T = K.fk(q);
    T.forEach(mete); for (const s of K.ik(T)) s.forEach(mete); if (k % 20 === 0) mete(K.manip(q));
  }
  return h.toString(16);
}
test('T1.4-3: KIN.fk, KIN.ik y KIN.manip dan los mismos números que antes de T1.4, bit a bit', () => {
  assert.equal(huellaNominal(KIN), '58dff19f');
});

test('giro de base_link respecto a world: mount_yaw − π de los datos coincide con world_base_link de cada JSON', () => {
  for (const id of IDS) {
    const ref = REF(id), yaw = CAL.robots[id].mount_yaw - Math.PI;
    assert.ok(Math.abs(yaw - ref.world_base_link.individual.rpy[2]) < 1e-9, `${id}: ${yaw} frente a ${ref.world_base_link.individual.rpy[2]}`);
    assert.deepEqual(ref.world_base_link.individual.xyz, [0, 0, 0], id);
  }
  assert.equal(CAL.robots.nominal.mount_yaw - Math.PI, 0); // nominal, 205 y 206: sin giro, exacto
  assert.equal(CAL.robots['205'].mount_yaw - Math.PI, 0);
  assert.equal(CAL.robots['206'].mount_yaw - Math.PI, 0);
});

test('el aviso de calibración sospechosa sale del campo «sospechoso» de los datos, igual que en los JSON', () => {
  for (const id of IDS) assert.equal(CAL.robots[id].sospechoso, REF(id).sospechoso, id);
  assert.deepEqual(IDS.filter(id => CAL.robots[id].sospechoso), ['204']);
});
