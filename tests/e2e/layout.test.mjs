// Versión del layout en la página (T1.1, I1, I2): campos v9 en lo que se guarda, códigos corruptos que no cambian nada,
// disposiciones de una versión más nueva en solo lectura y el límite de 50.000 caracteres antes de llamar a Firestore.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarToast, CLAVE_BUENA } from '../navegador.mjs';

const DIR = path.join(RAIZ, 'tests/fixtures/escenas-v8');
const ESC_V8 = Object.fromEntries(fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))]));
const decodificar = c => JSON.parse(Buffer.from(c.slice('GEMELO1.'.length), 'base64').toString('utf8'));
// Mismo formato que codigoEscena(): «GEMELO1.» + base64 del JSON en UTF-8
const codificar = o => 'GEMELO1.' + Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const LAYOUT_V8 = decodificar(ESC_V8['1-defecto'].codigo).layout;
const conLayout = (nombre, layout) => codificar({ v: 1, nombre, nota: '', layout });
const copia = o => JSON.parse(JSON.stringify(o));
const CAMPOS_V9 = l => ({ version: l.version, robotId: l.robotId, perfil: l.perfil, sensor: l.sensor });
const CLAVE = 'gemelo-ur3e-v4', CLAVE_PREV = 'gemelo-ur3e-v4-mesa-anterior';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Avisos emergentes mostrados después de la marca n0 (window.__toastsPrueba los guarda todos, en orden)
const marca = p => p.evaluate(() => window.__toastsPrueba.length);
async function avisosDesde(p, n0) {
  await p.waitForFunction(n => window.__toastsPrueba.length > n, n0, { timeout: 30000, polling: 50 });
  return p.evaluate(n => window.__toastsPrueba.slice(n), n0);
}

test('artefacto: lo guardado lleva los campos v9 y un código corrupto muestra un error sin cambiar nada', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    // layoutDefecto() de una página nueva: escena nueva (C1), que el esquema de la propia página acepta
    assert.deepEqual(await p.evaluate(() => { const l = window.__g.L(); return { version: l.version, robotId: l.robotId, perfil: l.perfil, sensor: l.sensor, valida: window.__g.LAYOUT.validarLayout(l, window.__g.ESQ_L) }; }),
      { version: 9, robotId: 'nominal', perfil: 'curso', sensor: 'elp-ficha', valida: null });
    // una escena v8 abierta por código: migrada; Tu mesa (localStorage) y el código de escena la guardan con los campos v9
    await p.evaluate(c => window.__g.abrirCodigo(c), ESC_V8['3-un-plato'].codigo);
    await esperarToast(p, 'Abierta en Tu mesa: Un plato, zona desplazada');
    await p.waitForFunction(k => { const t = localStorage.getItem(k); return t && JSON.parse(t).perfil === 'gemelo'; }, CLAVE, { timeout: 30000, polling: 50 });
    const local = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), CLAVE);
    assert.deepEqual(CAMPOS_V9(local), { version: 9, robotId: 'nominal', perfil: 'gemelo', sensor: 'gemelo-v8' });
    assert.deepEqual(CAMPOS_V9(decodificar(await p.evaluate(() => window.__g.codigoEscena())).layout), CAMPOS_V9(local));
    // «Restablecer distribución» es una escena nueva: perfil «curso» y sensor de la ficha, también en Tu mesa y en el código
    await p.evaluate(() => document.getElementById('btnReset').click());
    await p.waitForFunction(k => JSON.parse(localStorage.getItem(k)).perfil === 'curso', CLAVE, { timeout: 30000, polling: 50 });
    assert.deepEqual(CAMPOS_V9(await p.evaluate(k => JSON.parse(localStorage.getItem(k)), CLAVE)), { version: 9, robotId: 'nominal', perfil: 'curso', sensor: 'elp-ficha' });
    assert.deepEqual(CAMPOS_V9(decodificar(await p.evaluate(() => window.__g.codigoEscena())).layout), { version: 9, robotId: 'nominal', perfil: 'curso', sensor: 'elp-ficha' });

    // Códigos corruptos (C4): se abre antes una escena distinta de la de partida para que «no cambia nada» se note
    await p.evaluate(c => window.__g.abrirCodigo(c), ESC_V8['3-un-plato'].codigo);
    await p.waitForFunction(k => JSON.parse(localStorage.getItem(k)).perfil === 'gemelo', CLAVE, { timeout: 30000, polling: 50 });
    const estado = () => p.evaluate(([k, kp]) => ({ L: JSON.stringify(window.__g.L()), basada: JSON.stringify(window.__g.ESC.basada), cur: window.__g.ESC.cur, mesa: localStorage.getItem(k), prev: localStorage.getItem(kp), nom: document.getElementById('escNom').textContent }), [CLAVE, CLAVE_PREV]);
    const antes = await estado();
    assert.equal(JSON.parse(antes.L).pedido, 1); // es la escena de un plato, no la de partida
    const roto = f => { const l = copia(LAYOUT_V8); f(l); return conLayout('Rota', l); };
    const CASOS = [
      ['sin zona', roto(l => { delete l.zona; }), /^El código no trae una disposición válida: falta «zona»$/],
      ['sin cams', roto(l => { delete l.cams; }), /^El código no trae una disposición válida: falta «cams»$/],
      ['sin plato1', roto(l => { delete l.plato1; }), /^El código no trae una disposición válida: falta «plato1»$/],
      ['tipo imposible', roto(l => { l.plato1.x = 'a'; }), /^El código no trae una disposición válida: «plato1\.x» no es un número$/],
      ['modo de cámara imposible', roto(l => { l.cams.cenital.modo = '1x1'; }), /^El código no trae una disposición válida: «cams\.cenital\.modo» no es un modo de la cámara \(1x1\)$/],
      ['layout con JSON inválido', conLayout('Rota', '{"zona": '), /^El código no trae una disposición válida: el texto no es JSON válido \(.+\)$/],
      ['código con JSON inválido', 'GEMELO1.' + Buffer.from('{"layout": {', 'utf8').toString('base64'), /^El código está incompleto$/],
      ['código cuyo JSON es null', 'GEMELO1.' + Buffer.from('null', 'utf8').toString('base64'), /^El código no trae una disposición$/],
      ['código cuyo JSON es un número', 'GEMELO1.' + Buffer.from('42', 'utf8').toString('base64'), /^El código no trae una disposición$/],
    ];
    for (const [nombre, codigo, re] of CASOS) {
      const n0 = await marca(p);
      await p.evaluate(c => window.__g.abrirCodigo(c), codigo);
      const avisos = await avisosDesde(p, n0);
      assert.match(avisos[0], re, nombre);
      await p.waitForTimeout(500); // espera justificada: guardarLocal escribiría a los 400 ms; no hay nada observable si no escribe
      assert.deepEqual(await estado(), antes, `${nombre}: L, Tu mesa, la copia anterior y la escena abierta siguen igual`);
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

// Registra cada escritura de Tu mesa y de su copia anterior en localStorage, con su clave (antes de cargar la página)
const REGISTRO_LS = () => {
  window.__escrLS = []; const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('gemelo-ur3e-v4')) window.__escrLS.push([k, String(v)]); return orig.call(this, k, v); };
};

test('artefacto: con Tu mesa pendiente de guardar, abrir una v10 (código o YAML) no la escribe y lo pendiente no se pierde', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { initScripts: [REGISTRO_LS] }); const p = s.page;
  // ¿Está la disposición de esa escena v8 (tal como queda al abrirla, esperado.layout) en Tu mesa o en la copia anterior?
  const guardada = async esc => {
    const ls = await p.evaluate(([k, kp]) => [localStorage.getItem(k), localStorage.getItem(kp)], [CLAVE, CLAVE_PREV]);
    const igual = t => !!t && Object.entries(esc.esperado.layout).every(([k, v]) => JSON.stringify(JSON.parse(t)[k]) === JSON.stringify(v));
    return { mesa: igual(ls[0]), anterior: igual(ls[1]) };
  };
  const v10 = () => p.evaluate(() => window.__escrLS.filter(([, v]) => { try { return JSON.parse(v).version > 9; } catch (e) { return false; } }).map(([k]) => k));
  const futura = { ...copia(LAYOUT_V8), version: 10, campoFuturo: 1 };
  try {
    // 1) dos códigos seguidos: el segundo (v10) llega antes de los 400 ms del guardado pendiente del primero (v8)
    const A = ESC_V8['3-un-plato'];
    await p.evaluate(([a, b]) => { window.__g.abrirCodigo(a); window.__g.abrirCodigo(b); }, [A.codigo, conLayout('Futura', futura)]);
    await p.waitForTimeout(800); // espera justificada: el guardado pendiente se escribiría a los 400 ms; no hay nada que observar si no escribe
    assert.equal(await p.evaluate(() => window.__g.L().version), 10, 'la v10 queda abierta en solo lectura');
    assert.deepEqual(await v10(), [], 'ninguna escritura de una v10 en localStorage');
    assert.deepEqual(await guardada(A), { mesa: true, anterior: true }, 'la disposición del código v8 está en Tu mesa y en la copia anterior');
    // 2) lo mismo con Importar YAML: un código v8 y, antes de 400 ms, un YAML con una v10 en su línea layout-json
    const B = ESC_V8['1-defecto'];
    await p.evaluate(([a, yaml]) => { window.__g.abrirCodigo(a); document.getElementById('yamlIn').value = yaml; document.getElementById('btnImport').click(); },
      [B.codigo, `posiciones: {}\n# layout-json: ${JSON.stringify(futura)}\n`]);
    await esperarToast(p, 'Distribución aplicada en solo lectura: es de una versión más nueva del gemelo');
    await p.waitForTimeout(800); // espera justificada, como arriba
    assert.equal(await p.evaluate(() => window.__g.L().version), 10);
    assert.deepEqual(await v10(), [], 'ninguna escritura de una v10 en localStorage');
    assert.equal((await guardada(B)).mesa, true, 'la disposición del segundo código v8 está en Tu mesa');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

// Registra cada escritura de Tu mesa en localStorage (se instala antes de cargar la página; no cambia lo que hace)
const REGISTRO = () => {
  window.__escrituras = []; const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === 'gemelo-ur3e-v4') window.__escrituras.push(String(v)); return orig.call(this, k, v); };
};

test('web: una disposición de una versión más nueva se abre en solo lectura y una de más de 50.000 caracteres no llega a Firestore', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}`, initScripts: [REGISTRO] }); const p = s.page;
  const docs = () => p.evaluate(() => [...globalThis.__fsStore.values()]);
  const abrirCod = c => p.evaluate(c => { document.getElementById('escCodigo').value = c; document.getElementById('escAbrirCod').click(); }, c);
  const panel = async () => { if (await p.isHidden('#escPop')) await p.click('#escCur'); }; // abre el panel de escenas si está cerrado
  const chip = () => p.evaluate(() => { const c = document.getElementById('chipSoloLectura'); return { visible: !c.hidden && c.offsetParent !== null, txt: c.textContent }; });
  try {
    await p.waitForFunction(() => !/cargando/.test(document.getElementById('escMeta').textContent), null, { timeout: 60000 });
    assert.deepEqual(await chip(), { visible: false, txt: '' });
    // C3: versión 10 (con un campo que esta página no conoce) → solo lectura, con aviso visible
    const futura = { ...copia(LAYOUT_V8), version: 10, robotId: '207', perfil: 'otro', sensor: 'nuevo', campoFuturo: 1 };
    await abrirCod(conLayout('Futura', futura));
    await esperarToast(p, 'Abierta en Tu mesa en solo lectura: Futura es de una versión más nueva del gemelo (v10)');
    assert.deepEqual(await chip(), { visible: true, txt: 'SOLO LECTURA · disposición v10, esta página es la v9' });
    // editarla (focal de la cenital) tampoco la guarda en Tu mesa
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('#f_cenital').waitFor();
    await p.evaluate(() => { const el = document.getElementById('f_cenital'); el.value = '5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    // el panel de escenas no ofrece guardar y explica por qué; forzar el botón tampoco guarda
    await panel();
    assert.deepEqual(await p.evaluate(() => ({ guardar: document.getElementById('escGuardarSec').hidden, aviso: document.getElementById('escSoloLectura').hidden, txt: document.getElementById('escSoloLectura').textContent })),
      { guardar: true, aviso: false, txt: 'Esta disposición es de una versión más nueva del gemelo (v10; esta página es la v9). Se abre en solo lectura: no se guarda en Tu mesa ni en el grupo hasta que abras una escena compatible. Puedes copiar su código para pasarla.' });
    await p.evaluate(() => document.getElementById('escNueva').click());
    await esperarToast(p, 'Esta disposición es de una versión más nueva del gemelo (v10): se ve en solo lectura y no se puede guardar');
    await p.waitForTimeout(1000); // espera justificada: guardarLocal escribe a los 400 ms; sin escritura no hay nada que esperar
    assert.equal((await docs()).length, 0, 'nada en el grupo');
    assert.deepEqual(await p.evaluate(() => window.__escrituras.filter(t => JSON.parse(t).version !== 9)), [], 'nada de la v10 en Tu mesa');
    const nEscr = await p.evaluate(() => window.__escrituras.length);
    // al volver a una escena compatible (un código v8), el aviso desaparece y se vuelve a guardar en local y en el grupo
    await abrirCod(ESC_V8['1-defecto'].codigo);
    await esperarToast(p, 'Abierta en Tu mesa: Disposición por defecto. Guárdala para que la vea el grupo');
    assert.deepEqual(await chip(), { visible: false, txt: '' });
    await p.waitForFunction(n => window.__escrituras.length > n && JSON.parse(window.__escrituras.at(-1)).perfil === 'gemelo', nEscr, { timeout: 30000, polling: 50 });
    await panel(); assert.equal(await p.isVisible('#escGuardarSec'), true);
    await p.fill('#escAutor', 'Prueba'); await p.locator('#escAutor').dispatchEvent('change');
    await p.fill('#escNombre', 'Compatible'); await p.click('#escNueva'); await esperarToast(p, 'Escena guardada: el grupo ya puede verla');
    let ds = await docs(); assert.equal(ds.length, 1);
    assert.deepEqual(CAMPOS_V9(JSON.parse(ds[0].layout)), { version: 9, robotId: 'nominal', perfil: 'gemelo', sensor: 'gemelo-v8' }, 'escena v8 migrada guardada en el grupo (C1)');
    // C5: más de 50.000 caracteres (un campo de relleno que la migración conserva) → mensaje claro y ninguna llamada a Firestore
    await abrirCod(conLayout('Grande', { ...copia(LAYOUT_V8), relleno: 'x'.repeat(50001) }));
    await esperarToast(p, 'Abierta en Tu mesa: Grande. Guárdala para que la vea el grupo');
    await panel(); await p.fill('#escNombre', 'Grande'); const n0 = await marca(p); await p.click('#escNueva');
    const avisos = await avisosDesde(p, n0);
    assert.match(avisos[0], /^No se guarda: la disposición ocupa \d{2}\.\d{3} caracteres y el máximo es 50\.000$/);
    assert.equal(await p.evaluate(() => JSON.stringify(window.__fsRechazo)), undefined, 'firebase-mock no recibió ninguna escritura (sus reglas la habrían rechazado)');
    assert.equal((await docs()).length, 1);
    // C1: una escena nueva («Restablecer distribución») se guarda en el grupo con perfil «curso» y sensor de la ficha
    await p.evaluate(() => document.getElementById('btnReset').click()); await esperarToast(p, 'Distribución de partida restaurada');
    await panel(); await p.fill('#escNombre', 'Nueva'); await p.click('#escNueva');
    await p.waitForFunction(() => globalThis.__fsStore.size === 2, null, { timeout: 60000, polling: 50 });
    ds = await docs();
    assert.deepEqual(CAMPOS_V9(JSON.parse(ds.find(d => d.nombre === 'Nueva').layout)), { version: 9, robotId: 'nominal', perfil: 'curso', sensor: 'elp-ficha' });
    // Revisión: si L pasa a ser una v10 mientras guardarEscena espera a calcularPlanes (aquí, Importar YAML justo después de
    // pulsar Guardar con los planes sin calcular), al terminar el cálculo no se guarda
    await abrirCod(ESC_V8['3-un-plato'].codigo); await esperarToast(p, 'Abierta en Tu mesa: Un plato, zona desplazada. Guárdala para que la vea el grupo');
    const n1 = await marca(p);
    await p.evaluate(yaml => {
      document.getElementById('escNombre').value = 'Durante'; document.getElementById('escNueva').click(); // empieza calcularPlanes y espera
      document.getElementById('yamlIn').value = yaml; document.getElementById('btnImport').click();          // L pasa a ser una v10
    }, `# layout-json: ${JSON.stringify(futura)}\n`);
    const RO = 'Esta disposición es de una versión más nueva del gemelo (v10): se ve en solo lectura y no se puede guardar'; // ya salió antes: se espera el nuevo
    await p.waitForFunction(([n, t]) => window.__toastsPrueba.slice(n).includes(t), [n1, RO], { timeout: 120000, polling: 50 });
    assert.ok((await p.evaluate(n => window.__toastsPrueba.slice(n), n1)).includes('Distribución aplicada en solo lectura: es de una versión más nueva del gemelo'));
    assert.equal((await docs()).length, 2, 'la escena no se guardó');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
