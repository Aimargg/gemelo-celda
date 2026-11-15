// Caracterización de la matriz de ensayo de la v8 (T0.2 C5, base de I8): los 8 casos de tests/fixtures/matriz-base.json,
// en su orden y en una página recién cargada, deben dar el mismo fin, choques, roces y pausas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, CAMPOS_MATRIZ, ensayar } from '../medir.mjs';

const BASE = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('los casos del fixture son los 8 casos fijos, en el mismo orden', () => {
  assert.deepEqual(BASE.casos.map(c => c.cfg), CASOS_MATRIZ);
});

test('matriz de 8 casos: fin, choques, roces y pausas iguales a la línea base v8', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url);
  try {
    const res = await ensayar(s.page, CASOS_MATRIZ);
    const ver = r => Object.fromEntries([['caso', r.caso], ...CAMPOS_MATRIZ.map(k => [k, r[k]])]);
    assert.deepEqual(res.map(ver), BASE.casos.map(ver));
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
