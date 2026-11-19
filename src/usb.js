// Estimador de ancho de banda USB de las cámaras (T4.3, D4): por cámara, formato, resolución, fps y reserva (declarable; por
// defecto la máxima de un endpoint isócrono de USB 2.0, ~196 Mbit/s); por bus, la suma; el aviso «con la reserva máxima cabe una
// cámara por bus»; y un analizador del texto de `lsusb -v`. Sin DOM, sin three y sin red: solo lee el texto que se le pasa.
// Se prueba con node:test (tests/unit/usb-estimador.test.mjs) y se concatena en app.js con el marcador @@USB@@.
// Fuentes. El estudio «camaras-colocacion» no está en el repo: solo se cita lo que da la ficha de T4.3 del plan (reserva máxima de
// ~196 Mbit/s en USB 2.0; con ella cabe una cámara por bus) y la aritmética. Aritmética comprobable: la reserva máxima de un
// endpoint isócrono de alta velocidad es 3 transacciones × 1024 B × 8 bit × 8000 microtramas/s = 196,608 Mbit/s; la tasa sin
// comprimir es ancho × alto × bit por píxel × fps; un endpoint de `lsusb -v` de tamaño s, m transacciones por microtrama y
// bInterval b da s × m × 8 × 8000 / 2^(b−1) bit/s. Todo lo demás (factor de compresión del MJPEG, velocidad y fracción del bus,
// margen, bus de cada cámara) es SUPUESTO SIN VALIDAR y editable: no hay fuente comprobable y no se cita ninguna.
const USB = (() => {
  const PLAN = 'ficha de T4.3 del plan (estudio «camaras-colocacion», que no está en el repo: cita sin comprobar aquí)';
  const SIN = 'sin fuente comprobable; SUPUESTO [SIN VALIDAR]';
  const RESERVA_MAX = 3 * 1024 * 8 * 8000 / 1e6; // Mbit/s: 196,608
  const EPS = 1e-9;
  // Parámetros: id «grupo.clave», valor de partida, origen ('PLAN' o 'SUPUESTO'), fuente, si se edita y el máximo (fracciones)
  const P = (id, nombre, unidad, valor, origen, fuente, editable = true, max = null) => ({ id, nombre, unidad, valor, origen, fuente, editable, max });
  const PARAMS = [
    P('reserva.max', 'Reserva máxima de una cámara', 'Mbit/s', RESERVA_MAX, 'PLAN', `~196 Mbit/s en USB 2.0; son 3 transacciones × 1024 B × 8 bit × 8000 microtramas/s; ${PLAN}`, false),
    P('mjpeg.factor', 'MJPEG: compresión respecto a YUYV (16 bit por píxel)', ': 1', 10, 'SUPUESTO', `sin medir con la ELP; ${SIN}`),
    P('bus.mbit', 'Bus USB 2.0: velocidad de señalización', 'Mbit/s', 480, 'SUPUESTO', SIN),
    P('bus.periodico', 'Bus: fracción para tráfico isócrono', '× 1', 0.8, 'SUPUESTO', SIN, true, 1),
    P('margen.uso', 'Margen: «cumple» hasta esta fracción de la reserva (o del bus)', '× 1', 0.8, 'SUPUESTO', SIN, true, 1),
  ];
  const POR_ID = new Map(PARAMS.map(p => [p.id, p]));
  const copia = cfg => Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, { ...v }]));
  function cfgDefecto() {
    const cfg = {};
    for (const p of PARAMS) { const [g, k] = p.id.split('.'); (cfg[g] = cfg[g] || {})[k] = p.valor; }
    return cfg;
  }
  // Cambia un valor editable (devuelve una configuración nueva); un id desconocido, uno fijo del plan o un valor que no sea un
  // número positivo (y, en las fracciones, de 0 a 1) falla con un error claro
  function fijar(cfg, id, valor) {
    const p = POR_ID.get(id); if (!p) throw new Error(`parámetro desconocido (${JSON.stringify(id)})`);
    if (!p.editable) throw new Error(`«${p.nombre}» lo fija el plan y no se edita`);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || !(valor > 0)) throw new Error(`«${p.nombre}»: ${JSON.stringify(valor)} no es un número positivo`);
    if (p.max !== null && valor > p.max) throw new Error(`«${p.nombre}»: ${valor} no está entre 0 y ${p.max}`);
    const n = copia(cfg), [g, k] = id.split('.'); n[g][k] = valor; return n;
  }

  const fmt1 = x => x.toFixed(1).replace('.', ',');
  const ESTADOS = { ok: { txt: 'cumple', cls: 'ok' }, limite: { txt: 'límite', cls: 'warn' }, no: { txt: 'no cabe', cls: 'bad' } };
  const ORDEN = { ok: 0, limite: 1, no: 2 };
  // Formatos: bit por píxel de los sin comprimir (definición del formato); el MJPEG se estima con el factor
  const FORMATOS = { mjpeg: { nombre: 'MJPEG', bpp: null }, yuyv: { nombre: 'YUYV 4:2:2', bpp: 16 }, nv12: { nombre: 'NV12 4:2:0', bpp: 12 } };
  const BPP_REF = 16; // el MJPEG se compara con YUYV de 16 bit por píxel
  const positivo = (x, que) => { if (typeof x !== 'number' || !Number.isFinite(x) || !(x > 0)) throw new Error(`${que}: ${JSON.stringify(x)} no es un número positivo`); return x; };
  // Tasa estimada (Mbit/s) de una cámara: ancho × alto × bit por píxel × fps (en MJPEG, la de YUYV ÷ el factor supuesto)
  function tasaMbit(formato, w, h, fps, cfg) {
    if (!Object.hasOwn(FORMATOS, formato)) throw new Error(`formato desconocido (${JSON.stringify(formato)})`);
    positivo(w, 'ancho'); positivo(h, 'alto'); positivo(fps, 'fps');
    const f = FORMATOS[formato];
    return f.bpp === null ? w * h * BPP_REF * fps / cfg.mjpeg.factor / 1e6 : w * h * f.bpp * fps / 1e6;
  }
  // Factor de compresión mínimo para que un MJPEG de ese modo quepa en una reserva (Mbit/s)
  const factorNecesario = (w, h, fps, reserva) => w * h * BPP_REF * fps / 1e6 / reserva;
  // La reserva declarada de una cámara: un número positivo, como mucho la de un endpoint (196,608)
  function validarReserva(x) {
    positivo(x, 'reserva');
    if (x > RESERVA_MAX * (1 + EPS)) throw new Error(`la reserva puede ser como mucho ${fmt1(RESERVA_MAX)} Mbit/s (3 × 1024 B por microtrama): ${x} es más`);
    return x;
  }
  // cumple hasta el margen, límite hasta 1, no cabe por encima (con una tolerancia relativa de 1e-9 en los bordes)
  const clasificarUso = (uso, margen) => uso <= margen * (1 + EPS) ? 'ok' : uso <= 1 + EPS ? 'limite' : 'no';
  // cam = { formato, w, h, fps, reserva } → { tasa, reserva, uso, estado, factorMin (solo MJPEG) }
  function evaluarCamara(cam, cfg) {
    const tasa = tasaMbit(cam.formato, cam.w, cam.h, cam.fps, cfg), reserva = validarReserva(cam.reserva), uso = tasa / reserva;
    return { tasa, reserva, uso, estado: clasificarUso(uso, cfg.margen.uso), factorMin: cam.formato === 'mjpeg' ? factorNecesario(cam.w, cam.h, cam.fps, reserva) : null };
  }
  // Capacidad isócrona de un bus (Mbit/s) y cuántas cámaras con la reserva máxima caben en él
  const capacidad = cfg => cfg.bus.mbit * cfg.bus.periodico;
  const cabenPorBus = cfg => Math.floor(capacidad(cfg) / RESERVA_MAX + EPS);
  // El aviso del plan, calculado con los supuestos del bus: con los de partida cabe una sola cámara
  function avisoReserva(cfg) {
    const caben = cabenPorBus(cfg), cap = capacidad(cfg), datos = `${fmt1(RESERVA_MAX)} Mbit/s de reserva máxima frente a ${fmt1(cap)} de capacidad del bus`;
    const fuente = 'camaras-colocacion «USB 2.0», cita del plan sin comprobar aquí';
    const texto = caben === 0 ? `con la reserva máxima no cabe ni una cámara por bus (${datos}; ${fuente})`
      : caben === 1 ? `con la reserva máxima cabe una cámara por bus (${datos}; ${fuente})`
        : `con la reserva máxima caben ${caben} cámaras por bus con los supuestos actuales del bus (${datos}); el plan dice una, con los de partida (${fuente})`;
    return { caben, capacidad: cap, texto };
  }
  // camaras = [{ clave, bus, formato, w, h, fps, reserva }] → { camaras (con su evaluación), buses [{ bus, claves, sumaReserva,
  // sumaTasa, capacidad, uso, libre, estado }] por número de bus, caben, capacidad, aviso }. Un bus pasa a «no cabe» si la suma de
  // las reservas o la de las tasas estimadas supera su capacidad
  function evaluarBuses(camaras, cfg) {
    const cap = capacidad(cfg), cs = camaras.map(c => {
      if (!Number.isInteger(c.bus) || c.bus < 1) throw new Error(`bus de ${c.clave}: ${JSON.stringify(c.bus)} no es un número entero desde 1`);
      return { clave: c.clave, bus: c.bus, formato: c.formato, w: c.w, h: c.h, fps: c.fps, ...evaluarCamara(c, cfg) };
    });
    const buses = [...new Set(cs.map(c => c.bus))].sort((a, b) => a - b).map(bus => {
      const en = cs.filter(c => c.bus === bus), sumaReserva = en.reduce((s, c) => s + c.reserva, 0), sumaTasa = en.reduce((s, c) => s + c.tasa, 0);
      const uso = Math.max(sumaReserva, sumaTasa) / cap;
      return { bus, claves: en.map(c => c.clave), sumaReserva, sumaTasa, capacidad: cap, uso, libre: cap - sumaReserva, estado: clasificarUso(uso, cfg.margen.uso) };
    });
    const aviso = avisoReserva(cfg);
    return { camaras: cs, buses, caben: aviso.caben, capacidad: cap, aviso };
  }

  // ---------- lsusb -v ----------
  // Solo lee texto. Falla con un error con la línea y no devuelve nada a medias: o el análisis entero o una excepción.
  const MAX_TEXTO = 2000000;
  const err = (n, msg) => { const e = new Error(n ? `línea ${n}: ${msg}` : msg); e.linea = n || null; return e; };
  const CABECERA = /^Bus\s+(\d+)\s+Device\s+(\d+):\s+ID\s+([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s*(.*?)\s*$/;
  const CLASE_VIDEO = 14;
  const NOTA_VELOCIDAD = 'el estimador es de USB 2.0 de alta velocidad';
  // Un endpoint isócrono de alta velocidad: tamaño s (≤ 1024), m transacciones por microtrama (bits 11–12 de wMaxPacketSize más
  // uno) y bInterval b (1–16): s × m × 8 bit × 8000 microtramas/s ÷ 2^(b−1), en Mbit/s
  const mbitIso = (tam, trans, b) => tam * trans * 8 * 8000 / 2 ** (b - 1) / 1e6;
  function wMax(ep) {
    const m = /^wMaxPacketSize\s+0x([0-9a-fA-F]{4})\s+(?:(\d+)x\s+)?(\d+)\s+bytes\s*$/.exec(ep.wmax.texto);
    if (!m) throw err(ep.wmax.linea, `wMaxPacketSize mal formado («${ep.wmax.texto}»): se esperaba «wMaxPacketSize 0x1400  3x 1024 bytes»`);
    const raw = parseInt(m[1], 16), tamTxt = +m[3], transTxt = m[2] === undefined ? 1 : +m[2], tam = raw & 0x7ff, adicionales = (raw >> 11) & 3;
    if (tamTxt > 1024) throw err(ep.wmax.linea, `wMaxPacketSize: ${tamTxt} bytes por transacción son más de 1024, imposible en un endpoint isócrono de alta velocidad`);
    if (adicionales === 3) throw err(ep.wmax.linea, `wMaxPacketSize 0x${m[1]}: el valor 3 de las transacciones adicionales (bits 11–12) está reservado`);
    if (tam !== tamTxt || adicionales + 1 !== transTxt) throw err(ep.wmax.linea, `wMaxPacketSize 0x${m[1]} (${adicionales + 1} × ${tam}) no coincide con «${transTxt}x ${tamTxt}»`);
    return { tamano: tam, transacciones: adicionales + 1 };
  }
  function parsearLsusb(texto) {
    if (typeof texto !== 'string') throw err(0, 'se esperaba texto: pega la salida de «lsusb -v»');
    if (!texto.trim()) throw err(0, 'el texto está vacío: pega la salida de «lsusb -v»');
    if (texto.length > MAX_TEXTO) throw err(0, `el texto es demasiado grande (${texto.length} caracteres; el máximo son ${MAX_TEXTO}): pega solo la salida de «lsusb -v»`);
    const lineas = texto.split(/\r?\n/), dispositivos = [];
    const nul = lineas.findIndex(l => l.includes('\0')); if (nul >= 0) throw err(nul + 1, 'hay un carácter NUL: eso no es texto de lsusb');
    let dev = null, ifc = { num: null, alt: null, clase: null }, ep = null;
    // Cierra el endpoint abierto: solo los isócronos se validan (tamaño, transacciones, bInterval) y se guardan
    const cerrarEp = () => {
      if (!ep) return; const e = ep; ep = null;
      if (e.tipo === undefined) throw err(e.linea, 'descriptor de endpoint sin «Transfer Type» (¿texto cortado?)');
      if (e.tipo !== 'Isochronous') return;
      if (!e.wmax) throw err(e.linea, 'endpoint isócrono sin wMaxPacketSize (¿texto cortado?)');
      if (!e.bint) throw err(e.linea, 'endpoint isócrono sin bInterval (¿texto cortado?)');
      const { tamano, transacciones } = wMax(e), mb = /^bInterval\s+(\d+)\b/.exec(e.bint.texto);
      if (!mb) throw err(e.bint.linea, `bInterval mal formado («${e.bint.texto}»)`);
      const bInterval = +mb[1];
      if (dev.bcdMayor === 2 && !(bInterval >= 1 && bInterval <= 16)) throw err(e.bint.linea, `bInterval ${bInterval} fuera de 1–16 (alta velocidad)`);
      dev.endpoints.push({ interfaz: e.interfaz, alt: e.alt, direccion: e.direccion, clase: e.clase, tamano, transacciones, bInterval, mbit: null });
    };
    // Cierra el dispositivo abierto: decide si se analiza y calcula la reserva de cada endpoint
    const cerrarDev = () => {
      if (!dev) return; cerrarEp();
      if (dev.bcdMayor === null) dev.nota = 'sin descriptores (¿hace falta sudo?): no analizado';
      else if (dev.bcdMayor !== 2) dev.nota = `USB ${dev.bcdUSB}: no analizado (${NOTA_VELOCIDAD})`;
      else { dev.analizado = true; for (const e of dev.endpoints) e.mbit = mbitIso(e.tamano, e.transacciones, e.bInterval); }
      const vid = dev.endpoints.filter(e => e.clase === CLASE_VIDEO && e.mbit !== null);
      dev.esVideo = vid.length > 0; dev.reservaMax = vid.length ? Math.max(...vid.map(e => e.mbit)) : null;
      delete dev.bcdMayor; dispositivos.push(dev); dev = null;
    };
    lineas.forEach((linea, i) => {
      const n = i + 1, h = CABECERA.exec(linea);
      if (h) { cerrarDev(); dev = { bus: +h[1], dispositivo: +h[2], id: `${h[3]}:${h[4]}`.toLowerCase(), nombre: h[5], bcdUSB: null, bcdMayor: null, analizado: false, nota: null, endpoints: [], reservaMax: null, esVideo: false }; ifc = { num: null, alt: null, clase: null }; return; }
      if (!dev) return;
      const t = linea.trim();
      if (/Descriptor:$/.test(t)) {
        cerrarEp();
        if (t === 'Interface Descriptor:') ifc = { num: null, alt: null, clase: null };
        else if (t === 'Endpoint Descriptor:') ep = { linea: n, interfaz: ifc.num, alt: ifc.alt, clase: ifc.clase, direccion: null, tipo: undefined, wmax: null, bint: null };
        return;
      }
      let m;
      if (ep) {
        if ((m = /^bEndpointAddress\s+0x([0-9a-fA-F]{2})\b/.exec(t))) ep.direccion = `0x${m[1].toLowerCase()}`;
        else if ((m = /^Transfer Type\s+(\S+)/.exec(t))) ep.tipo = m[1];
        else if (/^wMaxPacketSize\b/.test(t)) ep.wmax = { texto: t, linea: n };
        else if (/^bInterval\b/.test(t)) ep.bint = { texto: t, linea: n };
        return;
      }
      if (dev.bcdUSB === null && (m = /^bcdUSB\s+(\d+)\.(\d+)\b/.exec(t))) { dev.bcdUSB = `${m[1]}.${m[2]}`; dev.bcdMayor = +m[1]; }
      else if ((m = /^bInterfaceNumber\s+(\d+)\b/.exec(t))) ifc.num = +m[1];
      else if ((m = /^bAlternateSetting\s+(\d+)\b/.exec(t))) ifc.alt = +m[1];
      else if ((m = /^bInterfaceClass\s+(\d+)\b/.exec(t))) ifc.clase = +m[1];
    });
    cerrarDev();
    if (!dispositivos.length) throw err(0, 'no hay ninguna línea «Bus … Device …»: pega la salida completa de «lsusb -v» (con sudo, para que muestre los descriptores)');
    return { dispositivos };
  }
  // Los dispositivos que son cámaras (con un endpoint isócrono de clase vídeo, analizado)
  const camarasDe = r => r.dispositivos.filter(d => d.esVideo);

  return { RESERVA_MAX, PARAMS, FORMATOS, ESTADOS, ORDEN, cfgDefecto, fijar, tasaMbit, factorNecesario, validarReserva, evaluarCamara, capacidad, cabenPorBus, avisoReserva, evaluarBuses, parsearLsusb, camarasDe };
})();
if (typeof module !== 'undefined') module.exports = USB;
