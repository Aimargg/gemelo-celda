// Unitario de la semilla por petición (src/rng.js, sin navegador): FNV-1a de la entrada canónica del plan (T1.2, D5, I6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const RNG = createRequire(import.meta.url)('../../src/rng.js');
const { fnv1a, semillaPlan, canonico, aleat } = RNG;

// Una petición con los cuatro tipos de obstáculo que genera obstaculos() (mesa, esfera, cápsula y caja orientada)
const PET = () => ({
  qa: [0.1, -1.6, 1.2, -1.1, -1.57, 0.3], qb: [1.3, -1.2, 0.9, -1.3, -1.57, -0.2], w: 0.06, carga: null,
  permitir: ['plato:plato1', 'caja:plato1'], conBlandos: true, sinEntorno: false, sinAuto: false, perfil: 'gemelo',
  obst: [
    { t: 0, x: -0.434, y: -0.269, z: 0, hx: 0.59, hy: 0.415, tag: 'mesa', m: 0.004, R: 9 },
    { t: 1, x: 0.1, y: -0.2, z: 0.05, r: 0.016, tag: 'plato:plato2', m: 0.002, blando: false, R: 0.016 },
    { t: 2, ax: 0.8, ay: 0.1, az: -0.6, cx: 0.8, cy: 0.1, cz: 0.04, r: 0.07, tag: 'persona', m: 0.03, x: 0.8, y: 0.1, z: -0.28, R: 0.39 },
    { t: 3, x: 0.3, y: -0.3, z: 0.05, hx: 0.05, hy: 0.05, hz: 0.05, c: 0.8, s: 0.6, tag: 'caja:plato1', m: 0.002, R: 0.0866 },
  ],
});

test('FNV-1a de 32 bits: vectores de referencia de la especificación', () => {
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(fnv1a('a'), 0xe40c292c);
  assert.equal(fnv1a('foobar'), 0xbf9cf968);
});

test('la misma petición da la misma semilla, también en otra ejecución de Node', () => {
  const s = semillaPlan(PET());
  assert.equal(semillaPlan(PET()), s);
  assert.equal(semillaPlan(JSON.parse(JSON.stringify(PET()))), s);
  const ruta = fileURLToPath(new URL('../../src/rng.js', import.meta.url));
  const otra = execFileSync(process.execPath, ['-e', `const R = require(${JSON.stringify(ruta)}); process.stdout.write(String(R.semillaPlan(${JSON.stringify(PET())})))`]).toString();
  assert.equal(+otra, s);
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
});

test('mover un obstáculo 1e-5 cambia la semilla; 1e-7 (por debajo del redondeo a 1e-6) no', () => {
  const s = semillaPlan(PET());
  for (const [i, k] of [[0, 'x'], [1, 'z'], [2, 'cz'], [3, 's']]) {
    const p = PET(); p.obst[i][k] += 1e-5; assert.notEqual(semillaPlan(p), s, `obstáculo ${i}.${k} + 1e-5`);
    const q = PET(); q.obst[i][k] += 1e-7; assert.equal(semillaPlan(q), s, `obstáculo ${i}.${k} + 1e-7`);
  }
});

test('cambian la semilla: q inicial, objetivo, perfil, apertura, carga, permisos y opciones', () => {
  const s = semillaPlan(PET());
  const variantes = {
    qa: p => { p.qa[3] += 1e-5; }, qb: p => { p.qb[0] -= 1e-5; }, perfil: p => { p.perfil = 'curso'; }, w: p => { p.w = 0.061; },
    carga: p => { p.carga = new Float64Array([0, 0, 0.1, 0.02]); }, permitir: p => { p.permitir = ['plato:plato1']; },
    conBlandos: p => { p.conBlandos = false; }, sinAuto: p => { p.sinAuto = true; }, sinEntorno: p => { p.sinEntorno = true; p.obst = null; },
    obstaculoDeMas: p => { p.obst.push({ ...p.obst[1], x: 0.2 }); }, etiqueta: p => { p.obst[1].tag = 'plato:plato1'; }, blando: p => { p.obst[1].blando = true; },
  };
  const vistas = new Set([s]);
  for (const [nombre, f] of Object.entries(variantes)) { const p = PET(); f(p); const v = semillaPlan(p); assert.notEqual(v, s, nombre); vistas.add(v); }
  assert.equal(vistas.size, Object.keys(variantes).length + 1, 'cada variante da una semilla distinta');
});

test('el orden de los obstáculos y de los permisos no cambia la semilla (no cambia si un tramo choca)', () => {
  const s = semillaPlan(PET());
  const p = PET(); p.obst.reverse(); p.permitir.reverse();
  assert.equal(semillaPlan(p), s);
  assert.equal(canonico(p), canonico(PET()));
});

test('aleat: la misma semilla da la misma serie y semillas distintas, series distintas', () => {
  const serie = (s, n = 50) => { const r = aleat(s); return Array.from({ length: n }, r); };
  const s = semillaPlan(PET());
  assert.deepEqual(serie(s), serie(s));
  assert.notDeepEqual(serie(s), serie(s + 1));
  assert.ok(serie(s, 1000).every(v => v >= 0 && v < 1));
});
