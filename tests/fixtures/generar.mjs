// Regenera caracterizaciones a partir del gemelo actual (no a mano). Solo a propósito, cuando una tarea lo pida
// (p. ej. T1.2) y con el diff explicado en su informe; npm test solo compara.
// Uso: npm run caracterizar                        → solo tests/fixtures/matriz-base.json
//      npm run caracterizar -- --curso             → solo tests/fixtures/matriz-curso.json (los 8 casos con «curso», T1.9)
//      npm run caracterizar -- --escenas           → solo recalcula `esperado` de tests/fixtures/escenas-v8/*.json
//      npm run caracterizar -- --yaml              → solo tests/fixtures/yaml/: posiciones.yaml y la tabla de fuentes del
//                                                    panel «Datos» con nominal, con el 203 y con prefijo (T2.1, CASOS_YAML)
//      npm run caracterizar -- --ros               → solo tests/fixtures/ros/<caso>/: parametros_celda.yaml, tf/*.yaml,
//                                                    tf_estaticas.sh (T2.2, T2.4), escena_colision.yaml, celda.scene,
//                                                    celda.scene.txt (T2.3), camera_info/*.yaml y usb_cam/*.yaml (T2.5)
//                                                    de los mismos casos (CASOS_YAML)
//      npm run caracterizar -- --matriz --escenas  → varias cosas a la vez (--matriz, --curso, --escenas, --yaml y --ros se combinan)
// escenas-v8/ es la base de I1: el `codigo` de un fichero existente no se reescribe nunca. Un fichero nuevo solo se crea
// (con codigoEscena() de la v8 actual) si una escena de ESCENAS_V8 todavía no tiene el suyo.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_MATRIZ, CASOS_CURSO, ensayar, ESCENAS_V8, codigoDe, medirEscena, CASOS_YAML, datosDe, rosDe } from '../medir.mjs';

const args = process.argv.slice(2);
const desconocidos = args.filter(a => !['--matriz', '--curso', '--escenas', '--yaml', '--ros'].includes(a));
if (desconocidos.length) { console.error(`Argumentos no válidos: ${desconocidos.join(' ')} (usa --matriz, --curso, --escenas, --yaml y/o --ros)`); process.exit(2); }
const escenas = args.includes('--escenas'), curso = args.includes('--curso'), yaml = args.includes('--yaml'), ros = args.includes('--ros'), matriz = args.includes('--matriz') || (!escenas && !curso && !yaml && !ros);
const fuente = (() => { try { return execSync('git log -1 --format=%h -- src', { cwd: RAIZ }).toString().trim(); } catch (e) { return 'desconocido'; } })();
const escribir = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); console.log('escrito', path.relative(RAIZ, f)); };
const DIR_ESC = path.join(RAIZ, 'tests/fixtures/escenas-v8');
const DIR_YAML = path.join(RAIZ, 'tests/fixtures/yaml');
const DIR_ROS = path.join(RAIZ, 'tests/fixtures/ros');

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
  if (yaml) { // panel «Datos» (T2.1): un .yaml por caso, tal cual lo genera el gemelo, y las tablas de fuentes en casos.json
    const res = await conPagina(srv, p => datosDe(p));
    for (const r of res) { const f = path.join(DIR_YAML, `${r.caso}.yaml`); fs.mkdirSync(DIR_YAML, { recursive: true }); fs.writeFileSync(f, r.yaml); console.log('escrito', path.relative(RAIZ, f)); }
    escribir(path.join(DIR_YAML, 'casos.json'), {
      descripcion: 'Caracterización del panel «Datos» (T2.1, decisión 7): posiciones.yaml (<caso>.yaml) y las filas de la tabla de fuentes de cada caso de CASOS_YAML (tests/medir.mjs), en este orden y en una página recién cargada. El test (tests/e2e/datos.test.mjs) compara el YAML byte a byte salvo la línea «fecha:» y cada fila de la tabla (texto, fuente, etiqueta, clase y HTML).',
      fuente_src: fuente, comando: 'npm run caracterizar -- --yaml',
      casos: res.map(r => ({ ...CASOS_YAML.find(c => c.id === r.caso), yaml: `${r.caso}.yaml`, panel: r.panel })),
    });
  }
  if (ros) { // ficheros de ROS (T2.2–T2.5): cada caso en su carpeta, tal cual los genera el gemelo, y la lista en casos.json
    const res = await conPagina(srv, p => rosDe(p));
    for (const r of res) {
      const dir = path.join(DIR_ROS, r.caso); fs.rmSync(dir, { recursive: true, force: true }); // sin ficheros de una exportación anterior
      for (const f of r.ficheros) { const d = path.join(dir, f.nombre); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, f.texto); }
      console.log('escritos', r.ficheros.length, 'ficheros en', path.relative(RAIZ, dir));
    }
    escribir(path.join(DIR_ROS, 'casos.json'), {
      descripcion: 'Referencias de los ficheros de ROS (T2.2 y T2.4; T2.3 y T2.5 desde su entrega, Común-C3): window.__g.ficherosRos() de cada caso de CASOS_YAML (tests/medir.mjs), en este orden y en una página recién cargada (tras el primer calcularPlanes: el giro de las cajas de la escena es el del plan con nominal y el provisional con el 203), en tests/fixtures/ros/<caso>/<nombre>. El test (tests/e2e/ros-referencias.test.mjs) compara cada fichero byte a byte y la lista de ficheros de cada carpeta. Son la red de T2.6.',
      fuente_src: fuente, comando: 'npm run caracterizar -- --ros',
      casos: res.map(r => ({ ...CASOS_YAML.find(c => c.id === r.caso), ficheros: r.ficheros.map(f => f.nombre) })),
    });
  }
} finally { await srv.cerrar(); }
