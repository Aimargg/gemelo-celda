// Estimador de ancho de banda USB (T4.3): la sección «Ancho de banda USB» de la pestaña «Cámaras» en los dos destinos. Las
// cifras se recalculan aparte con las fórmulas (ancho × alto × bit por píxel × fps, ÷ el factor del MJPEG) desde el modo de cada
// cámara que da la página, y con la aritmética de los valores de partida (3 cámaras de 1920×1080 a 120 fps en MJPEG 10:1 en el
// bus 1: 398,1312 Mbit/s cada una; reserva máxima de 196,608; capacidad de 480 × 0,8 = 384). Editar el bus, la reserva, el formato
// y el factor cambia las sumas y los estados; pegar una salida SINTÉTICA de lsusb -v (escrita aquí, no real) rellena los
// dispositivos y elegir uno pone su bus y su reserva; una entrada mala no cambia nada; la escena (L) no cambia con nada de esto.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, CLAVE_BUENA } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

const FPS = { '1920x1080': 120, '1280x960': 120, '2048x1536': 30, '3840x2160': 30, '1280x720': 120 }; // los cinco modos de la ELP (app.js)
const RESERVA_MAX = 3 * 1024 * 8 * 8000 / 1e6; // 196,608 Mbit/s
const CAPACIDAD = 480 * 0.8; // Mbit/s
const cerca = (a, b, que) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${que}: ${a} frente a ${b}`);
const tasaMjpeg = (modo, factor) => { const [w, h] = modo.split('x').map(Number); return w * h * 16 * FPS[modo] / factor / 1e6; };

// Muestra SINTÉTICA de lsusb -v (no es de ningún equipo real): dos cámaras de alta velocidad en buses distintos
const dispositivo = (bus, dev, nombre, wmax) => `Bus 00${bus} Device 00${dev}: ID 0000:000${dev} ${nombre}
Device Descriptor:
  bcdUSB               2.00
  Interface Descriptor:
      bInterfaceNumber        1
      bAlternateSetting       1
      bInterfaceClass        14 Video
      Endpoint Descriptor:
        bEndpointAddress     0x81  EP 1 IN
        bmAttributes            5
          Transfer Type            Isochronous
        wMaxPacketSize     ${wmax}
        bInterval               1
`;
const MUESTRA = dispositivo(1, 4, 'Camara sintetica A', '0x1400  3x 1024 bytes') + dispositivo(2, 3, 'Camara sintetica B', '0x0c00  2x 1024 bytes');

const usbCams = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#usbCuerpo .usbcam')].map(e => [e.dataset.cam, { estado: e.dataset.estado, tasa: +e.dataset.tasa, reserva: +e.dataset.reserva, bus: +e.dataset.bus, texto: e.textContent }])));
const usbBuses = p => p.evaluate(() => [...document.querySelectorAll('#usbBuses .usbbus')].map(e => ({ bus: +e.dataset.bus, estado: e.dataset.estado, suma: +e.dataset.suma, tasa: +e.dataset.tasa, texto: e.textContent })));
const modos = p => p.evaluate(() => Object.fromEntries(Object.entries(window.__g.L().cams).map(([k, c]) => [k, c.modo])));
const escena = p => p.evaluate(() => JSON.stringify(window.__g.L()));
const abrirCamaras = async p => { await p.click('.tabs [data-tab="camaras"]'); await p.locator('#usbCuerpo .usbcam').first().waitFor(); };

test('T4.3-C5: tres cámaras en el bus 1 con la reserva máxima: la demanda de cada una, la suma del bus y el aviso del plan, con su origen', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await abrirCamaras(p);
    const M = await modos(p), C = await usbCams(p), claves = Object.keys(M);
    assert.equal(claves.length, 3); assert.deepEqual(Object.keys(C), claves);
    for (const k of claves) {
      cerca(C[k].tasa, tasaMjpeg(M[k], 10), `demanda de ${k}`); cerca(C[k].reserva, RESERVA_MAX, `reserva de ${k}`); assert.equal(C[k].bus, 1, `bus de ${k}`);
      assert.equal(C[k].estado, 'no', `${k}: 398 Mbit/s no caben en 196,6`); assert.match(C[k].texto, /el MJPEG tendría que comprimir al menos 20,[23]:1/); assert.match(C[k].texto, /supuesto: 10,0:1\s*SUPUESTO · SIN VALIDAR/);
      assert.match(C[k].texto, /reserva máxima\s*PLAN/);
    }
    const B = await usbBuses(p); assert.equal(B.length, 1); assert.equal(B[0].bus, 1); assert.equal(B[0].estado, 'no');
    cerca(B[0].suma, 3 * RESERVA_MAX, 'suma de las reservas'); cerca(B[0].tasa, claves.reduce((x, k) => x + tasaMjpeg(M[k], 10), 0), 'suma de la demanda');
    assert.match(B[0].texto, /589,8 de 384,0 Mbit\/s · no cabe/); assert.match(B[0].texto, /480 × 0,80\s*SUPUESTO · SIN VALIDAR/);
    const aviso = await p.textContent('#usbAviso');
    assert.match(aviso, /Aviso: con la reserva máxima cabe una cámara por bus/); assert.match(aviso, /camaras-colocacion «USB 2\.0», cita del plan sin comprobar aquí/); assert.match(aviso, /Bus 1: las 3 cámaras no caben/);
    assert.equal(await p.locator('#usbSec h2').textContent().then(t => t.replace(/\s+/g, ' ').trim()), 'Ancho de banda USB SIN VALIDAR');
    // supuestos: la reserva máxima es del plan y no se edita; el resto, SUPUESTO sin validar y editable
    await p.click('#usbCfg summary');
    assert.equal(await p.isDisabled('#uc_reserva\\.max'), true); assert.equal(await p.inputValue('#uc_mjpeg\\.factor'), '10'); assert.equal(await p.inputValue('#uc_bus\\.mbit'), '480');
    assert.equal(await p.locator('#usbCfgCuerpo .tag', { hasText: 'SUPUESTO · SIN VALIDAR' }).count(), 4); assert.equal(await p.locator('#usbCfgCuerpo .tag', { hasText: /^PLAN$/ }).count(), 1);
    assert.doesNotMatch(await p.textContent('#usbSec'), /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)|USB-IF/, 'una cita no comprobada');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.3-C6: bus, reserva, formato y factor cambian las sumas y los estados; los valores malos se marcan y no se aplican; Restaurar; la escena no cambia', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await abrirCamaras(p);
    const antes = await escena(p), M = await modos(p), [k1, k2, k3] = Object.keys(M);
    await p.click('#usbCfg summary');
    // un bus por cámara: cada bus tiene 196,608 de reserva de 384, pero la demanda MJPEG 10:1 (398) lo pasa
    await p.locator(`#usb_bus_${k2}`).fill('2'); await p.locator(`#usb_bus_${k3}`).fill('3');
    let B = await usbBuses(p); assert.deepEqual(B.map(b => b.bus), [1, 2, 3]); assert.deepEqual(B.map(b => b.estado), ['no', 'no', 'no']);
    cerca(B[1].suma, RESERVA_MAX, 'reserva del bus 2'); cerca(B[1].tasa, tasaMjpeg(M[k2], 10), 'demanda del bus 2');
    // con 30:1 la demanda baja a la tercera parte (132,7) y cada bus cumple
    await p.locator('#uc_mjpeg\\.factor').fill('30');
    B = await usbBuses(p); assert.deepEqual(B.map(b => b.estado), ['ok', 'ok', 'ok']);
    let C = await usbCams(p); for (const k of [k1, k2, k3]) { cerca(C[k].tasa, tasaMjpeg(M[k], 30), `demanda de ${k} con 30:1`); assert.equal(C[k].estado, 'ok', k); }
    assert.match(await p.textContent('#usbAviso'), /Con las reservas y los buses de ahora ningún bus se pasa/);
    // las tres otra vez en el bus 1: 589,8 de reserva > 384 aunque la demanda quepa
    await p.locator(`#usb_bus_${k2}`).fill('1'); await p.locator(`#usb_bus_${k3}`).fill('1');
    B = await usbBuses(p); assert.equal(B.length, 1); assert.equal(B[0].estado, 'no'); cerca(B[0].suma, 3 * RESERVA_MAX, 'tres reservas máximas');
    // reserva de 100 en la primera, que pasa a un bus propio: 132,7 de demanda no caben en 100
    await p.locator(`#usb_bus_${k2}`).fill('2'); await p.locator(`#usb_bus_${k3}`).fill('3'); await p.locator(`#usb_reserva_${k1}`).fill('100');
    C = await usbCams(p); cerca(C[k1].reserva, 100, 'reserva declarada'); assert.equal(C[k1].estado, 'no'); assert.equal(C[k2].estado, 'ok');
    // una reserva por encima del máximo y un bus que no es entero se marcan y no se aplican
    await p.locator(`#usb_reserva_${k1}`).fill('300'); assert.equal(await p.getAttribute(`#usb_reserva_${k1}`, 'aria-invalid'), 'true'); assert.equal((await usbCams(p))[k1].reserva, 100);
    await p.locator(`#usb_bus_${k1}`).fill('0'); assert.equal(await p.getAttribute(`#usb_bus_${k1}`, 'aria-invalid'), 'true'); assert.equal((await usbCams(p))[k1].bus, 1);
    await p.locator(`#usb_bus_${k1}`).fill('1.5'); assert.equal(await p.getAttribute(`#usb_bus_${k1}`, 'aria-invalid'), 'true'); assert.equal((await usbCams(p))[k1].bus, 1);
    await p.locator('#uc_mjpeg\\.factor').fill('-3'); assert.equal(await p.getAttribute('#uc_mjpeg\\.factor', 'aria-invalid'), 'true'); cerca((await usbCams(p))[k2].tasa, tasaMjpeg(M[k2], 30), 'el factor malo no se aplica');
    // formato YUYV: sin comprimir, 1920 × 1080 × 16 × 120 = 3981,312 Mbit/s en el modo de partida
    await p.locator(`#usb_reserva_${k1}`).fill(String(RESERVA_MAX)); await p.selectOption(`#usb_formato_${k1}`, 'yuyv');
    C = await usbCams(p); const [w, h] = M[k1].split('x').map(Number); cerca(C[k1].tasa, w * h * 16 * FPS[M[k1]] / 1e6, 'YUYV sin comprimir'); assert.equal(C[k1].estado, 'no'); assert.doesNotMatch(C[k1].texto, /el MJPEG tendría/);
    // Restaurar: todo vuelve a los valores de partida
    await p.click('#btnUsbRestaurar');
    C = await usbCams(p); for (const k of [k1, k2, k3]) { assert.equal(C[k].bus, 1); cerca(C[k].reserva, RESERVA_MAX, `reserva de ${k}`); cerca(C[k].tasa, tasaMjpeg(M[k], 10), `demanda de ${k}`); }
    assert.equal(await p.inputValue('#uc_mjpeg\\.factor'), '10'); assert.equal(await p.inputValue(`#usb_formato_${k1}`), 'mjpeg');
    assert.equal(await escena(p), antes, 'nada de esto toca la escena');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.3-C6: la salida de lsusb -v pegada rellena los dispositivos; elegir uno pone su bus y su reserva; una entrada mala no cambia nada', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await abrirCamaras(p);
    const antes = await escena(p), [k1, , k3] = Object.keys(await modos(p));
    await p.click('#usbLsusb summary');
    // sin análisis no hay selector de dispositivo
    assert.equal(await p.locator(`#usb_disp_${k3}`).count(), 0);
    await p.locator('#usbLsusbTxt').fill(MUESTRA); await p.click('#btnUsbAnalizar');
    assert.match(await p.textContent('#usbLsusbMsg'), /Analizado: 2 dispositivos, 2 cámaras de vídeo en alta velocidad/); assert.equal(await p.getAttribute('#usbLsusbMsg', 'role'), 'status');
    const devs = await p.evaluate(() => [...document.querySelectorAll('#usbLsusbRes .usbdev')].map(e => ({ bus: +e.dataset.bus, dispositivo: +e.dataset.dispositivo, video: e.dataset.video, reserva: +e.dataset.reserva, texto: e.textContent })));
    assert.deepEqual(devs.map(d => [d.bus, d.dispositivo, d.video]), [[1, 4, 'true'], [2, 3, 'true']]);
    cerca(devs[0].reserva, 3 * 1024 * 8 * 8000 / 1e6, 'reserva de la cámara A'); cerca(devs[1].reserva, 2 * 1024 * 8 * 8000 / 1e6, 'reserva de la cámara B');
    assert.match(devs[0].texto, /3 × 1024 B, bInterval 1/); assert.match(devs[1].texto, /2 × 1024 B, bInterval 1/);
    assert.equal(await p.locator('#usbLsusbRes [data-lsusb-bus]').count(), 2);
    // elegir un dispositivo pone su bus y su reserva máxima isócrona
    await p.selectOption(`#usb_disp_${k3}`, '2:3');
    let C = await usbCams(p); assert.equal(C[k3].bus, 2); cerca(C[k3].reserva, 2 * 1024 * 8 * 8000 / 1e6, 'reserva de la cámara elegida'); assert.equal(await p.inputValue(`#usb_bus_${k3}`), '2');
    await p.selectOption(`#usb_disp_${k1}`, '1:4'); C = await usbCams(p); assert.equal(C[k1].bus, 1); cerca(C[k1].reserva, RESERVA_MAX, 'la reserva de la cámara A es la máxima');
    // una entrada mal formada: error con la línea, y no cambia el análisis ni lo elegido
    await p.locator('#usbLsusbTxt').fill(dispositivo(1, 4, 'x', '0x1400  1x 1024 bytes')); await p.click('#btnUsbAnalizar');
    assert.match(await p.textContent('#usbLsusbMsg'), /No se ha aplicado nada: línea \d+: wMaxPacketSize 0x1400 \(3 × 1024\) no coincide con «1x 1024»/); assert.equal(await p.getAttribute('#usbLsusbMsg', 'role'), 'alert');
    assert.equal(await p.getAttribute('#usbLsusbTxt', 'aria-invalid'), 'true'); assert.equal(await p.locator('#usbLsusbRes .usbdev').count(), 2);
    C = await usbCams(p); assert.equal(C[k3].bus, 2); cerca(C[k3].reserva, 2 * 1024 * 8 * 8000 / 1e6, 'la reserva elegida sigue');
    await p.locator('#usbLsusbTxt').fill('esto no es lsusb'); await p.click('#btnUsbAnalizar');
    assert.match(await p.textContent('#usbLsusbMsg'), /No se ha aplicado nada: no hay ninguna línea «Bus … Device …»/); assert.equal(await p.locator('#usbLsusbRes .usbdev').count(), 2);
    // Quitar el análisis: sin dispositivos ni selector; los valores puestos a mano se quedan
    await p.click('#btnUsbQuitar'); assert.equal(await p.locator('#usbLsusbRes .usbdev').count(), 0); assert.equal(await p.locator(`#usb_disp_${k3}`).count(), 0);
    assert.equal((await usbCams(p))[k3].bus, 2);
    assert.equal(await escena(p), antes, 'pegar lsusb no toca la escena');
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});

test('T4.3-C5 en la web: la misma sección, con las mismas cifras de partida', { timeout: 300000 }, async () => {
  const s = await abrir(srv.url, { destino: 'web', hash: `#g=${CLAVE_BUENA}` }), p = s.page;
  try {
    assert.equal(await p.evaluate(() => typeof window.__g), 'undefined', 'la web no lleva el gancho de pruebas');
    await abrirCamaras(p);
    const C = await usbCams(p), B = await usbBuses(p);
    assert.equal(Object.keys(C).length, 3); assert.equal(B.length, 1); cerca(B[0].suma, 3 * RESERVA_MAX, 'suma de las reservas'); assert.equal(B[0].estado, 'no');
    for (const c of Object.values(C)) { cerca(c.reserva, RESERVA_MAX, 'reserva'); assert.equal(c.bus, 1); }
    assert.match(await p.textContent('#usbAviso'), /Aviso: con la reserva máxima cabe una cámara por bus/);
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
