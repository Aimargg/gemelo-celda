// Barrido de la salida de la bandeja frente a su balanceo (T2.8, DT30). Mide, con el gemelo construido (dist/), si la pinza
// toca la bandeja al salir de ella, al subir H_SALIDA y al arrancar el movimiento siguiente (tránsito o reposo), en la
// disposición de partida y en 32 vecinas. No es un test: no compara con nada, escribe la medida.
//
// Uso: npm run build && node tools/barrido-salida.mjs <salida.md> [--etiqueta <texto>]
//      [--primeras N] solo mide las N primeras disposiciones (para probar el script)
//      escribe la tabla en <salida.md> (p. ej. docs/estado/barrido-salida-v9-dev.md) y los datos en <salida.json>.
//
// Rejilla (2^5 + 1 = 33 disposiciones): la de partida y las 32 esquinas de un factorial de dos niveles en cinco factores,
// todos alrededor de la de partida:
//   persona.x ± 2 cm · persona.y ± 2 cm · persona.yaw ± 5° · bandeja.ade ± 2 cm · bandeja.alt ± 2 cm
// (ade: distancia de la bandeja por delante de la persona; alt: su altura sobre el suelo). Se aplican sobre una copia de la
// disposición de partida (layout por defecto de la página recién cargada), una a una y en este orden, en la misma página.
//
// Para cada disposición, lo mismo que la parte «curso» de Validar (T1.8): trayectorias con «curso», comprobación previa con
// «curso» y el ensayo de la demo con «curso», M0, 2 cm de balanceo, velocidad 25 % y la bandeja en la fase 0 (FASE_VALIDAR).
// Durante el ensayo se vigila, en cada fotograma tras soltar cada plato, la holgura entre el brazo y la pinza (apertura de
// ese momento, sin carga) y la bandeja de ese instante, con el mismo obstáculo y el mismo margen de 4 mm que el planificador
// (obstaculos(), tag «bandeja»): holgura < 0 es contacto. Tramos:
//   · apertura: la pinza se abre sobre el plato ya apoyado;
//   · salida:   retrocede 8 cm a lo largo de los dedos (moveL, con la bandeja permitida);
//   · subida:   sube H_SALIDA en recta (moveL, con la bandeja permitida);
//   · arranque: el movimiento siguiente, desde que acaba la subida (el estado deja COLOCANDO_n) hasta que el TCP se aleja
//               5 cm de la postura final de la subida o pasan 2 s (lo que llegue antes). Su primer fotograma («inicio») es
//               esa postura con la bandeja de ese instante; «curso» comprueba el arranque (START_STATE_IN_COLLISION) en ella
//               (si antes ajusta la apertura para la fruta, unos fotogramas después) y, si lo rechaza, la demo para y el
//               fallo dice con qué toca.
// «Toca» = hay contacto con la bandeja en el arranque (lo que DT30 describe): la demo «curso» para con arranque_contacto
// contra la bandeja, o la pinza la toca al empezar a moverse. Los contactos en la apertura y la salida son los previstos
// (la pinza sale de debajo del ala del plato con la bandeja permitida) y solo se informan.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { arrancarServidor, RAIZ } from '../tests/servidor.mjs';
import { abrir, comprobar, esperarPlanes } from '../tests/navegador.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const salida = args.find((a, i) => !a.startsWith('--') && !['--etiqueta', '--primeras'].includes(args[i - 1]));
const etiqueta = opt('--etiqueta') || '', primeras = opt('--primeras') ? +opt('--primeras') : null; // --primeras N: solo las N primeras (para probar el script)
if (!salida || !salida.endsWith('.md')) { console.error('uso: node tools/barrido-salida.mjs <salida.md> [--etiqueta <texto>] [--primeras N]'); process.exit(2); }
const fMd = path.resolve(RAIZ, salida), fJson = fMd.replace(/\.md$/, '.json');

const git = c => { try { return execSync(c, { cwd: RAIZ }).toString().trim(); } catch (e) { return 'desconocido'; } };
const commit = git('git log -1 --format=%h -- src'), sucio = git('git status --porcelain -- src') ? ' (con cambios sin commitear en src/)' : '';
const hSalida = (fs.readFileSync(path.join(RAIZ, 'src/app.js'), 'utf8').match(/^const H_SALIDA = ([\d.]+);/m) || [])[1];

// La rejilla
const CM = 0.02, GR = 5 * Math.PI / 180;
const REJILLA = [{ id: 'partida', d: { px: 0, py: 0, pyaw: 0, ade: 0, alt: 0 } }];
for (let i = 0; i < 32; i++) {
  const s = k => ((i >> k) & 1 ? 1 : -1);
  REJILLA.push({ id: `v${String(i + 1).padStart(2, '0')}`, d: { px: s(4) * CM, py: s(3) * CM, pyaw: s(2) * GR, ade: s(1) * CM, alt: s(0) * CM } });
}
const CFG = { modo: 'M0', amp: 0.02, vel: 0.25, fase: 0, sinRender: true, perfil: 'curso' }; // la demo de Validar con «curso»

// En la página: aplica la disposición, calcula, comprueba y ensaya con la vigilancia de la bandeja
async function medir(page, base, d) {
  return page.evaluate(async ({ base, d, cfg }) => {
    const g = window.__g; const L = JSON.parse(base);
    L.persona.x += d.px; L.persona.y += d.py; L.persona.yaw += d.pyaw; L.bandeja.ade += d.ade; L.bandeja.alt += d.alt;
    g.setL(L); g.aplicarLayout();
    const t0 = performance.now(); await g.calcularPlanes('curso'); const msPlan = performance.now() - t0;
    const graves = g.comprobarPlan({ perfil: 'curso' }).filter(c => c.grave);
    // holgura (m) de las esferas del brazo y la pinza (desde el brazo, grupo 2) a la bandeja, con su margen: < 0 = contacto
    const hBandeja = () => {
      const o = g.obstaculos().find(x => x.tag === 'bandeja'); const q = g.robot.q.slice();
      g.choqueEn(q, { w: g.pinza.w, carga: g.D.carga, obst: [], sinAuto: true }); // solo coloca las esferas (COL.X)
      const C = g.COL(), X = C.X; let m = Infinity;
      for (let i = C.ini[2]; i < C.nAct; i++) {
        const k = i * 4, dx = X[k] - o.x, dy = X[k + 1] - o.y, lx = dx * o.c + dy * o.s, ly = -dx * o.s + dy * o.c, lz = X[k + 2] - o.z;
        const qx = Math.abs(lx) - o.hx, qy = Math.abs(ly) - o.hy, qz = Math.abs(lz) - o.hz; const fuera = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
        m = Math.min(m, (fuera > 0 ? fuera : Math.max(qx, qy, qz)) - X[k + 3] - o.m);
      }
      return m;
    };
    const salidas = [], vistos = new Set(); let cur = null, prevEstado = null;
    const cerrar = () => { if (cur) { salidas.push(cur); cur = null; } };
    const hasta = D => {
      const simT = g.simT();
      if (cur && cur.tramo === 'arranque') { // el movimiento siguiente, hasta 5 cm o 2 s
        const h = hBandeja(); if (h < cur.arranque) { cur.arranque = h; cur.dArr = g.tcpMundo().distanceTo(cur.pFin); cur.tArr = simT - cur.tFin; } if (h < 0) cur.ultimo = 'arranque';
        if (g.tcpMundo().distanceTo(cur.pFin) > 0.05 || simT - cur.tFin > 2) cerrar();
      }
      // acaba la subida: el estado deja COLOCANDO_n (TRANSITO_2, SIRVIENDO_2 si la pinza no va horizontal, o HECHO) y
      // empieza el movimiento siguiente
      if (cur && cur.tramo !== 'arranque' && cur.tramo !== 'apertura' && D.estado !== prevEstado) {
        cur.tramo = 'arranque'; cur.pFin = g.tcpMundo(); cur.tFin = simT; const h = hBandeja(); cur.inicio = h; cur.arranque = h; cur.dArr = 0; cur.tArr = 0; if (h < 0) cur.ultimo = 'arranque';
      } else if (!cur && D.ctx && D.ctx.fase === 'bandeja' && D.platoEnPinza === null && !vistos.has(D.ctx.pk)) { // el plato ya está en la bandeja
        vistos.add(D.ctx.pk); cur = { pk: D.ctx.pk, tramo: 'apertura', p0: null, apertura: Infinity, salida: Infinity, subida: Infinity, arranque: Infinity, inicio: null, ultimo: null };
      }
      if (cur && cur.tramo !== 'arranque') {
        if (cur.tramo === 'apertura' && g.pinza.w >= 0.0299) { cur.tramo = 'salida'; cur.p0 = g.tcpMundo(); }
        if (cur.tramo === 'salida' && g.tcpMundo().distanceTo(cur.p0) > 0.0799) cur.tramo = 'subida';
        const h = hBandeja(); cur[cur.tramo] = Math.min(cur[cur.tramo], h); if (h < 0) cur.ultimo = cur.tramo;
      }
      prevEstado = D.estado; return false;
    };
    const r = await g.ensayo({ ...cfg, hasta });
    const f = g.D.falloDemo, ch = f && f.info && f.info.choque;
    if (cur) { // la demo ha parado en el arranque (START_STATE_IN_COLLISION) antes de que la vigilancia lo viera
      if (f && f.causa === 'arranque_contacto') { cur.tramo = 'arranque'; cur.ultimo = ch && ch.b === 'bandeja' ? 'arranque' : cur.ultimo; cur.parada = true; }
      cerrar();
    }
    const red = v => v === Infinity || v === null ? null : +(v * 1000).toFixed(1);
    return {
      msPlan: Math.round(msPlan), previa: { ok: !graves.length, txt: graves.length ? graves[0].txt.slice(0, 160) : '' },
      demo: { fin: r.fin, paso: r.paso, t_mov: r.t_mov, pausas: r.pausas, choques: r.choques, roces: r.roces, causa: f ? f.causa : null, contra: ch ? (ch.b || null) : null, txt: f ? f.msg.replace(/\s+/g, ' ').slice(0, 200) : '' },
      salidas: salidas.map(s => ({ pk: s.pk, apertura_mm: red(s.apertura), salida_mm: red(s.salida), subida_mm: red(s.subida), inicio_mm: red(s.inicio), arranque_mm: red(s.arranque), arranque_en: s.dArr === undefined ? null : { tcp_mm: red(s.dArr), t_s: +s.tArr.toFixed(2) }, ultimo: s.ultimo, parada: !!s.parada })),
    };
  }, { base, d, cfg: CFG });
}

const toca = r => r.salidas.some(s => s.ultimo === 'arranque') || (r.demo.causa === 'arranque_contacto' && r.demo.contra === 'bandeja');
const viable = r => r.previa.ok && r.demo.fin === 'ok';
const f1 = v => v === null || v === undefined ? '—' : String(v).replace('.', ',');
const grados = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 180 / Math.PI))}°`;
const cm = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}`;

const t0 = Date.now();
const srv = await arrancarServidor(); let s;
const filas = [];
try {
  s = await abrir(srv.url); const p = s.page;
  const base = await p.evaluate(() => JSON.stringify(window.__g.L()));
  const entorno = await p.evaluate(() => ({ ua: navigator.userAgent }));
  for (const c of primeras ? REJILLA.slice(0, primeras) : REJILLA) {
    const t = Date.now(); const r = await medir(p, base, c.d);
    filas.push({ id: c.id, d: c.d, ...r, toca: toca(r), viable: viable(r), ms: Date.now() - t });
    console.log(`${c.id}: previa ${r.previa.ok ? 'ok' : 'falla'} · demo ${r.demo.fin}${r.demo.causa ? ` (${r.demo.causa}${r.demo.contra ? ` con ${r.demo.contra}` : ''})` : ''} · ${filas.at(-1).toca ? 'TOCA' : 'no toca'} · ${r.salidas.map(x => `${x.pk}: inicio ${f1(x.inicio_mm)} mm, arranque ${f1(x.arranque_mm)} mm, último contacto ${x.ultimo || '—'}`).join(' | ')} · ${Date.now() - t} ms`);
  }
  await p.evaluate(b => { const g = window.__g; g.setL(JSON.parse(b)); g.aplicarLayout(); }, base);
  comprobar(s.reg);
  const durS = Math.round((Date.now() - t0) / 1000);
  const n = filas.length, nToca = filas.filter(f => f.toca).length, nViable = filas.filter(f => f.viable).length, nPrevia = filas.filter(f => f.previa.ok).length;
  const porTramo = {}; for (const f of filas) for (const x of f.salidas) if (x.ultimo) porTramo[x.ultimo] = (porTramo[x.ultimo] || 0) + 1;
  const datos = { etiqueta, commit: commit + sucio, h_salida: hSalida, cfg: CFG, rejilla: 'persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm, bandeja.alt ±2 cm (2^5 esquinas) + la de partida', duracion_s: durS, navegador: s.version, resumen: { disposiciones: n, previa_ok: nPrevia, viables: nViable, tocan: nToca, ultimo_contacto_por_tramo: porTramo }, filas };
  fs.mkdirSync(path.dirname(fMd), { recursive: true });
  fs.writeFileSync(fJson, JSON.stringify(datos, null, 2) + '\n');
  const md = [];
  md.push(`# Barrido de la salida de la bandeja${etiqueta ? `: ${etiqueta}` : ''}`, '');
  md.push(`> Generado por \`node tools/barrido-salida.mjs ${path.relative(RAIZ, fMd)}${etiqueta ? ` --etiqueta "${etiqueta}"` : ''}\` (T2.8, DT30). No editar a mano: se regenera. Datos: \`${path.relative(RAIZ, fJson)}\`.`, '');
  md.push('## Entorno', '');
  md.push(`- Código: \`src/\` de \`${commit}\`${sucio} · \`H_SALIDA\` = ${hSalida} m · ${new Date().toISOString().slice(0, 10)}`);
  md.push(`- Chromium ${s.version} con SwiftShader, sin GPU; una sola página para las ${n} disposiciones, en el orden de la tabla. Duración: ${durS} s.`);
  md.push(`- Demo: perfil «curso», ${CFG.modo}, balanceo ${CFG.amp * 100} cm, velocidad ${CFG.vel * 100} %, fase de la bandeja ${CFG.fase} (la de Validar).`);
  md.push('- Rejilla: la disposición de partida y las 32 esquinas de persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm y bandeja.alt ±2 cm.', '');
  md.push('## Resumen', '');
  md.push(`- Disposiciones: ${n} · comprobación previa sin problemas: ${nPrevia} · demo completa (viables): ${nViable}`);
  md.push(`- **Tocan la bandeja en el arranque del movimiento siguiente: ${nToca} de ${n}**`);
  md.push(`- Tramo del último contacto con la bandeja, por salida (cada disposición tiene una por plato): ${Object.keys(porTramo).length ? Object.entries(porTramo).map(([k, v]) => `${k} ${v}`).join(' · ') : 'ninguno'}`, '');
  md.push('## Por disposición', '');
  md.push('Holguras con la bandeja en mm (mínimo de cada tramo, con el margen de 4 mm del planificador; negativa = contacto). «inicio»: la postura al acabar la subida, con la bandeja de ese instante. «arranque»: el mínimo en el arranque y, si no es en su primer fotograma, a cuánto se ha movido el TCP de la postura final de la subida y cuándo.', '');
  md.push('| Disp. | persona x/y (cm) · yaw | bandeja ade/alt (cm) | previa | demo | causa | toca | plato 1: salida · subida · inicio · arranque | plato 2: salida · subida · inicio · arranque | último contacto |');
  md.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const f of filas) {
    const sal = pk => { const x = f.salidas.find(y => y.pk === pk); return x ? `${f1(x.salida_mm)} · ${f1(x.subida_mm)} · ${f1(x.inicio_mm)}${x.parada ? ' (parada)' : ''} · ${f1(x.arranque_mm)}${x.arranque_en && x.arranque_en.tcp_mm ? ` (a ${f1(Math.round(x.arranque_en.tcp_mm))} mm, ${f1(x.arranque_en.t_s)} s)` : ''}` : '—'; };
    md.push(`| ${f.id} | ${cm(f.d.px)}/${cm(f.d.py)} · ${grados(f.d.pyaw)} | ${cm(f.d.ade)}/${cm(f.d.alt)} | ${f.previa.ok ? 'ok' : 'falla'} | ${f.demo.fin} (paso ${f.demo.paso}) | ${f.demo.causa ? `${f.demo.causa}${f.demo.contra ? ` (${f.demo.contra})` : ''}` : '—'} | ${f.toca ? '**sí**' : 'no'} | ${sal('plato1')} | ${sal('plato2')} | ${f.salidas.map(x => x.ultimo || '—').join(' / ')} |`);
  }
  const malas = filas.filter(f => !f.viable);
  if (malas.length) { md.push('', '## Fallos', ''); for (const f of malas) md.push(`- ${f.id}: ${f.previa.ok ? f.demo.txt : `previa: ${f.previa.txt}`}`); }
  fs.writeFileSync(fMd, md.join('\n') + '\n');
  console.log(`escrito ${path.relative(RAIZ, fMd)} y ${path.relative(RAIZ, fJson)} · tocan ${nToca} de ${n} · viables ${nViable} · ${durS} s`);
} finally { await s?.cerrar(); await srv.cerrar(); }
