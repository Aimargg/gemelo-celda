// Unitario del modelo de sensor de la ELP (src/sensor.js, sin navegador; T1.7, D10): las dos opciones, el área por modo y
// las fórmulas de → camaras-colocacion «fórmulas y entradas» en 3 casos. Las referencias son las del estudio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const SENSOR = createRequire(import.meta.url)('../../src/sensor.js');
const R2D = 180 / Math.PI;
const M1080 = { w: 1920, h: 1080, fps: 120 }, M960 = { w: 1280, h: 960, fps: 120 }, M2160 = { w: 3840, h: 2160, fps: 30 };

test('dos modelos de sensor, cada uno con su origen; uno desconocido falla', () => {
  assert.deepEqual(SENSOR.NOMBRES.sort(), ['elp-ficha', 'gemelo-v8']);
  assert.deepEqual([SENSOR.de('gemelo-v8').w, SENSOR.de('gemelo-v8').h], [6.287, 4.712]);
  assert.deepEqual([SENSOR.de('elp-ficha').w, SENSOR.de('elp-ficha').h], [5.952, 4.71]);
  assert.match(SENSOR.de('elp-ficha').origen, /AFKV100.*SIN VALIDAR/); assert.match(SENSOR.de('gemelo-v8').origen, /v8/);
  assert.throws(() => SENSOR.de('otro'), /sensor desconocido/);
});

test('área por modo: ancho completo siempre; alto min(h, w·N_alto/N_ancho); nota SIN VALIDAR solo en 1080p a 120 fps', () => {
  for (const s of SENSOR.NOMBRES) {
    const m = SENSOR.de(s);
    for (const modo of [M1080, M960, M2160]) { const a = SENSOR.area(s, modo); assert.equal(a.w, m.w); assert.equal(a.h, Math.min(m.h, m.w * modo.h / modo.w)); }
    assert.match(SENSOR.area(s, M1080).nota, /2028 columnas.*escalado.*SIN VALIDAR/);
    assert.equal(SENSOR.area(s, M2160).nota, null); assert.equal(SENSOR.area(s, { w: 1920, h: 1080, fps: 30 }).nota, null);
  }
  assert.ok(Math.abs(SENSOR.area('elp-ficha', M960).h - 5.952 * 0.75) < 1e-12, '4:3 de la ficha: el alto lo limita el ancho');
  assert.equal(SENSOR.area('gemelo-v8', M960).h, 4.712, '4:3 de la v8: el alto del sensor');
});

test('T1.7-2 caso 1: HFOV a 3,6 mm, 82,3° (gemelo-v8) y 79,2° (elp-ficha)', () => {
  for (const [s, ref] of [['gemelo-v8', 82.3], ['elp-ficha', 79.2]]) {
    const w = SENSOR.de(s).w, formula = 2 * Math.atan(w / (2 * 3.6)) * R2D, h = SENSOR.hfov(w, 3.6) * R2D;
    assert.ok(Math.abs(h - formula) < 1e-12, `${s}: ${h} frente a 2·atan(w/2f) = ${formula}`);
    assert.ok(Math.abs(h - ref) < 0.05, `${s}: ${h.toFixed(2)}° frente a ${ref}° del estudio`);
  }
});

test('T1.7-2 caso 2: cenital a f 3,6 mm, 0,491 m y 1920 px: 0,447 (gemelo-v8) y 0,423 mm/px (elp-ficha)', () => {
  for (const [s, ref] of [['gemelo-v8', 0.447], ['elp-ficha', 0.423]]) {
    const w = SENSOR.de(s).w, formula = 0.491 * (w / 3.6) / 1920 * 1000, v = SENSOR.mmPorPx(0.491, w, 3.6, 1920);
    assert.ok(Math.abs(v - formula) < 1e-12, `${s}: ${v} frente a d·(w/f)/N = ${formula}`);
    assert.ok(Math.abs(v - ref) < 0.0005, `${s}: ${v.toFixed(4)} frente a ${ref} del estudio`);
  }
});

test('T1.7-2 caso 3: plano inclinado 35° a 0,62 m con f 4,5 mm y 1280 px: ÷ cos θ', () => {
  const th = 35 * Math.PI / 180, c = Math.cos(th);
  for (const s of SENSOR.NOMBRES) {
    const w = SENSOR.de(s).w, recto = 0.62 * (w / 4.5) / 1280 * 1000, formula = recto / c, v = SENSOR.mmPorPx(0.62, w, 4.5, 1280, c);
    assert.ok(Math.abs(v - formula) < 1e-12, `${s}: ${v} frente a ${formula}`);
    assert.ok(v > recto * 1.2, 'inclinado, más mm por píxel');
  }
  // el campo vertical en 16:9 sale del alto efectivo
  const a = SENSOR.area('elp-ficha', M1080); assert.ok(Math.abs(SENSOR.vfov(a.h, 3.6) - 2 * Math.atan(5.952 * 9 / 16 / 7.2)) < 1e-12);
});
