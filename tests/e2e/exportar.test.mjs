// world ↔ base_link por robot en la página (T1.5, I7): conversión de cada id contra su JSON, cabecera e ida y vuelta de
// posiciones.yaml, pregunta al cambiar de robot (las dos respuestas) y el campo del prefijo de frames.
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
// Lo que dice el JSON: un punto del mundo del gemelo (base en `b`, tablero a z0) en base_link, p_base = Rᵀ · (p − base)
const porJSON = (T, b, z0, p) => { const d = [p.x - b.x, p.y - b.y, p.z - z0]; return [0, 1, 2].map(c => T[c] * d[0] + T[4 + c] * d[1] + T[8 + c] * d[2]); };

test('T1.5-1: con cada robot elegido, un punto de la mesa en base_link (la conversión de la página) coincide con su JSON (±0,5 mm)', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    for (const id of ['203', '204', '205', '206', 'nominal']) {
      await elegir(p, id);
      const r = await p.evaluate(() => { const g = window.__g, b = g.BASES[g.L().robot], V = g.robot.root.position.constructor; const pts = [[0, 0, 0.76], [0.59, 0.415, 0.76], [-0.59, -0.415, 0.96], [0.2, -0.3, 0.86]];
        return { b, pts: pts.map(([x, y, z]) => { const v = g.mundoABase(new V(x, y, z)); return { p: { x, y, z }, base: [v.x, v.y, v.z] }; }) }; });
      const T = REF(id).world_base_link.individual.T;
      for (const { p: pw, base } of r.pts) { const j = porJSON(T, r.b, 0.76, pw); const e = Math.hypot(base[0] - j[0], base[1] - j[1], base[2] - j[2]); assert.ok(e <= 0.5e-3, `${id} ${JSON.stringify(pw)}: ${e * 1000} mm`); }
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

// Lee las posiciones (x, y, z) y los giros (yaw_rad) de los objetos de un posiciones.yaml exportado
function leerYaml(txt) {
  const out = {}; const num = (l, k) => { const m = l.match(new RegExp(`\\b${k}: (-?[\\d.]+)`)); return m ? +m[1] : undefined; };
  for (const l of txt.split('\n')) { const m = l.match(/^\s+(\w+): \{(.*)$/); if (m) out[m[1]] = { x: num(m[2], 'x'), y: num(m[2], 'y'), z: num(m[2], 'z'), yaw: num(m[2], 'yaw_rad') }; }
  return out;
}

test('T1.5-2 e I7: posiciones.yaml con el 203: cabecera (robot, frame con su prefijo, world SUPUESTO) e ida y vuelta ±0,5 mm', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const antes = await p.evaluate(() => window.__g.generarYaml());
    assert.match(antes, /^# Robot: nominal \(sin identificar/m); assert.match(antes, /^# Frame: base_link \(sin prefijo/m);
    await elegir(p, '203', 'rpMesa');
    const y = await p.evaluate(() => window.__g.generarYaml());
    const cab = y.split('\n').filter(l => l.startsWith('#') && !l.startsWith('# layout-json')).join('\n');
    assert.match(cab, /^# Robot: 203 \(calibration_203\.yaml del curso\), en la posición B de la celda/m);
    assert.match(cab, /^# Frame: base_link \(sin prefijo, como en sim_<id>\)\. Metros y radianes \(REP-103\), redondeo a 1 mm y 0,001 rad\.$/m);
    assert.match(cab, /^# world: los ejes de la mesa, .*\[SUPUESTO hasta comprobarlo en el laboratorio\]\.$/m);
    assert.match(cab, /^# base_link está girado -2\.356 rad \(−135,0°\) respecto a world/m);
    assert.match(y, /^robot_id: 203 /m); assert.match(y, /^frame: base_link$/m); assert.match(y, /^prefijo_frames: ''$/m);
    assert.ok(!/_deg\b/.test(y.replace(/^# layout-json.*$/m, '')), 'nada en grados (I7)');
    // cada línea con valores lleva su origen
    for (const l of y.split('\n').filter(l => /^\s*\w+: \{/.test(l))) assert.match(l, /# (.*)(MEDIDO|FABRICANTE|SUPUESTO)/, l);
    // ida y vuelta (I7): exportar → leer → comparar con la posición de cada objeto pasada a base_link con world_base_link
    // del JSON: cada coordenada a ±0,5 mm (redondeo a 1 mm) y cada giro a ±0,0005 rad (redondeo a 0,001 rad)
    const T = REF('203').world_base_link.individual.T, yaw = REF('203').world_base_link.individual.rpy[2];
    const obj = leerYaml(y), L = await p.evaluate(() => { const g = window.__g, l = g.L(); return { b: g.BASES[l.robot], zona: l.zona, plato1: l.plato1, persona: l.persona, m: l.arucoE[0] }; });
    for (const [k, ref] of [['zona_fruta', L.zona], ['plato_1', L.plato1], ['persona', L.persona], ['marcador_entrega_1', L.m]]) {
      const j = porJSON(T, L.b, 0.76, { x: ref.x, y: ref.y, z: 0.76 });
      assert.ok(Math.abs(obj[k].x - j[0]) <= 0.5e-3 + 1e-9 && Math.abs(obj[k].y - j[1]) <= 0.5e-3 + 1e-9, `${k}: (${obj[k].x}, ${obj[k].y}) frente a (${j[0]}, ${j[1]})`);
    }
    const giro = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    assert.ok(giro(obj.zona_fruta.yaw + yaw, L.zona.yaw) <= 0.0005 + 1e-9, 'giro de la zona'); assert.ok(giro(obj.persona.yaw + yaw, L.persona.yaw) <= 0.0005 + 1e-9, 'giro de la persona');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

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
    // pasar a un robot sin ese prefijo lo cambia y lo dice; al nominal, sin prefijo
    await p.click('.tabs [data-tab="escena"]'); await elegir(p, '205', 'rpMesa');
    assert.equal(await p.evaluate(() => window.__g.L().prefijoFrames), '205_');
    await elegir(p, 'nominal'); assert.equal(await p.evaluate(() => window.__g.L().prefijoFrames), '');
    await esperarToast(p, 'Robot nominal: base_link con el mismo giro que el 205; nada se mueve. Recalcula las trayectorias. Prefijo de frames: ninguno.');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
