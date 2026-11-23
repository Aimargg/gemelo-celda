// Unitario del diseñador del tablero de la bandeja (src/tablero.js y EXPORTAR.tablero de src/exportar.js, sin navegador; T4.4):
// las esquinas de cada marcador en el orden de OpenCV (a mano con giro 0, 90° y 30°, y por propiedades en un barrido de giros),
// la validación de ids y lado con su error, el aviso de centros alineados (con la tolerancia editable, SUPUESTO SIN VALIDAR) y el
// YAML tablero_bandeja.yaml: su texto escrito aquí a mano, el analizador de rcl de los tests (yaml@2.9.1 en 1.1 y 1.2) y la ida y
// vuelta (las esquinas leídas salen de las posiciones y el lado, con otra fórmula). Las referencias son de aritmética a mano; el
// estudio «percepcion-bandeja-personas» no está en el repo, así que lo único que se cita de él es lo que dice el plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import YAML from 'yaml';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { problemasParams } from '../rcl-params.mjs';
const require = createRequire(import.meta.url);
const TABLERO = require('../../src/tablero.js');
const SENSOR = require('../../src/sensor.js');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FUENTE_EXPORTAR = fs.readFileSync(path.join(RAIZ, 'src/exportar.js'), 'utf8');
const FUENTE_TABLERO = fs.readFileSync(path.join(RAIZ, 'src/tablero.js'), 'utf8');
const ORIGEN = require('../../src/origen.js');
const EXPORTAR = (() => { const m = { exports: null }; vm.runInNewContext(FUENTE_EXPORTAR, { module: m }); return m.exports; })();
const CFG = TABLERO.cfgDefecto();
const PI = Math.PI;
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);
const esquinasCerca = (got, want, tol, que) => { assert.equal(got.length, 4, `${que}: cuatro esquinas`); got.forEach((p, i) => { assert.equal(p.length, 3); p.forEach((v, j) => cerca(v, want[i][j], tol, `${que}: esquina ${i} eje ${'xyz'[j]}`)); }); };
const M = (id, x, y, lado = 0.032, yaw = 0) => ({ id, lado, x, y, yaw });
// Los cuatro marcadores de la bandeja de la escena (src/app.js, bandMarc): ids 6–9 de 32 mm
const ESCENA = [M(6, 0.14, -0.17), M(7, 0.14, 0), M(8, 0.14, 0.17), M(9, -0.05, 0.205)];
const ORDEN = ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda'];

test('C1: las cuatro esquinas de un marcador, a mano, con giro 0, 90° y 30°, en el orden de OpenCV (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda) y con z = 0', () => {
  assert.deepEqual(TABLERO.ORDEN, ORDEN);
  // giro 0, lado 32 mm en (0,14; −0,17): centro ± 16 mm
  esquinasCerca(TABLERO.esquinas(M(6, 0.14, -0.17)), [[0.124, -0.154, 0], [0.156, -0.154, 0], [0.156, -0.186, 0], [0.124, -0.186, 0]], 1e-12, 'giro 0');
  // giro 90° (x → y, y → −x), lado 10 cm en (0,3; 0,2): el medio lado de 0,05 gira un cuarto de vuelta
  esquinasCerca(TABLERO.esquinas(M(1, 0.3, 0.2, 0.1, PI / 2)), [[0.25, 0.15, 0], [0.25, 0.25, 0], [0.35, 0.25, 0], [0.35, 0.15, 0]], 1e-12, 'giro 90°');
  // giro 30°, lado 4 cm en (−0,05; 0,1): cos 30° · 0,02 = √3/2 · 0,02 y sen 30° · 0,02 = 0,01
  const k = 0.02 * Math.sqrt(3) / 2, s = 0.01;
  esquinasCerca(TABLERO.esquinas(M(2, -0.05, 0.1, 0.04, PI / 6)), [
    [-0.05 - k - s, 0.1 - s + k, 0], [-0.05 + k - s, 0.1 + s + k, 0], [-0.05 + k + s, 0.1 + s - k, 0], [-0.05 - k + s, 0.1 - s - k, 0]], 1e-12, 'giro 30°');
  // por propiedades, en un barrido de giros: lado entre esquinas seguidas, TL→TR en la dirección del giro, centro = media, z = 0 y recorrido de OpenCV
  // (con x a la derecha e y arriba, arriba-izquierda → arriba-derecha → abajo-derecha → abajo-izquierda es en sentido horario: área con signo −lado²)
  for (let i = 0; i < 72; i++) {
    const yaw = -PI + i * PI / 36, m = M(10 + i % 40, 0.07 * Math.cos(i), -0.11 * Math.sin(2 * i), 0.03 + 0.001 * i, yaw), e = TABLERO.esquinas(m);
    for (let j = 0; j < 4; j++) { const a = e[j], b = e[(j + 1) % 4]; cerca(Math.hypot(b[0] - a[0], b[1] - a[1]), m.lado, 1e-12, `lado ${j} del giro ${yaw}`); assert.equal(a[2], 0); }
    cerca(e[1][0] - e[0][0], m.lado * Math.cos(yaw), 1e-12, 'TL→TR, x'); cerca(e[1][1] - e[0][1], m.lado * Math.sin(yaw), 1e-12, 'TL→TR, y');
    cerca(e.reduce((t, p) => t + p[0], 0) / 4, m.x, 1e-12, 'centro x'); cerca(e.reduce((t, p) => t + p[1], 0) / 4, m.y, 1e-12, 'centro y');
    let area = 0; for (let j = 0; j < 4; j++) { const a = e[j], b = e[(j + 1) % 4]; area += (a[0] * b[1] - b[0] * a[1]) / 2; }
    cerca(area, -m.lado * m.lado, 1e-12, `área con signo del giro ${yaw}`);
  }
});

test('C1: los ids son enteros de 0 a 49 y únicos, el lado es positivo y los números son finitos; cada fallo dice qué marcador y por qué, sin resultado a medias', () => {
  assert.deepEqual(TABLERO.validar(ESCENA), ESCENA);
  assert.equal(TABLERO.DICCIONARIO, 'DICT_4X4_50'); assert.equal(TABLERO.MAX_ID, 49);
  assert.doesNotThrow(() => TABLERO.validar([M(0, 0, 0), M(49, 0.1, 0)]), 'los ids 0 y 49 son válidos');
  assert.throws(() => TABLERO.validar([M(6, 0, 0), M(7, 0.1, 0), M(6, 0.2, 0)]), /el id 6 está repetido \(los ids del tablero son únicos\)/);
  assert.throws(() => TABLERO.validar([M(50, 0, 0)]), /marcador 1: el id 50 no es un entero de 0 a 49 \(DICT_4X4_50\)/);
  assert.throws(() => TABLERO.validar([M(6, 0, 0), M(-1, 0.1, 0)]), /marcador 2: el id -1 no es un entero de 0 a 49/);
  for (const id of [1.5, '6', null, undefined, NaN]) assert.throws(() => TABLERO.validar([{ ...M(6, 0, 0), id }]), /no es un entero de 0 a 49/, String(id));
  assert.throws(() => TABLERO.validar([M(6, 0, 0, 0)]), /marcador con id 6: el lado 0 no es un número positivo \(m\)/);
  assert.throws(() => TABLERO.validar([M(6, 0, 0, -0.03)]), /marcador con id 6: el lado -0\.03 no es un número positivo/);
  for (const lado of [NaN, Infinity, '0.03', null]) assert.throws(() => TABLERO.validar([M(6, 0, 0, lado)]), /el lado .* no es un número positivo/, String(lado));
  assert.throws(() => TABLERO.validar([M(7, NaN, 0)]), /marcador con id 7: x NaN no es un número finito/);
  assert.throws(() => TABLERO.validar([M(7, 0, Infinity)]), /marcador con id 7: y Infinity no es un número finito/);
  assert.throws(() => TABLERO.validar([M(7, 0, 0, 0.03, '1')]), /marcador con id 7: yaw "1" no es un número finito/);
  assert.throws(() => TABLERO.validar([]), /el tablero no tiene ningún marcador/);
  assert.throws(() => TABLERO.validar(null), /se esperaba una lista de marcadores/);
  assert.throws(() => TABLERO.validar([M(6, 0, 0), null]), /marcador 2: no es un objeto/);
  assert.throws(() => TABLERO.esquinas(M(6, 0, 0, 0)), /el lado 0 no es un número positivo/, 'esquinas también valida');
  assert.throws(() => TABLERO.modelo([M(6, 0, 0), M(6, 1, 1)], CFG), /el id 6 está repetido/, 'el modelo también valida');
});

test('C2: la alineación de los centros, con el desvío calculado aparte: los cuatro marcadores de la escena no avisan; sobre una recta (un solo borde), sí', () => {
  // escena: la recta entre los dos centros más separados (6 y 9) y el mayor desvío, el del marcador 8: |(−0,19)(0,34) − 0,375·0|/√(0,19² + 0,375²)
  let r = TABLERO.alineacion(ESCENA, CFG);
  assert.equal(r.n, 4); assert.equal(r.alineado, false); assert.equal(r.motivo, null); assert.equal(r.texto, null);
  cerca(r.desvio, 0.0646 / Math.hypot(0.19, 0.375), 1e-12, 'desvío de la escena'); cerca(r.tolerancia, 0.016, 1e-12, 'tolerancia = 0,5 × 32 mm');
  // los cuatro sobre x = 0,14: desvío 0 y aviso con el desvío, la tolerancia, su supuesto y la cita del plan
  r = TABLERO.alineacion([M(6, 0.14, -0.17), M(7, 0.14, 0), M(8, 0.14, 0.17), M(9, 0.14, 0.34)], CFG);
  assert.equal(r.alineado, true); assert.equal(r.motivo, 'recta'); cerca(r.desvio, 0, 1e-12, 'desvío 0');
  assert.match(r.texto, /^los 4 centros quedan sobre una recta \(el mayor desvío es 0,0 mm, dentro de la tolerancia de 16,0 mm = 0,5 lados de media, SUPUESTO SIN VALIDAR\): la pose del tablero con varios marcadores es degenerada; /);
  assert.match(r.texto, /percepcion-bandeja-personas «pose con varios marcadores», cita del plan sin comprobar aquí \(el estudio no está en el repo\)\)$/);
  // una diagonal también es una recta (no solo los bordes paralelos a los ejes)
  r = TABLERO.alineacion([M(1, 0, 0), M(2, 0.1, 0.1), M(3, 0.2, 0.2), M(4, 0.3, 0.3)], CFG); assert.equal(r.alineado, true);
  // en dos dimensiones, un ele: el desvío del tercero a la hipotenusa es 0,2·0,2/(0,2·√2) = 0,1·√2
  r = TABLERO.alineacion([M(1, 0, 0), M(2, 0.2, 0), M(3, 0, 0.2)], CFG);
  assert.equal(r.alineado, false); cerca(r.desvio, 0.1 * Math.SQRT2, 1e-12, 'desvío de un ele');
  // tres centros en el mismo punto: sobre una recta (no hay dos más separados) y sin dividir por cero
  r = TABLERO.alineacion([M(1, 0.1, 0.1), M(2, 0.1, 0.1), M(3, 0.1, 0.1)], CFG); assert.equal(r.alineado, true); assert.equal(r.desvio, 0);
});

test('C2: con dos marcadores o menos siempre hay aviso; la tolerancia (0,5 lados de media) es un supuesto editable y manda en los bordes', () => {
  let r = TABLERO.alineacion([M(6, 0.1, 0.1)], CFG);
  assert.equal(r.alineado, true); assert.equal(r.motivo, 'pocos'); assert.match(r.texto, /^con 1 marcador(es)? los centros siempre quedan sobre una recta: la pose del tablero con varios marcadores es degenerada; añade marcadores fuera de esa recta /);
  r = TABLERO.alineacion([M(6, 0.1, 0.1), M(7, 0.1, 0.3)], CFG);
  assert.equal(r.alineado, true); assert.equal(r.motivo, 'pocos'); assert.match(r.texto, /^con 2 marcadores los centros siempre quedan sobre una recta/);
  // tres marcadores de 32 mm con el del medio a d de la recta entre los extremos: hasta 16 mm (0,5 × 32) avisa, más no
  const con = (d, lado = 0.032) => [M(1, 0, 0, lado), M(2, 0.2, d, lado), M(3, 0.4, 0, lado)];
  assert.equal(TABLERO.alineacion(con(0.01), CFG).alineado, true);
  assert.equal(TABLERO.alineacion(con(0.016), CFG).alineado, true, 'justo en la tolerancia');
  assert.equal(TABLERO.alineacion(con(0.0161), CFG).alineado, false);
  assert.equal(TABLERO.alineacion(con(-0.0161), CFG).alineado, false, 'a la otra banda de la recta');
  // la tolerancia es medio lado de media: con marcadores de 10 cm, hasta 5 cm
  assert.equal(TABLERO.alineacion(con(0.04, 0.1), CFG).alineado, true); assert.equal(TABLERO.alineacion(con(0.051, 0.1), CFG).alineado, false);
  // editarla (sobre una copia): con 2 lados de media (64 mm) el de 16,1 mm ya está alineado y el texto lo dice
  const f2 = TABLERO.fijar(CFG, 'alineacion.fraccion', 2);
  r = TABLERO.alineacion(con(0.0161), f2); assert.equal(r.alineado, true); cerca(r.tolerancia, 0.064, 1e-12, 'tolerancia editada'); assert.match(r.texto, /tolerancia de 64,0 mm = 2 lados de media, SUPUESTO SIN VALIDAR/);
  assert.equal(CFG.alineacion.fraccion, 0.5, 'la configuración de partida no se altera'); assert.equal(TABLERO.cfgDefecto().alineacion.fraccion, 0.5);
  assert.equal(TABLERO.alineacion(con(0.0161), TABLERO.fijar(f2, 'alineacion.fraccion', 0.4)).alineado, false);
});

test('C2: la tolerancia es un SUPUESTO [SIN VALIDAR] editable con un valor positivo; sin citas inventadas', () => {
  assert.equal(TABLERO.PARAMS.length, 1);
  const p = TABLERO.PARAMS[0];
  assert.equal(p.id, 'alineacion.fraccion'); assert.equal(p.origen, 'SUPUESTO'); assert.equal(p.editable, true); assert.equal(p.valor, 0.5); assert.match(p.fuente, /SUPUESTO \[SIN VALIDAR\]/);
  assert.doesNotMatch(JSON.stringify(TABLERO.PARAMS), /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)/, 'una cita no comprobada');
  assert.throws(() => TABLERO.fijar(CFG, 'no.existe', 1), /parámetro desconocido/);
  for (const v of [0, -1, NaN, Infinity, '1', null]) assert.throws(() => TABLERO.fijar(CFG, 'alineacion.fraccion', v), /no es un número positivo/, String(v));
});

// ---------- C3: tablero_bandeja.yaml ----------
const SUP = 'SUPUESTO (disposición propuesta, sin medir)', MAR = 'SUPUESTO (ids propuestos)', NOM = 'SUPUESTO (nombre propuesto)';
const CTX = { robotId: 'nominal', sospechoso: false, yaw: 0, sensor: { id: 'elp-ficha', ...SENSOR.de('elp-ficha') }, tcpZ: 0.2 };
const yamlDe = (marcadores, cfg = CFG) => EXPORTAR.tablero({ ctx: CTX, tablero: TABLERO.modelo(marcadores, cfg) }, ORIGEN);
const datos = texto => texto.slice(texto.indexOf('/**:\n'));
// El bloque de un marcador, a mano: lado, centro y giro en texto y las cuatro esquinas (orden de OpenCV) con tres decimales
const bloqueMarcador = (id, lado, centro, yaw, esq) => [
  `      marcador_${id}:`, `        id: ${id}  # ${MAR}`, `        lado_m: ${lado}  # ${MAR}`, `        centro_m: [${centro}]  # ${SUP}`,
  `        yaw_rad: ${yaw}  # ${SUP}; giro del patrón sobre z, hacia +y de la bandeja`,
  ...ORDEN.map((o, i) => `        ${o}: [${esq[i]}]  # ${SUP}; esquina del patrón con z saliendo de la cara impresa`)].join('\n') + '\n';
const cabeceraDatos = ids => [
  '/**:', '  ros__parameters:', '    tablero:', `      frame_id: 'bandeja'  # ${NOM}`, `      diccionario: 'DICT_4X4_50'  # ${MAR}`, `      ids: [${ids.join(', ')}]  # ${MAR}`,
  "      orden_esquinas: ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda']  # orden de OpenCV: arriba-izquierda, arriba-derecha, abajo-derecha y abajo-izquierda del patrón"].join('\n') + '\n';
const enterosDe = ids => ['tablero.ids', ...ids.map(i => `tablero.marcador_${i}.id`)];

test('C3: tablero_bandeja.yaml de los cuatro marcadores de la escena, con su texto escrito a mano (esquinas en el orden de OpenCV, redondeo de I7, origen al final de cada línea)', () => {
  const t = yamlDe(ESCENA);
  assert.equal(datos(t), cabeceraDatos([6, 7, 8, 9])
    + bloqueMarcador(6, '0.032', '0.140, -0.170, 0.000', '0.000', ['0.124, -0.154, 0.000', '0.156, -0.154, 0.000', '0.156, -0.186, 0.000', '0.124, -0.186, 0.000'])
    + bloqueMarcador(7, '0.032', '0.140, 0.000, 0.000', '0.000', ['0.124, 0.016, 0.000', '0.156, 0.016, 0.000', '0.156, -0.016, 0.000', '0.124, -0.016, 0.000'])
    + bloqueMarcador(8, '0.032', '0.140, 0.170, 0.000', '0.000', ['0.124, 0.186, 0.000', '0.156, 0.186, 0.000', '0.156, 0.154, 0.000', '0.124, 0.154, 0.000'])
    + bloqueMarcador(9, '0.032', '-0.050, 0.205, 0.000', '0.000', ['-0.066, 0.221, 0.000', '-0.034, 0.221, 0.000', '-0.034, 0.189, 0.000', '-0.066, 0.189, 0.000']));
  const cab = t.slice(0, t.indexOf('/**:\n')).split('\n');
  assert.equal(cab[0], '# tablero_bandeja.yaml · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR');
  assert.ok(cab.slice(0, -1).every(l => l.startsWith('# ')), 'toda la cabecera son comentarios'); assert.equal(cab.at(-1), '');
  assert.match(t, /^# Marco: bandeja /m); assert.match(t, /^# Esquinas de cada marcador_<id>: arriba_izquierda, arriba_derecha, abajo_derecha, abajo_izquierda, en ese orden /m);
  assert.match(t, /^# Origen de cada valor, al final de su línea \(D8\): SUPUESTO; /m);
  assert.ok(cab.includes('# lado_m: el lado del cuadrado negro de cada marcador, el markerLength de OpenCV; el margen blanco va por fuera y las esquinas son las del cuadrado negro, a ±lado_m/2 del centro.'), 'qué es lado_m (TD.1, DT45)');
  assert.doesNotMatch(t, /AVISO/, 'sin alineación no hay aviso'); assert.doesNotMatch(t, /\d{4}-\d{2}-\d{2}/, 'sin fecha: mismos bytes siempre');
  assert.equal(yamlDe(ESCENA), t, 'determinista');
});

test('C3: un marcador girado 90° y solo (alineado por ser uno): sus esquinas a mano, el giro en rad y el AVISO en la cabecera', () => {
  const t = yamlDe([M(1, 0.3, 0.2, 0.1, PI / 2)]);
  assert.equal(datos(t), cabeceraDatos([1]) + bloqueMarcador(1, '0.100', '0.300, 0.200, 0.000', '1.571', ['0.250, 0.150, 0.000', '0.250, 0.250, 0.000', '0.350, 0.250, 0.000', '0.350, 0.150, 0.000']));
  assert.match(t, /^# AVISO: con 1 marcador(es)? los centros siempre quedan sobre una recta: .*percepcion-bandeja-personas «pose con varios marcadores».*\.$/m);
  const alineados = yamlDe([M(6, 0.14, -0.17), M(7, 0.14, 0), M(8, 0.14, 0.17)]);
  assert.match(alineados, /^# AVISO: los 3 centros quedan sobre una recta \(el mayor desvío es 0,0 mm, dentro de la tolerancia de 16,0 mm = 0,5 lados de media, SUPUESTO SIN VALIDAR\)/m);
  assert.deepEqual(problemasParams(alineados, { enteros: enterosDe([6, 7, 8]) }), []);
});

test('C3: se valida con el analizador y las reglas de ros (YAML 1.1 y 1.2 leen lo mismo, sin alias ni listas de mapas); el validador no es vacuo', () => {
  const t = yamlDe(ESCENA), enteros = { enteros: enterosDe([6, 7, 8, 9]) };
  assert.deepEqual(problemasParams(t, enteros), []);
  const v11 = YAML.parse(t, { version: '1.1' }), v12 = YAML.parse(t, { version: '1.2' });
  assert.deepEqual(v11, v12, 'YAML 1.1 y 1.2 dan lo mismo'); assert.deepEqual(Object.keys(v12), ['/**']); assert.deepEqual(Object.keys(v12['/**']), ['ros__parameters']);
  assert.ok(!/(^|\s)[&*]\w|!!/.test(datos(t).replace(/#.*$/gm, '')), 'ni anclas, ni alias, ni etiquetas');
  // lo que rcl no leería, falla: un lado entero (0 sin punto) y un array de tipos mezclados
  assert.match(problemasParams(t.replace('lado_m: 0.032', 'lado_m: 0'), enteros).join('|'), /entero donde no se espera/);
  assert.match(problemasParams(t.replace('ids: [6, 7, 8, 9]', 'ids: [6, 7, 8, 9.0]'), enteros).join('|'), /array con tipos mezclados/);
  assert.match(problemasParams(t.replace("diccionario: 'DICT_4X4_50'", 'diccionario: DICT_4X4_50'), enteros).join('|'), /string sin comillas/);
  // sin declarar los enteros, los ids y el id de cada marcador no pasan (el validador distingue enteros de doubles)
  assert.ok(problemasParams(t).length > 0);
});

test('C3: ida y vuelta: las esquinas leídas del YAML salen de las posiciones y el lado (fórmula polar aparte, ±0,5 mm del redondeo), también con giros cualesquiera', () => {
  const ROT = [M(12, 0.04, 0.1, 0.04, PI / 6), M(3, 0.12, -0.08, 0.05, -1), M(49, 0, 0.2, 0.032, 3), M(0, -0.1, -0.1, 0.06, -PI / 2)];
  const t = yamlDe(ROT), enteros = { enteros: enterosDe([12, 3, 49, 0]) };
  assert.deepEqual(problemasParams(t, enteros), []);
  const T = YAML.parse(t, { version: '1.2' })['/**'].ros__parameters.tablero, tol = 0.0005 + 1e-9;
  assert.deepEqual(T.ids, [12, 3, 49, 0]); assert.deepEqual(T.orden_esquinas, ORDEN); assert.equal(T.diccionario, 'DICT_4X4_50'); assert.equal(T.frame_id, 'bandeja');
  for (const m of ROT) {
    const k = T[`marcador_${m.id}`]; assert.equal(k.id, m.id);
    cerca(k.lado_m, m.lado, tol, `lado de ${m.id}`); cerca(k.centro_m[0], m.x, tol, 'centro x'); cerca(k.centro_m[1], m.y, tol, 'centro y'); assert.equal(k.centro_m[2], 0); cerca(k.yaw_rad, m.yaw, tol, `giro de ${m.id}`);
    // fórmula aparte: cada esquina está a lado·√2/2 del centro, en el ángulo del giro + 135°, 45°, −45° y −135°
    const r = m.lado * Math.SQRT2 / 2, ang = [3 * PI / 4, PI / 4, -PI / 4, -3 * PI / 4];
    ORDEN.forEach((o, i) => { assert.equal(k[o].length, 3); cerca(k[o][0], m.x + r * Math.cos(m.yaw + ang[i]), tol, `${m.id} ${o} x`); cerca(k[o][1], m.y + r * Math.sin(m.yaw + ang[i]), tol, `${m.id} ${o} y`); assert.equal(k[o][2], 0); });
    // y sin mirar las posiciones: el lado y el giro se recuperan de las esquinas leídas
    cerca(Math.hypot(k.arriba_derecha[0] - k.arriba_izquierda[0], k.arriba_derecha[1] - k.arriba_izquierda[1]), m.lado, 2 * tol, `lado leído de ${m.id}`);
  }
});

test('C3: EXPORTAR.tablero no escribe un número que no sea finito ni un id que no sea entero (rcl lo leería como string o fallaría)', () => {
  const esq = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const modelo = k => ({ ctx: CTX, tablero: { diccionario: 'DICT_4X4_50', orden: ORDEN, marcadores: [{ id: 1, lado: 0.03, x: 0, y: 0, yaw: 0, esquinas: esq, ...k }], alineacion: { alineado: false, texto: null } } });
  assert.match(EXPORTAR.tablero(modelo({}), ORIGEN), /marcador_1:/);
  assert.throws(() => EXPORTAR.tablero(modelo({ lado: NaN }), ORIGEN), /exportar: valor no numérico \(NaN\)/);
  assert.throws(() => EXPORTAR.tablero(modelo({ x: Infinity }), ORIGEN), /exportar: valor no numérico/);
  assert.throws(() => EXPORTAR.tablero(modelo({ id: 1.5 }), ORIGEN), /exportar: se esperaba un entero \(1\.5\)/);
});

test('C5 y D4: src/tablero.js es lógica pura (sin DOM, three, red ni ROS) y se carga en un contexto vacío; está en los dos HTML construidos sin su línea de módulo', () => {
  const codigo = FUENTE_TABLERO.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const g of [/\bdocument\b/, /\bwindow\b/, /\bTHREE\b/, /\bfetch\b/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bROB\b/, /\bL\s*[.(\[]/, /\bORIGEN\b/, /\bEXPORTAR\b/]) assert.doesNotMatch(codigo, g);
  const m = { exports: null }; vm.runInNewContext(FUENTE_TABLERO, { module: m }); assert.equal(typeof m.exports.esquinas, 'function');
  for (const f of ['dist/gemelo-celda.html', 'index.html']) {
    const h = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    assert.ok(h.includes('const TABLERO = (() => {'), `${f}: lleva TABLERO`); assert.ok(!h.includes('module.exports = TABLERO'), `${f}: sin su línea de módulo`);
    assert.ok(h.includes('tablero: tableroYaml'), `${f}: lleva EXPORTAR.tablero`);
  }
});
