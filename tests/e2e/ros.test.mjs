// Ficheros de ROS de una disposición (T2.2 y T2.4; D8, I7): parametros_celda.yaml con nominal, el 203 y el 203 con prefijo
// (CASOS_YAML), en una sola página. Se comprueban con analizadores ajenos al gemelo: yaml@2.9.1 (YAML 1.1 y 1.2) y el
// validador de rcl de tests/rcl-params.mjs; las posiciones, contra posiciones.yaml (el mismo texto) y contra la disposición
// en world con world_base_link de tests/fixtures/cinematica/<id>.json (ida y vuelta).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createRequire } from 'node:module';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar } from '../navegador.mjs';
import { CASOS_YAML, aplicarCaso } from '../medir.mjs';
import { problemasParams } from '../rcl-params.mjs';
const ORIGEN = createRequire(import.meta.url)('../../src/origen.js');

const MESA_H = 0.76, ENTEROS = { enteros: ['celda.marcadores.ids'] };
const REF = id => JSON.parse(fs.readFileSync(path.join(RAIZ, `tests/fixtures/cinematica/${id}.json`), 'utf8')).world_base_link.individual;
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Lo que hace falta de la página en cada caso: los ficheros (dos veces), posiciones.yaml, la disposición y las poses de los
// objetos que dibuja el gemelo (bandeja y zonas en world)
function leerPagina() {
  const g = window.__g, L = g.L(), V = g.robot.root.position.constructor;
  g.bandeja.updateMatrixWorld(true);
  const zonas = Object.fromEntries(['zona_primero', 'zona_segundo'].map(k => { const p = g.zonasB[k].getWorldPosition(new V()); return [k, { x: p.x, y: p.y, z: p.z }]; }));
  return {
    ficheros: g.ficherosRos(), otra: g.ficherosRos(), yaml: g.generarYaml(), L: JSON.parse(JSON.stringify(L)), base: g.BASES[L.robot], robotId: g.ROB.id,
    bandeja: { x: g.bandeja.position.x, y: g.bandeja.position.y, z: g.bandeja.position.z, yaw: g.bandeja.rotation.z }, zonas,
  };
}
const texto = (r, nombre) => { const f = r.ficheros.find(x => x.nombre === nombre); assert.ok(f, `falta ${nombre}`); return f.texto; };

// Hojas de un YAML con su texto fuente: ruta → { fuente, valor, comillas }. Las rutas de los arrays llevan [i].
function hojas(src, nodo, ruta = '', out = new Map()) {
  if (YAML.isMap(nodo)) for (const p of nodo.items) hojas(src, p.value, ruta ? `${ruta}.${p.key.value}` : String(p.key.value), out);
  else if (YAML.isSeq(nodo)) nodo.items.forEach((it, i) => hojas(src, it, `${ruta}[${i}]`, out));
  else out.set(ruta, { fuente: src.slice(nodo.range[0], nodo.range[1]), valor: nodo.value, comillas: nodo.type === 'QUOTE_SINGLE' || nodo.type === 'QUOTE_DOUBLE' });
  return out;
}
const docDe = src => { const d = YAML.parseDocument(src); assert.deepEqual(d.errors, []); return d; };
const celdaDe = src => hojas(src, docDe(src).contents.items[0].value.items[0].value.items[0].value); // /** → ros__parameters → celda

// T2.2-C2: tabla de correspondencias posiciones.yaml → parametros_celda.yaml (rutas dentro de celda). Una regla da el
// parámetro (o los parámetros) de cada valor de posiciones.yaml; `pos` son las hojas de posiciones.yaml.
const I = c => 'xyz'.indexOf(c);
const CORRESPONDENCIAS = [
  [/^robot$/, () => ['robot.posicion']],
  [/^robot_id$/, () => ['robot.id']], // un id: en posiciones.yaml sin comillas, en los parámetros como string (decisión 3)
  [/^frame$/, () => ['robot.frame']],
  [/^prefijo_frames$/, () => ['robot.prefijo_frames']],
  [/^world_a_base_link\.([xyz])$/, m => [`robot.world_a_base_link.xyz[${I(m[1])}]`]],
  [/^world_a_base_link\.yaw_rad$/, () => ['robot.world_a_base_link.yaw']],
  [/^pose_en_world_doble\.frame$/, () => ['robot.frame']],
  [/^pose_en_world_doble\.([xyz])$/, m => [`robot.pose_en_world_doble.xyz[${I(m[1])}]`]],
  [/^pose_en_world_doble\.yaw_rad$/, () => ['robot.pose_en_world_doble.yaw']],
  [/^pinza\.(modelo|tcp_z_m|carrera_m)$/, m => [`pinza.${m[1]}`]],
  [/^mesa\.ancho_m$/, () => ['mesa.tamano_m[0]']], [/^mesa\.fondo_m$/, () => ['mesa.tamano_m[1]']], [/^mesa\.alto_m$/, () => ['mesa.tamano_m[2]']],
  [/^mesa\.centro_en_base_link\.([xy])$/, m => [`mesa.xyz[${I(m[1])}]`]],
  [/^mesa\.yaw_rad$/, () => ['mesa.yaw']],
  [/^pedido$/, () => ['pedido']],
  [/^platos\.sobre_caja$/, () => ['platos.sobre_caja']],
  [/^platos\.caja_lado_m$/, () => ['platos.caja_tamano_m[0]', 'platos.caja_tamano_m[1]']], // caja cuadrada: lado × lado × alto
  [/^platos\.caja_alto_m$/, () => ['platos.caja_tamano_m[2]']],
  [/^platos\.(agarre|radio_agarre_m)$/, m => [`platos.${m[1]}`]],
  [/^objetos\.zona_fruta\.([xyz])$/, m => [`zona_fruta.xyz[${I(m[1])}]`]],
  [/^objetos\.zona_fruta\.yaw_rad$/, () => ['zona_fruta.yaw']],
  [/^objetos\.zona_fruta\.ancho_m$/, () => ['zona_fruta.tamano_m[0]']], [/^objetos\.zona_fruta\.fondo_m$/, () => ['zona_fruta.tamano_m[1]']],
  [/^objetos\.(plato_\d)\.([xyz])$/, m => [`platos.${m[1]}.xyz[${I(m[2])}]`]],
  [/^objetos\.marcador_entrega_(\d)\.id$/, m => [`marcadores.ids[${m[1] - 1}]`]],
  [/^objetos\.marcador_entrega_(\d)\.diccionario$/, (m, pos) => [`marcadores.marcador_${pos.get(`objetos.marcador_entrega_${m[1]}.id`).fuente}.diccionario`]],
  [/^objetos\.marcador_entrega_(\d)\.([xyz])$/, (m, pos) => [`marcadores.marcador_${pos.get(`objetos.marcador_entrega_${m[1]}.id`).fuente}.xyz[${I(m[2])}]`]],
  [/^objetos\.bandeja_recepcion\.([xyz])$/, m => [`bandeja.xyz[${I(m[1])}]`]],
  [/^objetos\.bandeja_recepcion\.yaw_rad$/, () => ['bandeja.yaw']],
  [/^objetos\.(zona_primero|zona_segundo)\.([xyz])$/, m => [`bandeja.${m[1]}.xyz[${I(m[2])}]`]],
  [/^objetos\.persona\.([xy])$/, m => [`persona.xy[${I(m[1])}]`]],
  [/^objetos\.persona\.yaw_rad$/, () => ['persona.yaw']],
  [/^camaras\.camara_(\w+)\.(grupo|modelo|focal_mm|modo|hfov_rad)$/, m => [`camaras.${m[1]}.${m[2]}`]],
  [/^camaras\.camara_(\w+)\.posicion\.([xyz])$/, m => [`camaras.${m[1]}.xyz[${I(m[2])}]`]],
  [/^camaras\.camara_(\w+)\.(mira|pinza_mesa)\.([xyz])$/, m => [`camaras.${m[1]}.${m[2]}[${I(m[3])}]`]],
  [/^camaras\.camara_(\w+)\.orientacion_rad\.(giro|inclinacion|alabeo)$/, m => [`camaras.${m[1]}.orientacion_rad.${m[2]}`]],
];
// Lo que solo está en los parámetros (decisión 5 del brief): los frame_id de las TF, el rpy del marco de cada cámara, el giro
// y el lado de cada marcador, la z de la cara de arriba de la mesa (0 en base_link) y la lista de cámaras
const SOLO_PARAMETROS = [
  /^mesa\.frame_id$/, /^mesa\.xyz\[2\]$/, /^platos\.plato_\d\.frame_id$/, /^zona_fruta\.frame_id$/,
  /^marcadores\.marcador_\d+\.(frame_id|yaw|lado_m)$/, /^bandeja\.frame_id$/, /^bandeja\.zona_(primero|segundo)\.frame_id$/,
  /^camaras\.nombres\[\d+\]$/, /^camaras\.\w+\.frame_id$/, /^camaras\.\w+\.rpy\[[012]\]$/,
];
function destinos(ruta, pos) {
  for (const [re, f] of CORRESPONDENCIAS) { const m = ruta.match(re); if (m) return f(m, pos); }
  return null;
}

// Ida y vuelta (I7): un punto de base_link en world con world_base_link del JSON del robot (p_w = R·p_b + base, tablero a 0,76)
const aMundo = (T, b, p) => [0, 1, 2].map(r => T[4 * r] * p[0] + T[4 * r + 1] * p[1] + T[4 * r + 2] * p[2] + [b.x, b.y, MESA_H][r]);
const giro = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// El redondeo a 1 mm se hace en los ejes de base_link: la diferencia en world, vuelta a esos ejes (Rᵀ·d), queda en ±0,5 mm
// por eje. En los ejes de world, girados −135° con el 203, el mismo error llega a 0,71 mm (0,5·(cos + sen) de 45°).
let RT = null; // R de world_base_link del caso que se comprueba
const cerca = (a, b, que) => {
  const n = b.length, d = [0, 1, 2].map(i => i < n ? a[i] - b[i] : 0), e = [0, 1, 2].map(c => RT[c] * d[0] + RT[4 + c] * d[1] + RT[8 + c] * d[2]);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(e[i]) <= 0.5e-3 + 1e-9, `${que}: (${a.slice(0, n)}) frente a (${b}); ${(e[i] * 1000).toFixed(3)} mm en el eje ${'xyz'[i]} de base_link (±0,5 mm)`);
};
const mismoGiro = (a, b, que) => assert.ok(giro(a, b) <= 0.001 + 1e-9, `${que}: ${a} frente a ${b} (±0,001 rad)`);

test('T2.2 con nominal, el 203 y el 203 con prefijo: parametros_celda.yaml (C1–C4) y Común-C1 en la misma página', { timeout: 300000 }, async t => {
  const s = await abrir(srv.url);
  try {
    const res = [];
    for (const c of CASOS_YAML) { await aplicarCaso(s.page, c); res.push({ c, ...(await s.page.evaluate(leerPagina)) }); }
    comprobar(s.reg);
    for (const r of res) {
      const p = texto(r, 'parametros_celda.yaml');
      await t.test(`${r.c.id} · T2.2-C1: cumple las reglas de rcl (YAML 1.1 = 1.2, /** → ros__parameters, hojas válidas, sin listas de mapas)`, () => {
        assert.deepEqual(problemasParams(p, ENTEROS), []);
        const v = YAML.parse(p);
        assert.deepEqual(Object.keys(v), ['/**']); assert.deepEqual(Object.keys(v['/**']), ['ros__parameters']); assert.deepEqual(Object.keys(v['/**'].ros__parameters), ['celda']);
      });
      await t.test(`${r.c.id} · T2.2-C2: cada valor de posiciones.yaml tiene su parámetro con el mismo texto; el resto está en la lista de solo parámetros`, st => {
        const pos = hojas(r.yaml, docDe(r.yaml).contents), par = celdaDe(p), usados = new Set();
        for (const [ruta, h] of pos) {
          if (ruta === 'fecha') continue;
          const ds = destinos(ruta, pos); assert.ok(ds, `${ruta}: no está en la tabla de correspondencias`);
          for (const d of ds) {
            const q = par.get(d); assert.ok(q, `${ruta} → ${d}: no está en parametros_celda.yaml`); usados.add(d);
            if (typeof h.valor === 'number' && ruta === 'robot_id') assert.ok(q.comillas && q.valor === h.fuente, `${ruta} → ${d}: '${h.fuente}' entre comillas`);
            else if (typeof h.valor === 'number') { assert.ok(!q.comillas, `${d}: número sin comillas`); assert.equal(q.fuente, h.fuente, `${ruta} → ${d}`); }
            else assert.deepEqual([typeof q.valor, q.valor], [typeof h.valor, h.valor], `${ruta} → ${d}`);
          }
        }
        const solo = [...par.keys()].filter(d => !usados.has(d));
        for (const d of solo) assert.ok(SOLO_PARAMETROS.some(re => re.test(d)), `${d}: ni en posiciones.yaml ni en la lista de solo parámetros`);
        st.diagnostic(`${usados.size} parámetros con su valor de posiciones.yaml; solo en los parámetros (${solo.length}): ${solo.join(', ')}`);
      });
      await t.test(`${r.c.id} · T2.2-C3: ida y vuelta, deshaciendo el prefijo y el giro se recupera la disposición en world (±0,5 mm, ±0,001 rad)`, () => {
        const c = YAML.parse(p)['/**'].ros__parameters.celda, L = r.L;
        assert.equal(c.robot.frame, `${c.robot.prefijo_frames}base_link`); assert.equal(c.robot.id, r.robotId);
        const J = REF(c.robot.id), T = J.T, yb = J.rpy[2], W = q => aMundo(T, r.base, q), xyz = o => [o.x, o.y, o.z]; RT = T;
        cerca(W(c.mesa.xyz), [0, 0, MESA_H], 'mesa'); mismoGiro(c.mesa.yaw + yb, 0, 'giro de la mesa');
        cerca(W(c.zona_fruta.xyz), [L.zona.x, L.zona.y, MESA_H], 'zona_fruta'); mismoGiro(c.zona_fruta.yaw + yb, L.zona.yaw, 'giro de la zona');
        const zp = MESA_H + (L.caja.on ? L.caja.h : 0);
        for (const k of ['plato1', 'plato2']) cerca(W(c.platos[k.replace('plato', 'plato_')].xyz), [L[k].x, L[k].y, zp], k);
        L.arucoE.forEach((a, i) => { const mk = c.marcadores[`marcador_${c.marcadores.ids[i]}`]; cerca(W(mk.xyz), [a.x, a.y, MESA_H], `marcador ${i + 1}`); mismoGiro(mk.yaw + yb, 0, `giro del marcador ${i + 1} (ejes de la mesa)`); });
        // la bandeja: la de la página y la de su fórmula (persona + adelante, a su altura, sin balanceo)
        const P = L.persona, bL = [P.x + Math.cos(P.yaw) * L.bandeja.ade, P.y + Math.sin(P.yaw) * L.bandeja.ade, L.bandeja.alt];
        cerca(W(c.bandeja.xyz), bL, 'bandeja (disposición)'); cerca(W(c.bandeja.xyz), xyz(r.bandeja), 'bandeja (página)');
        mismoGiro(c.bandeja.yaw + yb, P.yaw, 'giro de la bandeja'); mismoGiro(r.bandeja.yaw, P.yaw, 'giro de la bandeja de la página');
        for (const k of ['zona_primero', 'zona_segundo']) cerca(W(c.bandeja[k].xyz), xyz(r.zonas[k]), k);
        cerca(W([...c.persona.xy, 0]), [P.x, P.y], 'persona'); mismoGiro(c.persona.yaw + yb, P.yaw, 'giro de la persona');
        for (const [k, cam] of Object.entries(L.cams)) {
          const q = c.camaras[k]; cerca(W(q.xyz), xyz(cam.pos), `cámara ${k}`); cerca(W(q.mira), xyz(cam.mira), `mira de ${k}`); cerca(W(q.pinza_mesa), [cam.clamp.x, cam.clamp.y, MESA_H], `pinza de ${k}`);
          const d = [cam.mira.x - cam.pos.x, cam.mira.y - cam.pos.y, cam.mira.z - cam.pos.z], pan = Math.atan2(d[0], d[1]), tilt = Math.atan2(-d[2], Math.hypot(d[0], d[1]));
          mismoGiro(q.orientacion_rad.giro - yb, pan, `giro de ${k}`); mismoGiro(q.orientacion_rad.inclinacion, tilt, `inclinación de ${k}`); mismoGiro(q.orientacion_rad.alabeo, cam.roll || 0, `alabeo de ${k}`);
          // el marco del cuerpo (REP-103): roll = −alabeo, pitch = inclinación, yaw = π/2 − giro (en world, + el de base_link)
          mismoGiro(q.rpy[0], -(cam.roll || 0), `roll de ${k}`); mismoGiro(q.rpy[1], tilt, `pitch de ${k}`); mismoGiro(q.rpy[2] + yb, Math.PI / 2 - pan, `yaw de ${k}`);
          assert.equal(q.focal_mm, cam.f); assert.equal(q.modo, cam.modo); assert.equal(q.grupo, cam.grupo);
        }
        assert.equal(c.platos.sobre_caja, L.caja.on); assert.equal(c.pedido, L.pedido === 1 ? 'un_plato' : 'dos_platos'); assert.equal(c.robot.posicion, L.robot);
      });
      await t.test(`${r.c.id} · T2.2-C4: cada hoja lleva al final de su línea el origen (MEDIDO, FABRICANTE, SUPUESTO o «${ORIGEN.ELEGIDO}»)`, () => {
        const cuerpo = p.split('\n').filter(l => l && !l.startsWith('#')), conValor = cuerpo.filter(l => /^\s*[^\s:#]+: \S/.test(l));
        const re = new RegExp(`  # (${[...ORIGEN.TIPOS, ORIGEN.ELEGIDO].join('|')})\\b`);
        for (const l of conValor) assert.match(l, re, l);
        for (const l of cuerpo.filter(l => !conValor.includes(l))) assert.match(l, /^\s*[^\s:#]+:$/, `línea sin valor ni origen: ${l}`);
        // una línea con valor por hoja: las de los arrays van en la misma línea que su clave
        const n = [...celdaDe(p).keys()].map(k => k.replace(/\[\d+\]$/, '')).filter((k, i, a) => a.indexOf(k) === i).length;
        assert.equal(conValor.length, n);
      });
      await t.test(`${r.c.id} · Común-C1: exportar dos veces da los mismos bytes y ningún fichero lleva fecha`, () => {
        assert.deepEqual(r.otra, r.ficheros);
        for (const f of r.ficheros) assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(f.texto), `${f.nombre}: sin fecha`);
      });
    }
  } finally { await s.cerrar(); }
});

test('Común-C1: tras recargar la página, la misma disposición da los mismos bytes en todos los ficheros', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await aplicarCaso(p, CASOS_YAML.find(c => c.id === '203-prefijo'));
    const antes = await p.evaluate(() => ({ L: JSON.stringify(window.__g.L()), f: window.__g.ficherosRos() }));
    // Tu mesa se guarda a los 400 ms del último cambio: se espera a que esté escrita antes de recargar
    await p.waitForFunction(l => localStorage.getItem('gemelo-ur3e-v4') === l, antes.L, { timeout: 30000, polling: 50 });
    // condición, no el evento load (con SwiftShader tarda más que el tiempo de navegación): el documento nuevo y su #loading
    await p.reload({ waitUntil: 'commit', timeout: 120000 });
    // cargado() ya ha colocado todo (ladoZonas incluido); los ficheros no dependen de las trayectorias: no se espera al cálculo
    await p.waitForFunction(() => document.readyState !== 'loading' && !!window.__g && !document.getElementById('loading'), null, { timeout: 120000, polling: 100 });
    const despues = await p.evaluate(() => ({ L: JSON.stringify(window.__g.L()), f: window.__g.ficherosRos() }));
    assert.equal(despues.L, antes.L, 'la misma disposición tras recargar');
    assert.deepEqual(despues.f, antes.f);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
