// Escenas ilegibles (DT11): una escena cuya disposición no pasa validarLayout aparece aparte, en «Ilegibles», con su
// motivo, y se puede llevar a la papelera y borrar cuando las reglas lo permiten; si no, la interfaz dice por qué. Con el
// simulacro de Firestore (que emula las reglas del paquete) y con el del almacén de claude.ai. No cambian ni reglas ni
// campos de escena (I2): los documentos de prueba solo usan los campos de siempre.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarToast, CLAVE_BUENA } from '../navegador.mjs';

const V8 = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/escenas-v8/1-defecto.json'), 'utf8'));
const LAYOUT_V8 = JSON.parse(Buffer.from(V8.codigo.slice('GEMELO1.'.length), 'base64').toString('utf8')).layout;
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Dos pulsaciones seguidas dentro de la página (confirmar() caduca a los 4 s); devuelve el texto tras la primera
const dosVeces = (p, sel) => p.evaluate(sel => { const b = () => document.querySelector(sel); b().click(); const m = b().textContent; b().click(); return m; }, sel);
// Lo que muestra la sección «Ilegibles»: visible, cuenta y, por escena, nombre, motivo, nota y botones
const ilegibles = p => p.evaluate(() => {
  const sec = document.getElementById('escIlegibles'); if (!sec) return null;
  return { visible: !sec.hidden, cuenta: document.getElementById('escIlegCuenta').textContent, items: [...sec.querySelectorAll('#escIlegLista li')].map(li => ({
    id: li.dataset.ileg, nombre: li.querySelector('b').textContent, motivo: li.querySelector('.motivo').textContent, nota: li.querySelector('.nota') ? li.querySelector('.nota').textContent : null,
    botones: [...li.querySelectorAll('button')].map(b => b.textContent), aviso: li.querySelector('.btns .hint') ? li.querySelector('.btns .hint').textContent : null })) };
});
const doc = (id, extra) => ({ nombre: 'Escena', nota: '', autor: 'Ana', editadoPor: 'Ana', creado: '2026-11-10T10:00:00.000Z', editado: '2026-11-10T10:00:00.000Z', layout: JSON.stringify(LAYOUT_V8), ajustes: { modo: 'M0', amp: 0.02, vel: 0.25, pedido: 2 }, vista: null, estado: { ok: true, n: 0, txt: '' }, borrado: false, ...extra });

test('DT11 (Firestore simulado): las ilegibles salen aparte con su motivo; papelera y borrado si las reglas lo permiten', { timeout: 300000 }, async () => {
  const docs = { buena: doc('buena', { nombre: 'Buena' }), rota: doc('rota', { nombre: 'Rota JSON', layout: '{"mesa": ' }), forma: doc('forma', { nombre: 'Sin zona', layout: JSON.stringify({ ...LAYOUT_V8, zona: 7 }) }), numero: doc('numero', { nombre: 'Disposición numérica', layout: 12345 }) };
  const init = `globalThis.__fsStore = new Map(${JSON.stringify(Object.entries(docs).map(([k, v]) => [`grupos/clave-buena/escenas/${k}`, v]))});`;
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}`, initScripts: [{ content: init }] }); const p = s.page;
  const enAlmacen = id => p.evaluate(id => globalThis.__fsStore.get(`grupos/clave-buena/escenas/${id}`) || null, id);
  try {
    await p.waitForFunction(() => document.getElementById('escMeta').textContent.includes('1 escena guardada'), null, { timeout: 60000, polling: 50 });
    await esperarToast(p, '3 escenas del grupo no se pueden abrir: su disposición no es válida (las ves en «Ilegibles»)');
    await p.click('#escCur');
    let il = await ilegibles(p);
    assert.equal(il.visible, true); assert.equal(il.cuenta, '3');
    const de = id => il.items.find(x => x.id === id);
    assert.deepEqual(il.items.map(x => x.id).sort(), ['forma', 'numero', 'rota'], 'la buena no está entre las ilegibles');
    assert.match(de('rota').motivo, /^Motivo: el texto no es JSON válido/);
    assert.equal(de('forma').motivo, 'Motivo: «zona» no es un objeto');
    assert.equal(de('numero').motivo, 'Motivo: no es una disposición');
    assert.deepEqual(de('rota').botones, ['A la papelera']);
    // a la papelera (dos pulsaciones) y borrar para siempre
    assert.equal(await dosVeces(p, '#escIlegLista li[data-ileg="rota"] button'), '¿Seguro?');
    await esperarToast(p, 'Escena ilegible movida a la papelera');
    await p.waitForFunction(() => globalThis.__fsStore.get('grupos/clave-buena/escenas/rota').borrado === true, null, { timeout: 30000, polling: 50 });
    await p.waitForFunction(() => [...document.querySelectorAll('#escIlegLista li[data-ileg="rota"] button')].map(b => b.textContent).join() === 'Borrar para siempre', null, { timeout: 30000, polling: 50 });
    assert.match((await ilegibles(p)).items.find(x => x.id === 'rota').nombre, /^Rota JSON$/);
    assert.equal(await dosVeces(p, '#escIlegLista li[data-ileg="rota"] button'), '¿Seguro? Se pierde');
    await esperarToast(p, 'Escena ilegible borrada para siempre');
    await p.waitForFunction(() => !globalThis.__fsStore.has('grupos/clave-buena/escenas/rota'), null, { timeout: 30000, polling: 50 });
    // las reglas rechazan la papelera de una escena cuya disposición no es un texto: la interfaz lo dice y no cambia nada
    const antes = await enAlmacen('numero');
    assert.equal(await dosVeces(p, '#escIlegLista li[data-ileg="numero"] button'), '¿Seguro?');
    await esperarToast(p, 'Las reglas no dejan borrar esa escena: mira el motivo en «Ilegibles»');
    il = await ilegibles(p);
    assert.match(il.items.find(x => x.id === 'numero').nota, /^Las reglas de Firestore no dejan mandarla a la papelera/);
    assert.equal(await p.evaluate(() => globalThis.__fsRechazo), 'layout', 'el simulacro de las reglas la rechaza por el campo layout');
    assert.deepEqual(await enAlmacen('numero'), antes, 'la escena sigue igual');
    assert.deepEqual(il.items.map(x => x.id).sort(), ['forma', 'numero']);
    assert.ok(await enAlmacen('buena'), 'la escena buena no se toca');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('DT11 (almacén de claude.ai simulado): las ilegibles salen aparte; se borran las propias y la ajena dice por qué no', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'artefacto-claude' }); const p = s.page;
  try {
    await p.waitForFunction(() => window.__g.ALM.modo === 'claude' && window.__g.ALM.yo === 'A' && !window.__g.ESC.cargando, null, { timeout: 30000 });
    await p.evaluate(async l => {
      const db = await window.claude.use('db'), item = (id, extra) => ({ id, nombre: id, nota: '', creado: '2026-11-10T10:00:00.000Z', editado: '2026-11-10T10:00:00.000Z', layout: l, ajustes: null, vista: null, estado: null, ...extra });
      window.__dueno = true; await db.collection('propuestas').doc('B').set({ items: [item('ajena', { nombre: 'De Bea', layout: 'no es JSON' })] }); window.__dueno = false; // solo para sembrar el documento de B
      await db.collection('propuestas').doc('A').set({ items: [item('buena', { nombre: 'Buena' }), item('rota', { nombre: 'Rota', layout: { ...l, pedido: 3 } }), item('vacia', { nombre: 'Sin disposición', layout: null })] });
    }, LAYOUT_V8);
    await p.waitForFunction(() => window.__g.ESC.lista.length === 1 && (window.__g.ESC.ilegLista || []).length === 3, null, { timeout: 30000, polling: 50 });
    await p.click('#escCur');
    const il = await ilegibles(p);
    assert.equal(il.visible, true); assert.equal(il.cuenta, '3');
    const de = id => il.items.find(x => x.id === id);
    assert.equal(de('rota').motivo, 'Motivo: «pedido» debe ser 1 o 2 platos'); assert.deepEqual(de('rota').botones, ['Borrar']);
    assert.equal(de('vacia').motivo, 'Motivo: no trae disposición');
    assert.match(de('ajena').motivo, /^Motivo: el texto no es JSON válido/);
    assert.deepEqual(de('ajena').botones, [], 'la de otra persona no se puede borrar');
    assert.equal(de('ajena').aviso, 'solo la puede borrar quien la guardó o el dueño de la página');
    assert.equal(await dosVeces(p, '#escIlegLista li[data-ileg="rota"] button'), '¿Seguro?');
    await esperarToast(p, 'Escena ilegible borrada');
    await p.waitForFunction(() => window.__store.A.items.map(x => x.id).join() === 'buena,vacia', null, { timeout: 30000, polling: 50 });
    await p.waitForFunction(() => [...document.querySelectorAll('#escIlegLista li')].map(li => li.dataset.ileg).sort().join() === 'ajena,vacia', null, { timeout: 30000, polling: 50 });
    assert.deepEqual(await p.evaluate(() => window.__store.B.items.map(x => x.id)), ['ajena'], 'la de B sigue');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
