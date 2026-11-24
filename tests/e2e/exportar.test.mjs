// world ↔ base_link por robot en la página (T1.5, I7): conversión de cada id contra su JSON, cabecera e ida y vuelta de
// posiciones.yaml y las correcciones 5, 7 y 9. La pregunta al cambiar de robot, el campo del prefijo de frames y las
// correcciones 1 y 2 están en cambio-robot.test.mjs (nivel de puerta, T2.0). TD.3 (DT42): posiciones.yaml con U+2028 en la
// disposición se lee igual con YAML 1.1 y 1.2 e Importar YAML la recupera; un posiciones.yaml de antes de TD.3 se sigue importando.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import YAML from 'yaml';
import { abrir, comprobar } from '../navegador.mjs';
import { sinFecha } from '../medir.mjs';
import { problemas11 } from '../yaml11.mjs';

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
  const out = {}; const num = (l, k) => { const m = l.match(new RegExp(`(?:^|, )'?${k}'?: (-?[\\d.]+)`)); return m ? +m[1] : undefined; }; // «'y'» entre comillas (TD.3)
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
    assert.match(cab, /^# world: el world del gemelo, con los ejes de la mesa .*\[SUPUESTO hasta comprobarlo en el laboratorio\]\.$/m);
    assert.match(cab, /^# base_link está girado -2\.356 rad \(−135,0°\) respecto a ese world/m);
    assert.match(y, /^robot_id: '203' /m); assert.match(y, /^frame: 'base_link'$/m); // DT35: entre comillas, como en los ficheros de ROS assert.match(y, /^prefijo_frames: ''$/m);
    // corrección 6: lo que depende del giro world → base_link es SUPUESTO; world es el del gemelo; la focal sigue en mm
    const linea = (t, k) => t.split('\n').find(l => l.startsWith(`${k}:`)) || '';
    assert.match(linea(y, 'world_a_base_link'), /# world del gemelo \(ejes de la mesa\): SUPUESTO · giro: mount_yaw − π del xacro del curso, SUPUESTO/);
    assert.match(linea(y, 'mesa'), /# medidas: MEDIDO · centro_en_base_link y yaw_rad: SUPUESTO \(giro world→base_link sin validar en ROS\)$/);
    assert.match(linea(antes, 'mesa'), /# MEDIDO$/, 'sin giro (nominal), la mesa sigue siendo MEDIDO');
    assert.ok(!/^pose_en_world_doble/m.test(y), 'sin prefijo no hay pose en el URDF doble');
    assert.match(y, /focal_mm: 3\.6, /);
    assert.ok(!/_deg\b/.test(y.replace(/^# layout-json.*$/m, '')), 'nada en grados (I7)');
    // cada línea con valores lleva su origen
    for (const l of y.split('\n').filter(l => /^\s*\w+: \{/.test(l))) assert.match(l, /# (.*)(MEDIDO|FABRICANTE|SUPUESTO)/, l);
    // ida y vuelta (I7): exportar → leer → comparar con la posición de cada objeto pasada a base_link con world_base_link
    // del JSON: cada coordenada a ±0,5 mm (redondeo a 1 mm) y cada giro a ±0,0005 rad (redondeo a 0,001 rad)
    const T = REF('203').world_base_link.individual.T, yaw = REF('203').world_base_link.individual.rpy[2];
    // TD.4: marcador_zona_1 (id 0), contra el centro de su dibujo en la zona de fruta
    const obj = leerYaml(y), L = await p.evaluate(() => {
      const g = window.__g, l = g.L(), mz = g.OBJ.zona.children.find(a => a.userData.id === 0 && a.userData.lado > 0).getWorldPosition(new (g.robot.root.position.constructor)());
      return { b: g.BASES[l.robot], zona: l.zona, plato1: l.plato1, persona: l.persona, m: l.arucoE[0], mz: { x: mz.x, y: mz.y } };
    });
    for (const [k, ref] of [['zona_fruta', L.zona], ['plato_1', L.plato1], ['persona', L.persona], ['marcador_entrega_1', L.m], ['marcador_zona_1', L.mz]]) {
      const j = porJSON(T, L.b, 0.76, { x: ref.x, y: ref.y, z: 0.76 });
      assert.ok(Math.abs(obj[k].x - j[0]) <= 0.5e-3 + 1e-9 && Math.abs(obj[k].y - j[1]) <= 0.5e-3 + 1e-9, `${k}: (${obj[k].x}, ${obj[k].y}) frente a (${j[0]}, ${j[1]})`);
    }
    const giro = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    assert.ok(giro(obj.zona_fruta.yaw + yaw, L.zona.yaw) <= 0.0005 + 1e-9, 'giro de la zona'); assert.ok(giro(obj.persona.yaw + yaw, L.persona.yaw) <= 0.0005 + 1e-9, 'giro de la persona');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

const avisosDesde = (p, n) => p.evaluate(n => window.__toastsPrueba.slice(n), n);

test('corrección 5: una v10 de solo lectura con un robot desconocido se exporta sin errores y la cabecera lo dice', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click('.tabs [data-tab="datos"]');
    const l = await p.evaluate(() => JSON.parse(JSON.stringify(window.__g.L())));
    const codigo = 'GEMELO1.' + Buffer.from(JSON.stringify({ v: 1, nombre: 'Futura', nota: '', layout: { ...l, version: 10, robotId: '207', prefijoFrames: '207_' } }), 'utf8').toString('base64');
    await p.evaluate(c => setTimeout(() => window.__g.abrirCodigo(c), 0), codigo); // como desde la interfaz: un error sería un pageerror
    await p.waitForFunction(() => window.__g.L().version === 10, null, { timeout: 30000, polling: 50 });
    const y = await p.evaluate(() => document.getElementById('yaml').value);
    assert.match(y, /^# Robot: «207» \(desconocido para esta versión del gemelo: se usa la cinemática nominal\)/m);
    assert.match(y, /^# Frame: 207_base_link \(prefijo «207_» de la disposición; esta versión del gemelo no conoce su URDF doble\)/m);
    assert.match(y, /^robot_id: '207'  # de la disposición; el gemelo no lo conoce y usa la cinemática nominal$/m);
    assert.equal(await p.evaluate(() => window.__g.ROB.id), 'nominal');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

// TD.3 (DT42). Los caracteres, con fromCharCode: este fichero no los lleva tal cual
const ch = c => String.fromCharCode(c), LS = ch(0x2028), PS = ch(0x2029), escape = c => `${ch(92)}u${c.toString(16).padStart(4, '0')}`;
test('TD.3-C1, C3 y C4 (DT42): U+2028 en una nota (v9) y en el robotId (v10 de solo lectura): posiciones.yaml se lee igual en YAML 1.1 y 1.2 e Importar YAML recupera la disposición; un posiciones.yaml de antes de TD.3 se sigue importando igual', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  const n = () => p.evaluate(() => window.__toastsPrueba.length);
  const aviso = (n0, t) => p.waitForFunction(([n0, t]) => window.__toastsPrueba.slice(n0).includes(t), [n0, t], { timeout: 60000, polling: 50 });
  const L = () => p.evaluate(() => JSON.stringify(window.__g.L()));
  const restablecer = async () => { const n0 = await n(); await p.evaluate(() => document.getElementById('btnReset').click()); await aviso(n0, 'Distribución de partida restaurada'); };
  const importar = async (yaml, t) => { const n0 = await n(); await p.evaluate(y => { document.getElementById('yamlIn').value = y; document.getElementById('btnImport').click(); }, yaml); await aviso(n0, t); };
  try {
    await p.click('.tabs [data-tab="datos"]');
    const l0 = await p.evaluate(() => JSON.parse(JSON.stringify(window.__g.L())));
    for (const [nombre, layout, t] of [
      ['v9 con U+2028 y U+2029 en una nota', { ...l0, nota: `uno${LS}falsa: 1${PS}dos` }, 'Distribución aplicada'],
      ['v10 de solo lectura con U+2028 en el robotId', { ...l0, version: 10, robotId: `207${LS}falso: 1` }, 'Distribución aplicada en solo lectura: es de una versión más nueva del gemelo'],
    ]) {
      // la escena se abre con su código (nombre y nota de la escena con U+2028 también)
      const codigo = 'GEMELO1.' + Buffer.from(JSON.stringify({ v: 1, nombre: `Rara${LS}escena`, nota: `nota${PS}`, layout }), 'utf8').toString('base64');
      await p.evaluate(c => setTimeout(() => window.__g.abrirCodigo(c), 0), codigo); // como desde la interfaz: un error sería un pageerror
      await p.waitForFunction(j => JSON.stringify(window.__g.L()) === j, JSON.stringify(layout), { timeout: 60000, polling: 50 });
      const antes = await L(), y = await p.evaluate(() => window.__g.generarYaml());
      assert.ok(!y.includes(LS) && !y.includes(PS), `${nombre}: ni U+2028 ni U+2029 tal cual`);
      assert.ok(y.split('\n').find(l => l.startsWith('# layout-json: ')).includes(escape(0x2028)), `${nombre}: U+2028 escapado en la línea «# layout-json:»`);
      assert.deepEqual(YAML.parse(y, { version: '1.1' }), YAML.parse(y), `${nombre}: el mismo objeto con YAML 1.1 y 1.2`);
      assert.deepEqual(problemas11(y), [], `${nombre}: sin clave falsa ni nada que YAML 1.1 lea distinto`);
      // otra disposición y vuelta con Importar YAML: la misma disposición, byte a byte en JSON
      await restablecer(); assert.notEqual(await L(), antes);
      await importar(y, t);
      assert.equal(await L(), antes, `${nombre}: Importar YAML recupera la disposición igual`);
    }
    // C4: el posiciones.yaml que exportaba el gemelo antes de TD.3 (9393f30: fecha y claves «y» sin comillas, layout-json sin
    // escapes), del caso 203 con prefijo: se importa y da la misma disposición, y exportarla da la referencia de ahora
    const antiguo = fs.readFileSync(path.join(RAIZ, 'tests/fixtures/yaml-antes-td3/203-prefijo.yaml'), 'utf8');
    assert.match(antiguo, /^fecha: \d{4}-\d{2}-\d{2}$/m); assert.match(antiguo, /^ {2}plato_1: \{x: -?[\d.]+, y: /m);
    await restablecer();
    await importar(antiguo, 'Distribución aplicada · Esta escena usa el robot 203: cambian la cinemática y el giro de la base (−135,0°)'); // de nominal al 203
    assert.equal(await L(), antiguo.match(/^# layout-json: (\{.*\})$/m)[1], 'la disposición del fichero antiguo, tal cual');
    assert.equal(sinFecha(await p.evaluate(() => window.__g.generarYaml())), sinFecha(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/yaml/203-prefijo.yaml'), 'utf8')), 'exportada de nuevo: la referencia de ahora');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('corrección 7: con el 203, los topics simulados dan los giros en base_link, en (−180°, 180°]', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await elegir(p, '203', 'rpMesa');
    const r = await p.evaluate(async () => {
      const g = window.__g, log = () => [...document.querySelectorAll('#dLog li')].map(li => li.textContent);
      await g.ensayo({ vel: 0.25, fase: 0, sinRender: true, limite: 400, modo: 'M0', amp: 0, hasta: () => log().some(t => t.includes('/pinza/cerrar')) });
      const e = g.robot.tool0.matrixWorld.elements; // la pinza está bajada sobre la pieza: su giro es el del agarre
      return { log: log(), yawPinza: Math.atan2(e[1], e[0]), yawBandeja: g.bandeja.rotation.z, yawBase: g.ROB.yaw };
    });
    const deg = a => { let g = Math.round(Math.atan2(Math.sin(a), Math.cos(a)) * 1800 / Math.PI) / 10; if (g <= -180) g += 360; return g; };
    const tray = r.log.find(t => t.includes('/v1/tray_pose')), serv = r.log.find(t => t.includes('servir_pieza'));
    assert.ok(tray && serv, r.log.join('\n'));
    assert.equal(+tray.match(/yaw_deg: (-?[\d.]+)/)[1], deg(r.yawBandeja - r.yawBase), tray);
    assert.match(serv, /marco_giro: base_link/);
    const giro = +serv.match(/giro_pinza_deg: (-?\d+)/)[1], esperado = deg(r.yawPinza - r.yawBase);
    assert.ok(giro > -180 && giro <= 180);
    const resto = ((giro - esperado) % 180 + 180) % 180; // la pinza vertical es simétrica: el agarre puede salir girado 180°
    assert.ok(Math.min(resto, 180 - resto) <= 0.6, `giro_pinza_deg ${giro} frente al de la pinza en base_link ${esperado}`);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('corrección 9: abrir una escena guardada con otro robot lo aplica y lo avisa; el selector no repite el aviso', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    let n0 = await p.evaluate(() => window.__toastsPrueba.length);
    await elegir(p, '203', 'rpMesa');
    const codigo = await p.evaluate(() => { document.getElementById('escNombre').value = 'Con el 203'; return window.__g.codigoEscena(); });
    await elegir(p, 'nominal', 'rpMesa');
    assert.ok(!(await avisosDesde(p, n0)).some(t => t.includes('Esta escena usa el robot')), 'el selector no da el aviso de escena');
    n0 = await p.evaluate(() => window.__toastsPrueba.length);
    await p.evaluate(c => window.__g.abrirCodigo(c), codigo);
    await esperarRobot(p, '203');
    await p.waitForFunction(n => window.__toastsPrueba.slice(n).some(t => t.includes('Esta escena usa el robot 203: cambian la cinemática y el giro de la base')), n0, { timeout: 30000, polling: 50 });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
