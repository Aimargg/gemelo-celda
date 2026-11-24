// Unitario de los formateadores de T2.3 (escena de colisión) y T2.5 (cámaras) de src/exportar.js (Común-C2): cargado en un
// contexto vm vacío (sin ROB, L, CAMS, DOM ni three), con un modelo hecho a mano. Los textos esperados están escritos aquí a
// mano a partir del modelo (las cuentas, en los comentarios), no copiados de la salida; los cuaterniones que no son la
// identidad se comprueban con su fórmula, aparte del módulo. Los validadores de tests/ revisan además cada fichero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { problemasParams } from '../rcl-params.mjs';
import { problemasEscena } from '../collision-object.mjs';
import { problemasScene } from '../scene-texto.mjs';
import { problemasCameraInfo } from '../camera-info.mjs';
const require = createRequire(import.meta.url);
const ORIGEN = require('../../src/origen.js');
const SENSOR = require('../../src/sensor.js');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPORTAR = (() => { const m = { exports: null }; vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'src/exportar.js'), 'utf8'), { module: m }); return m.exports; })();
const plano = o => JSON.parse(JSON.stringify(o));
const PI = Math.PI;

// Modelo a mano: robot nominal en B, sin prefijo ni giro; layoutJson vacío (huella 811c9dc5). La escena: la mesa (caja con su
// forma 381 mm por debajo de su pose), una caja sin giro, un plato (cilindro de radio 80 mm y altura 25 mm, distintos) y una
// cámara sin giro con una esfera y una cápsula de 300 mm a lo largo de +x (un cilindro y dos esferas).
const sensor = id => ({ id, ...SENSOR.de(id) });
const MODELO = {
  ctx: { robotId: 'nominal', sospechoso: false, yaw: 0, sensor: sensor('elp-ficha'), tcpZ: 0.2 },
  layoutJson: '',
  robot: { posicion: 'B', id: 'nominal', idLayout: 'nominal', desconocido: false, sospechoso: false, yaw: 0, prefijo: '', frame: 'base_link', worldABase: { x: 0, y: 0, z: 0 }, doble: null },
  escena: {
    objetos: [
      { id: 'mesa', que: 'mesa', pose: { x: -0.434, y: -0.269, z: 0, rpy: [0, 0, 0] }, formas: [{ tipo: 'caja', dims: [1.18, 0.83, 0.76], local: { x: 0, y: 0, z: -0.381 } }] },
      { id: 'caja_plato_1', que: 'caja', giro: 'base', pose: { x: 0.1, y: -0.2, z: 0.05, rpy: [0, 0, 0] }, formas: [{ tipo: 'caja', dims: [0.1, 0.1, 0.1] }] },
      { id: 'plato_1', que: 'plato', pose: { x: 0.1, y: -0.2, z: 0.1, rpy: [0, 0, 0] }, formas: [{ tipo: 'cilindro', radio: 0.08, altura: 0.025, local: { x: 0, y: 0, z: 0.0125 } }] },
      { id: 'camara_cenital', que: 'camara', pose: { x: 0, y: 0, z: 0.5, rpy: [0, 0, 0] }, formas: [{ tipo: 'esfera', radio: 0.032, centro: { x: -0.008, y: 0, z: 0.5 } }, { tipo: 'capsula', radio: 0.012, a: { x: 0.1, y: 0, z: 0.5 }, b: { x: 0.4, y: 0, z: 0.5 } }] },
    ],
  },
  // 3,6 mm en 1920 × 1080 con el sensor de la ficha (5,952 mm de ancho; alto útil 5,952·1080/1920 = 3,348 mm)
  camaras: [{ clave: 'cenital', grupo: 'V2', modelo: 'ELP-USB12MP01-UFV', focal: 3.6, modo: '1920x1080', hfov: 2 * Math.atan(5.952 / 7.2), vfov: 2 * Math.atan(3.348 / 7.2), px: { w: 1920, h: 1080, fps: 120 }, pos: { x: 0, y: 0, z: 0.5 }, mira: { x: 0.5, y: 0, z: 0 }, clamp: { x: 0, y: -0.6, z: 0 }, orient: { pan: PI / 2, tilt: PI / 4, roll: 0 }, rpy: [0, PI / 4, 0], usb: { dispositivo: '/dev/video0', exposicion: 50, balance: 4000 } }],
  // lo que leen parametros_celda.yaml y las TF (T2.2 + T2.4), como en tests/unit/exportar.test.mjs
  pinza: { modelo: 'OnRobot RG2', tcpZ: 0.2, carrera: 0.11 },
  mesa: { ancho: 1.18, fondo: 0.83, alto: 0.76, x: -0.434, y: -0.269, z: 0, yaw: 0 },
  pedido: 2,
  platos: { sobreCaja: true, cajaAlto: 0.1, cajaLado: 0.1, agarre: 'horizontal_por_el_borde', radioAgarre: 0.082, lista: [{ clave: 'plato_1', x: 0.1, y: -0.2, z: 0.1 }, { clave: 'plato_2', x: -0.1, y: -0.2, z: 0.1 }] },
  zona: { x: -0.3, y: 0.0004, z: 0, yaw: PI / 2, ancho: 0.22, fondo: 0.16 },
  marcadores: [{ id: 4, uso: 'entrega', diccionario: 'DICT_4X4_50', lado: 0.06, x: 0.05, y: -0.17, z: 0, yaw: 0 }],
  bandeja: { x: 0.45, y: 0.05, z: 0.24, yaw: PI, zonas: [{ clave: 'zona_primero', base: { x: 0.47, y: -0.05, z: 0.2404 }, local: { x: -0.02, y: 0.1, z: 0.0004 } }] },
  persona: { x: 0.85, y: 0.05, z: 0, yaw: PI },
};
// El mismo con el 203: base_link girado −135° respecto al world de sim_203, sin prefijo
const G = -3 * PI / 4;
const MODELO_203 = plano(MODELO);
Object.assign(MODELO_203.ctx, { robotId: '203', yaw: G });
Object.assign(MODELO_203.robot, { id: '203', idLayout: '203', yaw: G });
// Y con un URDF doble que traslada la base (los números del 204 en doble_ur3e_203_204: x 0,0051, y −0,9, yaw 2,5028 − π)
const MODELO_DOBLE = plano(MODELO_203);
Object.assign(MODELO_DOBLE.robot, { prefijo: '203_', frame: '203_base_link', doble: { nombre: 'doble_ur3e_203_204', x: 0.0051, y: -0.9, z: 0, yaw: 2.502802148 - PI } });
const fichero = (m, nombre) => EXPORTAR.todos(m, ORIGEN).find(f => f.nombre === nombre).texto;
const bloque = (texto, desde, n) => { const ls = texto.split('\n'), i = ls.indexOf(desde); assert.ok(i >= 0, `falta la línea «${desde}»`); return ls.slice(i, i + n).join('\n'); };
const ID = "{'x': 0.000000000, 'y': 0.000000000, 'z': 0.000000000, 'w': 1.000000000}";
// Cuaternión (x, y, z, w) de un texto «x y z w» o de un flujo YAML, frente a uno esperado: ±1e-9 por componente (9 decimales)
const cercaQ = (q, esperado, que) => { assert.equal(q.length, 4); q.forEach((v, i) => assert.ok(Math.abs(v - esperado[i]) <= 1.5e-9, `${que}: ${q} frente a ${esperado}`)); assert.ok(Math.abs(q.reduce((s, v) => s + v * v, 0) - 1) < 1e-9, `${que}: normalizado`); };

test('Común-C2: todos() da los ficheros de T2.2 + T2.4 (sin cambiar), después los de la escena y después los de las cámaras, en orden fijo', () => {
  const todos = plano(EXPORTAR.todos(MODELO_DOBLE, ORIGEN)), antes = plano(EXPORTAR.ficherosRos(MODELO_DOBLE, ORIGEN));
  assert.deepEqual(todos.slice(0, antes.length), antes);
  assert.deepEqual(todos.slice(antes.length).map(f => f.nombre), ['escena_colision.yaml', 'celda.scene', 'celda.scene.txt', 'camera_info/camara_cenital.yaml', 'usb_cam/camara_cenital.yaml']);
  assert.deepEqual(todos.slice(antes.length), plano([...EXPORTAR.ficherosEscena(MODELO_DOBLE, ORIGEN), ...EXPORTAR.ficherosCamaras(MODELO_DOBLE, ORIGEN)]));
  assert.deepEqual(plano(EXPORTAR.todos(MODELO_DOBLE, ORIGEN)), todos, 'dos exportaciones, los mismos bytes');
  for (const f of todos) assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(f.texto), `${f.nombre}: sin fecha`);
});

test('Común-C2 y T2.3: escena_colision.yaml del modelo a mano: una caja, un cilindro y una esfera, con su texto', () => {
  const y = fichero(MODELO, 'escena_colision.yaml');
  assert.deepEqual(problemasEscena(y, { frame: 'base_link' }), []);
  assert.equal(y.split('\n')[0], '# escena_colision.yaml · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR');
  assert.match(y, /^# Huella de la disposición: 811c9dc5 /m);
  assert.match(y, /^# Carga: un nodo del grupo lo lee con yaml\.safe_load, rellena cada moveit_msgs\/CollisionObject con rosidl_runtime_py\.set_message_fields y los envía con el servicio apply_planning_scene/m);
  assert.match(y, /^# Giro de las cajas: provisional, hacia la base del robot/m);
  assert.ok(!/^\s+operation:/m.test(y), 'sin operation');
  assert.equal(bloque(y, 'objetos:', 10), [
    'objetos:',
    "  - header: {frame_id: 'base_link'}  # elegido en el gemelo (el prefijo; base_link es el del URDF)",
    "    id: 'mesa'  # SUPUESTO (id propuesto)",
    '    pose:',
    `      position: {'x': -0.434, 'y': -0.269, 'z': 0.000}  # MEDIDO; la de su TF mesa (centro de la cara de arriba)`,
    `      orientation: ${ID}  # MEDIDO`,
    '    primitives:',
    '      - {type: 1, dimensions: [1.180, 0.830, 0.760]}  # MEDIDO · BOX [x, y, z]',
    '    primitive_poses:',
    `      - {position: {'x': 0.000, 'y': 0.000, 'z': -0.381}, orientation: ${ID}}  # SUPUESTO (cara de arriba 1 mm por debajo de base_link, como el suelo del profesor); centro a media altura de la mesa`,
  ].join('\n'));
  // el plato: CYLINDER [altura, radio] = [0,025, 0,080]; su forma, medio grosor (12,5 mm → 13 mm) por encima de su pose
  assert.equal(bloque(y, "    id: 'plato_1'  # SUPUESTO (id propuesto)", 7), [
    "    id: 'plato_1'  # SUPUESTO (id propuesto)",
    '    pose:',
    "      position: {'x': 0.100, 'y': -0.200, 'z': 0.100}  # SUPUESTO (disposición propuesta, sin medir); la de su TF plato_1_inicio",
    `      orientation: ${ID}  # SUPUESTO (disposición propuesta, sin medir); la de su TF plato_1_inicio`,
    '    primitives:',
    '      - {type: 3, dimensions: [0.025, 0.080]}  # SUPUESTO (sin medir): radio · SUPUESTO (perfil del plato del gemelo, sin medir): altura · CYLINDER [altura, radio]',
    '    primitive_poses:',
  ].join('\n'));
  assert.ok(y.includes(`      - {position: {'x': 0.000, 'y': 0.000, 'z': 0.013}, orientation: ${ID}}  # SUPUESTO (perfil del plato del gemelo, sin medir): medio grosor por encima de su TF\n`));
  // la cámara: la esfera, 8 mm por detrás de su pose; la cápsula de (0,1, 0, 0,5) a (0,4, 0, 0,5): un cilindro de 300 mm con su
  // centro en (0,25, 0, 0) del objeto y una esfera en cada extremo, (0,1, 0, 0) y (0,4, 0, 0)
  const cam = y.slice(y.indexOf("    id: 'camara_cenital'"));
  assert.equal(bloque(cam, '    primitives:', 10), [
    '    primitives:',
    '      - {type: 2, dimensions: [0.032]}  # SUPUESTO (modelo de colisión del gemelo, sin medir) · SPHERE [radio]',
    '      - {type: 3, dimensions: [0.300, 0.012]}  # SUPUESTO (modelo de colisión del gemelo, sin medir) · CYLINDER [altura, radio]: tramo de una cápsula',
    '      - {type: 2, dimensions: [0.012]}  # SUPUESTO (modelo de colisión del gemelo, sin medir) · SPHERE [radio]: extremo de una cápsula',
    '      - {type: 2, dimensions: [0.012]}  # SUPUESTO (modelo de colisión del gemelo, sin medir) · SPHERE [radio]: extremo de una cápsula',
    '    primitive_poses:',
    `      - {position: {'x': -0.008, 'y': 0.000, 'z': 0.000}, orientation: ${ID}}  # SUPUESTO (modelo de colisión del gemelo, sin medir)`,
    cam.split('\n')[cam.split('\n').indexOf('    primitive_poses:') + 2],
    `      - {position: {'x': 0.100, 'y': 0.000, 'z': 0.000}, orientation: ${ID}}  # SUPUESTO (modelo de colisión del gemelo, sin medir)`,
    `      - {position: {'x': 0.400, 'y': 0.000, 'z': 0.000}, orientation: ${ID}}  # SUPUESTO (modelo de colisión del gemelo, sin medir)`,
  ].join('\n'));
  // el cilindro: en (0,25, 0, 0) y su eje +z llevado a +x, un cuarto de vuelta en y: (0, sen 45°, 0, cos 45°)
  const c = YAML.parse(y).objetos.find(o => o.id === 'camara_cenital').primitive_poses[1];
  assert.deepEqual(c.position, { x: 0.25, y: 0, z: 0 });
  cercaQ(['x', 'y', 'z', 'w'].map(k => c.orientation[k]), [0, Math.SQRT1_2, 0, Math.SQRT1_2], 'eje del cilindro');
});

test('Común-C2 y T2.3: celda.scene del modelo a mano (world = base_link, sin giro): cylinder radio longitud, box y sphere, con su texto', () => {
  const s = fichero(MODELO, 'celda.scene');
  assert.deepEqual(problemasScene(s), []);
  assert.ok(!s.includes('#'), 'sin comentarios');
  const I = '0.000000000 0.000000000 0.000000000 1.000000000';
  assert.equal(s.split('\n').slice(0, 23).join('\n'), [
    'gemelo_celda_811c9dc5',
    '* mesa', '-0.434 -0.269 0.000', I, '1', 'box', '1.180 0.830 0.760', '0.000 0.000 -0.381', I, '0.300 0.300 0.320 1.000', '0',
    '* caja_plato_1', '0.100 -0.200 0.050', I, '1', 'box', '0.100 0.100 0.100', '0.000 0.000 0.000', I, '0.760 0.600 0.420 1.000', '0',
    '* plato_1', '0.100 -0.200 0.100',
  ].join('\n'));
  assert.ok(s.includes(`* plato_1\n0.100 -0.200 0.100\n${I}\n1\ncylinder\n0.080 0.025\n0.000 0.000 0.013\n${I}\n0.960 0.950 0.930 1.000\n0\n`), 'cylinder radio longitud: 0.080 0.025 (en el YAML, [0.025, 0.080])');
  assert.ok(s.includes(`* camara_cenital\n0.000 0.000 0.500\n${I}\n4\nsphere\n0.032\n-0.008 0.000 0.000\n${I}\n0.080 0.080 0.090 1.000\ncylinder\n0.012 0.300\n0.250 0.000 0.000\n`));
  assert.ok(s.endsWith(`sphere\n0.012\n0.400 0.000 0.000\n${I}\n0.080 0.080 0.090 1.000\n0\n.\n`));
});

test('Común-C2 y T2.3: con el giro de −135° (sim_203), el .scene gira cada objeto a world y las formas no cambian; el YAML sigue en base_link', () => {
  const y = fichero(MODELO_203, 'escena_colision.yaml'), s = fichero(MODELO_203, 'celda.scene'), t = fichero(MODELO_203, 'celda.scene.txt');
  assert.deepEqual(problemasEscena(y, { frame: 'base_link' }), []); assert.deepEqual(problemasScene(s), []);
  assert.ok(y.includes("      position: {'x': -0.434, 'y': -0.269, 'z': 0.000}  # SUPUESTO (giro world→base_link sin validar en ROS); la de su TF mesa"), 'el YAML no cambia de frame; la pose de la mesa depende del giro: SUPUESTO');
  // mesa: Rz(−135°)·(−0,434, −0,269) = (0,7071·0,434 − 0,7071·0,269, 0,7071·0,434 + 0,7071·0,269) = (0,117, 0,497)
  const ls = s.split('\n'), i = ls.indexOf('* mesa');
  assert.equal(ls[i + 1], '0.117 0.497 0.000');
  cercaQ(ls[i + 2].split(' ').map(Number), [0, 0, Math.sin(G / 2), Math.cos(G / 2)], 'giro de la mesa en world');
  assert.deepEqual(ls.slice(i + 3, i + 10), ['1', 'box', '1.180 0.830 0.760', '0.000 0.000 -0.381', '0.000000000 0.000000000 0.000000000 1.000000000', '0.300 0.300 0.320 1.000', '0'], 'la forma y su pose relativa, iguales');
  assert.match(t, /^# celda\.scene está en el world de sim_<id> \(el URDF de un solo robot\), no en base_link: /m);
  assert.match(t, /^# En ese world, base_link está en \(0\.000, 0\.000, 0\.000\) m con yaw -2\.356 rad \(−135,0°\): p_world = Rz\(yaw\)·p_base_link \+ \(x, y, z\) \[SUPUESTO \(sin validar en ROS\)\]\.$/m);
  assert.match(t, /load_geometry_from_file responde success: true aunque el fichero esté mal formado/);
  assert.match(t, /^#   mesa: SUPUESTO \(giro world→base_link sin validar en ROS\)/m);
});

test('Común-C2 y T2.3: con prefijo y URDF doble, el .scene está en el world del doble (con su traslación) y el YAML en <prefijo>base_link', () => {
  const y = fichero(MODELO_DOBLE, 'escena_colision.yaml'), s = fichero(MODELO_DOBLE, 'celda.scene'), t = fichero(MODELO_DOBLE, 'celda.scene.txt');
  assert.deepEqual(problemasEscena(y, { frame: '203_base_link' }), []); assert.deepEqual(problemasScene(s), []);
  assert.match(y, /^ {2}- header: \{frame_id: '203_base_link'\} {2}# elegido en el gemelo/m);
  // mesa: Rz(2,502802148 − π)·(−0,434, −0,269) + (0,0051, −0,9) = (−0,504, −0,857)
  const ls = s.split('\n'), i = ls.indexOf('* mesa'), a = 2.502802148 - PI;
  assert.equal(ls[i + 1], '-0.504 -0.857 0.000');
  cercaQ(ls[i + 2].split(' ').map(Number), [0, 0, Math.sin(a / 2), Math.cos(a / 2)], 'giro de la mesa en el world del doble');
  assert.match(t, /^# celda\.scene está en el world del URDF doble doble_ur3e_203_204\.urdf\.xacro, no en 203_base_link: /m);
  assert.match(t, /^# En ese world, 203_base_link está en \(0\.005, -0\.900, 0\.000\) m con yaw -0\.639 rad \(−36,6°\): .*\[SUPUESTO \(sin validar en ROS\)\]\.$/m);
});

test('Común-C2 y T2.5: camera_info/camara_cenital.yaml del modelo a mano, entero', () => {
  const c = fichero(MODELO, 'camera_info/camara_cenital.yaml');
  assert.deepEqual(problemasCameraInfo(c), []);
  // fx = 960/tan(hfov/2) = 960·7,2/5,952 = 1161,290; fy = 540·7,2/3,348 = 1161,290; cx = 1919/2 = 959,5; cy = 1079/2 = 539,5
  assert.equal(c, [
    '# camera_info/camara_cenital.yaml · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR',
    '# Robot: nominal (sin identificar: cinemática nominal del UR3e), en la posición B de la celda (derecha en la foto cenital).',
    '# Frame: base_link (sin prefijo, como en sim_<id>). Metros y radianes (REP-103), redondeo a 1 mm y 0,001 rad.',
    '# Huella de la disposición: 811c9dc5 (FNV-1a de 32 bits de JSON.stringify(L), en UTF-8): casa este fichero con su disposición.',
    '# Carga: el camera_info_url de usb_cam/camara_cenital.yaml: cópialo a ${ROS_HOME}/camera_info/camara_cenital.yaml (por defecto ~/.ros/camera_info/) [SIN VALIDAR en ROS: U4].',
    '# Cámara cenital: ELP-USB12MP01-UFV, focal 3.6 mm (focal_mm, DT19), modo 1920x1080 (1920 × 1080 a 120.0 fps), sensor «ELP ficha» de 5,952 mm de ancho útil.',
    '# K en píxeles, de lente ideal y con el modelo de la cámara con la que el gemelo pinta lo que ve: fx = (w/2)/tan(hfov/2) y fy = (h/2)/tan(vfov/2), con hfov 1.382 rad y vfov 0.871 rad;',
    '#   cx = (w − 1)/2 y cy = (h − 1)/2: el píxel (0, 0) tiene su centro en 0, como en OpenCV y ROS. Números de las matrices con 3 decimales.',
    '# D = 0 (plumb_bob), R = I y P = [K | 0]. Nominal: lo sustituye la calibración intrínseca (F4) guardada con el mismo camera_name (camara_cenital) en la misma ruta.',
    '# Origen de cada valor, al final de su línea: MEDIDO, FABRICANTE o SUPUESTO; lo que se elige en el gemelo, «elegido en el gemelo».',
    'image_width: 1920  # elegido en el gemelo (modo 1920x1080)',
    'image_height: 1080  # elegido en el gemelo (modo 1920x1080)',
    "camera_name: 'camara_cenital'  # SUPUESTO (nombre propuesto); el de usb_cam/camara_cenital.yaml",
    'camera_matrix:',
    '  rows: 3  # FABRICANTE (formato de camera_info)',
    '  cols: 3  # FABRICANTE (formato de camera_info)',
    '  data: [1161.290, 0.000, 959.500, 0.000, 1161.290, 539.500, 0.000, 0.000, 1.000]  # SUPUESTO (lente ideal, sensor elp-ficha); focal y modo: elegido en el gemelo',
    "distortion_model: 'plumb_bob'  # SUPUESTO (lente ideal, sin distorsión)",
    'distortion_coefficients:',
    '  rows: 1  # FABRICANTE (formato de camera_info)',
    '  cols: 5  # FABRICANTE (formato de camera_info)',
    '  data: [0.000, 0.000, 0.000, 0.000, 0.000]  # SUPUESTO (lente ideal, sin distorsión)',
    'rectification_matrix:',
    '  rows: 3  # FABRICANTE (formato de camera_info)',
    '  cols: 3  # FABRICANTE (formato de camera_info)',
    '  data: [1.000, 0.000, 0.000, 0.000, 1.000, 0.000, 0.000, 0.000, 1.000]  # FABRICANTE (formato de camera_info)',
    'projection_matrix:',
    '  rows: 3  # FABRICANTE (formato de camera_info)',
    '  cols: 4  # FABRICANTE (formato de camera_info)',
    '  data: [1161.290, 0.000, 959.500, 0.000, 0.000, 1161.290, 539.500, 0.000, 0.000, 0.000, 1.000, 0.000]  # SUPUESTO (lente ideal, sensor elp-ficha); focal y modo: elegido en el gemelo: P = [K | 0]',
    '',
  ].join('\n'));
});

test('Común-C2 y T2.5: usb_cam/camara_cenital.yaml del modelo a mano: rcl, enteros de usb_cam y sin camera_frame_id', () => {
  const u = fichero(MODELO, 'usb_cam/camara_cenital.yaml');
  assert.deepEqual(problemasParams(u, { enteros: ['image_width', 'image_height', 'exposure', 'white_balance'] }), []);
  assert.match(u, /^# Carga: ros2 run usb_cam usb_cam_node_exe --ros-args -r __ns:=\/camara_cenital --params-file usb_cam\/camara_cenital\.yaml /m);
  assert.match(u, /^# Sustituye al camera_frame_id del launch del curso, que usb_cam no declara/m);
  assert.equal(bloque(u, '/**:', 14), [
    '/**:',
    '  ros__parameters:',
    "    video_device: '/dev/video0'  # SUPUESTO (compruébalo con v4l2-ctl --list-devices; mejor un /dev/v4l/by-id/…)",
    '    framerate: 120.0  # elegido en el gemelo (modo 1920x1080)',
    '    image_width: 1920  # elegido en el gemelo (modo 1920x1080)',
    '    image_height: 1080  # elegido en el gemelo (modo 1920x1080)',
    "    pixel_format: 'mjpeg2rgb'  # SUPUESTO (MJPEG decodificado por usb_cam)",
    "    camera_name: 'camara_cenital'  # SUPUESTO (nombre propuesto); el de camera_info/camara_cenital.yaml",
    "    frame_id: 'camara_cenital_optical'  # SUPUESTO (nombre propuesto); el marco óptico de su TF (tf/camara_cenital_optical.yaml)",
    "    camera_info_url: 'file://${ROS_HOME}/camera_info/camara_cenital.yaml'  # FABRICANTE (ruta por defecto de camera_info_manager)",
    '    autoexposure: false  # SUPUESTO (5 ms: la bandeja en movimiento pide ≤ 5,6 ms; con luz de 50 Hz puede dar bandas)',
    '    exposure: 50  # SUPUESTO (5 ms: la bandeja en movimiento pide ≤ 5,6 ms; con luz de 50 Hz puede dar bandas)',
    '    auto_white_balance: false  # SUPUESTO (sin medir la luz del laboratorio)',
    '    white_balance: 4000  # SUPUESTO (sin medir la luz del laboratorio)',
  ].join('\n'));
  assert.ok(!u.includes('camera_frame_id:'));
});

test('T2.3: un tramo de cápsula de menos de 1 mm no da un cilindro de altura 0 (lo cubren sus dos esferas); una forma desconocida falla', () => {
  const m = plano(MODELO); m.escena.objetos[3].formas[1].b = { x: 0.1, y: 0, z: 0.5002 };
  const y = fichero(m, 'escena_colision.yaml');
  assert.deepEqual(problemasEscena(y, { frame: 'base_link' }), []);
  assert.equal(YAML.parse(y).objetos[3].primitives.map(p => p.type).join(), '2,2,2');
  const mal = plano(MODELO); mal.escena.objetos[0].formas[0].tipo = 'cono';
  assert.throws(() => EXPORTAR.todos(mal, ORIGEN), /forma desconocida/);
});
