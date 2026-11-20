// Sección «Exportar a ROS» del panel «Datos» (T2.6; D8, I4, I7, DT38): la lista de ficherosRos() en su orden y agrupada
// por carpeta, «Descargar» de un fichero y «Descargar todo (.tar)» byte a byte, «Ver» y «Copiar», el repintado al cambiar el
// prefijo o el robot sin calcular planes, y la línea del giro de las cajas con las descargas desactivadas durante un cálculo.
// Las descargas se recogen con el evento `download` de Playwright; el .tar, con el tar del sistema (tests/tar-sistema.mjs).
// En el artefacto, la referencia es window.__g.ficherosRos(); en la web (sin __g), tests/fixtures/ros/<caso>/, que
// ros-referencias.test.mjs ata a ficherosRos() en el artefacto.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { arrancarServidor, RAIZ } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes, esperarToast, CLAVE_BUENA } from '../navegador.mjs';
import { CASOS_YAML, aplicarCaso } from '../medir.mjs';
import { extraer, lineaTv } from '../tar-sistema.mjs';

const DIR = path.join(RAIZ, 'tests/fixtures/ros');
const REF = JSON.parse(fs.readFileSync(path.join(DIR, 'casos.json'), 'utf8'));
const [NOMINAL, C203, C203P] = CASOS_YAML;
const fixture = (caso, nombre) => fs.readFileSync(path.join(DIR, caso, nombre));
const TRES = ['tf/mesa.yaml', 'celda.scene', 'usb_cam/camara_cenital.yaml']; // uno de tf/, la escena y un usb_cam (C1)
const huellaDe = texto => (/^# Huella de la disposición: ([0-9a-f]{8}) /m.exec(texto) || [])[1];
const GIRO_PLAN = '# Giro de las cajas: el del agarre que eligió el plan del gemelo.\n';
const GIRO_BASE = '# Giro de las cajas: provisional, hacia la base del robot: las trayectorias no están al día (Calcular).\n';
let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Lo que muestra la sección: la lista (por grupo), la huella, el frame, la línea del estado y qué botones están activos
function leerSeccion() {
  const $ = id => document.getElementById(id), li = [...document.querySelectorAll('#rosLista li[data-nombre]')], e = $('rosEstado');
  const btn = (l, r) => l.querySelector(`[data-ros="${r}"]`).disabled;
  return {
    visible: !$('rosSec').closest('.tab').hidden, nombres: li.map(l => l.dataset.nombre), huella: $('rosHuella').textContent, frame: $('rosFrame').textContent, cuenta: $('rosCuenta').textContent,
    grupos: [...document.querySelectorAll('#rosLista .rosGrupo')].map(g => ({ carpeta: g.dataset.carpeta, titulo: g.querySelector('h3').textContent, nombres: [...g.querySelectorAll('li')].map(l => l.dataset.nombre), visibles: [...g.querySelectorAll('li > code')].map(c => c.textContent), lineas: [...g.querySelectorAll('li > small')].map(c => c.textContent) })),
    giro: e.dataset.giro, ocupado: e.dataset.ocupado, estado: e.textContent, tar: $('btnRosTar').disabled, tarTxt: $('rosTarTxt').textContent,
    dl: li.map(l => btn(l, 'dl')), ver: li.map(l => btn(l, 'ver')), copiar: li.map(l => btn(l, 'copiar')), guia: $('rosGuia').href,
  };
}
// C1: la lista es la de ficherosRos(), en su orden, agrupada por carpeta: cada grupo es un tramo seguido de una misma carpeta,
// su título es celda_ros/<carpeta> y cada fila dice su nombre dentro de ella; ninguna carpeta (salvo la raíz) se reparte
function comprobarLista(sec, nombres, que) {
  assert.ok(sec.visible, `${que}: la sección está en el panel «Datos» abierto`);
  assert.deepEqual(sec.nombres, nombres, `${que}: los nombres de ficherosRos(), en su orden`);
  assert.equal(sec.cuenta, String(nombres.length));
  assert.deepEqual(sec.grupos.flatMap(g => g.nombres), nombres, `${que}: los grupos, en el orden de la lista`);
  sec.grupos.forEach((g, i) => {
    assert.equal(g.titulo, `celda_ros/${g.carpeta}`);
    g.nombres.forEach((n, j) => { assert.equal(n.slice(0, n.lastIndexOf('/') + 1), g.carpeta, `${n}: en el grupo de su carpeta`); assert.equal(g.carpeta + g.visibles[j], n, `${n}: se lee su nombre`); assert.ok(g.lineas[j].length > 10, `${n}: una línea que dice para qué sirve`); });
    if (i) assert.notEqual(g.carpeta, sec.grupos[i - 1].carpeta, 'dos grupos seguidos de la misma carpeta');
  });
  for (const c of new Set(sec.grupos.map(g => g.carpeta).filter(Boolean))) assert.equal(sec.grupos.filter(g => g.carpeta === c).length, 1, `${que}: ${c} en un solo grupo`);
  assert.equal(sec.guia, 'https://github.com/Aimargg/gemelo-celda/blob/main/docs/validar-en-ros.md');
}
// Una descarga: lo que hace `accion` debe disparar el evento download; devuelve su nombre y sus bytes
async function bajar(page, accion) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), accion()]);
  const partes = []; for await (const p of await d.createReadStream()) partes.push(p); // el navegador es remoto (lanzar): sin path()
  return { nombre: d.suggestedFilename(), bytes: Buffer.concat(partes) };
}
// Los botones se pulsan con click() en la página: page.click espera a que el botón esté quieto durante dos fotogramas y, con
// SwiftShader, cada fotograma de la página tarda (unos 1,5–3 s por descarga). Un botón desactivado no recibe el click().
const pulsar = (page, sel) => page.evaluate(q => document.querySelector(q).click(), sel);
const boton = (n, r) => `#rosLista li[data-nombre="${n}"] [data-ros="${r}"]`;
const bajarFichero = (page, n) => bajar(page, () => pulsar(page, boton(n, 'dl')));
const bajarTar = page => bajar(page, () => pulsar(page, '#btnRosTar'));
// C2: el .tar, con el tar del sistema: celda_ros/ con cada fichero byte a byte (en el orden de la lista), las carpetas antes
// de sus ficheros, 0644 (0755 los .sh y las carpetas) y la fecha 1970-01-01 00:00
function comprobarTar(bytes, ficheros, que) {
  const x = extraer(bytes), ruta = n => `celda_ros/${n}`;
  assert.deepEqual(x.nombres.filter(n => !n.endsWith('/')), ficheros.map(f => ruta(f.nombre)), `${que}: los ficheros, en su orden`);
  const carpetas = [...new Set(['', ...ficheros.map(f => f.nombre.slice(0, f.nombre.lastIndexOf('/') + 1))])].map(ruta);
  assert.deepEqual(x.nombres.filter(n => n.endsWith('/')), carpetas, `${que}: las carpetas`);
  for (const c of carpetas) assert.ok(x.nombres.indexOf(c) < x.nombres.findIndex(n => n !== c && n.startsWith(c)), `${c} antes de sus ficheros`);
  assert.deepEqual([...x.ficheros.keys()].sort(), ficheros.map(f => ruta(f.nombre)).sort(), `${que}: nada más que los ficheros`);
  for (const f of ficheros) assert.deepEqual(x.ficheros.get(ruta(f.nombre)), Buffer.from(f.texto, 'utf8'), `${que}: ${f.nombre} byte a byte`);
  for (const l of x.lista) {
    const v = lineaTv(l); assert.ok(v, `línea de tar -tvf: ${l}`); assert.equal(v.fecha, '1970-01-01 00:00', l);
    assert.equal(v.permisos, v.nombre.endsWith('/') ? 'drwxr-xr-x' : v.nombre.endsWith('.sh') ? '-rwxr-xr-x' : '-rw-r--r--', l);
  }
  assert.ok(x.lista.some(l => /^-rwxr-xr-x .* celda_ros\/tf_estaticas\.sh$/.test(l)), 'tf_estaticas.sh con 0755');
  return x;
}

test('T2.6 en el artefacto: lista y descargas (C1, C2), Ver y Copiar (C4), repintado sin cálculo (C5) y giro de las cajas con «Calcular» (C9), con nominal, el 203 y el 203 con prefijo', { timeout: 300000 }, async t => {
  const s = await abrir(srv.url), page = s.page;
  try {
    await s.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url });
    const ficheros = () => page.evaluate(() => window.__g.ficherosRos());
    const texto = (F, n) => F.find(f => f.nombre === n).texto;

    // ---------- nominal (tras el primer cálculo: giro del plan) ----------
    await aplicarCaso(page, NOMINAL);
    let F = await ficheros(), sec = await page.evaluate(leerSeccion);
    await t.test('nominal · C1: la sección lista los nombres de ficherosRos(), en su orden y agrupados por carpeta, con su huella', () => {
      comprobarLista(sec, F.map(f => f.nombre), 'nominal');
      assert.equal(sec.huella, huellaDe(F[0].texto)); assert.equal(sec.frame, 'base_link');
      assert.deepEqual(sec.grupos.map(g => g.carpeta), ['', 'tf/', '', 'camera_info/', 'usb_cam/']);
      assert.ok(F.every(f => f.nombre === 'celda.scene' ? f.texto.startsWith(`gemelo_celda_${sec.huella}\n`) : huellaDe(f.texto) === sec.huella), 'todos los ficheros llevan la huella que se ve (celda.scene, en el nombre de la escena)');
    });
    await t.test('nominal · C9: tras el primer cálculo, la línea dice que las cajas llevan el giro del plan', () => {
      assert.deepEqual([sec.giro, sec.ocupado, sec.tar, sec.dl.some(Boolean)], ['plan', '', false, false]);
      assert.match(sec.estado, /^giro del plan Las cajas de los platos llevan el giro del plan/);
      assert.ok(texto(F, 'escena_colision.yaml').includes(GIRO_PLAN));
    });
    const bajados = [];
    for (const n of TRES) bajados.push([n, await bajarFichero(page, n)]);
    await t.test('nominal · C1: «Descargar» de tf/mesa.yaml, celda.scene y un usb_cam baja ese fichero con su nombre y su texto byte a byte', () => {
      for (const [n, d] of bajados) { assert.equal(d.nombre, n.replace(/\//g, '_'), `${n}: el nombre (un navegador no descarga carpetas)`); assert.deepEqual(d.bytes, Buffer.from(texto(F, n), 'utf8'), `${n}: byte a byte`); }
    });
    const tar1 = await bajarTar(page), tar2 = await bajarTar(page);
    await t.test('nominal · C2: «Descargar todo (.tar)» baja celda_ros_<huella>.tar; el tar del sistema lo extrae byte a byte, 0644/0755 y 1970-01-01; dos descargas, mismos bytes', () => {
      assert.equal(tar1.nombre, `celda_ros_${sec.huella}.tar`); assert.ok(sec.tarTxt.includes(tar1.nombre));
      comprobarTar(tar1.bytes, F, 'nominal'); assert.deepEqual(tar2.bytes, tar1.bytes);
    });

    // ---------- C4: Ver y Copiar (con portapapeles y sin él) ----------
    await pulsar(page, boton('tf/mesa.yaml', 'ver'));
    const ver = await page.evaluate(() => { const t = document.getElementById('rosVer'); return { caja: !document.getElementById('rosVerCaja').hidden, valor: t.value, soloLectura: t.readOnly, etiqueta: document.getElementById('rosVerNombre').textContent, actual: document.querySelector('#rosLista li[aria-current="true"]').dataset.nombre }; });
    await pulsar(page, boton('celda.scene', 'copiar'));
    await esperarToast(page, 'Copiado: celda.scene');
    // En Windows, el portapapeles guarda el texto con \r\n (Chromium convierte cada \n al escribir): se compara con \n
    const copiado = await page.evaluate(() => navigator.clipboard.readText()).then(c => process.platform === 'win32' ? c.replace(/\r\n/g, '\n') : c);
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('sin permiso', 'NotAllowedError')); });
    await pulsar(page, boton('usb_cam/camara_cenital.yaml', 'copiar'));
    await esperarToast(page, 'Selecciona y copia con Ctrl+C');
    const seleccion = await page.evaluate(() => { const t = document.getElementById('rosVer'); delete navigator.clipboard.writeText; return { valor: t.value, foco: document.activeElement === t, desde: t.selectionStart, hasta: t.selectionEnd }; });
    await t.test('C4: «Ver» muestra el texto en el textarea de solo lectura; «Copiar» lo copia o, sin portapapeles, lo deja seleccionado (como #btnCopy)', () => {
      assert.deepEqual(ver, { caja: true, valor: texto(F, 'tf/mesa.yaml'), soloLectura: true, etiqueta: 'tf/mesa.yaml · solo lectura', actual: 'tf/mesa.yaml' });
      assert.equal(copiado, texto(F, 'celda.scene'));
      const u = texto(F, 'usb_cam/camara_cenital.yaml'); assert.deepEqual(seleccion, { valor: u, foco: true, desde: 0, hasta: u.length });
    });

    // ---------- C5: cambiar el robot y el prefijo repinta sin calcular (CALC.activo vigilado en cada escritura) ----------
    await pulsar(page, boton('tf/mesa.yaml', 'ver'));
    await page.evaluate(() => { const C = window.__g.CALC; let v = C.activo; window.__calcEmpezados = 0; Object.defineProperty(C, 'activo', { configurable: true, enumerable: true, get: () => v, set: x => { if (x) window.__calcEmpezados++; v = x; } }); });
    const foto = async () => ({ ...(await page.evaluate(() => ({ firma: JSON.parse(window.__g.firmaVal()), calc: window.__calcEmpezados, activo: window.__g.CALC.activo, alDia: window.__g.planesAlDia(), ver: document.getElementById('rosVer').value, F: window.__g.ficherosRos() }))), sec: await page.evaluate(leerSeccion) });
    const e0 = await foto();
    await aplicarCaso(page, C203); // robot 203 desde la pestaña Escena («Mantener la mesa») y vuelta a «Datos»
    const e1 = await foto();
    const r1 = await page.evaluate(() => { const f = window.__g.firmaVal(); document.querySelector('.tabs [data-tab="datos"]').click(); return [f, window.__g.firmaVal()]; }); // repintado a la fuerza
    await aplicarCaso(page, C203P); // el prefijo, con el panel «Datos» a la vista
    const e2 = await foto();
    await page.evaluate(() => { const C = window.__g.CALC, v = C.activo; Object.defineProperty(C, 'activo', { value: v, writable: true, configurable: true, enumerable: true }); });
    await t.test('C5: al cambiar el robot y el prefijo se repintan la lista, la huella y el fichero que se ve, sin calcular planes: CALC.activo no se pone a true y firmaVal solo cambia en lo que cambia el usuario', () => {
      for (const [e, que] of [[e1, 'robot'], [e2, 'prefijo']]) {
        assert.deepEqual([e.calc, e.activo, e.alDia], [0, false, false], `${que}: ningún cálculo empezado y las trayectorias siguen sin calcular`);
        comprobarLista(e.sec, e.F.map(f => f.nombre), que); assert.equal(e.sec.huella, huellaDe(e.F[0].texto), `${que}: la huella de ahora`);
        assert.equal(e.ver, texto(e.F, 'tf/mesa.yaml'), `${que}: «Ver» enseña el fichero de ahora`);
        assert.equal(e.sec.grupos[1].lineas[0], `TF estática ${e.sec.frame} → mesa`, `${que}: las líneas de las TF, repintadas`);
      }
      assert.notEqual(e1.sec.huella, e0.sec.huella); assert.notEqual(e2.sec.huella, e1.sec.huella);
      assert.deepEqual([e0.sec.frame, e1.sec.frame, e2.sec.frame], ['base_link', 'base_link', '203_base_link']);
      const f1 = structuredClone(e0.firma); f1[0] = '203'; f1[4].robotId = '203'; assert.deepEqual(e1.firma, f1, 'robot: solo cambian ROB.id y L.robotId');
      assert.equal(r1[0], r1[1], 'repintar el panel no cambia firmaVal');
      const f2 = structuredClone(e1.firma); f2[4].prefijoFrames = '203_'; assert.deepEqual(e2.firma, f2, 'prefijo: solo cambia L.prefijoFrames');
      assert.deepEqual([e1.sec.giro, e2.sec.giro], ['base', 'base'], 'sin calcular, el giro provisional');
    });

    // ---------- 203 con prefijo: C1 y C9 (giro provisional → Calcular → giro del plan) ----------
    F = await ficheros(); sec = await page.evaluate(leerSeccion);
    const bajados203 = []; for (const n of [...TRES, 'escena_colision.yaml']) bajados203.push([n, await bajarFichero(page, n)]);
    await t.test('203 con prefijo · C1: la lista y «Descargar» de tres ficheros (y de la escena de colisión), byte a byte; son los de la referencia', () => {
      comprobarLista(sec, F.map(f => f.nombre), '203-prefijo'); assert.equal(sec.huella, huellaDe(F[0].texto));
      assert.deepEqual(F.map(f => f.nombre), REF.casos.find(c => c.id === '203-prefijo').ficheros);
      for (const [n, d] of bajados203) { assert.equal(d.nombre, n.replace(/\//g, '_')); assert.deepEqual(d.bytes, Buffer.from(texto(F, n), 'utf8'), n); assert.deepEqual(d.bytes, fixture('203-prefijo', n), `${n}: la referencia`); }
    });
    await t.test('203 con prefijo · C9: tras aplicarCaso sin recalcular, la sección y la cabecera de escena_colision.yaml descargada dicen que el giro es el provisional', () => {
      assert.deepEqual([sec.giro, sec.ocupado], ['base', '']);
      assert.match(sec.estado, /^giro provisional Las cajas llevan el giro provisional, hacia la base del robot.*«Calcular trayectorias» pone el del plan\.$/);
      assert.ok(bajados203[3][1].bytes.toString('utf8').includes(GIRO_BASE));
    });
    await pulsar(page, boton('escena_colision.yaml', 'ver'));
    // «Calcular trayectorias», cuando la barra lo ofrece (la repinta pintarCalc cada 18 fotogramas), y, en la misma tarea
    // (síncrono), el estado de la sección: el cálculo ya ha empezado
    await page.waitForFunction(() => !document.getElementById('calcBar').hidden && !document.getElementById('btnCalc').disabled, null, { timeout: 60000, polling: 50 });
    const durante = await page.evaluate(src => { document.getElementById('btnCalc').click(); return { activo: window.__g.CALC.activo, ...new Function(`return (${src})()`)() }; }, leerSeccion.toString());
    await esperarPlanes(page);
    const despues = await page.evaluate(src => ({ ...new Function(`return (${src})()`)(), alDia: window.__g.planesAlDia(), textoVer: document.getElementById('rosVer').value, F: window.__g.ficherosRos() }), leerSeccion.toString());
    const escena = await bajarFichero(page, 'escena_colision.yaml');
    await t.test('203 con prefijo · C9: mientras CALC.activo, la sección lo dice y «Descargar» y «Descargar todo» están desactivados («Ver» y «Copiar» no); al terminar se repinta con el giro del plan y se reactivan', () => {
      assert.equal(durante.activo, true, 'el cálculo con el 203 tiene que estar en marcha');
      assert.deepEqual([durante.ocupado, durante.tar, durante.dl.every(Boolean), durante.ver.some(Boolean), durante.copiar.some(Boolean)], ['calculo', true, true, false, false]);
      assert.match(durante.estado, /^calculando Hay un cálculo de trayectorias en marcha: «Descargar» y «Descargar todo» se activan cuando termine/);
      assert.equal(despues.alDia, true);
      assert.deepEqual([despues.giro, despues.ocupado, despues.tar, despues.dl.some(Boolean)], ['plan', '', false, false]);
      assert.match(despues.estado, /^giro del plan /);
      const e = texto(despues.F, 'escena_colision.yaml');
      assert.ok(e.includes(GIRO_PLAN)); assert.equal(despues.textoVer, e, '«Ver» enseña la escena repintada');
      assert.deepEqual(escena.bytes, Buffer.from(e, 'utf8'), 'la escena que se descarga ahora es la del plan');
    });
    const tarA = await bajarTar(page), tarB = await bajarTar(page);
    await t.test('203 con prefijo · C2: el .tar con el giro del plan, byte a byte, y dos descargas iguales', () => {
      assert.equal(tarA.nombre, `celda_ros_${despues.huella}.tar`);
      comprobarTar(tarA.bytes, despues.F, '203-prefijo'); assert.deepEqual(tarB.bytes, tarA.bytes);
    });
    // Una búsqueda de una disposición (D.buscando, L es un candidato) también desactiva las descargas: se repinta el panel con
    // la búsqueda en marcha y después sin ella (vigilarRos lo hace solo cada 18 fotogramas, que con SwiftShader son segundos)
    const datos = () => pulsar(page, '.tabs [data-tab="datos"]');
    await page.evaluate(() => { window.__g.D.buscando = true; }); await datos();
    const buscando = await page.evaluate(leerSeccion);
    await page.evaluate(() => { window.__g.D.buscando = false; }); await datos();
    const libre = await page.evaluate(leerSeccion);
    await t.test('durante una búsqueda de disposición, las descargas también se desactivan y vuelven al terminar', () => {
      assert.deepEqual([buscando.ocupado, buscando.tar, buscando.dl.every(Boolean), buscando.ver.some(Boolean)], ['busqueda', true, true, false]);
      assert.match(buscando.estado, /^buscando Hay una búsqueda de una disposición en marcha/);
      assert.deepEqual([libre.ocupado, libre.tar, libre.dl.some(Boolean), libre.giro], ['', false, false, 'plan']);
    });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T2.6-C1 y C2 en la web: con nominal y con el 203 con prefijo, la lista, tres descargas y el .tar son los de la referencia, byte a byte', { timeout: 300000 }, async t => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), page = s.page;
  try {
    assert.equal(await page.evaluate(() => typeof window.__g), 'undefined', 'la web no lleva el gancho de pruebas');
    for (const c of [NOMINAL, C203P]) {
      if (c.robot !== 'nominal') { // como aplicarCaso, sin __g: el robot en la pestaña Escena («Mantener la mesa»)
        await pulsar(page, '.tabs [data-tab="escena"]'); await pulsar(page, `#segRobotId [data-v="${c.robot}"]`);
        if (await page.isVisible('#rpMesa')) await pulsar(page, '#rpMesa');
        await page.waitForSelector(`#segRobotId [data-v="${c.robot}"][aria-pressed="true"]`, { timeout: 60000 });
      }
      await pulsar(page, '.tabs [data-tab="datos"]');
      if (c.prefijo) { await page.selectOption('#prefijo', c.prefijo); await page.waitForFunction(f => document.getElementById('rosFrame').textContent === f, `${c.prefijo}base_link`, { timeout: 30000, polling: 50 }); }
      const ref = REF.casos.find(r => r.id === c.id), F = ref.ficheros.map(n => ({ nombre: n, texto: fixture(c.id, n).toString('utf8') }));
      const sec = await page.evaluate(leerSeccion), bajados = [];
      for (const n of TRES) bajados.push([n, await bajarFichero(page, n)]);
      const tar = await bajarTar(page);
      await t.test(`${c.id} · C1 y C2 en la web`, () => {
        comprobarLista(sec, ref.ficheros, c.id); assert.equal(sec.huella, huellaDe(F[0].texto));
        for (const [n, d] of bajados) { assert.equal(d.nombre, n.replace(/\//g, '_')); assert.deepEqual(d.bytes, fixture(c.id, n), `${n}: byte a byte`); }
        assert.equal(tar.nombre, `celda_ros_${sec.huella}.tar`); comprobarTar(tar.bytes, F, `${c.id} (web)`);
      });
    }
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
