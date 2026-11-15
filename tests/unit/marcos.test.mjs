// Unitario de la conversión world ↔ base_link (T1.5, I7; KIN.marcoBase de src/kin.js, sin navegador): para cada robot,
// un punto conocido de la mesa pasado a base_link coincide con lo que da world_base_link de tests/fixtures/cinematica/<id>.json.
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
// Bases (A/B) y mesa del gemelo, leídas de src/app.js para no copiarlas a mano
const APP = fs.readFileSync(path.join(RAIZ, 'src/app.js'), 'utf8');
const BASES = Object.fromEntries([...APP.match(/const BASES = \{(.*)\};/)[1].matchAll(/([AB]): \{ x: (-?[\d.]+), y: (-?[\d.]+) \}/g)].map(m => [m[1], { x: +m[2], y: +m[3] }]));
const MESA = Object.fromEntries([...APP.match(/const MESA = \{(.*)\};/)[1].matchAll(/(\w+): ([\d.]+)/g)].map(m => [m[1], +m[2]]));
// Puntos conocidos de la mesa (mundo del gemelo, z sobre el suelo): el centro y las cuatro esquinas del tablero, a 0 y a 20 cm
const PUNTOS = [[0, 0, 0], [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0.2], [0.3, -0.6, 0.2]].map(([u, v, h]) => [u * MESA.w / 2, v * MESA.d / 2, MESA.h + h]);
// Lo que da el JSON: world → base_link es T (pose de base_link en world, origen en la base); p_base = Rᵀ · (p − base)
function porJSON(T, b, p) { const d = [p[0] - b.x, p[1] - b.y, p[2] - MESA.h]; return [0, 1, 2].map(c => T[c] * d[0] + T[4 + c] * d[1] + T[8 + c] * d[2]); }

test('las bases y la mesa salen de src/app.js', () => {
  assert.deepEqual(Object.keys(BASES), ['A', 'B']); assert.equal(MESA.h, 0.76); assert.equal(PUNTOS.length, 6);
});

test('T1.5-1: para cada id, un punto de la mesa en base_link coincide con world_base_link de su JSON (±0,5 mm)', t => {
  for (const id of ['nominal', '203', '204', '205', '206']) for (const lado of ['A', 'B']) {
    const T = REF(id).world_base_link.individual.T, b = BASES[lado], m = KIN.marcoBase(b.x, b.y, MESA.h, CAL.robots[id].mount_yaw - Math.PI);
    let peor = 0;
    for (const p of PUNTOS) {
      const a = m.aBase(...p), j = porJSON(T, b, p); peor = Math.max(peor, Math.hypot(a[0] - j[0], a[1] - j[1], a[2] - j[2]));
      const w = m.aMundo(...a); assert.ok(Math.hypot(w[0] - p[0], w[1] - p[1], w[2] - p[2]) < 1e-12, `${id} ${lado}: ida y vuelta`);
    }
    if (lado === 'B') t.diagnostic(`${id}: diferencia máxima con el JSON ${(peor * 1000).toExponential(2)} mm`);
    assert.ok(peor <= 0.5e-3, `${id} ${lado}: ${peor * 1000} mm`);
  }
});

test('el giro de un ángulo y de un vector sigue al de los puntos; sin giro, la conversión es una resta exacta', () => {
  const b = BASES.B, m = KIN.marcoBase(b.x, b.y, MESA.h, CAL.robots['203'].mount_yaw - Math.PI);
  // un punto a 10 cm de la base en la dirección «a» del mundo queda en la dirección yawABase(a) de base_link
  for (const a of [0, 1, -2.5]) { const p = m.aBase(b.x + 0.1 * Math.cos(a), b.y + 0.1 * Math.sin(a), MESA.h); assert.ok(Math.abs(Math.atan2(p[1], p[0]) - Math.atan2(Math.sin(m.yawABase(a)), Math.cos(m.yawABase(a)))) < 1e-12); }
  const v = m.vecAMundo(1, 0, 0); assert.ok(Math.abs(Math.atan2(v[1], v[0]) - (CAL.robots['203'].mount_yaw - Math.PI)) < 1e-12, 'eje x de base_link en el mundo');
  const n = KIN.marcoBase(b.x, b.y, MESA.h, 0), p = [0.1234567, -0.7654321, 0.9];
  assert.deepEqual(n.aBase(...p), [p[0] - b.x, p[1] - b.y, p[2] - MESA.h]);
  assert.deepEqual(n.aMundo(...p), [p[0] + b.x, p[1] + b.y, p[2] + MESA.h]);
});
