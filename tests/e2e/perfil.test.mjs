// Perfil de movimiento en la página (T1.6, D6): selector y panel, arranque en contacto en «curso», determinismo (I6) en
// «curso» y cachés de planes por perfil.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes } from '../navegador.mjs';

const V8 = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/escenas-v8/1-defecto.json'), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const pulsado = p => p.evaluate(() => [...document.querySelectorAll('#segPerfil button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.v));

test('T1.6-4 y T1.6-5: una escena nueva usa «curso» y una v8, «gemelo», en el selector; el panel dice el perfil y que no es TOTG', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    assert.deepEqual(await pulsado(p), ['curso']); assert.equal(await p.evaluate(() => window.__g.L().perfil), 'curso');
    const nota = await p.textContent('#perfilNota');
    assert.match(nota, /^Perfil de la escena: «curso», como MoveIt 2 en la simulación del curso/);
    assert.match(nota, /Explorar \(arrastrar objetos y «Calcular trayectorias»\) usa siempre «gemelo»/);
    assert.match(nota, /Tiempos aproximados: trapecio por articulación sin paradas en los puntos de paso, no la parametrización TOTG de MoveIt \[DT4/);
    assert.match(await p.textContent('#dPerfilNota'), /la velocidad no cambia los movimientos planificados ni las rectas, que van a escala 0,1/);
    await p.evaluate(c => window.__g.abrirCodigo(c), V8.codigo);
    await p.waitForFunction(() => window.__g.L().perfil === 'gemelo', null, { timeout: 30000, polling: 50 });
    assert.deepEqual(await pulsado(p), ['gemelo']);
    assert.match(await p.textContent('#perfilNota'), /^Perfil de la escena: «gemelo», el de la v8/);
    // el selector cambia el perfil de la escena sin mover nada ni recalcular
    const antes = await p.evaluate(() => { window.__vAntes = window.__g.CACHE_PLAN.gemelo.plato1; return JSON.stringify({ ...window.__g.L(), perfil: null }); });
    await p.click('#segPerfil [data-v="curso"]');
    assert.deepEqual(await pulsado(p), ['curso']);
    const despues = await p.evaluate(() => ({ l: JSON.stringify({ ...window.__g.L(), perfil: null }), misma: window.__g.CACHE_PLAN.gemelo.plato1 === window.__vAntes, calc: window.__g.CALC.activo, perfil: window.__g.L().perfil, alDia: window.__g.planesAlDia() }));
    assert.deepEqual(despues, { l: antes, misma: true, calc: false, perfil: 'curso', alDia: true }, 'nada se mueve ni se recalcula');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.6-1: en «curso», arrancar en contacto falla con START_STATE_IN_COLLISION; un permitir explícito lo deja salir; «gemelo» se separa', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(() => {
      const g = window.__g, pl = g.CACHE_PLAN.gemelo.plato1.pl; // agarre del plato 1: los dedos abrazan el ala
      const o = { w: 0.03, carga: null, horiz: true, flip: pl.flip, pitch: pl.pitch, minZ: -0.3 };
      const toca = g.choqueEn(pl.q, { w: 0.03, carga: null, conBlandos: false });
      const intento = perfil => { try { const r = g.prepararMoveJ(pl.q, pl.qPre, { ...o, perfil }, 'la prueba'); return { ok: true, plan: r.plan, n: r.ruta.length }; } catch (e) { return { ok: false, msg: e.message, causa: e.info && e.info.causa, b: e.info && e.info.choque && e.info.choque.b }; } };
      const conPermiso = (() => { try { const r = g.prepararMoveJ(pl.q, pl.qPre, { ...o, perfil: 'curso', permitir: ['plato:plato1'] }, 'la prueba'); return { ok: true, n: r.ruta.length }; } catch (e) { return { ok: false, msg: e.message }; } })();
      let sinPerfil; try { g.prepararMoveJ(pl.q, pl.qPre, o, 'la prueba'); sinPerfil = 'sin error'; } catch (e) { sinPerfil = e.message; }
      return { toca: toca && toca.b, curso: intento('curso'), gemelo: intento('gemelo'), conPermiso, sinPerfil };
    });
    assert.equal(r.toca, 'plato:plato1', 'la postura de agarre toca el plato (la caja no es blanda)');
    assert.equal(r.curso.ok, false); assert.equal(r.curso.causa, 'arranque_contacto'); assert.equal(r.curso.b, 'plato:plato1');
    assert.match(r.curso.msg, /^MoveIt rechazaría el arranque en contacto \(START_STATE_IN_COLLISION\): .+ con un plato, al ir hacia la prueba\.$/);
    assert.equal(r.conPermiso.ok, true, `con permitir explícito sale: ${r.conPermiso.msg || ''}`);
    assert.equal(r.gemelo.ok, true, 'gemelo se separa (FixStartStateCollision)');
    assert.match(r.sinPerfil, /sin perfil de movimiento válido/, 'una petición sin perfil falla');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.6-6 (I6 en «curso»): planificar A, B, A\' y los planes de la escena A, B, A\' dan A = A\'; el perfil cambia la semilla', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    // RRT: dos peticiones reales de la escena (como en determinismo.test.mjs) con el perfil «curso»
    const rrt = await p.evaluate(() => {
      const g = window.__g, qa = g.qReposo(), escena = g.obstaculos().map(o => ({ ...o }));
      const peticion = (dq0, r, perfil) => { const qb = qa.slice(); qb[0] += dq0; const T = g.KIN.fk(qa.map((v, i) => (v + qb[i]) / 2)); return { qa, qb, ctx: { w: 0.06, carga: null, conBlandos: true, perfil, obst: [...escena, { t: 1, x: T[3], y: T[7], z: T[11], r, tag: 'prueba', m: 0.002, R: r }] } }; };
      const P = { A: peticion(1.2, 0.06, 'curso'), B: peticion(-1.0, 0.05, 'curso'), G: peticion(1.2, 0.06, 'gemelo') };
      const R = g.RNG, s0 = R.semillaPlan; const semillas = []; R.semillaPlan = x => { const v = s0(x); semillas.push(v); return v; };
      const plan = k => { const r = g.planificar(P[k].qa.slice(), P[k].qb.slice(), { ...P[k].ctx }); return r && { plan: r.plan, ruta: r.ruta.map(q => Array.from(q)) }; };
      try { return { A: plan('A'), B: plan('B'), A2: plan('A'), G: plan('G'), semillas }; } finally { R.semillaPlan = s0; }
    });
    assert.equal(rrt.A?.plan, true, 'A necesita el RRT'); assert.equal(rrt.B?.plan, true);
    assert.notDeepEqual(rrt.B.ruta, rrt.A.ruta); assert.deepEqual(rrt.A2.ruta, rrt.A.ruta, 'A\' = A');
    assert.equal(rrt.semillas.length, 4); assert.equal(rrt.semillas[2], rrt.semillas[0]);
    assert.notEqual(rrt.semillas[3], rrt.semillas[0], 'A con «gemelo» y con «curso»: semillas distintas');
    // Planes de la escena con «curso»: A (por defecto), B (plato 1 a 3 cm) y A' otra vez
    const firma = () => p.evaluate(() => {
      const g = window.__g, r = v => +(+v).toFixed(9), qs = q => q && Array.from(q, r);
      return { alDia: g.planesAlDiaDe('curso'), planes: Object.fromEntries(['plato1', 'plato2'].map(k => { const pl = g.CACHE_PLAN.curso[k]?.pl; return [k, pl && { yaw: r(pl.yaw), q: qs(pl.q), qL: qs(pl.cadena?.qL), q2: qs(pl.cadena?.pc2?.q), ruta: pl.cadena?.r?.ruta?.map(qs), fallo: pl.cadena?.fallo?.fallo || null }]; })) };
    });
    const calcular = async () => { await p.evaluate(() => window.__g.calcularPlanes('curso')); await esperarPlanes(p); return firma(); };
    const mover = dx => p.evaluate(dx => { const g = window.__g; g.L().plato1.x += dx; g.aplicarLayout(); }, dx);
    const A = await calcular(); await mover(0.03); const B = await calcular(); await mover(-0.03); const A2 = await calcular();
    assert.deepEqual([A.alDia, B.alDia, A2.alDia], [true, true, true]);
    assert.notDeepEqual(B.planes, A.planes); assert.deepEqual(A2, A, 'A\' = A en «curso»');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.6-7: calcular con «curso» no invalida ni recalcula lo de «gemelo», y al revés', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    // al cargar se calcula con «gemelo» (explorar); se guardan las entradas de su caché
    await p.evaluate(() => { const C = window.__g.CACHE_PLAN; window.__g0 = { ...C.gemelo }; });
    assert.equal(await p.evaluate(() => window.__g.planesAlDiaDe('curso')), false, 'al cargar no se calcula «curso»');
    await p.evaluate(() => window.__g.calcularPlanes('curso')); await esperarPlanes(p);
    let r = await p.evaluate(() => { const g = window.__g, C = g.CACHE_PLAN; window.__c0 = { ...C.curso }; return { g: g.planesAlDia(), c: g.planesAlDiaDe('curso'), misma: ['plato1', 'plato2'].every(k => C.gemelo[k] === window.__g0[k]), bar: document.getElementById('calcBar').hidden }; });
    assert.deepEqual(r, { g: true, c: true, misma: true, bar: true }, 'calcular «curso» no toca «gemelo»');
    // explorar otra vez sin tocar nada: no se recalcula
    await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p);
    r = await p.evaluate(() => { const C = window.__g.CACHE_PLAN; return { g: ['plato1', 'plato2'].every(k => C.gemelo[k] === window.__g0[k]), c: ['plato1', 'plato2'].every(k => C.curso[k] === window.__c0[k]) }; });
    assert.deepEqual(r, { g: true, c: true }, 'explorar sin cambios no recalcula ninguno');
    // al revés: explorar otra disposición (gemelo) no borra lo de «curso», que vuelve a estar al día al deshacer el cambio
    await p.evaluate(() => { const g = window.__g; g.L().plato1.x += 0.03; g.aplicarLayout(); }); await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p);
    r = await p.evaluate(() => { const g = window.__g, C = g.CACHE_PLAN; return { g: g.planesAlDia(), c: g.planesAlDiaDe('curso'), intacta: ['plato1', 'plato2'].every(k => C.curso[k] === window.__c0[k]) }; });
    assert.deepEqual(r, { g: true, c: false, intacta: true });
    await p.evaluate(() => { const g = window.__g; g.L().plato1.x -= 0.03; g.aplicarLayout(); });
    r = await p.evaluate(() => { const g = window.__g, C = g.CACHE_PLAN; return { c: g.planesAlDiaDe('curso'), intacta: ['plato1', 'plato2'].every(k => C.curso[k] === window.__c0[k]) }; });
    assert.deepEqual(r, { c: true, intacta: true }, 'lo de «curso» sigue valiendo para su disposición');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
