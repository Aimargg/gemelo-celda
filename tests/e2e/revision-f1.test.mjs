// Correcciones de la revisión independiente de la puerta de F1.
//  · H1: con «Validar» en marcha, «Reiniciar demo», el pedido y la búsqueda de una disposición no actúan (avisan). Antes
//    reiniciaban o movían la demo de la validación y la barra daba por «al día» una demo atascada.
//  · H2: si «Tu mesa» guardada no se puede abrir, su texto original se copia en «gemelo-ur3e-v4-ilegible» antes de que el
//    primer guardado la sustituya por la disposición de partida.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';

const CLAVE = 'gemelo-ur3e-v4', CLAVE_ILEG = 'gemelo-ur3e-v4-ilegible';
const ESC = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/escenas-v8/1-defecto.json'), 'utf8'));
const LAYOUT_V8 = JSON.parse(Buffer.from(ESC.codigo.slice('GEMELO1.'.length), 'base64').toString('utf8')).layout;

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

test('H1: con Validar en marcha, Reiniciar, el pedido y Buscar avisan y no tocan la demo de la validación', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(async () => {
      const g = window.__g; const pedido0 = g.L().pedido; const v = g.validar(); const dentro = {};
      // a mitad de la demo de la validación (ensayo de banco, ya en marcha)
      await new Promise(res => { const t = setInterval(() => { if (g.VAL.activo && g.D.banco && g.D.paso >= 1) { clearInterval(t); res(); } }, 10); });
      const run0 = g.D.run, paso0 = g.D.paso;
      document.getElementById('dReset').click();
      document.querySelector(`#segPedido button[data-v="${pedido0 === 1 ? 2 : 1}"]`).click();
      const busca = g.buscarAlternativa({ causa: 'alcance', fase: 'plato', pk: 'plato1' });
      Object.assign(dentro, { run: g.D.run === run0, paso: g.D.paso >= paso0, pedido: g.L().pedido === pedido0, buscando: g.D.buscando });
      await busca; await v;
      const x = g.VAL.res;
      return { dentro, alDia: g.valAlDia(), fin: x && [x.per.gemelo.demo.fin, x.per.curso.demo.fin], toasts: window.__toastsPrueba.slice() };
    });
    assert.deepEqual(r.dentro, { run: true, paso: true, pedido: true, buscando: false }, 'durante la validación nada reinicia la demo, cambia el pedido ni empieza una búsqueda');
    for (const t of ['reiniciar la demo', 'cambiar el pedido', 'buscar una disposición']) assert.ok(r.toasts.includes(`Espera a que termine la validación para ${t}`), `aviso «${t}»: ${JSON.stringify(r.toasts)}`);
    assert.deepEqual({ alDia: r.alDia, fin: r.fin }, { alDia: true, fin: ['ok', 'ok'] }, 'la disposición por defecto valida con los dos perfiles');
    // sin nada en marcha, Reiniciar sí reinicia
    const tras = await p.evaluate(() => { const g = window.__g, n = g.D.run; document.getElementById('dReset').click(); return { run: g.D.run > n, paso: g.D.paso }; });
    assert.deepEqual(tras, { run: true, paso: -1 });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('H2: una Tu mesa que no se puede abrir queda copiada antes de que el primer guardado la sustituya', { timeout: 300000 }, async () => {
  const mala = JSON.parse(JSON.stringify(LAYOUT_V8)); mala.cams.cenital.modo = '1x1'; // la v8 lo guardaba; validarLayout lo rechaza
  const texto = JSON.stringify(mala);
  const s = await abrir(srv.url, { initScripts: [{ content: `localStorage.setItem(${JSON.stringify(CLAVE)}, ${JSON.stringify(texto)});` }] }); const p = s.page;
  try {
    await p.waitForFunction(() => window.__toastsPrueba.some(t => t.startsWith('Tu mesa guardada no se puede abrir')), null, { timeout: 30000, polling: 50 });
    const aviso = await p.evaluate(() => window.__toastsPrueba.find(t => t.startsWith('Tu mesa guardada no se puede abrir')));
    assert.match(aviso, /se usa la disposición de partida y la original queda copiada en este navegador \(«gemelo-ur3e-v4-ilegible»\)$/);
    assert.equal(await p.evaluate(k => localStorage.getItem(k), CLAVE_ILEG), texto, 'la copia es el texto original, sin tocar');
    // el primer cambio guarda Tu mesa (la disposición de partida con el cambio) y la copia sigue
    await p.evaluate(() => document.querySelector('#segCaja button[aria-pressed="false"]').click());
    await p.waitForFunction(([k, t]) => localStorage.getItem(k) !== t, [CLAVE, texto], { timeout: 30000, polling: 50 });
    assert.equal(await p.evaluate(k => localStorage.getItem(k), CLAVE_ILEG), texto, 'tras guardar Tu mesa, la copia sigue');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
