// Avisos del robot calibrado en la página (T1.4, D7), en el nivel de puerta (T2.0): aviso permanente de calibración
// sospechosa del 204 y «IK calibrada no converge» en el panel de fallos, en rutaCartesiana, en la comprobación previa y en
// la de la fruta. Movidos tal cual desde robot.test.mjs, que sigue con dibujo = colisión = TCP e I6 con el 203; el ayudante
// elegir es copia del de allí.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes } from '../navegador.mjs';

const REF = id => JSON.parse(fs.readFileSync(path.join(RAIZ, `tests/fixtures/cinematica/${id}.json`), 'utf8'));
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Pulsa el botón del robot en el selector y espera a que sea el robot activo. Si cambia el giro de base_link, el gemelo
// pregunta qué se mantiene (T1.5-3): aquí, la mesa
async function elegir(p, id) {
  await p.click(`#segRobotId [data-v="${id}"]`);
  if (await p.evaluate(() => !document.getElementById('robotPregunta').hidden)) await p.click('#rpMesa');
  await p.waitForFunction(id => window.__g.ROB.id === id && window.__g.L().robotId === id, id, { timeout: 60000, polling: 50 });
}
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);

test('T1.4-4: el 204 muestra un aviso permanente con el comando de validación; el nominal, su nota; los demás, nada', { timeout: 300000 }, async () => {
  const ref = REF('204'), validacion = ref.validacion_ros.join('\n');
  const TEXTO = 'Calibración 204 sospechosa (SIN VALIDAR): compruébala en sim_204 antes de usarla';
  const COMANDOS = ['ros2 launch launcher_robots_lab_robotica sim_204.launch.py', 'ros2 run tf2_ros tf2_echo base_link tool0'];
  for (const c of COMANDOS) assert.ok(validacion.includes(c), `el comando «${c}» es el de 204.json → validacion_ros`);
  // tool0 en base_link en la postura de arranque de sim_204 (configuraciones[1]), en mm: lo que predicen el 204 y el nominal
  const mmDe = (j, k) => [3, 7, 11].map(i => j.tool0_en_base_link[k][i] * 1000);
  assert.deepEqual(ref.configuraciones[1], [0, -1.57, 0, -1.57, 0, 0]);
  const pred = mmDe(ref, 1), nom = mmDe(REF('nominal'), 1);
  const s = await abrir(srv.url); const p = s.page;
  try {
    assert.equal(await p.textContent('#robotNota'), 'Robot sin identificar: cinemática nominal. Elige su id cuando lo sepáis.');
    assert.equal(await visible(p, '#robotAviso'), false);
    await elegir(p, '204');
    const leer = () => p.evaluate(() => ({ aviso: document.getElementById('robotAviso').textContent.replace(/\s+/g, ' '), chip: document.getElementById('chipRobot').textContent, titulo: document.getElementById('chipRobot').title }));
    let a = await leer();
    assert.equal(await visible(p, '#robotAviso'), true); assert.equal(await visible(p, '#chipRobot'), true);
    assert.ok(a.aviso.includes(TEXTO + '.'), a.aviso); assert.equal(a.titulo, TEXTO);
    for (const c of COMANDOS) assert.ok(a.aviso.includes(c), `falta «${c}» en el aviso`);
    const num = t => [...t.matchAll(/\((-?[\d,]+); (-?[\d,]+); (-?[\d,]+)\) mm/g)].map(m => m.slice(1).map(v => +v.replace(',', '.')));
    const leidos = num(a.aviso); assert.equal(leidos.length, 2, a.aviso);
    [pred, nom].forEach((v, k) => v.forEach((x, i) => assert.ok(Math.abs(leidos[k][i] - x) <= 0.05 + 1e-6, `tool0 previsto ${k ? 'nominal' : '204'}[${i}]: ${leidos[k][i]} frente a ${x} mm`))); // el aviso redondea a 0,1 mm; la FK del gemelo se aparta del JSON < 1e-6 mm (T1.4-1)
    // permanente: sigue al calcular, al cambiar de pestaña y al volver; el gemelo calcula igual con el 204 (no oculta el resultado)
    await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p);
    assert.equal(await p.evaluate(() => window.__g.planesAlDia()), true);
    await p.click('.tabs [data-tab="demo"]'); assert.equal(await visible(p, '#chipRobot'), true, 'el chip de la cabecera se ve desde otra pestaña');
    await p.click('.tabs [data-tab="escena"]'); assert.equal(await visible(p, '#robotAviso'), true);
    a = await leer(); assert.ok(a.aviso.includes(TEXTO));
    await elegir(p, '205');
    assert.equal(await visible(p, '#robotAviso'), false); assert.equal(await visible(p, '#chipRobot'), false);
    assert.match(await p.textContent('#robotNota'), /^Cinemática calibrada del robot 205 \(calibration_205\.yaml del curso\)/);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.4-5: si el objetivo tiene ramas analíticas y ninguna converge, el panel dice «IK calibrada no converge»', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await elegir(p, '204');
    // Caso buscado de forma general: el primer TCP con la pinza horizontal, en una rejilla alrededor de la base, cuya IK
    // analítica nominal tiene ramas y ninguna converge con la calibración del 204
    const r = await p.evaluate(() => {
      const g = window.__g, V = g.robot.root.position.constructor;
      for (const z of [0.25, 0.1]) for (let x = -0.5; x <= 0.5001; x += 0.025) for (let y = -0.5; y <= 0.5001; y += 0.025) for (let k = 0; k < 12; k++) for (const pitch of [0, 0.5]) {
        const pw = g.baseAMundo(x, y, z), yaw = g.marco().yawAMundo(k * Math.PI / 6), o = { horiz: true, pitch };
        if (!g.ikNoConverge(pw, yaw, o)) continue;
        const semillas = g.posesTCP(pw, yaw, o).reduce((a, T) => a + g.CIN.ikDetalle(T).semillas, 0);
        const info = g.diagnosticarPunto(pw, yaw, o); g.mostrarFalloInfo({ message: 'prueba', info }, 'No llego al punto de prueba', 'fallo');
        const lejos = g.diagnosticarPunto(new V(pw.x + 3, pw.y, pw.z), yaw, o); // control: a 3 m no hay ninguna rama
        return { semillas, causa: info.causa, txt: document.getElementById('dFallo').textContent.replace(/\s+/g, ' '), lejos: lejos.causa, txtLejos: g.explicar(lejos).porque };
      }
      return null;
    });
    assert.ok(r, 'la búsqueda encuentra un caso');
    assert.ok(r.semillas > 0, 'tiene ramas analíticas');
    assert.equal(r.causa, 'ik_calibrada');
    assert.ok(r.txt.includes('IK calibrada no converge'), r.txt);
    assert.ok(!/no llega ahí|No hay solución de cinemática inversa/.test(r.txt), 'no se explica como fuera de alcance');
    assert.equal(r.lejos, 'alcance'); assert.match(r.txtLejos, /no llega ahí/);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('corrección 3: «IK calibrada no converge» también en rutaCartesiana, en la comprobación previa y en la de la fruta', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await elegir(p, '204');
    await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p); // planes al día con el 204
    // Caso buscado como en T1.4-5: TCP con la pinza horizontal con ramas analíticas y ninguna convergida
    const r = await p.evaluate(() => {
      const g = window.__g;
      for (const z of [0.25, 0.1]) for (let x = -0.5; x <= 0.5001; x += 0.025) for (let y = -0.5; y <= 0.5001; y += 0.025) for (let k = 0; k < 12; k++) for (const pitch of [0, 0.5]) {
        const pw = g.baseAMundo(x, y, z), yaw = g.marco().yawAMundo(k * Math.PI / 6), o = { horiz: true, pitch, w: 0.006, perfil: 'gemelo' };
        if (!g.ikNoConverge(pw, yaw, o)) continue;
        // una recta cartesiana que acaba en ese punto falla ahí, con su causa y su texto
        const ruta = g.rutaCartesiana(g.robot.q.slice(), [{ p: pw, yaw }, { p: pw, yaw }], o);
        // el plan del plato 1 falla en ese punto al levantarlo (lo que daría cadenaPlato): la comprobación previa lo cuenta
        const pl = g.CACHE_PLAN.gemelo.plato1.pl; if (!g.planesAlDia() || !pl) return { sinPlan: true }; pl.cadena = { fallo: { ...ruta, fallo: `al levantarlo de la caja, ${ruta.fallo}`, fase: 'plato', etapa: 1 } };
        return { causa: ruta.causa, fallo: ruta.fallo, item: g.comprobarPlan({ perfil: 'gemelo' }).filter(c => c.grave).map(c => c.txt).join(' | ') };
      }
      return null;
    });
    assert.ok(r, 'la búsqueda encuentra un caso'); assert.ok(!r.sinPlan, 'con el 204 hay plan del plato 1 al día');
    assert.deepEqual({ causa: r.causa, fallo: r.fallo }, { causa: 'ik_calibrada', fallo: 'IK calibrada no converge' });
    assert.match(r.item, /^Plato 1º: no puedo cogerlo y levantarlo en línea recta: al levantarlo de la caja, IK calibrada no converge/);
    // el panel «La demo no puede empezar» de la demo
    const d = await p.evaluate(() => window.__g.ensayo({ vel: 0.25, fase: 0, sinRender: true, limite: 60, modo: 'M0', amp: 0, perfil: 'gemelo' }));
    assert.equal(d.fin, 'previo'); assert.match(d.fallo, /La demo no puede empezar/); assert.match(d.fallo, /IK calibrada no converge/);
    // La fruta: con las calibraciones del curso, las poses verticales de esa comprobación no dan nunca ramas sin converger
    // (búsqueda en rejilla de 5 mm en el informe), así que aquí ninguna rama converge para ninguna pose (se simula) y se
    // comprueba que la causa se distingue con causaSinIK
    const f = await p.evaluate(() => {
      const g = window.__g, C = g.CIN, det0 = C.ikDetalle, ik0 = C.ik;
      C.ikDetalle = T => { const d = det0(T); return { ...d, sols: [], descartadas: d.semillas + d.extra }; }; C.ik = T => C.ikDetalle(T).sols;
      try { return g.comprobarPlan({ perfil: 'gemelo' }).filter(c => c.grave && c.info.fase === 'fruta').map(c => c.txt); } finally { C.ikDetalle = det0; C.ik = ik0; }
    });
    assert.ok(f.length >= 1, 'la fruta no se puede coger'); for (const t of f) assert.match(t, /: IK calibrada no converge para cogerla en vertical/);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
