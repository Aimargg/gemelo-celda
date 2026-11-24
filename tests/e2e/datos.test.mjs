// Caracterización del panel «Datos» (T2.1, decisiones 6 y 7 de su brief; I7): posiciones.yaml y la tabla de fuentes de los
// casos de CASOS_YAML (nominal, 203 y 203 con prefijo) deben ser los de tests/fixtures/yaml/, que generó el gemelo con
// `npm run caracterizar -- --yaml`. El YAML se compara byte a byte salvo la línea «fecha:»; cada fila de la tabla, por su
// texto, su fuente, su etiqueta (MEDIDO, FABRICANTE o SUPUESTO), su clase y su HTML. Es la red de T2.2–T2.5: cualquier
// cambio en lo que exporta el panel hace fallar este test. TD.3 (DT42): cada uno se lee igual con YAML 1.1 (PyYAML) que con 1.2.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import YAML from 'yaml';
import { CASOS_YAML, datosDe, sinFecha } from '../medir.mjs';
import { problemas11 } from '../yaml11.mjs';

const DIR = path.join(RAIZ, 'tests/fixtures/yaml');
const REF = JSON.parse(fs.readFileSync(path.join(DIR, 'casos.json'), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('los casos del fixture son los de CASOS_YAML, en el mismo orden, cada uno con su .yaml', () => {
  assert.deepEqual(REF.casos.map(({ yaml, panel, ...c }) => c), CASOS_YAML);
  for (const c of REF.casos) {
    assert.equal(c.yaml, `${c.id}.yaml`);
    assert.equal((fs.readFileSync(path.join(DIR, c.yaml), 'utf8').match(/^fecha: /gm) || []).length, 1, `${c.yaml}: una sola línea «fecha:»`);
  }
});

test('T2.1-C3 y T2.1-C4: posiciones.yaml igual byte a byte (salvo «fecha:») y la tabla de fuentes con las mismas filas, con nominal, con el 203 y con prefijo', { timeout: 300000 }, async t => {
  const s = await abrir(srv.url);
  try {
    const res = await datosDe(s.page);
    comprobar(s.reg);
    assert.deepEqual(res.map(r => r.caso), REF.casos.map(c => c.id));
    for (const [i, r] of res.entries()) {
      const ref = REF.casos[i];
      await t.test(`${ref.yaml}: igual salvo «fecha:»`, () => {
        assert.equal((r.yaml.match(/^fecha: /gm) || []).length, 1, 'una sola línea «fecha:»');
        assert.equal(sinFecha(r.yaml), sinFecha(fs.readFileSync(path.join(DIR, ref.yaml), 'utf8')));
      });
      await t.test(`${ref.yaml}: se lee igual con YAML 1.1 (PyYAML) que con 1.2 (TD.3, DT42)`, () => {
        assert.match(r.yaml, /^fecha: '\d{4}-\d{2}-\d{2}'$/m, 'fecha entre comillas');
        assert.deepEqual(YAML.parse(r.yaml, { version: '1.1' }), YAML.parse(r.yaml));
        assert.deepEqual(problemas11(r.yaml), []);
      });
      await t.test(`tabla de fuentes con ${ref.id}: mismas filas, texto y etiqueta`, () => {
        assert.deepEqual(r.panel, ref.panel);
      });
    }
  } finally { await s.cerrar(); }
});
