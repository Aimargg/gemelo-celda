// Flujo «explorar → validar» con los dos perfiles (T1.8, D6): barra de validación con los dos veredictos y los dos tiempos
// de ciclo, motivo concreto cuando difieren, búsqueda de disposiciones con confirmación en «curso» (y DT10), y el estado
// de las escenas con porPerfil en el simulacro de Firestore y en el almacén de claude.ai.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes, esperarToast, CLAVE_BUENA } from '../navegador.mjs';

const V8 = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/escenas-v8/1-defecto.json'), 'utf8'));
const LAYOUT_V8 = JSON.parse(Buffer.from(V8.codigo.slice('GEMELO1.'.length), 'base64').toString('utf8')).layout;
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const texto = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
// Pulsa «Validar con perfil curso» y espera a que acabe (en la web no hay __g: se espera a la barra)
async function validar(p, timeout = 400000) {
  await p.click('#btnValidar');
  await p.waitForFunction(() => document.querySelectorAll('#valBar .valFila').length === 2 && !document.querySelector('#valBar .spin'), null, { timeout, polling: 200 });
}

test('T1.8-1, T1.8-2 y T1.8-5: Validar muestra los dos veredictos y los dos tiempos de ciclo; si difieren, el motivo sale de la causa', { timeout: 900000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    assert.equal(await visible(p, '#valBar'), true, 'la barra de validación está a la vista');
    assert.match(await texto(p, '#valTxt'), /^Perfil «curso»: sin validar\./);
    // Barrido general: la primera disposición, empezando por la de partida y acercando a la persona de 2 en 2 cm, en la que
    // «gemelo» pasa y «curso» falla por arranque en contacto
    let caso = null;
    for (const dx of [0, -0.02, -0.04, 0.02]) {
      await p.evaluate(dx => { const g = window.__g; g.L().persona.x += dx; g.aplicarLayout(); }, dx);
      await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p);
      const t0 = Date.now(); await validar(p); const ms = Date.now() - t0;
      const r = await p.evaluate(() => { const v = window.__g.VAL.res.per; return { g: v.gemelo.previa.ok && v.gemelo.demo.fin === 'ok', c: v.curso.previa.ok && v.curso.demo.fin === 'ok', causa: v.curso.demo.fallo && v.curso.demo.fallo.causa, motivo: v.curso.demo.motivo, tg: v.gemelo.demo.t_ciclo_s, tc: v.curso.demo.t_ciclo_s, previaC: v.curso.previa.ok }; });
      if (r.g && !r.c && r.causa === 'arranque_contacto') { caso = { dx, ms, ...r }; break; }
      await p.evaluate(dx => { const g = window.__g; g.L().persona.x -= dx; g.aplicarLayout(); }, dx);
    }
    assert.ok(caso, 'el barrido encuentra una disposición que solo pasa en «gemelo» por arranque en contacto');
    assert.equal(caso.motivo, 'arranque en contacto', 'el motivo sale de la causa, no del texto');
    const filas = { g: await texto(p, '#valBar [data-perfil="gemelo"]'), c: await texto(p, '#valBar [data-perfil="curso"]'), m: await texto(p, '#valBar .valMotivo') };
    const s1 = v => v.toFixed(1).replace('.', ',');
    assert.equal(filas.g, `Gemelo previa: sin problemas · demo: completa · ciclo ${s1(caso.tg)} s`);
    assert.match(filas.c, new RegExp(`^Curso previa: sin problemas · demo: parada en el paso \\d+ · ciclo ${s1(caso.tc)} s hasta el fallo$`));
    assert.equal(filas.m, 'Solo pasa en «gemelo». Motivo: arranque en contacto');
    assert.notEqual(caso.tg, caso.tc, 'los dos tiempos de ciclo, distintos');
    assert.match(await p.evaluate(() => document.querySelector('#valBar .valMotivo').title), /^MoveIt rechazaría el arranque en contacto \(START_STATE_IN_COLLISION\): /);
    assert.equal(await p.textContent('#btnValidar'), 'Validar otra vez');
    // T1.6-7 con el botón: tras validar, explorar sin tocar nada no recalcula ni «gemelo» ni «curso»
    await p.evaluate(() => { const C = window.__g.CACHE_PLAN; window.__ref = { g: { ...C.gemelo }, c: { ...C.curso } }; });
    assert.deepEqual(await p.evaluate(() => [window.__g.planesAlDia(), window.__g.planesAlDiaDe('curso'), document.getElementById('calcBar').hidden]), [true, true, true]);
    await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p);
    assert.equal(await p.evaluate(() => ['plato1', 'plato2'].every(k => window.__g.CACHE_PLAN.gemelo[k] === window.__ref.g[k] && window.__g.CACHE_PLAN.curso[k] === window.__ref.c[k])), true, 'nada se recalcula');
    // T1.8-1: arrastrar el plato 1 con el ratón: la barra pide calcular, la validación queda «sin validar» y «Calcular»
    // recalcula con «gemelo» sin tocar lo de «curso»
    // vista en planta, puesta directamente (sin la animación) y dibujada dos fotogramas
    await p.evaluate(() => new Promise(r => { const g = window.__g; g.cam.position.set(0, -0.001, 2.75); g.orbit.target.set(0, 0, 0.76); g.orbit.update(); requestAnimationFrame(() => requestAnimationFrame(r)); }));
    const pt = await p.evaluate(() => { const g = window.__g, v = g.OBJ.plato1.getWorldPosition(g.OBJ.plato1.position.clone()).project(g.cam), r = g.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, x0: g.L().plato1.x }; });
    await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x + 10, pt.y + 2, { steps: 3 }); await p.mouse.move(pt.x + 25, pt.y + 4, { steps: 3 }); await p.mouse.up();
    await p.waitForFunction(() => !document.getElementById('calcBar').hidden, null, { timeout: 30000, polling: 50 });
    const tras = await p.evaluate(x0 => ({ dx: window.__g.L().plato1.x - x0, alDia: window.__g.valAlDia(), txt: document.getElementById('calcTxt').textContent }), pt.x0);
    assert.ok(Math.abs(tras.dx) > 0.005, `el plato se ha movido ${tras.dx} m`); assert.equal(tras.alDia, false); assert.equal(tras.txt, 'Hay cambios sin calcular');
    assert.match(await texto(p, '#valTxt'), /^Perfil «curso»: sin validar\. La escena ha cambiado desde la última validación\./);
    await p.click('#btnCalc'); await p.waitForFunction(() => window.__g.CALC.activo, null, { timeout: 10000, polling: 20 }).catch(() => { }); await esperarPlanes(p);
    assert.deepEqual(await p.evaluate(() => ({ g: window.__g.planesAlDia(), c: window.__g.planesAlDiaDe('curso'), intacta: ['plato1', 'plato2'].every(k => window.__g.CACHE_PLAN.curso[k] === window.__ref.c[k]) })), { g: true, c: false, intacta: true }, 'arrastrar recalcula con «gemelo»');
    comprobar(s.reg);
    console.log(`  · barrido: persona ${caso.dx * 100} cm; Validar ${caso.ms} ms; ciclo gemelo ${caso.tg} s, curso ${caso.tc} s`);
  } finally { await s.cerrar(); }
});

test('T1.8-3 y DT10: la búsqueda ensaya desde la fase en que arrancó la demo fallida, ordena con «gemelo» y confirma con «curso»', { timeout: 900000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    // El plato 1, 14 cm más lejos de la base en la misma dirección: no se llega a soltar la fruta (comprobación previa)
    await p.evaluate(() => { const g = window.__g, L = g.L(), b = g.BASES[L.robot], f = Math.atan2(L.plato1.y - b.y, L.plato1.x - b.x); L.plato1.x += 0.14 * Math.cos(f); L.plato1.y += 0.14 * Math.sin(f); g.aplicarLayout(); });
    // Registra cada valor que se asigna a D.fase (la fase de la bandeja de los ensayos); empieza en 0
    await p.evaluate(() => { const D = window.__g.D; let v = D.fase; window.__fases = []; Object.defineProperty(D, 'fase', { get: () => v, set: x => { window.__fases.push(x); v = x; }, configurable: true }); });
    await p.waitForFunction(() => window.__g.simT() > 3, null, { timeout: 60000, polling: 50 }); // la bandeja de la página sigue al reloj
    await p.click('.tabs [data-tab="demo"]'); await p.click('#dPlay');
    await p.waitForFunction(() => window.__g.D.fin === 'previo' && document.getElementById('fBuscar'), null, { timeout: 300000, polling: 100 });
    const ini = await p.evaluate(() => ({ fase: window.__g.D.ultFallo.fase, t0: window.__g.D.t0, d: window.__g.D.fase, n: window.__fases.length }));
    assert.ok(ini.fase > 3 && Math.abs(ini.fase - (ini.t0 + ini.d)) < 1e-9, `fase al arrancar la demo: ${ini.fase} (simT ${ini.t0} + D.fase ${ini.d})`);
    assert.equal(ini.d, 0);
    await p.click('#fBuscar');
    await p.waitForFunction(() => window.__g.D.buscando, null, { timeout: 30000, polling: 20 });
    await p.waitForFunction(() => !window.__g.D.buscando, null, { timeout: 800000, polling: 200 });
    const r = await p.evaluate(n => ({ fases: window.__fases.slice(n), fase: window.__g.D.fase, t: window.__g.D.tBusca, box: document.getElementById('dRecom').textContent.replace(/\s+/g, ' ').trim(), boton: (document.getElementById('fAplicarG') || document.getElementById('fAplicar') || {}).textContent || null }), ini.n);
    // DT10: cada ensayo de la búsqueda parte de la fase en que arrancó la demo fallida; al acabar, D.fase vuelve a la de antes
    assert.ok(r.fases.length >= 2, `la búsqueda ha ensayado: ${JSON.stringify(r.fases)}`);
    assert.deepEqual(r.fases.slice(0, -1), r.fases.slice(0, -1).map(() => ini.fase), 'los ensayos usan la fase de arranque de la demo que falló');
    assert.equal(r.fases.at(-1), 0); assert.equal(r.fase, 0); assert.equal(r.t.fase, ini.fase);
    // T1.8-3: hasta 3 candidatos que completan la demo con «gemelo», confirmados con «curso» en orden
    const buenos = r.t.gemelo.filter(x => x.fin === 'ok');
    assert.ok(r.t.gemelo.length <= 3 && buenos.length >= 1, `demos con gemelo: ${JSON.stringify(r.t.gemelo)}`);
    assert.deepEqual(r.t.curso.map(x => x.texto), buenos.slice(0, r.t.curso.length).map(x => x.texto), 'se confirman con «curso» los que completan con «gemelo», en orden');
    const pasaCurso = r.t.curso.find(x => x.fin === 'ok');
    if (pasaCurso) { assert.equal(r.t.curso.at(-1), pasaCurso, 'se para en el primero que pasa'); assert.match(r.box, /^Disposición recomendada\./); assert.match(r.box, /con los dos perfiles/); }
    else {
      assert.equal(r.t.curso.length, buenos.length, 'si ninguno pasa, se confirman todos');
      assert.match(r.box, /^Ninguna pasa con «curso»\./); assert.ok(r.box.includes(`falla con «curso» por: ${r.t.curso[0].motivo}`), r.box);
      assert.equal(r.boton, 'Aplicar la de «gemelo» (no pasa en curso)');
    }
    comprobar(s.reg);
    console.log(`  · gemelo: ${JSON.stringify(r.t.gemelo)} · curso: ${JSON.stringify(r.t.curso)}`);
  } finally { await s.cerrar(); }
});

// Escena v8 (sin porPerfil) en el almacén, como la habría guardado la v8
const escenaV8 = { nombre: 'Escena v8', nota: 'guardada con la v8', autor: 'Ana', editadoPor: 'Ana', creado: '2026-11-10T10:00:00.000Z', editado: '2026-11-10T10:00:00.000Z', layout: JSON.stringify(LAYOUT_V8), ajustes: { modo: 'M0', amp: 0.02, vel: 0.25, pedido: 2 }, vista: null, estado: { ok: true, n: 0, txt: 'La comprobación previa no encuentra problemas.' }, borrado: false };
const ppf = (p, i) => p.evaluate(i => [...document.querySelectorAll(`#escLista li`)][i]?.querySelectorAll('.ppf') && [...[...document.querySelectorAll('#escLista li')][i].querySelectorAll('.ppf')].map(e => ({ pf: e.dataset.perfil, dot: e.querySelector('.dot').className, txt: e.textContent.trim() })), i);

test('T1.8-4 y T1.8-6 (Firestore simulado): una v8 muestra «curso» sin validar; validar no la guarda; guardar añade porPerfil', { timeout: 900000 }, async () => {
  // el simulacro de Firestore usa globalThis.__fsStore si ya existe: se crea antes de cargar la página con la escena v8
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}`, initScripts: [{ content: `globalThis.__fsStore = new Map([['grupos/clave-buena/escenas/v8a', ${JSON.stringify(escenaV8)}]]);` }] });
  const p = s.page; const doc = () => p.evaluate(() => globalThis.__fsStore.get('grupos/clave-buena/escenas/v8a'));
  try {
    await p.waitForFunction(() => document.getElementById('escMeta').textContent.includes('1 escena guardada'), null, { timeout: 60000, polling: 50 });
    await p.click('#escCur');
    assert.deepEqual(await ppf(p, 1), [{ pf: 'gemelo', dot: 'dot ok', txt: 'gemelo: previa sin problemas' }, { pf: 'curso', dot: 'dot none', txt: 'curso: sin validar' }], 'dos puntos y «sin validar»');
    await p.click('#escLista [data-abrir="0"]'); await esperarToast(p, 'Escena v8 · de Ana');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#escDot .dot')].map(d => [d.dataset.perfil, d.className])), [['gemelo', 'dot ok'], ['curso', 'dot none']]);
    // abrirla no calcula «curso» ni cambia su veredicto «gemelo» (I1)
    assert.match(await texto(p, '#valTxt'), /^Perfil «curso»: sin validar\./);
    const antes = await doc();
    await validar(p);
    assert.match(await texto(p, '#valBar [data-perfil="gemelo"]'), /^Gemelo previa: sin problemas · demo: completa · ciclo [\d,]+ s$/, 'el veredicto «gemelo» de la v8 sigue igual');
    assert.deepEqual(await doc(), antes, 'validar no guarda nada');
    // guardar los cambios: estado con el veredicto del perfil de la escena («gemelo», v8) y porPerfil con las dos demos
    await p.click('#escCur'); await p.fill('#escAutor', 'Prueba'); await p.locator('#escAutor').dispatchEvent('change');
    await p.click('#escCambios'); await esperarToast(p, 'Cambios guardados');
    const d = await doc(), e = d.estado;
    assert.deepEqual(Object.keys(e).sort(), ['n', 'ok', 'porPerfil', 'txt']);
    assert.deepEqual({ ok: e.ok, n: e.n, txt: e.txt }, { ok: e.porPerfil.gemelo.ok, n: e.porPerfil.gemelo.n, txt: e.porPerfil.gemelo.txt }, 'compatible con la v8: el de su perfil');
    for (const pf of ['gemelo', 'curso']) { const x = e.porPerfil[pf]; assert.deepEqual(Object.keys(x).sort(), ['demo', 'n', 'ok', 'txt']); assert.ok(x.txt.length <= 300); assert.deepEqual(Object.keys(x.demo).sort(), ['fin', 'motivo', 't_ciclo_s']); }
    assert.equal(e.porPerfil.gemelo.demo.fin, 'ok'); assert.equal(e.porPerfil.gemelo.demo.motivo, null);
    assert.equal(JSON.parse(d.layout).perfil, 'gemelo');
    // una escena nueva sin validar («Restablecer distribución»: perfil «curso»): las dos comprobaciones previas, sin demo
    assert.equal(await visible(p, '#escPop'), false, 'al guardar, el panel de escenas se cierra'); await p.click('#btnReset');
    await p.click('#escCur'); await p.fill('#escNombre', 'Nueva sin validar'); await p.click('#escNueva'); await esperarToast(p, 'Escena guardada: el grupo ya puede verla');
    const n = await p.evaluate(() => [...globalThis.__fsStore.values()].find(x => x.nombre === 'Nueva sin validar'));
    assert.equal(JSON.parse(n.layout).perfil, 'curso');
    assert.deepEqual([n.estado.porPerfil.gemelo.demo, n.estado.porPerfil.curso.demo], [null, null], 'sin validar: la demo no se ensaya al guardar');
    assert.deepEqual({ ok: n.estado.ok, n: n.estado.n }, { ok: n.estado.porPerfil.curso.ok, n: n.estado.porPerfil.curso.n });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.8-4 (almacén de claude.ai): una v8 muestra «curso» sin validar y una escena nueva se guarda con porPerfil', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url, { destino: 'artefacto-claude' }); const p = s.page;
  try {
    await p.waitForFunction(() => window.__g.ALM.modo === 'claude' && window.__g.ALM.yo === 'A' && !window.__g.ESC.cargando, null, { timeout: 30000 });
    await p.evaluate(async l => { const db = await window.claude.use('db'); await db.collection('propuestas').doc('A').set({ items: [{ id: 'v8', nombre: 'Escena v8', nota: '', creado: '2026-11-10T10:00:00.000Z', editado: '2026-11-10T10:00:00.000Z', layout: l, ajustes: { modo: 'M0', amp: 0.02, vel: 0.25, pedido: 2 }, vista: null, estado: { ok: false, n: 1, txt: 'Plato 1º: problema de la v8' } }] }); }, LAYOUT_V8);
    await p.waitForFunction(() => window.__g.ESC.lista.length === 1, null, { timeout: 30000, polling: 50 });
    await p.click('#escCur');
    assert.deepEqual(await ppf(p, 1), [{ pf: 'gemelo', dot: 'dot bad', txt: 'gemelo: 1 problema' }, { pf: 'curso', dot: 'dot none', txt: 'curso: sin validar' }]);
    assert.match(await texto(p, '#escLista li:nth-child(2)'), /gemelo: Plato 1º: problema de la v8/);
    await p.fill('#escNombre', 'Nueva'); await p.click('#escNueva'); await esperarToast(p, 'Escena guardada: el grupo ya puede verla');
    const it = await p.evaluate(() => window.__store.A.items.find(x => x.nombre === 'Nueva'));
    assert.equal(it.layout.perfil, 'curso');
    assert.deepEqual({ ok: it.estado.ok, n: it.estado.n, txt: it.estado.txt }, { ok: it.estado.porPerfil.curso.ok, n: it.estado.porPerfil.curso.n, txt: it.estado.porPerfil.curso.txt });
    assert.deepEqual([it.estado.porPerfil.gemelo.demo, it.estado.porPerfil.curso.demo], [null, null]);
    assert.deepEqual((await ppf(p, 1)).map(x => x.pf), ['gemelo', 'curso'], 'la escena nueva, con sus dos puntos');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
