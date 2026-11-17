// Reparto del arnés e2e en dos niveles (T2.0, DT32; decisiones 1 y 3 de su brief): cada fichero de tests/e2e/ está en un
// solo nivel, la puerta ejecuta la unión (todos los tests) y los scripts de npm y tools/check.sh llaman al nivel que dicen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NIVELES, ficherosE2E, erroresReparto, ficherosDe } from '../niveles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('cada fichero de tests/e2e está en un solo nivel y cada fichero de un nivel existe', () => {
  const enDisco = ficherosE2E();
  assert.ok(enDisco.length > 0, 'hay tests e2e');
  assert.deepEqual(erroresReparto(enDisco), []);
});

test('la puerta ejecuta la unión de los dos niveles (todos los ficheros e2e) y la tarea, solo los suyos', () => {
  assert.ok(NIVELES.tarea.length > 0 && NIVELES.puerta.length > 0, 'los dos niveles tienen ficheros');
  assert.deepEqual([...ficherosDe('puerta')].sort(), ficherosE2E(), 'puerta = todos');
  assert.deepEqual(ficherosDe('tarea'), NIVELES.tarea);
  assert.deepEqual(ficherosDe('tarea').filter(f => NIVELES.puerta.includes(f)), [], 'ninguno de la tarea es solo de la puerta');
  assert.throws(() => ficherosDe('rapido'), /nivel desconocido «rapido»/);
});

test('el reparto detecta un fichero en ningún nivel, en los dos, repetido en uno o listado sin existir (muestras)', () => {
  const disco = ['tests/e2e/a.test.mjs', 'tests/e2e/b.test.mjs', 'tests/e2e/c.test.mjs', 'tests/e2e/sub/d.test.mjs'];
  assert.deepEqual(erroresReparto(disco, { tarea: ['tests/e2e/a.test.mjs', 'tests/e2e/b.test.mjs', 'tests/e2e/sub/d.test.mjs'], puerta: ['tests/e2e/c.test.mjs'] }), [], 'un reparto bueno no da errores');
  assert.deepEqual(erroresReparto(disco, { tarea: ['tests/e2e/a.test.mjs', 'tests/e2e/b.test.mjs', 'tests/e2e/a.test.mjs'], puerta: ['tests/e2e/b.test.mjs', 'tests/e2e/x.test.mjs'] }), [
    'tests/e2e/a.test.mjs: repetido en el nivel «tarea»',
    'tests/e2e/b.test.mjs: está en los dos niveles (tarea y puerta)',
    'tests/e2e/c.test.mjs: no está en ningún nivel',
    'tests/e2e/sub/d.test.mjs: no está en ningún nivel',
    'tests/e2e/x.test.mjs: está en un nivel y no existe',
  ]);
  // ficherosE2E recorre subcarpetas: un test movido a una carpeta tampoco se queda fuera sin que se note
  const tmp = fs.mkdtempSync(path.join(RAIZ, 'tests/.muestra-niveles-'));
  try {
    fs.mkdirSync(path.join(tmp, 'e2e/sub'), { recursive: true });
    for (const f of ['e2e/uno.test.mjs', 'e2e/sub/dos.test.mjs', 'e2e/ayuda.mjs']) fs.writeFileSync(path.join(tmp, f), '');
    const rel = path.relative(RAIZ, tmp).split(path.sep).join('/');
    assert.deepEqual(ficherosE2E(RAIZ, `${rel}/e2e`), [`${rel}/e2e/sub/dos.test.mjs`, `${rel}/e2e/uno.test.mjs`]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('npm test ejecuta el nivel de tarea y npm run test:puerta, los dos; tools/check.sh llama a uno u otro', () => {
  const s = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts;
  assert.equal(s.test, 'npm run build && npm run test:unit && npm run test:e2e');
  assert.equal(s['test:e2e'], 'node tests/niveles.mjs tarea');
  assert.equal(s['test:puerta'], 'npm run build && npm run test:unit && npm run test:e2e:puerta');
  assert.equal(s['test:e2e:puerta'], 'node tests/niveles.mjs puerta');
  const check = fs.readFileSync(path.join(RAIZ, 'tools/check.sh'), 'utf8');
  assert.match(check, /--puerta\) NIVEL=puerta/);
  assert.match(check, /if \[ "\$NIVEL" = puerta \]; then npm run test:puerta; else npm test; fi/);
});
