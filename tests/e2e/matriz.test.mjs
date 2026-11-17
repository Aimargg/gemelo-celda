// Caracterización de la matriz de ensayo de la v8 (T0.2 C5, base de I8): los 8 casos de tests/fixtures/matriz-base.json,
// en su orden y en una página recién cargada, deben dar el mismo fin, choques, roces y pausas.
// Y la misma matriz con el perfil «curso» (T1.9, decisión 7): aquí, que tests/fixtures/matriz-curso.json tiene los 8 casos y
// que con «curso» se completa la demo por defecto; sus dos ensayos con página están en matriz-curso.test.mjs (puerta, T2.0).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, CASOS_CURSO, CAMPOS_MATRIZ, ensayar } from '../medir.mjs';

const BASE = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), 'utf8'));
const CURSO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-curso.json'), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });
const ver = r => Object.fromEntries([['caso', r.caso], ...CAMPOS_MATRIZ.map(k => [k, r[k]])]);

test('los casos del fixture son los 8 casos fijos, en el mismo orden', () => {
  assert.deepEqual(BASE.casos.map(c => c.cfg), CASOS_MATRIZ);
});

test('matriz de 8 casos: fin, choques, roces y pausas iguales a la línea base v8', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url);
  try {
    const res = await ensayar(s.page, CASOS_MATRIZ);
    assert.deepEqual(res.map(ver), BASE.casos.map(ver));
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.9-5: los casos de matriz-curso.json son los mismos 8 casos con perfil «curso», en el mismo orden', () => {
  assert.deepEqual(CURSO.casos.map(c => c.cfg), CASOS_CURSO);
  assert.deepEqual(CASOS_CURSO.map(({ perfil, ...c }) => c), CASOS_MATRIZ);
  assert.ok(CASOS_CURSO.every(c => c.perfil === 'curso'));
});

test('T1.9-2: con «curso», la disposición por defecto (caja, M0, 2 cm) completa la demo', () => {
  const d = CURSO.casos.find(c => c.cfg.caja && c.cfg.modo === 'M0' && c.cfg.amp === 0.02);
  assert.deepEqual({ fin: d.fin, choques: d.choques, roces: d.roces }, { fin: 'ok', choques: 0, roces: 0 });
});
