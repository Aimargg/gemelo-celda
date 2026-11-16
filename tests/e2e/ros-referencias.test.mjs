// Referencias de los ficheros de ROS (T2.2 y T2.4, Común-C3; I7): parametros_celda.yaml, tf/*.yaml y tf_estaticas.sh de los
// casos de CASOS_YAML (nominal, 203 y 203 con prefijo) deben ser los de tests/fixtures/ros/<caso>/, que generó el gemelo con
// `npm run caracterizar -- --ros` una vez en verde los criterios de tests/e2e/ros.test.mjs. Se comparan byte a byte (no
// llevan fecha) y la lista de ficheros de cada carpeta. Es la red de T2.3, T2.5 y T2.6: cualquier cambio en lo que exportan
// hace fallar este test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_YAML, rosDe } from '../medir.mjs';

const DIR = path.join(RAIZ, 'tests/fixtures/ros');
const REF = JSON.parse(fs.readFileSync(path.join(DIR, 'casos.json'), 'utf8'));
// Ficheros de una carpeta del fixture, relativos a ella y con /, recorriendo tf/
const enDisco = (d, rel = '') => fs.readdirSync(path.join(d, rel), { withFileTypes: true }).flatMap(e => e.isDirectory() ? enDisco(d, `${rel}${e.name}/`) : [`${rel}${e.name}`]).sort();
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('los casos del fixture son los de CASOS_YAML, en el mismo orden, y cada carpeta tiene justo sus ficheros', () => {
  assert.deepEqual(REF.casos.map(({ ficheros, ...c }) => c), CASOS_YAML);
  for (const c of REF.casos) assert.deepEqual(enDisco(path.join(DIR, c.id)), [...c.ficheros].sort(), c.id);
});

test('Común-C3: los ficheros de ROS iguales byte a byte, con nominal, con el 203 y con el 203 con prefijo', { timeout: 300000 }, async t => {
  const s = await abrir(srv.url);
  try {
    const res = await rosDe(s.page);
    comprobar(s.reg);
    assert.deepEqual(res.map(r => r.caso), REF.casos.map(c => c.id));
    for (const [i, r] of res.entries()) {
      const ref = REF.casos[i];
      await t.test(`${ref.id}: los mismos ficheros, en el mismo orden, y cada uno igual byte a byte`, () => {
        assert.deepEqual(r.ficheros.map(f => f.nombre), ref.ficheros);
        for (const f of r.ficheros) assert.equal(f.texto, fs.readFileSync(path.join(DIR, ref.id, f.nombre), 'utf8'), `${ref.id}/${f.nombre}`);
      });
    }
  } finally { await s.cerrar(); }
});
