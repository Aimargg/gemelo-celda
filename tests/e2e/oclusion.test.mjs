// Oclusión por el brazo durante el ciclo (T4.2): el bloque «Oclusión por el brazo durante el ciclo» de cada tarjeta de cámara, con una
// fila por objetivo (los de las tareas de T4.1): porcentaje del ciclo con todo el objetivo tapado y con algún punto tapado, racha y
// SIN VALIDAR. Las cifras se fijan con lo que da el gemelo (disposición por defecto, robot B, perfil «gemelo», plan de «Calcular») y,
// además, se recalculan en la página con fórmulas escritas aparte (muestreo por tiempo, la interpolación de ejecutar(), las esferas de
// colisión que da colocar() y la ecuación de segundo grado del rayo contra la esfera, no la distancia al segmento del módulo). Solo
// lee: abrir la pestaña y cambiar un supuesto no toca ninguna entrada de CACHE_PLAN; sin plan al día dice «sin plan» y no da número.
// El brazo tapa a propósito (la mano de la cámara de la persona, 49,5 %) y no tapa (la misma cámara más lejos, 0 %); con la mitad del
// paso el resultado cambia menos de 2 puntos; paso y margen son editables, se restauran y un valor malo se marca y no se aplica.
// Tiempos medidos: el plan se calcula en decenas de ms (la cota de la ficha son 2 s) y cada test dura menos de 3 min.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const TAB = '.tabs [data-tab="camaras"]';
const OBJETIVOS = { cenital: ['fruta', 'aruco-zona'], entrega: ['aruco-entrega', 'aruco-bandeja', 'desenfoque'], persona: ['pupilas', 'mano'] };
// Lo que dio el gemelo (disposición por defecto, paso 0,1 s, margen 20 mm): [puntos en el campo, % todo tapado, % algún punto, racha (s)]
const FIJADO = {
  'cenital/fruta': [6, 0, 15.187677280975947, 0], 'cenital/aruco-zona': [4, 0, 16.76926640218787, 0],
  'entrega/aruco-entrega': [2, 0, 4.626447281133055, 0], 'entrega/aruco-bandeja': [4, 1.0145748286949945, 48.340796400198975, 0.49904788482143386], 'entrega/desenfoque': [5, 0.7245545628391493, 48.89313300453466, 0.49904788482143386],
  'persona/pupilas': [1, 0, 0, 0], 'persona/mano': [1, 49.500780019337206, 49.500780019337206, 18.528480855007786],
};
const MUESTRAS = 694, T_CICLO = 68.87650846692993; // 10 tramos (5 por plato), 694 muestras de 0,1 s como mucho y 68,9 s de ciclo
// Con el paso a la mitad (0,05 s), con el margen en 200 mm y con el paso en 0,5 s: [puntos, todo, algún punto] de lo que cambia
const MITAD = { muestras: 1383, 'cenital/fruta': 15.234751952384553, 'entrega/aruco-bandeja': 48.48575692294568, 'persona/mano': 49.50073040915589 };
const MARGEN200 = { 'cenital/fruta': 14.633878665600312, 'entrega/aruco-bandeja': 44.80481248902985 };
const PASO05 = { muestras: 142, 'cenital/fruta': 14.60072650510211, 'entrega/aruco-bandeja': 48.000661163300414 };

const cerca = (a, b, que, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${que}: ${a} frente a ${b}`);
// Filas del panel: { cámara → { objetivo → { puntos, todo, alguno, racha, texto, pill } } } (todo y alguno, en %; null = fuera de campo)
const filas = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#camCards .oclu')].map(c => [c.dataset.oclu, Object.fromEntries([...c.querySelectorAll('.ocl-fila')].map(f => {
  const n = x => f.dataset[x] === '' ? null : +f.dataset[x];
  return [f.dataset.obj, { puntos: +f.dataset.puntos, todo: n('todo'), alguno: n('alguno'), racha: n('racha'), texto: f.textContent, pill: f.querySelector('.pill').className }];
}))])));
const esperarFilas = p => p.locator('#camCards .ocl-fila').first().waitFor();
const estadoOcl = p => p.evaluate(() => { const g = window.__g, r = g.oclusionPlan(); return r.sin || r.error ? { sin: r.sin, error: r.error } : { muestras: r.r.muestras, T: r.r.T, ms: r.ms, calculos: g.ocluEstado().calculos, tramos: r.tramos }; });
// Pone el paso y el margen por sus campos, como lo haría el usuario, y espera a que el panel los diga
async function poner(p, paso, margen) {
  if (!(await p.evaluate(() => document.getElementById('ocluCfg').open))) await p.click('#ocluCfg summary');
  await p.locator('#oc_muestreo\\.paso').fill(String(paso)); await p.locator('#oc_rayo\\.margenMm').fill(String(margen));
  await p.waitForFunction(({ paso, margen }) => { const c = window.__g.ocluCfg(), t = document.querySelector('#camCards .oclu .hint[data-estado="calculado"]'); return c.muestreo.paso === paso && c.rayo.margenMm === margen && t && t.textContent.includes(`paso de ${paso.toFixed(2).replace('.', ',')} s, margen de ${margen.toFixed(0)} mm`); }, { paso, margen }, { timeout: 15000, polling: 50 });
}
// El mismo cálculo de la cámara k escrito aparte del módulo: muestras por tiempo (n = ⌈T / paso⌉, peso T / n), la postura de ejecutar()
// (perfil smooth sobre el recorrido acumulado), las esferas de colocar() y un rayo de la cámara al punto menos el margen contra cada
// esfera con la ecuación de segundo grado. Los tramos son los del plan, y los puntos de cada objetivo, los de tareasCam (T4.1)
const independiente = (p, k, paso, margenMm) => p.evaluate(({ k, paso, margenMm }) => {
  const g = window.__g, mb = g.marco(), aB = x => mb.aBase(x[0], x[1], x[2]), tramos = g.tramosOclusion().tramos;
  const cp = g.CAMS[k].cam.position, o = aB([cp.x, cp.y, cp.z]), marg = margenMm / 1000;
  const objs = g.tareasCam(k).tareas.filter(t => !(k === 'persona' && t.id === 'desenfoque')).map(t => ({ id: t.clave, pts: t.geos.filter(q => q.dentro && !q.oculto).map(q => aB(q.p)) }));
  const tapa = (P, X, n) => {
    const d = [P[0] - o[0], P[1] - o[1], P[2] - o[2]], L = Math.hypot(...d), e = d.map(v => v * (L - marg) / L), a = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
    for (let i = 0; i < n; i++) {
      const c = [X[4 * i] - o[0], X[4 * i + 1] - o[1], X[4 * i + 2] - o[2]], r = X[4 * i + 3];
      const b = -2 * (e[0] * c[0] + e[1] * c[1] + e[2] * c[2]), cc = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] - r * r, disc = b * b - 4 * a * cc;
      if (disc <= 0) continue; const s = Math.sqrt(disc); if ((-b - s) / (2 * a) < 1 && (-b + s) / (2 * a) > 0) return true;
    }
    return false;
  };
  const acc = objs.map(() => ({ tot: 0, todo: 0, alg: 0, racha: 0, max: 0 })); let T = 0, N = 0;
  for (const tr of tramos) {
    const n = Math.ceil(tr.T / paso - 1e-9);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n * tr.T, w = tr.T / n, s = t / tr.T, u = (3 * s * s - 2 * s * s * s) * tr.S;
      let m = 1; while (m < tr.acum.length - 1 && tr.acum[m] < u) m++;
      const f = Math.min(1, Math.max(0, (u - tr.acum[m - 1]) / (tr.acum[m] - tr.acum[m - 1]))), q = tr.ruta[m - 1].map((v, i) => v + (tr.ruta[m][i] - v) * f);
      const nn = g.colocar(q, tr.w, tr.carga), X = g.COL().X; T += w; N++;
      objs.forEach((ob, i) => {
        if (!ob.pts.length) return; const a2 = acc[i], c2 = ob.pts.filter(P => tapa(P, X, nn)).length;
        a2.tot += w; if (c2 === ob.pts.length) { a2.todo += w; a2.racha += w; a2.max = Math.max(a2.max, a2.racha); } else a2.racha = 0; if (c2) a2.alg += w;
      });
    }
  }
  return { N, T, objs: Object.fromEntries(objs.map((ob, i) => [ob.id, ob.pts.length ? [ob.pts.length, 100 * acc[i].todo / acc[i].tot, 100 * acc[i].alg / acc[i].tot, acc[i].max] : [0, null, null, null]])) };
}, { k, paso, margenMm });

test('T4.2-C3 y C1: una fila por objetivo en cada cámara con lo que dio el gemelo, igual que el cálculo aparte; SIN VALIDAR y sin umbral; plan en decenas de ms', { timeout: 180000 }, async t => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const dentro = Date.now(); await p.click(TAB); await esperarFilas(p);
    const F = await filas(p);
    assert.deepEqual(Object.keys(F), Object.keys(OBJETIVOS)); for (const [k, ids] of Object.entries(OBJETIVOS)) assert.deepEqual(Object.keys(F[k]), ids, `objetivos de la cámara ${k}`);
    // lo fijado al ejecutar el gemelo
    for (const [clave, v] of Object.entries(FIJADO)) {
      const [k, o] = clave.split('/'), f = F[k][o]; assert.equal(f.puntos, v[0], `puntos de ${clave}`);
      cerca(f.todo, v[1], `todo tapado de ${clave}`, 1e-9); cerca(f.alguno, v[2], `algún punto de ${clave}`, 1e-9); cerca(f.racha, v[3], `racha de ${clave}`, 1e-9);
    }
    const E = await estadoOcl(p); assert.equal(E.muestras, MUESTRAS); cerca(E.T, T_CICLO, 'duración del ciclo', 1e-9);
    assert.deepEqual(E.tramos, ['acercar', 'levantar', 'llevar', 'salir', 'subir', 'acercar', 'levantar', 'llevar', 'salir', 'subir'], 'cinco tramos por plato, en el orden de la demo');
    // el cálculo aparte da lo mismo en cada cámara y objetivo
    for (const k of Object.keys(OBJETIVOS)) {
      const I = await independiente(p, k, 0.1, 20); assert.equal(I.N, MUESTRAS, `muestras de ${k}`); cerca(I.T, T_CICLO, `T de ${k}`, 1e-9);
      for (const [o, v] of Object.entries(I.objs)) { const f = F[k][o]; assert.equal(f.puntos, v[0], `${k}/${o}: puntos`); for (const [i, c] of [[1, 'todo'], [2, 'alguno'], [3, 'racha']]) cerca(f[c], v[i], `${k}/${o}: ${c} frente al cálculo aparte`, 1e-9); }
    }
    // el brazo tapa a propósito: la cámara de la persona lo tiene delante de la mano durante la mitad del ciclo; una cámara lejos del brazo no ve nada tapado
    assert.ok(F.persona.mano.todo > 49 && F.persona.mano.racha > 18, 'la mano, tapada casi la mitad del ciclo y 18 s seguidos'); assert.equal(F.persona.pupilas.alguno, 0); assert.equal(F.entrega['aruco-entrega'].todo, 0);
    // texto: etiqueta SIN VALIDAR, nota de qué tramos entran, sin umbral (la etiqueta es neutra) y ninguna cita inventada
    assert.equal(await p.locator('#camCards .oclu h4').count(), 3); for (const h of await p.locator('#camCards .oclu h4').allTextContents()) assert.match(h, /Oclusión por el brazo durante el transporte de los platos\s*SIN VALIDAR/);
    for (const k of Object.keys(OBJETIVOS)) for (const [o, f] of Object.entries(F[k])) {
      assert.match(f.texto, /todo tapado \d+,\d % · algún punto \d+,\d %/, `${k}/${o}`); assert.match(f.texto, /racha más larga con todo tapado: \d+,\d s/); assert.equal(f.pill, 'pill', 'sin umbral de cumple o no cumple: etiqueta neutra');
    }
    const nota = await p.locator('#camCards .oclu .hint[data-estado="calculado"]').first().textContent();
    assert.match(nota, /694 muestras en 68,9 s de ciclo \(paso de 0,10 s, margen de 20 mm\)/); assert.match(nota, /Tramos de cada plato que entran en el ciclo: acercarse al borde del plato \(recta de 7 cm\), levantarlo \(recta de 8 cm\), llevarlo nivelado a la bandeja, salir de la bandeja/);
    assert.match(nota, /No entran: el movimiento articular desde el reposo, la fruta, el servo de la bajada hasta la bandeja ni el balanceo de la bandeja/); assert.match(nota, /SUPUESTO SIN VALIDAR/); assert.match(nota, /Sin umbral de cumple o no cumple: no hay fuente/);
    assert.doesNotMatch(nota, /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)/, 'una cita no comprobada');
    // repintar el panel (la demo lo hace cada 0,8 s) no recalcula: otro supuesto, el de la velocidad de la bandeja, repinta las tarjetas
    const antes = await estadoOcl(p); await p.click('#tareasCfg summary'); await p.locator('#tc_desenfoque\\.velMs').fill('0.5');
    await p.waitForFunction(() => /a 500 mm\/s/.test(document.querySelector('.card[data-cam="entrega"] .tarea[data-tarea="desenfoque"]').textContent), null, { timeout: 10000, polling: 50 });
    const despues = await estadoOcl(p); assert.equal(despues.calculos, antes.calculos, 'repintar no recalcula'); assert.deepEqual(await filas(p), F);
    // tiempos (b): el plan, muestreado cada 0,1 s y cada 0,05 s, tarda como mucho 2 s con SwiftShader (decenas de ms medidas)
    await poner(p, 0.05, 20); const fino = await estadoOcl(p); assert.equal(fino.muestras, MITAD.muestras);
    t.diagnostic(`oclusión del plan entero: ${E.ms.toFixed(1)} ms con ${E.muestras} muestras (paso 0,1 s) y ${fino.ms.toFixed(1)} ms con ${fino.muestras} (paso 0,05 s); con la página abierta, ${((Date.now() - dentro) / 1000).toFixed(1)} s en total`);
    assert.ok(E.ms < 2000 && fino.ms < 2000, `el plan tarda ${E.ms} y ${fino.ms} ms: más de 2 s`);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.2-C2: solo lee (abrir la pestaña y cambiar un supuesto no tocan CACHE_PLAN, L, firmaVal ni D.planes); sin plan al día dice «sin plan» y no da número', { timeout: 180000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    // las entradas de CACHE_PLAN de explorar (sus objetos y todo su contenido, también las rutas de la cadena), L, firmaVal y D.planes
    const foto = () => p.evaluate(() => {
      const g = window.__g, h = o => JSON.stringify(o, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v), C = g.CACHE_PLAN.gemelo;
      window.__ent = window.__ent || { plato1: C.plato1, plato2: C.plato2 };
      return { mismas: ['plato1', 'plato2'].map(k => C[k] === window.__ent[k] && C[k].pl === window.__ent[k].pl && C[k].pl.cadena === window.__ent[k].pl.cadena), claves: Object.keys(C), contenido: h(C), L: JSON.stringify(g.L()), firma: g.firmaVal(), planes: g.D.planes, calculando: g.CALC.activo, alDia: g.planesAlDia(), tieneRa: !!C.plato1.pl.cadena.ra && !!C.plato1.pl.cadena.rl };
    });
    const f0 = await foto(); assert.equal(f0.alDia, true); assert.equal(f0.tieneRa, true, 'el plan guarda las dos rectas de antes del transporte (acercarse y levantar)');
    await p.click(TAB); await esperarFilas(p); const base = await filas(p);
    const igual = async que => { const f = await foto(); assert.deepEqual(f.mismas, [true, true], `${que}: las entradas de CACHE_PLAN son las mismas`); for (const c of ['claves', 'contenido', 'L', 'firma', 'planes', 'calculando']) assert.deepEqual(f[c], f0[c], `${que}: ${c}`); };
    await igual('al abrir la pestaña');
    // cambiar los supuestos de la oclusión (paso, margen, restaurar) y uno de las tareas
    await poner(p, 0.2, 100); await igual('con otro paso y margen'); assert.notDeepEqual(await filas(p), base);
    await p.click('#btnOcluRestaurar'); await p.waitForFunction(() => window.__g.ocluCfg().muestreo.paso === 0.1 && window.__g.ocluCfg().rayo.margenMm === 20, null, { timeout: 10000, polling: 50 });
    await igual('tras restaurar'); assert.deepEqual(await filas(p), base);
    // ninguna escena nueva: los supuestos no están en la disposición (I1, I2)
    assert.doesNotMatch(f0.L, /oclu|paso|margen/i, 'la disposición no lleva campos de la oclusión');
    // sin plan al día: se mueve el plato 1 sin calcular (como al arrastrarlo): el panel dice «sin plan» y no da ningún número, y no calcula
    await p.evaluate(() => { const g = window.__g; window.__x0 = g.L().plato1.x; g.L().plato1.x += 0.01; g.recalcular(); });
    await p.waitForFunction(() => document.querySelectorAll('#camCards .oclu [data-estado="sin-plan"]').length === 3, null, { timeout: 10000, polling: 50 });
    assert.equal(await p.locator('#camCards .ocl-fila').count(), 0, 'ninguna fila: ningún número'); assert.equal(await p.locator('#camCards .oclu [data-todo]').count(), 0);
    assert.match(await p.locator('#camCards .oclu').first().textContent(), /sin plan: pulsa «Calcular trayectorias»/);
    const sin = await p.evaluate(() => { const g = window.__g, r = g.oclusionPlan(); return { sin: r.sin, calculando: g.CALC.activo, alDia: g.planesAlDia(), planes: g.D.planes, mismas: g.CACHE_PLAN.gemelo.plato1 === window.__ent.plato1 && g.CACHE_PLAN.gemelo.plato2 === window.__ent.plato2 }; });
    assert.match(sin.sin, /^sin plan/); assert.deepEqual([sin.calculando, sin.alDia, sin.planes, sin.mismas], [false, false, f0.planes, true], 'mirar la oclusión sin plan no planifica nada');
    // al devolver el plato a su sitio, el plan de antes vuelve a estar al día (la clave es la misma) y las cifras son las de antes, sin calcular nada
    await p.evaluate(() => { const g = window.__g; g.L().plato1.x = window.__x0; g.recalcular(); });
    await esperarFilas(p); assert.deepEqual(await filas(p), base, 'las mismas cifras'); await igual('tras devolver el plato');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.2-C2 con la demo a medias: el resultado es el de la escena de partida (no depende de dónde esté la demo, ni de que la persona se haya apartado) y la demo queda como estaba', { timeout: 180000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click(TAB); await esperarFilas(p); const base = await filas(p);
    await p.click('.tabs [data-tab="demo"]'); await p.click('#dPlay');
    await p.waitForFunction(() => window.__g.D.playing && window.__g.D.paso >= 1, null, { timeout: 120000, polling: 100 });
    await p.click('#dPlay'); // en pausa, con el brazo fuera del reposo y la persona apartada
    const demo = () => p.evaluate(() => { const g = window.__g, C = g.CACHE_PLAN.gemelo; window.__ent = window.__ent || { plato1: C.plato1, plato2: C.plato2 }; return JSON.stringify({ paso: g.D.paso, playing: g.D.playing, off: g.D.personaOff, q: g.robot.q, w: g.pinza.w, planes: g.D.planes, sinCalcular: !g.CALC.activo, mismas: C.plato1 === window.__ent.plato1 && C.plato2 === window.__ent.plato2, persona: g.OBJ.plato1.parent === g.scene }); });
    const antes = await demo(); assert.ok(JSON.parse(antes).off > 0.1, 'la persona se ha apartado'); assert.equal(JSON.parse(antes).playing, false);
    await p.click(TAB); await esperarFilas(p);
    await poner(p, 0.2, 20); const otro = await filas(p); assert.notDeepEqual(otro, base, 'con otro paso, otras cifras'); assert.equal(JSON.stringify(await estadoOcl(p)).includes('"error"'), false);
    await poner(p, 0.1, 20); assert.deepEqual(await filas(p), base, 'con la demo en pausa, las mismas cifras que con la escena de partida'); assert.equal(await demo(), antes, 'la demo, el brazo y los planes quedan como estaban');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.2-C4 y C5: el brazo tapa donde cruza el rayo y no donde no; con la mitad del paso cambia menos de 2 puntos; paso y margen se editan, se restauran y un valor malo no se aplica', { timeout: 180000 }, async t => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await p.click(TAB); await esperarFilas(p); const base = await filas(p);
    // C4, convergencia: con el paso a la mitad (0,05 s) cada porcentaje cambia menos de 2 puntos
    await poner(p, 0.05, 20); const fino = await filas(p), E = await estadoOcl(p); assert.equal(E.muestras, MITAD.muestras);
    let peor = 0;
    for (const k of Object.keys(OBJETIVOS)) for (const o of OBJETIVOS[k]) for (const c of ['todo', 'alguno']) { const d = Math.abs(fino[k][o][c] - base[k][o][c]); peor = Math.max(peor, d); assert.ok(d <= 2, `${k}/${o}/${c}: ${base[k][o][c]} → ${fino[k][o][c]}`); }
    t.diagnostic(`con la mitad del paso, el porcentaje cambia como mucho ${peor.toFixed(3)} puntos`);
    cerca(fino.cenital.fruta.alguno, MITAD['cenital/fruta'], 'fruta con paso 0,05', 1e-9); cerca(fino.entrega['aruco-bandeja'].alguno, MITAD['entrega/aruco-bandeja'], 'bandeja con paso 0,05', 1e-9); cerca(fino.persona.mano.todo, MITAD['persona/mano'], 'mano con paso 0,05', 1e-9);
    // C5: otro paso y otro margen cambian el resultado y Restaurar lo devuelve; los campos dicen lo que hay
    await poner(p, 0.5, 20); const grueso = await filas(p); assert.equal((await estadoOcl(p)).muestras, PASO05.muestras);
    cerca(grueso.cenital.fruta.alguno, PASO05['cenital/fruta'], 'fruta con paso 0,5', 1e-9); cerca(grueso.entrega['aruco-bandeja'].alguno, PASO05['entrega/aruco-bandeja'], 'bandeja con paso 0,5', 1e-9);
    assert.notEqual(grueso.cenital.fruta.alguno, base.cenital.fruta.alguno, 'el paso cambia el resultado');
    await poner(p, 0.1, 200); const ancho = await filas(p);
    cerca(ancho.cenital.fruta.alguno, MARGEN200['cenital/fruta'], 'fruta con margen 200 mm', 1e-9); cerca(ancho.entrega['aruco-bandeja'].alguno, MARGEN200['entrega/aruco-bandeja'], 'bandeja con margen 200 mm', 1e-9);
    assert.ok(ancho.cenital.fruta.alguno < base.cenital.fruta.alguno && ancho.entrega['aruco-bandeja'].alguno < base.entrega['aruco-bandeja'].alguno, 'más margen acorta el segmento: tapa menos'); assert.equal(ancho.persona.mano.todo, base.persona.mano.todo, 'lo que no depende del margen no cambia');
    assert.equal((await estadoOcl(p)).muestras, MUESTRAS, 'el margen no cambia las muestras');
    // un valor que no es un número positivo, o que se sale del rango, se marca y no se aplica; uno bueno quita la marca
    const cfg = () => p.evaluate(() => JSON.stringify(window.__g.ocluCfg())), inv = id => p.getAttribute(`#oc_${id.replace('.', '\\.')}`, 'aria-invalid');
    for (const [id, malo] of [['muestreo.paso', '-1'], ['muestreo.paso', '0'], ['muestreo.paso', '0.001'], ['muestreo.paso', '3'], ['rayo.margenMm', '-5'], ['rayo.margenMm', '0'], ['rayo.margenMm', '600']]) {
      await p.locator(`#oc_${id.replace('.', '\\.')}`).fill(malo); assert.equal(await inv(id), 'true', `${id} = ${malo}`); assert.equal(await cfg(), JSON.stringify({ muestreo: { paso: 0.1 }, rayo: { margenMm: 200 } }), `${id} = ${malo} no se aplica`);
      await p.locator(`#oc_${id.replace('.', '\\.')}`).fill(id === 'muestreo.paso' ? '0.1' : '200'); assert.equal(await inv(id), null, 'un valor bueno quita la marca');
    }
    assert.deepEqual(await filas(p), ancho, 'los valores malos no cambian el panel');
    await p.click('#btnOcluRestaurar'); await p.waitForFunction(() => window.__g.ocluCfg().rayo.margenMm === 20, null, { timeout: 10000, polling: 50 });
    assert.equal(await p.inputValue('#oc_muestreo\\.paso'), '0.1'); assert.equal(await p.inputValue('#oc_rayo\\.margenMm'), '20'); assert.deepEqual(await filas(p), base, 'Restaurar devuelve las cifras de partida');
    // C4, el 0 %: se aleja la cámara de la persona del brazo (de x = 0,30 a 1,25 m): el brazo ya no cruza el rayo a la mano y el porcentaje es 0
    assert.ok(base.persona.mano.todo > 49 && base.persona.mano.alguno > 49, 'antes: el brazo tapa la mano');
    await p.evaluate(() => { const g = window.__g, L = g.L(); Object.assign(L.cams.persona.pos, { x: 1.25, y: -0.4, z: 1.25 }); g.actualizarCam('persona'); g.recalcular(); });
    await p.waitForFunction(() => document.querySelectorAll('#camCards .oclu [data-estado="sin-plan"]').length === 3, null, { timeout: 10000, polling: 50 }); // las cámaras son obstáculos del plan: hay que calcular
    const t0 = Date.now(); await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p); await esperarFilas(p);
    t.diagnostic(`Calcular con la cámara movida: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const libre = await filas(p), m0 = libre.persona.mano; assert.deepEqual([m0.puntos, m0.todo, m0.alguno, m0.racha], [1, 0, 0, 0], 'la mano, a la vista y sin tapar: 0 %');
    assert.deepEqual(libre.cenital, base.cenital, 'las otras cámaras no cambian'); assert.deepEqual(libre.entrega, base.entrega);
    const I = await independiente(p, 'persona', 0.1, 20); assert.deepEqual([I.objs.mano[0], I.objs.mano[1], I.objs.mano[2], I.objs.mano[3]], [1, 0, 0, 0], 'el cálculo aparte también da 0 %');
    // a medio camino (x = 0,9 m) el brazo tapa solo una parte: la cifra intermedia sale del gemelo
    await p.evaluate(() => { const g = window.__g, L = g.L(); L.cams.persona.pos.x = 0.9; g.actualizarCam('persona'); g.recalcular(); });
    await p.evaluate(() => window.__g.calcularPlanes()); await esperarPlanes(p); await esperarFilas(p);
    const medio = await filas(p); cerca(medio.persona.mano.todo, 13.189274332314726, 'mano con la cámara a 0,9 m', 1e-9); cerca(medio.persona.mano.racha, 3.593144770714322, 'racha', 1e-9);
    assert.equal(medio.persona.pupilas.puntos, 0, 'de esa cámara no se ve la cara'); assert.equal(medio.persona.pupilas.todo, null); assert.match(medio.persona.pupilas.texto, /fuera de campo/);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.2-C3 en la web: el mismo bloque con las mismas cifras, sin el gancho de pruebas', { timeout: 180000 }, async () => {
  const a = await abrir(srv.url); let ref;
  try { await a.page.click(TAB); await esperarFilas(a.page); ref = await filas(a.page); } finally { await a.cerrar(); }
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), p = s.page;
  try {
    assert.equal(await p.evaluate(() => typeof window.__g), 'undefined', 'la web no lleva el gancho de pruebas');
    await p.click(TAB); await esperarFilas(p); const F = await filas(p);
    assert.deepEqual(Object.keys(F), Object.keys(OBJETIVOS));
    for (const k of Object.keys(OBJETIVOS)) { assert.deepEqual(Object.keys(F[k]), OBJETIVOS[k]); for (const o of OBJETIVOS[k]) assert.deepEqual(F[k][o], ref[k][o], `web ${k}/${o}`); }
    assert.equal(await p.locator('#camCards .oclu h4').count(), 3); assert.match(await p.locator('#camCards .oclu h4').first().textContent(), /Oclusión por el brazo durante el transporte de los platos\s*SIN VALIDAR/);
    assert.match(await p.locator('#camCards .oclu .hint[data-estado="calculado"]').first().textContent(), /694 muestras en 68,9 s de ciclo \(paso de 0,10 s, margen de 20 mm\)/);
    // los supuestos, también en la web: plegados, con su etiqueta y editables
    await p.click('#ocluCfg summary'); assert.equal(await p.inputValue('#oc_muestreo\\.paso'), '0.1'); assert.equal(await p.inputValue('#oc_rayo\\.margenMm'), '20');
    await p.locator('#oc_muestreo\\.paso').fill('0.5'); await p.waitForFunction(() => /142 muestras/.test(document.querySelector('#camCards .oclu .hint[data-estado="calculado"]').textContent), null, { timeout: 15000, polling: 50 });
    await p.click('#btnOcluRestaurar'); await p.waitForFunction(() => /694 muestras/.test(document.querySelector('#camCards .oclu .hint[data-estado="calculado"]').textContent), null, { timeout: 15000, polling: 50 });
    assert.deepEqual(await filas(p), F);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
