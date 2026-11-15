// Repetibilidad entre páginas nuevas (T1.2 criterio 6, DT7). Solo mide: no cambia el gemelo ni los fixtures.
// Repite en N páginas recién cargadas (navegador nuevo cada vez) y compara TODOS los campos (salvo «ms», que es tiempo real):
//   · el ensayo M0 (caja, balanceo 2 cm, 25 %) justo después del primer cálculo, como la sección 2 de la línea base;
//   · la matriz de 8 casos de tests/fixtures/matriz-base.json, en su orden;
//   · la medida de las tres escenas v8 (medirEscena: posiciones, veredicto y ensayo M0);
//   · con --32, la matriz de 32 casos de la línea base; con --inverso, la matriz de 8 en orden inverso (I6 a nivel de demo).
// Uso: npm run build && node tests/medidas/repetibilidad.mjs [--paginas 3] [--32] [--inverso]
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { BASE, CASOS_MATRIZ, ensayar, medirEscena } from '../medir.mjs';

const args = process.argv.slice(2);
const N = +(args[args.indexOf('--paginas') + 1] || 3) || 3;
const CASOS_32 = []; for (const caja of [true, false]) for (const modo of ['M0', 'M1']) for (const amp of [0, 0.02]) for (const vel of [0.1, 0.25, 0.5, 1.0]) CASOS_32.push({ ...BASE, caja, modo, amp, vel });
const DIR = path.join(RAIZ, 'tests/fixtures/escenas-v8');
const ESCENAS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const sinMs = rs => rs.map(({ ms, ...r }) => r);

async function enPagina(srv, fn) { const s = await abrir(srv.url); try { const r = await fn(s.page); comprobar(s.reg); return r; } finally { await s.cerrar(); } }

// Compara las N repeticiones de una serie de resultados (cada una, una lista de objetos) campo a campo
function comparar(nombre, reps, clave) {
  let iguales = true;
  reps[0].forEach((r0, i) => {
    const dif = [];
    for (const k of Object.keys(r0)) { const vs = reps.map(rep => JSON.stringify(rep[i][k])); if (new Set(vs).size > 1) dif.push(`${k}: ${vs.join(' | ')}`); }
    const id = clave(r0, i);
    if (dif.length) { iguales = false; console.log(`  ✗ ${id}\n      ${dif.join('\n      ')}`); }
    else { const x = r0.demo || r0; console.log(`  = ${id}: fin ${x.fin}, t_sim ${x.t_sim}, t_mov ${x.t_mov}, planes ${x.planes}, pausas ${x.pausas}, errores ${JSON.stringify(x.errores_mm)}${r0.veredicto ? `, veredicto ${JSON.stringify(r0.veredicto)}` : ''}`); }
  });
  console.log(`${iguales ? 'IGUAL' : 'DIFIERE'} en ${reps.length} repeticiones: ${nombre}\n`);
  return iguales;
}

const srv = await arrancarServidor(); const res = {};
try {
  const series = {
    'ensayo M0 tras la carga': p => ensayar(p, [{ ...BASE, caja: true, modo: 'M0', amp: 0.02 }]).then(sinMs),
    'matriz de 8 casos': p => ensayar(p, CASOS_MATRIZ).then(sinMs),
    ...Object.fromEntries(ESCENAS.map(e => [`escena v8 «${e.nombre}»`, async p => [await medirEscena(p, e.codigo, { demoCompleto: true })]])),
    ...(args.includes('--inverso') ? { 'matriz de 8 casos en orden inverso': p => ensayar(p, [...CASOS_MATRIZ].reverse()).then(sinMs) } : {}),
    ...(args.includes('--32') ? { 'matriz de 32 casos': p => ensayar(p, CASOS_32).then(sinMs) } : {}),
  };
  for (const [nombre, fn] of Object.entries(series)) {
    const reps = []; for (let i = 0; i < N; i++) { const t = Date.now(); reps.push(await enPagina(srv, fn)); console.log(`${nombre}: página ${i + 1} de ${N} (${Math.round((Date.now() - t) / 1000)} s)`); }
    res[nombre] = comparar(nombre, reps, (r, i) => r.caso || nombre);
    res['__' + nombre] = reps[0];
  }
  if (res['__matriz de 8 casos en orden inverso']) {
    const dir = res['__matriz de 8 casos'], inv = [...res['__matriz de 8 casos en orden inverso']].reverse();
    console.log('I6 a nivel de demo: matriz en orden directo frente a inverso (misma página nueva, distinto orden)');
    res.inverso = comparar('orden directo y orden inverso', [dir, inv], r => r.caso);
  }
} finally { await srv.cerrar(); }
const malos = Object.entries(res).filter(([k, v]) => !k.startsWith('__') && v === false).map(([k]) => k);
console.log(malos.length ? `RESULTADO: varían ${malos.join(', ')}` : 'RESULTADO: todas las series iguales en todas las páginas');
