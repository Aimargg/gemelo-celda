// Regenera caracterizaciones a partir del gemelo actual (no a mano). Solo a propósito, cuando una tarea lo pida
// (p. ej. T1.2) y con el diff explicado en su informe; npm test solo compara.
// Uso: npm run caracterizar                        → solo tests/fixtures/matriz-base.json
//      npm run caracterizar -- --curso             → solo tests/fixtures/matriz-curso.json (los 8 casos con «curso», T1.9)
//      npm run caracterizar -- --escenas           → solo recalcula `esperado` de tests/fixtures/escenas-v8/*.json
//      npm run caracterizar -- --matriz --escenas  → varias cosas a la vez (--matriz, --curso y --escenas se combinan)
// escenas-v8/ es la base de I1: el `codigo` de un fichero existente no se reescribe nunca. Un fichero nuevo solo se crea
// (con codigoEscena() de la v8 actual) si una escena de ESCENAS_V8 todavía no tiene el suyo.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, CASOS_CURSO, ensayar, ESCENAS_V8, codigoDe, medirEscena } from '../medir.mjs';

const args = process.argv.slice(2);
const desconocidos = args.filter(a => !['--matriz', '--curso', '--escenas'].includes(a));
if (desconocidos.length) { console.error(`Argumentos no válidos: ${desconocidos.join(' ')} (usa --matriz, --curso y/o --escenas)`); process.exit(2); }
const escenas = args.includes('--escenas'), curso = args.includes('--curso'), matriz = args.includes('--matriz') || (!escenas && !curso);
const fuente = (() => { try { return execSync('git log -1 --format=%h -- src', { cwd: RAIZ }).toString().trim(); } catch (e) { return 'desconocido'; } })();
const escribir = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); console.log('escrito', path.relative(RAIZ, f)); };
const DIR_ESC = path.join(RAIZ, 'tests/fixtures/escenas-v8');

// Abre una página, ejecuta fn y la cierra pase lo que pase
async function conPagina(srv, fn) {
  const s = await abrir(srv.url);
  try { const r = await fn(s.page); comprobar(s.reg); return r; } finally { await s.cerrar(); }
}

const srv = await arrancarServidor();
try {
  if (matriz) {
    const res = await conPagina(srv, p => ensayar(p, CASOS_MATRIZ));
    escribir(path.join(RAIZ, 'tests/fixtures/matriz-base.json'), {
      descripcion: 'Caracterización de la v8: 8 casos fijos de __g.ensayo, en este orden y en una página recién cargada (tras el primer calcularPlanes), con la fase de la bandeja al empezar cada ensayo (ensayo() empieza con simT = 0 desde T1.2) y la semilla del RRT por petición. El test compara fin, choques, roces y pausas; el resto es informativo (en T0.2 también salió igual en 6 ejecuciones).',
      fuente_src: fuente, comando: 'npm run caracterizar',
      casos: res.map(({ ms, ...r }) => r),
    });
  }
  if (curso) { // la misma matriz con el perfil «curso» (T1.9, decisión 7): mismo procedimiento, otro fixture
    const res = await conPagina(srv, p => ensayar(p, CASOS_CURSO));
    escribir(path.join(RAIZ, 'tests/fixtures/matriz-curso.json'), {
      descripcion: 'Los mismos 8 casos de matriz-base.json con perfil: \'curso\' (T1.9): en este orden, en una página recién cargada (tras el primer calcularPlanes), con la fase de la bandeja al empezar cada ensayo y la semilla del RRT por petición. El test compara fin, choques, roces y pausas en orden directo y todos los campos en orden inverso.',
      fuente_src: fuente, comando: 'npm run caracterizar -- --curso',
      casos: res.map(({ ms, ...r }) => r),
    });
  }
  if (escenas) {
    for (const e of ESCENAS_V8) {
      const f = path.join(DIR_ESC, `${e.id}.json`);
      const previo = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
      const codigo = previo ? previo.codigo : await conPagina(srv, p => codigoDe(p, e)); // el código existente no se toca
      const esperado = await conPagina(srv, p => medirEscena(p, codigo));
      escribir(f, previo ? { ...previo, comando: 'npm run caracterizar -- --escenas', codigo: previo.codigo, esperado, esperado_fuente_src: fuente }
        : { nombre: e.nombre, descripcion: e.descripcion, fuente_src: fuente, comando: 'npm run caracterizar -- --escenas', codigo, esperado });
    }
  }
} finally { await srv.cerrar(); }
