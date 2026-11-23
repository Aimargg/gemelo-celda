// Unitario de la captura sintética con anotaciones (src/captura.js, sin navegador; T4.6): la proyección estenopeica de las cajas y esquinas
// de una escena de muestra, con las referencias escritas a mano aquí (cámara en el origen, focal de 400 px: ancho de 6,4 mm y focal de
// 4 mm en 640 px), el objeto fuera del campo que no se anota, el cortado por el borde («parcial», con la caja recortada), el de espaldas
// y el que queda detrás de la cámara, y el JSON: claves en su orden, tipos, 640 × 480, esquinas de ArUco en el orden de OpenCV, origen de
// cada valor, ninguna clase «persona» y texto determinista (los mismos bytes dos veces).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CAPTURA = require('../../src/captura.js'), SENSOR = require('../../src/sensor.js');
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);
// Cámara en el origen mirando a +z, con x a la derecha e y hacia abajo (el marco de OpenCV): u = 319,5 + 400·x/z y v = 239,5 + 400·y/z
const CAM = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], near: 0.03, far: 8 };
const V = CAPTURA.vista(6.4, 4);
const CTX = { robotId: 'nominal', sospechoso: false, yaw: 0, sensor: { id: 'elp-ficha', ...SENSOR.de('elp-ficha') }, tcpZ: 0.2 };
// Una escena de muestra: un marcador de 6 cm de frente a 2 m (las esquinas del cuadrado negro, ±2,5 cm, en el orden del marcador: la y
// del marcador, hacia arriba, es −y en este marco), un plato plano a 2 m, una fruta con caja 3D entre 1 y 2 m, y los casos de borde
const ARUCO = { clase: 'aruco', id: 5, nombre: 'marcador 5', esquinas: [[-0.025, -0.025, 2], [0.025, -0.025, 2], [0.025, 0.025, 2], [-0.025, 0.025, 2]], normal: [0, 0, -1] };
const PLATO = { clase: 'plato', id: null, nombre: 'plato 1º', puntos: [[-0.1, -0.05, 2], [0.1, -0.05, 2], [0.1, 0.05, 2], [-0.1, 0.05, 2]] };
const caja3d = (x0, x1, y0, y1, z0, z1) => [x0, x1].flatMap(x => [y0, y1].flatMap(y => [z0, z1].map(z => [x, y, z])));
const FRUTA = { clase: 'fruta', id: null, nombre: 'manzana (pieza 0)', puntos: caja3d(0.2, 0.4, 0.1, 0.3, 1, 2) };
const FUERA = { clase: 'fruta', id: null, nombre: 'fuera', puntos: caja3d(1, 1.1, 0, 0.1, 1, 1) };
const DERECHA = { clase: 'fruta', id: null, nombre: 'borde derecho', puntos: caja3d(0.7, 0.9, 0, 0.1, 1, 1) };
const IZQUIERDA = { clase: 'fruta', id: null, nombre: 'borde izquierdo', puntos: caja3d(-0.9, -0.7, 0, 0.1, 1, 1) };
const ESPALDAS = { ...ARUCO, id: 6, nombre: 'marcador 6', normal: [0, 0, 1] };
const DETRAS = { clase: 'plato', id: null, nombre: 'detrás', puntos: [[0, 0, -1], [0.1, 0, -1], [0, 0.1, -1]] };
const MUESTRA = [ARUCO, PLATO, FRUTA, FUERA, DERECHA, IZQUIERDA, ESPALDAS, DETRAS];

test('vista: 640 × 480 con la focal en píxeles de la proyección estenopeica (N·f/w), el centro de OpenCV y los campos de visión', () => {
  assert.deepEqual([CAPTURA.ANCHO, CAPTURA.ALTO], [640, 480]);
  cerca(V.fx, 400, 1e-9, 'fx = 640·4/6,4'); cerca(V.fy, 400, 1e-9, 'fy'); assert.deepEqual([V.cx, V.cy, V.ancho, V.alto], [319.5, 239.5, 640, 480]);
  cerca(V.tanX, 0.8, 1e-12, 'tan del medio campo horizontal = 320/400'); cerca(V.tanY, 0.6, 1e-12, 'tan del medio campo vertical = 240/400');
  // la ELP de la ficha a 3,6 mm: 640·3,6/5,952 = 387,0968 px; campos de 79,16° × 63,6° (2·atan(0,82667) y 2·atan(0,62))
  const E = CAPTURA.vista(5.952, 3.6); cerca(E.fx, 387.0968, 1e-4, 'fx de la ELP a 3,6 mm'); cerca(E.hfov * 180 / Math.PI, 79.16, 0.01, 'campo horizontal'); cerca(E.vfov * 180 / Math.PI, 63.6, 0.01, 'campo vertical');
  for (const malo of [[0, 3.6], [5.952, -1], [NaN, 3.6], ['6', 3.6]]) assert.throws(() => CAPTURA.vista(...malo), /números positivos/, JSON.stringify(malo));
});

test('proyectar: un punto del eje sale en el centro y uno desplazado en u = 319,5 + 400·x/z, v = 239,5 + 400·y/z; con otra pose de cámara, por sus ejes', () => {
  let q = CAPTURA.proyectar(V, CAM, [0, 0, 1]); cerca(q.u, 319.5, 1e-9, 'u del eje'); cerca(q.v, 239.5, 1e-9, 'v del eje'); cerca(q.prof, 1, 1e-12, 'profundidad');
  q = CAPTURA.proyectar(V, CAM, [0.1, 0.05, 1]); cerca(q.u, 359.5, 1e-9, 'u'); cerca(q.v, 259.5, 1e-9, 'v');
  // cámara en (1, 2, 3) mirando a +x del mundo: a su derecha va −y y hacia abajo, −z. El punto a 2 m al frente, 0,2 m a la derecha y 0,1 m abajo
  const cam = { o: [1, 2, 3], x: [0, -1, 0], y: [0, 0, -1], z: [1, 0, 0], near: 0.03, far: 8 };
  q = CAPTURA.proyectar(V, cam, [3, 1.8, 2.9]); cerca(q.u, 359.5, 1e-9, 'u con otra pose'); cerca(q.v, 259.5, 1e-9, 'v con otra pose'); cerca(q.prof, 2, 1e-12, 'profundidad con otra pose');
});

test('esquinasAruco: las del cuadrado negro (80 de los 96 px del plano), en el orden de OpenCV y con z = 0', () => {
  assert.deepEqual(CAPTURA.ORDEN_ESQUINAS, ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda']);
  cerca(CAPTURA.ARUCO_NEGRO, 5 / 6, 1e-15, 'el negro es 5/6 del plano');
  const E = CAPTURA.esquinasAruco(0.06), h = 0.025; // 0,06 · 5/6 / 2
  const quiere = [[-h, h, 0], [h, h, 0], [h, -h, 0], [-h, -h, 0]];
  assert.equal(E.length, 4); E.forEach((p, i) => p.forEach((v, j) => cerca(v, quiere[i][j], 1e-12, `esquina ${i}, eje ${j}`)));
});

test('C1: las cajas y las esquinas salen de la proyección estenopeica hecha a mano; fuera del campo no se anota; cortado por el borde es parcial con la caja recortada', () => {
  const { anotados, omitidos } = CAPTURA.anotar(V, CAM, MUESTRA);
  assert.deepEqual(anotados.map(a => a.nombre), ['marcador 5', 'plato 1º', 'manzana (pieza 0)', 'borde derecho', 'borde izquierdo'], 'solo lo que se ve, en el orden de entrada');
  const por = Object.fromEntries(anotados.map(a => [a.nombre, a]));
  const caja = (a, x, y, w, h, que) => { cerca(a.caja.x, x, 1e-9, `${que}: x`); cerca(a.caja.y, y, 1e-9, `${que}: y`); cerca(a.caja.ancho, w, 1e-9, `${que}: ancho`); cerca(a.caja.alto, h, 1e-9, `${que}: alto`); };
  // ArUco: u = 319,5 ± 400·0,025/2 = 314,5 y 324,5; v = 239,5 ± 5 = 234,5 y 244,5; esquinas en el orden de entrada (arriba-izquierda primero)
  const A = por['marcador 5']; assert.equal(A.id, 5); assert.deepEqual([A.visible, A.parcial], [true, false]); caja(A, 314.5, 234.5, 10, 10, 'ArUco');
  const quiere = [[314.5, 234.5], [324.5, 234.5], [324.5, 244.5], [314.5, 244.5]];
  assert.equal(A.esquinas.length, 4); A.esquinas.forEach((p, i) => { cerca(p[0], quiere[i][0], 1e-9, `esquina ${i}: u`); cerca(p[1], quiere[i][1], 1e-9, `esquina ${i}: v`); });
  // plato a 2 m: u = 319,5 ± 20, v = 239,5 ± 10
  caja(por['plato 1º'], 299.5, 229.5, 40, 20, 'plato'); assert.equal(por['plato 1º'].esquinas, null); assert.equal(por['plato 1º'].id, null);
  // fruta con caja 3D entre 1 y 2 m: x/z va de 0,1 (0,2 a 2 m) a 0,4 (0,4 a 1 m) y y/z de 0,05 a 0,3 → u de 359,5 a 479,5 y v de 259,5 a 359,5
  caja(por['manzana (pieza 0)'], 359.5, 259.5, 120, 100, 'fruta'); assert.equal(por['manzana (pieza 0)'].parcial, false);
  // cortada por el borde derecho (639,5): x/z de 0,7 a 0,9 → u de 599,5 a 679,5, recortada a 599,5…639,5; y de 0 a 0,1 → v de 239,5 a 279,5
  const D = por['borde derecho']; assert.deepEqual([D.visible, D.parcial], [true, true]); caja(D, 599.5, 239.5, 40, 40, 'borde derecho');
  // por el izquierdo (−0,5): u de −40,5 a 39,5 → recortada a −0,5…39,5
  const I = por['borde izquierdo']; assert.equal(I.parcial, true); caja(I, -0.5, 239.5, 40, 40, 'borde izquierdo');
  // lo que no se anota, con su motivo: fuera del campo, de espaldas y detrás de la cámara
  assert.deepEqual(omitidos, [
    { clase: 'fruta', id: null, nombre: 'fuera', motivo: 'fuera del campo' },
    { clase: 'aruco', id: 6, nombre: 'marcador 6', motivo: 'de espaldas a la cámara' },
    { clase: 'plato', id: null, nombre: 'detrás', motivo: 'fuera de los planos de la cámara (detrás o a más de su alcance)' },
  ]);
  // un ArUco con una esquina fuera de la imagen es parcial y conserva sus esquinas sin recortar
  const cortado = { ...ARUCO, nombre: 'cortado', esquinas: [[1.56, -0.025, 2], [1.64, -0.025, 2], [1.64, 0.025, 2], [1.56, 0.025, 2]] }; // x/z de 0,78 a 0,82: u de 631,5 a 647,5 (el borde es 639,5)
  const c = CAPTURA.anotar(V, CAM, [cortado]).anotados[0]; assert.equal(c.parcial, true); cerca(c.esquinas[1][0], 647.5, 1e-9, 'la esquina fuera no se recorta'); caja(c, 631.5, 234.5, 8, 10, 'ArUco cortado');
  // justo fuera, sin tocar la imagen: no se anota
  assert.equal(CAPTURA.anotar(V, CAM, [{ ...PLATO, puntos: [[1.62, 0, 2], [1.8, 0, 2], [1.8, 0.05, 2]] }]).anotados.length, 0); // x/z desde 0,81: u desde 643,5
  // una clase que no existe (p. ej. una persona) es un error, no se anota
  assert.throws(() => CAPTURA.anotar(V, CAM, [{ clase: 'persona', id: null, nombre: 'p', puntos: [[0, 0, 2]] }]), /clase desconocida/);
});

const DOC = () => {
  const r = CAPTURA.anotar(V, CAM, MUESTRA), E = CAPTURA.vista(5.952, 3.6);
  return CAPTURA.documento({ clave: 'cenital', nombre: 'Cenital', grupo: 'V2', modo: '1920x1080', focal: 3.6 }, { id: 'elp-ficha', w: 5.952 }, E, CTX, r);
};
const tipo = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

test('C2: el JSON sale con el esquema fijo (claves, orden y tipos), 640 × 480, esquinas de ArUco en el orden de OpenCV y sin clase «persona»', () => {
  const d = DOC();
  assert.deepEqual(Object.keys(d), ['esquema', 'aviso', 'camara', 'imagen', 'proyeccion', 'oclusion', 'personas', 'caja_2d', 'orden_esquinas_aruco', 'origen', 'objetos', 'omitidos']);
  assert.equal(d.esquema, 'gemelo-celda/captura-sintetica/1'); assert.equal(d.aviso, 'sirve para probar pipelines, no para sustituir datos reales');
  assert.deepEqual(Object.keys(d.camara), ['clave', 'nombre', 'grupo', 'modo_de_la_camara', 'focal_mm', 'sensor', 'ancho_sensor_mm']);
  assert.deepEqual(d.camara, { clave: 'cenital', nombre: 'Cenital', grupo: 'V2', modo_de_la_camara: '1920x1080', focal_mm: 3.6, sensor: 'elp-ficha', ancho_sensor_mm: 5.952 });
  assert.deepEqual(Object.keys(d.imagen), ['modo', 'ancho', 'alto', 'convencion_pixel']);
  assert.deepEqual([d.imagen.modo, d.imagen.ancho, d.imagen.alto], ['640x480', 640, 480]);
  assert.deepEqual(Object.keys(d.proyeccion), ['modelo', 'distorsion', 'fx', 'fy', 'cx', 'cy', 'campo_horizontal_grados', 'campo_vertical_grados']);
  assert.deepEqual([d.proyeccion.fx, d.proyeccion.cx, d.proyeccion.cy, d.proyeccion.campo_horizontal_grados, d.proyeccion.campo_vertical_grados], [387.0968, 319.5, 239.5, 79.16, 63.6]);
  assert.match(d.oclusion, /^solo la del campo y los bordes/); assert.match(d.oclusion, /T4\.2/); assert.match(d.proyeccion.distorsion, /^ninguna/);
  assert.deepEqual(d.orden_esquinas_aruco, ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda']);
  // cada objeto: claves en su orden y tipos; las cajas con 4 números; las esquinas de un ArUco, cuatro pares, y null en lo demás
  assert.equal(d.objetos.length, 5);
  for (const o of d.objetos) {
    assert.deepEqual(Object.keys(o), ['clase', 'id', 'nombre', 'origen', 'visible', 'parcial', 'caja', 'esquinas'], o.nombre);
    assert.deepEqual([tipo(o.clase), tipo(o.nombre), tipo(o.origen), tipo(o.visible), tipo(o.parcial), tipo(o.caja)], ['string', 'string', 'string', 'boolean', 'boolean', 'object'], o.nombre);
    assert.deepEqual(Object.keys(o.caja), ['x', 'y', 'ancho', 'alto']); assert.ok(Object.values(o.caja).every(v => typeof v === 'number' && Number.isFinite(v)), o.nombre);
    if (o.clase === 'aruco') { assert.equal(tipo(o.id), 'number'); assert.equal(o.esquinas.length, 4); assert.ok(o.esquinas.every(p => p.length === 2 && p.every(v => typeof v === 'number')), o.nombre); }
    else { assert.equal(o.id, null); assert.equal(o.esquinas, null); }
  }
  assert.deepEqual(d.objetos[0].esquinas, [[314.5, 234.5], [324.5, 234.5], [324.5, 244.5], [314.5, 244.5]], 'esquinas del ArUco, en el orden de OpenCV, redondeadas a 0,01 px');
  assert.deepEqual(d.objetos[0].caja, { x: 314.5, y: 234.5, ancho: 10, alto: 10 });
  assert.deepEqual(d.objetos.map(o => o.clase), ['aruco', 'plato', 'fruta', 'fruta', 'fruta']);
  // ninguna persona: ni en las clases del módulo ni en las de los objetos ni en las de los omitidos
  assert.deepEqual(CAPTURA.CLASES, ['aruco', 'plato', 'fruta']); assert.ok(![...d.objetos, ...d.omitidos].some(o => /persona/i.test(o.clase)), 'ninguna clase de persona');
  assert.match(d.personas, /sin personas/); assert.deepEqual(d.omitidos.map(o => o.motivo), ['fuera del campo', 'de espaldas a la cámara', 'fuera de los planos de la cámara (detrás o a más de su alcance)']);
  // el origen de cada valor (src/origen.js): la cámara es MEDIDO y lo dibujado por el gemelo, SUPUESTO
  assert.deepEqual(Object.keys(d.origen), ['camara', 'campo_vision', 'aruco', 'plato', 'fruta']);
  assert.deepEqual(Object.values(d.origen).map(e => Object.keys(e).join()), Array(5).fill('tipo,valor,fuente'));
  assert.deepEqual(Object.values(d.origen).map(e => e.tipo), ['MEDIDO', 'SUPUESTO', 'SUPUESTO', 'SUPUESTO', 'SUPUESTO']);
  assert.deepEqual(d.objetos.map(o => o.origen), ['SUPUESTO', 'SUPUESTO', 'SUPUESTO', 'SUPUESTO', 'SUPUESTO']);
});

test('C2: el texto es determinista (los mismos bytes dos veces), JSON válido que vuelve al documento, con cada esquina y cada caja en una línea', () => {
  const a = CAPTURA.texto(DOC()), b = CAPTURA.texto(DOC());
  assert.equal(a, b, 'dos veces, los mismos bytes'); assert.ok(a.endsWith('}\n') && !a.endsWith('\n\n'));
  assert.deepEqual(JSON.parse(a), DOC(), 'el texto es el documento');
  assert.ok(a.includes('"esquinas": [\n        [314.5, 234.5],\n        [324.5, 234.5],\n        [324.5, 244.5],\n        [314.5, 244.5]\n      ]'), 'cada esquina en una línea');
  assert.ok(a.includes('"caja": { "x": 314.5, "y": 234.5, "ancho": 10, "alto": 10 }'), 'la caja en una línea');
  assert.ok(a.includes('"x": 599.5') && a.includes('"x": -0.5'), 'las cajas recortadas');
  assert.doesNotMatch(a, /"clase": "persona"/); assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}T|NaN|undefined|Infinity/, 'sin fechas ni valores raros');
});
