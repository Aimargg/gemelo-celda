// Diseñador del tablero de la bandeja (T4.4): la sección «Tablero de la bandeja» de la pestaña «Cámaras» en los dos destinos.
// Las cifras se recalculan aparte: los valores de partida son los 4 marcadores de la escena (ids 6–9, de 32 mm; se leen también de
// la escena del artefacto), las esquinas salen de una fórmula polar (centro + lado·√2/2 en el ángulo del giro ± 45° y ± 135°) y el
// desvío de los centros, de la distancia de un punto a la recta que une los dos más separados. El YAML del panel (Ver, Copiar y
// Descargar) se compara con el texto escrito aquí, se valida con el analizador de ros de tests/rcl-params.mjs (yaml@2.9.1 en YAML
// 1.1 y 1.2) y se lee de vuelta para comprobar que sus esquinas salen de los valores de la tabla. Añadir, quitar, los campos
// inválidos (se marcan y no se aplican), el aviso de alineación con su tolerancia editable y Restaurar; nada de esto toca la
// disposición (L) ni los marcadores dibujados, ni entra en los ficheros de «Exportar a ROS», ni sale de la página (I1, I2, I4).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarToast, CLAVE_BUENA } from '../navegador.mjs';
import { problemasParams } from '../rcl-params.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const PI = Math.PI;
const ORDEN = ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda'];
const SUP = 'SUPUESTO (disposición propuesta, sin medir)', MAR = 'SUPUESTO (ids propuestos)', NOM = 'SUPUESTO (nombre propuesto)';
const CITA = '(percepcion-bandeja-personas «pose con varios marcadores», cita del plan sin comprobar aquí (el estudio no está en el repo))';
const DEF = [{ id: 6, lado: 0.032, x: 0.14, y: -0.17, yaw: 0 }, { id: 7, lado: 0.032, x: 0.14, y: 0, yaw: 0 }, { id: 8, lado: 0.032, x: 0.14, y: 0.17, yaw: 0 }, { id: 9, lado: 0.032, x: -0.05, y: 0.205, yaw: 0 }];
const FILAS_DEF = [{ id: '6', lado: '32', x: '140', y: '-170', yaw: '0' }, { id: '7', lado: '32', x: '140', y: '0', yaw: '0' }, { id: '8', lado: '32', x: '140', y: '170', yaw: '0' }, { id: '9', lado: '32', x: '-50', y: '205', yaw: '0' }];
// El mayor desvío de la escena: los dos centros más separados son el 6 y el 9 y el más alejado de su recta es el 8:
// |(−0,19)(0,34) − 0,375·0| / √(0,19² + 0,375²) = 153,7 mm, frente a la tolerancia de 0,5 × 32 mm = 16 mm
const DESVIO_DEF = 0.0646 / Math.hypot(0.19, 0.375);
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);
const f1 = v => v.toFixed(1).replace('.', ',');
const r3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
// Esquinas de un marcador en el orden de OpenCV, con la fórmula polar
const esquinas = m => { const r = m.lado * Math.SQRT2 / 2; return [3, 1, -1, -3].map(k => [m.x + r * Math.cos(m.yaw + k * PI / 4), m.y + r * Math.sin(m.yaw + k * PI / 4)]); };
const bloque = (m) => [`      marcador_${m.id}:`, `        id: ${m.id}  # ${MAR}`, `        lado_m: ${r3(m.lado)}  # ${MAR}`, `        centro_m: [${r3(m.x)}, ${r3(m.y)}, 0.000]  # ${SUP}`,
  `        yaw_rad: ${r3(m.yaw)}  # ${SUP}; giro del patrón sobre z, hacia +y de la bandeja`,
  ...esquinas(m).map(([x, y], i) => `        ${ORDEN[i]}: [${r3(x)}, ${r3(y)}, 0.000]  # ${SUP}; esquina del patrón con z saliendo de la cara impresa`)].join('\n') + '\n';
const datosEsperados = ms => ['/**:', '  ros__parameters:', '    tablero:', `      frame_id: 'bandeja'  # ${NOM}`, `      diccionario: 'DICT_4X4_50'  # ${MAR}`, `      ids: [${ms.map(m => m.id).join(', ')}]  # ${MAR}`,
  "      orden_esquinas: ['arriba_izquierda', 'arriba_derecha', 'abajo_derecha', 'abajo_izquierda']  # orden de OpenCV: arriba-izquierda, arriba-derecha, abajo-derecha y abajo-izquierda del patrón"].join('\n') + '\n' + ms.map(bloque).join('');
const datos = texto => texto.slice(texto.indexOf('/**:\n'));
const enterosDe = ms => ['tablero.ids', ...ms.map(m => `tablero.marcador_${m.id}.id`)];
const tablero = texto => YAML.parse(texto, { version: '1.2' })['/**'].ros__parameters.tablero;
const sinAviso = (n, desvio, tol) => `Sin aviso de alineación: los ${n} centros no quedan sobre una recta (el mayor desvío a la recta entre los dos marcadores más separados es ${f1(desvio * 1000)} mm, más que la tolerancia de ${f1(tol * 1000)} mm; SUPUESTO SIN VALIDAR).`;
const avisoRecta = (n, desvio, tol, frac) => `Aviso: los ${n} centros quedan sobre una recta (el mayor desvío es ${f1(desvio * 1000)} mm, dentro de la tolerancia de ${f1(tol * 1000)} mm = ${frac} lados de media, SUPUESTO SIN VALIDAR): la pose del tablero con varios marcadores es degenerada; separa algún marcador de la recta en el otro eje ${CITA}.`;
const avisoPocos = n => `Aviso: con ${n} ${n === 1 ? 'marcador' : 'marcadores'} los centros siempre quedan sobre una recta: la pose del tablero con varios marcadores es degenerada; añade marcadores fuera de esa recta ${CITA}.`;

// Lo que se ve y lo que hace la página
const abrirTablero = async p => { await p.click('.tabs [data-tab="camaras"]'); await p.locator('#tabTbl tbody tr').first().waitFor(); };
const valores = p => p.evaluate(() => [...document.querySelectorAll('#tabTbl tbody tr')].map(tr => Object.fromEntries([...tr.querySelectorAll('input')].map(i => [i.dataset.campo, i.value]))));
const campo = (fila, c) => `#tabTbl tbody tr:nth-child(${fila}) [data-campo="${c}"]`;
const invalido = (p, fila, c) => p.getAttribute(campo(fila, c), 'aria-invalid');
const titulo = (p, fila, c) => p.getAttribute(campo(fila, c), 'title');
const aviso = p => p.evaluate(() => { const e = document.getElementById('tabAviso'); return { texto: e.textContent, ...e.dataset }; });
const quitar = p => p.evaluate(() => [...document.querySelectorAll('#tabTbl [data-quitar]')].map(b => b.disabled));
const pulsar = (p, sel) => p.evaluate(q => document.querySelector(q).click(), sel); // sin esperar fotogramas quietos (SwiftShader)
const ver = async p => { await pulsar(p, '#btnTabVer'); return p.inputValue('#tabVer'); }; // el YAML de lo que hay ahora, recién generado
const escena = p => p.evaluate(() => JSON.stringify(window.__g.L()));
const marcadoresEscena = p => p.evaluate(() => window.__g.bandeja.children.filter(c => c.userData && c.userData.id !== undefined && c.userData.lado !== undefined).map(c => [c.userData.id, c.userData.lado, c.position.x, c.position.y, c.position.z, c.rotation.z]));
const nombresRos = p => p.evaluate(() => window.__g.ficherosRos().map(f => f.nombre));
async function bajar(page, accion) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), accion()]);
  const partes = []; for await (const x of await d.createReadStream()) partes.push(x); // el navegador es remoto: sin path()
  return { nombre: d.suggestedFilename(), bytes: Buffer.concat(partes) };
}
// El YAML leído de vuelta: cada esquina sale de los valores de la tabla (mm y grados) con la fórmula polar, ±0,5 mm del redondeo
function comprobarIdaYVuelta(texto, filas) {
  const T = tablero(texto), tol = 0.0005 + 1e-9, ms = filas.map(f => ({ id: +f.id, lado: +f.lado / 1000, x: +f.x / 1000, y: +f.y / 1000, yaw: +f.yaw * PI / 180 }));
  assert.deepEqual(T.ids, ms.map(m => m.id)); assert.deepEqual(T.orden_esquinas, ORDEN);
  for (const m of ms) {
    const k = T[`marcador_${m.id}`]; assert.equal(k.id, m.id); cerca(k.lado_m, m.lado, tol, `lado de ${m.id}`); cerca(k.centro_m[0], m.x, tol, 'centro x'); cerca(k.centro_m[1], m.y, tol, 'centro y'); cerca(k.yaw_rad, m.yaw, tol, 'giro');
    esquinas(m).forEach(([x, y], i) => { cerca(k[ORDEN[i]][0], x, tol, `${m.id} ${ORDEN[i]} x`); cerca(k[ORDEN[i]][1], y, tol, `${m.id} ${ORDEN[i]} y`); assert.equal(k[ORDEN[i]][2], 0); });
  }
}

test('T4.4-C4: la sección arranca con los 4 marcadores de la escena; Ver, Copiar y Descargar dan tablero_bandeja.yaml (texto a mano, reglas de ros, ida y vuelta); la escena no cambia', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url), p = s.page;
  try {
    await s.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url });
    await abrirTablero(p);
    const antes = await escena(p), sc = await marcadoresEscena(p);
    // los valores de partida son los marcadores dibujados en la bandeja: id, lado, posición (z = 0,6 mm sobre la cara) y giro
    assert.equal(sc.length, 4);
    DEF.forEach((m, i) => { assert.equal(sc[i][0], m.id); cerca(sc[i][1], m.lado, 1e-12, 'lado'); cerca(sc[i][2], m.x, 1e-12, 'x'); cerca(sc[i][3], m.y, 1e-12, 'y'); cerca(sc[i][4], 0.0006, 1e-12, 'z'); cerca(sc[i][5], m.yaw, 1e-12, 'giro'); });
    assert.deepEqual(await valores(p), FILAS_DEF);
    assert.equal((await p.textContent('#tabSec h2')).replace(/\s+/g, ' ').trim(), 'Tablero de la bandeja SIN VALIDAR');
    const a = await aviso(p);
    assert.equal(a.alineado, 'false'); assert.equal(a.motivo, ''); assert.equal(a.n, '4'); cerca(+a.desvio, DESVIO_DEF, 1e-12, 'desvío'); cerca(+a.tolerancia, 0.016, 1e-12, 'tolerancia');
    assert.equal(a.texto, sinAviso(4, DESVIO_DEF, 0.016));
    assert.deepEqual(await quitar(p), [false, false, false, false]);
    assert.equal(await p.evaluate(() => document.getElementById('tabVerCaja').hidden), true, 'el YAML no se ve hasta pulsar Ver');
    // Ver: el textarea es de solo lectura y lleva el YAML a mano de los cuatro marcadores
    const T = await ver(p);
    assert.equal(await p.evaluate(() => { const t = document.getElementById('tabVer'); return [document.getElementById('tabVerCaja').hidden, t.readOnly]; }).then(x => x.join()), 'false,true');
    assert.equal(datos(T), datosEsperados(DEF));
    assert.ok(T.includes('        arriba_izquierda: [-0.066, 0.221, 0.000]  # SUPUESTO (disposición propuesta, sin medir); esquina del patrón con z saliendo de la cara impresa\n'), 'una esquina a mano (marcador 9)');
    assert.equal(T.split('\n')[0], '# tablero_bandeja.yaml · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR');
    assert.match(T, /^# Origen de cada valor, al final de su línea \(D8\): SUPUESTO; /m); assert.doesNotMatch(T, /AVISO/); assert.doesNotMatch(T, /\d{4}-\d{2}-\d{2}/);
    assert.deepEqual(problemasParams(T, { enteros: enterosDe(DEF) }), [], 'las reglas de ros (YAML 1.1 y 1.2, sin alias ni listas de mapas)');
    assert.deepEqual(YAML.parse(T, { version: '1.1' }), YAML.parse(T, { version: '1.2' }));
    comprobarIdaYVuelta(T, await valores(p));
    assert.equal(await ver(p), T, 'dos veces, los mismos bytes');
    // Descargar baja ese mismo texto, con su nombre
    const d = await bajar(p, () => pulsar(p, '#btnTabDescargar'));
    assert.equal(d.nombre, 'tablero_bandeja.yaml'); assert.deepEqual(d.bytes, Buffer.from(T, 'utf8'));
    // Copiar: con portapapeles, lo copia; sin él, lo muestra seleccionado para copiarlo a mano
    await pulsar(p, '#btnTabCopiar'); await esperarToast(p, 'Copiado: tablero_bandeja.yaml');
    assert.equal(await p.evaluate(() => navigator.clipboard.readText()).then(c => process.platform === 'win32' ? c.replace(/\r\n/g, '\n') : c), T); // en Windows el portapapeles guarda \r\n (como ros-panel)
    await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('sin permiso', 'NotAllowedError')); });
    await pulsar(p, '#btnTabCopiar'); await esperarToast(p, 'Selecciona y copia con Ctrl+C');
    const sel = await p.evaluate(() => { const t = document.getElementById('tabVer'); delete navigator.clipboard.writeText; return { foco: document.activeElement === t, desde: t.selectionStart, hasta: t.selectionEnd, largo: t.value.length }; });
    assert.deepEqual(sel, { foco: true, desde: 0, hasta: T.length, largo: T.length });
    // captura del panel con el YAML a la vista (queda en la carpeta temporal del sistema)
    const png = await p.locator('#tabSec').screenshot();
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'es un PNG'); assert.ok(png.length > 5000, `captura de ${png.length} bytes`);
    const dir = path.join(os.tmpdir(), 'gemelo-celda-t44'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'tablero-bandeja.png'), png);
    // C5: nada de esto toca la escena, los marcadores dibujados ni los ficheros de «Exportar a ROS»
    assert.equal(await escena(p), antes, 'la disposición no cambia'); assert.deepEqual(await marcadoresEscena(p), sc);
    assert.ok(!(await nombresRos(p)).some(n => /tablero/.test(n)), 'tablero_bandeja.yaml no entra en los ficheros de ROS');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.4-C2 y C4: editar alinea o no los centros (aviso con su tolerancia), añadir y quitar, los campos inválidos no se aplican, la tolerancia es editable y Restaurar vuelve a los valores de partida', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url), p = s.page;
  try {
    await abrirTablero(p);
    const antes = await escena(p), sc = await marcadoresEscena(p);
    const estado = async () => tablero(await ver(p)); // el YAML de lo que hay ahora
    // --- alinear los cuatro sobre x = 140 mm: el 9 pasa a (140, 340)
    await p.locator(campo(4, 'x')).fill('140'); await p.locator(campo(4, 'y')).fill('340');
    let a = await aviso(p);
    assert.equal(a.alineado, 'true'); assert.equal(a.motivo, 'recta'); assert.equal(a.n, '4'); cerca(+a.desvio, 0, 1e-12, 'desvío 0'); cerca(+a.tolerancia, 0.016, 1e-12, 'tolerancia');
    assert.equal(a.texto, avisoRecta(4, 0, 0.016, '0,5'));
    const alineados = [...DEF.slice(0, 3), { id: 9, lado: 0.032, x: 0.14, y: 0.34, yaw: 0 }];
    let T = await ver(p);
    assert.equal(datos(T), datosEsperados(alineados), 'el YAML sigue a la tabla');
    assert.ok(T.split('\n').includes(`# AVISO: ${avisoRecta(4, 0, 0.016, '0,5').slice('Aviso: '.length)}`), 'el aviso va también en la cabecera del YAML');
    assert.deepEqual(problemasParams(T, { enteros: enterosDe(alineados) }), []);
    // con el YAML a la vista, cada cambio de la tabla lo repinta sin pulsar Ver
    await p.locator(campo(4, 'y')).fill('300'); assert.equal(datos(await p.inputValue('#tabVer')), datosEsperados([...DEF.slice(0, 3), { id: 9, lado: 0.032, x: 0.14, y: 0.3, yaw: 0 }]));
    // --- quitar: con 3 sigue alineado; con 2 y con 1 siempre hay aviso; con 1 no se puede quitar
    await pulsar(p, '#tabTbl tbody tr:nth-child(4) [data-quitar]');
    assert.equal((await valores(p)).length, 3); a = await aviso(p); assert.equal(a.alineado, 'true'); assert.equal(a.motivo, 'recta'); assert.equal(a.texto, avisoRecta(3, 0, 0.016, '0,5'));
    await pulsar(p, '#tabTbl tbody tr:nth-child(1) [data-quitar]');
    assert.deepEqual((await valores(p)).map(f => f.id), ['7', '8']); a = await aviso(p); assert.equal(a.motivo, 'pocos'); assert.equal(a.texto, avisoPocos(2));
    await pulsar(p, '#tabTbl tbody tr:nth-child(2) [data-quitar]');
    assert.deepEqual(await valores(p), [FILAS_DEF[1]]); a = await aviso(p); assert.equal(a.motivo, 'pocos'); assert.equal(a.texto, avisoPocos(1));
    assert.deepEqual(await quitar(p), [true], 'con un solo marcador no se puede quitar'); await pulsar(p, '#tabTbl tbody tr:nth-child(1) [data-quitar]');
    assert.equal((await valores(p)).length, 1); assert.deepEqual((await estado()).ids, [7]);
    // --- Restaurar: los 4 de la escena, la tolerancia de partida y el YAML oculto
    await pulsar(p, '#btnTabRestaurar');
    assert.deepEqual(await valores(p), FILAS_DEF); assert.equal(await p.evaluate(() => document.getElementById('tabVerCaja').hidden), true);
    a = await aviso(p); assert.equal(a.alineado, 'false'); assert.equal(a.texto, sinAviso(4, DESVIO_DEF, 0.016));
    // --- campos inválidos: se marcan con su motivo y no se aplican; el estado lo da el YAML recién generado
    await p.locator(campo(2, 'id')).fill('6');
    assert.equal(await invalido(p, 2, 'id'), 'true'); assert.match(await titulo(p, 2, 'id'), /el id 6 está repetido/); assert.deepEqual((await estado()).ids, [6, 7, 8, 9], 'un id repetido no se aplica');
    await p.locator(campo(1, 'id')).fill('20'); // al cambiar el otro, el 6 deja de estar repetido y se aplica
    assert.equal(await invalido(p, 2, 'id'), null); assert.equal(await titulo(p, 2, 'id'), null); assert.deepEqual((await estado()).ids, [20, 6, 8, 9]);
    for (const v of ['50', '1.5', '-1', '']) { await p.locator(campo(1, 'id')).fill(v); assert.equal(await invalido(p, 1, 'id'), 'true', `id ${JSON.stringify(v)}`); }
    assert.match(await titulo(p, 1, 'id'), /^marcador 1: el id NaN no es un entero de 0 a 49|^marcador 1: el id -1 no es un entero de 0 a 49/);
    await p.locator(campo(1, 'id')).fill('50'); assert.match(await titulo(p, 1, 'id'), /el id 50 no es un entero de 0 a 49 \(DICT_4X4_50\)/); assert.deepEqual((await estado()).ids, [20, 6, 8, 9], 'los ids malos no se aplican');
    for (const v of ['0', '-5', '']) { await p.locator(campo(3, 'lado')).fill(v); assert.equal(await invalido(p, 3, 'lado'), 'true', `lado ${JSON.stringify(v)}`); }
    await p.locator(campo(3, 'lado')).fill('0'); assert.match(await titulo(p, 3, 'lado'), /marcador con id 8: el lado 0 no es un número positivo \(m\)/);
    await p.locator(campo(3, 'x')).fill(''); assert.equal(await invalido(p, 3, 'x'), 'true'); assert.match(await titulo(p, 3, 'x'), /marcador con id 8: x NaN no es un número finito/);
    let e = await estado(); assert.equal(e.marcador_8.lado_m, 0.032, 'el lado malo no se aplica'); assert.equal(e.marcador_8.centro_m[0], 0.14, 'la x vacía no se aplica');
    await p.locator(campo(3, 'lado')).fill('40'); await p.locator(campo(3, 'x')).fill('150'); // válidos: se aplican y se quita la marca
    assert.equal(await invalido(p, 3, 'lado'), null); assert.equal(await invalido(p, 3, 'x'), null);
    e = await estado(); assert.equal(e.marcador_8.lado_m, 0.04); assert.equal(e.marcador_8.centro_m[0], 0.15);
    // lo que se escribe en mm y grados llega al modelo en m y rad: el 8 a 150 mm, 40 mm de lado y 90°
    await p.locator(campo(3, 'yaw')).fill('90'); await p.locator(campo(1, 'id')).fill('20'); T = await ver(p); // el id 1 aún enseñaba el «50» rechazado: la tabla vuelve a casar con el modelo
    const editado = [{ id: 20, lado: 0.032, x: 0.14, y: -0.17, yaw: 0 }, { id: 6, lado: 0.032, x: 0.14, y: 0, yaw: 0 }, { id: 8, lado: 0.04, x: 0.15, y: 0.17, yaw: 90 * PI / 180 }, DEF[3]];
    assert.equal(datos(T), datosEsperados(editado)); assert.deepEqual(problemasParams(T, { enteros: enterosDe(editado) }), []);
    comprobarIdaYVuelta(T, await valores(p));
    // --- añadir: el id libre siguiente al mayor (el mayor es 20 → 21), con el lado del último, en el centro de la bandeja y sin giro
    await pulsar(p, '#btnTabAnadir');
    let v = await valores(p); assert.equal(v.length, 5); assert.deepEqual(v[4], { id: '21', lado: '32', x: '0', y: '0', yaw: '0' });
    assert.equal(datos(await ver(p)), datosEsperados([...editado, { id: 21, lado: 0.032, x: 0, y: 0, yaw: 0 }]));
    // con el 49 en uso no hay «siguiente»: toma el primero libre desde 0
    await p.locator(campo(1, 'id')).fill('49'); await pulsar(p, '#btnTabAnadir');
    v = await valores(p); assert.deepEqual(v.map(f => f.id), ['49', '6', '8', '9', '21', '0']); assert.equal(await aviso(p).then(x => x.n), '6');
    // --- tolerancia editable (supuesto sin validar): Restaurar antes para partir de los cuatro de la escena
    await pulsar(p, '#btnTabRestaurar'); await p.click('#tabCfg summary');
    assert.equal(await p.inputValue('#tc_alineacion\\.fraccion'), '0.5'); assert.equal(await p.locator('#tabCfgCuerpo .tag', { hasText: 'SUPUESTO · SIN VALIDAR' }).count(), 1);
    assert.doesNotMatch(await p.textContent('#tabSec'), /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)/, 'una cita no comprobada');
    await p.locator('#tc_alineacion\\.fraccion').fill('5'); // 5 × 32 mm = 160 mm ≥ 153,7 mm: ya cuenta como alineado
    a = await aviso(p); assert.equal(a.alineado, 'true'); cerca(+a.tolerancia, 0.16, 1e-12, 'tolerancia de 5 lados'); assert.equal(a.texto, avisoRecta(4, DESVIO_DEF, 0.16, '5'));
    await p.locator('#tc_alineacion\\.fraccion').fill('4.5'); // 144 mm < 153,7 mm: ya no
    a = await aviso(p); assert.equal(a.alineado, 'false'); cerca(+a.tolerancia, 0.144, 1e-12, 'tolerancia de 4,5 lados'); assert.equal(a.texto, sinAviso(4, DESVIO_DEF, 0.144));
    for (const x of ['-1', '0', '']) { await p.locator('#tc_alineacion\\.fraccion').fill(x); assert.equal(await p.getAttribute('#tc_alineacion\\.fraccion', 'aria-invalid'), 'true', `fracción ${JSON.stringify(x)}`); cerca(+(await aviso(p)).tolerancia, 0.144, 1e-12, 'la fracción mala no se aplica'); }
    await pulsar(p, '#btnTabRestaurar');
    assert.equal(await p.inputValue('#tc_alineacion\\.fraccion'), '0.5'); assert.equal(await p.getAttribute('#tc_alineacion\\.fraccion', 'aria-invalid'), null);
    assert.deepEqual(await valores(p), FILAS_DEF); a = await aviso(p); cerca(+a.tolerancia, 0.016, 1e-12, 'tolerancia de partida'); assert.equal(a.alineado, 'false');
    // C5: nada de esto toca la escena ni los marcadores dibujados
    assert.equal(await escena(p), antes, 'la disposición no cambia'); assert.deepEqual(await marcadoresEscena(p), sc, 'los marcadores dibujados no cambian');
    assert.ok(!(await nombresRos(p)).some(n => /tablero/.test(n)));
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.4-C4 en la web: la misma sección, con los mismos valores de partida y el mismo YAML', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), p = s.page;
  try {
    assert.equal(await p.evaluate(() => typeof window.__g), 'undefined', 'la web no lleva el gancho de pruebas');
    await abrirTablero(p);
    assert.deepEqual(await valores(p), FILAS_DEF);
    const a = await aviso(p); assert.equal(a.alineado, 'false'); assert.equal(a.texto, sinAviso(4, DESVIO_DEF, 0.016));
    const T = await ver(p);
    assert.equal(datos(T), datosEsperados(DEF)); assert.deepEqual(problemasParams(T, { enteros: enterosDe(DEF) }), []);
    await p.locator(campo(4, 'x')).fill('140'); await p.locator(campo(4, 'y')).fill('340');
    assert.equal((await aviso(p)).texto, avisoRecta(4, 0, 0.016, '0,5'));
    const d = await bajar(p, () => pulsar(p, '#btnTabDescargar'));
    assert.equal(d.nombre, 'tablero_bandeja.yaml'); assert.deepEqual(d.bytes, Buffer.from(await p.inputValue('#tabVer'), 'utf8'));
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
