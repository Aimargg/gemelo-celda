// Unitario del origen de cada valor exportable (src/origen.js, sin navegador; T2.1, D8, I7): toda entrada tiene un tipo
// válido, texto, fuente y comentario corto; las que dependen del robot, del giro de base_link, del sensor o de la pinza
// cambian con el contexto explícito, y el módulo no lee globales del gemelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ORIGEN = require('../../src/origen.js');
const SENSOR = require('../../src/sensor.js');
const FUENTE = fs.readFileSync(new URL('../../src/origen.js', import.meta.url), 'utf8');

const sensor = id => ({ id, ...SENSOR.de(id) });
const CTX = { robotId: 'nominal', sospechoso: false, yaw: 0, sensor: sensor('elp-ficha'), tcpZ: 0.2 };
const CONTEXTOS = [CTX, { ...CTX, robotId: '203', yaw: -3 * Math.PI / 4 }, { ...CTX, robotId: '204', sospechoso: true, yaw: -0.639, sensor: sensor('gemelo-v8') }];

test('toda entrada tiene clave única, tipo válido, texto, fuente y un comentario corto que empieza por su tipo', () => {
  assert.deepEqual(ORIGEN.TIPOS, ['MEDIDO', 'FABRICANTE', 'SUPUESTO']);
  assert.deepEqual(Object.keys(ORIGEN.CLASE).sort(), [...ORIGEN.TIPOS].sort());
  assert.equal(ORIGEN.LEYENDA, 'MEDIDO, FABRICANTE o SUPUESTO');
  assert.equal(new Set(ORIGEN.CLAVES).size, ORIGEN.CLAVES.length, 'claves únicas');
  for (const ctx of CONTEXTOS) for (const k of ORIGEN.CLAVES) {
    const e = ORIGEN.entrada(k, ctx);
    assert.ok(ORIGEN.TIPOS.includes(e.tipo), `${k}: tipo ${e.tipo}`);
    for (const campo of ['valor', 'fuente', 'yaml']) assert.ok(typeof e[campo] === 'string' && e[campo].trim().length > 0, `${k}: ${campo}`);
    assert.ok(e.nombre === null || (typeof e.nombre === 'string' && e.nombre.length > 0), `${k}: nombre`);
    assert.ok(e.yaml === e.tipo || e.yaml.startsWith(`${e.tipo} (`), `${k}: el comentario empieza por el tipo: «${e.yaml}»`);
    assert.ok(!/\bundefined\b|\bNaN\b|\[object /.test(e.valor + e.fuente + e.yaml), `${k}: sin huecos en el texto`);
    assert.equal(ORIGEN.tipo(k, ctx), e.tipo); assert.equal(ORIGEN.yaml(k, ctx), e.yaml);
  }
});

test('la tabla del panel son las entradas con nombre, en su orden: 25 filas, y dos entradas solo para los ficheros', () => {
  const filas = ORIGEN.panel(CTX);
  assert.equal(filas.length, 25);
  assert.deepEqual(filas.map(f => f.clave), ORIGEN.CLAVES.filter(k => ORIGEN.entrada(k, CTX).nombre !== null));
  assert.deepEqual(ORIGEN.CLAVES.filter(k => ORIGEN.entrada(k, CTX).nombre === null), ['disposicion', 'pose_doble']);
  assert.equal(filas.filter(f => f.nombre === 'Agarre del plato').length, 2, 'dos filas con el mismo nombre y claves distintas');
});

test('una clave desconocida falla en vez de dar un origen inventado', () => {
  assert.throws(() => ORIGEN.entrada('no_existe', CTX), /origen desconocido \("no_existe"\)/);
  assert.throws(() => ORIGEN.yaml('Mesa', CTX), /origen desconocido/);
});

test('la cinemática depende del robot: nominal FABRICANTE, calibrado MEDIDO y el 204 (sospechoso) SUPUESTO', () => {
  const c = ctx => ORIGEN.entrada('cinematica', ctx);
  assert.deepEqual(c(CTX), { clave: 'cinematica', nombre: 'Cinemática del UR3e', tipo: 'FABRICANTE', valor: 'DH oficiales, IK analítica de 8 soluciones', fuente: 'ur_description; verificada con 2000 posturas', yaml: 'FABRICANTE (DH oficiales de ur_description)' });
  const c203 = c({ ...CTX, robotId: '203' }), c204 = c({ ...CTX, robotId: '204', sospechoso: true });
  assert.equal(c203.tipo, 'MEDIDO'); assert.equal(c203.fuente, 'calibration_203.yaml del repo del curso (4e4e1a7); SIN VALIDAR en ROS');
  assert.equal(c204.tipo, 'SUPUESTO'); assert.equal(c204.fuente, 'calibration_204.yaml del repo del curso (4e4e1a7), sospechosa; SIN VALIDAR en ROS');
  assert.match(c204.valor, /^calibración del robot 204; IK analítica nominal refinada/);
  assert.equal(c204.yaml, 'SUPUESTO (calibration_204.yaml del curso, sospechosa, sin validar en ROS)');
});

test('la orientación de base_link sigue al giro del contexto, con el formato de grados de la tabla', () => {
  assert.equal(ORIGEN.entrada('orientacion_base_link', CTX).valor, 'girado 0,0° respecto a world; world con los ejes de la mesa');
  assert.equal(ORIGEN.entrada('orientacion_base_link', { ...CTX, yaw: -3 * Math.PI / 4 }).valor, 'girado −135,0° respecto a world; world con los ejes de la mesa');
  assert.equal(ORIGEN.entrada('orientacion_base_link', { ...CTX, yaw: 0.639 }).valor, 'girado 36,6° respecto a world; world con los ejes de la mesa');
  assert.equal(ORIGEN.yaml('orientacion_base_link', CTX), 'SUPUESTO (sin validar en ROS)');
});

test('el campo de visión sigue al sensor del contexto: nombre, ancho, su origen y el id en el comentario', () => {
  const f = ORIGEN.entrada('campo_vision', CTX), v = ORIGEN.entrada('campo_vision', { ...CTX, sensor: sensor('gemelo-v8') });
  assert.equal(f.valor, 'lente ideal sobre el ancho del sensor «ELP ficha» (5,952 mm), completo en todos los modos');
  assert.equal(v.valor, 'lente ideal sobre el ancho del sensor «gemelo v8» (6,287 mm), completo en todos los modos');
  assert.equal(f.fuente, `${SENSOR.de('elp-ficha').origen}; medir en la calibración intrínseca (F4)`);
  assert.equal(v.fuente, `${SENSOR.de('gemelo-v8').origen}; medir en la calibración intrínseca (F4)`);
  assert.deepEqual([f.yaml, v.yaml], ['SUPUESTO (lente ideal, sensor elp-ficha)', 'SUPUESTO (lente ideal, sensor gemelo-v8)']);
});

test('el TCP de la pinza sale del contexto, en mm redondeados', () => {
  assert.equal(ORIGEN.entrada('tcp_pinza', { ...CTX, tcpZ: 0.2307 }).valor, '231 mm cerrada');
  assert.equal(ORIGEN.entrada('tcp_pinza', { ...CTX, tcpZ: 0.1994 }).valor, '199 mm cerrada');
});

test('el módulo no lee globales del gemelo: se carga en un contexto vacío y no nombra ROB, L, SENSOR, DOM ni three', () => {
  const m = { exports: null }; vm.runInNewContext(FUENTE, { module: m });
  assert.deepEqual(JSON.parse(JSON.stringify(m.exports.panel(CTX))), ORIGEN.panel(CTX), 'en un contexto sin nada más da lo mismo'); // otro reino: se compara su contenido
  const codigo = FUENTE.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n'); // sin comentarios
  for (const g of [/\bROB\b/, /\bL\s*[.(]/, /\bSENSOR\b/, /\bdocument\b/, /\bwindow\b/, /\bTHREE\b/, /\blocalStorage\b/]) assert.doesNotMatch(codigo, g);
});
