// La matriz de 8 casos con el perfil «curso» (T1.9, decisión 7), en el nivel de puerta (T2.0): tests/fixtures/matriz-curso.json
// en orden directo (fin, choques, roces y pausas) y en orden inverso (todos los campos: I6 con «curso» a nivel de demo).
// Movidos tal cual desde matriz.test.mjs, que sigue con la matriz «gemelo» (I8) y las comprobaciones del fixture «curso».
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_CURSO, CAMPOS_MATRIZ, ensayar } from '../medir.mjs';

const CURSO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-curso.json'), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });
const ver = r => Object.fromEntries([['caso', r.caso], ...CAMPOS_MATRIZ.map(k => [k, r[k]])]);

test('T1.9-5: matriz «curso» en orden directo: fin, choques, roces y pausas iguales a matriz-curso.json', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url);
  try {
    const res = await ensayar(s.page, CASOS_CURSO);
    assert.deepEqual(res.map(ver), CURSO.casos.map(ver));
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.9-5 e I6 con «curso»: la matriz en orden inverso da los mismos registros, campo a campo', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url);
  try {
    const res = (await ensayar(s.page, [...CASOS_CURSO].reverse())).reverse().map(({ ms, ...r }) => r);
    assert.deepEqual(res, CURSO.casos); // todos los campos: t_sim, t_mov, errores, planes, pausas…
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
