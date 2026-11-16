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
  marcadores: [{ id: 4, diccionario: 'DICT_4X4_50', lado: 0.06, x: 0.05, y: -0.17, z: 0, yaw: 0 }, { id: 5, diccionario: 'DICT_4X4_50', lado: 0.06, x: 0.12, y: -0.32, z: 0, yaw: 0 }],
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
