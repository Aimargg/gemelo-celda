// Determinismo a nivel de demo (T1.2, D5, I6), en el nivel de puerta (T2.0): la matriz de 8 casos en orden inverso da
// exactamente los registros de matriz-base.json (orden directo). Movido tal cual desde determinismo.test.mjs, que sigue con
// A, B, A' del planificador (I6 en el nivel de tarea).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, ensayar } from '../medir.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('I6 en la demo: la matriz en orden inverso da los mismos registros, campo a campo, que matriz-base.json', { timeout: 600000 }, async () => {
  const BASE = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), 'utf8')).casos;
  const s = await abrir(srv.url);
  try {
    const res = (await ensayar(s.page, [...CASOS_MATRIZ].reverse())).reverse().map(({ ms, ...r }) => r);
    assert.deepEqual(res, BASE); // todos los campos: t_sim, t_mov, errores, planes, pausas…
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
