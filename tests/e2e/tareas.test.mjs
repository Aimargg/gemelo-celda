// Panel por cámara con píxeles por tarea (T4.1): cada tarjeta lista las tareas de su cámara con píxeles, estado, origen del
// tamaño y el umbral con su fuente; las cifras salen de la proyección estenopeica escrita aparte en este test con la geometría
// que da la página (posición y eje de la cámara, y los marcadores y puntos de la bandeja en el mundo), y además se fijan con
// lo que da el gemelo (disposición por defecto, perfil «curso», sensor «elp-ficha»). Editar la velocidad de la bandeja cambia
// el desenfoque y «Restaurar» lo devuelve, sin tocar la escena; cambiar el sensor cambia los píxeles; la web da lo mismo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const SENS = { 'elp-ficha': 5.952, 'gemelo-v8': 6.287 }; // mm de ancho del área activa (src/sensor.js)
const TAREAS_DE = { cenital: ['fruta', 'aruco-zona', 'campo'], entrega: ['aruco-entrega', 'aruco-bandeja', 'desenfoque', 'campo'], persona: ['pupilas', 'mano', 'desenfoque', 'campo'] };
// Lo que dio el gemelo (px de cada tarea, disposición por defecto): fijado al ejecutarlo, comparado con 1e-6 relativo
const FIJADO = { 'cenital/fruta': 16.624855153530596, 'cenital/aruco-zona': 42.113563899898544, 'entrega/aruco-entrega': 74.20501058235598, 'entrega/aruco-bandeja': 11.126578296876188, 'entrega/desenfoque': 0.9447266453200528, 'persona/pupilas': 65.61260677015444, 'persona/mano': 12.066217238065946, 'persona/desenfoque': 0.7097774845921144 };
const ESTADO_FIJADO = { 'cenital/fruta': 'limite', 'cenital/aruco-zona': 'ok', 'entrega/aruco-entrega': 'ok', 'entrega/aruco-bandeja': 'no', 'entrega/desenfoque': 'ok', 'persona/pupilas': 'ok', 'persona/mano': 'no', 'persona/desenfoque': 'ok', 'cenital/campo': 'limite', 'entrega/campo': 'ok', 'persona/campo': 'ok' };

// Filas del panel de cada cámara: { cámara → { tarea → { px, estado, texto, tag } } }
const filas = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#camCards .card')].map(c => [c.dataset.cam, Object.fromEntries([...c.querySelectorAll('.tarea')].map(t => [t.dataset.tarea, { px: t.dataset.px === '' ? null : +t.dataset.px, estado: t.dataset.estado, texto: t.textContent, tag: t.querySelector('.tag').textContent }]))])));
// Geometría de la página para recalcular aparte: cámara, marcadores (lado en mm) y puntos de la bandeja en el mundo
const geometria = p => p.evaluate(() => {
  const g = window.__g, V3 = g.cam.position.constructor, v = x => [x.x, x.y, x.z], L = g.L(); g.bandeja.updateMatrixWorld(true); g.OBJ.zona.updateMatrixWorld(true);
  const wp = o => v(o.getWorldPosition(new V3())), lado = o => o.userData.lado * 1000;
  const cams = {};
  for (const k of Object.keys(g.CAMS)) { const R = g.CAMS[k]; R.cam.updateMatrixWorld(true); cams[k] = { pos: v(R.cam.position), eje: v(R.cam.getWorldDirection(new V3())), f: L.cams[k].f, N: +L.cams[k].modo.split('x')[0] }; }
  return {
    sensor: L.sensor, cams,
    zona: g.OBJ.zona.children.filter(o => o.userData.lado === 0.04).map(o => ({ p: wp(o), lado: lado(o) })),
    entrega: g.OBJ.arucoE.map(o => ({ p: wp(o), lado: lado(o) })),
    bandeja: g.bandeja.children.filter(o => o.userData.lado === 0.032).map(o => ({ p: wp(o), lado: lado(o) })),
    puntosBandeja: [[0.12, 0.17], [0.12, -0.17], [-0.12, 0.17], [-0.12, -0.17], [0, 0]].map(([u, w]) => v(new V3(u, w, 0.01).applyMatrix4(g.bandeja.matrixWorld))),
  };
});
// Proyección estenopeica, aparte de src/tareas.js: mm/px = z·(w/f)/N ÷ c, con z a lo largo del eje y c = |cos| del rayo con la vertical (mín. 0,2)
const mmpx = (G, k, p, plano) => {
  const c = G.cams[k], d = [0, 1, 2].map(i => p[i] - c.pos[i]), z = d.reduce((s, x, i) => s + x * c.eje[i], 0), n = Math.hypot(...d);
  return z * (SENS[G.sensor] / c.f) / c.N / (plano ? Math.max(0.2, Math.abs(d[2] / n)) : 1) * 1000;
};
const peorAruco = (G, k, lista) => Math.min(...lista.map(m => m.lado / mmpx(G, k, m.p, true)));
const cerca = (a, b, que) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), `${que}: ${a} frente a ${b}`);

test('T4.1-C3: las tareas de cada cámara, con sus píxeles de la proyección estenopeica, sus estados, su origen y su fuente', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('.tarea').first().waitFor();
    const F = await filas(p), G = await geometria(p);
    assert.equal(G.sensor, 'elp-ficha');
    for (const [k, ids] of Object.entries(TAREAS_DE)) assert.deepEqual(Object.keys(F[k]), ids, `tareas de la cámara ${k}`);
    // lo fijado al ejecutar el gemelo y su estado
    for (const [clave, x] of Object.entries(FIJADO)) { const [k, t] = clave.split('/'); cerca(F[k][t].px, x, clave); }
    for (const [clave, e] of Object.entries(ESTADO_FIJADO)) { const [k, t] = clave.split('/'); assert.equal(F[k][t].estado, e, `estado de ${clave}`); }
    // lo que dan las fórmulas con la geometría de la página
    assert.deepEqual([G.zona.length, G.entrega.length, G.bandeja.length, G.zona[0].lado, G.entrega[0].lado, G.bandeja[0].lado], [4, 2, 4, 40, 60, 32]);
    cerca(F.cenital['aruco-zona'].px, peorAruco(G, 'cenital', G.zona), 'ArUco de la zona (40 mm)');
    cerca(F.entrega['aruco-entrega'].px, peorAruco(G, 'entrega', G.entrega), 'ArUco de la entrega (60 mm)');
    cerca(F.entrega['aruco-bandeja'].px, peorAruco(G, 'entrega', G.bandeja), 'ArUco de la bandeja (32 mm)');
    cerca(F.entrega.desenfoque.px, Math.max(...G.puntosBandeja.map(q => 0.1 * 5 / mmpx(G, 'entrega', q, false))), 'desenfoque: 0,1 m/s × 5 ms entre mm/px');
    // los estados de ArUco: 14 px de mínimo y 32 de zona fiable (plan); 11 px no cumple, 42 y 74 sí
    for (const [k, t] of [['cenital', 'aruco-zona'], ['entrega', 'aruco-entrega'], ['entrega', 'aruco-bandeja']]) assert.equal(F[k][t].estado, F[k][t].px >= 32 ? 'ok' : F[k][t].px >= 14 ? 'limite' : 'no', `${k}/${t}`);
    // origen del tamaño y fuente del umbral: los del plan citan el plan; los demás, SUPUESTO sin validar y ninguna cita inventada
    for (const [k, ids] of Object.entries(TAREAS_DE)) for (const t of ids) {
      const f = F[k][t];
      if (t.startsWith('aruco')) { assert.match(f.texto, /≥ 14 px mínimo de OpenCV 4\.6; zona fiable de 32 a 50 px/); assert.match(f.texto, /PLAN: la cita no se ha podido comprobar/); assert.equal(f.tag, 'SUPUESTO', 'el tamaño del marcador es el del dibujo (ORIGEN «marcadores»)'); }
      else { assert.match(f.texto, /SUPUESTO SIN VALIDAR/, `${k}/${t}`); assert.equal(f.tag, 'SUPUESTO', `${k}/${t}`); }
      assert.doesNotMatch(f.texto, /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)/, `${k}/${t}: una cita no comprobada`);
    }
    assert.match(F.entrega.desenfoque.texto, /a 100 mm\/s con 5,0 ms/); assert.match(F.persona.mano.texto, /entrada de la red de palma de 192 px/); assert.match(F.cenital.fruta.texto, /entrada de la red de 640 px/);
    assert.match(F.cenital.campo.texto, /F 2,8/); assert.match(F.cenital.campo.texto, /7 de 8 objetivos dentro: fuera plato 1º/);
    // la etiqueta SIN VALIDAR del bloque y la fila de ArUco de 50 mm de la v8, sustituida
    assert.equal(await p.locator('.tareas h4').count(), 3); assert.match(await p.textContent('.tareas h4'), /Píxeles por tarea\s*SIN VALIDAR/);
    assert.equal(await p.locator('#camCards dt', { hasText: 'ArUco de 50 mm' }).count(), 0);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.1-C4: la velocidad de la bandeja es editable (0,1 m/s por defecto), cambia el desenfoque y su estado, y Restaurar lo devuelve; la escena no cambia; otro sensor cambia los píxeles', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('.tarea').first().waitFor();
    const escena = () => p.evaluate(() => JSON.stringify({ ...window.__g.L(), sensor: null }));
    const entrega = async () => (await filas(p)).entrega;
    // espera a que una fila de la cámara de entrega tenga ese valor de px
    const esperarPx = (id, x) => p.waitForFunction(({ id, x }) => { const d = document.querySelector(`.card[data-cam="entrega"] .tarea[data-tarea="${id}"]`); return d && Math.abs(+d.dataset.px - x) < 1e-6 * Math.max(1, x); }, { id, x }, { timeout: 10000, polling: 50 });
    const antes = await escena(), base = await entrega();
    // la sección está plegada: se abre como lo haría el usuario
    assert.equal(await p.evaluate(() => document.getElementById('tareasCfg').open), false); await p.click('#tareasCfg summary'); assert.equal(await p.evaluate(() => document.getElementById('tareasCfg').open), true);
    assert.equal(await p.inputValue('#tc_desenfoque\\.velMs'), '0.1'); assert.equal(await p.evaluate(() => window.__g.tareasCfg().desenfoque.velMs), 0.1);
    // 0,5 m/s: cinco veces el desenfoque, que pasa de «cumple» a «no cumple»
    await p.locator('#tc_desenfoque\\.velMs').fill('0.5'); await esperarPx('desenfoque', base.desenfoque.px * 5);
    const rapido = await entrega(); assert.equal(rapido.desenfoque.estado, 'no'); assert.equal(base.desenfoque.estado, 'ok'); assert.match(rapido.desenfoque.texto, /a 500 mm\/s con 5,0 ms/);
    cerca(rapido.desenfoque.px, base.desenfoque.px * 5, 'cinco veces la velocidad, cinco veces el desenfoque');
    assert.equal(rapido['aruco-entrega'].px, base['aruco-entrega'].px, 'los demás píxeles no cambian');
    assert.equal(await escena(), antes, 'editar un supuesto no toca la escena');
    // un valor que no es un número positivo se marca y no se aplica
    await p.locator('#tc_desenfoque\\.velMs').fill('-1'); assert.equal(await p.getAttribute('#tc_desenfoque\\.velMs', 'aria-invalid'), 'true'); assert.equal(await p.evaluate(() => window.__g.tareasCfg().desenfoque.velMs), 0.5);
    // un umbral del plan no se edita
    assert.equal(await p.isDisabled('#tc_aruco\\.min'), true);
    // Restaurar
    await p.click('#btnTareasRestaurar'); await esperarPx('desenfoque', base.desenfoque.px);
    assert.equal(await p.inputValue('#tc_desenfoque\\.velMs'), '0.1'); assert.equal((await entrega()).desenfoque.estado, 'ok'); assert.equal(await escena(), antes);
    // otro sensor (6,287 mm, el de la v8): menos píxeles por mm, en la razón de los anchos
    await p.click('#segSensor [data-v="gemelo-v8"]');
    await esperarPx('aruco-entrega', base['aruco-entrega'].px * SENS['elp-ficha'] / SENS['gemelo-v8']);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.1-C3 en la web: el mismo panel, con las mismas cifras, y sin la fila de la v8', { timeout: 300000 }, async () => {
  const a = await abrir(srv.url); let ref;
  try { await a.page.click('.tabs [data-tab="camaras"]'); await a.page.locator('.tarea').first().waitFor(); ref = await filas(a.page); } finally { await a.cerrar(); }
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), p = s.page;
  try {
    assert.equal(await p.evaluate(() => typeof window.__g), 'undefined', 'la web no lleva el gancho de pruebas');
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('.tarea').first().waitFor();
    const F = await filas(p);
    for (const [k, ids] of Object.entries(TAREAS_DE)) { assert.deepEqual(Object.keys(F[k]), ids); for (const t of ids) { cerca(F[k][t].px ?? 0, ref[k][t].px ?? 0, `web ${k}/${t}`); assert.equal(F[k][t].estado, ref[k][t].estado); } }
    assert.equal(await p.locator('#camCards dt', { hasText: 'ArUco de 50 mm' }).count(), 0);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
