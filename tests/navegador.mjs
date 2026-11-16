// Navegador de pruebas: Chromium de Playwright con SwiftShader (WebGL2 sin GPU) y una red cerrada.
// Qué intercepta (solo aquí, nunca en la página: I5):
//   · https://cdn.jsdelivr.net/npm/three@0.160.0/**  → node_modules/three (versión comprobada abajo)
//   · fonts.googleapis.com / fonts.gstatic.com       → respuesta vacía (la página cae a las fuentes del sistema)
//   · /config.js y /firebase.js del servidor local    → config de prueba y tests/mocks/firebase-mock.js (solo destino web)
// Cualquier otra petición fuera de 127.0.0.1 se aborta y queda en registro.externas; comprobar() la convierte en fallo (I2).
// Los WebSocket externos se cortan con ctx.routeWebSocket (nunca llegan al servidor) y también cuentan como externas.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './servidor.mjs';

const THREE_DIR = path.join(RAIZ, 'node_modules/three');
const THREE_VER = JSON.parse(fs.readFileSync(path.join(THREE_DIR, 'package.json'), 'utf8')).version;
if (THREE_VER !== '0.160.0') throw new Error(`node_modules/three es ${THREE_VER}; el gemelo usa 0.160.0 (npm install)`);
const FIREBASE_MOCK = fs.readFileSync(path.join(RAIZ, 'tests/mocks/firebase-mock.js'), 'utf8');
// Config de prueba: proyecto inexistente; nunca llega a la red porque firebase.js es el simulador
export const CONFIG_PRUEBA = 'window.FIREBASE_CONFIG = { apiKey: "clave-api-de-prueba", authDomain: "prueba.invalid", projectId: "gemelo-prueba", storageBucket: "prueba.invalid", messagingSenderId: "0", appId: "1:0:web:prueba" };\n';
export const CLAVE_BUENA = 'clave-buena'; // la única que acepta firebase-mock.js (I3: nunca la real)
const PERMITIDOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/e2e/permitidos.json'), 'utf8')).avisos;
const FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export function lanzar() { return chromium.launch({ args: FLAGS }); }

const esLocal = u => u.hostname === '127.0.0.1' || u.hostname === 'localhost';
const permitido = (tipo, texto) => PERMITIDOS.some(p => p.tipo === tipo && texto.includes(p.texto));

// Abre un destino del gemelo en un navegador propio y un contexto nuevo (almacenamiento limpio).
// Navegador por página: tras cerrar un contexto, su renderizado con SwiftShader sigue ocupando la CPU unos segundos
// y la siguiente carga pasa de ~14 s a ~23 s; cerrar el navegador entero lo evita (medido en T0.2).
// destino: 'artefacto' | 'artefacto-claude' | 'web'. hash: p. ej. '#g=clave-buena'. initScripts: funciones para addInitScript.
export async function abrir(base, { destino = 'artefacto', hash = '', prueba = true, esperarCalculo = true, initScripts = [] } = {}) {
  const browser = await lanzar();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const reg = { errores: [], avisos: [], externas: [], interceptadas: [] };
    // Observa (sin cambiarlos) los avisos emergentes de la página: window.__toastsPrueba guarda cada texto mostrado
    await ctx.addInitScript(() => {
      window.__toastsPrueba = [];
      document.addEventListener('readystatechange', () => {
        const el = document.getElementById('toast'); if (!el || el.__visto) return; el.__visto = true;
        new MutationObserver(() => { if (el.textContent) window.__toastsPrueba.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
      });
    });
    for (const f of initScripts) await ctx.addInitScript(f); // instrumentación de medida (T0.3), antes de cargar la página
    await ctx.route('**/*', async route => {
      const req = route.request(); const u = new URL(req.url());
      if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
      if (esLocal(u)) {
        if (destino === 'web' && u.pathname === '/config.js') { reg.interceptadas.push('config.js'); return route.fulfill({ body: CONFIG_PRUEBA, contentType: 'application/javascript' }); }
        if (destino === 'web' && u.pathname === '/firebase.js') { reg.interceptadas.push('firebase.js'); return route.fulfill({ body: FIREBASE_MOCK, contentType: 'application/javascript' }); }
        return route.continue();
      }
      if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.160.0/')) {
        const f = path.join(THREE_DIR, path.normalize(u.pathname.slice('/npm/three@0.160.0/'.length)));
        if (f.startsWith(THREE_DIR + path.sep) && fs.existsSync(f)) { reg.interceptadas.push(u.pathname); return route.fulfill({ path: f, contentType: 'application/javascript' }); }
      }
      if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
        reg.interceptadas.push(u.hostname); return route.fulfill({ body: '', contentType: u.hostname === 'fonts.googleapis.com' ? 'text/css' : 'font/woff2' });
      }
      reg.externas.push(`${req.method()} ${req.url()}`);
      return route.abort('blockedbyclient');
    });
    const ws = u => { const e = `WS ${u}`; if (!reg.externas.includes(e)) reg.externas.push(e); };
    await ctx.routeWebSocket(u => !esLocal(u), r => { ws(r.url()); r.close({ code: 1008, reason: 'bloqueado por el arnés de pruebas' }); });
    const page = await ctx.newPage();
    page.on('websocket', w => { if (!esLocal(new URL(w.url()))) ws(w.url()); }); // por si alguno escapara a la ruta
    page.on('pageerror', e => reg.errores.push(`pageerror: ${e.message}`));
    page.on('console', m => {
      const t = m.type(), txt = m.text();
      if ((t === 'error' || t === 'warning') && !permitido(t, txt)) (t === 'error' ? reg.errores : reg.avisos).push(`${t}: ${txt}${m.location().url ? ` (${m.location().url})` : ''}`);
    });
    const url = `${base}/${destino === 'web' ? 'index.html' : destino + '.html'}${prueba ? '?prueba' : ''}${hash}`;
    await page.goto(url);
    // Condición, no tiempo: desaparece #loading (o muestra el fallo de carga del modelo)
    await page.waitForFunction(() => { const l = document.getElementById('loading'); return !l || /No se ha podido/.test(l.textContent); }, null, { timeout: 120000 });
    const fallo = await page.evaluate(() => { const l = document.getElementById('loading'); return l ? l.textContent : null; });
    if (fallo) throw new Error(`La página no carga: ${fallo}\n${reg.errores.join('\n')}`);
    if (esperarCalculo) {
      if (destino === 'web') await page.waitForFunction(() => document.getElementById('calcBar').hidden, null, { timeout: 240000, polling: 100 }); // sin __g
      else if (prueba) await esperarPlanes(page);
    }
    return { ctx, page, reg, version: browser.version(), cerrar: () => browser.close() };
  } catch (e) { await browser.close().catch(() => { }); throw e; } // nada queda abierto si falla la carga
}

// Espera a que termine calcularPlanes (el primer cálculo arranca solo al cargar)
export async function esperarPlanes(page, timeout = 240000) {
  await page.waitForFunction(() => window.__g && !window.__g.CALC.activo, null, { timeout, polling: 100 });
}

// Espera a que la página haya mostrado un aviso emergente con ese texto exacto
export function esperarToast(page, texto, timeout = 30000) {
  return page.waitForFunction(t => window.__toastsPrueba.includes(t), texto, { timeout, polling: 50 });
}

// Falla si hubo peticiones externas no interceptadas, pageerror o errores/avisos de consola no permitidos
export function comprobar(reg) {
  const malos = [...reg.externas.map(e => `externa no interceptada: ${e}`), ...reg.errores, ...reg.avisos];
  if (malos.length) throw new Error(`El navegador registró ${malos.length} problema(s):\n  ${malos.join('\n  ')}`);
}
