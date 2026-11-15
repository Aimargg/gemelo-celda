// e2e de carga de los dos destinos (D2) y de la red cerrada del arnés (I2). Forma parte de npm run test:rapido.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

describe('artefacto: dist/gemelo-celda.html envuelto con doctype y ?prueba', () => {
  let s;
  before(async () => { s = await abrir(srv.url, { destino: 'artefacto' }); });
  after(async () => { await s?.cerrar(); });

  test('carga sin pageerror ni errores o avisos de consola y expone window.__g', { timeout: 300000 }, async () => {
    const info = await s.page.evaluate(() => ({
      doctype: document.doctype && document.doctype.name,
      ganchos: ['ensayo', 'codigoEscena', 'abrirCodigo', 'guardarEscena'].map(k => typeof window.__g[k]),
      kin: typeof window.__g.KIN.ik, alDia: window.__g.planesAlDia(),
    }));
    assert.deepEqual(info, { doctype: 'html', ganchos: ['function', 'function', 'function', 'function'], kin: 'function', alDia: true });
    assert.ok(s.reg.interceptadas.includes('/npm/three@0.160.0/build/three.module.js'), 'three debe servirse desde node_modules');
    comprobar(s.reg);
  });

  test('una petición externa no interceptada (Firestore, Realtime DB, WebSocket u otro dominio) se corta y hace fallar la comprobación', { timeout: 60000 }, async () => {
    await s.page.evaluate(() => Promise.allSettled([
      fetch('https://firestore.googleapis.com/v1/projects/gemelo-prueba/databases/(default)/documents/grupos'),
      fetch('https://gemelo-prueba-default-rtdb.firebaseio.com/x.json'),
      fetch('https://example.com/'),
    ]));
    // WebSocket externo (el canal de Realtime DB): ctx.routeWebSocket lo cierra sin conectar con el servidor
    const w = await s.page.evaluate(() => new Promise(r => {
      const ws = new WebSocket('wss://gemelo-prueba-default-rtdb.firebaseio.com/.ws?v=5'); let mensajes = 0;
      ws.onmessage = () => mensajes++; ws.onclose = e => r({ code: e.code, mensajes }); setTimeout(() => r({ code: 'sin cerrar', mensajes }), 10000);
    }));
    assert.deepEqual(w, { code: 1008, mensajes: 0 });
    assert.equal(s.reg.externas.length, 4, s.reg.externas.join('\n'));
    assert.throws(() => comprobar(s.reg), err => /externa no interceptada: GET https:\/\/firestore\.googleapis\.com/.test(err.message)
      && /GET https:\/\/gemelo-prueba-default-rtdb\.firebaseio\.com/.test(err.message) && /example\.com/.test(err.message)
      && /externa no interceptada: WS wss:\/\/gemelo-prueba-default-rtdb\.firebaseio\.com/.test(err.message));
  });
});

test('web: index.html con config.js de prueba y firebase-mock.js carga sin errores y abre la barra de escenas', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` });
  try {
    assert.ok(s.reg.interceptadas.includes('config.js') && s.reg.interceptadas.includes('firebase.js'), 'config.js y firebase.js deben estar sustituidos');
    await s.page.waitForFunction(() => !/cargando/.test(document.getElementById('escMeta').textContent), null, { timeout: 30000 });
    await s.page.click('#escCur');
    const info = await s.page.evaluate(() => ({
      gancho: typeof window.__g, config: !!document.querySelector('script[src="config.js"]'),
      guardar: !document.getElementById('escGuardarSec').hidden, autor: !document.getElementById('escAutorFila').hidden,
      soloLectura: !document.getElementById('escSoloLectura').hidden, meta: document.getElementById('escMeta').textContent,
    }));
    assert.deepEqual(info, { gancho: 'undefined', config: true, guardar: true, autor: true, soloLectura: false, meta: 'ninguna escena guardada' });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
