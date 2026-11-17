// La salida de la bandeja frente a su balanceo (T2.8, DT30).
//  · T2.8-C2: en la disposición v27 del barrido (docs/estado/barrido-salida-v9-dev.md: persona +2 cm en x y en y, −5° de
//    giro, bandeja +2 cm por delante y −2 cm de altura), con el código de antes de T2.8 la demo «curso» (M0, 2 cm) para al ir
//    al reposo con START_STATE_IN_COLLISION contra la bandeja en las fases 0, 55,2 y 83,4 de la bandeja (medido con el
//    gemelo en T2.8; 0 es la de Validar). Con la comprobación nueva se completa en las tres, y al acabar cada subida y en el
//    arranque del movimiento siguiente (hasta 5 cm o 2 s) la pinza no toca la bandeja de ese instante (mismo obstáculo y
//    margen que el planificador). Falla con el código de antes: la demo para en el paso 8 en las tres fases.
//  · Las muestras del balanceo son el obstáculo «bandeja» de obstaculos(): la pose nominal coincide con la de la escena en
//    reposo, dos muestras seguidas (también la última y la primera: el periodo de 100 s se cierra) no mueven ninguna esquina
//    de la caja más de 1 mm, y no dependen de la fase de la demo (D.fase).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const GR = 5 * Math.PI / 180;
const V27 = { px: 0.02, py: 0.02, pyaw: -GR, ade: 0.02, alt: -0.02 };
const FASES = [0, 55.2, 83.4];

test('T2.8-C2 (DT30): en v27, la demo «curso» se completa en las tres fases y la salida no toca la bandeja', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(async ({ d, fases }) => {
      const g = window.__g; const L = g.L();
      L.persona.x += d.px; L.persona.y += d.py; L.persona.yaw += d.pyaw; L.bandeja.ade += d.ade; L.bandeja.alt += d.alt; g.aplicarLayout();
      const hBandeja = () => { // holgura (m) del brazo y la pinza con la bandeja de este instante, con su margen; < 0 = contacto
        const o = g.obstaculos().find(x => x.tag === 'bandeja'); g.choqueEn(g.robot.q.slice(), { w: g.pinza.w, carga: g.D.carga, obst: [], sinAuto: true });
        const C = g.COL(), X = C.X; let m = Infinity;
        for (let i = C.ini[2]; i < C.nAct; i++) {
          const k = i * 4, dx = X[k] - o.x, dy = X[k + 1] - o.y, lx = dx * o.c + dy * o.s, ly = -dx * o.s + dy * o.c, lz = X[k + 2] - o.z;
          const qx = Math.abs(lx) - o.hx, qy = Math.abs(ly) - o.hy, qz = Math.abs(lz) - o.hz, f = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
          m = Math.min(m, (f > 0 ? f : Math.max(qx, qy, qz)) - X[k + 3] - o.m);
        }
        return m;
      };
      const out = [];
      for (const fase of fases) {
        const salidas = [], vistos = new Set(); let cur = null, prev = null;
        const hasta = D => {
          if (cur && cur.arr) { cur.min = Math.min(cur.min, hBandeja()); if (g.tcpMundo().distanceTo(cur.p) > 0.05 || g.simT() - cur.t > 2) { salidas.push(+(cur.min * 1000).toFixed(1)); cur = null; } }
          else if (cur && D.estado !== prev) { cur.arr = true; cur.p = g.tcpMundo(); cur.t = g.simT(); cur.min = hBandeja(); } // acaba la subida
          else if (!cur && D.ctx && D.ctx.fase === 'bandeja' && D.platoEnPinza === null && !vistos.has(D.ctx.pk)) { vistos.add(D.ctx.pk); cur = { arr: false }; }
          prev = D.estado; return false;
        };
        const e = await g.ensayo({ perfil: 'curso', modo: 'M0', amp: 0.02, vel: 0.25, fase, sinRender: true, hasta });
        const f = g.D.falloDemo; out.push({ fase, fin: e.fin, paso: e.paso, causa: f ? f.causa : null, contra: f && f.info.choque ? f.info.choque.b : null, salidas });
      }
      return out;
    }, { d: V27, fases: FASES });
    for (const x of r) {
      assert.deepEqual({ fase: x.fase, fin: x.fin, paso: x.paso, causa: x.causa, contra: x.contra }, { fase: x.fase, fin: 'ok', paso: 8, causa: null, contra: null }, `fase ${x.fase}: la demo «curso» se completa`);
      assert.equal(x.salidas.length, 2, `fase ${x.fase}: se vigilan las dos salidas (${JSON.stringify(x.salidas)})`);
      assert.ok(x.salidas.every(h => h >= 0), `fase ${x.fase}: la pinza no toca la bandeja al acabar la subida ni al arrancar (holguras mínimas ${x.salidas.join(' y ')} mm)`);
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T2.8: las muestras del balanceo son el obstáculo de la bandeja, cubren su recorrido a 1 mm y no dependen de la fase', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(() => {
      const g = window.__g; const o = g.obstaculos().find(x => x.tag === 'bandeja'), b = g.bandejaBalanceo(), n0 = b.nominal;
      const dif = Math.max(...['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's', 'm'].map(k => Math.abs(o[k] - n0[k])));
      const esq = j => { const out = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * b.hx, ly = sy * b.hy; out.push([b.M[j] + lx * b.M[j + 3] - ly * b.M[j + 4], b.M[j + 1] + lx * b.M[j + 4] + ly * b.M[j + 3], b.M[j + 2] + sz * b.hz]); } return out; };
      let paso = 0; for (let i = 0; i < b.n; i++) { const a = esq(i * 5), c = esq(((i + 1) % b.n) * 5); for (let k = 0; k < 8; k++) paso = Math.max(paso, Math.hypot(a[k][0] - c[k][0], a[k][1] - c[k][1], a[k][2] - c[k][2])); }
      // con otra fase de la demo y la caché de muestras invalidada (persona 1e-12 m más allá, que cambia su clave)
      const fase0 = g.D.fase, x0 = g.L().persona.x; g.D.fase = 37.7; g.L().persona.x = x0 + 1e-12; const b2 = g.bandejaBalanceo();
      const igual = b2 !== b && b2.n === b.n && b2.M.every((v, i) => Math.abs(v - b.M[i]) < 1e-9); g.D.fase = fase0; g.L().persona.x = x0;
      return { dif, paso, n: b.n, igual };
    });
    assert.ok(r.dif < 1e-12, `la muestra nominal es el obstáculo «bandeja» de la escena en reposo (diferencia ${r.dif})`);
    assert.ok(r.paso <= 0.001 + 1e-9, `dos muestras seguidas mueven una esquina como mucho ${(r.paso * 1000).toFixed(3)} mm (${r.n} muestras)`);
    assert.equal(r.igual, true, 'con otra fase de la demo, las mismas muestras');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
