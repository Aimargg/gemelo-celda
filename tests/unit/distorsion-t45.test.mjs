// Unitario de la distorsión Brown–Conrady (src/distorsion.js, sin navegador; T4.5): la función de distorsión con un D de muestra
// calculada aparte a mano (un punto en el eje, uno en una esquina y uno sobre un radio), D = 0 como identidad, la inversa numérica que
// deshace la directa, el campo extra que necesita el render, la lectura de un camera_info (los generados por exportar.js, que están en
// tests/fixtures/ros, y otros con D no nula) y los casos malos con su motivo. Las referencias salen de aritmética hecha a mano (abajo,
// paso a paso) o de los ficheros que genera exportar.js, no del módulo que se prueba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const DIST = require('../../src/distorsion.js');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'src/distorsion.js'), 'utf8');
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);

// D de muestra [k1, k2, p1, p2, k3] (ROS plumb_bob: D = k1, k2, t1, t2, k3)
const D = [-0.25, 0.05, 0.002, -0.001, 0.01];

test('C1: la distorsión de un punto en el eje, en una esquina y sobre un radio, calculada aparte a mano', () => {
  // Eje, (x, y) = (0,5; 0): r² = 0,25; R = 1 − 0,25·0,25 + 0,05·0,0625 + 0,01·0,015625 = 0,94078125
  //   x_d = 0,5·0,94078125 + 2·0,002·0,5·0 + (−0,001)·(0,25 + 2·0,25) = 0,470390625 − 0,00075 = 0,469640625
  //   y_d = 0·R + 0,002·(0,25 + 0) + 2·(−0,001)·0,5·0 = 0,0005
  let f = DIST.distorsionar(D, 0.5, 0); cerca(f.x, 0.469640625, 1e-12, 'x en el eje'); cerca(f.y, 0.0005, 1e-12, 'y en el eje');
  // Esquina, (0,8; −0,45): r² = 0,64 + 0,2025 = 0,8425; r⁴ = 0,70980625; r⁶ = 0,598011765625
  //   R = 1 − 0,210625 + 0,0354903125 + 0,00598011765625 = 0,83084543015625
  //   x_d = 0,8·R + 2·0,002·0,8·(−0,45) + (−0,001)·(0,8425 + 2·0,64) = 0,664676344125 − 0,00144 − 0,0021225 = 0,661113844125
  //   y_d = −0,45·R + 0,002·(0,8425 + 2·0,2025) + 2·(−0,001)·0,8·(−0,45) = −0,3738804435703125 + 0,002495 + 0,00072 = −0,3706654435703125
  f = DIST.distorsionar(D, 0.8, -0.45); cerca(f.x, 0.661113844125, 1e-12, 'x en la esquina'); cerca(f.y, -0.3706654435703125, 1e-12, 'y en la esquina');
  // Sobre un radio, (0,6; 0,8) con p1 = p2 = 0: r² = 1 y R = 1 − 0,25 + 0,05 + 0,01 = 0,81 → (0,486; 0,648), el mismo ángulo y el radio por 0,81
  f = DIST.distorsionar([-0.25, 0.05, 0, 0, 0.01], 0.6, 0.8); cerca(f.x, 0.486, 1e-12, 'x sobre el radio'); cerca(f.y, 0.648, 1e-12, 'y sobre el radio');
  cerca(Math.atan2(f.y, f.x), Math.atan2(0.8, 0.6), 1e-12, 'la radial no gira');
  // sin la parte radial (k = 0): solo la tangencial, (0,3; 0,4) con p1 = 0,01 y p2 = 0,02: r² = 0,25
  //   x_d = 0,3 + 2·0,01·0,3·0,4 + 0,02·(0,25 + 2·0,09) = 0,3 + 0,0024 + 0,0086 = 0,311 ; y_d = 0,4 + 0,01·(0,25 + 2·0,16) + 2·0,02·0,3·0,4 = 0,4 + 0,0057 + 0,0048 = 0,4105
  f = DIST.distorsionar([0, 0, 0.01, 0.02, 0], 0.3, 0.4); cerca(f.x, 0.311, 1e-12, 'x tangencial'); cerca(f.y, 0.4105, 1e-12, 'y tangencial');
});

test('C1: D = 0 es la identidad; la parte radial es simétrica (y hacia abajo o hacia arriba da lo mismo, cambiado de signo)', () => {
  for (const [x, y] of [[0, 0], [0.3, -0.7], [-1.1, 0.4], [0.82, 0.46]]) { const f = DIST.distorsionar([0, 0, 0, 0, 0], x, y); assert.equal(f.x, x); assert.equal(f.y, y); }
  const a = DIST.distorsionar([-0.25, 0.05, 0, 0, 0.01], 0.7, 0.3), b = DIST.distorsionar([-0.25, 0.05, 0, 0, 0.01], 0.7, -0.3);
  cerca(a.x, b.x, 1e-15, 'x'); cerca(a.y, -b.y, 1e-15, 'y');
  assert.ok(DIST.esNula([0, 0, 0, 0, 0])); assert.ok(!DIST.esNula(D));
});

test('C1: la inversa numérica deshace la directa (error < 1e-6 en coordenadas normalizadas) en toda una rejilla, con barril y con cojín', () => {
  for (const Dm of [D, [-0.12, 0.02, 0.001, -0.002, 0], [0.25, -0.05, -0.001, 0.0015, 0.01], [0, 0, 0, 0, 0]]) {
    let peor = 0, n = 0;
    for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
      const x = i / 10, y = j / 10, f = DIST.distorsionar(Dm, x, y), r = DIST.inversa(Dm, f.x, f.y);
      assert.ok(r.ok, `la inversa de la imagen de (${x}, ${y}) con ${Dm} no converge`); peor = Math.max(peor, Math.hypot(r.x - x, r.y - y)); n++;
    }
    assert.equal(n, 625); assert.ok(peor < 1e-6, `error de ida y vuelta ${peor} con D = ${Dm}`);
  }
  // y con los números del eje de arriba, a mano: la imagen de (0,5; 0) es (0,469640625; 0,0005)
  const r = DIST.inversa(D, 0.469640625, 0.0005); assert.ok(r.ok); cerca(r.x, 0.5, 1e-9, 'x'); cerca(r.y, 0, 1e-9, 'y');
});

test('C1: un D que pliega la imagen no tiene inversa: ok falso, sin devolver un punto que parezca bueno', () => {
  // k1 = −0,3, k2 = 0,1 y k3 = −0,02: el radio distorsionado r·(1 − 0,3r² + 0,1r⁴ − 0,02r⁶) no pasa de ~0,91 (r ≈ 1,45) y 0,95 no se alcanza
  const fuerte = [-0.3, 0.1, 0.001, -0.002, -0.02];
  assert.equal(DIST.inversa(fuerte, 0.827, 0.465).ok, false);
  assert.equal(DIST.inversa(fuerte, 0.3, 0.1).ok, true, 'cerca del centro sí tiene');
});

test('el campo que necesita el render: sin distorsión es el de la cámara; con barril es mayor y cubre las esquinas; con cojín no hace falta más', () => {
  const tx = 0.8264, ty = 0.4649; // el medio campo (tan) de la cámara cenital: ~±0,83 × ±0,46
  let c = DIST.campoNecesario([0, 0, 0, 0, 0], tx, ty, 1.6);
  assert.deepEqual([c.razonX, c.razonY, c.cubre, c.motivo], [1, 1, true, '']); assert.equal(c.tanX, tx); assert.equal(c.tanY, ty);
  const barril = [-0.12, 0.02, 0.001, -0.002, 0];
  c = DIST.campoNecesario(barril, tx, ty, 1.6);
  assert.equal(c.cubre, true); assert.ok(c.razonX > 1.1 && c.razonX < 1.2 && c.razonY > 1.1 && c.razonY < 1.2, `razones ${c.razonX}, ${c.razonY}`);
  cerca(c.tanX, tx * c.razonX, 1e-12, 'tanX'); cerca(c.tanY, ty * c.razonY, 1e-12, 'tanY');
  // aparte: las cuatro esquinas del render ancho, pasadas por la distorsión directa, quedan fuera de la imagen (más allá de sus esquinas)
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const f = DIST.distorsionar(barril, sx * c.tanX, sy * c.tanY); assert.ok(Math.abs(f.x) >= tx && Math.abs(f.y) >= ty, `esquina ${sx},${sy}: (${f.x}, ${f.y})`); }
  // con un máximo menor que lo que hace falta, el render se queda en el máximo y se avisa
  c = DIST.campoNecesario(barril, tx, ty, 1.05);
  assert.equal(c.cubre, false); assert.equal(c.razonX, 1.05); assert.equal(c.razonY, 1.05); assert.match(c.motivo, /las esquinas necesitan ×1,14 de campo y el máximo declarado es ×1,05: parte de la imagen quedaría sin render/);
  // un D que pliega la imagen: no se puede cubrir con ningún campo
  c = DIST.campoNecesario([-0.3, 0.1, 0.001, -0.002, -0.02], tx, ty, 1.6);
  assert.equal(c.cubre, false); assert.match(c.motivo, /la distorsión no tiene inversa en el punto \(-?0\.8\d\d, -?0\.4\d\d\) de la imagen: ese D pliega la imagen/);
  // el cojín (k1 > 0) acerca el borde: el render de la cámara basta
  c = DIST.campoNecesario([0.25, -0.05, -0.001, 0.0015, 0.01], tx, ty, 1.6); assert.deepEqual([c.razonX, c.razonY, c.cubre], [1, 1, true]);
  assert.throws(() => DIST.campoNecesario([0, 0, 0, 0], tx, ty, 1.6), /D tiene que ser \[k1, k2, p1, p2, k3\]/);
  assert.throws(() => DIST.campoNecesario([0, 0, NaN, 0, 0], tx, ty, 1.6), /p1 \(t1\): NaN no es un número finito/);
  assert.throws(() => DIST.campoNecesario([0, 0, 0, 0, 0], 0, ty, 1.6), /tienen que ser positivos/);
});

test('el campo extra máximo: SUPUESTO sin validar, de 1 a 4, editable; lo demás falla con su motivo y no cambia la configuración', () => {
  const c0 = DIST.cfgDefecto(); assert.equal(c0.margen.max, 1.6); assert.equal(DIST.MARGEN_DEFECTO, 1.6);
  assert.equal(DIST.PARAMS.length, 1); assert.equal(DIST.PARAMS[0].origen, 'SUPUESTO'); assert.match(DIST.PARAMS[0].fuente, /SUPUESTO \[SIN VALIDAR\]/); assert.equal(DIST.PARAMS[0].editable, true);
  const c1 = DIST.fijar(c0, 'margen.max', 2.5); assert.equal(c1.margen.max, 2.5); assert.equal(c0.margen.max, 1.6, 'no se muta la de partida'); assert.equal(DIST.fijar(c0, 'margen.max', 1).margen.max, 1); assert.equal(DIST.fijar(c0, 'margen.max', 4).margen.max, 4);
  for (const v of [0.99, 4.01, NaN, Infinity, -2, '2', null]) assert.throws(() => DIST.fijar(c0, 'margen.max', v), /no está entre 1 y 4/, String(v));
  assert.throws(() => DIST.fijar(c0, 'otro.max', 2), /parámetro desconocido/);
  assert.match(DIST.FUENTE, /sin comprobar aquí/);
});

// Los camera_info que genera exportar.js (tests/fixtures/ros, de `npm run caracterizar -- --ros`): nominal, 203 y 203 con prefijo
const CASOS = ['nominal', '203', '203-prefijo'], CAMS = ['cenital', 'entrega', 'persona'];
const fixture = (caso, cam) => fs.readFileSync(path.join(RAIZ, 'tests/fixtures/ros', caso, 'camera_info', `camara_${cam}.yaml`), 'utf8');
const lineaD = t => /distortion_coefficients:\n  rows: 1[^\n]*\n  cols: 5[^\n]*\n  data: \[[^\]]*\]/.exec(t)[0];

test('C2: un camera_info generado por exportar.js se lee (D = 0), con su tamaño y su K; ida y vuelta con un D no nulo', () => {
  for (const caso of CASOS) for (const cam of CAMS) {
    const t = fixture(caso, cam), i = DIST.leerCameraInfo(t, { w: 1920, h: 1080 });
    assert.deepEqual(i.D, [0, 0, 0, 0, 0], `${caso}/${cam}`); assert.equal(i.modelo, 'plumb_bob'); assert.equal(i.nombre, `camara_${cam}`); assert.equal([i.w, i.h].join('x'), '1920x1080');
    assert.equal(i.K.length, 9); assert.ok(DIST.esNula(i.D));
    // K del fichero: la fila 0 y la 1 con fx, cx, fy, cy y el 1 de la esquina; los ceros de las demás
    const m = /camera_matrix:\n  rows: 3[^\n]*\n  cols: 3[^\n]*\n  data: \[([^\]]*)\]/.exec(t); assert.deepEqual(i.K, m[1].split(',').map(Number));
    assert.equal(i.K[8], 1); assert.ok(i.K[0] > 500 && i.K[4] > 500); cerca(i.K[2], 959.5, 1e-9, 'cx = (w − 1)/2'); cerca(i.K[5], 539.5, 1e-9, 'cy = (h − 1)/2');
  }
  // sin pasar el modo, también se lee; el nombre del fichero no hace falta
  assert.equal(DIST.leerCameraInfo(fixture('nominal', 'cenital')).w, 1920);
  // ida y vuelta: se cambia solo la línea de D del fichero exportado y sale ese D, con lo demás intacto
  const t = fixture('203', 'entrega'), nuevo = t.replace(lineaD(t), lineaD(t).replace(/data: \[[^\]]*\]/, 'data: [-0.28, 0.07, 0.001, -0.0005, -0.01]'));
  assert.notEqual(nuevo, t); const a = DIST.leerCameraInfo(t, { w: 1920, h: 1080 }), b = DIST.leerCameraInfo(nuevo, { w: 1920, h: 1080 });
  assert.deepEqual(b.D, [-0.28, 0.07, 0.001, -0.0005, -0.01]); assert.deepEqual([b.K, b.w, b.h, b.nombre], [a.K, a.w, a.h, a.nombre]); assert.ok(!DIST.esNula(b.D));
});

test('C2: lee los otros modos de escribir el mismo camera_info: lista partida en varias líneas, lista de bloque, comillas, comentarios, CRLF y BOM', () => {
  const ci = (dato, extra = '') => `${extra}image_width: 1920\nimage_height: 1080\ncamera_name: "una # camara"  # comentario\ncamera_matrix:\n  rows: 3\n  cols: 3\n  data: [1000, 0, 959.5,\n    0, 1000, 539.5,\n    0, 0, 1]\ndistortion_model: plumb_bob\ndistortion_coefficients:\n  rows: 1\n  cols: 5\n  data: ${dato}\n`;
  const esperado = [0.1, -0.2, 0.001, 0.002, 0.3];
  for (const dato of ['[0.1, -0.2, 0.001, 0.002, 0.3]', '[0.1, -0.2,\n    0.001, 0.002,\n    0.3]', '\n    - 0.1\n    - -0.2\n    - 0.001\n    - 0.002\n    - 0.3', '[1e-1, -2E-1, 1e-3, .002, +0.3]']) {
    const i = DIST.leerCameraInfo(ci(dato), { w: 1920, h: 1080 }); assert.deepEqual(i.D, esperado, dato); assert.deepEqual(i.K, [1000, 0, 959.5, 0, 1000, 539.5, 0, 0, 1]); assert.equal(i.nombre, 'una # camara');
  }
  assert.deepEqual(DIST.leerCameraInfo(ci('[0.1, -0.2, 0.001, 0.002, 0.3]').replace(/\n/g, '\r\n')).D, esperado, 'CRLF');
  assert.deepEqual(DIST.leerCameraInfo('﻿' + ci('[0.1, -0.2, 0.001, 0.002, 0.3]', '---\n# cabecera\n')).D, esperado, 'BOM y ---');
  assert.equal(DIST.leerCameraInfo(ci('[0, 0, 0, 0, 0]').replace('camera_name: "una # camara"  # comentario\n', '')).nombre, '', 'camera_name es opcional');
});

test('C2: los casos malos fallan con su motivo y sin devolver nada: otro modelo, tamaño distinto, NaN, forma incorrecta, claves que faltan, texto que no es YAML', () => {
  const ci = (o = {}) => `image_width: ${o.w ?? 1920}\nimage_height: ${o.h ?? 1080}\ncamera_name: 'x'\ncamera_matrix:\n  rows: ${o.kr ?? 3}\n  cols: 3\n  data: ${o.k ?? '[1000, 0, 959.5, 0, 1000, 539.5, 0, 0, 1]'}\ndistortion_model: ${o.m ?? 'plumb_bob'}\ndistortion_coefficients:\n  rows: ${o.r ?? 1}\n  cols: ${o.c ?? 5}\n  data: ${o.d ?? '[0.1, -0.2, 0.001, 0.002, 0.3]'}\n`;
  const modo = { w: 1920, h: 1080 };
  const malo = (texto, re, que, m = modo) => assert.throws(() => DIST.leerCameraInfo(texto, m), re, que);
  assert.doesNotThrow(() => DIST.leerCameraInfo(ci(), modo));
  malo(ci({ m: 'rational_polynomial' }), /distortion_model "rational_polynomial" no está soportado: solo plumb_bob/, 'otro modelo');
  malo(ci({ m: 'equidistant' }), /distortion_model "equidistant" no está soportado/, 'fisheye');
  malo(ci({ w: 1280, h: 720 }), /el camera_info es de 1280 × 720 y el modo de la cámara es 1920 × 1080: no coincide/, 'tamaño distinto');
  malo(ci({ w: 1920, h: 1081 }), /de 1920 × 1081 y el modo de la cámara es 1920 × 1080/, 'alto distinto');
  malo(ci({ d: '[.nan, 0, 0, 0, 0]' }), /distortion_coefficients: data\[0\] = NaN no es un número finito/, 'NaN');
  malo(ci({ d: '[0, 0, 0, .inf, 0]' }), /data\[3\] = Infinity no es un número finito/, 'infinito');
  malo(ci({ d: '[0, -.inf, 0, 0, 0]' }), /data\[1\] = -Infinity no es un número finito/, 'menos infinito');
  malo(ci({ d: '[0, 0, 0, 0, abc]' }), /data\[4\] = "abc" no es un número finito/, 'texto');
  malo(ci({ k: '[1000, 0, 959.5, 0, 1000, 539.5, 0, 0, .nan]' }), /camera_matrix: data\[8\] = NaN no es un número finito/, 'NaN en K');
  malo(ci({ c: 4, d: '[0, 0, 0, 0]' }), /distortion_coefficients: tiene que ser de 1 × 5 y dice 1 × 4/, 'forma de D');
  malo(ci({ r: 5, c: 1 }), /distortion_coefficients: tiene que ser de 1 × 5 y dice 5 × 1/, 'D en columna');
  malo(ci({ d: '[0, 0, 0, 0]' }), /distortion_coefficients: data tiene 4 valores y una matriz de 1 × 5 lleva 5/, 'faltan valores');
  malo(ci({ d: '[0, 0, 0, 0, 0, 0, 0, 0]', c: 8 }), /tiene que ser de 1 × 5 y dice 1 × 8/, 'rational de 8 con plumb_bob');
  malo(ci({ k: '[1000, 0, 959.5, 0, 1000, 539.5, 0, 0]' }), /camera_matrix: data tiene 8 valores y una matriz de 3 × 3 lleva 9/, 'K corta');
  malo(ci({ kr: 2 }), /camera_matrix: tiene que ser de 3 × 3 y dice 2 × 3/, 'forma de K');
  malo(ci({ w: 0 }), /image_width: 0 no es un entero positivo/, 'ancho cero');
  malo(ci({ w: 19.5 }), /image_width: 19.5 no es un entero positivo/, 'ancho no entero');
  malo(ci().replace('image_width: 1920\n', ''), /falta image_width/, 'sin ancho');
  malo(ci().replace(/distortion_model: plumb_bob\n/, ''), /falta distortion_model/, 'sin modelo');
  malo(ci().replace(/distortion_coefficients:[\s\S]*$/, ''), /falta «distortion_coefficients» \(rows, cols y data\)/, 'sin D');
  malo(ci().replace(/camera_matrix:\n  rows: 3\n  cols: 3\n  data: [^\n]*\n/, ''), /falta «camera_matrix»/, 'sin K');
  malo(ci().replace('image_height: 1080\n', 'image_width: 1920\n'), /línea 2: la clave «image_width» está repetida/, 'clave repetida');
  malo('', /el camera_info está vacío/, 'vacío'); malo('  \n\n', /está vacío/, 'solo espacios'); malo(null, /está vacío/, 'null'); malo(42, /está vacío/, 'número');
  malo('esto no es un camera_info', /línea 1: no es «clave: valor» \(esto no es un camera_info\)/, 'basura');
  malo('image_width: 1920\n  image_height: 1080\n', /línea 2: sangría inesperada/, 'sangría');
  malo(ci({ d: '[0, 0, 0' }), /la lista no se cierra con «]»/, 'lista sin cerrar');
  malo('x'.repeat(200001), /no es un camera_info/, 'demasiado largo');
  // un fallo no deja nada a medias: el que sale bien después sigue saliendo igual
  assert.deepEqual(DIST.leerCameraInfo(ci(), modo).D, [0.1, -0.2, 0.001, 0.002, 0.3]);
});

test('D4, I2, I4 y D11: src/distorsion.js es lógica pura (sin DOM, three, red, ROS ni workers) y se carga en un contexto vacío; está en los dos HTML construidos sin su línea de módulo', () => {
  const codigo = FUENTE.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const g of [/\bdocument\b/, /\bwindow\b/, /\bTHREE\b/, /\bfetch\b/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/, /\bWorker\b/, /\bWebAssembly\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bpublish\b|\badvertise\b|\bcallService\b/, /\bCAMS\b/, /\bEXPORTAR\b/, /\bORIGEN\b/]) assert.doesNotMatch(codigo, g);
  const m = { exports: null }; vm.runInNewContext(FUENTE, { module: m }); assert.equal(typeof m.exports.inversa, 'function');
  for (const f of ['dist/gemelo-celda.html', 'index.html']) {
    const h = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    assert.equal(h.split('const DISTORSION = (() => {').length - 1, 1, `${f}: lleva DISTORSION una vez`); assert.ok(!h.includes('module.exports = DISTORSION'), `${f}: sin su línea de módulo`);
    assert.ok(h.includes('id="distSec"'), `${f}: lleva la sección del panel`);
  }
  assert.equal(fs.readFileSync(path.join(RAIZ, 'src/app.js'), 'utf8').split('@@DISTORSION@@').length - 1, 1, 'un solo marcador en app.js');
  assert.match(fs.readFileSync(path.join(RAIZ, 'tools/build.sh'), 'utf8'), /@@DISTORSION@@\/\{incluir\(DI\); next\}/);
});
