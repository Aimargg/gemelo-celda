// Escenas en la versión web (index.html real) con Firestore simulado por tests/legacy/firebase-mock.js (T0.2 C6).
// La web no tiene window.__g: se maneja por la interfaz y se mira el almacén simulado (globalThis.__fsStore).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarToast, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const docs = p => p.evaluate(() => [...globalThis.__fsStore.values()]);
const hasta = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 60000, polling: 50 });
const abrirPapelera = async p => { await p.locator('#escPapelera').waitFor(); if (!(await p.evaluate(() => document.getElementById('escPapelera').open))) await p.click('#escPapelera summary'); };
// Dos pulsaciones (confirmar() de escenas.js) dentro de la página y seguidas: la confirmación caduca a los 4 s y, con la
// página ocupada por SwiftShader, dos clics de Playwright pueden tardar más (falló así en check.sh). Comprueba el texto
// intermedio y devuelve la hora de la primera pulsación, que arma ese temporizador.
const dosVeces = async (p, sel, texto) => {
  await p.locator(sel).first().waitFor(); const t = Date.now();
  const medio = await p.evaluate(sel => { const b = () => document.querySelector(sel); b().click(); const m = b().textContent; b().click(); return m; }, sel);
  assert.equal(medio, texto, `texto tras la primera pulsación en ${sel}`); return t;
};
// Espera justificada (no a una condición): el temporizador de 4 s de una confirmación anterior de la misma escena
// anula la siguiente (hallazgo fijado abajo); no hay nada observable que indique que ha vencido.
const vencido = (p, t) => p.waitForTimeout(Math.max(0, 4300 - (Date.now() - t)));

test('guardar, editar, papelera, restaurar y borrar para siempre', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }); const p = s.page;
  try {
    await hasta(p, () => !/cargando/.test(document.getElementById('escMeta').textContent));
    // guardar: sin nombre de autor no guarda; con nombre, una escena en el almacén
    await p.click('#escCur');
    await p.fill('#escNombre', 'Referencia'); await p.fill('#escNota', 'Punto de partida');
    await p.click('#escNueva'); await esperarToast(p, 'Escribe tu nombre para que el grupo sepa de quién es');
    assert.equal((await docs(p)).length, 0);
    await p.fill('#escAutor', 'Prueba'); await p.locator('#escAutor').dispatchEvent('change');
    await p.click('#escNueva'); await esperarToast(p, 'Escena guardada: el grupo ya puede verla');
    let [d] = await docs(p);
    assert.equal((await docs(p)).length, 1);
    assert.deepEqual({ nombre: d.nombre, nota: d.nota, autor: d.autor, borrado: d.borrado, layout: typeof d.layout, estado: d.estado.ok, f: JSON.parse(d.layout).cams.cenital.f },
      { nombre: 'Referencia', nota: 'Punto de partida', autor: 'Prueba', borrado: false, layout: 'string', estado: true, f: 3.6 });
    assert.equal(await p.textContent('#escNom'), 'Referencia');
    // editar: cambiar la focal de la cenital pasa la escena a Tu mesa; «Guardar cambios» sobrescribe el mismo documento
    await p.click('.tabs [data-tab="camaras"]'); await p.locator('#f_cenital').waitFor(); // las fichas solo existen con la pestaña abierta
    await p.evaluate(() => { const el = document.getElementById('f_cenital'); el.value = '5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#escCur');
    assert.equal(await p.textContent('#escCambios'), 'Guardar cambios en «Referencia»');
    await p.click('#escCambios'); await esperarToast(p, 'Cambios guardados');
    [d] = await docs(p);
    assert.equal((await docs(p)).length, 1);
    assert.deepEqual({ f: JSON.parse(d.layout).cams.cenital.f, editadoPor: d.editadoPor, nombre: d.nombre }, { f: 5, editadoPor: 'Prueba', nombre: 'Referencia' });
    // papelera (dos pulsaciones), restaurar
    await p.click('#escCur');
    const t1 = await dosVeces(p, '#escLista [data-borrar]', '¿Seguro?'); await esperarToast(p, 'Escena movida a la papelera');
    await hasta(p, () => [...globalThis.__fsStore.values()][0].borrado === true);
    await abrirPapelera(p);
    assert.equal(await p.textContent('#escPapCuenta'), '1');
    await p.click('#escPapLista [data-restaurar]'); await esperarToast(p, 'Escena restaurada');
    await hasta(p, () => [...globalThis.__fsStore.values()][0].borrado === false);
    await p.locator('#escLista [data-borrar]').waitFor();
    // Hallazgo v8 (fijado tal cual, sin arreglar): confirmar() no cancela el temporizador de 4 s de una confirmación
    // anterior de la misma escena. Pulsar «A la papelera», cerrar, volver a abrir y pulsar «A la papelera» y «¿Seguro?»
    // antes de que venza el primero: la segunda pulsación solo vuelve a pedir confirmación y la escena no se borra.
    await vencido(p, t1);
    const h = await p.evaluate(async () => {
      const q = s => document.querySelector(s), dormir = ms => new Promise(r => setTimeout(r, ms)), t0 = performance.now();
      q('#escLista [data-borrar]').click(); q('#escCerrar').click(); q('#escCur').click(); // primera confirmación y cerrar
      await dormir(1000); q('#escLista [data-borrar]').click();                            // nueva confirmación a t0 + 1 s
      await dormir(3500 - (performance.now() - t0)); const texto = q('#escLista [data-borrar]').textContent;
      await dormir(4500 - (performance.now() - t0)); q('#escLista [data-borrar]').click();   // «¿Seguro?» a t0 + 4,5 s
      await dormir(300); const borrado = [...globalThis.__fsStore.values()][0].borrado;
      await dormir(4300); return { texto, borrado };                                        // deja vencer todos los temporizadores
    });
    assert.deepEqual(h, { texto: '¿Seguro?', borrado: false });
    // borrar para siempre: primero a la papelera, después dos pulsaciones en «Borrar para siempre»
    await dosVeces(p, '#escLista [data-borrar]', '¿Seguro?');
    await hasta(p, () => [...globalThis.__fsStore.values()][0].borrado === true);
    await abrirPapelera(p);
    await dosVeces(p, '#escPapLista [data-def]', '¿Seguro? Se pierde'); await esperarToast(p, 'Escena borrada para siempre');
    await hasta(p, () => globalThis.__fsStore.size === 0);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('clave de grupo inválida: aviso de clave y sin poder guardar', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: '#g=clave-mala', esperarCalculo: false }); const p = s.page;
  try {
    await esperarToast(p, 'La clave del grupo no es válida');
    await p.click('#escCur');
    assert.equal(await p.isVisible('#escGuardarSec'), false);
    assert.match(await p.textContent('#escSoloLectura'), /^La clave del grupo del enlace no es válida o las reglas de Firestore no están publicadas/);
    assert.equal(await p.evaluate(() => globalThis.__fsStore.size), 0);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
