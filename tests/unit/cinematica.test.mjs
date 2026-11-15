// Unitario de la cinemática (src/kin.js, sin navegador): ida y vuelta FK → IK con un RNG sembrado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const KIN = createRequire(import.meta.url)('../../src/kin.js');

// mulberry32: RNG pequeño y determinista (la semilla fija hace que el test sea repetible)
function rng(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const errPose = (A, B) => Math.max(...A.map((v, i) => Math.abs(v - B[i])));

// Una pasada: N configuraciones aleatorias en (-π, π]^6 → FK → IK → FK de cada solución
function idaYVuelta(semilla, N = 2000) {
  const r = rng(semilla); const filas = []; let fallos = 0, invalidas = 0, nsol = 0, peor = 0;
  for (let k = 0; k < N; k++) {
    const q = Array.from({ length: 6 }, () => (r() * 2 - 1) * Math.PI);
    const T = KIN.fk(q); const S = KIN.ik(T); nsol += S.length;
    let mejor = Infinity;
    for (const s of S) { const e = errPose(KIN.fk(s), T); if (e > 1e-6) invalidas++; mejor = Math.min(mejor, e); }
    if (!(mejor < 1e-6)) fallos++; else peor = Math.max(peor, mejor);
    filas.push(S.length + ':' + S.map(s => s.map(v => v.toFixed(9)).join(',')).join(';'));
  }
  return { N, fallos, invalidas, nsol, peor, filas };
}

test('IK analítica: 2000 idas y vueltas sembradas con error < 1e-6 y 0 soluciones inválidas', () => {
  const r = idaYVuelta(20261115);
  assert.equal(r.fallos, 0, `${r.fallos} configuraciones sin ninguna solución con error < 1e-6`);
  assert.equal(r.invalidas, 0, `${r.invalidas} soluciones devueltas que no reproducen la pose`);
  assert.ok(r.peor < 1e-6, `peor error ${r.peor}`);
  assert.ok(r.nsol / r.N >= 1, `media de soluciones ${r.nsol / r.N}`);
});

test('IK analítica: el mismo resultado en dos ejecuciones con la misma semilla', () => {
  const a = idaYVuelta(7), b = idaYVuelta(7);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.filas, idaYVuelta(8).filas, 'otra semilla debería dar otras configuraciones');
});

test('Relación URDF ↔ DH constante (T_urdf = PRE · T_dh) y tool0 en q = 0 (caracterización v8)', () => {
  const r = rng(3);
  for (let k = 0; k < 50; k++) {
    const q = Array.from({ length: 6 }, () => (r() * 2 - 1) * Math.PI);
    assert.ok(errPose(KIN.mul(KIN.PRE, KIN.fkDH(q)), KIN.fk(q)) < 1e-9);
  }
  const T0 = KIN.fk([0, 0, 0, 0, 0, 0]);
  assert.deepEqual([T0[3], T0[7], T0[11]].map(v => +v.toFixed(6)), [0.45675, 0.22315, 0.0665]); // −(A2+A3), D4+D6, D1−D5
});
