// Unitario de la versión del layout (src/layout.js, sin navegador): migración de la v8 y validación (T1.1, I1).
// Las disposiciones v8 son las que llevan los códigos de tests/fixtures/escenas-v8/ (la base de I1), decodificadas aquí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LAYOUT = createRequire(import.meta.url)('../../src/layout.js');
const { migrarLayout, validarLayout, noGuardable, VERSION, NUEVA, MIGRADA } = LAYOUT;

const copia = o => JSON.parse(JSON.stringify(o));
const DIR = path.join(RAIZ, 'tests/fixtures/escenas-v8');
const V8 = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(f => {
  const e = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  return { f, layout: JSON.parse(Buffer.from(e.codigo.slice('GEMELO1.'.length), 'base64').toString('utf8')).layout };
});
// El esquema de la página (ESQ_L de src/app.js): la disposición de partida de la v9 y los valores posibles. Los modos y las
// bases se leen de src/app.js para no copiarlos a mano; la referencia es la disposición por defecto de la v8 más los campos v9.
const APP = fs.readFileSync(path.join(RAIZ, 'src/app.js'), 'utf8');
const claves = re => [...APP.match(re)[1].matchAll(/'?([A-Za-z0-9]+)'?\s*:\s*\{/g)].map(m => m[1]);
const ESQ = {
  ref: { version: VERSION, ...NUEVA, ...V8[0].layout },
  robots: claves(/const BASES = \{(.*)\};/), modos: claves(/const MODOS = \{(.*)\};/), grupos: ['V1', 'V2', 'ROB'],
};

test('el esquema de prueba sale de src/app.js: bases A y B y los cinco modos de la ELP', () => {
  assert.deepEqual(ESQ.robots, ['A', 'B']);
  assert.equal(ESQ.modos.length, 5);
  assert.ok(ESQ.modos.includes('1920x1080'));
});

test('migrarLayout(v8) conserva intactos todos los campos de la v8 y añade solo version, robotId, perfil y sensor', () => {
  assert.equal(V8.length, 3);
  for (const { f, layout } of V8) {
    const antes = copia(layout);
    const r = migrarLayout(layout, ESQ);
    assert.equal(r.error, undefined, f);
    assert.deepEqual(layout, antes, `${f}: la entrada no se modifica`);
    assert.deepEqual(Object.keys(r.layout).filter(k => !(k in layout)).sort(), ['perfil', 'robotId', 'sensor', 'version'], f);
    for (const k of Object.keys(layout)) assert.deepEqual(r.layout[k], layout[k], `${f}: ${k}`);
    assert.deepEqual({ version: r.layout.version, robotId: r.layout.robotId, perfil: r.layout.perfil, sensor: r.layout.sensor },
      { version: 9, robotId: 'nominal', perfil: 'gemelo', sensor: 'gemelo-v8' }, f);
    assert.equal(r.soloLectura, false, f);
  }
});

test('las escenas nuevas usan robot nominal, perfil «curso» y sensor de la ficha; las migradas, «gemelo» y «gemelo-v8»', () => {
  assert.deepEqual(NUEVA, { robotId: 'nominal', perfil: 'curso', sensor: 'elp-ficha' });
  assert.deepEqual(MIGRADA, { robotId: 'nominal', perfil: 'gemelo', sensor: 'gemelo-v8' });
  assert.equal(VERSION, 9);
});

test('una disposición anterior sin caja ni pedido se completa como hacía normalizar() de la v8', () => {
  const l = copia(V8[0].layout); delete l.caja; delete l.pedido;
  const r = migrarLayout(l, ESQ);
  assert.deepEqual({ caja: r.layout.caja, pedido: r.layout.pedido }, { caja: ESQ.ref.caja, pedido: 2 });
  assert.deepEqual(Object.keys(r.layout).filter(k => !(k in l)).sort(), ['caja', 'pedido', 'perfil', 'robotId', 'sensor', 'version']);
});

test('migrar es idempotente y admite el layout como texto JSON', () => {
  const r1 = migrarLayout(V8[1].layout, ESQ);
  assert.deepEqual(migrarLayout(r1.layout, ESQ), r1);
  assert.deepEqual(migrarLayout(JSON.stringify(V8[1].layout), ESQ), r1);
  const nueva = { ...copia(V8[0].layout), version: 9, ...NUEVA };
  assert.deepEqual(migrarLayout(nueva, ESQ), { layout: nueva, soloLectura: false });
});

test('una versión mayor que la 9 se abre en solo lectura y conserva lo que no entiende', () => {
  const l = { ...copia(V8[0].layout), version: 10, robotId: '207', perfil: 'otro', sensor: 'nuevo', campoFuturo: { a: 1 } };
  const r = migrarLayout(l, ESQ);
  assert.equal(r.error, undefined);
  assert.equal(r.soloLectura, true);
  assert.deepEqual(r.layout, l);
  assert.equal(LAYOUT.soloLectura(r.layout), true);
  assert.equal(LAYOUT.soloLectura(migrarLayout(V8[0].layout, ESQ).layout), false);
});

test('JSON inválido o algo que no es una disposición: error y ningún layout', () => {
  for (const x of ['{"zona": ', 'null', '[1,2]', '"texto"', '42', null, undefined, 7, [V8[0].layout]]) {
    const r = migrarLayout(x, ESQ);
    assert.equal(typeof r.error, 'string', JSON.stringify(x)); assert.equal(r.layout, undefined, JSON.stringify(x));
  }
  assert.match(migrarLayout('{"zona": ', ESQ).error, /^el texto no es JSON válido/);
});

// Cada caso: cómo se estropea una disposición v8 válida y el motivo que debe dar validarLayout (y migrarLayout)
const ROTOS = [
  ['sin zona', l => { delete l.zona; }, 'falta «zona»'],
  ['sin cams', l => { delete l.cams; }, 'falta «cams»'],
  ['sin plato1', l => { delete l.plato1; }, 'falta «plato1»'],
  ['zona nula', l => { l.zona = null; }, '«zona» no es un objeto'],
  ['cams es una lista', l => { l.cams = []; }, '«cams» no es un objeto'],
  ['x del plato como texto', l => { l.plato1.x = '0.26'; }, '«plato1.x» no es un número'],
  ['focal no numérica', l => { l.cams.cenital.f = NaN; }, '«cams.cenital.f» no es un número'],
  ['caja.on no es sí o no', l => { l.caja.on = 1; }, '«caja.on» no es sí o no'],
  ['falta una cámara', l => { delete l.cams.entrega; }, 'falta «cams.entrega»'],
  ['cámara de más', l => { l.cams.otra = copia(l.cams.cenital); }, 'cámara desconocida «otra»'],
  ['robot imposible', l => { l.robot = 'C'; }, '«robot» debe ser A o B'],
  ['pedido imposible', l => { l.pedido = 3; }, '«pedido» debe ser 1 o 2 platos'],
  ['modo de cámara desconocido', l => { l.cams.persona.modo = '640x480'; }, '«cams.persona.modo» no es un modo de la cámara (640x480)'],
  ['grupo desconocido', l => { l.cams.entrega.grupo = 'V3'; }, '«cams.entrega.grupo» no es un grupo (V3)'],
  ['un marcador de menos', l => { l.arucoE.pop(); }, '«arucoE» tiene 1 elementos y debe tener 2'],
  ['versión no numérica', l => { l.version = 'nueve'; }, '«version» no es válida ("nueve")'],
  ['versión anterior a la 9', l => { l.version = 8; }, '«version» no es válida (8)'],
  ['versión no entera', l => { l.version = 9.5; }, '«version» no es válida (9.5)'],
  ['v9 sin perfil', l => { Object.assign(l, { version: 9, ...NUEVA }); delete l.perfil; }, 'falta «perfil»'],
  ['v9 con perfil desconocido', l => { Object.assign(l, { version: 9, ...NUEVA, perfil: 'rapido' }); }, '«perfil» desconocido ("rapido")'],
  ['v9 con sensor desconocido', l => { Object.assign(l, { version: 9, ...NUEVA, sensor: 'otro' }); }, '«sensor» desconocido ("otro")'],
  ['v9 con un robot aún sin calibrar (T1.4)', l => { Object.assign(l, { version: 9, ...NUEVA, robotId: '203' }); }, '«robotId» desconocido ("203")'],
];
test('validarLayout: una disposición v8 válida pasa; cada rotura da su motivo y migrarLayout no devuelve layout', () => {
  for (const { f, layout } of V8) assert.equal(validarLayout(layout, ESQ), null, f);
  assert.equal(validarLayout({ ...copia(V8[0].layout), version: 9, ...NUEVA }, ESQ), null);
  for (const [nombre, romper, motivo] of ROTOS) {
    const l = copia(V8[0].layout); romper(l); const antes = structuredClone(l);
    assert.equal(validarLayout(l, ESQ), motivo, nombre);
    const r = migrarLayout(l, ESQ);
    assert.deepEqual(r, { error: motivo }, nombre);
    assert.deepEqual(l, antes, `${nombre}: la entrada no se modifica`);
  }
});

test('una cámara llamada como una propiedad heredada (toString, constructor, __proto__) es desconocida', () => {
  for (const k of ['toString', 'constructor', '__proto__']) {
    // con JSON.parse, «__proto__» queda como clave propia, igual que si llegara en un código o en Firestore
    const l = JSON.parse(JSON.stringify(V8[0].layout).replace('"cams":{', `"cams":{${JSON.stringify(k)}:${JSON.stringify(V8[0].layout.cams.cenital)},`));
    assert.ok(Object.keys(l.cams).includes(k), k);
    assert.equal(validarLayout(l, ESQ), `cámara desconocida «${k}»`, k);
    assert.deepEqual(migrarLayout(JSON.stringify(l), ESQ), { error: `cámara desconocida «${k}»` }, k);
  }
});

test('el giro de la imagen de una cámara (roll) puede faltar, como en la v8', () => {
  const l = copia(V8[0].layout); delete l.cams.cenital.roll;
  assert.equal(validarLayout(l, ESQ), null);
});

test('noGuardable: hasta 50.000 caracteres se puede guardar; uno más, no, con un motivo claro', () => {
  assert.equal(noGuardable('x'.repeat(50000)), null);
  assert.equal(noGuardable('x'.repeat(50001)), 'la disposición ocupa 50.001 caracteres y el máximo es 50.000');
});
