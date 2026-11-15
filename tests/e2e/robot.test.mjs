// Robot calibrado en la página (T1.4, D7): selector de robotId, aviso de calibración sospechosa, dibujo = colisión = TCP
// calculado con el base_link girado, «IK calibrada no converge» en el panel de fallos y determinismo (I6) con el 203.
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

// Pulsa el botón del robot en el selector y espera a que sea el robot activo
async function elegir(p, id) {
  await p.click(`#segRobotId [data-v="${id}"]`);
  await p.waitForFunction(id => window.__g.ROB.id === id && window.__g.L().robotId === id, id, { timeout: 60000, polling: 50 });
}
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);

test('T1.4-6: con el 203, brazo dibujado, colisión y TCP calculado coinciden y la base está girada según su mount_yaw', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await elegir(p, '203');
    const r = await p.evaluate(() => {
      const g = window.__g, yaw = g.CALIBRACION.robots['203'].mount_yaw - Math.PI, root = g.robot.root; root.updateMatrixWorld(true);
      const e = root.matrixWorld.elements; // columna x del base_link dibujado, en el mundo
      const Q = [[0, -1.57, 0, -1.57, 0, 0], [0.5, -1.2, 1.0, -1.4, -1.5, 0.3], [-1.0, -0.8, 1.5, -2.0, 1.2, -0.5], [2.0, -1.9, 1.9, -1.57, -1.57, 0], [1.2, -2.2, -1.0, 0.4, 0.9, 2.0]];
      const C = g.COL(); let tcp = 0, esf = 0;
      for (const q of Q) {
        g.robot.setQ(q); tcp = Math.max(tcp, g.tcpMundo().distanceTo(g.tcpDeQ(q).p));
        g.choqueEn(q, { sinEntorno: true, carga: null, w: g.pinza.w }); // coloca las esferas del modelo de colisión (base_link)
        for (let i = 0; i < C.N; i++) { const w = g.volCol[i].getWorldPosition(new g.robot.root.position.constructor()); esf = Math.max(esf, w.distanceTo(g.baseAMundo(C.X[i * 4], C.X[i * 4 + 1], C.X[i * 4 + 2]))); }
      }
      // un obstáculo en base_link vuelve al mismo punto del mundo: el centro del plato 1 (esferasObjeto: 8 mm sobre su base)
      const o = g.obstaculos().find(o => o.tag === 'plato:plato1'), pw = g.OBJ.plato1.localToWorld(new g.robot.root.position.constructor(0, 0, 0.008));
      const obs = g.baseAMundo(o.x, o.y, o.z).distanceTo(pw);
      // el tablero en base_link gira con la base: la pinza a 5 mm de la mesa dentro de ella choca con la mesa; fuera de ella, no
      const enMesa = (x, y) => { const q = g.ikTCP(new g.robot.root.position.constructor(x, y, 0.76 + 0.005), Math.PI / 2, null, { sinColision: true, w: 0.02 }); const c = q && g.choqueEn(q, { carga: null, w: 0.02 }); return q ? (c ? c.b : 'libre') : 'sin IK'; };
      return { rot: root.rotation.z, yaw, ejeX: [e[0], e[1]], tcp, esf, n: C.N, obs, dentro: enMesa(0.50, 0.05), fuera: enMesa(0.66, 0.05) };
    });
    assert.ok(Math.abs(r.rot - r.yaw) < 1e-12, `base girada ${r.rot} rad; mount_yaw − π = ${r.yaw}`);
    assert.ok(Math.abs(r.yaw + 3 * Math.PI / 4) < 1e-8, 'el 203 gira −135°');
    assert.ok(Math.hypot(r.ejeX[0] - Math.cos(r.yaw), r.ejeX[1] - Math.sin(r.yaw)) < 1e-12, 'eje x de base_link en el mundo');
    assert.ok(r.tcp <= 1e-5, `tcpMundo (dibujo) frente a tcpDeQ (colisión): ${r.tcp * 1000} mm`);
    assert.ok(r.esf <= 1e-5 && r.n > 100, `esferas de colisión frente a las dibujadas: ${r.esf * 1000} mm en ${r.n}`);
    assert.ok(r.obs <= 1e-9, `obstáculo del plato: ${r.obs * 1000} mm`);
    assert.deepEqual({ dentro: r.dentro, fuera: r.fuera }, { dentro: 'mesa', fuera: 'libre' });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

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

test('T1.4-7 e I6 con el 203: planificar A, B, A\' da A = A\'; cambiar de robot invalida los planes y los recalcula igual', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await elegir(p, '203');
    // 1) RRT: dos peticiones sobre la escena con el 203 (como en determinismo.test.mjs), en el orden A, B, A
    const rrt = await p.evaluate(() => {
      const g = window.__g, qa = g.qReposo(), escena = g.obstaculos().map(o => ({ ...o }));
      const peticion = (dq0, r) => { const qb = qa.slice(); qb[0] += dq0; const T = g.CIN.fk(qa.map((v, i) => (v + qb[i]) / 2)); return { qa, qb, ctx: { w: 0.06, carga: null, conBlandos: true, obst: [...escena, { t: 1, x: T[3], y: T[7], z: T[11], r, tag: 'prueba', m: 0.002, R: r }] } }; };
      const P = { A: peticion(1.2, 0.06), B: peticion(-1.0, 0.05) };
      const plan = k => { const r = g.planificar(P[k].qa.slice(), P[k].qb.slice(), { ...P[k].ctx }); return r && { plan: r.plan, ruta: r.ruta.map(q => Array.from(q)) }; };
      return { A: plan('A'), B: plan('B'), A2: plan('A') };
    });
    assert.equal(rrt.A?.plan, true, 'A necesita el RRT'); assert.equal(rrt.B?.plan, true, 'B necesita el RRT');
    assert.notDeepEqual(rrt.B.ruta, rrt.A.ruta); assert.deepEqual(rrt.A2.ruta, rrt.A.ruta, 'A\' tiene los mismos q que A');
    // 2) Planes de la escena: 203 → nominal → 203. Cada cambio deja los planes sin calcular y recalcula el modelo de colisión
    const firma = () => p.evaluate(() => {
      const g = window.__g, r = v => +(+v).toFixed(9), qs = q => q && Array.from(q, r);
      return { robot: g.ROB.id, alDia: g.planesAlDia(), pares: g.COL().desactivados, perfil: g.radioA(0.1), planes: Object.fromEntries(['plato1', 'plato2'].map(k => { const pl = g.CACHE_PLAN[k]?.pl; return [k, pl && { yaw: r(pl.yaw), pitch: r(pl.pitch), q: qs(pl.q), qPre: qs(pl.qPre), qL: qs(pl.cadena?.qL), q2: qs(pl.cadena?.pc2?.q), ruta: pl.cadena?.r?.ruta?.map(qs) }]; })) };
    });
    const calcular = async () => { await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p); return firma(); };
    const A = await calcular();
    await elegir(p, 'nominal'); const sinCalcularB = await firma();
    const B = await calcular();
    await elegir(p, '203'); const sinCalcularA = await firma();
    const A2 = await calcular();
    assert.deepEqual([sinCalcularB.alDia, sinCalcularA.alDia], [false, false], 'cambiar de robot invalida los planes');
    assert.deepEqual([A.alDia, B.alDia, A2.alDia], [true, true, true]);
    assert.ok(A.planes.plato1 && A.planes.plato1.q2, 'con el 203 hay plan completo para el plato 1');
    assert.notDeepEqual(B.planes, A.planes, 'con el nominal, otros q');
    assert.deepEqual(A2, A, 'A\' = A: mismos planes, mismo modelo de colisión y mismo perfil de alcance');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
