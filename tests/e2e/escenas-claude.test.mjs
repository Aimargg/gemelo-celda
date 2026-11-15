// Escenas en la versión de artefacto con el almacén de claude.ai simulado por tests/legacy/mock_claude.html (T0.2 C6).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarToast } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Cambia la focal de la cenital desde su ficha de la pestaña Cámaras (las fichas solo existen con la pestaña abierta)
async function focal(p, v) {
  await p.click('.tabs [data-tab="camaras"]'); await p.locator('#f_cenital').waitFor();
  await p.evaluate(v => { const el = document.getElementById('f_cenital'); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
}

test('guardar una escena en el almacén de claude.ai y volver a abrirla', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'artefacto-claude' }); const p = s.page;
  try {
    await p.waitForFunction(() => window.__g.ALM.modo === 'claude' && window.__g.ALM.yo === 'A' && !window.__g.ESC.cargando, null, { timeout: 30000 });
    // guardar con la focal de la cenital a 5 mm
    await focal(p, 5);
    await p.click('#escCur');
    await p.fill('#escNombre', 'Propuesta claude'); await p.fill('#escNota', 'Cenital a 5 mm');
    await p.click('#escNueva'); await esperarToast(p, 'Escena guardada: el grupo ya puede verla');
    const items = await p.evaluate(() => window.__store.A.items);
    assert.equal(items.length, 1);
    assert.deepEqual({ nombre: items[0].nombre, nota: items[0].nota, f: items[0].layout.cams.cenital.f, ok: items[0].estado.ok },
      { nombre: 'Propuesta claude', nota: 'Cenital a 5 mm', f: 5, ok: true });
    // volver a Tu mesa, cambiar la focal y abrir la escena guardada desde la lista
    await p.click('#escPrev'); await esperarToast(p, 'Tu mesa');
    await focal(p, 3.6);
    assert.equal(await p.evaluate(() => window.__g.L().cams.cenital.f), 3.6);
    await p.click('#escCur'); await p.click('#escLista [data-abrir="0"]'); await esperarToast(p, 'Propuesta claude · tuya');
    assert.deepEqual(await p.evaluate(() => ({ f: window.__g.L().cams.cenital.f, nom: document.getElementById('escNom').textContent, cur: window.__g.ESC.cur && window.__g.ESC.cur.id })),
      { f: 5, nom: 'Propuesta claude', cur: items[0].id });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
