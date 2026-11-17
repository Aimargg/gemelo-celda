// Ficheros de ROS de una disposición (T2.2 y T2.4; D8, I7): parametros_celda.yaml, tf/<frame>.yaml y tf_estaticas.sh con
// nominal, el 203 y el 203 con prefijo (CASOS_YAML), en una sola página. Se comprueban con analizadores ajenos al gemelo:
// yaml@2.9.1 (YAML 1.1 y 1.2), el validador de rcl de tests/rcl-params.mjs y bash -n; las posiciones, contra posiciones.yaml
// (el mismo texto) y contra la disposición en world con world_base_link de tests/fixtures/cinematica/<id>.json (ida y
// vuelta); las cámaras, contra la cámara con la que el gemelo pinta lo que ve cada una, y los marcadores, contra su dibujo.
import { test, before, after } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createRequire } from 'node:module';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_YAML, aplicarCaso } from '../medir.mjs';
import { problemasParams } from '../rcl-params.mjs';
import { problemasEscena } from '../collision-object.mjs';
import { problemasScene } from '../scene-texto.mjs';
import { problemasCameraInfo } from '../camera-info.mjs';
const ORIGEN = createRequire(import.meta.url)('../../src/origen.js');

const MESA_H = 0.76, ENTEROS = { enteros: ['celda.marcadores.ids'] };
const REF = id => JSON.parse(fs.readFileSync(path.join(RAIZ, `tests/fixtures/cinematica/${id}.json`), 'utf8')).world_base_link.individual;
const WBL = id => JSON.parse(fs.readFileSync(path.join(RAIZ, `tests/fixtures/cinematica/${id}.json`), 'utf8')).world_base_link; // individual y doble (T2.3-C4)
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Lo que hace falta de la página en cada caso: los ficheros (dos veces), posiciones.yaml, la disposición y las poses de los
// objetos que dibuja el gemelo (bandeja y zonas en world)
function leerPagina() {
  const g = window.__g, L = g.L(), V = g.robot.root.position.constructor;
  g.bandeja.updateMatrixWorld(true);
  const zonas = Object.fromEntries(['zona_primero', 'zona_segundo', 'zona_centro'].map(k => { const p = g.zonasB[k].getWorldPosition(new V()); return [k, { x: p.x, y: p.y, z: p.z }]; }));
  // Lo que dibuja el gemelo (T2.4): la cámara de render de cada cámara (su marco óptico en world, la referencia de T2.4-C3)
  // con las etiquetas de sus marcos TF, y cada marcador de entrega con su plano texturado (supuesto 2)
  const opticos = Object.fromEntries(Object.keys(g.CAMS).map(k => {
    const o = g.CAMS[k].optical; o.updateMatrixWorld(true);
    return [k, { m: [...o.matrixWorld.elements], etiquetas: o.children.filter(h => h.userData.lbl).map(h => h.userData.lbl.element.textContent) }];
  }));
  const marcadores = g.OBJ.arucoE.map(a => {
    a.updateMatrixWorld(true); const pl = a.children[1], uv = pl.geometry.attributes.uv.array, pos = pl.geometry.attributes.position.array, nor = pl.geometry.attributes.normal.array;
    return { id: a.userData.id, m: [...a.matrixWorld.elements], local: [...pl.matrix.elements], flipY: pl.material.map.flipY, uv: [...uv], pos: [...pos], nor: [...nor] };
  });
  return {
    ficheros: g.ficherosRos(), otra: g.ficherosRos(), yaml: g.generarYaml(), L: JSON.parse(JSON.stringify(L)), base: g.BASES[L.robot], robotId: g.ROB.id,
    bandeja: { x: g.bandeja.position.x, y: g.bandeja.position.y, z: g.bandeja.position.z, yaw: g.bandeja.rotation.z }, zonas, opticos, marcadores,
  };
}
const texto = (r, nombre) => { const f = r.ficheros.find(x => x.nombre === nombre); assert.ok(f, `falta ${nombre}`); return f.texto; };
// Lo que hace falta de la página para T2.3 y T2.5, en la misma página: los obstáculos del modelo de colisión del gemelo
// (obstaculos(), en base_link), el plato tal como se dibuja (radio y grosor de su malla), dónde está cada plato y, por cámara,
// puntos de la escena con su proyección de three.js en la cámara de render (NDC): la mira, las esquinas de los marcadores de
// entrega, el centro de los platos y, para que la cámara de la persona tenga al menos 5, las esquinas de la bandeja y sus zonas
function leerEscenaCamaras() {
  const g = window.__g, L = g.L(), V = g.robot.root.position.constructor;
  const geo = g.OBJ.plato1.children[0].geometry; geo.computeBoundingBox(); const bb = geo.boundingBox;
  const enWorld = (o, x, y, z) => { const p = new V(x, y, z).applyMatrix4(o.matrixWorld); return [p.x, p.y, p.z]; };
  const platos = Object.fromEntries(['plato1', 'plato2'].map(k => { const p = g.OBJ[k].getWorldPosition(new V()); return [k, { w: [p.x, p.y, p.z], visible: g.OBJ[k].visible }]; }));
  g.bandeja.updateMatrixWorld(true);
  const puntos = [
    ...g.OBJ.arucoE.flatMap((a, i) => { a.updateMatrixWorld(true); const pl = a.children[1], pos = pl.geometry.attributes.position.array; return [0, 1, 2, 3].map(j => ({ que: `esquina ${j + 1} del marcador ${4 + i}`, w: enWorld(pl, pos[3 * j], pos[3 * j + 1], pos[3 * j + 2]) })); }),
    ...['plato1', 'plato2'].map(k => ({ que: `centro del ${k}`, w: platos[k].w })),
    ...[[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sx, sy], j) => ({ que: `esquina ${j + 1} de la bandeja`, w: enWorld(g.bandeja, sx * g.BAND.d / 2, sy * g.BAND.w / 2, 0) })),
    ...['zona_primero', 'zona_segundo'].map(k => { const p = g.zonasB[k].getWorldPosition(new V()); return { que: k, w: [p.x, p.y, p.z] }; }),
  ];
  const camaras = Object.fromEntries(Object.keys(g.CAMS).map(k => {
    const cam = g.CAMS[k].cam, c = L.cams[k]; cam.updateMatrixWorld(true);
    const [w, h] = c.modo.split('x').map(Number);
    return [k, { w, h, puntos: [{ que: 'mira', w: [c.mira.x, c.mira.y, c.mira.z] }, ...puntos].map(p => { const n = new V(...p.w).project(cam); return { ...p, ndc: [n.x, n.y, n.z] }; }) }];
  }));
  return { obstaculos: g.obstaculos().map(o => ({ ...o })), plato: { radio: Math.max(bb.max.x, -bb.min.x, bb.max.y, -bb.min.y), grosor: bb.max.z }, platos, camaras };
}

// Hojas de un YAML con su texto fuente: ruta → { fuente, valor, comillas }. Las rutas de los arrays llevan [i].
function hojas(src, nodo, ruta = '', out = new Map()) {
  if (YAML.isMap(nodo)) for (const p of nodo.items) hojas(src, p.value, ruta ? `${ruta}.${p.key.value}` : String(p.key.value), out);
  else if (YAML.isSeq(nodo)) nodo.items.forEach((it, i) => hojas(src, it, `${ruta}[${i}]`, out));
  else out.set(ruta, { fuente: src.slice(nodo.range[0], nodo.range[1]), valor: nodo.value, comillas: nodo.type === 'QUOTE_SINGLE' || nodo.type === 'QUOTE_DOUBLE' });
  return out;
}
const docDe = src => { const d = YAML.parseDocument(src); assert.deepEqual(d.errors, []); return d; };
const celdaDe = src => hojas(src, docDe(src).contents.items[0].value.items[0].value.items[0].value); // /** → ros__parameters → celda

// T2.2-C2: tabla de correspondencias posiciones.yaml → parametros_celda.yaml (rutas dentro de celda). Una regla da el
// parámetro (o los parámetros) de cada valor de posiciones.yaml; `pos` son las hojas de posiciones.yaml.
const I = c => 'xyz'.indexOf(c);
const CORRESPONDENCIAS = [
  [/^robot$/, () => ['robot.posicion']],
  [/^robot_id$/, () => ['robot.id']], // un id: en posiciones.yaml sin comillas, en los parámetros como string (decisión 3)
  [/^frame$/, () => ['robot.frame']],
  [/^prefijo_frames$/, () => ['robot.prefijo_frames']],
  [/^world_a_base_link\.([xyz])$/, m => [`robot.world_a_base_link.xyz[${I(m[1])}]`]],
  [/^world_a_base_link\.yaw_rad$/, () => ['robot.world_a_base_link.yaw']],
  [/^pose_en_world_doble\.frame$/, () => ['robot.frame']],
  [/^pose_en_world_doble\.([xyz])$/, m => [`robot.pose_en_world_doble.xyz[${I(m[1])}]`]],
  [/^pose_en_world_doble\.yaw_rad$/, () => ['robot.pose_en_world_doble.yaw']],
  [/^pinza\.(modelo|tcp_z_m|carrera_m)$/, m => [`pinza.${m[1]}`]],
  [/^mesa\.ancho_m$/, () => ['mesa.tamano_m[0]']], [/^mesa\.fondo_m$/, () => ['mesa.tamano_m[1]']], [/^mesa\.alto_m$/, () => ['mesa.tamano_m[2]']],
  [/^mesa\.centro_en_base_link\.([xy])$/, m => [`mesa.xyz[${I(m[1])}]`]],
  [/^mesa\.yaw_rad$/, () => ['mesa.yaw']],
  [/^pedido$/, () => ['pedido']],
  [/^platos\.sobre_caja$/, () => ['platos.sobre_caja']],
  [/^platos\.caja_lado_m$/, () => ['platos.caja_tamano_m[0]', 'platos.caja_tamano_m[1]']], // caja cuadrada: lado × lado × alto
  [/^platos\.caja_alto_m$/, () => ['platos.caja_tamano_m[2]']],
  [/^platos\.(agarre|radio_agarre_m)$/, m => [`platos.${m[1]}`]],
  [/^objetos\.zona_fruta\.([xyz])$/, m => [`zona_fruta.xyz[${I(m[1])}]`]],
  [/^objetos\.zona_fruta\.yaw_rad$/, () => ['zona_fruta.yaw']],
  [/^objetos\.zona_fruta\.ancho_m$/, () => ['zona_fruta.tamano_m[0]']], [/^objetos\.zona_fruta\.fondo_m$/, () => ['zona_fruta.tamano_m[1]']],
  [/^objetos\.(plato_\d)\.([xyz])$/, m => [`platos.${m[1]}.xyz[${I(m[2])}]`]],
  [/^objetos\.marcador_entrega_(\d)\.id$/, m => [`marcadores.ids[${m[1] - 1}]`]],
  [/^objetos\.marcador_entrega_(\d)\.diccionario$/, (m, pos) => [`marcadores.marcador_${pos.get(`objetos.marcador_entrega_${m[1]}.id`).fuente}.diccionario`]],
  [/^objetos\.marcador_entrega_(\d)\.([xyz])$/, (m, pos) => [`marcadores.marcador_${pos.get(`objetos.marcador_entrega_${m[1]}.id`).fuente}.xyz[${I(m[2])}]`]],
  [/^objetos\.bandeja_recepcion\.([xyz])$/, m => [`bandeja.xyz[${I(m[1])}]`]],
  [/^objetos\.bandeja_recepcion\.yaw_rad$/, () => ['bandeja.yaw']],
  [/^objetos\.(zona_primero|zona_segundo|zona_centro)\.([xyz])$/, m => [`bandeja.${m[1]}.xyz[${I(m[2])}]`]], // zona_centro: DT36
  [/^objetos\.persona\.([xy])$/, m => [`persona.xy[${I(m[1])}]`]],
  [/^objetos\.persona\.yaw_rad$/, () => ['persona.yaw']],
  [/^camaras\.camara_(\w+)\.(grupo|modelo|focal_mm|modo|hfov_rad)$/, m => [`camaras.${m[1]}.${m[2]}`]],
  [/^camaras\.camara_(\w+)\.posicion\.([xyz])$/, m => [`camaras.${m[1]}.xyz[${I(m[2])}]`]],
  [/^camaras\.camara_(\w+)\.(mira|pinza_mesa)\.([xyz])$/, m => [`camaras.${m[1]}.${m[2]}[${I(m[3])}]`]],
  [/^camaras\.camara_(\w+)\.orientacion_rad\.(giro|inclinacion|alabeo)$/, m => [`camaras.${m[1]}.orientacion_rad.${m[2]}`]],
];
// Lo que solo está en los parámetros (decisión 5 del brief): los frame_id de las TF, el rpy del marco de cada cámara, el giro
// y el lado de cada marcador, la z de la cara de arriba de la mesa (0 en base_link) y la lista de cámaras
const SOLO_PARAMETROS = [
  /^mesa\.frame_id$/, /^mesa\.xyz\[2\]$/, /^platos\.plato_\d\.frame_id$/, /^zona_fruta\.frame_id$/,
  /^marcadores\.marcador_\d+\.(frame_id|yaw|lado_m)$/, /^bandeja\.frame_id$/, /^bandeja\.zona_(primero|segundo|centro)\.frame_id$/,
  /^camaras\.nombres\[\d+\]$/, /^camaras\.\w+\.frame_id$/, /^camaras\.\w+\.rpy\[[012]\]$/,
];
function destinos(ruta, pos) {
  for (const [re, f] of CORRESPONDENCIAS) { const m = ruta.match(re); if (m) return f(m, pos); }
  return null;
}

// Ida y vuelta (I7): un punto de base_link en world con world_base_link del JSON del robot (p_w = R·p_b + base, tablero a 0,76)
const aMundo = (T, b, p) => [0, 1, 2].map(r => T[4 * r] * p[0] + T[4 * r + 1] * p[1] + T[4 * r + 2] * p[2] + [b.x, b.y, MESA_H][r]);
const giro = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// El redondeo a 1 mm se hace en los ejes de base_link: la diferencia en world, vuelta a esos ejes (Rᵀ·d), queda en ±0,5 mm
// por eje. En los ejes de world, girados −135° con el 203, el mismo error llega a 0,71 mm (0,5·(cos + sen) de 45°).
let RT = null; // R de world_base_link del caso que se comprueba
const cerca = (a, b, que) => {
  const n = b.length, d = [0, 1, 2].map(i => i < n ? a[i] - b[i] : 0), e = [0, 1, 2].map(c => RT[c] * d[0] + RT[4 + c] * d[1] + RT[8 + c] * d[2]);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(e[i]) <= 0.5e-3 + 1e-9, `${que}: (${a.slice(0, n)}) frente a (${b}); ${(e[i] * 1000).toFixed(3)} mm en el eje ${'xyz'[i]} de base_link (±0,5 mm)`);
};
const mismoGiro = (a, b, que) => assert.ok(giro(a, b) <= 0.001 + 1e-9, `${que}: ${a} frente a ${b} (±0,001 rad)`);

// ---------- T2.4: TF estáticas ----------
// Aristas de la decisión 6 del brief, escritas aquí (no las da el código que exporta): [padre, hijo]
const aristasEsperadas = (raizTF, cams) => [
  [raizTF, 'mesa'], [raizTF, 'zona_fruta'], [raizTF, 'plato_1_inicio'], [raizTF, 'plato_2_inicio'], [raizTF, 'marcador_4'], [raizTF, 'marcador_5'],
  [raizTF, 'bandeja'], ['bandeja', 'zona_primero'], ['bandeja', 'zona_segundo'], ['bandeja', 'zona_centro'], // zona_centro: DT36
  ...cams.flatMap(k => [[raizTF, `camara_${k}`], [`camara_${k}`, `camara_${k}_optical`]]),
];
const NOMINALES = { bandeja: 'nominal: la sustituye la pose que publique Visión', camara: 'nominal: la sustituye la calibración' };
// Matrices 3×3 (filas) de setRPY (R = Rz(yaw)·Ry(pitch)·Rx(roll)) y de un cuaternión (x, y, z, w), sin el código que exporta
const mul = (A, B) => A.map(f => [0, 1, 2].map(j => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
const tr = A => [0, 1, 2].map(i => [0, 1, 2].map(j => A[j][i]));
const Rx = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = a => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const deRPY = (r, p, y) => mul(Rz(y), mul(Ry(p), Rx(r)));
const deQ = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
const angulo = (A, B) => 2 * Math.asin(Math.min(1, Math.hypot(...A.flat().map((v, i) => v - B.flat()[i])) / (2 * Math.SQRT2))); // ‖A − B‖ = 2√2·sen(θ/2)
const entreEjes = (a, b) => Math.atan2(Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
const col = (A, j) => [A[0][j], A[1][j], A[2][j]], aplicar = (A, v) => A.map(f => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]);
const R3 = T => [[T[0], T[1], T[2]], [T[4], T[5], T[6]], [T[8], T[9], T[10]]]; // rotación de world_base_link del JSON (filas)
const de3 = e => ({ R: [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]], p: [e[12], e[13], e[14]] }); // matrixWorld de three (por columnas)
// Una TF de su YAML: padre, hijo, traslación y cuaternión (valores) y el texto de cada número
function leerTF(src) {
  const v = YAML.parse(src)['/**'].ros__parameters, h = hojas(src, docDe(src).contents.items[0].value.items[0].value);
  return { padre: v.frame_id, hijo: v.child_frame_id, t: ['x', 'y', 'z'].map(k => v.translation[k]), q: ['x', 'y', 'z', 'w'].map(k => v.rotation[k]), texto: h, claves: [...h.keys()] };
}
// Un comando de tf_estaticas.sh: sus flags con nombre (--x … --child-frame-id) y el nombre de nodo
function leerComando(l) {
  const a = l.split(' '), f = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--') && a[i] !== '--ros-args') f[a[i].slice(2)] = a[++i];
  return { flags: f, nodo: (l.match(/ -r __node:=(\S+) &$/) || [])[1] };
}

// ---------- T2.3: escena de colisión ----------
const pDe = o => ['x', 'y', 'z'].map(k => o[k]), qDe = o => ['x', 'y', 'z', 'w'].map(k => o[k]);
const resta = (a, b) => a.map((v, i) => v - b[i]), suma = (a, b) => a.map((v, i) => v + b[i]), norma = v => Math.hypot(...v);
const TOL = 0.5e-3 + 1e-9; // ±0,5 mm (el redondeo a 1 mm) y el ruido de coma flotante
const dentro = (e, tol, que) => e.forEach((v, i) => assert.ok(Math.abs(v) <= tol, `${que}: ${(v * 1000).toFixed(3)} mm en el eje ${'xyz'[i]} (±${(tol * 1000).toFixed(1)} mm)`));
const giroZ = R => Math.atan2(R[1][0], R[0][0]);
const modPi = (a, b) => { const d = Math.atan2(Math.sin(a - b), Math.cos(a - b)); return Math.min(Math.abs(d), Math.PI - Math.abs(d)); }; // una caja es simétrica a media vuelta
// Objetos de escena_colision.yaml con sus formas en el mismo frame que obstaculos(): centro, giro y dimensiones de cada forma
function formasEnBase(objetos) {
  return objetos.map(o => {
    const R = deQ(qDe(o.pose.orientation)), p = pDe(o.pose.position);
    return { id: o.id, p, R, formas: o.primitives.map((f, i) => { const pp = o.primitive_poses[i]; return { i, tipo: f.type, dims: f.dimensions, c: suma(p, aplicar(R, pDe(pp.position))), R: mul(R, deQ(qDe(pp.orientation))) }; }) };
  });
}
// Lo que no se exporta (decisión 2 del brief de T2.3): la persona (y sus brazos, «manos»), la fruta y el otro robot
const NO_EXPORTADOS = [/^persona$/, /^manos$/, /^pieza:\d+$/, /^robot A$/];
// Un fichero de texto de ROS con el origen de cada valor al final de su línea (como T2.2-C4): toda línea con valor lo lleva
function conOrigen(src, nombre) {
  const re = new RegExp(`  # (${[...ORIGEN.TIPOS, ORIGEN.ELEGIDO].join('|')})\\b`);
  for (const l of src.split('\n').filter(l => l && !l.startsWith('#'))) if (!/:$/.test(l)) assert.match(l, re, `${nombre}: ${l}`);
}
// celda.scene ya validado: { nombre, objetos [{ id, p, q, formas [{ tipo, dims, p, q, color }] }] }
function leerScene(src) {
  const ls = src.split('\n'); let i = 1; const n = () => ls[i++].split(' ').map(Number), objetos = [];
  while (ls[i] !== '.') {
    const o = { id: ls[i++].slice(2), p: n(), q: n(), formas: [] }, k = +ls[i++];
    for (let j = 0; j < k; j++) o.formas.push({ tipo: ls[i++], dims: n(), p: n(), q: n(), color: n() });
    i++; objetos.push(o); // 0 subframes
  }
  return { nombre: ls[0], objetos };
}
// ---------- T2.5: cámaras ----------
const ENTEROS_USB = { enteros: ['image_width', 'image_height', 'exposure', 'white_balance'] }; // los que usb_cam declara enteros

// ---------- T2.7: zona_centro (DT36) ----------
// La línea que dice si la disposición usa zona_centro, escrita aquí: con un plato es el destino; con dos, no se usa
const LINEA_CENTRO = pedido => `# zona_centro (centro de la bandeja): el destino del plato con un pedido de un plato${pedido === 1 ? ', como el de esta disposición' : '; con dos, como en esta disposición, no se usa'}.`;
// C3: tf/zona_centro.yaml (hija de bandeja), su pose en base_link frente a la zona dibujada (zonasB.zona_centro) y los mismos
// números en parametros_celda.yaml, tf_estaticas.sh y posiciones.yaml; con el pedido de la página (r.L.pedido)
function comprobarCentro(r) {
  const pedido = r.L.pedido, T = REF(r.robotId).T, J = R3(T), base = [r.base.x, r.base.y, MESA_H]; RT = T;
  const tz = texto(r, 'tf/zona_centro.yaml'), tb = texto(r, 'tf/bandeja.yaml'), sh = texto(r, 'tf_estaticas.sh'), p = texto(r, 'parametros_celda.yaml');
  assert.deepEqual(problemasParams(tz), []);
  const z = leerTF(tz), b = leerTF(tb);
  assert.deepEqual([z.padre, z.hijo, b.padre], ['bandeja', 'zona_centro', `${r.c.prefijo}base_link`], 'zona_centro cuelga de bandeja (sin prefijo: un frame de la celda), y bandeja de <prefijo>base_link');
  // la zona dibujada, en base_link
  const w = r.zonas.zona_centro, ref = aplicar(tr(J), [w.x - base[0], w.y - base[1], w.z - base[2]]);
  // la cadena bandeja ∘ zona_centro: dos redondeos de 1 mm y uno de 0,001 rad en 2 cm (como las otras zonas en T2.4-C5)
  const Rb = deQ(b.q), pc = b.t.map((v, i) => v + aplicar(Rb, z.t)[i]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(pc[i] - ref[i]) <= 1.3e-3, `bandeja ∘ zona_centro: ${'xyz'[i]} ${pc[i]} frente a ${ref[i]}`);
  // su pose en base_link escrita una vez (parámetros y posiciones.yaml): ±0,5 mm por eje de base_link
  const c = YAML.parse(p)['/**'].ros__parameters.celda;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(c.bandeja.zona_centro.xyz[i] - ref[i]) <= 0.5e-3 + 1e-9, `parametros bandeja.zona_centro.xyz[${i}] ${c.bandeja.zona_centro.xyz[i]} frente a ${ref[i]}`);
  assert.equal(c.bandeja.zona_centro.frame_id, 'zona_centro');
  // los mismos números: parámetros = posiciones.yaml (texto), comando = tf/zona_centro.yaml (texto)
  const pos = hojas(r.yaml, docDe(r.yaml).contents), par = celdaDe(p);
  for (const [i, k] of ['x', 'y', 'z'].entries()) assert.equal(par.get(`bandeja.zona_centro.xyz[${i}]`).fuente, pos.get(`objetos.zona_centro.${k}`).fuente, `posiciones.yaml zona_centro.${k}`);
  const cmd = sh.split('\n').filter(l => l.startsWith('ros2 run ') && l.includes(' --child-frame-id zona_centro '));
  assert.equal(cmd.length, 1, 'un comando para zona_centro'); const f = leerComando(cmd[0]).flags;
  assert.deepEqual([f['frame-id'], f.x, f.y, f.z], ['bandeja', ...['x', 'y', 'z'].map(k => z.texto.get(`translation.${k}`).fuente)]);
  // la línea de la cabecera, en los cuatro ficheros que la llevan, y en ninguno más
  for (const [nombre, t] of [['posiciones.yaml', r.yaml], ['parametros_celda.yaml', p], ['tf/zona_centro.yaml', tz], ['tf_estaticas.sh', sh]]) assert.equal(t.split('\n').filter(l => l === LINEA_CENTRO(pedido)).length, 1, `${nombre}: ${LINEA_CENTRO(pedido)}`);
  for (const f2 of r.ficheros.filter(f2 => !['parametros_celda.yaml', 'tf/zona_centro.yaml', 'tf_estaticas.sh'].includes(f2.nombre))) assert.ok(!f2.texto.includes('# zona_centro (centro'), `${f2.nombre} no la lleva`);
  return { pedido, cadena: Math.max(...pc.map((v, i) => Math.abs(v - ref[i]))), param: Math.max(...c.bandeja.zona_centro.xyz.map((v, i) => Math.abs(v - ref[i]))) };
}

test('T2.2 y T2.4 con nominal, el 203 y el 203 con prefijo: parametros_celda.yaml (C1–C4), las TF estáticas (C1–C5) y Común-C1 en la misma página', { timeout: 300000 }, async t => {
  const s = await abrir(srv.url);
  try {
    const res = [];
    for (const c of CASOS_YAML) { await aplicarCaso(s.page, c); res.push({ c, ...(await s.page.evaluate(leerPagina)), escena: await s.page.evaluate(leerEscenaCamaras) }); }
    comprobar(s.reg);
    for (const r of res) {
      const p = texto(r, 'parametros_celda.yaml');
      await t.test(`${r.c.id} · T2.2-C1: cumple las reglas de rcl (YAML 1.1 = 1.2, /** → ros__parameters, hojas válidas, sin listas de mapas)`, () => {
        assert.deepEqual(problemasParams(p, ENTEROS), []);
        const v = YAML.parse(p);
        assert.deepEqual(Object.keys(v), ['/**']); assert.deepEqual(Object.keys(v['/**']), ['ros__parameters']); assert.deepEqual(Object.keys(v['/**'].ros__parameters), ['celda']);
      });
      await t.test(`${r.c.id} · T2.2-C2: cada valor de posiciones.yaml tiene su parámetro con el mismo texto; el resto está en la lista de solo parámetros`, st => {
        const pos = hojas(r.yaml, docDe(r.yaml).contents), par = celdaDe(p), usados = new Set();
        for (const [ruta, h] of pos) {
          if (ruta === 'fecha') continue;
          const ds = destinos(ruta, pos); assert.ok(ds, `${ruta}: no está en la tabla de correspondencias`);
          for (const d of ds) {
            const q = par.get(d); assert.ok(q, `${ruta} → ${d}: no está en parametros_celda.yaml`); usados.add(d);
            if (typeof h.valor === 'number' && ruta === 'robot_id') assert.ok(q.comillas && q.valor === h.fuente, `${ruta} → ${d}: '${h.fuente}' entre comillas`);
            else if (typeof h.valor === 'number') { assert.ok(!q.comillas, `${d}: número sin comillas`); assert.equal(q.fuente, h.fuente, `${ruta} → ${d}`); }
            else assert.deepEqual([typeof q.valor, q.valor], [typeof h.valor, h.valor], `${ruta} → ${d}`);
          }
        }
        const solo = [...par.keys()].filter(d => !usados.has(d));
        for (const d of solo) assert.ok(SOLO_PARAMETROS.some(re => re.test(d)), `${d}: ni en posiciones.yaml ni en la lista de solo parámetros`);
        st.diagnostic(`${usados.size} parámetros con su valor de posiciones.yaml; solo en los parámetros (${solo.length}): ${solo.join(', ')}`);
      });
      await t.test(`${r.c.id} · T2.2-C3: ida y vuelta, deshaciendo el prefijo y el giro se recupera la disposición en world (±0,5 mm, ±0,001 rad)`, () => {
        const c = YAML.parse(p)['/**'].ros__parameters.celda, L = r.L;
        assert.equal(c.robot.frame, `${c.robot.prefijo_frames}base_link`); assert.equal(c.robot.id, r.robotId);
        const J = REF(c.robot.id), T = J.T, yb = J.rpy[2], W = q => aMundo(T, r.base, q), xyz = o => [o.x, o.y, o.z]; RT = T;
        cerca(W(c.mesa.xyz), [0, 0, MESA_H], 'mesa'); mismoGiro(c.mesa.yaw + yb, 0, 'giro de la mesa');
        cerca(W(c.zona_fruta.xyz), [L.zona.x, L.zona.y, MESA_H], 'zona_fruta'); mismoGiro(c.zona_fruta.yaw + yb, L.zona.yaw, 'giro de la zona');
        const zp = MESA_H + (L.caja.on ? L.caja.h : 0);
        for (const k of ['plato1', 'plato2']) cerca(W(c.platos[k.replace('plato', 'plato_')].xyz), [L[k].x, L[k].y, zp], k);
        L.arucoE.forEach((a, i) => { const mk = c.marcadores[`marcador_${c.marcadores.ids[i]}`]; cerca(W(mk.xyz), [a.x, a.y, MESA_H], `marcador ${i + 1}`); mismoGiro(mk.yaw + yb, 0, `giro del marcador ${i + 1} (ejes de la mesa)`); });
        // la bandeja: la de la página y la de su fórmula (persona + adelante, a su altura, sin balanceo)
        const P = L.persona, bL = [P.x + Math.cos(P.yaw) * L.bandeja.ade, P.y + Math.sin(P.yaw) * L.bandeja.ade, L.bandeja.alt];
        cerca(W(c.bandeja.xyz), bL, 'bandeja (disposición)'); cerca(W(c.bandeja.xyz), xyz(r.bandeja), 'bandeja (página)');
        mismoGiro(c.bandeja.yaw + yb, P.yaw, 'giro de la bandeja'); mismoGiro(r.bandeja.yaw, P.yaw, 'giro de la bandeja de la página');
        for (const k of ['zona_primero', 'zona_segundo', 'zona_centro']) cerca(W(c.bandeja[k].xyz), xyz(r.zonas[k]), k);
        cerca(W([...c.persona.xy, 0]), [P.x, P.y], 'persona'); mismoGiro(c.persona.yaw + yb, P.yaw, 'giro de la persona');
        for (const [k, cam] of Object.entries(L.cams)) {
          const q = c.camaras[k]; cerca(W(q.xyz), xyz(cam.pos), `cámara ${k}`); cerca(W(q.mira), xyz(cam.mira), `mira de ${k}`); cerca(W(q.pinza_mesa), [cam.clamp.x, cam.clamp.y, MESA_H], `pinza de ${k}`);
          const d = [cam.mira.x - cam.pos.x, cam.mira.y - cam.pos.y, cam.mira.z - cam.pos.z], pan = Math.atan2(d[0], d[1]), tilt = Math.atan2(-d[2], Math.hypot(d[0], d[1]));
          mismoGiro(q.orientacion_rad.giro - yb, pan, `giro de ${k}`); mismoGiro(q.orientacion_rad.inclinacion, tilt, `inclinación de ${k}`); mismoGiro(q.orientacion_rad.alabeo, cam.roll || 0, `alabeo de ${k}`);
          // el marco del cuerpo (REP-103): roll = −alabeo, pitch = inclinación, yaw = π/2 − giro (en world, + el de base_link)
          mismoGiro(q.rpy[0], -(cam.roll || 0), `roll de ${k}`); mismoGiro(q.rpy[1], tilt, `pitch de ${k}`); mismoGiro(q.rpy[2] + yb, Math.PI / 2 - pan, `yaw de ${k}`);
          assert.equal(q.focal_mm, cam.f); assert.equal(q.modo, cam.modo); assert.equal(q.grupo, cam.grupo);
        }
        assert.equal(c.platos.sobre_caja, L.caja.on); assert.equal(c.pedido, L.pedido === 1 ? 'un_plato' : 'dos_platos'); assert.equal(c.robot.posicion, L.robot);
      });
      await t.test(`${r.c.id} · T2.2-C4: cada hoja lleva al final de su línea el origen (MEDIDO, FABRICANTE, SUPUESTO, «${ORIGEN.ELEGIDO}» o «${ORIGEN.GRUPO}»)`, () => {
        const cuerpo = p.split('\n').filter(l => l && !l.startsWith('#')), conValor = cuerpo.filter(l => /^\s*[^\s:#]+: \S/.test(l));
        const re = new RegExp(`  # (${[...ORIGEN.TIPOS, ORIGEN.ELEGIDO, ORIGEN.GRUPO].join('|')})\\b`); // DT34: «decisión del grupo», el agarre del plato
        for (const l of conValor) assert.match(l, re, l);
        for (const l of cuerpo.filter(l => !conValor.includes(l))) assert.match(l, /^\s*[^\s:#]+:$/, `línea sin valor ni origen: ${l}`);
        // una línea con valor por hoja: las de los arrays van en la misma línea que su clave
        const n = [...celdaDe(p).keys()].map(k => k.replace(/\[\d+\]$/, '')).filter((k, i, a) => a.indexOf(k) === i).length;
        assert.equal(conValor.length, n);
      });
      const raizTF = `${r.c.prefijo}base_link`, cams = Object.keys(r.L.cams);
      const tfs = r.ficheros.filter(f => f.nombre.startsWith('tf/')), sh = texto(r, 'tf_estaticas.sh');
      const T = REF(r.robotId).T, J = R3(T), base = [r.base.x, r.base.y, MESA_H];
      const aBase = e => { const w = de3(e); return { R: mul(tr(J), w.R), p: aplicar(tr(J), w.p.map((v, i) => v - base[i])) }; }; // matriz de world a base_link
      const porHijo = Object.fromEntries(tfs.map(f => [f.nombre.slice(3, -5), leerTF(f.texto)]));
      const comandos = Object.fromEntries(sh.split('\n').filter(l => l.startsWith('ros2 run ')).map(l => { const c = leerComando(l); return [c.flags['child-frame-id'], { ...c, linea: l }]; }));
      await t.test(`${r.c.id} · T2.4-C1: un tf/<hijo>.yaml por arista de la decisión 6 con los 9 parámetros; un árbol con una sola raíz (${raizTF})`, () => {
        const esperadas = aristasEsperadas(raizTF, cams);
        assert.deepEqual(tfs.map(f => f.nombre), esperadas.map(([, h]) => `tf/${h}.yaml`));
        for (const f of tfs) {
          assert.deepEqual(problemasParams(f.texto), [], f.nombre);
          const e = porHijo[f.nombre.slice(3, -5)];
          assert.deepEqual(e.claves, ['frame_id', 'child_frame_id', 'translation.x', 'translation.y', 'translation.z', 'rotation.x', 'rotation.y', 'rotation.z', 'rotation.w'], f.nombre);
          assert.equal(`tf/${e.hijo}.yaml`, f.nombre);
        }
        assert.deepEqual(Object.values(porHijo).map(e => [e.padre, e.hijo]), esperadas);
        const padre = new Map(Object.values(porHijo).map(e => [e.hijo, e.padre]));
        assert.equal(padre.size, tfs.length, 'cada frame tiene un único padre');
        const raices = new Set([...padre.values()].filter(p => !padre.has(p)));
        assert.deepEqual([...raices], [raizTF], 'una sola raíz');
        for (const h of padre.keys()) { let x = h, n = 0; while (padre.has(x)) { x = padre.get(x); assert.ok(++n <= padre.size, `ciclo desde ${h}`); } assert.equal(x, raizTF); }
      });
      await t.test(`${r.c.id} · T2.4-C2: cuaternión normalizado, el mismo giro que el comando con setRPY y los mismos números que el YAML`, () => {
        assert.deepEqual(Object.keys(comandos).sort(), Object.keys(porHijo).sort(), 'un comando por TF');
        for (const [h, e] of Object.entries(porHijo)) {
          const c = comandos[h].flags, n2 = e.q.reduce((s, v) => s + v * v, 0);
          assert.ok(Math.abs(n2 - 1) < 1e-9, `${h}: |q|² − 1 = ${n2 - 1}`);
          for (const k of ['x', 'y', 'z', 'roll', 'pitch', 'yaw']) assert.match(c[k], /^-?\d+\.\d{3}$/, `${h}: --${k} ${c[k]} (1 mm y 0,001 rad)`);
          assert.ok(angulo(deQ(e.q), deRPY(+c.roll, +c.pitch, +c.yaw)) < 1e-6, `${h}: el giro del YAML y el del comando`);
          for (const k of ['x', 'y', 'z']) assert.equal(c[k], e.texto.get(`translation.${k}`).fuente, `${h}: --${k}`);
          assert.equal(c['frame-id'], e.padre); assert.equal(c['child-frame-id'], e.hijo);
          assert.match(texto(r, `tf/${h}.yaml`), new RegExp(`^# Giro: roll ${c.roll}, pitch ${c.pitch}, yaw ${c.yaw} rad `, 'm'), `${h}: la cabecera dice el mismo rpy`);
        }
      });
      await t.test(`${r.c.id} · T2.4-C3: ${raizTF} → camara_<k> → camara_<k>_optical coincide con la cámara de render del gemelo (±0,5 mm, ±0,002 rad por eje)`, st => {
        for (const k of cams) {
          const b = porHijo[`camara_${k}`], o = porHijo[`camara_${k}_optical`];
          assert.deepEqual([b.padre, o.padre], [raizTF, `camara_${k}`]);
          const Rb = deQ(b.q), R = mul(Rb, deQ(o.q)), p = b.t.map((v, i) => v + aplicar(Rb, o.t)[i]);
          const ref = aBase(r.opticos[k].m);
          for (let i = 0; i < 3; i++) assert.ok(Math.abs(p[i] - ref.p[i]) <= 0.5e-3 + 1e-9, `${k}: ${'xyz'[i]} ${p[i]} frente a ${ref.p[i]}`);
          const ejes = [0, 1, 2].map(j => entreEjes(col(R, j), col(ref.R, j)));
          for (const [j, e] of ejes.entries()) assert.ok(e <= 0.002, `${k}: eje ${'xyz'[j]} a ${e} rad`);
          // supuesto 1: el marco óptico de la cámara de render es el de REP-103 (z hacia el punto de mira)
          const cam = r.L.cams[k], f = [cam.mira.x - cam.pos.x, cam.mira.y - cam.pos.y, cam.mira.z - cam.pos.z];
          assert.ok(entreEjes(col(de3(r.opticos[k].m).R, 2), f) < 1e-6, `${k}: z óptico hacia la mira`);
          st.diagnostic(`${k}: ejes a ${ejes.map(e => e.toExponential(2)).join(', ')} rad`);
        }
      });
      await t.test(`${r.c.id} · T2.4-C4: tf_estaticas.sh con un comando por arista, nombres de nodo válidos y únicos, bash -n y las nominales comentadas`, () => {
        assert.equal(spawnSync('bash', ['-n'], { input: sh }).status, 0, 'bash -n');
        const ls = sh.split('\n'); assert.equal(ls[0], '#!/bin/bash'); assert.deepEqual(ls.slice(-2), ['wait', '']);
        const cmds = ls.map((l, i) => [l, i]).filter(([l]) => l.startsWith('ros2 run '));
        assert.equal(cmds.length, tfs.length);
        const nodos = cmds.map(([l]) => leerComando(l).nodo);
        assert.equal(new Set(nodos).size, nodos.length, 'nombres de nodo únicos');
        const re = new RegExp(`: (${[...ORIGEN.TIPOS, ORIGEN.ELEGIDO].join('|')})\\b`);
        for (const [l, i] of cmds) {
          assert.match(l, /^ros2 run tf2_ros static_transform_publisher --x \S+ --y \S+ --z \S+ --roll \S+ --pitch \S+ --yaw \S+ --frame-id \S+ --child-frame-id \S+ --ros-args -r __node:=[A-Za-z][A-Za-z0-9_]* &$/, l);
          const h = leerComando(l).flags['child-frame-id'], com = ls[i - 1];
          assert.ok(com.startsWith(`# ${porHijo[h].padre} → ${h}: `), `comentario de ${h}: ${com}`); assert.match(com, re, `origen de ${h}`);
          const nominal = h === 'bandeja' ? NOMINALES.bandeja : /^camara_[a-z]+$/.test(h) ? NOMINALES.camara : null;
          if (nominal) { assert.ok(com.endsWith(` · ${nominal}`), `${h}: ${com}`); assert.match(texto(r, `tf/${h}.yaml`), new RegExp(`^# TF estática .* ${nominal}\\.$`, 'm')); }
          else assert.ok(!com.includes('nominal:'), `${h} no es nominal`);
        }
      });
      await t.test(`${r.c.id} · T2.4-C5 y supuesto 2: los marcos de las cámaras se llaman camara_<k>_optical en la vista 3D; los marcadores, planos con los ejes de la mesa`, () => {
        for (const k of cams) assert.deepEqual(r.opticos[k].etiquetas, [`camara_${k}_optical`]);
        for (const [i, mk] of r.marcadores.entries()) {
          const h = `marcador_${mk.id}`, w = de3(mk.m), l = de3(mk.local);
          assert.equal(h, `marcador_${4 + i}`);
          assert.ok(angulo(w.R, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) < 1e-9 && angulo(l.R, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) < 1e-9, `${h}: sin giro propio`);
          // el patrón: la esquina de arriba a la izquierda del lienzo (uv 0,1 con flipY) en (−x, +y); la normal, +z
          assert.equal(mk.flipY, true);
          const v = j => ({ uv: mk.uv.slice(2 * j, 2 * j + 2), p: mk.pos.slice(3 * j, 3 * j + 3), n: mk.nor.slice(3 * j, 3 * j + 3) });
          for (let j = 0; j < mk.uv.length / 2; j++) { const x = v(j); assert.deepEqual([Math.sign(x.p[0]), Math.sign(x.p[1])], [x.uv[0] ? 1 : -1, x.uv[1] ? 1 : -1], `${h}: vértice ${j}`); assert.deepEqual(x.n, [0, 0, 1]); }
          // la TF del marcador gira como el dibujo, visto desde base_link
          assert.ok(angulo(deQ(porHijo[h].q), aBase(mk.m).R) <= 0.002, `${h}: giro de la TF y del dibujo`);
        }
        // las zonas cuelgan de la bandeja: bandeja ∘ zona da la zona dibujada (dos redondeos de 1 mm y uno de 0,001 rad en
        // 10 cm: 0,5 + 0,71 + 0,05 < 1,3 mm por eje)
        const b = porHijo.bandeja, Rb = deQ(b.q);
        for (const k of ['zona_primero', 'zona_segundo', 'zona_centro']) {
          const z = porHijo[k], p = b.t.map((v, i) => v + aplicar(Rb, z.t)[i]), w = r.zonas[k], ref = aplicar(tr(J), [w.x - base[0], w.y - base[1], w.z - base[2]]);
          for (let i = 0; i < 3; i++) assert.ok(Math.abs(p[i] - ref[i]) <= 1.3e-3, `${k}: ${'xyz'[i]} ${p[i]} frente a ${ref[i]}`);
        }
      });
      await t.test(`${r.c.id} · Común-C1: exportar dos veces da los mismos bytes y ningún fichero lleva fecha`, () => {
        assert.deepEqual(r.otra, r.ficheros);
        for (const f of r.ficheros) assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(f.texto), `${f.nombre}: sin fecha`);
      });
      await t.test(`${r.c.id} · T2.7-C3 (DT36), con dos platos: zona_centro en tf/, parametros_celda.yaml, tf_estaticas.sh y posiciones.yaml con los mismos números`, st => {
        const e = comprobarCentro(r); assert.equal(e.pedido, 2);
        st.diagnostic(`peor error: ${(e.cadena * 1000).toFixed(3)} mm por la cadena de TF y ${(e.param * 1000).toFixed(3)} mm en los parámetros`);
      });

      // ---------- T2.3 y T2.5 (añadido en T2.3 + T2.5): en la misma página y con los mismos casos ----------
      const escena = texto(r, 'escena_colision.yaml'), sc = texto(r, 'celda.scene'), txt = texto(r, 'celda.scene.txt');
      const objetos = YAML.parse(escena).objetos, E = formasEnBase(objetos);
      await t.test(`${r.c.id} · T2.3 y T2.5 (Común-C1): los ficheros nuevos van detrás de los de T2.2 + T2.4, en orden fijo, y cada valor lleva su origen`, () => {
        const i = r.ficheros.findIndex(f => f.nombre === 'tf_estaticas.sh');
        assert.deepEqual(r.ficheros.slice(i + 1).map(f => f.nombre), ['escena_colision.yaml', 'celda.scene', 'celda.scene.txt', ...cams.map(k => `camera_info/camara_${k}.yaml`), ...cams.map(k => `usb_cam/camara_${k}.yaml`)]);
        conOrigen(escena, 'escena_colision.yaml');
        for (const k of cams) { conOrigen(texto(r, `camera_info/camara_${k}.yaml`), `camera_info/camara_${k}.yaml`); conOrigen(texto(r, `usb_cam/camara_${k}.yaml`), `usb_cam/camara_${k}.yaml`); }
        assert.ok(!sc.includes('#'), 'celda.scene sin comentarios: el lector no los ignora');
        const re = new RegExp(`^#   (\\S+): (${ORIGEN.TIPOS.join('|')})\\b`, 'm'), lista = txt.split('\n').filter(l => re.test(l)).map(l => l.match(re)[1]);
        assert.deepEqual(lista, objetos.map(o => o.id), 'celda.scene.txt da el origen de cada objeto');
      });
      await t.test(`${r.c.id} · T2.3-C1: escena_colision.yaml pasa el validador de CollisionObject (en ${raizTF})`, () => {
        assert.deepEqual(problemasEscena(escena, { frame: raizTF }), []);
      });
      await t.test(`${r.c.id} · T2.3-C2: cada obstáculo de obstaculos() tiene su primitiva (centro ±0,5 mm, medidas a 1 mm, giro ±0,002 rad) y al revés`, st => {
        const porId = new Map(E.map(o => [o.id, o])), usadas = new Set(), fuera = new Map(), peor = { base: 0, obj: 0 };
        const forma = (id, tipo, i) => { const o = porId.get(id); assert.ok(o, `falta el objeto ${id}`); const f = o.formas.filter(x => x.tipo === tipo)[i]; assert.ok(f, `${id}: falta su forma ${tipo} n.º ${i + 1}`); usadas.add(`${id}#${f.i}`); return { o, f }; };
        const medida = (a, b, que) => assert.ok(Math.abs(a - b) <= TOL, `${que}: ${a} frente a ${b} (a 1 mm)`);
        const vertical = (R, que) => assert.ok(entreEjes(col(R, 2), [0, 0, 1]) <= 0.002, `${que}: no está vertical`);
        const caja = (id, o, f, que) => { // una caja orientada de obstaculos() (t: 3) y su BOX
          dentro(resta(f.c, [o.x, o.y, o.z]), TOL, `${que}: centro`);
          [o.hx, o.hy, o.hz].forEach((h, i) => medida(f.dims[i], 2 * h, `${que}: lado ${'xyz'[i]}`));
          assert.ok(modPi(giroZ(f.R), Math.atan2(o.s, o.c)) <= 0.002, `${que}: giro ${giroZ(f.R)} frente a ${Math.atan2(o.s, o.c)}`); vertical(f.R, que);
        };
        const grupos = new Map(); for (const o of r.escena.obstaculos) { if (!grupos.has(o.tag)) grupos.set(o.tag, []); grupos.get(o.tag).push(o); }
        for (const [tag, os] of grupos) {
          let m;
          if (NO_EXPORTADOS.some(re => re.test(tag))) { fuera.set(tag, os.length); continue; }
          if (tag === 'mesa') { // el tablero (t: 0): cara de arriba a z del obstáculo − 1 mm, con su giro
            const [o] = os, { f } = forma('mesa', 1, 0);
            dentro(resta(f.c, [o.x, o.y, o.z - 0.001 - f.dims[2] / 2]), TOL, 'mesa: centro con la cara de arriba a −0,001');
            dentro([f.c[2] + f.dims[2] / 2 - (o.z - 0.001)], TOL, 'mesa: cara de arriba a −0,001'); assert.ok(Math.abs(o.z) < 1e-9, 'el tablero está en z = 0 de base_link');
            medida(f.dims[0], 2 * o.hx, 'mesa: ancho'); medida(f.dims[1], 2 * o.hy, 'mesa: fondo'); medida(f.dims[2], MESA_H, 'mesa: alto');
            assert.ok(modPi(giroZ(f.R), o.giro ? Math.atan2(o.s, o.c) : 0) <= 0.002, 'mesa: giro'); vertical(f.R, 'mesa');
          } else if ((m = tag.match(/^caja:plato(\d)$/))) { assert.equal(os.length, 1); caja(`caja_plato_${m[1]}`, os[0], forma(`caja_plato_${m[1]}`, 1, 0).f, tag); }
          else if (tag === 'bandeja') { assert.equal(os.length, 1); caja('bandeja', os[0], forma('bandeja', 1, 0).f, tag); }
          else if ((m = tag.match(/^plato:(plato\d)$/))) { // las esferas del plato: un CYLINDER de PLATO_R centrado en el plato
            const id = m[1].replace('plato', 'plato_'), { f } = forma(id, 3, 0), [h, rad] = f.dims, cg = [0, 1, 2].map(i => os.reduce((s, o) => s + [o.x, o.y, o.z][i], 0) / os.length);
            const base = aplicar(tr(J), resta(r.escena.platos[m[1]].w, [r.base.x, r.base.y, MESA_H])); // el plato dibujado, en base_link
            medida(rad, r.escena.plato.radio, `${id}: radio (el del plato dibujado)`); medida(h, r.escena.plato.grosor, `${id}: altura (el grosor del plato dibujado)`);
            assert.notEqual(rad, h, 'un cilindro de radio distinto de su altura');
            dentro(resta(f.c, [cg[0], cg[1], base[2] + h / 2]).slice(0, 2), TOL, `${id}: eje en el centro de sus esferas`); dentro(resta(f.c, base).slice(0, 2), TOL, `${id}: eje en el centro del plato`);
            dentro([f.c[2] - h / 2 - base[2]], TOL, `${id}: base del cilindro en la del plato`); vertical(f.R, id);
            for (const o of os) { const d = resta([o.x, o.y, o.z], f.c); assert.ok(Math.hypot(d[0], d[1]) <= rad && Math.abs(d[2]) <= h / 2, `${id}: la esfera de (${o.x}, ${o.y}, ${o.z}) tiene el centro dentro del cilindro`); }
          } else if ((m = tag.match(/^camara:(\w+)$/))) { // esferas (t: 1) como SPHERE; cada cápsula (t: 2), un CYLINDER y dos SPHERE
            const id = `camara_${m[1]}`, o0 = porId.get(id); assert.ok(o0, `falta ${id}`);
            const libres = t2 => o0.formas.filter(f => f.tipo === t2 && !usadas.has(`${id}#${f.i}`));
            const cerca = (tipo, c, rr, que) => { // la forma libre más parecida (centro y radio); el error, en los ejes del objeto (donde se redondea)
              const coste = x => norma(resta(x.c, c)) + Math.abs(x.dims.at(-1) - rr), f = libres(tipo).sort((a, b) => coste(a) - coste(b))[0]; // el codo comparte centro con dos extremos de cápsula: cuenta el radio assert.ok(f, `${id}: falta una forma ${tipo} para ${que}`);
              usadas.add(`${id}#${f.i}`); const e = resta(f.c, c), eo = aplicar(tr(o0.R), e);
              dentro(eo, TOL, `${id}, ${que}: centro (ejes de ${id})`); peor.obj = Math.max(peor.obj, ...eo.map(Math.abs)); peor.base = Math.max(peor.base, ...e.map(Math.abs));
              medida(f.dims.at(-1), rr, `${id}, ${que}: radio`); return f;
            };
            for (const o of os) {
              if (o.t === 1) { cerca(2, [o.x, o.y, o.z], o.r, `esfera de radio ${o.r}`); continue; }
              assert.equal(o.t, 2, `${tag}: solo esferas y cápsulas`);
              const a = [o.ax, o.ay, o.az], b = [o.cx, o.cy, o.cz], d = resta(b, a), l = norma(d);
              const f = cerca(3, a.map((v, i) => (v + b[i]) / 2), o.r, 'tramo de una cápsula');
              medida(f.dims[0], l, `${id}: altura del cilindro (la longitud de la cápsula)`);
              const ang = entreEjes(col(f.R, 2), d); assert.ok(Math.min(ang, Math.PI - ang) <= 0.002, `${id}: eje del cilindro a ${ang} rad de la cápsula`);
              cerca(2, a, o.r, 'extremo de una cápsula'); cerca(2, b, o.r, 'extremo de una cápsula');
            }
          } else assert.fail(`obstáculo «${tag}» sin primitiva en la escena ni en la lista de no exportados`);
        }
        // al revés: ninguna forma de la escena sin su obstáculo, y ningún objeto de más
        for (const o of E) for (const f of o.formas) assert.ok(usadas.has(`${o.id}#${f.i}`), `${o.id}: la forma ${f.i + 1} (tipo ${f.tipo}) no sale de ningún obstáculo`);
        const esperados = ['mesa', ...['1', '2'].filter(n => grupos.has(`caja:plato${n}`)).map(n => `caja_plato_${n}`), ...['1', '2'].filter(n => grupos.has(`plato:plato${n}`)).map(n => `plato_${n}`), 'bandeja', ...cams.map(k => `camara_${k}`)];
        assert.deepEqual(E.map(o => o.id), esperados);
        for (const re of NO_EXPORTADOS) assert.ok([...fuera.keys()].some(k => re.test(k)), `el caso tiene obstáculos ${re} (no exportados)`);
        st.diagnostic(`no exportados: ${[...fuera].map(([k, n]) => `${k} (${n})`).join(', ')}; cámaras: peor error ${(peor.obj * 1000).toFixed(3)} mm en sus ejes y ${(peor.base * 1000).toFixed(3)} mm en los de ${raizTF}`);
      });
      await t.test(`${r.c.id} · T2.3-C3: celda.scene pasa el validador del formato .scene`, () => {
        assert.deepEqual(problemasScene(sc), []);
      });
      await t.test(`${r.c.id} · T2.3-C4: celda.scene, devuelto de world a ${raizTF}, es escena_colision.yaml; cylinder radio longitud frente a [altura, radio]`, st => {
        const S = leerScene(sc), W = WBL(r.robotId)[r.c.prefijo ? 'doble' : 'individual'], RW = R3(W.T), tW = W.xyz;
        assert.equal(S.nombre, `gemelo_celda_${escena.match(/^# Huella de la disposición: ([0-9a-f]{8}) /m)[1]}`);
        assert.ok(txt.includes(r.c.prefijo ? `está en el world del URDF doble ${path.basename(W.fichero)}, no en ${raizTF}` : `está en el world de sim_<id>`), 'celda.scene.txt dice en qué world está');
        assert.deepEqual(S.objetos.map(o => o.id), objetos.map(o => o.id));
        const TIPOS = { 1: 'box', 2: 'sphere', 3: 'cylinder' }; let peorB = 0, peorG = 0;
        for (const [i, s] of S.objetos.entries()) {
          const o = objetos[i], pb = aplicar(tr(RW), resta(s.p, tW)), e = resta(pb, pDe(o.pose.position));
          // el .scene redondea a 1 mm en los ejes de world: la diferencia, en esos ejes, queda en ±0,5 mm
          dentro(aplicar(RW, e), TOL, `${s.id}: posición (ejes de world)`); peorB = Math.max(peorB, ...e.map(Math.abs));
          const g = angulo(mul(tr(RW), deQ(s.q)), deQ(qDe(o.pose.orientation))); assert.ok(g <= 0.002, `${s.id}: giro a ${g} rad`); peorG = Math.max(peorG, g);
          assert.equal(s.formas.length, o.primitives.length, `${s.id}: número de formas`);
          for (const [j, f] of s.formas.entries()) {
            const p = o.primitives[j], pp = o.primitive_poses[j];
            assert.equal(f.tipo, TIPOS[p.type], `${s.id}: tipo de la forma ${j + 1}`);
            assert.deepEqual(f.dims, p.type === 3 ? [p.dimensions[1], p.dimensions[0]] : p.dimensions, `${s.id}: dimensiones de la forma ${j + 1}`);
            assert.deepEqual([f.p, f.q], [pDe(pp.position), qDe(pp.orientation)], `${s.id}: pose de la forma ${j + 1}, la misma`);
            assert.ok(f.color.every(c => c >= 0 && c <= 1) && f.color[3] === 1, `${s.id}: color`);
          }
        }
        // el cilindro del plato: radio (el del plato dibujado) ≠ altura, primero en el .scene y segundo en el YAML
        for (const id of ['plato_1', 'plato_2']) {
          const s = S.objetos.find(o => o.id === id), o = objetos.find(x => x.id === id); if (!s) continue;
          assert.ok(Math.abs(s.formas[0].dims[0] - r.escena.plato.radio) <= TOL && Math.abs(o.primitives[0].dimensions[1] - r.escena.plato.radio) <= TOL, `${id}: cylinder radio longitud y [altura, radio]`);
          assert.notEqual(s.formas[0].dims[0], s.formas[0].dims[1]);
        }
        st.diagnostic(`${r.c.prefijo ? 'world del URDF doble' : 'world de sim_<id>'}: peor diferencia ${(peorB * 1000).toFixed(3)} mm en los ejes de ${raizTF} y ${peorG.toExponential(2)} rad`);
      });
      await t.test(`${r.c.id} · T2.5-C1: camera_info/camara_<k>.yaml pasa el validador de camera_info y su camera_name es el de usb_cam`, () => {
        for (const k of cams) {
          const ci = texto(r, `camera_info/camara_${k}.yaml`), u = YAML.parse(texto(r, `usb_cam/camara_${k}.yaml`))['/**'].ros__parameters;
          assert.deepEqual(problemasCameraInfo(ci), [], k);
          const c = YAML.parse(ci); assert.equal(c.camera_name, u.camera_name, k); assert.equal(c.camera_name, `camara_${k}`);
          assert.deepEqual([c.image_width, c.image_height], r.L.cams[k].modo.split('x').map(Number), `${k}: el tamaño del modo`);
        }
      });
      await t.test(`${r.c.id} · T2.5-C2: con la K exportada, los píxeles son los de la cámara de render del gemelo (< 0,05 px), y con las TF exportadas, dentro de su redondeo`, st => {
        for (const k of cams) {
          const ci = YAML.parse(texto(r, `camera_info/camara_${k}.yaml`)), K = ci.camera_matrix.data, { w, h, puntos } = r.escena.camaras[k];
          const gem = aBase(r.opticos[k].m); // el marco óptico de la cámara de render, en base_link, sin redondear
          const b = porHijo[`camara_${k}`], o = porHijo[`camara_${k}_optical`], Rb = deQ(b.q), exp = { R: mul(Rb, deQ(o.q)), p: suma(b.t, aplicar(Rb, o.t)) }; // la cadena TF exportada
          const th = angulo(exp.R, gem.R), dt = norma(resta(exp.p, gem.p));
          const px = (M, pb) => { const q = aplicar(tr(M.R), resta(pb, M.p)); return { Z: q[2], m: [q[0] / q[2], q[1] / q[2]], uv: [K[0] * q[0] / q[2] + K[2], K[4] * q[1] / q[2] + K[5]] }; };
          let n = 0, peorK = 0, peorT = 0, cota = 0;
          for (const p of puntos) {
            const [nx, ny, nz] = p.ndc, pb = aplicar(tr(J), resta(p.w, base)), g = px(gem, pb);
            if (!(g.Z > 0 && Math.abs(nx) <= 1 && Math.abs(ny) <= 1 && Math.abs(nz) <= 1)) continue; // no se ve
            n++;
            const uv3 = [(nx + 1) / 2 * w - 0.5, (1 - ny) / 2 * h - 0.5], eK = norma(resta(g.uv, uv3)), eT = norma(resta(px(exp, pb).uv, uv3));
            // cota del redondeo de las TF (I7: 1 mm y 0,001 rad): el rayo gira como mucho θ + δt/ρ y, en la imagen, |Δm| ≤ (1 + |m|²)·ángulo
            const c = Math.max(K[0], K[4]) * (th + dt / norma(resta(pb, gem.p))) * (1 + g.m[0] ** 2 + g.m[1] ** 2) * 1.05 + 0.05;
            assert.ok(eK < 0.05, `${k}, ${p.que}: ${eK.toFixed(4)} px entre la K exportada y three.js`);
            assert.ok(eT <= c, `${k}, ${p.que}: ${eT.toFixed(3)} px con las TF exportadas (cota del redondeo ${c.toFixed(3)} px)`);
            peorK = Math.max(peorK, eK); peorT = Math.max(peorT, eT); cota = Math.max(cota, c);
          }
          assert.ok(n >= 5, `${k}: ${n} puntos visibles (al menos 5)`);
          st.diagnostic(`${k}: ${n} puntos visibles; con la K exportada, ${peorK.toFixed(4)} px; con las TF exportadas, ${peorT.toFixed(3)} px (cota ${cota.toFixed(3)} px; TF a ${th.toExponential(2)} rad y ${(dt * 1000).toFixed(3)} mm del marco del gemelo)`);
        }
      });
      await t.test(`${r.c.id} · T2.5-C3: usb_cam/camara_<k>.yaml pasa las reglas de rcl, con su TF óptica, su camera_info, mjpeg2rgb y sin camera_frame_id`, () => {
        for (const k of cams) {
          const src = texto(r, `usb_cam/camara_${k}.yaml`), u = YAML.parse(src)['/**'].ros__parameters, ci = YAML.parse(texto(r, `camera_info/camara_${k}.yaml`));
          assert.deepEqual(problemasParams(src, ENTEROS_USB), [], k);
          assert.equal(u.frame_id, porHijo[`camara_${k}_optical`].hijo, `${k}: frame_id = el child de su TF óptica`);
          assert.equal(u.camera_info_url, `file://\${ROS_HOME}/camera_info/${ci.camera_name}.yaml`, `${k}: camera_info_url`);
          assert.equal(u.pixel_format, 'mjpeg2rgb'); assert.ok(!src.includes('camera_frame_id:') && !('camera_frame_id' in u), `${k}: sin camera_frame_id`);
          assert.deepEqual([u.image_width, u.image_height], [ci.image_width, ci.image_height], `${k}: el tamaño del modo`); assert.ok(u.framerate > 0, `${k}: framerate`); // double: lo exige problemasParams (no es un entero de usb_cam)
          assert.deepEqual([u.autoexposure, u.exposure, u.auto_white_balance, u.white_balance], [false, 50, false, 4000], `${k}: exposición y balance manuales`);
        }
      });
    }
    // T2.7-C3 (DT36) con un plato: los mismos casos, en orden inverso, con «Pide 1 plato»
    await s.page.click('.tabs [data-tab="demo"]'); await s.page.click('#segPedido [data-v="1"]');
    await s.page.waitForFunction(() => window.__g.L().pedido === 1, null, { timeout: 30000, polling: 50 });
    const uno = [];
    for (const c of [...CASOS_YAML].reverse()) { await aplicarCaso(s.page, c); uno.push({ c, ...(await s.page.evaluate(leerPagina)) }); }
    comprobar(s.reg);
    for (const r of uno) {
      await t.test(`${r.c.id} · T2.7-C3 (DT36), con un plato: zona_centro (el destino) en tf/, parametros_celda.yaml, tf_estaticas.sh y posiciones.yaml con los mismos números`, st => {
        const e = comprobarCentro(r); assert.equal(e.pedido, 1);
        assert.equal(YAML.parse(texto(r, 'parametros_celda.yaml'))['/**'].ros__parameters.celda.pedido, 'un_plato');
        assert.deepEqual(r.ficheros.filter(f => f.nombre.startsWith('tf/')).map(f => f.nombre), aristasEsperadas(`${r.c.prefijo}base_link`, Object.keys(r.L.cams)).map(([, h]) => `tf/${h}.yaml`), 'las mismas TF que con dos platos');
        st.diagnostic(`peor error: ${(e.cadena * 1000).toFixed(3)} mm por la cadena de TF y ${(e.param * 1000).toFixed(3)} mm en los parámetros`);
      });
    }
  } finally { await s.cerrar(); }
});
