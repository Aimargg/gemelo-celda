// Regenera las caracterizaciones a partir del gemelo actual (no a mano): tests/fixtures/matriz-base.json y escenas-v8/*.json.
// Uso: npm run build && node tests/fixtures/generar.mjs [matriz] [escenas]   (sin argumentos, las dos)
// Solo se ejecuta a propósito (T0.2, o una tarea que cambie el comportamiento y lo documente, como T1.2); npm test solo compara.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, ensayar, ESCENAS_V8, codigoDe, medirEscena } from '../medir.mjs';

const que = process.argv.slice(2); const hacer = k => !que.length || que.includes(k);
const fuente = (() => { try { return execSync('git log -1 --format=%h -- src', { cwd: RAIZ }).toString().trim(); } catch (e) { return 'desconocido'; } })();
const escribir = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); console.log('escrito', path.relative(RAIZ, f)); };

const srv = await arrancarServidor();
try {
  if (hacer('matriz')) {
    const s = await abrir(srv.url);
    const res = await ensayar(s.page, CASOS_MATRIZ); comprobar(s.reg); await s.cerrar();
    escribir(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), {
      descripcion: 'Caracterización de la v8: 8 casos fijos de __g.ensayo, en este orden y en una página recién cargada (tras el primer calcularPlanes), con la fase de la bandeja relativa al inicio de cada ensayo (tests/medir.mjs). El test compara fin, choques, roces y pausas; el resto es informativo (en T0.2 también salió igual en 6 ejecuciones).',
      fuente_src: fuente, comando: 'npm run build && node tests/fixtures/generar.mjs matriz',
      casos: res.map(({ ms, ...r }) => r),
    });
  }
  if (hacer('escenas')) {
    for (const e of ESCENAS_V8) {
      let s = await abrir(srv.url); const codigo = await codigoDe(s.page, e); comprobar(s.reg); await s.cerrar();
      s = await abrir(srv.url); const esperado = await medirEscena(s.page, codigo); comprobar(s.reg); await s.cerrar();
      escribir(path.join(RAIZ, `tests/fixtures/escenas-v8/${e.id}.json`), {
        nombre: e.nombre, descripcion: e.descripcion, fuente_src: fuente,
        comando: 'npm run build && node tests/fixtures/generar.mjs escenas',
        codigo, esperado,
      });
    }
  }
} finally { await srv.cerrar(); }
