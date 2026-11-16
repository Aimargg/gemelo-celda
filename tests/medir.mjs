// Medidas sobre el gemelo cargado (destino artefacto, con window.__g). Las usan los tests de caracterización,
// el generador de fixtures (tests/fixtures/generar.mjs) y la línea base (tests/medidas/linea-base.mjs),
// para que el valor fijado y el valor comprobado salgan exactamente del mismo procedimiento.
import { esperarPlanes } from './navegador.mjs';

// Casos fijos de ensayo: caja/mesa × M0/M1 × balanceo 0 y 2 cm, a la velocidad por defecto. fase fija (la de la bandeja
// al empezar cada ensayo): si no se pasa, ensayo() usa Math.random(). Desde T1.2 la semilla del RRT sale de cada petición.
export const BASE = { vel: 0.25, fase: 0, sinRender: true, limite: 400 };
export const CASOS_MATRIZ = [];
for (const caja of [true, false]) for (const modo of ['M0', 'M1']) for (const amp of [0, 0.02]) CASOS_MATRIZ.push({ ...BASE, caja, modo, amp });
export const CAMPOS_MATRIZ = ['fin', 'choques', 'roces', 'pausas'];
export const nombreCaso = c => `${c.caja ? 'caja' : 'mesa'} ${c.modo} balanceo ${c.amp * 100} cm vel ${c.vel * 100} %`;

// Ejecuta los casos en orden en la página dada; devuelve el resultado de ensayo() sin el cfg y con el fallo recortado.
// Perfil de movimiento «gemelo» explícito (T1.6: sin perfil, ensayo() usa el de la escena, y la de partida es «curso»):
// la caracterización y las medidas no cambian de perfil. Un caso puede pedir otro con su propio campo perfil.
export async function ensayar(page, casos) {
  const out = [];
  for (const c of casos) {
    const t = Date.now();
    // cfg.fase es la fase de la bandeja al empezar el ensayo: ensayo() empieza con simT = 0 (H3, T1.2)
    const r = await page.evaluate(c => window.__g.ensayo({ perfil: 'gemelo', ...c }).then(r => { delete r.cfg; r.fallo = r.fallo.replace(/\s+/g, ' ').slice(0, 200); return r; }), c);
    out.push({ caso: nombreCaso(c), cfg: c, ...r, ms: Date.now() - t });
  }
  return out;
}

// Escenas v8 de referencia: cómo se preparan a partir de la disposición por defecto (se ejecutan en la página)
export const ESCENAS_V8 = [
  { id: '1-defecto', nombre: 'Disposición por defecto', descripcion: 'layoutDefecto() de la v8 sin tocar: dos platos sobre la caja de 10 cm', preparar: () => { } },
  { id: '2-sin-caja', nombre: 'Platos sobre la mesa', descripcion: 'Por defecto con la caja quitada (L.caja.on = false): los platos quedan sobre la mesa', preparar: () => { window.__g.L().caja.on = false; } },
  { id: '3-un-plato', nombre: 'Un plato, zona desplazada', descripcion: 'Pedido de un plato, zona de fruta 3 cm en +x y focal de la cenital a 4,5 mm', preparar: () => { const L = window.__g.L(); L.pedido = 1; L.zona.x += 0.03; L.cams.cenital.f = 4.5; } },
];

// Crea el código de una escena con codigoEscena() en una página recién cargada
export async function codigoDe(page, escena) {
  await page.evaluate(escena.preparar);
  return page.evaluate(nombre => { const g = window.__g; g.aplicarLayout(); document.getElementById('escNombre').value = nombre; return g.codigoEscena(); }, escena.nombre);
}

// Abre un código de escena y mide lo que I1 exige conservar: posiciones (el layout) y veredicto
// (comprobación previa tras calcular, como la guarda guardarEscena) más un ensayo M0 de la demo.
// demoCompleto: el registro entero del ensayo (t_sim, planes…), para medir la repetibilidad (tests/medidas/repetibilidad.mjs)
export async function medirEscena(page, codigo, { demoCompleto = false } = {}) {
  const abierta = await page.evaluate(c => { window.__g.abrirCodigo(c); return document.getElementById('escNom').textContent; }, codigo);
  await page.evaluate(() => window.__g.calcularPlanes('gemelo'));
  await esperarPlanes(page);
  const r = await page.evaluate(() => {
    const g = window.__g; const graves = g.comprobarPlan({ perfil: 'gemelo' }).filter(c => c.grave).map(c => c.txt);
    return { layout: JSON.parse(JSON.stringify(g.L())), veredicto: { ok: !graves.length, n: graves.length, graves }, alDia: g.planesAlDia('gemelo') };
  });
  const [d] = await ensayar(page, [{ ...BASE, modo: 'M0', amp: 0.02 }]);
  const { ms, ...todo } = d;
  return { abierta, ...r, demo: demoCompleto ? todo : Object.fromEntries(CAMPOS_MATRIZ.map(k => [k, d[k]])) };
}
