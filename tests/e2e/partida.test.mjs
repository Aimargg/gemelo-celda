// Escena de partida (H3, DT24) y capa «Robot del otro puesto» (H4, DT25), pasada de deuda de F1.
//  · H3: la comprobación previa de Guardar y el ensayo en seco de la búsqueda miran la escena de partida (fruta en su zona,
//    platos en su sitio) aunque una demo haya terminado, fallado a medias o esté en pausa; Guardar con la demo en pausa no
//    la reinicia ni la pierde (sigue y termina).
//  · H4: alternar la capa deja sin validar la validación y fuera de día los planes de los dos perfiles, cambia los
//    obstáculos en el acto y la semilla del RRT con el otro robot y sin él es distinta.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarToast } from '../navegador.mjs';
import { BASE } from '../medir.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Guarda una escena nueva con ese nombre (almacén de claude.ai simulado) y devuelve su `estado`
async function guardar(p, nombre) {
  await p.click('#escCur'); await p.fill('#escNombre', nombre); await p.click('#escNueva');
  await esperarToast(p, 'Escena guardada: el grupo ya puede verla', 300000); // el aviso de la primera vez ya cuenta: se espera a la escena
  await p.waitForFunction(n => window.__store.A && window.__store.A.items.some(x => x.nombre === n), nombre, { timeout: 300000, polling: 100 });
  return p.evaluate(n => window.__store.A.items.find(x => x.nombre === n).estado, nombre);
}
// Lo que tiene la escena animada: padre y posición en el mundo de platos y fruta, estado de cada pieza, postura, apertura,
// carga, bandeja y cajas, y en qué punto está la demo. Antes se dejan pasar dos fotogramas: tras ensayo() el bucle vuelve a
// poner la bandeja según su estado (al acabar la demo deja de balancearse) y eso no lo hace Guardar
const animada = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => p.evaluate(() => {
  const g = window.__g, D = g.D, r = v => +v.toFixed(6), w = o => { const v = o.getWorldPosition(o.position.clone()); return [r(v.x), r(v.y), r(v.z)]; };
  const padre = o => o.parent === g.scene ? 'escena' : o.parent === g.bandeja ? 'bandeja' : o.parent === g.pinza.tcp ? 'pinza' : o.parent === g.OBJ.plato1 ? 'plato1' : o.parent === g.OBJ.plato2 ? 'plato2' : o.parent && o.parent.children.includes(g.piezas()[0].obj) ? 'zona' : 'otro';
  return { platos: ['plato1', 'plato2'].map(k => [padre(g.OBJ[k]), w(g.OBJ[k])]), piezas: g.piezas().map(pz => [padre(pz.obj), w(pz.obj), pz.usada, pz.enPinza, pz.obj.parent.children.indexOf(pz.obj)]),
    q: g.robot.q.map(r), w: r(g.pinza.w), carga: D.carga ? Array.from(D.carga).map(r) : null, bandeja: w(g.bandeja), cajas: [r(g.OBJ.caja1.rotation.z), r(g.OBJ.caja2.rotation.z)],
    demo: { run: D.run, activo: D.activo, fin: D.fin, paso: D.paso, estado: D.estado, playing: D.playing } };
}));

test('H3: Guardar guarda el mismo estado tras una demo terminada, tras otra abortada y con la demo en pausa, que sigue', { timeout: 1200000 }, async () => {
  const s = await abrir(srv.url, { destino: 'artefacto-claude' }); const p = s.page;
  try {
    await p.waitForFunction(() => window.__g.ALM.modo === 'claude' && window.__g.ALM.yo === 'A' && !window.__g.ESC.cargando, null, { timeout: 30000 });
    const e0 = await guardar(p, 'antes de la demo'); // calcula «curso» (al cargar solo se calcula «gemelo»)
    // Tras cada demo se vacían las trayectorias de los dos perfiles: Guardar las recalcula con la escena animada delante
    const vaciar = () => p.evaluate(() => { const C = window.__g.CACHE_PLAN; for (const k in C) C[k] = {}; });
    // 1) demo terminada: la fruta queda en los platos y los platos en la bandeja
    const r1 = await p.evaluate(c => window.__g.ensayo(c).then(r => r.fin), { ...BASE, caja: true, modo: 'M0', amp: 0.02, perfil: 'gemelo' });
    assert.equal(r1, 'ok');
    const fin1 = await animada(p);
    assert.ok(fin1.platos.every(([pa]) => pa === 'bandeja') && fin1.piezas.every(x => x[0] === 'plato1' || x[0] === 'plato2' || !x[2]), `escena animada tras la demo: ${JSON.stringify(fin1.platos)}`);
    await vaciar(); assert.deepEqual(await guardar(p, 'tras una demo terminada'), e0);
    assert.deepEqual(await animada(p), fin1, 'Guardar deja la escena de la demo terminada como estaba');
    // 2) demo abortada a medias (la bandeja se mueve 6 cm, el máximo del control: se aparta más de 10 s del volumen natural
    // y se retira el brazo). Hasta T2.8 eran 10 cm; desde T2.8 la salida se comprueba con la amplitud de la demo, y con 10 cm
    // se elige otro agarre del plato 1 que choca con la bandeja al acercarse al borde (paso 6) antes de llegar a abortar
    const r2 = await p.evaluate(c => window.__g.ensayo(c).then(r => ({ fin: r.fin, paso: r.paso, causa: window.__g.D.falloDemo && window.__g.D.falloDemo.causa })), { ...BASE, caja: true, modo: 'M0', amp: 0.06, perfil: 'gemelo' });
    assert.deepEqual({ fin: r2.fin, causa: r2.causa }, { fin: 'abort', causa: 'bandeja_movida' }, `demo abortada en el paso ${r2.paso}`);
    const fin2 = await animada(p);
    assert.ok(fin2.piezas.some(x => x[2]), 'la demo abortada ya había usado fruta');
    await vaciar(); assert.deepEqual(await guardar(p, 'tras una demo abortada'), e0);
    assert.deepEqual(await animada(p), fin2);
    // 3) demo en pausa con el 1.er plato ya en la bandeja y la 2.ª fruta en la pinza: se para con hasta y queda como una pausa
    const r3 = await p.evaluate(c => window.__g.ensayo({ ...c, hasta: d => d.estado === 'SIRVIENDO_2 · 1/1' && window.__g.piezas().some(pz => pz.enPinza) }), { ...BASE, caja: true, modo: 'M0', amp: 0.02, perfil: 'gemelo' });
    assert.equal(r3.parado, 'SIRVIENDO_2 · 1/1');
    const pausa = await animada(p);
    assert.deepEqual({ activo: pausa.demo.activo, fin: pausa.demo.fin, playing: pausa.demo.playing }, { activo: true, fin: null, playing: false }, 'demo en pausa');
    assert.ok(pausa.piezas.some(x => x[0] === 'pinza') && pausa.platos[0][0] === 'bandeja', 'fruta en la pinza y el 1.er plato en la bandeja');
    await vaciar(); assert.deepEqual(await guardar(p, 'con la demo en pausa'), e0);
    assert.deepEqual(await animada(p), pausa, 'Guardar no reinicia ni cambia la demo en pausa');
    // y la demo sigue desde donde estaba hasta el final (a 8× la velocidad de reproducción)
    await p.evaluate(() => { const D = window.__g.D; D.rate = 8; D.playing = true; });
    await p.waitForFunction(() => window.__g.D.fin, null, { timeout: 600000, polling: 200 });
    assert.equal(await p.evaluate(() => window.__g.D.fin), 'ok', 'la demo en pausa se completa después de guardar');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('H3: tras una demo abortada, el ensayo en seco de la búsqueda ve la fruta en su zona', { timeout: 900000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(c => window.__g.ensayo(c).then(r => r.fin), { ...BASE, caja: true, modo: 'M0', amp: 0.06, perfil: 'gemelo' });
    assert.equal(r, 'abort');
    // Espía (sin cambiar nada) las posiciones de la fruta que se leen durante el primer ensayo en seco de la búsqueda, en
    // el marco de la zona de fruta de la disposición que se ensaya en ese momento
    await p.evaluate(() => {
      const g = window.__g; window.__vistas = [];
      let P = Object.getPrototypeOf(g.piezas()[0].obj); while (!Object.hasOwn(P, 'getWorldPosition')) P = Object.getPrototypeOf(P); // THREE.Object3D.prototype
      const orig = P.getWorldPosition;
      P.getWorldPosition = function (v) {
        const out = orig.call(this, v); const D = g.D, pz = g.piezas().find(x => x.obj === this);
        if (pz && D.buscando && D.tBusca && D.tBusca.n === 0) { const z = g.L().zona, dx = out.x - z.x, dy = out.y - z.y; window.__vistas.push({ id: pz.id, u: dx * Math.cos(z.yaw) + dy * Math.sin(z.yaw), v: -dx * Math.sin(z.yaw) + dy * Math.cos(z.yaw), z: out.z, w: z.w, d: z.d, h: pz.F.h }); }
        return out;
      };
      window.__busca = g.buscarAlternativa({ causa: 'alcance', fase: 'plato', pk: 'plato1' });
    });
    await p.waitForFunction(() => window.__g.D.tBusca && window.__g.D.tBusca.n >= 1, null, { timeout: 300000, polling: 50 });
    await p.evaluate(() => { const c = document.getElementById('fCancel'); if (c) c.click(); return window.__busca; });
    await p.waitForFunction(() => !window.__g.D.buscando, null, { timeout: 600000, polling: 100 });
    const v = await p.evaluate(() => ({ vistas: window.__vistas, zMesa: window.__g.zPlato() - (window.__g.L().caja.on ? window.__g.L().caja.h : 0) }));
    assert.ok(v.vistas.length >= 3, `el ensayo en seco mira la fruta (${v.vistas.length} lecturas)`);
    const fuera = v.vistas.filter(x => Math.abs(x.u) > x.w / 2 || Math.abs(x.v) > x.d / 2 || Math.abs(x.z - (v.zMesa + x.h)) > 1e-6);
    assert.deepEqual(fuera, [], 'toda la fruta que ve el ensayo en seco está en su zona, apoyada en la mesa');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('H4: alternar «Robot del otro puesto» invalida la validación, los planes de los dos perfiles, los obstáculos y la semilla', { timeout: 900000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.evaluate(() => window.__g.validar());
    const estado = () => p.evaluate(() => { const g = window.__g, qa = g.qReposo(), qb = qa.slice(); qb[0] += 1;
      return { otro: g.otroVisible(), val: g.valAlDia(), g: g.planesAlDiaDe('gemelo'), c: g.planesAlDiaDe('curso'), robotA: g.obstaculos().filter(o => o.tag === 'robot A').length, semilla: g.semillaDe(qa, qb, { w: 0.06, carga: null, perfil: 'gemelo' }) }; });
    // la capa se cambia y se mira todo en el mismo paso (sin dejar pasar un fotograma)
    const alternar = () => p.evaluate(() => { const c = document.getElementById('lyOtro'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); const g = window.__g, qa = g.qReposo(), qb = qa.slice(); qb[0] += 1;
      return { otro: g.otroVisible(), val: g.valAlDia(), g: g.planesAlDiaDe('gemelo'), c: g.planesAlDiaDe('curso'), robotA: g.obstaculos().filter(o => o.tag === 'robot A').length, semilla: g.semillaDe(qa, qb, { w: 0.06, carga: null, perfil: 'gemelo' }) }; });
    const con = await estado();
    assert.deepEqual({ otro: con.otro, val: con.val, g: con.g, c: con.c }, { otro: true, val: true, g: true, c: true }, 'validada y con los planes al día');
    assert.ok(con.robotA > 0, 'el otro robot está entre los obstáculos');
    const sin = await alternar();
    assert.deepEqual({ otro: sin.otro, val: sin.val, g: sin.g, c: sin.c, robotA: sin.robotA }, { otro: false, val: false, g: false, c: false, robotA: 0 }, 'sin el otro robot: sin validar, planes fuera de día y fuera de los obstáculos');
    assert.notEqual(sin.semilla, con.semilla, 'la semilla con el otro robot y sin él es distinta');
    await p.waitForFunction(() => !document.getElementById('calcBar').hidden && document.getElementById('calcTxt').textContent === 'Hay cambios sin calcular', null, { timeout: 10000, polling: 50 });
    // volver a mostrarlo deja la escena como estaba: los planes y la validación de antes vuelven a valer
    const otraVez = await alternar();
    assert.deepEqual(otraVez, con);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
