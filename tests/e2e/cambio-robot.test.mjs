// Cambio de robot en la página (T1.5, revisión de T1.4–T1.5), en el nivel de puerta (T2.0): la pregunta al cambiar de robot
// con otro giro de base_link (las dos respuestas), el campo del prefijo de frames y que con la búsqueda o el cálculo en marcha
// no se cambia de robot. Movidos tal cual desde exportar.test.mjs, que sigue con la conversión, posiciones.yaml (I7) y las
// correcciones 5, 7 y 9; los ayudantes visible, esperarRobot, elegir y REF son copia de los de allí.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarToast } from '../navegador.mjs';

const REF = id => JSON.parse(fs.readFileSync(path.join(RAIZ, `tests/fixtures/cinematica/${id}.json`), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
const esperarRobot = (p, id) => p.waitForFunction(id => window.__g.ROB.id === id && window.__g.L().robotId === id, id, { timeout: 60000, polling: 50 });
// Pulsa un robot en el selector; si el gemelo pregunta (cambia el giro de base_link), responde `respuesta`
async function elegir(p, id, respuesta = 'rpMesa') {
  await p.click(`#segRobotId [data-v="${id}"]`);
  if (await visible(p, '#robotPregunta')) await p.click(`#${respuesta}`);
  await esperarRobot(p, id);
}

test('T1.5-3: al cambiar de robot con otro giro de base_link, el gemelo pregunta; las dos respuestas hacen lo que dicen', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  // Posiciones en el mundo y en base_link de lo que se puede mover (las pinzas de las cámaras se pegan al borde: aparte)
  const estado = () => p.evaluate(() => {
    const g = window.__g, l = g.L(), V = g.robot.root.position.constructor, r = v => +v.toFixed(9);
    const pts = { zona: l.zona, plato1: l.plato1, plato2: l.plato2, persona: l.persona, aruco0: l.arucoE[0], camPos: l.cams.cenital.pos, camMira: l.cams.cenital.mira };
    const mundo = {}, base = {}; for (const k in pts) { const q = pts[k]; mundo[k] = [r(q.x), r(q.y)]; const b = g.mundoABase(new V(q.x, q.y, q.z ?? 0.76)); base[k] = [r(b.x), r(b.y)]; }
    return { robot: g.ROB.id, id: l.robotId, mundo, base, yawZonaBase: r(Math.atan2(Math.sin(l.zona.yaw - g.ROB.yaw), Math.cos(l.zona.yaw - g.ROB.yaw))), pregunta: !document.getElementById('robotPregunta').hidden, rot: r(g.robot.root.rotation.z) };
  });
  try {
    const e0 = await estado(); assert.equal(e0.robot, 'nominal');
    // Pulsar el 203 (−135°) pregunta y no cambia nada todavía
    await p.click('#segRobotId [data-v="203"]');
    let e = await estado(); assert.equal(e.pregunta, true); assert.deepEqual({ ...e, pregunta: false }, { ...e0, pregunta: false }, 'sin responder, nada cambia');
    assert.match(await p.textContent('#robotPregTxt'), /−135,0°/);
    await p.click('#rpCancel'); e = await estado(); assert.deepEqual(e, e0, 'Cancelar no cambia nada');
    // Mantener la mesa: los objetos se quedan en el mundo; el brazo gira y cambian sus coordenadas en base_link
    await p.click('#segRobotId [data-v="203"]'); await p.click('#rpMesa'); await esperarRobot(p, '203');
    const eM = await estado();
    assert.deepEqual(eM.mundo, e0.mundo, 'mantener la mesa: el mundo no cambia');
    assert.notDeepEqual(eM.base, e0.base); assert.ok(Math.abs(eM.rot - (REF('203').mount_yaw - Math.PI)) < 1e-8, `el brazo gira: ${eM.rot}`);
    // Mantener la disposición respecto al robot (vuelta al nominal, 0°): los objetos giran alrededor de la base y conservan
    // sus coordenadas en base_link
    await p.click('#segRobotId [data-v="nominal"]'); assert.equal(await visible(p, '#robotPregunta'), true);
    await p.click('#rpRobot'); await esperarRobot(p, 'nominal');
    const eR = await estado();
    assert.notDeepEqual(eR.mundo, eM.mundo, 'los objetos se mueven en el mundo');
    for (const k in eR.base) assert.ok(Math.hypot(eR.base[k][0] - eM.base[k][0], eR.base[k][1] - eM.base[k][1]) < 1e-9, `${k}: en base_link ${eR.base[k]} frente a ${eM.base[k]}`);
    assert.ok(Math.abs(eR.yawZonaBase - eM.yawZonaBase) < 1e-9, 'el giro de la zona en base_link se conserva');
    assert.equal(await p.evaluate(() => { const g = window.__g, l = g.L(); return Object.values(l.cams).every(c => Math.abs(Math.abs(c.clamp.x) - 0.59) < 1e-9 || Math.abs(Math.abs(c.clamp.y) - 0.415) < 1e-9); }), true, 'las pinzas de las cámaras siguen en el borde de la mesa');
    // Sin cambio de giro (nominal → 205 → 206 → nominal): no pregunta, nada se mueve y se avisa
    for (const id of ['205', '206', 'nominal']) {
      const a = await estado(); await p.click(`#segRobotId [data-v="${id}"]`); await esperarRobot(p, id);
      const b = await estado(); assert.equal(b.pregunta, false, `${id}: sin pregunta`); assert.deepEqual([b.mundo, b.base], [a.mundo, a.base], `${id}: nada se mueve`);
      await p.waitForFunction(id => window.__toastsPrueba.some(t => t.startsWith(`Robot ${id}: base_link con el mismo giro`)), id, { timeout: 30000, polling: 50 });
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.5-4: el campo del prefijo explica cuándo se usa, enlaza a docs/estado/frames.md y va al layout y al YAML', { timeout: 300000 }, async () => {
  assert.ok(fs.existsSync(path.join(RAIZ, 'docs/estado/frames.md')), 'existe docs/estado/frames.md');
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click('.tabs [data-tab="datos"]');
    const txt = (await p.textContent('#prefijoTxt')).replace(/\s+/g, ' ');
    for (const t of ['Con sim_<id> (un robot) los frames van sin prefijo', 'Solo los URDF dobles del curso (doble_ur3e_<a>_<b>) añaden <id>_', 'SIN VALIDAR en ROS', 'ros2 run tf2_tools view_frames', 'docs/estado/frames.md']) assert.ok(txt.includes(t), `falta «${t}» en: ${txt}`);
    assert.match(await p.getAttribute('#prefijoDoc', 'href'), /\/docs\/estado\/frames\.md$/);
    assert.deepEqual(await p.evaluate(() => ({ d: document.getElementById('prefijo').disabled, ops: [...document.querySelectorAll('#prefijo option')].map(o => o.value) })), { d: true, ops: [''] }, 'nominal: sin URDF doble');
    await p.click('.tabs [data-tab="escena"]'); await elegir(p, '203', 'rpMesa'); await p.click('.tabs [data-tab="datos"]');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#prefijo option')].map(o => o.value)), ['', '203_']);
    await p.selectOption('#prefijo', '203_');
    await p.waitForFunction(() => window.__g.L().prefijoFrames === '203_' && JSON.parse(localStorage.getItem('gemelo-ur3e-v4') || '{}').prefijoFrames === '203_', null, { timeout: 30000, polling: 50 });
    const y = await p.evaluate(() => document.getElementById('yaml').value);
    assert.match(y, /^# Frame: 203_base_link \(prefijo «203_» del URDF doble doble_ur3e_203_204\.urdf\.xacro\)/m);
    assert.match(y, /^frame: 203_base_link$/m); assert.match(y, /^prefijo_frames: '203_'$/m);
    // corrección 6: con prefijo, la pose de <id>_base_link en el world del URDF doble (la del JSON de T1.3) y su origen
    const doble = (txt, id) => { const w = REF(id).world_base_link.doble, r3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
      assert.equal(txt.split('\n').find(l => l.startsWith('pose_en_world_doble:')), `pose_en_world_doble: {frame: ${w.frame}, x: ${r3(w.xyz[0])}, y: ${r3(w.xyz[1])}, z: 0.000, yaw_rad: ${r3(w.rpy[2])}}  # xacro del curso, ${w.fichero.split('/').pop().replace('.urdf.xacro', '')}: SUPUESTO (sin validar en ROS)`); };
    doble(y, '203');
    assert.match(y, /^world_a_base_link: .*# world del gemelo \(ejes de la mesa\)/m);
    await p.click('.tabs [data-tab="escena"]'); await elegir(p, '204', 'rpMesa'); await p.click('.tabs [data-tab="datos"]');
    assert.equal(await p.evaluate(() => window.__g.L().prefijoFrames), '204_');
    doble(await p.evaluate(() => document.getElementById('yaml').value), '204');
    // pasar a un robot sin ese prefijo lo cambia y lo dice; al nominal, sin prefijo
    await p.click('.tabs [data-tab="escena"]'); await elegir(p, '205', 'rpMesa');
    assert.equal(await p.evaluate(() => window.__g.L().prefijoFrames), '205_');
    await elegir(p, 'nominal'); assert.equal(await p.evaluate(() => window.__g.L().prefijoFrames), '');
    await esperarToast(p, 'Robot nominal: base_link con el mismo giro que el 205; nada se mueve. Recalcula las trayectorias. Prefijo de frames: ninguno.');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

// Arranca «Buscar una disposición que funcione» con un fallo de prueba y espera a que esté buscando
async function empezarBusqueda(p) {
  await p.evaluate(() => { const g = window.__g, info = { causa: 'alcance', fase: 'plato', pk: 'plato1' }; g.mostrarFalloInfo({ message: 'prueba', info }, 'Fallo de prueba', 'fallo'); window.__busca = g.buscarAlternativa(info); });
  await p.waitForFunction(() => window.__g.D.buscando && document.getElementById('fCancel'), null, { timeout: 60000, polling: 20 });
}
// «Cancelar» se vuelve a pintar con cada candidato: se pulsa desde la página hasta que la búsqueda termina
async function cancelarBusqueda(p) { await p.waitForFunction(() => { const b = document.getElementById('fCancel'); if (b) b.click(); return !window.__g.D.buscando; }, null, { timeout: 300000, polling: 100 }); }
const robotDe = p => p.evaluate(() => ({ rob: window.__g.ROB.id, l: window.__g.L().robotId, pregunta: !document.getElementById('robotPregunta').hidden }));

test('correcciones 1 y 2: con la búsqueda o el cálculo en marcha no se cambia de robot, ni desde el selector ni desde la pregunta', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    // 1) selector durante la búsqueda: el 205 (mismo giro) no pregunta; se avisa y no cambia nada, ni al acabar la búsqueda
    await empezarBusqueda(p);
    await p.click('#segRobotId [data-v="205"]');
    await esperarToast(p, 'Espera a que termine la búsqueda de una disposición para cambiar de robot');
    assert.deepEqual(await robotDe(p), { rob: 'nominal', l: 'nominal', pregunta: false });
    await cancelarBusqueda(p); assert.deepEqual(await robotDe(p), { rob: 'nominal', l: 'nominal', pregunta: false }, 'al acabar la búsqueda, L y la cinemática siguen de acuerdo');
    // 2a) la pregunta abierta antes de calcular no vale si al responder se está calculando
    const mundo = () => p.evaluate(() => JSON.stringify([window.__g.L().zona, window.__g.L().plato1]));
    const m0 = await mundo();
    await p.click('#segRobotId [data-v="203"]'); assert.equal((await robotDe(p)).pregunta, true);
    // el clic llega con el cálculo en marcha (desde la página: page.click espera a un fotograma y el cálculo no deja pintar)
    assert.equal(await p.evaluate(() => { const g = window.__g; for (const k in g.CACHE_PLAN) delete g.CACHE_PLAN[k]; window.__calc = g.calcularPlanes(); const activo = g.CALC.activo; document.getElementById('rpMesa').click(); return activo; }), true, 'calculando');
    await esperarToast(p, 'Espera a que termine el cálculo para cambiar de robot: el robot no cambia');
    assert.deepEqual(await robotDe(p), { rob: 'nominal', l: 'nominal', pregunta: false });
    await p.evaluate(() => window.__calc); await p.waitForFunction(() => !window.__g.CALC.activo, null, { timeout: 240000, polling: 100 });
    assert.deepEqual(await p.evaluate(() => ({ alDia: window.__g.planesAlDia(), rob: window.__g.ROB.id })), { alDia: true, rob: 'nominal' }, 'el plan se calcula y se guarda con el robot de verdad');
    // 2b) lo mismo con la búsqueda en marcha y «Mantener la disposición respecto al robot»
    await p.click('#segRobotId [data-v="203"]'); assert.equal((await robotDe(p)).pregunta, true);
    await empezarBusqueda(p); await p.click('#rpRobot');
    await esperarToast(p, 'Espera a que termine la búsqueda de una disposición para cambiar de robot: el robot no cambia');
    assert.deepEqual(await robotDe(p), { rob: 'nominal', l: 'nominal', pregunta: false });
    await cancelarBusqueda(p); assert.deepEqual(await robotDe(p), { rob: 'nominal', l: 'nominal', pregunta: false }); assert.equal(await mundo(), m0, 'nada se ha girado');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
