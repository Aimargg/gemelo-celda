// I5 (DT8): los dos destinos ya construidos (npm test construye antes de los unitarios) son un solo HTML; sus scripts
// externos (<script src>, entradas del import map e import de URL) solo vienen de cdn.jsdelivr.net con la versión exacta
// prevista (three@0.160.0; roslib y eventemitter3 entrarán en F3), y la web solo añade config.js y firebase.js locales.
// Se analiza el texto del HTML, sin navegador. El analizador también se prueba con HTML de muestra que deben fallar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERSIONES = { three: '0.160.0' }; // paquete → versión exacta permitida desde jsDelivr
const LOCALES = { artefacto: [], web: ['config.js'] }; // <script src> locales de cada destino
const DINAMICOS = ['./firebase.js']; // import('…') locales (el almacén de Firestore de la web, src/escenas.js)

function leer(rel) {
  const f = path.join(RAIZ, rel);
  if (!fs.existsSync(f)) throw new Error(`Falta ${rel}: ejecuta npm run build (npm test lo hace antes de los unitarios)`);
  return fs.readFileSync(f, 'utf8');
}
// Problemas de I5 de un HTML (lista vacía si cumple). destino: 'artefacto' | 'web'
export function problemasI5(html, destino) {
  const mal = [];
  // un solo HTML: como mucho un <html> (el artefacto no lleva: claude.ai lo envuelve) y nada que cargue otra página
  const nHtml = (html.match(/<html[\s>]/gi) || []).length; if (nHtml > (destino === 'web' ? 1 : 0)) mal.push(`${nHtml} elementos <html>`);
  if (destino === 'web' && nHtml !== 1) mal.push('la web no tiene su elemento <html>');
  for (const m of html.matchAll(/<(iframe|frame|frameset|object|embed|portal)\b/gi)) mal.push(`carga otra página con <${m[1]}>`);
  for (const m of html.matchAll(/<link\b[^>]*\brel\s*=\s*["']?(import|modulepreload|preload)\b[^>]*>/gi)) mal.push(`<link rel="${m[1]}">`);
  // URL de un script externo: https://cdn.jsdelivr.net/npm/<paquete>@<versión exacta>/…, con la versión prevista
  const externo = (u, donde) => {
    const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)@([^/]+)\//i.exec(u);
    if (!/^https?:\/\//i.test(u) && !u.startsWith('//')) return false;
    if (!m) { mal.push(`${donde}: ${u} no viene de cdn.jsdelivr.net/npm/<paquete>@<versión>/`); return true; }
    if (!/^\d+\.\d+\.\d+$/.test(m[2])) mal.push(`${donde}: ${u} no fija una versión exacta (${m[2]})`);
    else if (!(m[1] in VERSIONES)) mal.push(`${donde}: paquete no previsto ${m[1]}`);
    else if (VERSIONES[m[1]] !== m[2]) mal.push(`${donde}: ${m[1]}@${m[2]} en lugar de ${VERSIONES[m[1]]}`);
    return true;
  };
  // <script src>: externos con versión exacta o, si son locales, solo los del destino
  const locales = [];
  for (const m of html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) { if (!externo(m[1], '<script src>')) locales.push(m[1]); }
  const esperados = LOCALES[destino];
  if (JSON.stringify(locales) !== JSON.stringify(esperados)) mal.push(`<script src> locales: ${JSON.stringify(locales)} en lugar de ${JSON.stringify(esperados)}`);
  // import map: uno como mucho, y cada entrada externa con versión exacta
  const mapas = [...html.matchAll(/<script\b[^>]*\btype\s*=\s*["']?importmap["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  if (mapas.length !== 1) mal.push(`${mapas.length} import maps (se espera uno)`);
  const prefijos = [];
  for (const m of mapas) {
    let im; try { im = JSON.parse(m[1]); } catch (e) { mal.push('import map con JSON no válido'); continue; }
    for (const [k, v] of [...Object.entries(im.imports || {}), ...Object.values(im.scopes || {}).flatMap(s => Object.entries(s))]) {
      if (!externo(v, `import map «${k}»`)) mal.push(`import map «${k}»: ${v} no es una URL de jsDelivr`); prefijos.push(k);
    }
  }
  // import estáticos y dinámicos de los módulos: nombres del import map, URL de jsDelivr con versión o locales permitidos
  const resuelto = s => prefijos.some(k => k.endsWith('/') ? s.startsWith(k) : s === k);
  for (const m of html.matchAll(/\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    const s = m[1] || m[2]; if (externo(s, `import «${s}»`)) continue;
    if (resuelto(s)) continue; if (m[2] && DINAMICOS.includes(s)) continue;
    mal.push(`import «${s}» que no resuelve el import map ni es un local permitido`);
  }
  return mal;
}

test('I5: dist/gemelo-celda.html (artefacto) es un solo HTML y solo carga three@0.160.0 desde jsDelivr', () => {
  assert.deepEqual(problemasI5(leer('dist/gemelo-celda.html'), 'artefacto'), []);
});

test('I5: index.html (web) añade solo config.js y firebase.js locales a lo del artefacto', () => {
  const web = leer('index.html');
  assert.deepEqual(problemasI5(web, 'web'), []);
  assert.ok(web.includes("import('./firebase.js')"), 'la web carga firebase.js local');
});

// Muestras que deben fallar: el analizador no es un test que no puede fallar
const MUESTRA = (cabeza, mapa = '{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}') =>
  `${cabeza}<script type="importmap">${mapa}</script>\n<script type="module">\nimport * as THREE from 'three';\n</script>\n`;

test('I5: el análisis acepta una muestra correcta y rechaza un src sin versión, otro dominio y un import map sin versión', () => {
  assert.deepEqual(problemasI5(MUESTRA(''), 'artefacto'), [], 'muestra correcta');
  const sinVersion = problemasI5(MUESTRA('<script src="https://cdn.jsdelivr.net/npm/three/build/three.module.js"></script>\n'), 'artefacto');
  assert.ok(sinVersion.some(t => /no viene de cdn\.jsdelivr\.net/.test(t)), `src sin versión: ${JSON.stringify(sinVersion)}`);
  const rango = problemasI5(MUESTRA('<script src="https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js"></script>\n'), 'artefacto');
  assert.ok(rango.some(t => /no fija una versión exacta/.test(t)), `src con versión parcial: ${JSON.stringify(rango)}`);
  const dominio = problemasI5(MUESTRA('<script src="https://unpkg.com/three@0.160.0/build/three.module.js"></script>\n'), 'artefacto');
  assert.ok(dominio.some(t => /unpkg\.com/.test(t)), `otro dominio: ${JSON.stringify(dominio)}`);
  const mapa = problemasI5(MUESTRA('', '{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js"}}'), 'artefacto');
  assert.ok(mapa.some(t => /versión exacta/.test(t)), `import map sin versión: ${JSON.stringify(mapa)}`);
  const local = problemasI5(MUESTRA('<script src="otro.js"></script>\n'), 'web');
  assert.ok(local.some(t => /locales/.test(t)), `script local no previsto en la web: ${JSON.stringify(local)}`);
  const pagina = problemasI5(MUESTRA('<iframe src="otra.html"></iframe>\n'), 'artefacto');
  assert.ok(pagina.some(t => /iframe/.test(t)), `otra página: ${JSON.stringify(pagina)}`);
});
