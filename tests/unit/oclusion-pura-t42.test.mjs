// Oclusión por el brazo (T4.2): src/oclusion.js es lógica pura (D4: sin DOM, three, red, ROS ni workers, D11) y va en los dos HTML
// construidos sin su línea de módulo; y el bloque de app.js que la usa solo LEE el plan: no llama al planificador ni a nada que
// calcule trayectorias, no escribe en CACHE_PLAN y no toca la red ni ROS (I2, I4, I6, D5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const sinComentarios = t => t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

test('D4, D11, I4: src/oclusion.js es lógica pura, se carga en un contexto vacío y está en los dos HTML construidos sin su línea de módulo', () => {
  const fuente = leer('src/oclusion.js'), codigo = sinComentarios(fuente);
  for (const g of [/\bdocument\b/, /\bwindow\b/, /\bTHREE\b/, /\bfetch\b/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bWorker\b/, /\bWebAssembly\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bROB\b/, /\bCOL\b/, /\bCOL\./, /\bL\s*[.(\[]/, /\bperformance\b/, /\bMath\.random\b/, /\bDate\b/]) assert.doesNotMatch(codigo, g, `${g}`);
  for (const r of [/\badvertise\b/, /\bpublish\b/, /\bcallService\b/, /\bsendGoal\b/, /\bsubscribe\b/]) assert.doesNotMatch(codigo, r, `I4: ${r}`);
  const m = { exports: null }; vm.runInNewContext(fuente, { module: m }); assert.equal(typeof m.exports.calcular, 'function'); assert.equal(typeof m.exports.muestrear, 'function');
  for (const f of ['dist/gemelo-celda.html', 'index.html']) {
    const h = leer(f);
    assert.ok(h.includes('const OCLUSION = (() => {'), `${f}: lleva OCLUSION`); assert.ok(!h.includes('module.exports = OCLUSION'), `${f}: sin su línea de módulo`);
    assert.ok(h.includes('OCLUSION.calcular({'), `${f}: el panel la usa`);
  }
  assert.ok(leer('dist/gemelo-celda.html').includes('oclusionPlan: () => oclusionPlan()'), 'el artefacto lleva el gancho'); assert.ok(!leer('index.html').includes('oclusionPlan: () => oclusionPlan()'), 'la web no lo lleva');
});

test('I6, D5, I2, I4: el bloque de la oclusión en app.js solo lee CACHE_PLAN: ni planifica, ni calcula trayectorias, ni escribe planes, ni guarda nada ni habla con la red', () => {
  const app = leer('src/app.js'), a = app.indexOf('// Oclusión por el brazo durante el ciclo (T4.2'), b = app.indexOf('// Ancho de banda USB (T4.3');
  assert.ok(a > 0 && b > a, 'el bloque está en app.js');
  const bloque = sinComentarios(app.slice(a, b));
  for (const r of [/\bplanPlatoCache\b/, /\bplanPlatoAsync\b/, /\bpasosPlan\b/, /\bcalcularPlanes\b/, /\bplanificar\b/, /\brrtConnect\b/, /\bplanAgarrePlato\b/, /\bcolocacionConTransporte\b/, /\brutaCartesiana\b/, /\bmoveJ\b/, /\bmoveL\b/, /\bcadenaPlato\b/, /\bsemillaDe\b/]) assert.doesNotMatch(bloque, r, `no calcula trayectorias: ${r}`);
  assert.doesNotMatch(bloque, /\bCACHE_PLAN\b/, 'solo entra por cachePlan, que lee'); assert.doesNotMatch(bloque, /cachePlan\([^)]*\)\s*\[[^\]]*\]\s*=[^=]/, 'no escribe una entrada de cachePlan');
  assert.doesNotMatch(bloque, /\.(key|pl|forz|cadena|pc2|ra|rl|ruta|largo|qL|q|qS|qU|carga)\s*=[^=]/, 'no cambia ningún campo de un plan');
  assert.doesNotMatch(bloque, /\bL\.[A-Za-z.]*\s*=[^=]/, 'no cambia la disposición'); assert.doesNotMatch(bloque, /\bguardarLocal\b|\blocalStorage\b|\bestadoParaGuardar\b|\bguardarEscena\b/, 'no guarda nada (I1, I2)');
  assert.doesNotMatch(bloque, /\bfetch\b|\bWebSocket\b|\bXMLHttpRequest\b|\bpublicar\b|\brosEspejo\b/, 'sin red ni ROS (I4)');
  assert.match(bloque, /cachePlan\(PERFIL_EXPLORA\)\[pk\]\.pl/, 'lee el plan de explorar'); assert.match(bloque, /\bsinPlan\(\)/, 'y sin plan al día no da número');
});
