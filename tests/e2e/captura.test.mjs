// Captura sintética con anotaciones (T4.6): el botón «Captura sintética» de cada cámara, en los dos destinos. Tres cosas.
// (1) C3 y C4 (artefacto): la imagen que se descarga es un PNG válido de 640 × 480 (firma, trozos con su CRC, IDAT que descomprime al tamaño de
//     la imagen y IEND), con los mismos píxeles que leyó la página; las esquinas de un ArUco de la mesa que dice el JSON caen en el sitio donde
//     están dibujadas (tolerancia de 2 px: en la diagonal que sale del centro, el paso de negro a blanco), y el borde del marcador es oscuro
//     por dentro y claro por fuera; el JSON que se descarga es el de la vista previa. La figura de la persona no se dibuja (se mira en el
//     render), el gemelo queda como estaba (escena, tamaño del lienzo) y dos capturas seguidas dan los mismos bytes. El tiempo de cada captura
//     se mide y se imprime: con SwiftShader la primera lectura espera a los fotogramas que el bucle ya tiene en cola, así que se para el
//     bucle (D.banco), se hace una captura «fría» (se imprime, no se exige) y las demás tienen que tardar como mucho 2 s.
// (2) Qué se anota en cada cámara (cenital, entrega y persona) con la disposición por defecto, fijado al ejecutar el gemelo: nombres, cortados
//     por el borde (parcial) y omitidos; cajas dentro de la imagen; la focal y el modo de la cámara cambian la captura y no su tamaño.
// (3) La web: el mismo panel y la misma descarga (PNG válido y JSON igual al de la vista previa), sin gancho de pruebas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const AVISO = 'sirve para probar pipelines, no para sustituir datos reales';
const CAMARAS = ['cenital', 'entrega', 'persona'];
// Lo que dio el gemelo (disposición por defecto): nombres anotados en orden, cuáles salen cortados por el borde y qué no se anota
const FIJADO = {
  cenital: {
    anotados: ['marcador 0 (zona)', 'marcador 1 (zona)', 'marcador 2 (zona)', 'marcador 3 (zona)', 'marcador 4 (entrega)', 'marcador 5 (entrega)', 'plato 1º', 'plato 2º', 'manzana (pieza 0)', 'pera (pieza 1)', 'manzana (pieza 2)', 'uvas (pieza 3)', 'frambuesa (pieza 4)', 'limón (pieza 5)'],
    parciales: ['marcador 5 (entrega)'], omitidos: ['marcador 6 (bandeja)', 'marcador 7 (bandeja)', 'marcador 8 (bandeja)', 'marcador 9 (bandeja)'],
  },
  entrega: {
    anotados: ['marcador 1 (zona)', 'marcador 2 (zona)', 'marcador 4 (entrega)', 'marcador 5 (entrega)', 'marcador 6 (bandeja)', 'marcador 7 (bandeja)', 'marcador 8 (bandeja)', 'marcador 9 (bandeja)', 'plato 1º', 'pera (pieza 1)', 'manzana (pieza 2)', 'frambuesa (pieza 4)', 'limón (pieza 5)'],
    parciales: ['plato 1º', 'pera (pieza 1)', 'frambuesa (pieza 4)', 'limón (pieza 5)'], omitidos: ['marcador 0 (zona)', 'marcador 3 (zona)', 'plato 2º', 'manzana (pieza 0)', 'uvas (pieza 3)'],
  },
  persona: {
    anotados: ['marcador 6 (bandeja)', 'marcador 7 (bandeja)', 'marcador 8 (bandeja)', 'marcador 9 (bandeja)'], parciales: [],
    omitidos: ['marcador 0 (zona)', 'marcador 1 (zona)', 'marcador 2 (zona)', 'marcador 3 (zona)', 'marcador 4 (entrega)', 'marcador 5 (entrega)', 'plato 1º', 'plato 2º', 'manzana (pieza 0)', 'pera (pieza 1)', 'manzana (pieza 2)', 'uvas (pieza 3)', 'frambuesa (pieza 4)', 'limón (pieza 5)'],
  },
};

const abrirCamaras = async p => { await p.click('.tabs [data-tab="camaras"]'); await p.locator('#camCards .tarea').first().waitFor(); };
// El clic se da en la página: page.click espera dos fotogramas quietos y con SwiftShader tarda segundos
const pulsar = (p, k) => p.evaluate(k => document.querySelector(`#camCards [data-cam="${k}"] [data-act="captura"]`).click(), k);
// Una descarga: lo que hace `accion` debe disparar el evento download; devuelve su nombre y sus bytes (el navegador es remoto: sin path())
async function descarga(page, accion) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), accion()]);
  const partes = []; for await (const parte of await d.createReadStream()) partes.push(parte);
  return { nombre: d.suggestedFilename(), bytes: Buffer.concat(partes) };
}
// PNG válido: firma, trozos con longitud y CRC, IHDR primero, IEND último y los IDAT descomprimen a alto × (1 + ancho × bytes por píxel)
function pngValido(b) {
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'firma PNG');
  let i = 8, ihdr = null; const idat = [], tipos = [];
  while (i < b.length) {
    const n = b.readUInt32BE(i), tipo = b.subarray(i + 4, i + 8).toString('latin1'), datos = b.subarray(i + 8, i + 8 + n);
    assert.equal(b.readUInt32BE(i + 8 + n), zlib.crc32(b.subarray(i + 4, i + 8 + n)), `CRC del trozo ${tipo}`);
    tipos.push(tipo); if (tipo === 'IHDR') ihdr = datos; if (tipo === 'IDAT') idat.push(datos); i += 12 + n;
  }
  assert.equal(i, b.length, 'sin bytes de más'); assert.equal(tipos[0], 'IHDR'); assert.equal(tipos.at(-1), 'IEND');
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), prof = ihdr[8], color = ihdr[9], bpp = { 2: 3, 6: 4 }[color];
  assert.ok(bpp && prof === 8 && ihdr[12] === 0, `RGB o RGBA de 8 bits sin entrelazado (color ${color}, profundidad ${prof})`);
  assert.equal(zlib.inflateSync(Buffer.concat(idat)).length, h * (1 + w * bpp), 'los datos de la imagen miden alto × (1 + ancho × bytes por píxel)');
  return { w, h };
}
// En la página: decodifica el PNG descargado y mide, para los marcadores pedidos (por nombre), dónde están dibujadas sus esquinas
// (la diagonal que sale del centro del marcador por la esquina del JSON, de 5 px por dentro a 6 px por fuera: la distancia de la esquina del
// JSON al primer píxel claro, > 142 de luminosidad, con signo: negativa = el negro acaba antes) y la luminosidad por dentro (1,5 px) y por
// fuera (3 px) del punto medio de cada arista. Y, con el gancho, cuántos bytes del PNG difieren de los que leyó la página
const analizar = (p, bytes, texto, nombres) => p.evaluate(async ({ b64, texto, nombres }) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), bm = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
  const W = bm.width, H = bm.height, c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const x2 = c2.getContext('2d', { willReadFrequently: true }); x2.drawImage(bm, 0, 0); const d = x2.getImageData(0, 0, W, H).data;
  const lum = (u, v) => { const xx = Math.round(u), yy = Math.round(v); if (xx < 0 || xx >= W || yy < 0 || yy >= H) return null; const i = (yy * W + xx) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; };
  const cap = window.__g ? window.__g.capturaUltima() : null; let distintos = null;
  if (cap) { distintos = 0; for (let i = 0; i < d.length; i++) if (d[i] !== cap.dato[i]) distintos++; }
  const doc = JSON.parse(texto), marcadores = [];
  for (const nombre of nombres) {
    const o = doc.objetos.find(q => q.nombre === nombre), E = o.esquinas, cx = E.reduce((s, q) => s + q[0], 0) / 4, cy = E.reduce((s, q) => s + q[1], 0) / 4;
    const trans = E.map(q => {
      const n = Math.hypot(q[0] - cx, q[1] - cy), ux = (q[0] - cx) / n, uy = (q[1] - cy) / n, l = t => lum(q[0] + t * ux, q[1] + t * uy);
      if (!(l(-5) < 142)) return `no es oscuro 5 px por dentro (${l(-5)})`;
      for (let t = -5; t <= 6; t += 0.25) if (l(t) > 142) return t;
      return 'no hay píxel claro por fuera';
    });
    const bordes = [0, 1, 2, 3].map(i => {
      const a = E[i], b = E[(i + 1) % 4], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nn = Math.hypot(b[0] - a[0], b[1] - a[1]); let nx = -(b[1] - a[1]) / nn, ny = (b[0] - a[0]) / nn;
      if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; } // la normal hacia el centro
      return { dentro: lum(mx + 1.5 * nx, my + 1.5 * ny), fuera: lum(mx - 3 * nx, my - 3 * ny) };
    });
    marcadores.push({ nombre, trans, bordes });
  }
  return { W, H, distintos, marcadores };
}, { b64: bytes.toString('base64'), texto, nombres });
// Las cajas y las esquinas de un JSON de captura: dentro de la imagen, y «parcial» si y solo si cruza el borde (cajas con 0,01 px de redondeo)
function comprobarJson(doc, clave) {
  assert.equal(doc.camara.clave, clave); assert.deepEqual([doc.imagen.ancho, doc.imagen.alto, doc.imagen.modo], [640, 480, '640x480']);
  assert.ok(doc.objetos.every(o => ['aruco', 'plato', 'fruta'].includes(o.clase)), 'sin ninguna clase de persona'); assert.equal(doc.aviso, AVISO);
  const eps = 0.011;
  for (const o of doc.objetos) {
    const { x, y, ancho, alto } = o.caja, toca = x <= -0.5 + eps || y <= -0.5 + eps || x + ancho >= 639.5 - eps || y + alto >= 479.5 - eps;
    assert.ok(x >= -0.5 - eps && y >= -0.5 - eps && x + ancho <= 639.5 + eps && y + alto <= 479.5 + eps && ancho > 0 && alto > 0, `${o.nombre}: la caja cabe en la imagen`);
    assert.equal(o.visible, true, o.nombre);
    if (o.clase === 'aruco') { const fuera = o.esquinas.some(([u, v]) => u < -0.5 || u > 639.5 || v < -0.5 || v > 479.5); assert.equal(o.parcial, fuera, `${o.nombre}: parcial si una esquina cae fuera`); }
    else assert.equal(o.parcial, toca, `${o.nombre}: parcial si la caja recortada toca el borde`);
  }
}

test('T4.6-C3, C4 y C5 (artefacto): panel y aviso; PNG de 640 × 480 válido, esquinas de ArUco en su sitio, JSON de la descarga = el de la vista previa; sin persona, gemelo igual y tiempos', { timeout: 400000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await abrirCamaras(p);
    // ---- C5: el panel
    assert.equal(await p.locator('#capSec h2').textContent().then(t => t.replace(/\s+/g, ' ').trim()), 'Captura sintética SIN VALIDAR');
    assert.ok((await p.textContent('#capAviso')).replace(/\s+/g, ' ').includes(AVISO), 'el aviso fijo');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#camCards [data-cam]')].map(c => [c.dataset.cam, c.querySelector('[data-act="captura"]')?.textContent])), CAMARAS.map(k => [k, 'Captura sintética']), 'un botón por cámara');
    assert.equal(await p.isHidden('#capVista'), true, 'sin captura no hay vista previa');
    // ---- C4: tiempos con el bucle parado; la persona no se dibuja; el gemelo queda como estaba; dos capturas, los mismos bytes
    const M = await p.evaluate(async () => {
      const g = window.__g, rd = g.renderer, render = rd.render, vis = [], ms = {};
      g.D.banco = true; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const L0 = JSON.stringify(g.L()), ancho0 = rd.domElement.width, alto0 = rd.domElement.height, tctl0 = g.tctl.visible;
      const clic = k => { const t0 = performance.now(); document.querySelector(`#camCards [data-cam="${k}"] [data-act="captura"]`).click(); return performance.now() - t0; };
      rd.render = function (escena, camara) { vis.push(g.OBJ.persona.visible); return render.call(this, escena, camara); };
      ms.fria = clic('cenital'); rd.render = render;
      for (const k of ['cenital', 'entrega', 'persona']) ms[k] = clic(k);
      const a = g.capturar('cenital'), b = g.capturar('cenital'); let distintos = 0; for (let i = 0; i < a.dato.length; i++) if (a.dato[i] !== b.dato[i]) distintos++;
      g.D.banco = false;
      return { ms, vis, persona: g.OBJ.persona.visible, tctl: g.tctl.visible === tctl0, L: JSON.stringify(g.L()) === L0, lienzo: [rd.domElement.width === ancho0, rd.domElement.height === alto0], mismoTexto: a.texto === b.texto, distintos };
    });
    console.log(`tiempo de una captura (ms): primera, con la cola de SwiftShader: ${M.ms.fria.toFixed(0)}; cenital ${M.ms.cenital.toFixed(0)}, entrega ${M.ms.entrega.toFixed(0)}, persona ${M.ms.persona.toFixed(0)}`);
    for (const k of CAMARAS) assert.ok(M.ms[k] <= 2000, `la captura de ${k} tarda ${M.ms[k].toFixed(0)} ms (máximo 2000)`);
    assert.deepEqual(M.vis, [false], 'al pintar la captura la figura de la persona está oculta'); assert.equal(M.persona, true, 'y vuelve a verse');
    assert.deepEqual([M.L, M.tctl, ...M.lienzo], [true, true, true, true], 'la escena, el gizmo y el tamaño del lienzo quedan como estaban');
    assert.deepEqual([M.mismoTexto, M.distintos], [true, 0], 'dos capturas seguidas: el mismo JSON y los mismos píxeles');
    // ---- C3: cenital y entrega, con la descarga y el análisis del PNG
    for (const [k, nombres] of [['cenital', ['marcador 4 (entrega)']], ['entrega', ['marcador 4 (entrega)', 'marcador 5 (entrega)']]]) {
      await pulsar(p, k);
      assert.match(await p.textContent('#capMsg'), new RegExp(`^Captura de la cámara ${k}: 640 × 480 px, ${FIJADO[k].anotados.length} objetos anotados y ${FIJADO[k].omitidos.length} sin anotar`));
      const png = await descarga(p, () => p.evaluate(() => document.getElementById('btnCapPng').click())), js = await descarga(p, () => p.evaluate(() => document.getElementById('btnCapJson').click()));
      assert.deepEqual([png.nombre, js.nombre], [`captura_${k}.png`, `captura_${k}.json`]);
      assert.deepEqual(pngValido(png.bytes), { w: 640, h: 480 });
      const texto = js.bytes.toString('utf8'); assert.equal(texto, await p.inputValue('#capJson'), 'el JSON de la descarga es el de la vista previa');
      assert.equal(texto, await p.evaluate(() => window.__g.capturaUltima().texto)); const doc = JSON.parse(texto); comprobarJson(doc, k);
      const A = await analizar(p, png.bytes, texto, nombres);
      assert.deepEqual([A.W, A.H, A.distintos], [640, 480, 0], 'el PNG descargado tiene los píxeles que leyó la página');
      for (const m of A.marcadores) {
        assert.equal(m.trans.length, 4);
        m.trans.forEach((t, i) => assert.ok(typeof t === 'number' && Math.abs(t) <= 2, `${k}, ${m.nombre}, esquina ${i}: el negro acaba a ${t} px de la esquina del JSON (máximo 2)`));
        m.bordes.forEach((b, i) => assert.ok(b.dentro < 100 && b.fuera > 150, `${k}, ${m.nombre}, arista ${i}: luminosidad ${b.dentro} por dentro (oscuro) y ${b.fuera} por fuera (claro)`));
      }
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.6: lo que se anota en cada cámara (fijado en el gemelo), cajas dentro de la imagen, y la focal y el modo de la cámara', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await abrirCamaras(p);
    const captura = async k => { await pulsar(p, k); const t = await p.inputValue('#capJson'); return JSON.parse(t); };
    for (const k of CAMARAS) {
      const doc = await captura(k); comprobarJson(doc, k);
      assert.deepEqual(doc.objetos.map(o => o.nombre), FIJADO[k].anotados, `anotados en la cámara ${k}`);
      assert.deepEqual(doc.objetos.filter(o => o.parcial).map(o => o.nombre), FIJADO[k].parciales, `cortados por el borde en la cámara ${k}`);
      assert.deepEqual(doc.omitidos.map(o => o.nombre), FIJADO[k].omitidos, `sin anotar en la cámara ${k}`);
      assert.deepEqual(doc.objetos.filter(o => o.clase === 'aruco').map(o => o.id), FIJADO[k].anotados.filter(n => n.startsWith('marcador')).map(n => +/\d+/.exec(n)[0]), `ids de los ArUco de ${k}`);
      assert.match(doc.oclusion, /^solo la del campo y los bordes/); assert.match(doc.oclusion, /T4\.2/);
    }
    // la focal cambia el campo (fx = 640·f/5,952) y con ella lo que se ve; el modo de la cámara no cambia el tamaño de la captura ni la focal en píxeles
    const base = await captura('cenital'); assert.equal(base.camara.focal_mm, 3.6); assert.equal(base.proyeccion.fx, 387.0968);
    await p.evaluate(() => { const e = document.getElementById('f_cenital'); e.value = '6'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    const zoom = await captura('cenital'); comprobarJson(zoom, 'cenital');
    assert.equal(zoom.camara.focal_mm, 6); assert.equal(zoom.proyeccion.fx, 645.1613); assert.ok(zoom.objetos.length < base.objetos.length, `con más focal se ven menos objetos (${zoom.objetos.length} frente a ${base.objetos.length})`);
    await p.selectOption('#m_cenital', '1280x960');
    const modo = await captura('cenital'); assert.equal(modo.camara.modo_de_la_camara, '1280x960'); assert.deepEqual([modo.imagen.ancho, modo.imagen.alto, modo.proyeccion.fx], [640, 480, 645.1613]);
    // Quitar la captura: la vista previa desaparece
    await p.click('#btnCapQuitar'); assert.equal(await p.isHidden('#capVista'), true); assert.equal(await p.textContent('#capMsg'), '');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.6-C5 en la web: el mismo panel y la misma descarga (PNG válido y JSON igual al de la vista previa), sin gancho de pruebas', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), p = s.page;
  try {
    assert.equal(await p.evaluate(() => typeof window.__g), 'undefined', 'la web no lleva el gancho de pruebas');
    await abrirCamaras(p);
    assert.ok((await p.textContent('#capAviso')).replace(/\s+/g, ' ').includes(AVISO), 'el aviso fijo');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#camCards [data-cam]')].map(c => [c.dataset.cam, c.querySelector('[data-act="captura"]')?.textContent])), CAMARAS.map(k => [k, 'Captura sintética']));
    await pulsar(p, 'cenital'); await p.waitForFunction(() => document.getElementById('capJson').value.length > 0, null, { timeout: 120000 });
    const png = await descarga(p, () => p.evaluate(() => document.getElementById('btnCapPng').click())), js = await descarga(p, () => p.evaluate(() => document.getElementById('btnCapJson').click()));
    assert.deepEqual([png.nombre, js.nombre], ['captura_cenital.png', 'captura_cenital.json']); assert.deepEqual(pngValido(png.bytes), { w: 640, h: 480 });
    const texto = js.bytes.toString('utf8'); assert.equal(texto, await p.inputValue('#capJson'), 'el JSON de la descarga es el de la vista previa');
    const doc = JSON.parse(texto); comprobarJson(doc, 'cenital'); assert.deepEqual(doc.objetos.map(o => o.nombre), FIJADO.cenital.anotados);
    const A = await analizar(p, png.bytes, texto, ['marcador 4 (entrega)']);
    A.marcadores[0].trans.forEach((t, i) => assert.ok(typeof t === 'number' && Math.abs(t) <= 2, `esquina ${i}: el negro acaba a ${t} px de la del JSON`));
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
