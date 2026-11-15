// Escenas v8 de referencia (T0.2 C7, base de I1): cada código de tests/fixtures/escenas-v8/ se abre en una página nueva
// y debe dar las mismas posiciones (layout) y el mismo veredicto (comprobación previa y ensayo M0) que dio la v8.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { medirEscena } from '../medir.mjs';

const DIR = path.join(RAIZ, 'tests/fixtures/escenas-v8');
const FICHEROS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('hay tres escenas v8 de referencia', () => { assert.equal(FICHEROS.length, 3, FICHEROS.join(', ')); });

for (const f of FICHEROS) {
  const esc = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  test(`escena v8 «${esc.nombre}»: mismas posiciones y mismo veredicto`, { timeout: 300000 }, async () => {
    assert.match(esc.codigo, /^GEMELO1\./);
    const s = await abrir(srv.url);
    try {
      const m = await medirEscena(s.page, esc.codigo);
      assert.equal(m.abierta, esc.esperado.abierta);
      assert.deepEqual(m.layout, esc.esperado.layout, 'posiciones');
      assert.deepEqual(m.veredicto, esc.esperado.veredicto, 'comprobación previa');
      assert.equal(m.alDia, true);
      assert.deepEqual(m.demo, esc.esperado.demo, 'ensayo M0 con balanceo de 2 cm');
      comprobar(s.reg);
    } finally { await s.cerrar(); }
  });
}
