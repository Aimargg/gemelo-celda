// Unitario del estimador de ancho de banda USB (src/usb.js, sin navegador; T4.3): la reserva máxima (3 × 1024 B × 8000
// microtramas/s), las tasas calculadas aparte a mano, los estados en los bordes, la suma por bus y el aviso de cuántas caben
// con la reserva máxima, el catálogo con su fuente (el plan o SUPUESTO [SIN VALIDAR]) y el analizador de `lsusb -v` con una
// salida de MUESTRA SINTÉTICA escrita aquí (no es de ningún equipo real) y con entradas mal formadas, que fallan con la línea
// y sin resultado a medias. Las referencias son del plan (~196 Mbit/s, una cámara por bus) o salen de aritmética a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const USB = require('../../src/usb.js');
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);
const CFG = USB.cfgDefecto();

test('la reserva máxima sale de 3 transacciones × 1024 B × 8 bit × 8000 microtramas/s = 196,608 Mbit/s: los ~196 del plan', () => {
  assert.equal(3 * 1024 * 8 * 8000, 196608000);
  cerca(USB.RESERVA_MAX, 196.608, 1e-9, 'reserva máxima');
  assert.equal(Math.floor(USB.RESERVA_MAX), 196, 'la cifra del plan (~196)');
  assert.equal(CFG.reserva.max, USB.RESERVA_MAX);
});

test('tasa sin comprimir = ancho × alto × bit por píxel × fps (cada cifra hecha a mano); MJPEG = la de YUYV ÷ el factor', () => {
  cerca(USB.tasaMbit('yuyv', 640, 480, 30, CFG), 147.456, 1e-9, 'YUYV 640×480 a 30 (307200 × 16 × 30 = 147456000)');
  cerca(USB.tasaMbit('yuyv', 1920, 1080, 120, CFG), 3981.312, 1e-9, 'YUYV 1920×1080 a 120 (2073600 × 16 × 120 = 3981312000)');
  cerca(USB.tasaMbit('nv12', 1280, 720, 30, CFG), 331.776, 1e-9, 'NV12 1280×720 a 30 (921600 × 12 × 30 = 331776000)');
  cerca(USB.tasaMbit('mjpeg', 1920, 1080, 120, CFG), 398.1312, 1e-9, 'MJPEG 1920×1080 a 120 con 10:1');
  cerca(USB.tasaMbit('mjpeg', 1280, 720, 120, CFG), 176.9472, 1e-9, 'MJPEG 1280×720 a 120 con 10:1 (921600 × 16 × 120 ÷ 10)');
  cerca(USB.tasaMbit('mjpeg', 2048, 1536, 30, CFG), 150.994944, 1e-9, 'MJPEG 2048×1536 a 30 con 10:1');
  const f20 = USB.fijar(CFG, 'mjpeg.factor', 20);
  cerca(USB.tasaMbit('mjpeg', 1920, 1080, 120, f20), 199.0656, 1e-9, 'MJPEG 1920×1080 a 120 con 20:1');
  assert.equal(USB.tasaMbit('yuyv', 1920, 1080, 120, f20), USB.tasaMbit('yuyv', 1920, 1080, 120, CFG), 'el factor solo afecta al MJPEG');
  // el factor que haría falta para que quepa en la reserva máxima: 3981,312 ÷ 196,608 = 20,25
  cerca(USB.factorNecesario(1920, 1080, 120, USB.RESERVA_MAX), 20.25, 1e-9, 'factor mínimo de 1080p a 120');
  assert.throws(() => USB.tasaMbit('bayer', 640, 480, 30, CFG), /formato desconocido/);
  assert.throws(() => USB.tasaMbit('yuyv', 0, 480, 30, CFG), /número positivo/);
});

test('estado de una cámara: cumple hasta 0,8 de su reserva, límite hasta 1 y no cabe por encima', () => {
  // YUYV 1000 × 1000 × 16 × fps = 16 Mbit/s por fps: 5 fps = 80 (0,8), 6,25 fps = 100 (1), 7 fps = 112
  const e = fps => USB.evaluarCamara({ formato: 'yuyv', w: 1000, h: 1000, fps, reserva: 100 }, CFG);
  for (const [fps, estado] of [[4, 'ok'], [5, 'ok'], [5.01, 'limite'], [6.25, 'limite'], [6.26, 'no'], [7, 'no']]) assert.equal(e(fps).estado, estado, `${fps} fps`);
  cerca(e(5).tasa, 80, 1e-9, '5 fps'); cerca(e(5).uso, 0.8, 1e-9, 'uso'); assert.equal(e(5).factorMin, null, 'sin comprimir no hay factor');
  // MJPEG de 1080p a 120: con 10:1 ni sola cabe (398 > 196,6) y pide al menos 20,25:1
  const mj = { formato: 'mjpeg', w: 1920, h: 1080, fps: 120, reserva: USB.RESERVA_MAX };
  const m = USB.evaluarCamara(mj, CFG);
  assert.equal(m.estado, 'no'); cerca(m.factorMin, 20.25, 1e-9, 'factor mínimo'); assert.ok(m.uso > 2);
  // con 25:1, 159,25 de 196,608 = 0,81 (límite) y con 30:1, 132,7 = 0,675 (cumple)
  assert.equal(USB.evaluarCamara(mj, USB.fijar(CFG, 'mjpeg.factor', 25)).estado, 'limite');
  assert.equal(USB.evaluarCamara(mj, USB.fijar(CFG, 'mjpeg.factor', 30)).estado, 'ok');
  // el margen es editable
  assert.equal(USB.evaluarCamara({ formato: 'yuyv', w: 1000, h: 1000, fps: 5.5, reserva: 100 }, USB.fijar(CFG, 'margen.uso', 0.9)).estado, 'ok');
});

test('la reserva declarada: positiva y, como mucho, la máxima de un endpoint (196,608)', () => {
  assert.equal(USB.validarReserva(100), 100); assert.equal(USB.validarReserva(USB.RESERVA_MAX), USB.RESERVA_MAX);
  for (const x of [0, -1, NaN, Infinity, '100', null, undefined]) assert.throws(() => USB.validarReserva(x), /número positivo/, String(x));
  assert.throws(() => USB.validarReserva(196.7), /como mucho 196,6/);
});

test('buses: la suma de las reservas frente a la capacidad (480 × 0,8 = 384); con la reserva máxima cabe una cámara', () => {
  assert.equal(USB.capacidad(CFG), 384);
  const R = USB.RESERVA_MAX, ligera = { formato: 'yuyv', w: 160, h: 120, fps: 30, reserva: R }; // 9,216 Mbit/s: la demanda no pesa
  const cams = (...buses) => buses.map((bus, i) => ({ clave: `c${i}`, bus, ...ligera }));
  // una sola cámara por bus: 196,608 de 384 → cumple
  let r = USB.evaluarBuses(cams(1, 2, 3), CFG);
  assert.deepEqual(r.buses.map(b => [b.bus, b.claves.length, b.estado]), [[1, 1, 'ok'], [2, 1, 'ok'], [3, 1, 'ok']]);
  cerca(r.buses[0].sumaReserva, 196.608, 1e-9, 'reserva de un bus'); cerca(r.buses[0].libre, 384 - 196.608, 1e-9, 'libre');
  // dos con la reserva máxima: 393,216 > 384; tres: 589,824
  r = USB.evaluarBuses(cams(1, 1, 2), CFG);
  assert.deepEqual(r.buses.map(b => [b.bus, b.claves, b.estado]), [[1, ['c0', 'c1'], 'no'], [2, ['c2'], 'ok']]);
  cerca(r.buses[0].sumaReserva, 393.216, 1e-9, 'dos con la máxima');
  r = USB.evaluarBuses(cams(1, 1, 1), CFG); assert.equal(r.buses.length, 1); cerca(r.buses[0].sumaReserva, 589.824, 1e-9, 'tres'); assert.equal(r.buses[0].estado, 'no');
  // con reservas menores caben: 3 × 100 = 300 de 384 (0,78: cumple), 3 × 110 = 330 (0,86: límite) y 3 × 130 = 390 (no)
  const con = x => cams(1, 1, 1).map(c => ({ ...c, reserva: x }));
  assert.equal(USB.evaluarBuses(con(100), CFG).buses[0].estado, 'ok');
  assert.equal(USB.evaluarBuses(con(110), CFG).buses[0].estado, 'limite');
  assert.equal(USB.evaluarBuses(con(130), CFG).buses[0].estado, 'no');
  // la demanda también cuenta: con reservas bajas (3 × 100 = 300, que cabe) pero tasas altas (3 × 147,456 = 442,368 > 384), no cabe
  const pesada = { formato: 'yuyv', w: 640, h: 480, fps: 30, reserva: 100 };
  r = USB.evaluarBuses([1, 1, 1].map((bus, i) => ({ clave: `p${i}`, bus, ...pesada })), CFG);
  cerca(r.buses[0].sumaReserva, 300, 1e-9, 'reservas'); cerca(r.buses[0].sumaTasa, 442.368, 1e-9, 'demanda'); assert.equal(r.buses[0].estado, 'no');
  // cada cámara con su evaluación (147,456 de 100 de reserva: uso 1,47, no cabe), y el orden de los buses es el numérico
  assert.equal(r.camaras.length, 3); cerca(r.camaras[0].tasa, 147.456, 1e-9, 'tasa de una cámara'); assert.equal(r.camaras[0].estado, 'no');
  assert.equal(USB.evaluarBuses(cams(3, 1, 2), CFG).buses.map(b => b.bus).join(), '1,2,3');
  assert.throws(() => USB.evaluarBuses([{ clave: 'x', bus: 0, ...ligera }], CFG), /bus de x/);
  assert.throws(() => USB.evaluarBuses([{ clave: 'x', bus: 1.5, ...ligera }], CFG), /bus de x/);
  assert.throws(() => USB.evaluarBuses([{ clave: 'x', bus: 1, ...ligera, reserva: 300 }], CFG), /como mucho/);
});

test('el aviso del plan: con los valores de partida cabe una cámara por bus; si cambian los supuestos, el aviso lo dice', () => {
  const a = USB.avisoReserva(CFG);
  assert.equal(a.caben, 1); assert.match(a.texto, /con la reserva máxima cabe una cámara por bus/); assert.match(a.texto, /camaras-colocacion «USB 2\.0»/);
  assert.equal(USB.evaluarBuses([], CFG).aviso.caben, 1);
  // con un bus de 1000 × 0,8 = 800 Mbit/s caben ⌊800 ÷ 196,608⌋ = 4
  const grande = USB.fijar(CFG, 'bus.mbit', 1000), b = USB.avisoReserva(grande);
  assert.equal(b.caben, 4); assert.match(b.texto, /caben 4 cámaras por bus/); assert.match(b.texto, /supuestos/);
  // justo en el borde: 3 × 196,608 = 589,824 → con un bus de 589,824 caben 3 (sin perder uno por el redondeo)
  assert.equal(USB.avisoReserva(USB.fijar(USB.fijar(CFG, 'bus.mbit', 589.824), 'bus.periodico', 1)).caben, 3);
  // con un bus más pequeño que la reserva máxima no cabe ni una
  const chico = USB.avisoReserva(USB.fijar(CFG, 'bus.mbit', 200));
  assert.equal(chico.caben, 0); assert.match(chico.texto, /no cabe ni una cámara por bus/);
});

test('catálogo: la reserva máxima cita el plan; todo lo demás es SUPUESTO [SIN VALIDAR] editable; ninguna cita inventada', () => {
  const ids = USB.PARAMS.map(p => p.id); assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  assert.deepEqual(USB.PARAMS.filter(p => p.origen === 'PLAN').map(p => p.id), ['reserva.max']);
  for (const p of USB.PARAMS) {
    if (p.origen === 'PLAN') { assert.equal(p.editable, false); assert.match(p.fuente, /ficha de T4\.3 del plan/); }
    else { assert.equal(p.origen, 'SUPUESTO', p.id); assert.equal(p.editable, true, p.id); assert.match(p.fuente, /SIN VALIDAR/, `${p.id}: ${p.fuente}`); }
    assert.ok(typeof p.valor === 'number' && p.valor > 0, p.id);
    assert.doesNotMatch(JSON.stringify(p), /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)|\bUSB-IF\b|§/, `${p.id}: una cita que no se ha podido comprobar`);
  }
  for (const [id, v] of [['mjpeg.factor', 10], ['bus.mbit', 480], ['bus.periodico', 0.8], ['margen.uso', 0.8]]) assert.equal(USB.PARAMS.find(p => p.id === id).valor, v, id);
  assert.deepEqual(Object.keys(USB.FORMATOS), ['mjpeg', 'yuyv', 'nv12']);
});

test('configuración editable: solo números positivos (y las fracciones, hasta 1); el plan no se edita; devuelve una copia', () => {
  const c = USB.fijar(CFG, 'mjpeg.factor', 12); assert.equal(c.mjpeg.factor, 12); assert.equal(CFG.mjpeg.factor, 10, 'no cambia la original');
  for (const v of [0, -3, NaN, Infinity, '5', null, undefined]) assert.throws(() => USB.fijar(CFG, 'mjpeg.factor', v), /número positivo/, String(v));
  assert.throws(() => USB.fijar(CFG, 'bus.periodico', 1.01), /entre 0 y 1/); assert.equal(USB.fijar(CFG, 'bus.periodico', 1).bus.periodico, 1);
  assert.throws(() => USB.fijar(CFG, 'margen.uso', 2), /entre 0 y 1/);
  assert.throws(() => USB.fijar(CFG, 'reserva.max', 100), /lo fija el plan/); assert.throws(() => USB.fijar(CFG, 'no.existe', 1), /parámetro desconocido/);
});

// ------------------------------------------------------------------------------------------------------------------------
// lsusb -v. MUESTRA SINTÉTICA escrita para este test con el formato de lsusb (no es la salida de ningún equipo real: ids,
// nombres y números inventados). Reservas máximas a mano (bytes × transacciones × 8 bit × 8000 ÷ 2^(bInterval − 1)):
//   cámara A: alt 1 = 128 × 1 × 8 × 8000 = 8,192 · alt 2 = 1024 × 1 → 65,536 · alt 3 = 1024 × 3 → 196,608 · alt 4 (bInterval 2) → 98,304
//   cámara B: 0x0c00 = 2 transacciones de 1024 → 2 × 1024 × 8 × 8000 = 131,072
const endpoint = (dir, tipo, wmax, bint) => `      Endpoint Descriptor:
        bLength                 7
        bDescriptorType         5
        bEndpointAddress     0x${dir}  EP 1 IN
        bmAttributes            5
          Transfer Type            ${tipo}
          Synch Type               Asynchronous
          Usage Type               Data
        wMaxPacketSize     ${wmax}
        bInterval               ${bint}
`;
const alt = (n, cls, ep) => `    Interface Descriptor:
      bLength                 9
      bDescriptorType         4
      bInterfaceNumber        1
      bAlternateSetting       ${n}
      bNumEndpoints           ${ep ? 1 : 0}
      bInterfaceClass        ${cls}
      bInterfaceSubClass      2 Video Streaming
${ep}`;
const camara = (cab, prod, ...alts) => `${cab}
Device Descriptor:
  bLength                18
  bDescriptorType         1
  bcdUSB               2.00
  bDeviceClass          239 Miscellaneous Device
  idVendor           0x0000
  idProduct          0x0001
  iProduct                2 ${prod}
  bNumConfigurations      1
  Configuration Descriptor:
    bLength                 9
    bDescriptorType         2
${alts.join('')}
`;
const MUESTRA = [
  '# MUESTRA SINTÉTICA, no real: escrita para el test de T4.3',
  camara('Bus 001 Device 004: ID 0000:0001 Camara sintetica A', 'Camara sintetica A',
    alt(0, '14 Video', ''), alt(1, '14 Video', endpoint('81', 'Isochronous', '0x0080  1x 128 bytes', 1)),
    alt(2, '14 Video', endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 1)), alt(3, '14 Video', endpoint('81', 'Isochronous', '0x1400  3x 1024 bytes', 1)),
    alt(4, '14 Video', endpoint('81', 'Isochronous', '0x1400  3x 1024 bytes', 2))),
  camara('Bus 001 Device 005: ID 0000:0002 Camara sintetica B', 'Camara sintetica B', alt(1, '14 Video', endpoint('82', 'Isochronous', '0x0c00  2x 1024 bytes', 1))),
  // un concentrador con un endpoint de interrupción: se ignora
  camara('Bus 002 Device 001: ID 0000:0003 Concentrador sintetico', 'Concentrador sintetico', alt(0, '9 Hub', endpoint('81', 'Interrupt', '0x0004  1x 4 bytes', 12))),
  // USB 3: se lista y no se analiza
  camara('Bus 003 Device 002: ID 0000:0004 Camara sintetica USB 3', 'Camara sintetica USB 3', alt(1, '14 Video', endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 1))).replace('2.00', '3.00'),
  // una cámara de audio isócrona: se lista y no cuenta como vídeo
  camara('Bus 002 Device 003: ID 0000:0005 Audio sintetico', 'Audio sintetico', alt(1, '1 Audio', endpoint('81', 'Isochronous', '0x0064  1x 100 bytes', 4))),
  // un dispositivo al que lsusb no pudo abrir (sin sudo): solo la cabecera
  'Bus 002 Device 004: ID 0000:0006 Dispositivo sintetico sin permisos\nCouldn\'t open device, some information will be missing\n',
].join('\n');

test('lsusb -v: dispositivos, buses y endpoints isócronos de la muestra sintética, con cada reserva hecha a mano', () => {
  const r = USB.parsearLsusb(MUESTRA);
  assert.deepEqual(r.dispositivos.map(d => [d.bus, d.dispositivo, d.id]), [[1, 4, '0000:0001'], [1, 5, '0000:0002'], [2, 1, '0000:0003'], [3, 2, '0000:0004'], [2, 3, '0000:0005'], [2, 4, '0000:0006']]);
  const [A, B, H, U3, Au, Sin] = r.dispositivos;
  assert.equal(A.nombre, 'Camara sintetica A'); assert.equal(A.bcdUSB, '2.00'); assert.equal(A.analizado, true); assert.equal(A.nota, null);
  assert.deepEqual(A.endpoints.map(e => [e.interfaz, e.alt, e.direccion, e.tamano, e.transacciones, e.bInterval, e.clase]), [[1, 1, '0x81', 128, 1, 1, 14], [1, 2, '0x81', 1024, 1, 1, 14], [1, 3, '0x81', 1024, 3, 1, 14], [1, 4, '0x81', 1024, 3, 2, 14]]);
  assert.deepEqual(A.endpoints.map(e => e.mbit), [8.192, 65.536, 196.608, 98.304]);
  assert.equal(A.reservaMax, 196.608); assert.equal(A.esVideo, true);
  assert.deepEqual(B.endpoints.map(e => e.mbit), [131.072]); assert.equal(B.reservaMax, 131.072); assert.equal(B.endpoints[0].transacciones, 2);
  // concentrador: el endpoint de interrupción no cuenta
  assert.deepEqual(H.endpoints, []); assert.equal(H.reservaMax, null); assert.equal(H.esVideo, false); assert.equal(H.analizado, true);
  // USB 3: listado, no analizado, sin cifras
  assert.equal(U3.analizado, false); assert.match(U3.nota, /USB 3\.00: no analizado/); assert.equal(U3.reservaMax, null); assert.equal(U3.esVideo, false); assert.equal(U3.endpoints[0].mbit, null);
  // audio isócrono: está, pero no es vídeo y no da reserva de cámara
  assert.equal(Au.endpoints.length, 1); assert.equal(Au.endpoints[0].clase, 1); assert.equal(Au.esVideo, false); assert.equal(Au.reservaMax, null);
  // sin descriptores: se lista con su nota
  assert.equal(Sin.analizado, false); assert.match(Sin.nota, /sin descriptores/); assert.deepEqual(Sin.endpoints, []);
  // el resumen de las cámaras (los dispositivos de vídeo)
  assert.deepEqual(USB.camarasDe(r).map(d => [d.bus, d.dispositivo, d.reservaMax]), [[1, 4, 196.608], [1, 5, 131.072]]);
  // tolera CRLF y espacios al final, y da el mismo resultado; dos análisis seguidos no dependen del anterior
  assert.deepEqual(USB.parsearLsusb(MUESTRA.replace(/\n/g, '  \r\n')), r);
  assert.deepEqual(USB.parsearLsusb(MUESTRA), r);
});

test('lsusb -v: el hexadecimal de wMaxPacketSize se comprueba contra el texto (tamaño y transacciones adicionales de los bits 11–12)', () => {
  const uno = (wmax, bint = 1) => USB.parsearLsusb(camara('Bus 009 Device 001: ID 0000:0009 x', 'x', alt(1, '14 Video', endpoint('81', 'Isochronous', wmax, bint)))).dispositivos[0].endpoints[0];
  assert.equal(uno('0x1400  3x 1024 bytes').transacciones, 3); assert.equal(uno('0x0c00  2x 1024 bytes').transacciones, 2);
  assert.equal(uno('0x03ff  1x 1023 bytes').tamano, 1023);
  // un endpoint sin «Nx» (lsusb antiguos) vale por una transacción
  assert.equal(uno('0x0200  512 bytes').transacciones, 1);
  assert.throws(() => uno('0x1400  1x 1024 bytes'), /línea \d+: .*no coincide/);
  assert.throws(() => uno('0x0400  1x 512 bytes'), /línea \d+: .*no coincide/);
  assert.throws(() => uno('0x0401  1x 1024 bytes'), /línea \d+: .*no coincide/);
  assert.throws(() => uno('0x1c00  4x 1024 bytes'), /línea \d+: .*reservado/);
});

test('lsusb -v: entradas mal formadas fallan con un error claro y la línea, y no dan un resultado a medias', () => {
  const malo = (texto, patron, que) => assert.throws(() => USB.parsearLsusb(texto), e => { assert.ok(e instanceof Error, que); assert.match(e.message, patron, que); return true; }, que);
  malo('', /vacío/, 'vacío'); malo('   \n\n', /vacío/, 'solo espacios'); malo(undefined, /texto/, 'sin texto'); malo(42, /texto/, 'no es texto');
  malo('hola\nesto no es lsusb', /no hay ninguna línea «Bus … Device …»/, 'sin cabecera');
  malo('Bus 001 Device 004 ID 0000:0001 x', /no hay ninguna línea/, 'cabecera sin dos puntos');
  const dev = e => camara('Bus 001 Device 004: ID 0000:0001 x', 'x', alt(1, '14 Video', e));
  malo(dev(endpoint('81', 'Isochronous', '0x1400  1x 1024 bytes', 1)), /^línea \d+: wMaxPacketSize 0x1400 \(3 × 1024\) no coincide con «1x 1024»/, 'hexadecimal contra texto');
  malo(dev(endpoint('81', 'Isochronous', '0xZZ00  3x 1024 bytes', 1)), /línea \d+: wMaxPacketSize mal formado/, 'hexadecimal roto');
  malo(dev(endpoint('81', 'Isochronous', 'muy grande', 1)), /línea \d+: wMaxPacketSize mal formado/, 'sin formato');
  malo(dev(endpoint('81', 'Isochronous', '0x07ff  1x 2047 bytes', 1)), /línea \d+: .*2047.*1024/, 'más de 1024');
  malo(dev(endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 0)), /línea \d+: bInterval 0 fuera de 1–16/, 'bInterval 0');
  malo(dev(endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 17)), /línea \d+: bInterval 17 fuera de 1–16/, 'bInterval 17');
  malo(dev(endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 'x')), /línea \d+: bInterval mal formado/, 'bInterval no numérico');
  // texto cortado: el endpoint isócrono se queda sin bInterval, sin wMaxPacketSize o sin tipo
  const entero = dev(endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 1));
  malo(entero.slice(0, entero.indexOf('        bInterval')), /línea \d+: .*endpoint isócrono sin bInterval.*cortado/, 'cortado en bInterval');
  malo(entero.slice(0, entero.indexOf('        wMaxPacketSize')), /línea \d+: .*sin wMaxPacketSize/, 'cortado en wMaxPacketSize');
  malo(entero.slice(0, entero.indexOf('          Transfer Type')), /línea \d+: .*sin «Transfer Type»/, 'cortado en el tipo');
  malo(`${entero}\0`, /línea \d+: .*carácter NUL/, 'binario');
  malo('Bus 001 Device 004: ID 0000:0001 x\n'.repeat(60000), /demasiado grande/, 'demasiado grande');
  // el número de línea es el de la línea con el fallo (cuenta desde 1)
  const lineas = dev(endpoint('81', 'Isochronous', '0x0400  1x 1024 bytes', 0)).split('\n');
  const n = lineas.findIndex(l => l.includes('bInterval')) + 1;
  malo(lineas.join('\n'), new RegExp(`^línea ${n}: `), 'número de línea');
  // un fallo en el segundo dispositivo no devuelve el primero
  malo(MUESTRA + '\n' + dev(endpoint('81', 'Isochronous', '0x1400  1x 1024 bytes', 1)).replace('Bus 001 Device 004', 'Bus 005 Device 009'), /^línea \d+: /, 'segundo dispositivo');
  // un endpoint de interrupción mal escrito no hace fallar: solo se validan los isócronos
  assert.doesNotThrow(() => USB.parsearLsusb(dev(endpoint('81', 'Interrupt', 'raro', 'raro'))));
});

test('src/usb.js solo analiza texto: sin llamadas de red ni de ROS (I2, I4) y sin globales del gemelo', () => {
  const src = fs.readFileSync(new URL('../../src/usb.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|Worker|advertise|publish|callService|sendGoal)\b|\bdocument\b|\bwindow\b|\blocalStorage\b/);
});
