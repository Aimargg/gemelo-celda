// Remodelado de la interfaz (TU.1, dirección A «Guion de la demo» con la matriz de cámaras de C): los pasos numerados son
// las pestañas de siempre (mismos data-tab), la rejilla no cambia (el lienzo 3D mide lo mismo: lo fijan otros tests, como
// las huellas de distorsion.test.mjs), la cinta del ciclo dice el veredicto sin calcular nada por su cuenta y la matriz
// cámara × tarea resume lo mismo que las tarjetas. Disposición por defecto, perfil «curso», 1440 × 900.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const ciclo = p => p.evaluate(() => ({ sello: document.getElementById('cicloSello').textContent, cls: document.getElementById('cicloSello').className, dato: document.getElementById('cicloDato').textContent, sub: document.getElementById('cicloSub').textContent, pdDemo: document.getElementById('pdDemo').className, pdEscena: document.getElementById('pdEscena').className }));
// La cinta se repinta con el HUD (cada 18 fotogramas): se espera a la condición, no a un tiempo
const esperarSello = (p, txt) => p.waitForFunction(t => document.getElementById('cicloSello').textContent === t, txt, { timeout: 60000, polling: 100 });

test('TU.1 en el artefacto: rejilla, pasos, cinta del ciclo y matriz de cámaras', { timeout: 900000 }, async () => {
  const s = await abrir(srv.url, { destino: 'artefacto' }), p = s.page;
  try {
    // C1: la rejilla es la de antes (cabecera de 42 px, vista | panel de 384 px) y el lienzo mide lo mismo
    const geo = await p.evaluate(() => { const r = q => { const b = document.querySelector(q).getBoundingClientRect(); return [b.width, b.height].map(Math.round); }; const cv = document.querySelector('#view canvas'); return { top: r('.top'), panel: r('.panel'), canvas: [cv.width, cv.height] }; });
    assert.deepEqual(geo, { top: [1392, 42], panel: [384, 828], canvas: [998, 828] });
    // C2: cinco pasos numerados en el orden del trabajo, cada uno abre su panel
    const pasos = await p.evaluate(() => [...document.querySelectorAll('.tabs [role="tab"]')].map(b => [b.dataset.tab, b.querySelector('.n').firstChild.textContent, b.querySelector('.t').textContent]));
    assert.deepEqual(pasos, [['escena', '1', 'Celda'], ['camaras', '2', 'Cámaras'], ['alcance', '3', 'Alcance'], ['demo', '4', 'Demo'], ['datos', '5', 'Exportar']]);
    for (const [tab] of pasos) {
      await p.click(`.tabs [data-tab="${tab}"]`);
      assert.deepEqual(await p.evaluate(t => [document.querySelector(`.tabs [data-tab="${t}"]`).getAttribute('aria-selected'), [...document.querySelectorAll('.tab')].filter(x => !x.hidden).map(x => x.dataset.panel)], tab), ['true', [tab]]);
    }
    // C3: con las trayectorias al día pero sin comprobación previa (la pestaña Demo no se ha abierto en esta disposición), la
    // cinta no dice «Lista»: dice «Sin comprobar»; al abrir Demo, la comprobación previa vale y dice «Lista» (revisión H1)
    await p.click('.tabs [data-tab="escena"]'); await p.evaluate(() => { const C = window.__g.ciclo(); C.ult = null; });
    await esperarSello(p, 'Sin comprobar');
    let c = await ciclo(p);
    assert.equal(c.sub, 'los platos se cogen; el paso 4 comprueba el resto'); assert.equal(c.dato, '2 platos · perfil curso'); assert.equal(c.pdDemo, 'pd');
    await p.click('.tabs [data-tab="demo"]'); await esperarSello(p, 'Lista');
    c = await ciclo(p);
    assert.equal(c.sub, 'comprobación previa sin problemas'); assert.equal(c.pdDemo, 'pd ok'); assert.equal(c.pdEscena, 'pd');
    // cambiar la óptica de una cámara (focal) no invalida la comprobación previa: sigue «Lista» (revisión H1)
    await p.click('.tabs [data-tab="camaras"]');
    await p.evaluate(() => { const el = document.getElementById('f_cenital'); el.value = '4'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForFunction(() => window.__g.L().cams.cenital.f === 4, null, { timeout: 30000, polling: 100 });
    const n0 = await p.evaluate(() => window.__g.ciclo().n); await p.waitForFunction(n => window.__g.ciclo().n > n + 1, n0, { timeout: 60000, polling: 100 });
    assert.equal((await ciclo(p)).sello, 'Lista');
    // La cinta solo lee: repintarla no cambia la disposición, las entradas de CACHE_PLAN, firmaVal ni D.planes (revisión H5)
    const firma = () => p.evaluate(() => { const g = window.__g, C = g.CACHE_PLAN; window.__ent = window.__ent || { ...C.gemelo }; return JSON.stringify([g.L(), g.planesAlDia(), Object.keys(C.gemelo), ['plato1', 'plato2'].every(k => C.gemelo[k] === window.__ent[k]), g.firmaVal(), g.D.planes]); });
    const f0 = await firma(), n1 = await p.evaluate(() => window.__g.ciclo().n);
    await p.waitForFunction(n => window.__g.ciclo().n > n + 2, n1, { timeout: 60000, polling: 100 }); assert.equal(await firma(), f0);
    // Los platos sobre la mesa: primero «Sin calcular»; al calcular, «No empieza» con el motivo de los agarres, en rojo, y el
    // punto rojo en los pasos 1 (Celda) y 4 (Demo)
    await p.click('.tabs [data-tab="escena"]'); await p.click('#segCaja [data-v="0"]');
    await esperarSello(p, 'Sin calcular');
    assert.equal((await ciclo(p)).sub, 'pulsa «Calcular trayectorias»');
    await p.click('#btnCalc'); await esperarPlanes(p, 600000); await esperarSello(p, 'No empieza');
    c = await ciclo(p);
    assert.equal(c.cls, 'sello bad'); assert.equal(c.pdDemo, 'pd bad'); assert.equal(c.pdEscena, 'pd bad');
    assert.match(c.sub, /^Coger el plato 1º: imposible: /); assert.match(c.dato, /pasos? imposibles?$/);
    // C4: la matriz cámara × tarea da lo mismo que las tarjetas (píxeles y estado del peor objetivo de cada columna)
    await p.click('.tabs [data-tab="camaras"]');
    const m = await p.evaluate(() => {
      const card = (k, t) => document.querySelector(`#camCards .card[data-cam="${k}"] .tarea[data-tarea="${t}"]`);
      return [...document.querySelectorAll('#camMatriz tbody button')].map(b => { const f = card(b.dataset.mcam, b.dataset.mtarea); return { k: b.dataset.mcam, t: b.dataset.mtarea, txt: b.querySelector('.v').textContent, marca: b.querySelector('.m').textContent, sr: b.querySelector('.sr').textContent, cls: b.parentElement.className, px: f && f.dataset.px, estado: f && f.dataset.estado }; });
    });
    assert.equal(await p.evaluate(() => document.querySelectorAll('#camMatriz tbody tr').length), 3);
    assert.deepEqual(m.map(x => `${x.k}/${x.t}`), ['cenital/fruta', 'cenital/aruco-zona', 'cenital/campo', 'entrega/aruco-bandeja', 'entrega/desenfoque', 'entrega/campo', 'persona/pupilas', 'persona/mano', 'persona/desenfoque', 'persona/campo']);
    const CLS = { ok: 'ok', limite: 'warn', no: 'bad', fuera: 'bad' };
    const MARCA = { ok: '✓', warn: '!', bad: '✗' }, PAL = { ok: 'cumple', limite: 'límite', no: 'no cumple', fuera: 'fuera de campo' };
    for (const x of m) {
      assert.equal(x.cls, CLS[x.estado], `${x.k}/${x.t}: color del estado`);
      // el estado también con marca y palabra, no solo con el color (revisión H4)
      assert.equal(x.marca, MARCA[CLS[x.estado]], `${x.k}/${x.t}: marca`); assert.equal(x.sr, `: ${PAL[x.estado]}`, `${x.k}/${x.t}: palabra`);
      if (x.t !== 'campo') { const v = +x.px; assert.equal(x.txt, `${(v < 10 ? v.toFixed(1) : v.toFixed(0)).replace('.', ',')} px`, `${x.k}/${x.t}: píxeles`); }
    }
    // la peor de las tarjetas pinta el punto del paso 2 (la ArUco de la bandeja no cumple en la entrega)
    assert.deepEqual(await p.evaluate(() => { const e = document.getElementById('pdCamaras'); return [e.className, e.textContent]; }), ['pd bad', ': hay un problema']);
    // cambiar una cámara fuera de la pestaña deja el punto sin estado hasta repintar la matriz (revisión H8)
    await p.click('.tabs [data-tab="escena"]');
    await p.evaluate(() => { window.__g.L().cams.entrega.f = 5; });
    await p.waitForFunction(() => document.getElementById('pdCamaras').className === 'pd', null, { timeout: 60000, polling: 100 });
    await p.click('.tabs [data-tab="camaras"]');
    // pulsar una casilla marca su fila en la tarjeta de la cámara
    await p.click('#camMatriz button[data-mcam="entrega"][data-mtarea="aruco-bandeja"]');
    assert.equal(await p.evaluate(() => document.querySelector('#camCards .card[data-cam="entrega"] .tarea[data-tarea="aruco-bandeja"]').classList.contains('marcada')), true);
    // C5: el botón de la cinta es «Reproducir demo» (se intercepta el clic para no arrancarla)
    const n = await p.evaluate(() => { let n = 0; document.getElementById('dPlay').addEventListener('click', e => { n++; e.stopImmediatePropagation(); }, { capture: true, once: true }); document.getElementById('cicloPlay').click(); return n; });
    assert.equal(n, 1);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('TU.1 en la web: la misma rejilla y la cinta del ciclo', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), p = s.page;
  try {
    const geo = await p.evaluate(() => { const cv = document.querySelector('#view canvas'); return [cv.width, cv.height, document.querySelectorAll('.tabs [role="tab"]').length]; });
    assert.deepEqual(geo, [998, 828, 5]);
    // sin la pestaña Demo abierta no hay comprobación previa: «Sin comprobar»; al abrirla, «Lista»
    await p.waitForFunction(() => ['Sin comprobar', 'Lista', 'No empieza'].includes(document.getElementById('cicloSello').textContent), null, { timeout: 60000, polling: 100 });
    assert.equal(await p.evaluate(() => document.getElementById('cicloSello').textContent), 'Sin comprobar');
    await p.click('.tabs [data-tab="demo"]');
    await p.waitForFunction(() => document.getElementById('cicloSello').textContent === 'Lista', null, { timeout: 60000, polling: 100 });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
