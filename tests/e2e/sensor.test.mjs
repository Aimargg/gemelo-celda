// Modelo de sensor de la ELP en la página (T1.7, D10): selector, sensor por escena (nuevas «elp-ficha», v8 «gemelo-v8»),
// campo de visión, frustum y mm/px con el sensor de la escena, y etiqueta SIN VALIDAR. Las cifras esperadas se calculan
// aquí con las fórmulas (→ camaras-colocacion), no se copian de la página.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';

const V8 = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/escenas-v8/1-defecto.json'), 'utf8'));
const SENS = { 'elp-ficha': { w: 5.952, h: 4.71 }, 'gemelo-v8': { w: 6.287, h: 4.712 } };
const MESA_H = 0.76, R2D = 180 / Math.PI;
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Métricas de la página y datos de cada cámara (focal, modo, posición y punto de mira) para calcularlas aparte
const leer = p => p.evaluate(() => { const g = window.__g, L = g.L(); return { sensor: L.sensor, cams: Object.fromEntries(Object.keys(L.cams).map(k => { const c = L.cams[k], m = g.metricasCam(k); return [k, { f: c.f, modo: c.modo, pos: c.pos, mira: c.mira, hf: m.hf, vf: m.vf, mmpx: m.mmpx, fov: g.CAMS[k].cam.fov, nota: m.nota }]; })) }; });
// Lo que dan las fórmulas: HFOV = 2·atan(w/2f); alto efectivo min(h, w·N_alto/N_ancho); mm/px = d·(w/f)/N ÷ cos θ
function esperado(c, s) {
  const [N, Nh] = c.modo.split('x').map(Number), w = SENS[s].w, h = Math.min(SENS[s].h, w * Nh / N);
  const d = Math.hypot(c.mira.x - c.pos.x, c.mira.y - c.pos.y, c.mira.z - c.pos.z), cosT = c.mira.z <= MESA_H + 0.01 ? Math.abs(c.mira.z - c.pos.z) / d : 1;
  return { hf: 2 * Math.atan(w / (2 * c.f)), vf: 2 * Math.atan(h / (2 * c.f)), mmpx: d * (w / c.f) / N / Math.max(0.2, cosT) * 1000 };
}
function comparar(m, s, que) {
  for (const [k, c] of Object.entries(m.cams)) {
    const e = esperado(c, s);
    for (const x of ['hf', 'vf', 'mmpx']) assert.ok(Math.abs(c[x] - e[x]) <= 1e-9 * Math.max(1, Math.abs(e[x])), `${que} ${k}.${x}: ${c[x]} frente a ${e[x]}`);
    assert.ok(Math.abs(c.fov - e.vf * R2D) < 1e-9, `${que} ${k}: el frustum y la miniatura usan el mismo campo vertical (${c.fov}°)`);
  }
}
const pulsado = p => p.evaluate(() => [...document.querySelectorAll('#segSensor button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.v));

test('T1.7-1, T1.7-2 y T1.7-4: escena nueva con la ficha de la ELP y v8 con 6,287 mm; FOV, frustum y mm/px de las fórmulas', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('#f_cenital').waitFor();
    const nueva = await leer(p);
    assert.equal(nueva.sensor, 'elp-ficha'); assert.deepEqual(await pulsado(p), ['elp-ficha']);
    comparar(nueva, 'elp-ficha', 'nueva');
    assert.match(await p.textContent('#sensorNota'), /^Sensor de la escena: ELP ficha, 5,952 × 4,710 mm \(«image size» de la ficha de la ELP AFKV100/);
    // T1.7-4: una escena v8 da los mismos FOV y mm/px que la v9 anterior (6,287 mm)
    await p.evaluate(c => window.__g.abrirCodigo(c), V8.codigo);
    await p.waitForFunction(() => window.__g.L().sensor === 'gemelo-v8', null, { timeout: 30000, polling: 50 });
    const v8 = await leer(p);
    assert.deepEqual(await pulsado(p), ['gemelo-v8']);
    comparar(v8, 'gemelo-v8', 'v8');
    assert.ok(Math.abs(v8.cams.cenital.hf * R2D - 82.3) < 0.05 && Math.abs(nueva.cams.cenital.hf * R2D - 79.2) < 0.05, 'HFOV a 3,6 mm de la cenital: 82,3° y 79,2°');
    // el selector cambia el sensor sin mover nada
    const antes = await p.evaluate(() => JSON.stringify({ ...window.__g.L(), sensor: null }));
    await p.click('#segSensor [data-v="elp-ficha"]');
    assert.deepEqual(await pulsado(p), ['elp-ficha']);
    comparar(await leer(p), 'elp-ficha', 'tras el selector');
    assert.equal(await p.evaluate(() => JSON.stringify({ ...window.__g.L(), sensor: null })), antes, 'nada se mueve');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.7-3: las métricas de cada cámara llevan la etiqueta SIN VALIDAR y el 1080p a 120 fps, su nota', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('#f_cenital').waitFor();
    const r = await p.evaluate(() => [...document.querySelectorAll('#camCards .card')].map(c => ({ cam: c.dataset.cam, dts: [...c.querySelectorAll('dt')].map(d => d.textContent.trim()), notas: [...c.querySelectorAll('p.hint')].map(x => x.textContent), modo: c.querySelector('select').value })));
    assert.equal(r.length, 3);
    for (const c of r) {
      assert.ok(c.dts.includes('Campo de visión SIN VALIDAR') && c.dts.includes('Resolución en el punto de mira SIN VALIDAR'), `${c.cam}: ${c.dts.join(' | ')}`);
      if (c.modo === '1920x1080') assert.ok(c.notas.some(t => /^Modo 1920×1080: el 1920×1080 a 120 fps sale de un modo de 2028 columnas.*\[SIN VALIDAR\]\.$/.test(t)), `${c.cam}: ${c.notas}`);
    }
    // con un modo de 30 fps, la nota del 1080p@120 desaparece
    await p.evaluate(() => { const el = document.getElementById('m_cenital'); el.value = '3840x2160'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForFunction(() => window.__g.L().cams.cenital.modo === '3840x2160' && ![...document.querySelectorAll('#camCards [data-cam="cenital"] p.hint')].some(x => x.textContent.includes('2028 columnas')), null, { timeout: 10000, polling: 50 });
    assert.match(await p.evaluate(() => document.querySelector('#camCards > p.hint:last-of-type').textContent), /sensor «ELP ficha» \[SIN VALIDAR\]/);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
