// Unitario del formateador de los ficheros exportados (src/exportar.js, T2.2 y T2.4, Común-C2): cargado en un contexto vm
// vacío (sin ROB, L, CAMS, DOM ni three), con un modelo hecho a mano. El origen lo da src/origen.js, que el formateador
// recibe como argumento. Los textos esperados están escritos aquí a mano a partir del modelo, no copiados de la salida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { problemasParams } from '../rcl-params.mjs';
import YAML from 'yaml';
import { problemas11 } from '../yaml11.mjs';
const require = createRequire(import.meta.url);
const ORIGEN = require('../../src/origen.js');
const SENSOR = require('../../src/sensor.js');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'src/exportar.js'), 'utf8');
const EXPORTAR = (() => { const m = { exports: null }; vm.runInNewContext(FUENTE, { module: m }); return m.exports; })();
const plano = o => JSON.parse(JSON.stringify(o)); // los objetos del contexto vm son de otro reino: se compara su contenido
const PI = Math.PI;

// Modelo hecho a mano: robot nominal en B, sin prefijo ni giro, caja de 10 cm y dos platos; layoutJson vacío (huella de '')
const sensor = id => ({ id, ...SENSOR.de(id) });
const MODELO = {
  ctx: { robotId: 'nominal', sospechoso: false, yaw: 0, sensor: sensor('elp-ficha'), tcpZ: 0.2 },
  layoutJson: '',
  robot: { posicion: 'B', id: 'nominal', idLayout: 'nominal', desconocido: false, sospechoso: false, yaw: 0, prefijo: '', frame: 'base_link', worldABase: { x: 0, y: 0, z: 0 }, doble: null },
  pinza: { modelo: 'OnRobot RG2', tcpZ: 0.2, carrera: 0.11 },
  mesa: { ancho: 1.18, fondo: 0.83, alto: 0.76, x: -0.434, y: -0.269, z: 0, yaw: 0 },
  pedido: 2,
  platos: { sobreCaja: true, cajaAlto: 0.1, cajaLado: 0.1, agarre: 'horizontal_por_el_borde', radioAgarre: 0.082, lista: [{ clave: 'plato_1', x: 0.1, y: -0.2, z: 0.1 }, { clave: 'plato_2', x: -0.1, y: -0.2, z: 0.1 }] },
  zona: { x: -0.3, y: 0.0004, z: 0, yaw: PI / 2, ancho: 0.22, fondo: 0.16 },
  marcadores: [{ id: 4, uso: 'entrega', diccionario: 'DICT_4X4_50', lado: 0.06, x: 0.05, y: -0.17, z: 0, yaw: 0 }, { id: 5, uso: 'entrega', diccionario: 'DICT_4X4_50', lado: 0.06, x: 0.12, y: -0.32, z: 0, yaw: 0 }],
  bandeja: { x: 0.45, y: 0.05, z: 0.24, yaw: PI, zonas: [{ clave: 'zona_primero', base: { x: 0.47, y: -0.05, z: 0.2404 }, local: { x: -0.02, y: 0.1, z: 0.0004 } }, { clave: 'zona_segundo', base: { x: 0.47, y: 0.15, z: 0.2404 }, local: { x: -0.02, y: -0.1, z: 0.0004 } }] },
  persona: { x: 0.85, y: 0.05, z: 0, yaw: PI },
  camaras: [{ clave: 'cenital', grupo: 'V2', modelo: 'ELP-USB12MP01-UFV', focal: 3.6, modo: '1920x1080', hfov: 1.3822, pos: { x: 0, y: 0, z: 0.5 }, mira: { x: 0.5, y: 0, z: 0 }, clamp: { x: 0, y: -0.6, z: 0 }, orient: { pan: PI / 2, tilt: PI / 4, roll: 0.1 }, rpy: [-0.1, PI / 4, 0] }],
};
// El mismo con el 203: prefijo «203_» del URDF doble, base_link girado −135° y los platos sobre la mesa (sin caja)
const G = -3 * PI / 4;
const MODELO_203 = plano(MODELO);
Object.assign(MODELO_203.ctx, { robotId: '203', yaw: G });
Object.assign(MODELO_203.robot, { id: '203', idLayout: '203', yaw: G, prefijo: '203_', frame: '203_base_link', doble: { nombre: 'doble_ur3e_203_204', x: 0, y: 0, z: 0, yaw: 0.785398163 - PI } });
Object.assign(MODELO_203.mesa, { yaw: -G });
Object.assign(MODELO_203.platos, { sobreCaja: false });
const ENTEROS = { enteros: ['celda.marcadores.ids'] };
const fichero = (m, nombre) => EXPORTAR.ficherosRos(m, ORIGEN).find(f => f.nombre === nombre).texto;
const bloque = (texto, desde, n) => { const ls = texto.split('\n'), i = ls.indexOf(desde); assert.ok(i >= 0, `falta la línea «${desde}»`); return ls.slice(i, i + n).join('\n'); };

test('Común-C2: el módulo se carga en un contexto vacío y no nombra ROB, L, CAMS, document, window ni THREE', () => {
  assert.equal(typeof EXPORTAR.ficherosRos, 'function');
  const codigo = FUENTE.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n'); // sin comentarios
  for (const g of [/\bROB\b/, /\bL\s*[.(\[]/, /\bCAMS\b/, /\bdocument\b/, /\bwindow\b/, /\bTHREE\b/, /\bORIGEN\b/]) assert.doesNotMatch(codigo, g);
});

test('T2.2-C4: src/exportar.js no escribe ningún tipo de origen a mano (ni en los comentarios)', () => {
  for (const t of ORIGEN.TIPOS) assert.ok(!FUENTE.includes(t), `«${t}» en src/exportar.js`);
  assert.equal(ORIGEN.ELEGIDO, 'elegido en el gemelo');
});

test('huella: FNV-1a de 32 bits de los bytes UTF-8 (vectores conocidos y una implementación aparte)', () => {
  assert.equal(EXPORTAR.huella(''), '811c9dc5'); assert.equal(EXPORTAR.huella('a'), 'e40c292c'); assert.equal(EXPORTAR.huella('foobar'), 'bf9cf968');
  const fnv = s => { let h = 0x811c9dc5; for (const b of Buffer.from(s, 'utf8')) { h ^= b; h = Number((BigInt(h) * 16777619n) & 0xffffffffn); } return h.toString(16).padStart(8, '0'); };
  for (const s of ['{"zona":{"x":0.12}}', 'Cámara «cenital» −135° 😀', JSON.stringify({ cams: { cenital: { nombre: 'Cenital' } } })]) assert.equal(EXPORTAR.huella(s), fnv(s), s);
});

test('Común-C2 y T2.2: parametros_celda.yaml del modelo a mano, con su texto (robot, mesa, zona, marcadores y cámara)', () => {
  const p = fichero(MODELO, 'parametros_celda.yaml');
  assert.deepEqual(problemasParams(p, ENTEROS), []);
  assert.equal(p.split('\n')[0], '# parametros_celda.yaml · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR');
  assert.match(p, /^# Robot: nominal \(sin identificar: cinemática nominal del UR3e\), en la posición B de la celda \(derecha en la foto cenital\)\.$/m);
  assert.match(p, /^# Frame: base_link \(sin prefijo, como en sim_<id>\)\. /m);
  assert.match(p, /^# Huella de la disposición: 811c9dc5 \(FNV-1a de 32 bits de JSON\.stringify\(L\), en UTF-8\)/m);
  assert.match(p, /^# Carga: ros2 run <paquete> <nodo> --ros-args --params-file parametros_celda\.yaml /m);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(p), 'sin fecha');
  assert.equal(bloque(p, '/**:', 9), [
    '/**:',
    '  ros__parameters:',
    '    celda:',
    '      robot:',
    "        posicion: 'B'  # elegido en el gemelo",
    "        id: 'nominal'  # elegido en el gemelo",
    "        frame: 'base_link'  # elegido en el gemelo (el prefijo; base_link es el del URDF)",
    "        prefijo_frames: ''  # elegido en el gemelo",
    '        world_a_base_link:',
  ].join('\n'));
  assert.equal(bloque(p, '      mesa:', 5), [
    '      mesa:',
    "        frame_id: 'mesa'  # SUPUESTO (nombre propuesto)",
    '        tamano_m: [1.180, 0.830, 0.760]  # MEDIDO',
    '        xyz: [-0.434, -0.269, 0.000]  # MEDIDO',
    '        yaw: 0.000  # MEDIDO',
  ].join('\n'));
  assert.equal(bloque(p, '      zona_fruta:', 5), [
    '      zona_fruta:',
    "        frame_id: 'zona_fruta'  # SUPUESTO (nombre propuesto)",
    '        xyz: [-0.300, 0.000, 0.000]  # SUPUESTO (disposición propuesta, sin medir)',
    '        yaw: 1.571  # SUPUESTO (disposición propuesta, sin medir)',
    '        tamano_m: [0.220, 0.160]  # SUPUESTO (disposición propuesta, sin medir)',
  ].join('\n'));
  assert.equal(bloque(p, '      marcadores:', 8), [
    '      marcadores:',
    '        ids: [4, 5]  # SUPUESTO (ids propuestos)',
    '        marcador_4:',
    "          frame_id: 'marcador_4'  # SUPUESTO (nombre propuesto)",
    '          xyz: [0.050, -0.170, 0.000]  # SUPUESTO (disposición propuesta, sin medir)',
    '          yaw: 0.000  # SUPUESTO (disposición propuesta, sin medir)',
    '          lado_m: 0.060  # SUPUESTO (lado del dibujo del gemelo, sin medir)',
    "          diccionario: 'DICT_4X4_50'  # SUPUESTO (ids propuestos)",
  ].join('\n'));
  assert.equal(bloque(p, '        cenital:', 16), [
    '        cenital:',
    "          frame_id: 'camara_cenital_optical'  # SUPUESTO (nombre propuesto)",
    "          grupo: 'V2'  # elegido en el gemelo",
    "          modelo: 'ELP-USB12MP01-UFV'  # MEDIDO",
    '          focal_mm: 3.6  # elegido en el gemelo',
    "          modo: '1920x1080'  # elegido en el gemelo",
    '          hfov_rad: 1.382  # SUPUESTO (lente ideal, sensor elp-ficha)',
    '          xyz: [0.000, 0.000, 0.500]  # SUPUESTO (disposición propuesta, sin medir)',
    '          rpy: [-0.100, 0.785, 0.000]  # SUPUESTO (disposición propuesta, sin medir); marco camara_cenital (REP-103: x hacia donde mira, y a la izquierda, z arriba)',
    '          mira: [0.500, 0.000, 0.000]  # SUPUESTO (disposición propuesta, sin medir)',
    '          orientacion_rad:',
    '            giro: 1.571  # SUPUESTO (disposición propuesta, sin medir)',
    '            inclinacion: 0.785  # SUPUESTO (disposición propuesta, sin medir)',
    '            alabeo: 0.100  # SUPUESTO (disposición propuesta, sin medir)',
    '          pinza_mesa: [0.000, -0.600, 0.000]  # SUPUESTO (disposición propuesta, sin medir)',
    '',
  ].join('\n'));
  assert.ok(p.endsWith('          pinza_mesa: [0.000, -0.600, 0.000]  # SUPUESTO (disposición propuesta, sin medir)\n'), 'la cámara es lo último');
  assert.ok(!/^ +pose_en_world_doble:/m.test(p), 'sin prefijo no hay pose en el URDF doble (la cabecera sí la nombra)');
  assert.match(p, /^ {8}sobre_caja: true {2}# elegido en el gemelo$/m);
  assert.match(p, /^ {8}caja_tamano_m: \[0\.100, 0\.100, 0\.100\] {2}# SUPUESTO$/m);
});

test('Común-C2 y T2.2: con el prefijo «203_», el giro de −135° y sin caja', () => {
  const p = fichero(MODELO_203, 'parametros_celda.yaml');
  assert.deepEqual(problemasParams(p, ENTEROS), []);
  assert.match(p, /^# Robot: 203 \(calibration_203\.yaml del curso\), en la posición B/m);
  assert.match(p, /^# Frame: 203_base_link \(prefijo «203_» del URDF doble doble_ur3e_203_204\.urdf\.xacro\)\. /m);
  assert.match(p, /^# 203_base_link está girado -2\.356 rad \(−135,0°\) respecto al world del gemelo/m);
  assert.match(p, /^ {8}id: '203' {2}# elegido en el gemelo$/m, 'el id va entre comillas: no es un entero');
  assert.match(p, /^ {8}frame: '203_base_link' {2}# elegido en el gemelo/m);
  assert.match(p, /^ {8}prefijo_frames: '203_' {2}# elegido en el gemelo$/m);
  assert.equal(bloque(p, '        world_a_base_link:', 6), [
    '        world_a_base_link:',
    '          xyz: [0.000, 0.000, 0.000]  # SUPUESTO (world del gemelo: ejes de la mesa, origen en la base sobre el tablero)',
    '          yaw: -2.356  # SUPUESTO (sin validar en ROS): mount_yaw − π del xacro del curso',
    '        pose_en_world_doble:',
    '          xyz: [0.000, 0.000, 0.000]  # SUPUESTO (sin validar en ROS)',
    '          yaw: -2.356  # SUPUESTO (sin validar en ROS)',
  ].join('\n'));
  // la mesa depende del giro world → base_link: SUPUESTO mientras no se valide en ROS, como en posiciones.yaml
  assert.match(p, /^ {8}xyz: \[-0\.434, -0\.269, 0\.000\] {2}# SUPUESTO \(giro world→base_link sin validar en ROS\)$/m);
  assert.match(p, /^ {8}yaw: 2\.356 {2}# SUPUESTO \(giro world→base_link sin validar en ROS\)$/m);
  assert.match(p, /^ {8}tamano_m: \[1\.180, 0\.830, 0\.760\] {2}# MEDIDO$/m, 'las medidas de la mesa siguen siendo MEDIDO');
  assert.match(p, /^ {8}sobre_caja: false {2}# elegido en el gemelo$/m);
});

test('texto seguro: un robot desconocido de una versión más nueva, comillas y saltos de línea; un número no finito falla', () => {
  const m = plano(MODELO); Object.assign(m.robot, { desconocido: true, idLayout: "x'1\nfrase: 2" });
  const p = fichero(m, 'parametros_celda.yaml');
  assert.deepEqual(problemasParams(p, ENTEROS), []);
  assert.match(p, /^ {8}id: 'x''1 frase: 2' {2}# elegido en el gemelo \(de la disposición: el gemelo no lo conoce y usa la cinemática nominal\)$/m);
  assert.match(p, /^# Robot: «x'1 frase: 2» \(desconocido para esta versión del gemelo/m, 'la cabecera sigue siendo una línea de comentario');
  const malo = plano(MODELO); malo.zona.x = NaN;
  assert.throws(() => EXPORTAR.ficherosRos(malo, ORIGEN), /valor no numérico/);
  const id = plano(MODELO); id.marcadores[0].id = 4.5;
  assert.throws(() => EXPORTAR.ficherosRos(id, ORIGEN), /se esperaba un entero/);
});

test('DT34: el agarre del plato lleva «decisión del grupo» y la posición A/B «elegido en el gemelo», en posiciones.yaml y en parametros_celda.yaml', () => {
  assert.ok(!FUENTE.includes(ORIGEN.GRUPO), 'la etiqueta sale de ORIGEN, no se escribe a mano');
  const p = fichero(MODELO, 'parametros_celda.yaml'), y = EXPORTAR.posiciones(MODELO, ORIGEN, '2026-01-01');
  assert.match(p, /^ {8}agarre: 'horizontal_por_el_borde' {2}# decisión del grupo$/m);
  assert.match(p, /^ {8}posicion: 'B' {2}# elegido en el gemelo$/m);
  assert.match(p, /^# Origen de cada valor, al final de su línea: MEDIDO, FABRICANTE o SUPUESTO; lo que se elige en el gemelo, «elegido en el gemelo»; lo que ha decidido el grupo, «decisión del grupo»\.$/m);
  assert.match(y, /^robot: B {2}# elegido en el gemelo$/m);
  assert.match(y, /^platos: \{.*agarre: horizontal_por_el_borde, .*\} {2}# agarre: decisión del grupo · resto: SUPUESTO$/m);
  assert.match(y, /^# Origen de cada valor, al final de su línea: MEDIDO, FABRICANTE o SUPUESTO; lo que ha decidido el grupo, «decisión del grupo»\. Las cámaras/m);
  assert.ok(!/MEDIDO \(decisión del grupo\)|MEDIDO \(posición de la base/.test(p + y), 'ni el agarre ni la posición A/B llevan MEDIDO');
  // los ficheros sin decisiones del grupo no cambian su leyenda
  assert.match(fichero(MODELO, 'tf/mesa.yaml'), /^# Origen de cada valor, al final de su línea: MEDIDO, FABRICANTE o SUPUESTO; lo que se elige en el gemelo, «elegido en el gemelo»\.$/m);
});

test('I5: exportar.js va dentro de los dos HTML construidos, sin su línea de módulo, y yaml (solo de los tests) no', () => {
  for (const f of ['dist/gemelo-celda.html', 'index.html']) {
    const h = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    assert.ok(h.includes('const EXPORTAR = (() => {'), `${f}: EXPORTAR`);
    assert.ok(!h.includes('module.exports = EXPORTAR'), `${f}: sin la exportación para node:test`);
    assert.ok(!/eemeli|yaml@|from ['"]yaml['"]/.test(h), `${f}: sin la librería yaml`);
  }
});

// ---------- T2.4: TF estáticas ----------
// setRPY de tf2 por matrices (R = Rz(yaw)·Ry(pitch)·Rx(roll)), sin el cuaternión: así el test no repite la fórmula del módulo
const mul = (A, B) => A.map(f => [0, 1, 2].map(j => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
const Rx = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = a => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const deRPY = (r, p, y) => mul(Rz(y), mul(Ry(p), Rx(r)));
const deQ = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
const angulo = (A, B) => 2 * Math.asin(Math.min(1, Math.hypot(...A.flat().map((v, i) => v - B.flat()[i])) / (2 * Math.SQRT2))); // ‖A − B‖ = 2√2·sen(θ/2)

test('cuaternión: |q|² − 1 < 1e-9 con 9 decimales y el mismo giro que setRPY (< 1e-8 rad), en un barrido de 4913 giros', () => {
  let peorN = 0, peorG = 0;
  const vals = Array.from({ length: 17 }, (_, i) => -3.141 + i * 0.392625);
  for (const r of vals) for (const p of vals) for (const y of vals) {
    const n = EXPORTAR.cuaternion([r, p, y]), q = n.map(v => v / 1e9);
    assert.ok(n.every(Number.isInteger));
    peorN = Math.max(peorN, Math.abs(q.reduce((s, v) => s + v * v, 0) - 1));
    peorG = Math.max(peorG, angulo(deQ(q), deRPY(+EXPORTAR.rad3(r), +EXPORTAR.rad3(p), +EXPORTAR.rad3(y))));
  }
  assert.ok(peorN < 1e-9, `|q|² − 1 llega a ${peorN}`); assert.ok(peorG < 1e-8, `diferencia de giro ${peorG} rad`);
  assert.deepEqual(plano(EXPORTAR.cuaternion([0, 0, 0])), [0, 0, 0, 1e9], 'sin giro, la identidad exacta');
});

test('Común-C2 y T2.4: tf/mesa.yaml del modelo a mano (sin giro), entero', () => {
  const t = fichero(MODELO, 'tf/mesa.yaml');
  assert.deepEqual(problemasParams(t), []);
  assert.equal(t, [
    '# tf/mesa.yaml · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR',
    '# Robot: nominal (sin identificar: cinemática nominal del UR3e), en la posición B de la celda (derecha en la foto cenital).',
    '# Frame: base_link (sin prefijo, como en sim_<id>). Metros y radianes (REP-103), redondeo a 1 mm y 0,001 rad.',
    '# Huella de la disposición: 811c9dc5 (FNV-1a de 32 bits de JSON.stringify(L), en UTF-8): casa este fichero con su disposición.',
    '# Carga: ros2 component standalone tf2_ros tf2_ros::StaticTransformBroadcasterNode --ros-args --params-file tf/mesa.yaml -r __node:=tf_mesa [SIN VALIDAR en ROS: U4].',
    '# TF estática base_link → mesa: centro de la cara de arriba de la mesa, con su giro.',
    '# Giro: roll 0.000, pitch 0.000, yaw 0.000 rad (setRPY: R = Rz(yaw)·Ry(pitch)·Rx(roll), ejes fijos), en cuaternión (x, y, z, w) normalizado con 9 decimales.',
    '# Las claves x, y, z y w van entre comillas: YAML 1.1 lee una «y» suelta como true.',
    '# En una escena doble, carga las TF de un solo robot: cada frame admite un único padre.',
    '# Origen de cada valor, al final de su línea: MEDIDO, FABRICANTE o SUPUESTO; lo que se elige en el gemelo, «elegido en el gemelo».',
    '/**:',
    '  ros__parameters:',
    "    frame_id: 'base_link'  # elegido en el gemelo (el prefijo; base_link es el del URDF)",
    "    child_frame_id: 'mesa'  # SUPUESTO (nombre propuesto)",
    '    translation:',
    "      'x': -0.434  # MEDIDO",
    "      'y': -0.269  # MEDIDO",
    "      'z': 0.000  # MEDIDO",
    '    rotation:',
    "      'x': 0.000000000  # MEDIDO",
    "      'y': 0.000000000  # MEDIDO",
    "      'z': 0.000000000  # MEDIDO",
    "      'w': 1.000000000  # MEDIDO",
    '',
  ].join('\n'));
});

test('T2.4: las aristas de la decisión 6, en orden, y el script con un comando por arista y wait al final', () => {
  const f = EXPORTAR.ficherosRos(MODELO, ORIGEN).map(x => x.nombre);
  assert.deepEqual(plano(f), ['parametros_celda.yaml', 'tf/mesa.yaml', 'tf/zona_fruta.yaml', 'tf/plato_1_inicio.yaml', 'tf/plato_2_inicio.yaml', 'tf/marcador_4.yaml', 'tf/marcador_5.yaml', 'tf/bandeja.yaml', 'tf/zona_primero.yaml', 'tf/zona_segundo.yaml', 'tf/camara_cenital.yaml', 'tf/camara_cenital_optical.yaml', 'tf_estaticas.sh']);
  const s = fichero(MODELO, 'tf_estaticas.sh'), ls = s.split('\n');
  assert.equal(ls[0], '#!/bin/bash'); assert.equal(ls.at(-2), 'wait'); assert.equal(ls.at(-1), '');
  assert.equal(ls.filter(l => l.startsWith('ros2 run tf2_ros static_transform_publisher ')).length, 11);
  // la zona cuelga de la bandeja con su posición en ella; el marco óptico, del cuerpo con (−π/2, 0, −π/2) redondeado
  assert.ok(ls.includes('ros2 run tf2_ros static_transform_publisher --x -0.020 --y 0.100 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 0.000 --frame-id bandeja --child-frame-id zona_primero --ros-args -r __node:=tf_zona_primero &'));
  assert.ok(ls.includes('ros2 run tf2_ros static_transform_publisher --x 0.000 --y 0.000 --z 0.000 --roll -1.571 --pitch 0.000 --yaw -1.571 --frame-id camara_cenital --child-frame-id camara_cenital_optical --ros-args -r __node:=tf_camara_cenital_optical &'));
  assert.ok(ls.includes('ros2 run tf2_ros static_transform_publisher --x 0.000 --y 0.000 --z 0.500 --roll -0.100 --pitch 0.785 --yaw 0.000 --frame-id base_link --child-frame-id camara_cenital --ros-args -r __node:=tf_camara_cenital &'));
  assert.equal(ls[ls.indexOf('ros2 run tf2_ros static_transform_publisher --x 0.000 --y 0.000 --z 0.500 --roll -0.100 --pitch 0.785 --yaw 0.000 --frame-id base_link --child-frame-id camara_cenital --ros-args -r __node:=tf_camara_cenital &') - 1],
    '# base_link → camara_cenital: SUPUESTO (disposición propuesta, sin medir) · nominal: la sustituye la calibración');
  assert.match(fichero(MODELO, 'tf/bandeja.yaml'), /^# TF estática base_link → bandeja: .*\. nominal: la sustituye la pose que publique Visión\.$/m);
  assert.match(fichero(MODELO, 'tf/camara_cenital_optical.yaml'), /^ {6}'x': 0\.000 {2}# FABRICANTE \(convenio de REP-103\)$/m);
});

test('DT36: zona_centro, con un plato y con dos: su TF hija de bandeja, sus parámetros, su comando y su línea de posiciones.yaml, y la cabecera lo dice', () => {
  const con = pedido => { const m = plano(MODELO); m.pedido = pedido; m.bandeja.zonas.push({ clave: 'zona_centro', base: { x: 0.47, y: 0.05, z: 0.2404 }, local: { x: -0.02, y: 0, z: 0.0004 } }); return m; };
  const linea = { 1: '# zona_centro (centro de la bandeja): el destino del plato con un pedido de un plato, como el de esta disposición.', 2: '# zona_centro (centro de la bandeja): el destino del plato con un pedido de un plato; con dos, como en esta disposición, no se usa.' };
  for (const pedido of [1, 2]) {
    const m = con(pedido), f = EXPORTAR.ficherosRos(m, ORIGEN), nombres = plano(f.map(x => x.nombre)), texto = n => f.find(x => x.nombre === n).texto;
    assert.deepEqual(nombres.slice(nombres.indexOf('tf/bandeja.yaml'), nombres.indexOf('tf/camara_cenital.yaml')), ['tf/bandeja.yaml', 'tf/zona_primero.yaml', 'tf/zona_segundo.yaml', 'tf/zona_centro.yaml']);
    const tz = texto('tf/zona_centro.yaml'), p = texto('parametros_celda.yaml'), s = texto('tf_estaticas.sh'), y = EXPORTAR.posiciones(m, ORIGEN, '2026-01-01');
    assert.deepEqual(problemasParams(tz), []); assert.deepEqual(problemasParams(p, ENTEROS), []);
    assert.match(tz, /^ {4}frame_id: 'bandeja' {2}# SUPUESTO \(nombre propuesto\)\n {4}child_frame_id: 'zona_centro' {2}# SUPUESTO \(nombre propuesto\)$/m);
    assert.match(tz, /^ {6}'x': -0\.020 {2}# SUPUESTO \(sin medir\)\n {6}'y': 0\.000 {2}# SUPUESTO \(sin medir\)\n {6}'z': 0\.000 {2}# SUPUESTO \(sin medir\)$/m);
    assert.ok(s.split('\n').includes('ros2 run tf2_ros static_transform_publisher --x -0.020 --y 0.000 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 0.000 --frame-id bandeja --child-frame-id zona_centro --ros-args -r __node:=tf_zona_centro &'));
    assert.equal(bloque(p, '        zona_centro:', 3), ['        zona_centro:', "          frame_id: 'zona_centro'  # SUPUESTO (nombre propuesto)", '          xyz: [0.470, 0.050, 0.240]  # SUPUESTO (disposición propuesta, sin medir)'].join('\n'));
    assert.ok(y.split('\n').includes("  zona_centro: {x: 0.470, 'y': 0.050, z: 0.240}  # SUPUESTO (disposición propuesta, sin medir)"));
    assert.match(p, /^# {3}zona_fruta, marcadores \(ids, marcador_<id>\), bandeja \(zona_primero, zona_segundo, zona_centro\), persona/m);
    for (const [n, t] of [['tz', tz], ['p', p], ['s', s], ['y', y]]) assert.equal(t.split('\n').filter(l => l === linea[pedido]).length, 1, `${n}, ${pedido} plato(s)`);
    assert.ok(!texto('tf/zona_primero.yaml').includes('# zona_centro (') && !texto('tf/mesa.yaml').includes('# zona_centro ('), 'solo los ficheros que la llevan');
  }
  // sin zona_centro en el modelo (como el modelo a mano de los otros tests) no hay línea ni TF: nada se inventa
  assert.ok(!EXPORTAR.ficherosRos(MODELO, ORIGEN).some(x => x.nombre === 'tf/zona_centro.yaml' || x.texto.includes('# zona_centro (')));
});

// TD.4 (DT36): los marcadores de la zona de fruta (ids 0–3) delante de los de entrega, con el giro de la zona (π/2 en el modelo)
const conZona = () => {
  const m = plano(MODELO), Z = [[-0.1, -0.2], [0.1, -0.2], [0.1, 0.2], [-0.1, 0.2]];
  m.marcadores.unshift(...Z.map(([x, y], i) => ({ id: i, uso: 'zona', diccionario: 'DICT_4X4_50', lado: 0.04, x: -0.3 + x, y: 0.0004 + y, z: 0, yaw: PI / 2 })));
  return m;
};
test('TD.4 (DT36): los marcadores de la zona (0–3) en parametros_celda.yaml, en tf/marcador_<id>.yaml, en tf_estaticas.sh y en posiciones.yaml, como los de entrega', () => {
  const m = conZona(), f = EXPORTAR.ficherosRos(m, ORIGEN), nombres = plano(f.map(x => x.nombre)), texto = n => f.find(x => x.nombre === n).texto;
  assert.deepEqual(nombres.slice(nombres.indexOf('tf/plato_2_inicio.yaml') + 1, nombres.indexOf('tf/bandeja.yaml')), ['tf/marcador_0.yaml', 'tf/marcador_1.yaml', 'tf/marcador_2.yaml', 'tf/marcador_3.yaml', 'tf/marcador_4.yaml', 'tf/marcador_5.yaml']);
  const p = texto('parametros_celda.yaml');
  assert.deepEqual(problemasParams(p, ENTEROS), []);
  assert.equal(bloque(p, '      marcadores:', 9), [
    '      marcadores:',
    '        ids: [0, 1, 2, 3, 4, 5]  # SUPUESTO (ids propuestos)',
    '        marcador_0:',
    "          frame_id: 'marcador_0'  # SUPUESTO (nombre propuesto)",
    '          xyz: [-0.400, -0.200, 0.000]  # SUPUESTO (disposición propuesta, sin medir)',
    '          yaw: 1.571  # SUPUESTO (disposición propuesta, sin medir)',
    '          lado_m: 0.040  # SUPUESTO (lado del dibujo del gemelo, sin medir)',
    "          diccionario: 'DICT_4X4_50'  # SUPUESTO (ids propuestos)",
    '        marcador_1:',
  ].join('\n'));
  assert.equal(bloque(p, '        marcador_4:', 2).split('\n')[1], "          frame_id: 'marcador_4'  # SUPUESTO (nombre propuesto)", 'los de entrega, detrás y como antes');
  assert.ok(p.split('\n').includes('# marcadores 0, 1, 2 y 3: los de las esquinas de la zona de fruta (por fuera de la zona, con sus ejes); 4 y 5: los de entrega (con los ejes de la mesa). Ids propuestos, sin aceptar por el grupo.'));
  const t = texto('tf/marcador_2.yaml');
  assert.deepEqual(problemasParams(t), []);
  assert.match(t, /^# TF estática base_link → marcador_2: marcador 2 de la zona de fruta \(DICT_4X4_50\), plano sobre la mesa, por fuera de una esquina de la zona y con sus ejes \(id propuesto, sin aceptar por el grupo\); convenio de ArUco de OpenCV: /m);
  assert.match(t, /^ {4}frame_id: 'base_link' {2}# elegido en el gemelo .*\n {4}child_frame_id: 'marcador_2' {2}# SUPUESTO \(nombre propuesto\)\n {4}translation:\n {6}'x': -0\.200 {2}# SUPUESTO \(disposición propuesta, sin medir\)\n {6}'y': 0\.200 {2}# SUPUESTO \(disposición propuesta, sin medir\)\n {6}'z': 0\.000 {2}# SUPUESTO/m);
  const rot = t.slice(t.indexOf('    rotation:\n')), q = ['x', 'y', 'z', 'w'].map(k => +rot.match(new RegExp(`^ {6}'${k}': (-?[\\d.]+) `, 'm'))[1]);
  assert.ok(angulo(deQ(q), Rz(1.571)) < 1e-8, 'el giro de la zona, 1,571 rad en z');
  assert.match(texto('tf/marcador_4.yaml'), /^# TF estática base_link → marcador_4: marcador de entrega 4 \(DICT_4X4_50\), plano sobre la mesa y con sus ejes; convenio/m);
  const s = texto('tf_estaticas.sh').split('\n'), c = 'ros2 run tf2_ros static_transform_publisher --x -0.200 --y 0.200 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 1.571 --frame-id base_link --child-frame-id marcador_2 --ros-args -r __node:=tf_marcador_2 &';
  assert.ok(s.includes(c)); assert.equal(s[s.indexOf(c) - 1], '# base_link → marcador_2: SUPUESTO (disposición propuesta, sin medir)');
  const y = EXPORTAR.posiciones(m, ORIGEN, '2026-01-01').split('\n'), i = y.indexOf("  marcador_zona_1: {id: 0, diccionario: DICT_4X4_50, x: -0.400, 'y': -0.200, z: 0.000}  # SUPUESTO (disposición propuesta, sin medir)");
  assert.ok(i > 0, 'marcador_zona_1 en posiciones.yaml');
  assert.deepEqual(y.slice(i, i + 6).map(l => l.split(':')[0]), ['  marcador_zona_1', '  marcador_zona_2', '  marcador_zona_3', '  marcador_zona_4', '  marcador_entrega_1', '  marcador_entrega_2'], 'en el orden de los ids, y los de entrega con su nombre de antes');
  // sin marcadores de la zona (el modelo a mano), ni la línea de la cabecera ni sus TF: nada se inventa
  assert.ok(!fichero(MODELO, 'parametros_celda.yaml').includes('# marcadores 0') && !EXPORTAR.ficherosRos(MODELO, ORIGEN).some(x => x.nombre === 'tf/marcador_0.yaml'));
  // un marcador sin uso válido no se escribe
  const mal = conZona(); delete mal.marcadores[1].uso;
  assert.throws(() => EXPORTAR.ficherosRos(mal, ORIGEN), /marcador 1 sin uso válido/); assert.throws(() => EXPORTAR.posiciones(mal, ORIGEN, '2026-01-01'), /marcador 1 sin uso válido/);
});

test('Común-C2 y T2.4: con el prefijo «203_» y el giro de −135°, la raíz lleva el prefijo y los frames de la celda no', () => {
  const s = fichero(MODELO_203, 'tf_estaticas.sh');
  assert.ok(s.split('\n').includes('ros2 run tf2_ros static_transform_publisher --x -0.434 --y -0.269 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id 203_base_link --child-frame-id mesa --ros-args -r __node:=tf_mesa &'));
  assert.ok(s.includes('# 203_base_link → mesa: SUPUESTO (giro world→base_link sin validar en ROS)\n'));
  assert.ok(!/--child-frame-id 203_|__node:=tf_203/.test(s), 'sin prefijo en los hijos ni en los nodos');
  const t = fichero(MODELO_203, 'tf/mesa.yaml');
  assert.deepEqual(problemasParams(t), []);
  assert.match(t, /^ {4}frame_id: '203_base_link' {2}# elegido en el gemelo/m);
  assert.match(t, /^# Giro: roll 0\.000, pitch 0\.000, yaw 2\.356 rad/m);
  const rot = t.slice(t.indexOf('    rotation:\n')), q = ['x', 'y', 'z', 'w'].map(k => +rot.match(new RegExp(`^ {6}'${k}': (-?[\\d.]+) `, 'm'))[1]);
  assert.ok(angulo(deQ(q), Rz(2.356)) < 1e-8, 'el giro de 2,356 rad en z');
  assert.match(fichero(MODELO_203, 'tf/camara_cenital_optical.yaml'), /^ {4}frame_id: 'camara_cenital' {2}# SUPUESTO \(nombre propuesto\)$/m);
});

test('texto seguro en el script: un prefijo con comillas y punto y coma va entre comillas y bash -n lo acepta', async () => {
  const { spawnSync } = await import('node:child_process');
  const m = plano(MODELO_203); m.robot.frame = "x'; touch ./nada; '"; m.robot.prefijo = "x'; touch ./nada; '";
  const s = fichero(m, 'tf_estaticas.sh');
  assert.ok(s.includes("--frame-id 'x'\\''; touch ./nada; '\\''' --child-frame-id mesa "), 'el frame es un solo argumento entre comillas');
  assert.equal(spawnSync('bash', ['-n'], { input: s }).status, 0);
  assert.deepEqual(problemasParams(fichero(m, 'tf/mesa.yaml')), []);
});

// ---------- TD.3 (DT42): posiciones.yaml se lee igual con YAML 1.1 (PyYAML) que con 1.2 ----------
// Los caracteres que JSON.stringify no escapa y YAML 1.1 no lee como texto de una línea: U+2028 y U+2029 (saltos de línea en
// 1.1), U+0085 (también salto en 1.1), U+007F–U+009F, U+FFFE y U+FFFF (no imprimibles). Escritos con fromCharCode para que
// este fichero no los lleve tal cual.
const ch = c => String.fromCharCode(c), LS = ch(0x2028), PS = ch(0x2029), NEL = ch(0x85);
const RAROS = [0x7f, 0x80, 0x85, 0x9f, 0x2028, 0x2029, 0xfffe, 0xffff];
const escape = c => `${ch(92)}u${c.toString(16).padStart(4, '0')}`; // \uXXXX, como lo escribe jsonYaml11
// la expresión con la que Importar YAML (#btnImport, src/app.js) encuentra la disposición
const IMPORTAR = /#\s*layout-json:\s*(\{.*\})\s*$/m;
const lineaLayout = y => { const ls = y.split('\n').filter(l => l.startsWith('# layout-json: ')); assert.equal(ls.length, 1, 'una sola línea «# layout-json:»'); return ls[0].slice('# layout-json: '.length); };
const conLayout = (m, L) => { const c = plano(m); c.layoutJson = JSON.stringify(L); return c; };

test('TD.3-C1 (DT42): U+2028, U+2029 y los demás caracteres que YAML 1.1 no lee en una línea salen escapados en «# layout-json:» y la disposición se recupera igual', () => {
  assert.ok(fs.readFileSync(path.join(RAIZ, 'src/app.js'), 'utf8').includes(`t.match(/${IMPORTAR.source}/m)`), 'la misma expresión que Importar YAML');
  // una nota y un nombre con U+2028 (y el resto de los raros), junto a texto no ASCII que no se toca
  const L = { version: 9, robotId: 'nominal', nombre: `Cámara «cenital»${LS}−135°`, nota: `uno${LS}dos${PS}tres${NEL}cuatro`, raros: RAROS.map(ch).join('|'), emoji: '😀' };
  const m = conLayout(MODELO, L), y = EXPORTAR.posiciones(m, ORIGEN, '2026-01-01'), lj = lineaLayout(y);
  for (const c of RAROS) { assert.ok(!y.includes(ch(c)), `U+${c.toString(16)} no sale tal cual`); assert.ok(lj.includes(escape(c)), `U+${c.toString(16)} sale como ${escape(c)}`); }
  assert.ok(lj.includes('Cámara «cenital»') && lj.includes('−135°') && lj.includes('😀'), 'el resto del texto, tal cual');
  // ida y vuelta: lo que lee Importar YAML es la misma disposición, y JSON.stringify de ella da el JSON de antes (la huella casa)
  const leida = JSON.parse(y.match(IMPORTAR)[1]);
  assert.deepEqual(leida, L); assert.equal(JSON.stringify(leida), m.layoutJson);
  // sin caracteres raros, la línea es JSON.stringify(L) byte a byte (los ficheros que ya tiene el grupo no cambian ahí)
  const normal = conLayout(MODELO, { version: 9, nombre: 'Cámara «cenital» −135° 😀' });
  assert.equal(lineaLayout(EXPORTAR.posiciones(normal, ORIGEN, '2026-01-01')), normal.layoutJson);
  assert.deepEqual(problemas11(y), []);
});

test('TD.3-C3 (DT42): sin el escape, como antes de TD.3, YAML 1.1 corta la línea «# layout-json:» y lee una clave falsa (el test puede fallar)', () => {
  const L = { version: 9, nota: `uno${LS}falsa: 1` }, m = conLayout(MODELO, L), y = EXPORTAR.posiciones(m, ORIGEN, '2026-01-01');
  assert.deepEqual(problemas11(y), []);
  const antes = y.split('\n').map(l => l.startsWith('# layout-json: ') ? `# layout-json: ${m.layoutJson}` : l).join('\n');
  const p = problemas11(antes);
  assert.ok(p.some(x => /U\+2028, salto de línea en YAML 1\.1/.test(x)), p.join('\n'));
  assert.ok(p.includes('falsa: clave que solo lee YAML 1.1'), p.join('\n'));
  assert.equal(YAML.parse(antes.split(/[\n\u2028]/).join('\n'), { version: '1.1' }).falsa, '1"}', 'la clave falsa, con el resto de la línea como valor');
  // hallazgo de TD.3 (sin arreglar, fuera de su alcance): un fichero de antes con U+2028 sin escapar tampoco lo importaba el
  // gemelo: en la expresión de Importar YAML, «.» no cruza U+2028
  assert.equal(antes.match(IMPORTAR), null);
  // y sin las comillas de fecha ni de «y», 1.1 lee un timestamp y la clave true
  const sinComillas = y.replace(/^fecha: '(.*)'$/m, 'fecha: $1').replaceAll("'y': ", 'y: '), q = problemas11(sinComillas);
  assert.ok(q.some(x => x.startsWith('fecha: YAML 1.1 lee timestamp')), q.join('\n'));
  assert.ok(q.includes('objetos.plato_1.true: clave que solo lee YAML 1.1'), q.join('\n'));
});

test('TD.3-C2 y C3 (DT42): fecha entre comillas y ninguna clave ni valor que YAML 1.1 lea distinto, con cada modelo a mano y con las referencias de --yaml', () => {
  const unPlato = plano(conZona()); unPlato.pedido = 1; unPlato.bandeja.zonas.push({ clave: 'zona_centro', base: { x: 0.47, y: 0.05, z: 0.2404 }, local: { x: -0.02, y: 0, z: 0.0004 } });
  const desconocido = conLayout(MODELO, { version: 10, robotId: `207${LS}falso: 1` });
  Object.assign(desconocido.robot, { idLayout: `207${LS}falso: 1`, desconocido: true, prefijo: `207${PS}_`, frame: `207${PS}_base_link` });
  const casos = [['nominal', MODELO], ['203 con prefijo', MODELO_203], ['un plato, zona_centro y marcadores de la zona', unPlato], ['v10 con U+2028 en el robot', desconocido]];
  const ref = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/yaml/casos.json'), 'utf8')).casos;
  assert.equal(ref.length, 3);
  for (const c of ref) casos.push([`referencia ${c.yaml}`, fs.readFileSync(path.join(RAIZ, 'tests/fixtures/yaml', c.yaml), 'utf8')]);
  for (const [nombre, m] of casos) {
    const y = typeof m === 'string' ? m : EXPORTAR.posiciones(m, ORIGEN, '2026-01-01');
    assert.match(y, /^fecha: '\d{4}-\d{2}-\d{2}'$/m, `${nombre}: fecha entre comillas`);
    assert.doesNotMatch(y, /[{,] y: /, `${nombre}: ninguna clave «y» sin comillas`);
    const v11 = YAML.parse(y, { version: '1.1' }), v12 = YAML.parse(y);
    assert.deepEqual(v11, v12, `${nombre}: el mismo objeto con YAML 1.1 y 1.2`);
    assert.equal(typeof v11.fecha, 'string', nombre); assert.equal(v11.objetos.zona_fruta.y, v12.objetos.zona_fruta.y, nombre);
    assert.deepEqual(problemas11(y), [], `${nombre}: nada que YAML 1.1 (PyYAML) lea distinto`);
    assert.deepEqual(Object.keys(v11), ['fecha', 'robot', 'robot_id', 'frame', 'prefijo_frames', 'world_a_base_link', ...(v11.pose_en_world_doble ? ['pose_en_world_doble'] : []), 'pinza', 'mesa', 'pedido', 'platos', 'objetos', 'camaras'], `${nombre}: ninguna clave falsa`);
  }
});
