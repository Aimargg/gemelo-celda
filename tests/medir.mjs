// Medidas sobre el gemelo cargado (destino artefacto, con window.__g). Las usan los tests de caracterización,
// el generador de fixtures (tests/fixtures/generar.mjs) y la línea base (tests/medidas/linea-base.mjs),
// para que el valor fijado y el valor comprobado salgan exactamente del mismo procedimiento.
import { esperarPlanes } from './navegador.mjs';

// Casos fijos de ensayo: caja/mesa × M0/M1 × balanceo 0 y 2 cm, a la velocidad por defecto. fase fija: si no se pasa,
// ensayo() usa Math.random(). El orden importa (SEMILLA global del RRT, colision.js), así que no se cambia.
export const BASE = { vel: 0.25, fase: 0, sinRender: true, limite: 400 };
export const CASOS_MATRIZ = [];
for (const caja of [true, false]) for (const modo of ['M0', 'M1']) for (const amp of [0, 0.02]) CASOS_MATRIZ.push({ ...BASE, caja, modo, amp });
export const CAMPOS_MATRIZ = ['fin', 'choques', 'roces', 'pausas'];
export const nombreCaso = c => `${c.caja ? 'caja' : 'mesa'} ${c.modo} balanceo ${c.amp * 100} cm vel ${c.vel * 100} %`;

// Ejecuta los casos en orden en la página dada; devuelve el resultado de ensayo() sin el cfg y con el fallo recortado
export async function ensayar(page, casos) {
  const out = [];
  for (const c of casos) {
    const t = Date.now();
    const r = await page.evaluate(c => {
      // La bandeja se mueve con BALANCEO(simT + fase) y simT avanza con el reloj real mientras la página espera
      // (bucle(): «else if (!D.activo) simT += dt»). Para que «fase» sea la fase al empezar el ensayo, y no dependa
      // de cuánto tardó en cargar la página o el caso anterior, se le resta simT justo antes (síncrono, sin cambiar src/).
      const g = window.__g; const cfg = { ...c, fase: c.fase - g.simT() };
      return g.ensayo(cfg).then(r => { delete r.cfg; r.fallo = r.fallo.replace(/\s+/g, ' ').slice(0, 200); return r; });
    }, c);
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
// (comprobación previa tras calcular, como la guarda guardarEscena) más un ensayo M0 de la demo
export async function medirEscena(page, codigo) {
  const abierta = await page.evaluate(c => { window.__g.abrirCodigo(c); return document.getElementById('escNom').textContent; }, codigo);
  await page.evaluate(() => window.__g.calcularPlanes());
  await esperarPlanes(page);
  const r = await page.evaluate(() => {
    const g = window.__g; const graves = g.comprobarPlan().filter(c => c.grave).map(c => c.txt);
    return { layout: JSON.parse(JSON.stringify(g.L())), veredicto: { ok: !graves.length, n: graves.length, graves }, alDia: g.planesAlDia() };
  });
  const [d] = await ensayar(page, [{ ...BASE, modo: 'M0', amp: 0.02 }]);
  return { abierta, ...r, demo: Object.fromEntries(CAMPOS_MATRIZ.map(k => [k, d[k]])) };
}
