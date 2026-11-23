// Unitario de las métricas por tarea de cada cámara (src/tareas.js, sin navegador; T4.1): estados en los bordes de cada umbral,
// píxeles de un ArUco con la fórmula estenopeica escrita aparte, entrada de la red, desenfoque, profundidad de campo contra la
// óptica de lente fina, escorzo, el peor punto, el catálogo (cada umbral sin fuente es SUPUESTO SIN VALIDAR y no cita nada) y
// la configuración editable. Las referencias son del plan (ArUco 14 px, zona fiable 32–50 px, 0,1 m/s) o salen de fórmulas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const TAREAS = require('../../src/tareas.js'), SENSOR = require('../../src/sensor.js'), ORIGEN = require('../../src/origen.js');
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);
const CFG = TAREAS.cfgDefecto();
// ELP ficha en 1920×1080 a 3,6 mm: el caso del estudio de T1.7 (mm/px a 0,5 m: 0,4306)
const W = SENSOR.de('elp-ficha').w, CAM = { w: W, f: 3.6, N: 1920, Nh: 1080 };
const geo = (prof, extra = {}) => ({ nombre: 'p', prof, c: 1, dentro: true, ...extra });

test('el plan fija el ArUco (14 px de mínimo, zona fiable de 32 a 50 px) y la bandeja a 0,1 m/s; sin esos valores no hay tareas', () => {
  assert.deepEqual([CFG.aruco.min, CFG.aruco.bien, CFG.aruco.techo], [14, 32, 50]);
  assert.equal(CFG.desenfoque.velMs, 0.1);
  assert.deepEqual(TAREAS.IDS, ['aruco', 'fruta', 'pupilas', 'mano', 'desenfoque', 'campo']);
});

test('catálogo: los umbrales del plan citan el plan; todos los demás son SUPUESTO [SIN VALIDAR]; ninguna cita inventada', () => {
  const ids = TAREAS.PARAMS.map(p => p.id); assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  for (const p of TAREAS.PARAMS) {
    if (p.origen === 'PLAN') { assert.equal(p.editable, false, `${p.id}: el plan no se edita`); assert.match(p.fuente, /ficha de T4\.1 del plan/); }
    else { assert.equal(p.origen, 'SUPUESTO', p.id); assert.equal(p.editable, true, p.id); assert.match(p.fuente, /SIN VALIDAR/, `${p.id}: ${p.fuente}`); }
    assert.ok(typeof p.valor === 'number' && p.valor > 0, p.id);
    assert.doesNotMatch(JSON.stringify(p), /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)/, `${p.id}: una cita que no se ha podido comprobar`);
  }
  assert.deepEqual(TAREAS.PARAMS.filter(p => p.origen === 'PLAN').map(p => p.id), ['aruco.min', 'aruco.bien', 'aruco.techo']);
  for (const id of TAREAS.IDS) {
    const u = TAREAS.DEF[id].umbral(CFG);
    if (id === 'aruco') assert.equal(u.origen, 'PLAN'); else { assert.equal(u.origen, 'SUPUESTO', id); assert.match(u.fuente, /SIN VALIDAR/, id); }
    const clave = TAREAS.DEF[id].clave; if (clave !== null) assert.ok(ORIGEN.CLAVES.includes(clave), `${id}: la clave ${clave} de ORIGEN existe`);
  }
});

test('clasificar: cumple desde «bien», límite desde «min»; el desenfoque, al revés; fuera de campo manda sobre el resto', () => {
  const u = { min: 14, bien: 32 };
  for (const [px, e] of [[13.99, 'no'], [14, 'limite'], [31.99, 'limite'], [32, 'ok'], [50, 'ok'], [400, 'ok'], [0, 'no']]) assert.equal(TAREAS.clasificar(px, u), e, `${px} px`);
  const d = { ok: 1, limite: 2 };
  for (const [px, e] of [[0.5, 'ok'], [1, 'ok'], [1.01, 'limite'], [2, 'limite'], [2.01, 'no']]) assert.equal(TAREAS.clasificarInv(px, d), e, `${px} px de desenfoque`);
  const s = TAREAS.evaluar('aruco', geo(0.5, { ladoMm: 60, dentro: false }), CAM, CFG);
  assert.equal(s.estado, 'fuera'); assert.ok(s.px > 100, 'los px se calculan aunque esté fuera');
});

test('ArUco de 60 mm a 0,5 m (f 3,6 mm, 1920 px, 5,952 mm): px = f·N/w · lado / z = 139,35 y los umbrales caen donde dice el plan', () => {
  const fpx = 3.6 * 1920 / 5.952; // focal en píxeles, de la proyección estenopeica
  const r = TAREAS.evaluar('aruco', geo(0.5, { ladoMm: 60 }), CAM, CFG);
  cerca(r.px, fpx * 60 / 500, 1e-9, 'px frente a la proyección estenopeica'); cerca(r.px, 139.3548, 0.001, 'px frente a la referencia calculada');
  cerca(r.mmpx, SENSOR.mmPorPx(0.5, W, 3.6, 1920), 1e-12, 'mm/px de SENSOR (T1.7), sin cambios'); assert.equal(r.estado, 'ok');
  // el mismo marcador, a la distancia que lo deja en 13,9, 14, 31,9 y 32 px
  for (const [px, e] of [[13.9, 'no'], [14, 'limite'], [31.9, 'limite'], [32, 'ok']]) assert.equal(TAREAS.evaluar('aruco', geo(fpx * 60 / px / 1000, { ladoMm: 60 }), CAM, CFG).estado, e, `${px} px`);
  // de lado, con escorzo 0,5, la mitad de píxeles
  cerca(TAREAS.evaluar('aruco', geo(0.5, { ladoMm: 60, c: 0.5 }), CAM, CFG).px, 139.3548 / 2, 0.001, 'escorzo');
});

test('fruta y mano se miden en la entrada de la red: px × entrada / máx(ancho, alto)', () => {
  cerca(TAREAS.enRed(300, 1920, 1080, 640), 100, 1e-12, '1920×1080 a 640'); cerca(TAREAS.enRed(300, 1280, 960, 192), 45, 1e-12, '1280×960 a 192');
  const fr = TAREAS.evaluar('fruta', geo(0.5), CAM, CFG), fpx = 3.6 * 1920 / 5.952;
  cerca(fr.pxImagen, fpx * 45 / 500, 1e-9, 'fruta de 45 mm en la imagen'); cerca(fr.px, fr.pxImagen * 640 / 1920, 1e-9, 'fruta en la entrada de 640');
  const ma = TAREAS.evaluar('mano', geo(0.5), CAM, CFG); cerca(ma.px, ma.pxImagen * 192 / 1920, 1e-9, 'palma en la entrada de 192');
  const pu = TAREAS.evaluar('pupilas', geo(0.5), CAM, CFG); cerca(pu.px, fpx * 63 / 500, 1e-9, 'pupilas, en la imagen'); assert.equal(pu.pxImagen, pu.px);
});

test('desenfoque = velocidad × exposición / (mm/px): 0,1 m/s y 5 ms son 0,5 mm; 1,16 px a 0,4306 mm/px es «límite»; editarlo lo cambia', () => {
  cerca(TAREAS.desenfoquePx(0.1, 5, 0.5), 1, 1e-12, '0,5 mm en 0,5 mm/px'); cerca(TAREAS.desenfoquePx(0.2, 5, 0.5), 2, 1e-12, 'al doble de velocidad');
  const r = TAREAS.evaluar('desenfoque', geo(0.5), CAM, CFG); cerca(r.px, 0.5 / (0.5 * (W / 3.6) / 1920 * 1000), 1e-9, 'px'); cerca(r.px, 1.1613, 0.0001, 'referencia'); assert.equal(r.estado, 'limite');
  assert.equal(TAREAS.evaluar('desenfoque', geo(0.5), CAM, TAREAS.fijar(CFG, 'desenfoque.velMs', 0.05)).estado, 'ok');
  assert.equal(TAREAS.evaluar('desenfoque', geo(0.5), CAM, TAREAS.fijar(CFG, 'desenfoque.velMs', 0.5)).estado, 'no');
});

test('profundidad de campo: 0,375–0,749 m con el enfoque a 0,5 m (f 3,6, F 2,8, 1 px); los límites dan el círculo de confusión con lente fina', () => {
  const c = W / 1920, f = 3.6, F = 2.8, s = 0.5, pc = TAREAS.profundidadCampo(f, F, c, s);
  cerca(pc.cerca, 0.37524, 0.001, 'cercano'); cerca(pc.lejos, 0.74903, 0.001, 'lejano'); assert.ok(pc.cerca < s && s < pc.lejos);
  // lente fina: imagen de un punto a d en v = f·d/(d − f); desenfoque en el sensor = (f/F)·|v_d − v_s| / v_d
  const v = d => f * d / (d - f), blur = d => (f / F) * Math.abs(v(d) - v(s * 1000)) / v(d);
  cerca(blur(pc.cerca * 1000), c, c * 1e-9, 'círculo en el límite cercano'); cerca(blur(pc.lejos * 1000), c, c * 1e-9, 'círculo en el límite lejano');
  assert.equal(TAREAS.profundidadCampo(f, F, c, 10).lejos, Infinity, 'enfocado más allá de la hiperfocal, el lejano es infinito');
  assert.ok(pc.hiperfocal > 1.4 && pc.hiperfocal < 1.6, `hiperfocal ${pc.hiperfocal} m`);
  // un F mayor, más campo
  assert.ok(TAREAS.profundidadCampo(f, 8, c, s).lejos - TAREAS.profundidadCampo(f, 8, c, s).cerca > pc.lejos - pc.cerca);
  const ev = TAREAS.evaluarCampo(0.5, [{ nombre: 'a', prof: 0.5 }, { nombre: 'b', prof: 0.6 }], CAM, CFG); assert.equal(ev.estado, 'ok'); assert.equal(ev.dentro, 2);
  const mitad = TAREAS.evaluarCampo(0.5, [{ nombre: 'a', prof: 0.5 }, { nombre: 'b', prof: 0.9 }], CAM, CFG); assert.equal(mitad.estado, 'limite'); assert.deepEqual(mitad.fuera, ['b']);
  assert.equal(TAREAS.evaluarCampo(0.5, [{ nombre: 'a', prof: 0.2 }, { nombre: 'b', prof: 0.9 }, { nombre: 'c', prof: 1.5 }], CAM, CFG).estado, 'no');
  assert.equal(TAREAS.evaluarCampo(0.5, [], CAM, CFG).estado, 'fuera');
});

test('geometría: profundidad a lo largo del eje, escorzo de un plano y de un segmento', () => {
  assert.equal(TAREAS.profundidad([1, 2, 3], [1, 2, 0], [0, 0, 1]), 3); assert.equal(TAREAS.profundidad([5, 0, 0], [1, 0, 0], [0, 0, 1]), 0, 'a un lado, profundidad cero');
  assert.equal(TAREAS.escorzoPlano([0, 0, -1], [0, 0, 1]), 1); cerca(TAREAS.escorzoPlano([Math.SQRT1_2, 0, -Math.SQRT1_2], [0, 0, 1]), Math.SQRT1_2, 1e-12, '45°');
  assert.equal(TAREAS.escorzoPlano([1, 0, 0], [0, 0, 1]), 0.2, 'de canto, el mínimo de la v8');
  assert.equal(TAREAS.escorzoSegmento([1, 0, 0], [0, 1, 0]), 1, 'perpendicular al rayo'); cerca(TAREAS.escorzoSegmento([Math.SQRT1_2, Math.SQRT1_2, 0], [0, 1, 0]), Math.SQRT1_2, 1e-12, 'a 45°');
  assert.equal(TAREAS.escorzoSegmento([0, 1, 0], [0, 1, 0]), 0.2, 'en la dirección del rayo, el mínimo');
});

test('el peor punto: el de menos px (el de más desenfoque); los de fuera no cuentan y todos fuera es «fuera de campo»', () => {
  const g = [geo(0.4, { nombre: 'cerca', ladoMm: 40 }), geo(0.9, { nombre: 'lejos', ladoMm: 40 }), geo(0.5, { nombre: 'fuera', ladoMm: 40, dentro: false })];
  const a = TAREAS.evaluarVarios('aruco', g, CAM, CFG); assert.equal(a.punto, 'lejos'); assert.equal(a.nFuera, 1); assert.equal(a.nPuntos, 3);
  assert.equal(a.px, TAREAS.evaluar('aruco', g[1], CAM, CFG).px);
  assert.equal(TAREAS.evaluarVarios('desenfoque', g, CAM, CFG).punto, 'cerca', 'el desenfoque es mayor cuanto más cerca');
  const todos = TAREAS.evaluarVarios('aruco', g.map(x => ({ ...x, dentro: false })), CAM, CFG); assert.equal(todos.estado, 'fuera'); assert.equal(todos.nFuera, 3);
  // un punto que no se ve (cara de espaldas) no cumple, sin px
  const e = TAREAS.evaluar('pupilas', geo(0.5, { oculto: 'la cámara ve la cara de espaldas' }), CAM, CFG); assert.equal(e.estado, 'no'); assert.equal(e.px, null); assert.match(e.nota, /espaldas/);
  // un 14 px más abajo en la misma lista cuenta como el peor aunque haya otros en «límite»
  const f = (ps) => ps.map((p, i) => geo(60 * 1161.2903 / p / 1000, { nombre: `m${i}`, ladoMm: 60 }));
  assert.equal(TAREAS.evaluarVarios('aruco', f([20, 33, 13]), CAM, CFG).punto, 'm2'); assert.equal(TAREAS.evaluarVarios('aruco', f([20, 33, 13]), CAM, CFG).estado, 'no');
});

test('configuración editable: copia, valores no válidos y fijos del plan rechazados con un error claro, y no se altera la de partida', () => {
  const n = TAREAS.fijar(CFG, 'campo.F', 4); assert.equal(n.campo.F, 4); assert.equal(CFG.campo.F, 2.8, 'la de partida no cambia'); assert.equal(n.aruco.min, 14);
  for (const v of [0, -1, NaN, Infinity, '5', null, undefined]) assert.throws(() => TAREAS.fijar(CFG, 'campo.F', v), /no es un número positivo/, String(v));
  assert.throws(() => TAREAS.fijar(CFG, 'aruco.min', 10), /lo fija el plan/); assert.throws(() => TAREAS.fijar(CFG, 'x.y', 1), /parámetro desconocido/);
  assert.throws(() => TAREAS.evaluar('campo', geo(1), CAM, CFG), /tarea desconocida/); assert.throws(() => TAREAS.evaluar('otra', geo(1), CAM, CFG), /tarea desconocida/);
});
