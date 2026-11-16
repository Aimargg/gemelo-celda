// Línea base medida de la v8 (T0.3) y medida de la fase 1 (DT14). Solo mide: no cambia el gemelo ni los fixtures.
// Uso: npm run medir                                  → escribe docs/estado/linea-base-v8.md (el informe de T0.3)
//      npm run medir -- docs/estado/medida-f1.md      → escribe ese fichero con la medida de F1 (otro fichero cualquiera,
//                                                       igual): no toca linea-base-v8.md
// Mide en este entorno: matriz de 32 casos, tiempos de carga, calcularPlanes y ensayo M0, tareas largas y tamaños. La
// medida de F1 añade calcularPlanes con el robot nominal y con el 203 (DT14), lo que tarda Validar y la matriz de 8
// casos con el perfil «curso», y solo da cifras y entorno.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes } from '../navegador.mjs';
import { BASE, CASOS_CURSO, ensayar } from '../medir.mjs';

const LINEA_BASE = path.join(RAIZ, 'docs/estado/linea-base-v8.md');
const SALIDA = path.resolve(RAIZ, process.argv[2] || LINEA_BASE), F1 = SALIDA !== LINEA_BASE;

// Matriz completa: caja/mesa × M0/M1 × balanceo 0 y 2 cm × velocidad 10, 25, 50 y 100 % (32 casos, balanceo ≤ 2 cm)
const CASOS_MATRIZ_32 = [];
for (const caja of [true, false]) for (const modo of ['M0', 'M1']) for (const amp of [0, 0.02]) for (const vel of [0.1, 0.25, 0.5, 1.0]) CASOS_MATRIZ_32.push({ ...BASE, caja, modo, amp, vel });

const N_CARGAS = 3;
// Se instala antes de cargar la página: hora a la que desaparece #loading, hora a la que termina el primer
// calcularPlanes (__g.CALC.activo vuelve a false) y todas las tareas largas (> 50 ms) con su inicio
const INSTRUMENTO = () => {
  const M = window.__medida = { cargado: null, calcFin: null, largas: [], largasOk: false };
  try { // sin soporte de longtask, el informe dice «no disponible» en vez de 0
    if ((PerformanceObserver.supportedEntryTypes || []).includes('longtask')) {
      new PerformanceObserver(l => { for (const e of l.getEntries()) M.largas.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask' }); M.largasOk = true;
    }
  } catch (e) { M.largasOk = false; }
  let visto = false;
  const mo = new MutationObserver(() => {
    if (document.getElementById('loading')) { visto = true; return; }
    if (!visto || M.cargado != null) return;
    M.cargado = performance.now(); mo.disconnect();
    const iv = setInterval(() => { if (window.__g && !window.__g.CALC.activo) { M.calcFin = performance.now(); clearInterval(iv); } }, 5);
  });
  mo.observe(document, { childList: true, subtree: true });
};
const sh = c => { try { return execSync(c, { cwd: RAIZ }).toString().trim(); } catch (e) { return 'desconocido'; } };
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const seg = ms => (ms / 1000).toFixed(1).replace('.', ',');
const kb = b => (b / 1024).toFixed(1).replace('.', ',');

const srv = await arrancarServidor(); let chromium = '';
const R = { cargas: [], calc: [], ensayoM0: [], largas: [] };
let gl = '', interceptadas = [];
try {
  // 1) Carga y primer calcularPlanes (el automático tras la carga: disposición por defecto, caché vacía), con marcas
  //    tomadas dentro de la página (performance.now desde el inicio de la navegación) y tareas largas desde el arranque
  for (let i = 0; i < N_CARGAS; i++) {
    const s = await abrir(srv.url, { esperarCalculo: false, initScripts: [INSTRUMENTO] });
    let m, e;
    try {
      await s.page.waitForFunction(() => window.__medida.calcFin != null, null, { timeout: 240000 });
      m = await s.page.evaluate(() => window.__medida);
      if (i === 0) {
        chromium = s.version; interceptadas = s.reg.interceptadas;
        gl = await s.page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const x = g && g.getExtension('WEBGL_debug_renderer_info'); return g ? (x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'sin WebGL2'; });
      }
      // 2) ensayo M0 (caja, balanceo 2 cm, 25 %), sin render como en el banco de pruebas, justo después
      e = await ensayar(s.page, [{ ...BASE, caja: true, modo: 'M0', amp: 0.02 }]);
      comprobar(s.reg);
    } finally { await s.cerrar(); }
    const largas = m.largasOk ? m.largas.filter(l => l.t >= m.cargado && l.t <= m.calcFin).map(l => l.d) : null;
    R.cargas.push({ tCarga: m.cargado, tPrimer: m.calcFin - m.cargado }); R.calc.push(m.calcFin - m.cargado); R.largas.push(largas);
    const { ms, fin, t_sim, pausas, choques, roces, planes } = e[0]; R.ensayoM0.push({ ms, fin, t_sim, pausas, choques, roces, planes });
    console.log(`página ${i + 1}: carga ${Math.round(m.cargado)} ms, calcularPlanes ${Math.round(m.calcFin - m.cargado)} ms, largas>200 ${largas ? largas.filter(d => d > 200).length : 'no disponible'}, ensayo M0 ${ms} ms (${fin}, pausas ${pausas}, choques ${choques}, roces ${roces}, planes ${planes}, t_sim ${t_sim})`);
  }
  // 4) Matriz completa de 32 casos en una página nueva, en orden fijo
  const s = await abrir(srv.url); const t = Date.now();
  try { R.matriz = await ensayar(s.page, CASOS_MATRIZ_32); R.tMatriz = Date.now() - t; comprobar(s.reg); } finally { await s.cerrar(); }
  console.log(`matriz 32: ${R.tMatriz} ms`);
  if (F1) {
    // 6) calcularPlanes de la disposición por defecto con el robot nominal y con el 203, sin caché, en N_CARGAS páginas
    //    nuevas (DT14). La misma página mide los dos: primero nominal (caché vaciada) y después 203 (otra clave de plan)
    R.calcRobot = { nominal: [], '203': [] };
    for (let i = 0; i < N_CARGAS; i++) {
      const s = await abrir(srv.url);
      try {
        for (const id of ['nominal', '203']) {
          const ms = await s.page.evaluate(async id => {
            const g = window.__g; if (id !== g.ROB.id) { g.L().robotId = id; g.aplicarLayout(); }
            for (const k in g.CACHE_PLAN) g.CACHE_PLAN[k] = {};
            const t0 = performance.now(); await g.calcularPlanes('gemelo'); if (!g.planesAlDia()) throw new Error('calcularPlanes no terminó'); return performance.now() - t0;
          }, id);
          R.calcRobot[id].push(ms);
        }
        comprobar(s.reg);
      } finally { await s.cerrar(); }
      console.log(`página ${i + 1}: calcularPlanes nominal ${Math.round(R.calcRobot.nominal[i])} ms, 203 ${Math.round(R.calcRobot['203'][i])} ms`);
    }
    // 7) Validar la disposición por defecto en N_CARGAS páginas nuevas: VAL.res.ms (trayectorias de los dos perfiles,
    //    comprobación previa y demo con los dos) y su resultado
    R.validar = [];
    for (let i = 0; i < N_CARGAS; i++) {
      const s = await abrir(srv.url);
      try {
        R.validar.push(await s.page.evaluate(async () => { const g = window.__g; await g.validar(); const r = g.VAL.res, v = pf => ({ previa: r.per[pf].previa.ok, demo: r.per[pf].demo.fin, t: r.per[pf].demo.t_ciclo_s });
          return { ms: r.ms, gemelo: v('gemelo'), curso: v('curso') }; }));
        comprobar(s.reg);
      } finally { await s.cerrar(); }
      console.log(`página ${i + 1}: Validar ${R.validar[i].ms} ms`);
    }
    // 8) Matriz de 8 casos con «curso» (los de tests/fixtures/matriz-curso.json) en una página nueva
    const s = await abrir(srv.url); const t = Date.now();
    try { R.curso = await ensayar(s.page, CASOS_CURSO); R.tCurso = Date.now() - t; comprobar(s.reg); } finally { await s.cerrar(); }
    console.log(`matriz curso: ${R.tCurso} ms`);
  }
} finally { await srv.cerrar(); }

// 5) Tamaños de los dos destinos y de los recursos que cargan
const tam = f => { const p = path.join(RAIZ, f); const d = fs.readFileSync(p); return { f, b: d.length, gz: zlib.gzipSync(d, { level: 9 }).length }; };
const threeFich = interceptadas.filter(x => x.startsWith('/npm/three@0.160.0/')).map(x => 'node_modules/three/' + x.slice('/npm/three@0.160.0/'.length));
const tams = [tam('dist/gemelo-celda.html'), tam('index.html'), tam('config.js'), tam('firebase.js'), tam('ur3e-malla.json'), tam('mesa.jpg'), ...threeFich.map(tam)];
const tThree = tams.filter(x => x.f.startsWith('node_modules/three/')).reduce((a, x) => ({ b: a.b + x.b, gz: a.gz + x.gz }), { b: 0, gz: 0 });

// Agregados
const M = R.matriz; const porFin = {}; for (const r of M) porFin[r.fin] = (porFin[r.fin] || 0) + 1;
const suma = k => M.reduce((a, r) => a + r[k], 0);
const largasTodas = R.largas.map(l => l && l.filter(d => d > 200));
const entorno = [
  `- Fecha: ${new Date().toISOString().slice(0, 10)} · código medido: \`src/\` de ${sh('git log -1 --format=%h -- src')} (rama ${sh('git rev-parse --abbrev-ref HEAD')})`,
  `- Máquina: ${os.cpus()[0].model}, ${os.cpus().length} CPU, ${Math.round(os.totalmem() / 2 ** 30)} GB, ${os.platform()} ${os.release()}`,
  `- Node ${process.version} · Playwright 1.63.0 · Chromium ${chromium} sin interfaz · WebGL: ${gl}`,
  `- Ventana 1440 × 900, deviceScaleFactor 1, red cerrada (three servido desde node_modules)`,
];
const md = `# Línea base medida de la v8

> Generado por \`npm run medir\` (\`tests/medidas/linea-base.mjs\`, tarea T0.3). No editar a mano: se regenera.
>
> **Advertencia:** todas las cifras de tiempo son de Chromium con **SwiftShader** (WebGL por CPU) en un contenedor sin GPU.
> No representan un portátil con GPU: allí la carga y el render serán bastante más rápidos. Sirven para comparar versiones
> en este mismo entorno, no como tiempos de uso real.

## Entorno

${entorno.join('\n')}

## 1. Matriz completa (32 casos, balanceo ≤ 2 cm)

Caja/mesa × M0/M1 × balanceo 0 y 2 cm × velocidad 10, 25, 50 y 100 %, fase 0, en una página nueva y en este orden
(\`CASOS_MATRIZ_32\` de \`tests/medidas/linea-base.mjs\`). Tiempo total: ${seg(R.tMatriz)} s.

**Agregado:** ${Object.entries(porFin).map(([k, v]) => `${v} «${k}»`).join(', ')} · choques ${suma('choques')} · roces ${suma('roces')} · pausas ${suma('pausas')} · autocolisiones ${suma('autocol')}.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
${M.map(r => `| ${r.caso} | ${r.fin} | ${r.paso} | ${r.t_sim} | ${r.t_mov} | ${r.errores_mm.join(' / ') || '—'} | ${r.choques} | ${r.roces} | ${r.pausas} | ${r.planes} | ${r.ms} |`).join('\n')}

Motivo de los casos que no terminan en «ok» (primeros 200 caracteres):
${[...new Set(M.filter(r => r.fin !== 'ok').map(r => r.fallo))].map(f => `- ${f || '(sin texto)'}`).join('\n') || '- ninguno'}

## 2. Tiempos en SwiftShader (${N_CARGAS} páginas nuevas; mediana y rango)

| Medida | Mediana | Mín. | Máx. |
|---|---|---|---|
| Carga: inicio de la navegación → desaparece \`#loading\` | ${seg(med(R.cargas.map(c => c.tCarga)))} s | ${seg(Math.min(...R.cargas.map(c => c.tCarga)))} s | ${seg(Math.max(...R.cargas.map(c => c.tCarga)))} s |
| \`calcularPlanes\` de la disposición por defecto (el automático tras la carga, sin caché) | ${seg(med(R.calc))} s | ${seg(Math.min(...R.calc))} s | ${seg(Math.max(...R.calc))} s |
| \`ensayo\` M0 (caja, 2 cm, 25 %, sin render) | ${seg(med(R.ensayoM0.map(e => e.ms)))} s | ${seg(Math.min(...R.ensayoM0.map(e => e.ms)))} s | ${seg(Math.max(...R.ensayoM0.map(e => e.ms)))} s |

Resultado del ensayo M0 en cada página (los cuatro primeros campos son los que compara la caracterización):

| Página | fin | pausas | choques | roces | planes | t_sim (s) |
|---|---|---|---|---|---|---|
${R.ensayoM0.map((e, i) => `| ${i + 1} | ${e.fin} | ${e.pausas} | ${e.choques} | ${e.roces} | ${e.planes} | ${e.t_sim} |`).join('\n')}

## 3. Tareas largas (> 200 ms) durante \`calcularPlanes\`

\`PerformanceObserver\` de tipo \`longtask\` instalado antes de cargar; cuenta las tareas que empiezan durante el primer
\`calcularPlanes\` de cada página:

| Página | Tareas > 200 ms | La más larga | Tareas > 50 ms |
|---|---|---|---|
${R.largas.map((l, i) => l ? `| ${i + 1} | ${largasTodas[i].length} | ${l.length ? Math.round(Math.max(...l)) + ' ms' : '—'} | ${l.length} |` : `| ${i + 1} | no disponible | no disponible | no disponible |`).join('\n')}

## 4. Tamaños

| Fichero | Bytes | KiB | gzip -9 (KiB) |
|---|---|---|---|
${tams.filter(x => !x.f.startsWith('node_modules/three/')).map(x => `| \`${x.f}\` | ${x.b} | ${kb(x.b)} | ${kb(x.gz)} |`).join('\n')}
| three 0.160.0 (${threeFich.length} módulos desde jsDelivr) | ${tThree.b} | ${kb(tThree.b)} | ${kb(tThree.gz)} |

Destino artefacto = \`dist/gemelo-celda.html\` + three (+ \`ur3e-malla.json\` y \`mesa.jpg\` si se sirven). Destino web = \`index.html\` + \`config.js\` + \`firebase.js\` + three + \`ur3e-malla.json\` + \`mesa.jpg\`.

## 5. Variabilidad conocida

- Con la fase de la bandeja absoluta (\`fase\` tal cual), los resultados de \`ensayo\` con balanceo variaban entre ejecuciones
  idénticas (pausas 1–2, errores, t_sim y planes), porque \`simT\` avanza con el reloj real mientras la página carga
  (\`bucle()\`: \`else if (!D.activo) simT += dt\`) y la bandeja se mueve con \`BALANCEO(simT + fase)\`.
- Con la fase relativa al inicio de cada ensayo (\`tests/medir.mjs\`), los 8 casos de \`matriz-base.json\` dieron exactamente
  lo mismo en 20 ejecuciones (todos los campos; 5 seguidas, una con la CPU cargada) y las 3 escenas v8 en 11. Las cifras
  de la sección 1 usan ese procedimiento.
- **La matriz de 32 casos no es estable:** en T0.3 dio 10 pausas en dos ejecuciones y 8 en otra. Los 6 primeros casos
  coinciden; a partir de «caja M0 balanceo 2 cm vel 50 %» (1 → 0 pausas, y lo mismo a 100 %) el resto diverge en t_sim,
  errores y planes. Tómala como referencia, no como valor exacto. Mitigación posible en el lado del test: una página nueva
  por caso; la de fondo es T1.2.
- Los resultados siguen dependiendo del orden de cálculo dentro de la página (\`SEMILLA\` global del RRT): la tabla vale
  para este orden en una página nueva. Lo corrige T1.2.
- Los tiempos (secciones 2 y 3) varían de una ejecución a otra por la carga de la máquina: se dan mediana y rango.
${new Set(R.ensayoM0.map(e => JSON.stringify([e.fin, e.pausas, e.choques, e.roces, e.planes, e.t_sim]))).size > 1 ? `- **Variabilidad residual en esta ejecución:** el ensayo M0 de la sección 2 (primer ensayo tras la carga, mismo procedimiento
  en las ${N_CARGAS} páginas) dio pausas ${R.ensayoM0.map(e => e.pausas).join(', ')}, planes ${R.ensayoM0.map(e => e.planes).join(', ')} y t_sim ${R.ensayoM0.map(e => e.t_sim).join(', ')} s. Queda una fuente de variación sin identificar
  (sospecha: el orden en que el bucle de render y los temporizadores intercalan el cálculo asíncrono, que consume la \`SEMILLA\`
  global). La matriz de 32 casos es una sola ejecución: tómala como referencia, no como valor exacto.
` : `- El ensayo M0 de la sección 2 dio el mismo resultado (todos los campos de la tabla) en las ${N_CARGAS} páginas.
`}`;
// Medida de F1: solo cifras y entorno (DT14)
const filaMatriz = r => `| ${r.caso} | ${r.fin} | ${r.paso} | ${r.t_sim} | ${r.t_mov} | ${r.errores_mm.join(' / ') || '—'} | ${r.choques} | ${r.roces} | ${r.pausas} | ${r.planes} | ${r.ms} |`;
const agregado = M => { const f = {}; for (const r of M) f[r.fin] = (f[r.fin] || 0) + 1; const sm = k => M.reduce((a, r) => a + r[k], 0); return `${Object.entries(f).map(([k, v]) => `${v} «${k}»`).join(', ')} · choques ${sm('choques')} · roces ${sm('roces')} · pausas ${sm('pausas')} · autocolisiones ${sm('autocol')}`; };
const rango = a => `| ${seg(med(a))} s | ${seg(Math.min(...a))} s | ${seg(Math.max(...a))} s |`;
const mdF1 = () => `# Medida de la fase 1

> Generado por \`npm run medir -- ${path.relative(RAIZ, SALIDA)}\` (\`tests/medidas/linea-base.mjs\`, pasada de deuda de F1, DT14). No editar a
> mano: se regenera. Tiempos de Chromium con SwiftShader (WebGL por CPU) en un contenedor sin GPU.

## Entorno

${entorno.join('\n')}

## 1. Carga (${N_CARGAS} páginas nuevas; mediana y rango)

| Medida | Mediana | Mín. | Máx. |
|---|---|---|---|
| Carga: inicio de la navegación → desaparece \`#loading\` ${rango(R.cargas.map(c => c.tCarga))}
| \`calcularPlanes\` automático tras la carga (nominal, «gemelo», sin caché) ${rango(R.calc)}

## 2. \`calcularPlanes\` con el robot nominal y con el 203 (DT14)

Disposición por defecto, perfil «gemelo», caché vaciada, ${N_CARGAS} páginas nuevas (en cada una, nominal y después 203).

| Robot | Mediana | Mín. | Máx. |
|---|---|---|---|
| nominal ${rango(R.calcRobot.nominal)}
| 203 ${rango(R.calcRobot['203'])}

## 3. Validar

Botón «Validar con perfil curso» sobre la disposición por defecto en una página recién cargada (\`VAL.res.ms\`: trayectorias de
los dos perfiles, comprobación previa y demo con los dos), ${N_CARGAS} páginas nuevas.

| Página | Validar (s) | gemelo: previa · demo · ciclo (s) | curso: previa · demo · ciclo (s) |
|---|---|---|---|
${R.validar.map((v, i) => `| ${i + 1} | ${seg(v.ms)} | ${v.gemelo.previa ? 'sin problemas' : 'con problemas'} · ${v.gemelo.demo} · ${v.gemelo.t} | ${v.curso.previa ? 'sin problemas' : 'con problemas'} · ${v.curso.demo} · ${v.curso.t} |`).join('\n')}

Mediana: ${seg(med(R.validar.map(v => v.ms)))} s (mín. ${seg(Math.min(...R.validar.map(v => v.ms)))} s, máx. ${seg(Math.max(...R.validar.map(v => v.ms)))} s).

## 4. Matriz de 32 casos con «gemelo»

Caja/mesa × M0/M1 × balanceo 0 y 2 cm × velocidad 10, 25, 50 y 100 %, fase 0, en una página nueva y en este orden
(\`CASOS_MATRIZ_32\`). Tiempo total: ${seg(R.tMatriz)} s.

**Agregado:** ${agregado(M)}.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
${M.map(filaMatriz).join('\n')}

## 5. Matriz de 8 casos con «curso»

Los casos de \`tests/fixtures/matriz-curso.json\` (\`CASOS_CURSO\`), en una página nueva y en este orden. Tiempo total: ${seg(R.tCurso)} s.

**Agregado:** ${agregado(R.curso)}.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
${R.curso.map(filaMatriz).join('\n')}
`;
const out = SALIDA; fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, F1 ? mdF1() : md);
console.log('escrito', path.relative(RAIZ, out));
