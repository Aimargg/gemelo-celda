// Salida de la bandeja sin contacto (T1.9, DT22) y primer punto de la ruta nivelada (DT23).
//  · T1.9-1: tras la salida y la subida, la postura en la que arranca el movimiento siguiente no toca nada con su contexto
//    (choqueEn null con la apertura y la carga de ese momento, sin nada permitido), en la disposición por defecto (caja, M0,
//    2 cm) y en un caso M1, con «gemelo» (que se separaría de lo que toca y lo taparía) y con «curso».
//  · T1.9-6: el primer punto de rutaNivelada es el TCP real de la postura de partida con la apertura de la petición.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { BASE } from '../medir.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Ensaya un caso y, cada vez que acaba de servir un plato (el estado pasa a TRANSITO_2 o a HECHO, justo antes de que
// empiece el movimiento siguiente), mira la postura con el contexto de ese movimiento: prepararMoveJ sin blandos ni
// nada permitido, que es lo que comprueba el arranque de «curso»
const salidas = (p, c) => p.evaluate(async c => {
  const g = window.__g; const vistas = []; let prev = null;
  const hasta = D => {
    if (D.estado !== prev && (D.estado === 'TRANSITO_2' || D.estado === 'HECHO')) {
      const ch = g.choqueEn(g.robot.q.slice(), { w: g.pinza.w, carga: g.D.carga });
      vistas.push({ estado: D.estado, w: +g.pinza.w.toFixed(3), carga: g.D.carga, choque: ch ? g.textoChoque(ch) : null });
    }
    prev = D.estado; return false;
  };
  const r = await g.ensayo({ ...c, hasta });
  return { fin: r.fin, paso: r.paso, vistas };
}, c);

test('T1.9-1: tras la salida de la bandeja, la pinza acaba libre con el contexto del movimiento siguiente', { timeout: 600000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    for (const c of [{ ...BASE, caja: true, modo: 'M0', amp: 0.02 }, { ...BASE, caja: true, modo: 'M1', amp: 0.02 }]) for (const perfil of ['gemelo', 'curso']) {
      const r = await salidas(p, { ...c, perfil }); const nombre = `${c.modo} ${c.amp * 100} cm ${perfil}`;
      assert.equal(r.fin, 'ok', `${nombre}: la demo se completa (paso ${r.paso})`);
      assert.deepEqual(r.vistas, [{ estado: 'TRANSITO_2', w: 0.03, carga: null, choque: null }, { estado: 'HECHO', w: 0.03, carga: null, choque: null }], `${nombre}: las dos salidas acaban libres`);
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T1.9-6 (DT23): el primer punto de rutaNivelada es el TCP real con la apertura de la petición (≤ 0,1 mm)', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    const r = await p.evaluate(() => {
      const g = window.__g; const pl = g.planPlatoCache('plato1', 'gemelo'), ch = pl.cadena; const w = 0.006;
      const o = { horiz: true, pitch: pl.pitch, flip: pl.flip, minZ: -0.3, w, carga: pl.carga, perfil: 'gemelo' };
      const rn = g.rutaNivelada(ch.qL, ch.pc2.pre, ch.pc2.yaw, o);
      const real = g.tcpDeQ(ch.qL, w).p, conPinza = g.tcpDeQ(ch.qL, g.pinza.w).p;
      return { pinzaW: g.pinza.w, ok: !!rn.ruta, d: rn.inicio ? rn.inicio.distanceTo(real) : null, dPinza: conPinza.distanceTo(real) };
    });
    assert.ok(Math.abs(r.pinzaW - 0.006) > 0.01, `la apertura de la pinza (${r.pinzaW}) no es la de la petición`);
    assert.ok(r.dPinza > 0.001, `con la apertura de la pinza el TCP queda a ${(r.dPinza * 1000).toFixed(2)} mm: la prueba distingue las dos`);
    assert.equal(r.ok, true, 'la ruta nivelada de la disposición por defecto existe');
    assert.ok(r.d !== null && r.d <= 1e-4, `primer punto a ${r.d === null ? '—' : (r.d * 1000).toFixed(3)} mm del TCP real`);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
