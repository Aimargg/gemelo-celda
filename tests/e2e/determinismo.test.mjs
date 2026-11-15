// Determinismo del planificador (T1.2, D5, I6): la semilla del RRT sale de la petición, no del orden de cálculo.
//  · planificar A, después B y después A da el mismo camino (mismos q) para A y A';
//  · si el RRT no encuentra camino con su semilla, no hay plan: una sola semilla por petición, sin reintento;
//  · a nivel de demo, la matriz de 8 casos en orden inverso da exactamente los registros de matriz-base.json (orden directo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, ensayar } from '../medir.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Cuenta, sin cambiarlas, las llamadas a RNG.semillaPlan y RNG.aleat que hace planificar() (window.__cuenta)
const contar = p => p.evaluate(() => {
  const R = window.__g.RNG; if (R.__contado) return; R.__contado = true; window.__cuenta = { semillas: 0, generadores: 0 };
  const s = R.semillaPlan, a = R.aleat;
  R.semillaPlan = x => { window.__cuenta.semillas++; return s(x); }; R.aleat = x => { window.__cuenta.generadores++; return a(x); };
});
// Planifica la petición k de window.__I6 con una copia de su contexto; devuelve el camino y cuántas semillas gastó
const planificar = (p, k) => p.evaluate(k => {
  const g = window.__g, P = window.__I6[k]; const c0 = { ...window.__cuenta };
  const r = g.planificar(P.qa.slice(), P.qb.slice(), { ...P.ctx });
  return { r: r && { plan: r.plan, ruta: r.ruta.map(q => Array.from(q)) }, semillas: window.__cuenta.semillas - c0.semillas, generadores: window.__cuenta.generadores - c0.generadores };
}, k);

test('I6: planificar A, después B y después A da el mismo camino para A y A\'', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await contar(p);
    // Dos peticiones reales sobre la escena por defecto: de la postura de reposo a la misma con la base girada, con una
    // esfera de prueba en el punto medio del camino recto (en la brida) para que haga falta el RRT
    const pre = await p.evaluate(() => {
      const g = window.__g, qa = g.qReposo(), escena = g.obstaculos().map(o => ({ ...o }));
      const peticion = (dq0, r) => {
        const qb = qa.slice(); qb[0] += dq0; const T = g.KIN.fk(qa.map((v, i) => (v + qb[i]) / 2));
        return { qa, qb, ctx: { w: 0.06, carga: null, conBlandos: true, obst: [...escena, { t: 1, x: T[3], y: T[7], z: T[11], r, tag: 'prueba', m: 0.002, R: r }] } };
      };
      window.__I6 = { A: peticion(1.2, 0.06), B: peticion(-1.0, 0.05) };
      const libre = (q, P) => g.choqueEn(q, { ...P.ctx }) === null;
      return Object.fromEntries(Object.entries(window.__I6).map(([k, P]) => [k, { qa: libre(P.qa, P), qb: libre(P.qb, P), n: P.ctx.obst.length }]));
    });
    assert.deepEqual({ A: [pre.A.qa, pre.A.qb], B: [pre.B.qa, pre.B.qb] }, { A: [true, true], B: [true, true] }, 'inicio y objetivo libres');
    assert.ok(pre.A.n > 10, 'la petición lleva los obstáculos de la escena');
    const A = await planificar(p, 'A'), B = await planificar(p, 'B'), A2 = await planificar(p, 'A');
    assert.equal(A.r?.plan, true, 'A necesita el RRT (el camino recto choca con la esfera)');
    assert.equal(B.r?.plan, true, 'B necesita el RRT');
    assert.ok(A.r.ruta.length > 2 && B.r.ruta.length > 2);
    assert.notDeepEqual(B.r.ruta, A.r.ruta, 'A y B son peticiones distintas');
    assert.deepEqual(A2.r.ruta, A.r.ruta, 'A\' tiene los mismos q que A');
    assert.deepEqual([A.semillas, B.semillas, A2.semillas, A.generadores], [1, 1, 1, 1]);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('sin camino con su semilla, planificar da «sin plan» (null) sin probar otra semilla', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await contar(p);
    // Objetivo libre pero encerrado: una jaula de esferas a 0,5 mm del brazo y de la pinza en el objetivo (grupos 2–9, los
    // que se comprueban contra el entorno), sin las que tocan el brazo en el objetivo o en el inicio. Cualquier paso del
    // RRT desde el objetivo choca, así que el RRT agota sus iteraciones.
    const pre = await p.evaluate(() => {
      const g = window.__g, C = g.COL(); const qb = g.qReposo(), qa = qb.slice(); qa[0] -= Math.PI;
      const brazo = q => { g.choqueEn(q, { sinEntorno: true, w: 0.06, carga: null }); const out = []; for (let i = 0; i < C.N; i++) if (C.grp[i] >= 2) out.push([C.X[i * 4], C.X[i * 4 + 1], C.X[i * 4 + 2], C.X[i * 4 + 3]]); return out; };
      const eb = brazo(qb), ea = brazo(qa), RS = 0.02, HOL = 0.0005, dirs = [];
      for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) { const n = Math.hypot(x, y, z); dirs.push([x / n, y / n, z / n]); }
      const toca = (c, lista) => lista.some(e => Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]) < e[3] + RS);
      const jaula = [];
      for (const e of eb) for (const d of dirs) { const k = e[3] + RS + HOL, c = [e[0] + d[0] * k, e[1] + d[1] * k, e[2] + d[2] * k]; if (!toca(c, eb) && !toca(c, ea)) jaula.push({ t: 1, x: c[0], y: c[1], z: c[2], r: RS, tag: 'jaula', m: 0, R: RS }); }
      window.__I6 = { J: { qa, qb, ctx: { w: 0.06, carga: null, conBlandos: true, obst: jaula } } };
      const P = window.__I6.J; return { qa: g.choqueEn(qa, { ...P.ctx }), qb: g.choqueEn(qb, { ...P.ctx }), n: jaula.length };
    });
    assert.deepEqual({ qa: pre.qa, qb: pre.qb }, { qa: null, qb: null }, 'inicio y objetivo libres (si no, planificar saldría antes del RRT)');
    assert.ok(pre.n > 0, `jaula de ${pre.n} esferas`);
    const J1 = await planificar(p, 'J'), J2 = await planificar(p, 'J');
    assert.deepEqual(J1, { r: null, semillas: 1, generadores: 1 }, 'sin plan, con una sola semilla');
    assert.deepEqual(J2, J1, 'otra vez lo mismo: no hay reintento con otra semilla');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('I6 en la demo: la matriz en orden inverso da los mismos registros, campo a campo, que matriz-base.json', { timeout: 600000 }, async () => {
  const BASE = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), 'utf8')).casos;
  const s = await abrir(srv.url);
  try {
    const res = (await ensayar(s.page, [...CASOS_MATRIZ].reverse())).reverse().map(({ ms, ...r }) => r);
    assert.deepEqual(res, BASE); // todos los campos: t_sim, t_mov, errores, planes, pausas…
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

// Una excepción dentro de ensayo() (aquí, desde cfg.hasta, que ensayo() llama en cada paso) llega a quien llamó y no deja
// el banco puesto: D.banco y D.sinRender vuelven a false, la demo se cancela y bucle() vuelve a avanzar. Después, un
// ensayo da exactamente el primer caso de matriz-base.json.
test('una excepción dentro de ensayo() no deja el banco de pruebas puesto', { timeout: 300000 }, async () => {
  const BASE_M = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), 'utf8')).casos;
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(async c => {
      const g = window.__g; let visto = null;
      const hasta = d => { if (d.paso >= 2) { visto = { banco: d.banco, activo: d.activo }; throw new Error('fallo de prueba en hasta'); } return false; };
      try { await g.ensayo({ ...c, hasta }); return { lanzo: false }; } catch (e) {
        return { lanzo: e.message, visto, despues: { banco: g.D.banco, sinRender: g.D.sinRender, activo: g.D.activo, playing: g.D.playing, estado: g.D.estado }, simT: g.simT() };
      }
    }, CASOS_MATRIZ[0]);
    assert.deepEqual({ lanzo: r.lanzo, visto: r.visto, despues: r.despues },
      { lanzo: 'fallo de prueba en hasta', visto: { banco: true, activo: true }, despues: { banco: false, sinRender: false, activo: false, playing: false, estado: 'REPOSO' } });
    await p.waitForFunction(t => window.__g.simT() > t + 0.2, r.simT, { timeout: 30000, polling: 50 }); // bucle() vuelve a avanzar simT
    const [d] = await ensayar(p, [CASOS_MATRIZ[0]]);
    const { ms, ...sinMs } = d;
    assert.deepEqual(sinMs, BASE_M[0], 'el ensayo siguiente da el primer caso de la matriz, campo a campo');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
