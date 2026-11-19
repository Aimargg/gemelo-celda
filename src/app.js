// ======================= Utilidades y constantes =======================
const PI = Math.PI, D2R = PI / 180, R2D = 180 / PI;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const angDiff = (a, b) => { let d = a - b; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; };
const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
const mm = v => Math.round(v * 1000);
const m4 = a => new THREE.Matrix4().set(...a);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const STOP = new Error('stop');
// Escena del grupo abierta (cur) o «Tu mesa» (cur = null); base = disposición al abrirla, para saber si se ha modificado
const ESC = { lista: [], papelera: [], cur: null, base: null, basada: null, ultima: null, cargando: true, borrarId: null, ilegibles: '' };
let EDITANDO = false; // mientras se arrastra algo no se recalculan los planes (es lo caro); se recalculan al soltar
let OBS_EXTRA = []; // obstáculos previstos (la fruta que tendrá el plato cuando se coja)
let VERSION_ESCENA = 0; // sube cada vez que cambia algo del entorno (objetos movidos, cogidos o soltados)
let ROBOT_PEDIDO = false, AVISO_ROBOT = null; // cambio de robot desde el selector · aviso de robot pendiente (aplicarCinematica)
class FalloDemo extends Error { constructor(msg, tipo = 'fallo', info = {}) { super(msg); this.tipo = tipo; this.info = { ...(typeof D !== 'undefined' ? D.ctx : {}), ...info }; } }

const MESA = { w: 1.18, d: 0.83, h: 0.76, e: 0.03 };
const BASES = { A: { x: -0.439, y: 0.300 }, B: { x: 0.434, y: 0.269 } };
const RG2 = { carrera: 0.110, piv: 0.021, cuerpo: 0.130, L: 0.065, tip: 0.018, ancho: 0.064, esp: 0.036 };
const MODOS = { '1920x1080': { w: 1920, h: 1080, fps: 120 }, '1280x960': { w: 1280, h: 960, fps: 120 }, '2048x1536': { w: 2048, h: 1536, fps: 30 }, '3840x2160': { w: 3840, h: 2160, fps: 30 }, '1280x720': { w: 1280, h: 720, fps: 120 } };
const BRAZO_MANFROTTO = 0.53;
const VMAX = [180, 180, 180, 360, 360, 360].map(v => v * D2R); // rad/s UR3e
const GRUPO_COL = () => ({ V1: css('--v1'), V2: css('--v2'), ROB: css('--rob') });
const PLATO_R = 0.08, R_AGARRE = 0.082, H_BORDE = 0.022; // el centro de la yema queda 2 mm por fuera del borde del ala // radio del plato, radio y altura del punto de agarre del borde
const H_TR = 0.12, H_AP = 0.06; // altura de traslado sobre la mesa y de aproximación sobre la bandeja
// Subida en recta tras «la salida de la bandeja» (T1.9, DT22): al retroceder 8 cm en horizontal, el dedo que va por debajo
// del ala (y en el 2º plato también el cuerpo de la pinza) sigue a la altura de la bandeja. Es el menor valor de
// {2, 3, 4, 5, 6} cm que deja la pinza libre (choqueEn null con el contexto del movimiento siguiente) en todos los casos
// de la matriz que llegan a la salida, con «gemelo» y con «curso», y en las escenas v8. Medido con el gemelo (2026-11-16,
// informe de T1.9): con 2 cm, las 19 salidas libres y holgura mínima de 5,5 mm; con 3 cm, una salida de «curso» toca la
// bandeja (−1,7 mm: arranque en contacto); con 5 y 6 cm, la subida de «gemelo» caja M1 2 cm llega a la singularidad del
// codo y la demo falla (sin trayectoria).
// Desde T2.8 (DT30), planColocar exige además que el final de la subida y el arranque hacia el reposo no toquen la bandeja
// en ninguna pose de su balanceo, y la altura se volvió a medir con esa comprobación en el barrido de 33 disposiciones
// (tools/barrido-salida.mjs; docs/estado/barrido-salida-t28.md, 2026-11-16). Con 2, 3, 4 y 5 cm ninguna toca la bandeja,
// frente a 10 antes de T2.8. Con 2 cm, 26 viables, pero Calcular en la disposición de partida pasa de 0,9 s a 1,7 s
// (descarta sus agarres y busca otros); con 3 cm se pierde v16, viable antes (ruta cartesiana incompleta al llevar el
// plato 2); con 4 cm, 25 viables sin perder ninguna y Calcular en 0,9 s. Es el menor valor que cumple las tres cosas
const H_SALIDA = 0.04;
const CAJA_LADO = 0.10;
// ArUco reales del diccionario DICT_4X4_50 (ids 0–15), bits interiores por filas
const ARUCO = ['1011010100110010', '0000111110011010', '0011001100101101', '1001100101000110', '0101010010011110', '0111100111001101', '1001111000101110', '1100010011110010', '1111111011011010', '1100111101010110', '1111100110010001', '0001000110100111', '0000111010110111', '0010101000001111', '0010010010110001', '0010011000111110'];
// @@LAYOUT@@
// @@RNG@@
// @@PERFIL@@
// @@SENSOR@@
// @@TAREAS@@
// @@USB@@
// @@ORIGEN@@
// @@EXPORTAR@@
// @@CALIBRACION@@
// Perfil con el que se explora (arrastrar, «Calcular trayectorias», el primer cálculo, la vista de cada objeto): siempre
// «gemelo» (D6, decisión 2 del brief de T1.6). El de la escena (L.perfil) es el de la demo y el del veredicto principal.
const PERFIL_EXPLORA = 'gemelo';
// Un layout de una versión más nueva (solo lectura) puede traer un perfil que esta página no conoce: el de las escenas nuevas
const perfilEscena = () => PERFIL.NOMBRES.includes(L.perfil) ? L.perfil : LAYOUT.NUEVA.perfil;
// Sensor de las cámaras de la escena (T1.7, D10; src/sensor.js): «elp-ficha» en las nuevas, «gemelo-v8» en las v8 (I1).
// Uno que esta página no conoce (solo lectura de una versión más nueva): el de las escenas nuevas.
const sensorEscena = () => SENSOR.NOMBRES.includes(L.sensor) ? L.sensor : LAYOUT.NUEVA.sensor;

function layoutDefecto() {
  return {
    version: LAYOUT.VERSION, ...LAYOUT.NUEVA, // escena nueva: robot nominal, perfil «curso» y sensor de la ficha de la ELP (T1.1)
    robot: 'B',
    zona: { x: 0.12, y: 0.27, yaw: 0, w: 0.22, d: 0.16 },
    plato1: { x: 0.265, y: -0.049 }, plato2: { x: 0.122, y: 0.089 }, // a 36 cm de la base, a -118° y -150°: agarre horizontal y fruta desde arriba
    caja: { on: true, h: 0.10 }, pedido: 2,
    persona: { x: 1.28, y: 0.32, yaw: PI }, bandeja: { alt: 1.00, ade: 0.40 }, // lateral derecho, de frente al robot; bandeja a 1 m del suelo, a su derecha
    arucoE: [{ x: 0.48, y: 0.10 }, { x: 0.55, y: -0.05 }],
    cams: {
      cenital: { grupo: 'V2', nombre: 'Cenital', f: 3.6, modo: '1920x1080', clamp: { x: 0.17, y: -0.415 }, pos: { x: 0.17, y: -0.17, z: 1.17 }, mira: { x: 0.18, y: 0.10, z: 0.76 }, roll: 0 },
      entrega: { grupo: 'V1', nombre: 'Entrega', f: 3.6, modo: '1920x1080', clamp: { x: 0.55, y: -0.415 }, pos: { x: 0.55, y: -0.395, z: 1.25 }, mira: { x: 0.68, y: 0.10, z: 0.90 }, roll: 0 },
      persona: { grupo: 'V1', nombre: 'Persona', f: 4.5, modo: '1920x1080', clamp: { x: 0.30, y: -0.415 }, pos: { x: 0.30, y: -0.365, z: 1.25 }, mira: { x: 1.20, y: 0.32, z: 1.30 }, roll: 0 },
    },
  };
}
function espejo(L) { // cambia el lado: x → −x
  const c = JSON.parse(JSON.stringify(L));
  const fx = o => { o.x = -o.x; };
  [c.zona, c.plato1, c.plato2, c.persona, ...c.arucoE].forEach(fx);
  c.zona.yaw = -c.zona.yaw; c.persona.yaw = PI - c.persona.yaw;
  for (const k in c.cams) { fx(c.cams[k].clamp); fx(c.cams[k].pos); fx(c.cams[k].mira); c.cams[k].roll = -(c.cams[k].roll || 0); }
  return c;
}
// Toda carga de una disposición pasa por migrarLayout (T1.1, I1): la valida contra la forma de la de partida, migra la
// de la v8 y dice si es de una versión más nueva (solo lectura). Devuelve { layout, soloLectura } o { error }.
const ESQ_L = { ref: layoutDefecto(), robots: Object.keys(BASES), modos: Object.keys(MODOS), grupos: ['V1', 'V2', 'ROB'] };
const migrarLayout = entrada => LAYOUT.migrarLayout(entrada, ESQ_L);
// Solo lectura: una disposición de una versión más nueva se ve, pero no se guarda en local ni en el grupo
function soloLectura() { return LAYOUT.soloLectura(L); }
const CLAVE = 'gemelo-ur3e-v4', CLAVE_ILEG = CLAVE + '-ilegible'; // CLAVE_ILEG: copia de una Tu mesa que no se puede abrir (revisión de F1, H2)
function cargarLocal() { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } } // texto de Tu mesa o null (sin almacenamiento)
// Tu mesa guardada en este navegador. Si no se puede abrir, la disposición de partida con un aviso (la v8 la descartaba en silencio)
function mesaLocal() {
  const s = cargarLocal(); if (s == null) return layoutDefecto();
  const r = migrarLayout(s);
  // el texto original se copia antes: el primer guardado de Tu mesa lo sustituye por la disposición de partida y la v8 no
  // perdía nada que esta versión no sepa leer (revisión de F1, H2; DT11)
  if (r.error) {
    let copia = false; try { localStorage.setItem(CLAVE_ILEG, s); copia = true; } catch (e) { }
    toast(`Tu mesa guardada no se puede abrir (${r.error}): se usa la disposición de partida${copia ? ` y la original queda copiada en este navegador («${CLAVE_ILEG}»)` : ''}`); return layoutDefecto();
  }
  if (r.soloLectura) toast(`Tu mesa es de una versión más nueva del gemelo (v${r.layout.version}): se abre en solo lectura`);
  return r.layout;
}
let L = mesaLocal();
let saveT = 0, savePend = false;
// Escribe Tu mesa ya. Nunca con una escena del grupo abierta ni con una disposición de solo lectura (versión más nueva):
// se comprueba al escribir, no al programar el guardado, porque L puede haber cambiado en esos 400 ms (T1.1, revisión)
function escribirMesa() { clearTimeout(saveT); savePend = false; if (ESC.cur || soloLectura()) return; try { localStorage.setItem(CLAVE, JSON.stringify(L)); } catch (e) { } }
function guardarLocal() { clearTimeout(saveT); savePend = !ESC.cur && !soloLectura(); if (savePend) saveT = setTimeout(escribirMesa, 400); } // a los 400 ms del último cambio
// Antes de sustituir L por otra disposición: lo pendiente de guardar de Tu mesa se escribe ya y no se pierde
function vaciarGuardado() { if (savePend) escribirMesa(); }

// ======================= Texturas procedurales =======================
const aleat = s => RNG.aleat(s); // xorshift32 sembrado (src/rng.js): texturas y modelo de colisión. Llama a RNG.aleat en cada uso (DT12): así el test de «sin reintento» cuenta también los generadores que se creen desde aquí
function lienzo(w, h, dibujar, { color = true, rep = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (color) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (rep) t.repeat.set(...rep); return t;
}
function ruido(x, w, h, n, a, b, seed, rmin = 0.5, rmax = 1.5) { const r = aleat(seed); for (let i = 0; i < n; i++) { const v = a + (b - a) * r(); x.fillStyle = `rgba(${v},${v},${v},${0.08 + 0.2 * r()})`; const s = rmin + (rmax - rmin) * r(); x.fillRect(r() * w, r() * h, s, s); } }
const TEX = {};
TEX.suelo = lienzo(256, 256, (x, w, h) => { // baldosa de 30 cm como la del laboratorio
  x.fillStyle = '#cfccc5'; x.fillRect(0, 0, w, h); const r = aleat(7);
  for (let i = 0; i < 3500; i++) { const v = 150 + 90 * r(); x.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.25 + 0.3 * r()})`; const s = 0.6 + 1.8 * r(); x.fillRect(r() * w, r() * h, s, s); }
  x.fillStyle = 'rgba(120,115,108,0.55)'; x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h);
}, { rep: [33, 33] });
TEX.cepillado = lienzo(256, 256, (x, w, h) => { x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h); const r = aleat(3); for (let i = 0; i < 900; i++) { const v = 90 + 110 * r(); x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(0, r() * h, w, 0.6 + r()); } }, { color: false, rep: [2, 2] });
TEX.carton = lienzo(256, 256, (x, w, h) => { x.fillStyle = '#b58d5d'; x.fillRect(0, 0, w, h); const r = aleat(11); for (let i = 0; i < 2600; i++) { const v = r(); x.fillStyle = v > 0.5 ? 'rgba(90,60,30,0.10)' : 'rgba(230,200,150,0.10)'; x.fillRect(r() * w, r() * h, 1 + 6 * r(), 0.8); } for (let y = 0; y < h; y += 9) { x.fillStyle = 'rgba(80,55,25,0.06)'; x.fillRect(0, y, w, 3); } });
TEX.cartonTop = lienzo(256, 256, (x, w, h) => { x.drawImage(TEX.carton.image, 0, 0); x.fillStyle = 'rgba(214,190,140,0.85)'; x.fillRect(w * 0.38, 0, w * 0.24, h); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(w * 0.40, 0, 3, h); x.strokeStyle = 'rgba(70,45,20,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); });
TEX.hoyuelos = lienzo(256, 128, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); const r = aleat(5); for (let i = 0; i < 1600; i++) { const v = r() > 0.5 ? 60 : 200; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.beginPath(); x.arc(r() * w, r() * h, 0.8 + 1.4 * r(), 0, 7); x.fill(); } }, { color: false });
TEX.manzana = lienzo(512, 256, (x, w, h) => { // rojo con zona amarillenta abajo, vetas finas difuminadas y lenticelas
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e0a64a'); g.addColorStop(0.18, '#cf4a2c'); g.addColorStop(0.6, '#b52024'); g.addColorStop(1, '#8a161b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = aleat(9); x.filter = 'blur(2px)'; for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(245,${150 + 70 * r()},70,${0.05 + 0.07 * r()})`; x.fillRect(r() * w, h * 0.1 * r(), 1 + 2 * r(), h * (0.3 + 0.5 * r())); }
  x.filter = 'none'; for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,230,170,${0.25 + 0.3 * r()})`; x.beginPath(); x.arc(r() * w, r() * h, 0.6 + 0.8 * r(), 0, 7); x.fill(); } });
TEX.pera = lienzo(256, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c9d65a'); g.addColorStop(1, '#a6c23c'); x.fillStyle = g; x.fillRect(0, 0, w, h); const r = aleat(13); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(120,110,40,${0.2 + 0.3 * r()})`; x.fillRect(r() * w, r() * h, 1.2, 1.2); } });
TEX.tela = lienzo(128, 128, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, y, w, 1); } for (let i = 0; i < w; i += 2) { x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(i, 0, 1, h); } }, { color: false, rep: [6, 6] });
TEX.bandeja = lienzo(256, 256, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); ruido(x, w, h, 4000, 40, 220, 17); }, { color: false, rep: [3, 3] });
TEX.moleteado = lienzo(64, 64, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 4) { x.fillStyle = '#3a3a3a'; x.fillRect(i, 0, 2, h); } }, { color: false, rep: [10, 1] });

// ======================= Renderizador y escena =======================
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
view.prepend(renderer.domElement);
const labels = new CSS2DRenderer(); labels.domElement.className = 'labels'; view.appendChild(labels.domElement);
const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; pm.dispose(); }
const cam = new THREE.PerspectiveCamera(38, 1, 0.02, 40); cam.up.set(0, 0, 1);
cam.layers.enable(1);
const orbit = new OrbitControls(cam, renderer.domElement); orbit.enableDamping = true; orbit.dampingFactor = 0.12;
orbit.maxPolarAngle = PI * 0.495;
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.3); hemi.position.set(0, 0, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6ea, 1.9); sun.position.set(1.2, -1.4, 3.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 6 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.002; sun.shadow.radius = 3; sun.target.position.set(0, 0, MESA.h); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xe8f0ff, 0.35); fill.position.set(-2, 1.5, 2); scene.add(fill);

const floorMat = new THREE.MeshStandardMaterial({ map: TEX.suelo, roughness: 0.85, metalness: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat); floor.receiveShadow = true; scene.add(floor);
function aplicarTema() {
  const bg = new THREE.Color(css('--scene-bg')); scene.background = bg; renderer.setClearColor(bg);
  scene.fog = new THREE.Fog(bg, 4.5, 9);
  const oscuro = (getComputedStyle(document.documentElement).colorScheme || '').includes('dark');
  floorMat.color.set(oscuro ? '#4a4f55' : '#ffffff');
  dibujarGrafo(); if (perfilAlc) dibujarGrafica();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarTema);
new MutationObserver(aplicarTema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// --- Mesa ---
const mesa = new THREE.Group(); scene.add(mesa);
{
  const top = new THREE.Mesh(new RoundedBoxGeometry(MESA.w, MESA.d, MESA.e, 3, 0.006), new THREE.MeshPhysicalMaterial({ color: '#1b1e21', roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.5 }));
  top.position.z = MESA.h - MESA.e / 2; top.receiveShadow = true; top.castShadow = true; mesa.add(top);
  const legM = new THREE.MeshStandardMaterial({ color: '#2c3034', roughness: 0.5, metalness: 0.4 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const lg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, MESA.h - MESA.e), legM);
    lg.position.set(sx * (MESA.w / 2 - 0.06), sy * (MESA.d / 2 - 0.06), (MESA.h - MESA.e) / 2); lg.castShadow = true; mesa.add(lg);
  }
  const trav = new THREE.Mesh(new THREE.BoxGeometry(MESA.w - 0.12, 0.03, 0.05), legM); trav.position.set(0, MESA.d / 2 - 0.06, 0.18); mesa.add(trav);
  const trav2 = trav.clone(); trav2.position.y = -(MESA.d / 2 - 0.06); mesa.add(trav2);
}
const fotoMat = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.95 });
const foto = new THREE.Mesh(new THREE.PlaneGeometry(MESA.w - 0.004, MESA.d - 0.004), fotoMat); foto.position.z = MESA.h + 0.0006; foto.receiveShadow = true; mesa.add(foto);
new THREE.TextureLoader().load('mesa.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; fotoMat.map = t; fotoMat.needsUpdate = true; }, undefined, () => { foto.visible = false; });

// Capa del mapa de alcance
const alcCanvas = document.createElement('canvas');
const alcTex = new THREE.CanvasTexture(alcCanvas); alcTex.magFilter = THREE.NearestFilter; alcTex.colorSpace = THREE.SRGBColorSpace;
const alcPlane = new THREE.Mesh(new THREE.PlaneGeometry(MESA.w, MESA.d), new THREE.MeshBasicMaterial({ map: alcTex, transparent: true, depthWrite: false, toneMapped: false }));
alcPlane.position.z = MESA.h + 0.0015; alcPlane.renderOrder = 2; scene.add(alcPlane); alcPlane.visible = false;

// ======================= Robots =======================
const VIS = { shoulder: [0, 0, 0, 0, 0, PI], upperarm: [0, 0, 0.120, PI / 2, 0, -PI / 2], forearm: [0, 0, 0.027, PI / 2, 0, -PI / 2], wrist1: [0, 0, -0.104, PI / 2, 0, 0], wrist2: [0, 0, -0.08535, 0, 0, 0], wrist3: [0, 0, -0.0921, PI / 2, 0, 0] };
class Robot {
  constructor(gltf, nombre, fantasma) {
    this.root = new THREE.Group(); this.root.name = nombre; this.meshes = []; this.porLink = {};
    const t = fantasma ? { transparent: true, opacity: 0.45, depthWrite: false } : {};
    const mats = {
      gris: new THREE.MeshStandardMaterial({ color: '#585b5f', roughness: 0.42, metalness: 0.12, ...t }),
      negro: new THREE.MeshStandardMaterial({ color: '#161718', roughness: 0.55, ...t }),
      azul: new THREE.MeshPhysicalMaterial({ color: '#9cc2db', roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.4, ...t }),
      plata: new THREE.MeshStandardMaterial({ color: '#c9cdd1', roughness: 0.26, metalness: 0.9, ...t }),
    };
    const link = name => { const g = new THREE.Group(); this.porLink[name] = []; gltf.scene.traverse(o => { if (o.isMesh && o.name.startsWith(name + '__')) { const k = (o.name.split('__')[1].match(/^[a-z]+/) || ['gris'])[0]; if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); const m = new THREE.Mesh(o.geometry, mats[k] || mats.gris); m.castShadow = !fantasma; m.receiveShadow = !fantasma; g.add(m); this.meshes.push(m); this.porLink[name].push(m); } }); return g; };
    const place = (g, v) => { g.matrixAutoUpdate = false; g.matrix.copy(m4(KIN.org(...v))); return g; };
    this.root.add(link('base'));
    this.j = []; this.o = []; let parent = this.root; const names = ['shoulder', 'upperarm', 'forearm', 'wrist1', 'wrist2', 'wrist3'];
    for (let i = 0; i < 6; i++) { const o = new THREE.Group(); o.matrixAutoUpdate = false; o.matrix.copy(m4(KIN.JO[i])); parent.add(o); this.o.push(o); const j = new THREE.Group(); o.add(j); j.add(place(link(names[i]), VIS[names[i]])); this.j.push(j); parent = j; }
    this.tool0 = new THREE.Group(); this.tool0.matrixAutoUpdate = false; this.tool0.matrix.copy(m4(KIN.W3T)); parent.add(this.tool0);
    this.q = [0, -PI / 2, 0, -PI / 2, 0, 0]; this.setQ(this.q);
  }
  // Orígenes de articulación de otra cinemática (T1.4): el brazo se dibuja con la misma cadena que usan la IK y la colisión
  setCinematica(C) { for (let i = 0; i < 6; i++) this.o[i].matrix.copy(m4(C.JO[i])); this.tool0.matrix.copy(m4(C.W3T)); this.root.updateMatrixWorld(true); }
  setQ(q) { this.q = q.slice(); for (let i = 0; i < 6; i++) this.j[i].rotation.z = q[i]; this.root.updateMatrixWorld(true); }
  place(x, y, yaw) { this.root.position.set(x, y, MESA.h); this.root.rotation.set(0, 0, yaw); this.root.updateMatrixWorld(true); }
  puntos() { const p = []; const v = new THREE.Vector3(); for (let i = 0; i < 6; i++) { this.j[i].getWorldPosition(v); p.push(v.clone()); } this.tool0.getWorldPosition(v); p.push(v.clone()); return p; }
}

// ======================= Pinza RG2 paramétrica =======================
const MAT = {
  alu: new THREE.MeshPhysicalMaterial({ color: '#aeb4ba', metalness: 0.8, roughness: 0.4, roughnessMap: TEX.cepillado, anisotropy: 0.6 }),
  goma: new THREE.MeshStandardMaterial({ color: '#131415', roughness: 0.92, roughnessMap: TEX.hoyuelos }),
  azulAnod: new THREE.MeshPhysicalMaterial({ color: '#1e6fc4', metalness: 0.65, roughness: 0.3, clearcoat: 0.3 }),
  negroMate: new THREE.MeshStandardMaterial({ color: '#1d1f21', roughness: 0.6, metalness: 0.2 }),
  negroBrillo: new THREE.MeshPhysicalMaterial({ color: '#141516', roughness: 0.3, metalness: 0.3, clearcoat: 0.6 }),
  cromo: new THREE.MeshStandardMaterial({ color: '#e6e8ea', metalness: 1, roughness: 0.12 }),
  cristal: new THREE.MeshPhysicalMaterial({ color: '#0d1620', roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }),
};
class Pinza {
  constructor() {
    this.g = new THREE.Group(); this.w = 0.06; const P = RG2; this.P = P;
    const cyl = (r, h, m, seg = 40) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); c.rotation.x = PI / 2; c.castShadow = true; return c; };
    const a = cyl(0.032, 0.007, MAT.negroMate); a.position.z = 0.0035; this.g.add(a);
    const b = cyl(0.0355, 0.015, MAT.azulAnod); b.position.z = 0.0145; this.g.add(b);
    const len = P.cuerpo - 0.022, hw = P.ancho / 2, sh = new THREE.Shape(); const r = 0.012;
    sh.moveTo(-hw + r, 0); sh.lineTo(hw - r, 0); sh.quadraticCurveTo(hw, 0, hw, r); sh.lineTo(hw * 0.78, len * 0.5); sh.lineTo(hw, len - r); sh.quadraticCurveTo(hw, len, hw - r, len);
    sh.lineTo(-hw + r, len); sh.quadraticCurveTo(-hw, len, -hw, len - r); sh.lineTo(-hw * 0.78, len * 0.5); sh.lineTo(-hw, r); sh.quadraticCurveTo(-hw, 0, -hw + r, 0);
    const bg = new THREE.ExtrudeGeometry(sh, { depth: P.esp, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 3, curveSegments: 10 });
    bg.rotateX(PI / 2); bg.translate(0, P.esp / 2, 0.022);
    const body = new THREE.Mesh(bg, MAT.alu); body.castShadow = true; this.g.add(body);
    for (const s of [-1, 1]) { const tapa = new THREE.Mesh(new THREE.CircleGeometry(0.008, 24), MAT.negroMate); tapa.position.set(0, s * (P.esp / 2 + 0.0021), 0.03 + len * 0.2); tapa.rotation.x = s * PI / 2; this.g.add(tapa); }
    this.zPiv = P.cuerpo - 0.012;
    this.dedos = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, P.esp + 0.004, 32), MAT.alu); piv.position.set(s * P.piv, 0, this.zPiv); piv.castShadow = true; this.g.add(piv);
      for (const sy of [-1, 1]) { const tor = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 12), MAT.cromo); tor.position.set(s * P.piv, sy * (P.esp / 2 + 0.003), this.zPiv); this.g.add(tor); }
      const f = new THREE.Group(); f.position.set(s * P.piv, 0, this.zPiv); this.g.add(f);
      const link = new THREE.Mesh(new RoundedBoxGeometry(0.009, P.esp * 0.85, P.L, 2, 0.002), MAT.alu); link.position.z = P.L / 2; link.castShadow = true; f.add(link);
      const cover = new THREE.Mesh(new RoundedBoxGeometry(0.005, P.esp * 0.7, P.L * 0.8, 2, 0.0015), MAT.goma); cover.position.set(-s * 0.006, 0, P.L / 2); f.add(cover);
      const tip = new THREE.Group(); tip.position.z = P.L; f.add(tip);
      const tb = new THREE.Mesh(new RoundedBoxGeometry(0.012, P.esp * 0.9, 0.042, 2, 0.002), MAT.alu); tb.position.set(0, 0, P.tip); tb.castShadow = true; tip.add(tb);
      const pad = new THREE.Mesh(new RoundedBoxGeometry(0.005, P.esp * 0.8, 0.034, 2, 0.0015), MAT.goma); pad.position.set(-s * 0.0075, 0, P.tip); tip.add(pad);
      const yema = new THREE.Object3D(); yema.position.set(0, 0, P.tip); tip.add(yema);
      this.dedos.push({ s, f, tip, yema });
    }
    this.tcp = new THREE.Group(); this.g.add(this.tcp);
    const mk = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), new THREE.MeshBasicMaterial({ color: '#e6b422' })); mk.layers.set(1); mk.userData.noCol = true; this.tcp.add(mk);
    this.setApertura(0.06);
  }
  ang(w) { return Math.asin(clamp((w / 2 - this.P.piv + 0.010) / this.P.L, -0.95, 0.95)); }
  tcpZ(w = this.w) { return this.zPiv + this.P.L * Math.cos(this.ang(w)) + this.P.tip; }
  setApertura(w) {
    this.w = clamp(w, 0, this.P.carrera); const th = this.ang(this.w);
    for (const d of this.dedos) { d.f.rotation.y = d.s * th; d.tip.rotation.y = -d.s * th; }
    this.tcp.position.set(0, 0, this.tcpZ());
  }
  mallas() { const m = []; this.g.traverse(o => { if (o.isMesh && !o.userData.noCol) m.push(o); }); return m; }
}

// ======================= Geometría de objetos =======================
function arucoTex(id) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 96); x.fillStyle = '#000'; x.fillRect(8, 8, 80, 80);
  const bits = ARUCO[id % ARUCO.length];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) if (bits[r * 4 + k] === '1') { x.fillStyle = '#fff'; x.fillRect(8 + 13.33 * (k + 1), 8 + 13.33 * (r + 1), 13.4, 13.4); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function aruco(id, lado = 0.05) {
  const g = new THREE.Group();
  const papel = new THREE.Mesh(new THREE.PlaneGeometry(lado * 1.25, lado * 1.25), new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.9 })); papel.receiveShadow = true; g.add(papel);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), new THREE.MeshStandardMaterial({ map: arucoTex(id), roughness: 0.85 })); m.position.z = 0.0002; m.receiveShadow = true; g.add(m);
  g.userData.id = id; g.userData.lado = lado; return g;
}
const plastico = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.18, ...o });
function lathe(pts, mat, seg = 48) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); g.rotateX(PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
const FRUTAS = {
  manzana: { nombre: 'Manzana', w: 0.068, h: 0.034, r: 0.034, make() { const g = new THREE.Group(); const s = lathe([[0, -0.031], [0.02, -0.03], [0.032, -0.02], [0.035, -0.002], [0.032, 0.018], [0.02, 0.029], [0.008, 0.026], [0, 0.022]], plastico({ map: TEX.manzana, bumpMap: TEX.hoyuelos, bumpScale: 0.0004 }), 40); g.add(s); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0024, 0.016), new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.8 })); st.rotation.x = PI / 2; st.rotation.y = 0.25; st.position.z = 0.03; g.add(st); const hoja = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), plastico({ color: '#3f8f3a' })); hoja.scale.set(1.6, 0.6, 0.2); hoja.position.set(0.007, 0, 0.035); hoja.rotation.y = -0.5; g.add(hoja); return g; } },
  pera: { nombre: 'Pera', w: 0.06, h: 0.03, r: 0.031, make() { const g = new THREE.Group(); g.add(lathe([[0, -0.03], [0.02, -0.029], [0.03, -0.02], [0.031, -0.008], [0.025, 0.006], [0.017, 0.022], [0.013, 0.036], [0.007, 0.046], [0, 0.048]], plastico({ map: TEX.pera, bumpMap: TEX.hoyuelos, bumpScale: 0.0003 }), 40)); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.002, 0.014), new THREE.MeshStandardMaterial({ color: '#5a3a1e' })); st.rotation.x = PI / 2; st.position.z = 0.053; g.add(st); return g; } },
  uvas: { nombre: 'Uvas', w: 0.052, h: 0.03, r: 0.03, make() { const g = new THREE.Group(); const mt = plastico({ color: '#5b3a9c', roughness: 0.22, clearcoat: 1 }); const geo = new THREE.SphereGeometry(0.0115, 16, 12); const rows = [[0.024, 6], [0.018, 5], [0.011, 3], [0, 1]]; rows.forEach(([r, n], k) => { for (let i = 0; i < n; i++) { const a = i / n * 2 * PI + k; const s = new THREE.Mesh(geo, mt); s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.012 - k * 0.011); s.castShadow = true; g.add(s); } }); const ra = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.016), new THREE.MeshStandardMaterial({ color: '#4d6b2a' })); ra.rotation.x = PI / 2; ra.position.z = 0.022; g.add(ra); g.rotation.x = PI / 2.4; return g; } },
  limon: { nombre: 'Limón', w: 0.058, h: 0.029, r: 0.03, make() { const s = new THREE.Mesh(new THREE.SphereGeometry(0.029, 32, 20), plastico({ color: '#f2d33c', bumpMap: TEX.hoyuelos, bumpScale: 0.0012, roughness: 0.4 })); s.scale.set(1.3, 1, 1); s.castShadow = true; const g = new THREE.Group(); g.add(s); for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.01, 12), s.material); p.rotation.z = -sx * PI / 2; p.position.x = sx * 0.04; g.add(p); } return g; } },
  frambuesa: { nombre: 'Frambuesa', w: 0.045, h: 0.022, r: 0.022, make() { const g = new THREE.Group(); const mt = plastico({ color: '#cf2f55', roughness: 0.45, clearcoat: 0.4 }); const geo = new THREE.SphereGeometry(0.0085, 12, 8); for (let i = 0; i < 26; i++) { const u = (i + 0.5) / 26, th = Math.acos(1 - 2 * u), ph = i * 2.4; const s = new THREE.Mesh(geo, mt); s.position.set(Math.sin(th) * Math.cos(ph) * 0.016, Math.sin(th) * Math.sin(ph) * 0.016, Math.cos(th) * 0.019); s.castShadow = true; g.add(s); } return g; } },
  naranja: { nombre: 'Naranja', w: 0.066, h: 0.033, r: 0.033, make() { const s = new THREE.Mesh(new THREE.SphereGeometry(0.033, 32, 20), plastico({ color: '#ee8526', bumpMap: TEX.hoyuelos, bumpScale: 0.0015, roughness: 0.5 })); s.castShadow = true; return s; } },
};
const PIEZAS_DEF = [ // en la zona de fruta, coordenadas locales (separadas: plan A)
  { tipo: 'manzana', u: -0.072, v: 0.04 }, { tipo: 'pera', u: 0, v: 0.04 }, { tipo: 'manzana', u: 0.072, v: 0.04 },
  { tipo: 'uvas', u: -0.072, v: -0.04 }, { tipo: 'frambuesa', u: 0, v: -0.04 }, { tipo: 'limon', u: 0.072, v: -0.04 },
];
const platoPts = [[0, 0.002], [0.045, 0.002], [0.05, 0.0005], [0.052, 0.003], [0.06, 0.008], [0.074, 0.019], [0.08, 0.023], [0.0795, 0.025], [0.0735, 0.0225], [0.059, 0.012], [0.049, 0.0055], [0, 0.0055]];
const platoMat = new THREE.MeshPhysicalMaterial({ color: '#f4f2ec', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide });

// --- Construcción de la escena de objetos ---
const pickables = []; const OBJ = {}; const LBL = {};
function etiqueta(texto, cls = '') { const d = document.createElement('div'); d.className = 'lbl ' + cls; d.textContent = texto; return new CSS2DObject(d); }

// Zona de fruta
OBJ.zona = new THREE.Group(); scene.add(OBJ.zona);
const zonaBorde = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#e6b422' }));
OBJ.zona.add(zonaBorde);
const zonaFondo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#e6b422', transparent: true, opacity: 0.08, depthWrite: false })); zonaFondo.position.z = 0.0009; OBJ.zona.add(zonaFondo);
const zonaMarc = []; for (let i = 0; i < 4; i++) { const a = aruco(i, 0.04); a.position.z = 0.0012; OBJ.zona.add(a); zonaMarc.push(a); }
LBL.zona = etiqueta('Zona de fruta · V2'); OBJ.zona.add(LBL.zona);
let piezas = [];
function crearPiezas() { VERSION_ESCENA++;
  piezas.forEach(p => p.obj.parent && p.obj.parent.remove(p.obj));
  piezas = PIEZAS_DEF.map((d, i) => { const F = FRUTAS[d.tipo]; const o = F.make(); o.position.set(d.u, d.v, F.h); o.rotation.z = (i * 1.7) % PI; OBJ.zona.add(o); return { id: i, tipo: d.tipo, F, obj: o, u: d.u, v: d.v, usada: false, enPinza: false }; });
}
crearPiezas();
function actualizarZona() {
  const z = L.zona; OBJ.zona.position.set(z.x, z.y, MESA.h); OBJ.zona.rotation.z = z.yaw;
  const hw = z.w / 2, hd = z.d / 2;
  zonaBorde.geometry.setFromPoints([new THREE.Vector3(-hw, -hd, 0.001), new THREE.Vector3(hw, -hd, 0.001), new THREE.Vector3(hw, hd, 0.001), new THREE.Vector3(-hw, hd, 0.001)]);
  zonaFondo.scale.set(z.w, z.d, 1);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => zonaMarc[i].position.set(sx * (hw + 0.026), sy * (hd + 0.026), 0.0012));
  LBL.zona.position.set(0, hd + 0.05, 0.02);
}
pickables.push({ key: 'zona', obj: OBJ.zona, nombre: 'Zona de fruta', grupo: 'V2' });

// Platos y cajas
const cajaMats = [new THREE.MeshStandardMaterial({ map: TEX.carton, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: TEX.carton, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: TEX.carton, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: TEX.carton, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: TEX.cartonTop, roughness: 0.85 }), new THREE.MeshStandardMaterial({ map: TEX.carton, roughness: 0.9 })];
for (const k of ['plato1', 'plato2']) {
  const g = new THREE.Group(); const p = lathe(platoPts, platoMat, 64); g.add(p); scene.add(g); OBJ[k] = g;
  LBL[k] = etiqueta(k === 'plato1' ? 'Plato 1º' : 'Plato 2º'); LBL[k].position.set(0, 0, 0.07); g.add(LBL[k]);
  const caja = new THREE.Group(); const cm = new THREE.Mesh(new RoundedBoxGeometry(CAJA_LADO, CAJA_LADO, 1, 2, 0.003), cajaMats); cm.castShadow = true; cm.receiveShadow = true; caja.add(cm); caja.userData.malla = cm; scene.add(caja); OBJ['caja' + k.slice(-1)] = caja;
  pickables.push({ key: k, obj: g, nombre: k === 'plato1' ? 'Plato 1º' : 'Plato 2º', grupo: 'ROB' });
}
function zPlato() { return MESA.h + (L.caja.on ? L.caja.h : 0); }
function actualizarPlatos() {
  for (const k of ['plato1', 'plato2']) {
    const caja = OBJ['caja' + k.slice(-1)];
    caja.visible = L.caja.on && (k === 'plato1' || L.pedido !== 1); const h = L.caja.h; caja.userData.malla.scale.z = h; caja.userData.malla.position.z = h / 2;
    caja.position.set(L[k].x, L[k].y, MESA.h);
    const b = BASES[L.robot]; caja.rotation.z = Math.atan2(L[k].y - b.y, L[k].x - b.x); caja.updateMatrixWorld(true);
    if (OBJ[k].parent === scene) OBJ[k].position.set(L[k].x, L[k].y, zPlato());
    const pl = robot && L.caja.on && !EDITANDO && planAlDia(k, PERFIL_EXPLORA) ? cachePlan(PERFIL_EXPLORA)[k].pl : null; if (pl) { caja.rotation.z = pl.yaw; caja.updateMatrixWorld(true); }
  }
}
// La caja se orienta con una cara hacia la pinza según el agarre elegido (pasosPlan). Cada perfil puede elegir otro agarre:
// la demo y la comprobación previa de un perfil orientan las cajas con el plan de ese perfil (T1.6), como lo haría
// actualizarPlatos con el de explorar. Si una caja gira, sube VERSION_ESCENA (cambian los obstáculos).
function orientarCajas(pf) {
  const b = BASES[L.robot];
  for (const k of ['plato1', 'plato2']) {
    const caja = OBJ['caja' + k.slice(-1)]; const pl = robot && L.caja.on && !EDITANDO && planAlDia(k, pf) ? cachePlan(pf)[k].pl : null;
    const yaw = pl ? pl.yaw : Math.atan2(L[k].y - b.y, L[k].x - b.x); if (caja.rotation.z !== yaw) { caja.rotation.z = yaw; caja.updateMatrixWorld(true); VERSION_ESCENA++; }
  }
}

// Marcadores fijos de la cámara de entrega
OBJ.arucoE = L.arucoE.map((p, i) => { const a = aruco(4 + i, 0.06); scene.add(a); pickables.push({ key: 'arucoE' + i, obj: a, nombre: `Marcador ${i + 1} (id ${4 + i})`, grupo: 'V1', idx: i }); return a; });
function actualizarAruco() { OBJ.arucoE.forEach((a, i) => a.position.set(L.arucoE[i].x, L.arucoE[i].y, MESA.h + 0.0013)); }

// Persona y bandeja
const persona = new THREE.Group(); scene.add(persona); OBJ.persona = persona;
const pielM = new THREE.MeshStandardMaterial({ color: '#b9a99a', roughness: 0.75 });
const camisaM = new THREE.MeshStandardMaterial({ color: '#6f8396', roughness: 0.95, roughnessMap: TEX.tela, bumpMap: TEX.tela, bumpScale: 0.0006 });
const pantM = new THREE.MeshStandardMaterial({ color: '#2f3a48', roughness: 0.95, roughnessMap: TEX.tela, bumpMap: TEX.tela, bumpScale: 0.0006 });
function capsula(r, l, m) { const g = new THREE.CapsuleGeometry(r, l, 8, 16); g.rotateX(PI / 2); const c = new THREE.Mesh(g, m); c.castShadow = true; return c; }
{
  for (const s of [-1, 1]) { const lg = capsula(0.065, 0.72, pantM); lg.position.set(0, s * 0.1, 0.43); persona.add(lg); const zap = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.1, 0.06, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7 })); zap.position.set(0.05, s * 0.1, 0.03); zap.castShadow = true; persona.add(zap); }
  const tor = capsula(0.16, 0.42, camisaM); tor.position.set(0, 0, 1.17); tor.scale.set(0.72, 1.05, 1); persona.add(tor);
  const cue = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), pielM); cue.rotation.x = PI / 2; cue.position.z = 1.5; persona.add(cue);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.105, 28, 18), pielM); cab.scale.set(0.95, 0.85, 1.12); cab.position.z = 1.63; cab.castShadow = true; persona.add(cab);
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.108, 28, 18, 0, 2 * PI, 0, PI * 0.55), new THREE.MeshStandardMaterial({ color: '#2b211b', roughness: 0.8 })); pelo.rotation.x = PI / 2; pelo.rotation.z = PI; pelo.scale.set(0.97, 0.87, 1.14); pelo.position.set(-0.008, 0, 1.645); persona.add(pelo);
  persona.userData.cara = new THREE.Object3D(); persona.userData.cara.position.set(0.09, 0, 1.64); persona.add(persona.userData.cara);
}
const brazos = []; for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 1, 14), i % 2 ? pielM : camisaM); c.castShadow = true; scene.add(c); brazos.push(c); }
LBL.persona = etiqueta('Persona'); LBL.persona.position.set(0, 0, 1.85); persona.add(LBL.persona);
pickables.push({ key: 'persona', obj: persona, nombre: 'Persona y bandeja', grupo: 'V1' });

const bandeja = new THREE.Group(); scene.add(bandeja); OBJ.bandeja = bandeja;
const bandMarc = []; // marcadores de la bandeja (ids 6–9, de 32 mm): los lee tareasCam (T4.1)
const BAND = { w: 0.45, d: 0.33, e: 0.012 }; // bandeja de autoservicio típica [SUPUESTO]: con 36 cm, el borde de los platos caía sobre los dedos de quien la sujeta
{
  const m = new THREE.MeshPhysicalMaterial({ color: '#7f95a6', roughness: 0.55, clearcoat: 0.2, bumpMap: TEX.bandeja, bumpScale: 0.0004 });
  const b = new THREE.Mesh(new RoundedBoxGeometry(BAND.d, BAND.w, BAND.e, 3, 0.004), m); b.position.z = -BAND.e / 2; b.castShadow = true; b.receiveShadow = true; bandeja.add(b);
  const rimM = new THREE.MeshPhysicalMaterial({ color: '#6b8193', roughness: 0.5, clearcoat: 0.2 });
  for (const [sx, sy, lx, ly] of [[1, 0, 0.008, BAND.w + 0.016], [-1, 0, 0.008, BAND.w + 0.016], [0, 1, BAND.d, 0.008], [0, -1, BAND.d, 0.008]]) { const r = new RoundedBoxGeometry(lx, ly, 0.012, 2, 0.003); const rm = new THREE.Mesh(r, rimM); rm.position.set(sx * (BAND.d / 2 + 0.004), sy * (BAND.w / 2 + 0.004), -0.002); rm.castShadow = true; bandeja.add(rm); }
  [[0.14, -0.17], [0.14, 0.0], [0.14, 0.17], [-0.05, 0.205]].forEach(([u, v], i) => { const a = aruco(6 + i, 0.032); a.position.set(u, v, 0.0006); bandeja.add(a); bandMarc.push(a); });
}
const zonasB = {};
for (const [k, v] of [['zona_primero', 0.10], ['zona_segundo', -0.10], ['zona_centro', 0]]) {
  const z = new THREE.Group(); z.position.set(-0.02, v, 0.0005); bandeja.add(z); zonasB[k] = z;
  const ln = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-0.085, -0.08], [0.085, -0.08], [0.085, 0.08], [-0.085, 0.08]].map(([a, b]) => new THREE.Vector3(a, b, 0.0004))), new THREE.LineBasicMaterial({ color: '#ffffff' }));
  z.add(ln); const l = etiqueta(k); l.element.classList.add('tf'); l.position.set(0, 0, 0.01); z.add(l); z.userData.lbl = l;
}
// Versión del pedido: 1 plato (al centro de la bandeja) o 2 platos (primero y segundo, uno a cada lado)
function platosActivos() { return L.pedido === 1 ? [['plato1', 'zona_centro']] : [['plato1', 'zona_primero'], ['plato2', 'zona_segundo']]; }
function zonaDe(pk) { const a = platosActivos().find(x => x[0] === pk); return a ? a[1] : 'zona_segundo'; }
function aplicarPedido() {
  const uno = L.pedido === 1; OBJ.plato2.visible = !uno; OBJ.caja2.visible = !uno && L.caja.on; zonasB.zona_centro.visible = uno; zonasB.zona_primero.visible = zonasB.zona_segundo.visible = !uno; for (const k in zonasB) zonasB[k].userData.lbl.visible = zonasB[k].visible; LBL.plato2.visible = !uno; // las etiquetas HTML no heredan la visibilidad
  PASOS = uno ? PASOS1 : PASOS2; $$('#segPedido button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.v === L.pedido)); VERSION_ESCENA++;
  const it = pickables.find(p => p.key === 'plato2'); if (it) it.oculto = uno;
}
function ladoZonas() { // la zona del primero queda del lado del robot
  const b = BASES[L.robot]; bandeja.updateMatrixWorld(true);
  const a = zonasB.zona_primero.getWorldPosition(new THREE.Vector3()), c = zonasB.zona_segundo.getWorldPosition(new THREE.Vector3());
  if (Math.hypot(a.x - b.x, a.y - b.y) > Math.hypot(c.x - b.x, c.y - b.y)) { const t = zonasB.zona_primero.position.y; zonasB.zona_primero.position.y = zonasB.zona_segundo.position.y; zonasB.zona_segundo.position.y = t; }
}
const BALANCEO = t => ({ dx: 0.55 * Math.sin(2 * PI * 0.33 * t) + 0.35 * Math.sin(2 * PI * 0.87 * t + 1.1), dy: 0.6 * Math.sin(2 * PI * 0.47 * t + 2.0) + 0.25 * Math.sin(2 * PI * 1.1 * t), dz: 0.3 * Math.sin(2 * PI * 0.71 * t + 0.4), dyaw: 0.9 * Math.sin(2 * PI * 0.29 * t + 0.7) });
const trayState = { subida: 1, balanceo: false };
function poseBandeja(t) { return poseBandejaDe(BALANCEO(t + D.fase), (D.amp || 0) * (trayState.balanceo ? 1 : 0), trayState.subida); }
// Pose de la bandeja con el desplazamiento o de BALANCEO, la amplitud A y la subida s (de 0, bajada, a 1, en recepción)
function poseBandejaDe(o, A, s) {
  const P = L.persona, B = L.bandeja;
  const ade = 0.18 + (B.ade - 0.18) * s, alt = (B.alt - 0.22) + 0.22 * s;
  const yaw = P.yaw + o.dyaw * A * 1.6; const lx = ade + o.dx * A, ly = o.dy * A;
  return { x: P.x + Math.cos(P.yaw) * lx - Math.sin(P.yaw) * ly, y: P.y + Math.sin(P.yaw) * lx + Math.cos(P.yaw) * ly, z: alt + o.dz * A, yaw };
}
// La bandeja en todo su balanceo (T2.8, DT30): la salida de la bandeja acaba en una postura (qU) en la que la bandeja puede
// estar en cualquier punto de su recorrido, según cuándo llegue el brazo. BALANCEO es periódico: sus frecuencias son
// centésimas de hercio (0,33, 0,87, 0,47, 1,1, 0,71 y 0,29 Hz), así que se repite cada BAL_T = 100 s. Se toman muestras de
// un periodo entero con la amplitud de la demo (D.amp) y en recepción, sin la fase de la demo (D.fase) ni el reloj: el
// resultado no depende de en qué punto del recorrido esté la bandeja al planificar. El paso es el que mueve cualquier punto
// de la bandeja (en el obstáculo, con su margen) como mucho BAL_PASO entre dos muestras; la mitad entra como margen extra.
// Cada muestra es el obstáculo «bandeja» de obstaculos() con la bandeja en esa pose, en base_link.
const BAL_T = 100, BAL_PASO = 0.001;
let _balCache = { key: '', b: null };
function bandejaBalanceo() {
  const A = D.amp || 0; if (!(A > 0)) return null;
  const P = L.persona, B = L.bandeja, key = [A, P.x, P.y, P.yaw, B.ade, B.alt, L.robot, ROB.id].join('|'); if (_balCache.key === key) return _balCache.b;
  const mb = marco(), hx = BAND.d / 2 + 0.008, hy = BAND.w / 2 + 0.008, hz = 0.009, Rm = Math.hypot(hx, hy, hz);
  const obs = p => { const c = mb.aBase(p.x, p.y, p.z - 0.006), yb = mb.yawABase(p.yaw); return { t: 3, x: c[0], y: c[1], z: c[2], hx, hy, hz, c: Math.cos(yb), s: Math.sin(yb), tag: 'bandeja', m: 0.004, R: Math.hypot(hx, hy, hz) }; };
  // velocidad máxima de un punto de la bandeja por unidad de amplitud (cota de las derivadas de BALANCEO): da el paso
  const v = (0.55 * 0.33 + 0.35 * 0.87) + (0.6 * 0.47 + 0.25 * 1.1) + 0.3 * 0.71 + 0.9 * 0.29 * 1.6 * Rm; const n = Math.ceil(BAL_T * 2 * PI * v * A / BAL_PASO);
  const nominal = obs(poseBandejaDe({ dx: 0, dy: 0, dz: 0, dyaw: 0 }, 0, 1)); const M = new Float64Array(n * 5); let dmax = 0;
  for (let i = 0; i < n; i++) {
    const o = obs(poseBandejaDe(BALANCEO(i * BAL_T / n), A, 1)); M.set([o.x, o.y, o.z, o.c, o.s], i * 5);
    dmax = Math.max(dmax, Math.hypot(o.x - nominal.x, o.y - nominal.y, o.z - nominal.z) + Math.abs(Math.atan2(o.s * nominal.c - o.c * nominal.s, o.c * nominal.c + o.s * nominal.s)) * Rm);
  }
  _balCache = { key, b: { nominal, M, n, dmax, extra: BAL_PASO / 2, hx, hy, hz } }; return _balCache.b;
}
// ¿Toca la postura q (apertura w, sin carga: el plato ya está en la bandeja) la bandeja en alguna pose de su balanceo? Como
// choqueEn con el obstáculo «bandeja» (brazo y pinza, mismo margen), más la mitad del paso entre muestras. Solo se miran las
// esferas que están a menos de lo que se desplaza la bandeja en su balanceo (dmax) de su pose nominal.
function tocaBandejaEnBalanceo(q, w) {
  const b = bandejaBalanceo(); if (!b) return false;
  const n = colocar(q, w, null), X = COL.X, cerca = [];
  for (let i = COL.ini[2]; i < n; i++) { const k = i * 4; if (distObs(b.nominal, X[k], X[k + 1], X[k + 2]) < X[k + 3] + b.nominal.m + b.extra + b.dmax) cerca.push(k); }
  // la distancia de distObs a la caja de cada muestra, con un descarte por ejes antes (casi todas quedan fuera en un eje)
  const M = b.M, m = b.nominal.m + b.extra;
  for (const k of cerca) {
    const x = X[k], y = X[k + 1], z = X[k + 2], lim = X[k + 3] + m, ex = b.hx + lim, ey = b.hy + lim, ez = b.hz + lim;
    for (let j = 0; j < b.n * 5; j += 5) {
      const lz = z - M[j + 2]; if (lz > ez || lz < -ez) continue;
      const dx = x - M[j], dy = y - M[j + 1], c = M[j + 3], s = M[j + 4], lx = dx * c + dy * s; if (lx > ex || lx < -ex) continue;
      const ly = -dx * s + dy * c; if (ly > ey || ly < -ey) continue;
      const qx = Math.abs(lx) - b.hx, qy = Math.abs(ly) - b.hy, qz = Math.abs(lz) - b.hz, fuera = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
      if ((fuera > 0 ? fuera : Math.max(qx, qy, qz)) < lim) return true;
    }
  }
  return false;
}
// Y el arranque del movimiento siguiente (T2.8, decisión 2): en el barrido de hoy, 6 de los 10 contactos con la bandeja no
// eran en qU sino en los primeros centímetros del movimiento hacia la postura de reposo (tránsito o reposo final), con la
// bandeja moviéndose hacia la pinza. Ese movimiento es el camino recto en articulaciones hasta la IK de posReposo() más
// cercana a qU cuando está libre (planificar); se comprueba su tramo inicial, hasta que el TCP se aleja A_ARRANQUE de qU,
// en pasos de como mucho PASO_ARRANQUE rad, frente a la bandeja en todo su balanceo. Si no hay IK del reposo, no se mira: el
// fallo lo da el propio movimiento. [SUPUESTO: si el camino recto choca con la escena del instante, el RRT da otro camino
// y este tramo no lo cubre; y tras el plato 1 con la muñeca a 45° no hay tránsito (servirPlato): el movimiento siguiente va
// a la fruta y este tramo es solo una aproximación.]
const A_ARRANQUE = 0.05, PASO_ARRANQUE = 0.01;
function arranqueLibreEnBalanceo(qU) {
  if (!bandejaBalanceo()) return true;
  const qT = ikTCP(posReposo(), PI / 2, qU, { w: 0.03, carga: null }); if (!qT) return true;
  const p0 = tcpDeQ(qU, 0.03).p, d = Math.max(...qT.map((v, i) => Math.abs(v - qU[i]))), n = Math.max(1, Math.ceil(d / PASO_ARRANQUE));
  for (let k = 1; k <= n; k++) {
    const q = qU.map((v, i) => v + (qT[i] - v) * k / n); if (tocaBandejaEnBalanceo(q, 0.03)) return false;
    if (tcpDeQ(q, 0.03).p.distanceTo(p0) > A_ARRANQUE) break;
  }
  return true;
}
// Pose de plan de la bandeja (DT35): la de recepción, sin balanceo y subida, con la que se planifica cada plato (pasosPlan).
// Fuera de la demo es poseBandeja(t); durante la demo, poseBandeja(0) lleva el balanceo de la fase D.fase. La exportan la TF
// bandeja, bandeja_recepcion y sus zonas (modeloExportacion). No cambia trayState: lo deja como estaba.
function poseBandejaPlan() { const b = trayState.balanceo, s = trayState.subida; trayState.balanceo = false; trayState.subida = 1; try { return poseBandeja(0); } finally { trayState.balanceo = b; trayState.subida = s; } }
function aplicarBandeja(t) {
  const p = poseBandeja(t); bandeja.position.set(p.x, p.y, p.z); bandeja.rotation.set(0, 0, p.yaw); bandeja.updateMatrixWorld(true);
  persona.position.set(L.persona.x + D.personaOff * Math.cos(L.persona.yaw + PI), L.persona.y + D.personaOff * Math.sin(L.persona.yaw + PI), 0); persona.rotation.z = L.persona.yaw; persona.updateMatrixWorld(true);
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const hombro = new THREE.Vector3(0.02, s * 0.2, 1.42).applyMatrix4(persona.matrixWorld);
    const mano = new THREE.Vector3(-0.02, s * (BAND.w / 2 + 0.01), -0.005).applyMatrix4(bandeja.matrixWorld);
    const codo = hombro.clone().lerp(mano, 0.5); codo.z -= 0.12; codo.add(new THREE.Vector3(0, s * 0.06, 0).applyEuler(persona.rotation));
    cilindroEntre(brazos[k * 2], hombro, codo); cilindroEntre(brazos[k * 2 + 1], codo, mano);
  }
}
function cilindroEntre(c, a, b) { const d = b.clone().sub(a); const l = d.length(); c.position.copy(a).addScaledVector(d, 0.5); c.scale.set(1, l, 1); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); }

// ======================= Cámaras =======================
const CAMS = {};
// Campo de visión con el sensor de la escena en el modo de la cámara (T1.7): el frustum, la miniatura y las métricas
function areaDe(c) { return SENSOR.area(sensorEscena(), MODOS[c.modo]); }
function hfovDe(c) { return SENSOR.hfov(areaDe(c).w, c.f); }
function vfovDe(c) { return SENSOR.vfov(areaDe(c).h, c.f); }
function crearCam(k) {
  const c = L.cams[k]; const R = { k };
  R.cam = new THREE.PerspectiveCamera(vfovDe(c) * R2D, MODOS[c.modo].w / MODOS[c.modo].h, 0.03, 8); R.cam.up.set(0, 0, 1); scene.add(R.cam);
  const cuerpo = new THREE.Group(); R.cam.add(cuerpo);
  const caja = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.044, 0.026, 3, 0.004), MAT.negroMate); caja.position.z = 0.013; caja.castShadow = true; cuerpo.add(caja);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.036, 32), MAT.negroBrillo); tubo.rotation.x = PI / 2; tubo.position.z = -0.018; cuerpo.add(tubo);
  const anilloM = new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 0.55, bumpMap: TEX.moleteado, bumpScale: 0.002 });
  for (const z of [-0.008, -0.026]) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.0178, 0.0178, 0.007, 32), anilloM); an.rotation.x = PI / 2; an.position.z = z; cuerpo.add(an); }
  const vidrio = new THREE.Mesh(new THREE.CircleGeometry(0.0125, 32), MAT.cristal); vidrio.position.z = -0.0362; vidrio.rotation.y = PI; cuerpo.add(vidrio);
  R.cuerpo = cuerpo;
  R.clamp = new THREE.Group(); { const cb = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.045, 0.075, 2, 0.006), MAT.negroMate); cb.castShadow = true; R.clamp.add(cb); const pomo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 16), MAT.negroMate); pomo.position.set(0, 0, -0.05); pomo.rotation.x = PI / 2; R.clamp.add(pomo); const esp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 16), MAT.cromo); esp.rotation.x = PI / 2; esp.position.z = 0.05; R.clamp.add(esp); } scene.add(R.clamp);
  R.seg = [0, 1].map(() => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 1, 16), MAT.negroBrillo); s.castShadow = true; scene.add(s); return s; });
  R.codo = new THREE.Group(); { const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 24), MAT.negroMate); R.codo.add(disco); const pomo = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 6), MAT.negroBrillo); pomo.position.y = 0.024; R.codo.add(pomo); } scene.add(R.codo);
  R.mira = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), new THREE.MeshBasicMaterial({ color: '#e6b422' })); R.mira.layers.set(1); scene.add(R.mira);
  R.frus = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.85 })); R.frus.layers.set(1); scene.add(R.frus);
  R.huella = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); R.huella.layers.set(1); scene.add(R.huella);
  R.lbl = etiqueta('Cám. ' + c.nombre.toLowerCase()); R.cam.add(R.lbl); R.lbl.position.set(0, 0.05, 0);
  R.optical = new THREE.Object3D(); R.optical.rotation.x = PI; R.cam.add(R.optical);
  CAMS[k] = R;
  pickables.push({ key: 'cam:' + k, obj: R.cam, nombre: 'Cámara ' + c.nombre.toLowerCase(), grupo: c.grupo, cam: k, parte: 'pos' });
  pickables.push({ key: 'mira:' + k, obj: R.mira, oculto: true, nombre: 'Punto de mira ' + c.nombre.toLowerCase(), grupo: c.grupo, cam: k, parte: 'mira' });
  pickables.push({ key: 'clamp:' + k, obj: R.clamp, oculto: true, nombre: 'Pinza de mesa ' + c.nombre.toLowerCase(), grupo: c.grupo, cam: k, parte: 'clamp' });
}
for (const k in L.cams) crearCam(k);
// Orientación de una cámara en el marco de la mesa: giro en planta (0° = hacia el fondo, positivo hacia la derecha),
// inclinación (positiva hacia abajo) y alabeo alrededor del eje óptico. El punto de mira se mueve conservando su distancia.
function orientDe(c) { const dx = c.mira.x - c.pos.x, dy = c.mira.y - c.pos.y, dz = c.mira.z - c.pos.z; return { pan: Math.atan2(dx, dy), tilt: Math.atan2(-dz, Math.hypot(dx, dy)), roll: c.roll || 0 }; }
function fijarOrient(c, pan, tilt, roll) {
  tilt = clamp(tilt, -60 * D2R, 89 * D2R); pan = Math.atan2(Math.sin(pan), Math.cos(pan)); // mirando justo en vertical el giro queda indefinido
  const d = Math.max(0.3, Math.hypot(c.mira.x - c.pos.x, c.mira.y - c.pos.y, c.mira.z - c.pos.z));
  Object.assign(c.mira, { x: c.pos.x + d * Math.cos(tilt) * Math.sin(pan), y: c.pos.y + d * Math.cos(tilt) * Math.cos(pan), z: c.pos.z - d * Math.sin(tilt) });
  if (roll !== undefined) c.roll = Math.atan2(Math.sin(roll), Math.cos(roll));
}
const _camTmp = new THREE.PerspectiveCamera(); _camTmp.up.set(0, 0, 1);
function orientarDesdeQuat(c, q) { // la cámara girada con los anillos: de su orientación salen el nuevo punto de mira y el alabeo
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); fijarOrient(c, Math.atan2(f.x, f.y), Math.atan2(-f.z, Math.hypot(f.x, f.y)));
  _camTmp.position.set(c.pos.x, c.pos.y, c.pos.z); _camTmp.lookAt(c.mira.x, c.mira.y, c.mira.z);
  const u0 = new THREE.Vector3(0, 1, 0).applyQuaternion(_camTmp.quaternion), u1 = new THREE.Vector3(0, 1, 0).applyQuaternion(q), fw = new THREE.Vector3(0, 0, -1).applyQuaternion(_camTmp.quaternion);
  c.roll = Math.atan2(-fw.dot(u0.clone().cross(u1)), u0.dot(u1));
}
function puntoBorde(x, y) {
  const hw = MESA.w / 2, hd = MESA.d / 2; x = clamp(x, -hw, hw); y = clamp(y, -hd, hd);
  const d = [hw - x, x + hw, hd - y, y + hd]; const i = d.indexOf(Math.min(...d));
  if (i === 0) x = hw; else if (i === 1) x = -hw; else if (i === 2) y = hd; else y = -hd; return { x, y };
}
function actualizarCam(k) {
  const c = L.cams[k], R = CAMS[k]; const col = new THREE.Color(GRUPO_COL()[c.grupo]);
  R.cam.fov = vfovDe(c) * R2D; R.cam.aspect = MODOS[c.modo].w / MODOS[c.modo].h; R.cam.updateProjectionMatrix();
  R.cam.position.set(c.pos.x, c.pos.y, c.pos.z); R.cam.lookAt(c.mira.x, c.mira.y, c.mira.z); R.cam.rotateZ(c.roll || 0); R.cam.updateMatrixWorld(true); // apunta al punto de mira y gira la imagen alrededor del eje óptico
  R.mira.position.set(c.mira.x, c.mira.y, c.mira.z);
  const cp = puntoBorde(c.clamp.x, c.clamp.y); c.clamp.x = cp.x; c.clamp.y = cp.y;
  R.clamp.position.set(cp.x, cp.y, MESA.h - 0.005);
  const base = new THREE.Vector3(cp.x, cp.y, MESA.h + 0.04), punta = new THREE.Vector3(0, 0, 0.03).applyMatrix4(R.cam.matrixWorld);
  const D_ = base.distanceTo(punta), seg = BRAZO_MANFROTTO / 2; R.brazoOK = D_ <= BRAZO_MANFROTTO; R.brazoD = D_;
  const mid = base.clone().lerp(punta, 0.5); const h = R.brazoOK ? Math.sqrt(Math.max(0, seg * seg - D_ * D_ / 4)) : 0;
  const dir = punta.clone().sub(base).normalize(); const perp = new THREE.Vector3(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z)); if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0); perp.normalize();
  const codo = mid.addScaledVector(perp, h); R.codo.position.copy(codo); R.codo.lookAt(punta);
  cilindroEntre(R.seg[0], base, codo); cilindroEntre(R.seg[1], codo, punta);
  R.seg.forEach(s => { s.material = R.brazoOK ? MAT.negroBrillo : new THREE.MeshStandardMaterial({ color: css('--bad') }); });
  const cor = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const d = new THREE.Vector3(u, v, 0.5).unproject(R.cam).sub(R.cam.position).normalize();
    let t = 1.3; if (d.z < -1e-3) { const tt = (MESA.h + 0.002 - R.cam.position.z) / d.z; if (tt > 0) t = Math.min(tt, 2.2); }
    cor.push(R.cam.position.clone().addScaledVector(d, t));
  }
  const pts = []; for (let i = 0; i < 4; i++) pts.push(R.cam.position, cor[i], cor[i], cor[(i + 1) % 4]);
  R.frus.geometry.setFromPoints(pts); R.frus.material.color.copy(col);
  R.huella.geometry.setFromPoints([cor[0], cor[1], cor[2], cor[0], cor[2], cor[3]]); R.huella.geometry.computeVertexNormals(); R.huella.material.color.copy(col);
  R.lbl.element.style.borderColor = col.getStyle();
}

// ======================= Cinemática aplicada =======================
let robot = null, otro = null; const pinza = new Pinza();
let REF_MANIP = 1; const Q_REF_MANIP = [0, -1.9, 1.9, -1.57, -1.57, 0];
// ----- Robot calibrado activo (T1.4, D7) y conversión world ↔ base_link (T1.5) -----
// L.robotId elige la cinemática: 'nominal' (la de src/kin.js tal cual, IK analítica sin refinar) o la calibración del curso
// de 203–206 (src/datos/calibracion.js, IK analítica refinada). También fija el giro de base_link respecto a world, que
// sale de los datos: mount_yaw − π de su xacro (nominal, 205 y 206: 0). L.robot sigue siendo la posición A/B en la celda.
// Solo hay un robot activo: la IK, la colisión y el dibujo del brazo usan CIN. El brazo «otro» (decorativo) es nominal.
const ROBOTS = {};
function robotDe(id) {
  if (!ROBOTS[id]) { const datos = CALIBRACION.robots[id]; ROBOTS[id] = { id, datos, cin: id === 'nominal' ? KIN.nominal : KIN.calibrada(datos.kinematics), yaw: datos.mount_yaw - PI }; }
  return ROBOTS[id];
}
// Un layout de una versión más nueva (solo lectura) puede traer un robot que esta página no conoce: se dibuja con el nominal
const idValido = id => Object.hasOwn(CALIBRACION.robots, id) && LAYOUT.ROBOT_IDS.includes(id) ? id : 'nominal';
let ROB = robotDe(idValido(L.robotId)), CIN = ROB.cin;
// Marco de base_link del robot activo en su posición de la celda: la única conversión entre world (la escena, con los ejes
// de la mesa) y base_link (KIN.marcoBase). Todo lo que pasa de un marco a otro la usa: planificación, colisión, dibujo,
// exportación y textos.
let _marco = { k: '', m: null };
function marco() { const b = BASES[L.robot], k = `${L.robot}|${ROB.id}`; if (_marco.k !== k) _marco = { k, m: KIN.marcoBase(b.x, b.y, MESA.h, ROB.yaw) }; return _marco.m; }
function mundoABase(p) { const r = marco().aBase(p.x, p.y, p.z); return new THREE.Vector3(r[0], r[1], r[2]); }
function baseAMundo(x, y, z) { const r = marco().aMundo(x, y, z); return new THREE.Vector3(r[0], r[1], r[2]); }
const yawABase = a => marco().yawABase(a);
function poseVertical(pb, yawb) { const c = Math.cos(yawb), s = Math.sin(yawb); return [c, s, 0, pb.x, s, -c, 0, pb.y, 0, 0, -1, pb.z, 0, 0, 0, 1]; }
// Pinza horizontal: eje de la herramienta en el plano de la mesa (yaw) y dedos en vertical (flip = ±1)
// Pinza «horizontal»: eje de la herramienta casi horizontal hacia yaw y bajando un ángulo pitch; dedos que se abren en el plano vertical (flip = ±1)
function ejeHoriz(yaw, pitch = 0) { const cp = Math.cos(pitch); return new THREE.Vector3(Math.cos(yaw) * cp, Math.sin(yaw) * cp, -Math.sin(pitch)); }
function poseHoriz(pb, yawb, flip, pitch = 0) {
  const c = Math.cos(yawb), s = Math.sin(yawb), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const z = [c * cp, s * cp, -sp], x = [flip * c * sp, flip * s * sp, flip * cp], y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x[0], y[0], z[0], pb.x, x[1], y[1], z[1], pb.y, x[2], y[2], z[2], pb.z, 0, 0, 0, 1];
}
function qValida(q, minZ = 0.02) {
  const Ls = CIN.fkLinks(q);
  for (let i = 2; i < 7; i++) { const z = Ls[i][11]; if (z < minZ) return false; if (i >= 3 && z < 0.30 && Math.hypot(Ls[i][3], Ls[i][7]) < 0.085) return false; }
  return true;
}
// Poses de tool0 en base_link que piden ikTCP para un TCP en el mundo (pw, yaw): una por cada variante (flip o yaw + 180°)
function posesTCP(pw, yaw, opts = {}) {
  const w = opts.w ?? pinza.w; const tz = pinza.tcpZ(w);
  const tool = opts.horiz ? pw.clone().addScaledVector(ejeHoriz(yaw, opts.pitch || 0), -tz) : new THREE.Vector3(pw.x, pw.y, pw.z + tz);
  const pb = mundoABase(tool); const yb = yawABase(yaw);
  const cands = opts.horiz ? (opts.flip ? [[yb, opts.flip]] : [[yb, 1], [yb, -1]]) : (opts.sym === false ? [[yb]] : [[yb], [yb + PI]]);
  return cands.map(cd => opts.horiz ? poseHoriz(pb, cd[0], cd[1], opts.pitch || 0) : poseVertical(pb, cd[0]));
}
// IK del TCP en el mundo. opts: horiz (pinza horizontal), flip (fijo si se lleva el plato), sym, w (apertura), minZ
function ikTCP(pw, yaw, qNear, opts = {}) {
  let best = null, bestC = Infinity;
  for (const T of posesTCP(pw, yaw, opts)) for (const s of CIN.ik(T)) {
    if (!qValida(s, opts.minZ ?? 0.02)) continue;
    const q = enLimites(qNear ? s.map((v, i) => qNear[i] + angDiff(v, qNear[i])) : s.slice()); if (!q) continue; // límites del UR3e (codo ±180°)
    if (!opts.sinColision && choqueEn(q, ctxDe(opts))) continue; // ni autocolisión ni choque con el entorno
    let c = 0; if (qNear) for (let i = 0; i < 6; i++) c += (i < 3 ? 3 : 1) * (q[i] - qNear[i]) ** 2; else c = Math.abs(s[1] + 1.6) + Math.abs(s[4] + PI / 2);
    if (c < bestC) { bestC = c; best = q; }
  }
  return best;
}
// ¿Tiene el TCP (pw, yaw) ramas de la IK analítica nominal y ninguna converge en la IK calibrada? (T1.4-5). Es lo que
// distingue «IK calibrada no converge» de «fuera de alcance» (sin ninguna rama). Con el nominal no hay refinado: nunca.
function ikNoConverge(pw, yaw, opts = {}) {
  if (!CIN.calibrada) return false; let semillas = 0, sols = 0;
  for (const T of posesTCP(pw, yaw, opts)) { const d = CIN.ikDetalle(T); semillas += d.semillas; sols += d.sols.length; }
  return semillas > 0 && sols === 0;
}
const causaSinIK = (pw, yaw, opts) => ikNoConverge(pw, yaw, opts) ? 'ik_calibrada' : 'alcance';
function tcpMundo() { pinza.tcp.updateMatrixWorld(true); return pinza.tcp.getWorldPosition(new THREE.Vector3()); }
function ejesHerramienta() { const m = new THREE.Matrix4().extractRotation(robot.tool0.matrixWorld); return { x: new THREE.Vector3(1, 0, 0).applyMatrix4(m), z: new THREE.Vector3(0, 0, 1).applyMatrix4(m) }; }
function yawHerramienta() { const e = ejesHerramienta(); return Math.atan2(e.x.y, e.x.x); }

// Alcance con la pinza vertical en un punto (mundo) a una altura h sobre la mesa
function alcance(xw, yw, h) {
  const tz = pinza.tcpZ(0.02); const b = marco().aBase(xw, yw, MESA.h);
  const pb = { x: b[0], y: b[1], z: h + tz };
  let feas = 0, m = 0;
  for (let k = 0; k < 6; k++) {
    let ok = false; for (const q of CIN.ik(poseVertical(pb, k * PI / 6))) { if (qValida(q)) { ok = true; m = Math.max(m, CIN.manip(q) / REF_MANIP); if (m > 0.6) break; } }
    if (ok) feas++;
  }
  return { feas, m, cls: feas === 0 ? 0 : (feas >= 4 && m >= 0.35 ? 2 : 1) };
}
let perfilAlc = null;
function calcularPerfil() {
  const out = [];
  for (let h = 0; h <= 0.40001; h += 0.01) {
    let rmin = null, rmax = null;
    for (let r = 0; r <= 0.62; r += 0.005) { const tz = pinza.tcpZ(0.02); let ok = false; for (let k = 0; k < 3 && !ok; k++) for (const q of CIN.ik(poseVertical({ x: r, y: 0, z: h + tz }, k * PI / 3))) if (qValida(q)) { ok = true; break; } if (ok) { if (rmin === null) rmin = r; rmax = r; } }
    out.push({ h, rmin, rmax });
  }
  perfilAlc = out;
}
function radioA(h) { if (!perfilAlc) return null; const i = clamp(Math.round(h / 0.01), 0, perfilAlc.length - 1); return perfilAlc[i]; }

// ======================= Holguras: pinza y muñeca frente a mesa y cajas =======================
const _bx = new THREE.Box3(), _v = new THREE.Vector3(), _inv = new THREE.Matrix4();
function holguraActual() {
  // menor distancia vertical de la muñeca y la pinza a la mesa, y penetración en las cajas
  let mesa = Infinity, caja = Infinity;
  const ml = [...(robot.porLink.wrist1 || []), ...(robot.porLink.wrist2 || []), ...(robot.porLink.wrist3 || []), ...(robot.porLink.forearm || [])];
  for (const m of ml) { _bx.setFromObject(m, true); mesa = Math.min(mesa, _bx.min.z - MESA.h); }
  const cajas = L.caja.on ? [OBJ.caja1, OBJ.caja2].filter(c => c.visible) : [];
  for (const m of pinza.mallas()) {
    m.updateMatrixWorld(true); _bx.setFromObject(m, true); mesa = Math.min(mesa, _bx.min.z - MESA.h);
    for (const cj of cajas) {
      _inv.copy(cj.matrixWorld).invert(); const pos = m.geometry.attributes.position; const hl = CAJA_LADO / 2;
      for (let i = 0; i < pos.count; i += 2) { _v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(_inv); if (Math.abs(_v.x) < hl && Math.abs(_v.y) < hl && _v.z < L.caja.h) caja = Math.min(caja, _v.z - L.caja.h); }
    }
  }
  return { mesa, caja, min: Math.min(mesa, caja), contra: caja < mesa ? 'caja' : 'mesa' };
}
function holguraEn(q, w) { const q0 = robot.q.slice(), w0 = pinza.w; robot.setQ(q); pinza.setApertura(w); const h = holguraActual(); robot.setQ(q0); pinza.setApertura(w0); return h; }

// @@COLISION@@
// @@FALLOS@@

// Puntos donde se suelta la fruta en un plato: piezas una junto a otra en la dirección tangente (no se alejan de la base)
function puntosSoltar(pc, F, n) {
  const b = BASES[L.robot]; const phi = Math.atan2(pc.y - b.y, pc.x - b.x); const t = new THREE.Vector3(-Math.sin(phi), Math.cos(phi), 0); const out = [];
  for (let k = 0; k < n; k++) { const p = pc.clone().addScaledVector(t, (k - (n - 1) / 2) * Math.max(0.035, F.w * 1.02)); out.push({ arr: new THREE.Vector3(p.x, p.y, Math.max(MESA.h + H_TR, pc.z + 0.025 + F.h + 0.05)), sol: new THREE.Vector3(p.x, p.y, pc.z + 0.055 + F.h) }); }
  return out;
}
const llegaVertical = (p, q) => [0, PI / 4, PI / 2, -PI / 4].some(y => ikTCP(p, y, q));
// Agarre de una pieza de fruta: dirección de apertura con más hueco respecto a las vecinas
function planAgarreFruta(pz, w, qRef) {
  const c = pz.obj.getWorldPosition(new THREE.Vector3()); const zG = MESA.h + alturaAgarre(pz.F); let mejor = null;
  const vec = piezas.filter(o => o !== pz && !o.usada && !o.enPinza).map(o => ({ p: o.obj.getWorldPosition(new THREE.Vector3()), r: o.F.r }));
  for (let i = 0; i < 12; i++) {
    const th = L.zona.yaw + i * PI / 12; const u = new THREE.Vector3(Math.cos(th), Math.sin(th), 0); const a = w / 2 + 0.009;
    let hol = Infinity; for (const s of [-1, 1]) { const f = c.clone().addScaledVector(u, s * a); for (const v of vec) hol = Math.min(hol, Math.hypot(f.x - v.p.x, f.y - v.p.y) - v.r); }
    if (mejor && hol <= mejor.hol) continue;
    if (!ikTCP(new THREE.Vector3(c.x, c.y, zG), th, qRef) || !ikTCP(new THREE.Vector3(c.x, c.y, MESA.h + H_TR), th, qRef)) continue;
    mejor = { yaw: th, hol, c, zG };
  }
  return mejor;
}
// Planificador del agarre horizontal del plato (dirección de aproximación)
const PITCHES = [0, 15, 30, 45].map(v => v * D2R); // inclinación de la muñeca permitida al coger el plato (los dedos siguen abrazando el ala)
function planAgarrePlato(pc, qRef, o = {}) { // o.pk: plato; o.forzar: ignora el entorno (para enseñar una postura imposible)
  const b = BASES[L.robot]; const phi0 = Math.atan2(pc.y - b.y, pc.x - b.x); const z = pc.z + H_BORDE;
  const caja = L.caja.on ? [OBJ.caja1, OBJ.caja2].filter(c => c.visible).find(c => Math.hypot(c.position.x - pc.x, c.position.y - pc.y) < 0.01) : null;
  let mejor = null; const lista = [];
  fuera: for (const pitch of PITCHES) for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) {
    const yaw = phi0 + k * PI / 12; const d = new THREE.Vector3(Math.cos(yaw), Math.sin(yaw), 0); const eje = ejeHoriz(yaw, pitch);
    const tcp = new THREE.Vector3(pc.x - d.x * R_AGARRE, pc.y - d.y * R_AGARRE, z);
    const pre = tcp.clone().addScaledVector(eje, -0.07); // se acerca a lo largo de los dedos
    if (caja) { caja.rotation.z = yaw; caja.updateMatrixWorld(true); VERSION_ESCENA++; } // la caja se orienta con una cara hacia la pinza
    const base = { horiz: true, pitch, w: 0.03, minZ: -0.3, carga: null, sinEntorno: !!o.forzar };
    const qPre = ikTCP(pre, yaw, qRef, base); if (!qPre) continue;
    const flip = Math.sign(CIN.fk(qPre)[8]) || 1;
    const q = ikTCP(tcp, yaw, qPre, { ...base, flip, permitir: ['plato:' + o.pk] }); if (!q) continue;
    const arriba = tcp.clone(); arriba.z += 0.08; if (!o.forzar && !ikTCP(arriba, yaw, q, { ...base, w: 0.006, flip, permitir: ['caja:' + o.pk] })) continue; // tiene que poder levantarlo
    const hol = holguraEn(q, 0.03); const hp = holguraEn(qPre, 0.03); const hmin = Math.min(hol.min, hp.min);
    const cand = { yaw, pitch, d, eje, tcp, pre, qPre, q, flip, hol: hmin < hol.min ? hp : hol, k };
    if (o.todos) { if (hmin >= 0.005) lista.push(cand); continue; }
    if (!mejor || (hmin > -0.002 && mejor.hol.min < -0.002) || (hmin > mejor.hol.min + 0.01 && mejor.hol.min < 0.01)) mejor = cand;
    if (mejor.hol.min >= 0.01) break fuera; // la primera válida con la muñeca menos inclinada y la entrada más directa
  }
  if (o.todos) { if (caja) { caja.rotation.z = lista[0] ? lista[0].yaw : phi0; caja.updateMatrixWorld(true); VERSION_ESCENA++; } return lista; }
  if (caja) { caja.rotation.z = mejor ? mejor.yaw : phi0; caja.updateMatrixWorld(true); VERSION_ESCENA++; }
  return mejor;
}
// Planificador de la colocación del plato en una zona de la bandeja (misma inclinación que al cogerlo: el plato llega nivelado)
function planColocar(zw, qRef, flip, carga = null, pitch = 0, todos = false) {
  const lista = [];
  const b = BASES[L.robot]; const phi0 = Math.atan2(zw.y - b.y, zw.x - b.x); const z = zw.z + H_BORDE + 0.004;
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const yaw = phi0 + k * PI / 12; const d = new THREE.Vector3(Math.cos(yaw), Math.sin(yaw), 0); const eje = ejeHoriz(yaw, pitch);
    const tcp = new THREE.Vector3(zw.x - d.x * R_AGARRE, zw.y - d.y * R_AGARRE, z);
    const pre = tcp.clone().add(new THREE.Vector3(0, 0, H_AP)); const o = { horiz: true, pitch, w: 0.006, flip, minZ: -0.3, carga };
    const qPre = ikTCP(pre, yaw, qRef, o); if (!qPre) continue;
    const q = ikTCP(tcp, yaw, qPre, { ...o, permitir: ['bandeja'] }); if (!q) continue;
    const salida = tcp.clone().addScaledVector(eje, -0.08); const qS = ikTCP(salida, yaw, q, { ...o, w: 0.03, carga: null, permitir: ['bandeja'] }); if (!qS) continue;
    // la subida tras la salida (T1.9, decisión 3): tiene que tener IK y acabar libre con el contexto del movimiento
    // siguiente (sin nada permitido), con la bandeja en su pose de ahora y en todas las de su balanceo con la amplitud de la
    // demo (T2.8, DT30): cuando el brazo llegue a qU, la bandeja puede estar en cualquier punto de su recorrido. Si no, la
    // entrada se descarta y el fallo sale en la comprobación previa
    const subida = salida.clone(); subida.z += H_SALIDA; const qU = ikTCP(subida, yaw, qS, { ...o, w: 0.03, carga: null, permitir: ['bandeja'] });
    if (!qU || choqueEn(qU, ctxDe({ w: 0.03, carga: null })) || tocaBandejaEnBalanceo(qU, 0.03) || !arranqueLibreEnBalanceo(qU)) continue;
    const c = { yaw, pitch, d, eje, tcp, pre, salida, subida, q, qPre, qS, qU, k, flip: Math.sign(CIN.fk(q)[8]) || flip || 1 }; if (!todos) return c; lista.push(c);
  }
  return todos ? lista : null;
}
// Elige la colocación cuyo transporte nivelado es posible (prueba las entradas en orden)
function colocacionConTransporte(zw, q0, pl, carga, perfil) {
  const o = { horiz: true, pitch: pl.pitch, flip: pl.flip, minZ: -0.3, w: 0.006, carga, perfil: PERFIL.de(perfil).nombre }; let ult = { fallo: 'no hay ninguna entrada válida a la zona', pct: 0 };
  const cands = planColocar(zw, q0, pl.flip, carga, pl.pitch, true); // primero las de más margen: la bandeja se mueve y conviene no colocar al límite
  for (const c of cands) { // robustez: ¿sigue habiendo postura cercana y libre si la bandeja se desplaza 3 cm o sube y baja 2 cm?
    let ok = 0, tot = 0; for (const dx of [-0.03, 0, 0.03]) for (const dy of [-0.03, 0, 0.03]) for (const dz of [-0.02, 0.02]) { tot++; const qq = ikTCP(c.tcp.clone().add(new THREE.Vector3(dx, dy, dz)), c.yaw, c.q, { ...o, permitir: ['bandeja', 'manos'] }); if (qq && Math.max(...qq.map((v, i) => Math.abs(v - c.q[i]))) < 0.35) ok++; }
    c.rob = ok / tot; c.hol = Math.min(holguraTotal(c.q, { ...o, permitir: ['bandeja'] }), holguraTotal(c.qPre, o));
  }
  cands.sort((a, b) => (b.rob - a.rob) || (b.hol - a.hol));
  for (const c of cands) { const r = rutaNivelada(q0, c.pre, c.yaw, o); if (r.ruta) return { pc2: c, r }; ult = r; }
  return { fallo: ult };
}
function alturaAgarre(F) { return Math.max(F.h, 0.032); } // la punta del dedo de la RG2 sobresale unos 2 cm de la yema: con piezas bajas hay que coger por encima del centro

// ======================= Mapa de alcance =======================
const ALC = { h: 0.035, res: 0.015, job: 0 };
const COLS_ALC = ['rgba(200,85,61,0.42)', 'rgba(217,165,33,0.55)', 'rgba(63,154,99,0.5)'];
function calcularMapa() {
  const job = ++ALC.job; const nx = Math.round(MESA.w / ALC.res), ny = Math.round(MESA.d / ALC.res);
  alcCanvas.width = nx * 4; alcCanvas.height = ny * 4; const ctx = alcCanvas.getContext('2d'); ctx.clearRect(0, 0, alcCanvas.width, alcCanvas.height);
  let j = 0; const b = BASES[L.robot];
  const paso = () => {
    if (job !== ALC.job) return;
    const t0 = performance.now();
    while (j < ny && performance.now() - t0 < 14) {
      const yw = MESA.d / 2 - (j + 0.5) * ALC.res;
      for (let i = 0; i < nx; i++) {
        const xw = -MESA.w / 2 + (i + 0.5) * ALC.res; const r = Math.hypot(xw - b.x, yw - b.y);
        if (r < 0.66) { ctx.fillStyle = COLS_ALC[alcance(xw, yw, ALC.h).cls]; ctx.fillRect(i * 4, j * 4, 4, 4); }
      }
      j++;
    }
    alcTex.needsUpdate = true;
    if (j < ny) requestAnimationFrame(paso); else actualizarTablaAlcance();
  };
  paso();
}

// ======================= Selección y edición =======================
const tctl = new TransformControls(cam, renderer.domElement); tctl.setSize(0.75); scene.add(tctl);
tctl.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; EDITANDO = e.value; if (e.value) prepararEdicion(); else { guardarLocal(); recalcular(); } });
function recalcular() { actualizarPlatos(); evaluar(); pintarCalc(); vigilarEscena(); } // soltar un objeto solo refresca lo ligero; los planes se calculan con el botón
// Mover algo con la demo a medias la deja incoherente: se reinicia antes del primer movimiento. aviso: el motivo que se
// enseña (la capa del otro robot da el suyo, DT31)
function prepararEdicion(aviso = 'Demo reiniciada para mover objetos') { if (D.activo && !D.playing) { D.activo = false; reiniciarDemo(); toast(aviso); } }
const CALC = { activo: false };
// Estado de la sección «Exportar a ROS» del panel «Datos» (T2.6): el modelo y los ficheros que muestra, y si sus descargas
// están desactivadas por un cálculo o una búsqueda (vigilarRos, desde pintarCalc)
const ROSX = { m: null, ficheros: [], lista: null, huella: '', giro: null, ver: null, ocupado: null };
// La barra dice si las trayectorias de explorar («gemelo») están al día; debajo, la de validar (pintarVal, T1.8).
// El texto de progreso se conserva hasta que acaba el cálculo (el repintado periódico no lo borra).
// #btnCalc sigue a CALC.activo también cuando la barra se oculta (DT41): si no, al acabar un cálculo con los planes al día se
// quedaba desactivado hasta que el repintado periódico volvía a enseñar la barra, y un clic en ese rato se perdía.
function pintarCalc(txt) {
  if (txt) CALC.txt = txt; pintarVal(); vigilarRos(); $('#btnCalc').disabled = CALC.activo;
  const el = $('#calcBar'); const ver = !!robot && (VAL.activo || !D.activo) && (CALC.activo || !planesAlDia(PERFIL_EXPLORA)); el.hidden = !ver; if (!ver) return;
  $('#calcTxt').textContent = CALC.activo ? (CALC.txt || 'Calculando…') : 'Hay cambios sin calcular'; $('#calcSpin').hidden = !CALC.activo;
}
// Calcula las trayectorias de los platos con un perfil (T1.6). Sin argumento, el de explorar: la barra «Calcular»,
// soltar un objeto y el primer cálculo al cargar usan siempre «gemelo» (decisión 2 del brief). La demo, guardar y validar
// piden el suyo.
async function calcularPlanes(perfil = PERFIL_EXPLORA) {
  if (CALC.activo || !robot) return; PERFIL.de(perfil); CALC.activo = true; pintarCalc('Calculando…'); await new Promise(r => setTimeout(r, 30));
  const tp = perfil === PERFIL_EXPLORA ? '' : ` con el perfil «${perfil}»`;
  // sobre la escena de partida (H3, DT24): tras una demo terminada, fallida o en pausa, la fruta y los platos están en otro
  // sitio. El repintado también: actualizarPlatos orienta las cajas con el plan de explorar y una demo en pausa con otro
  // perfil necesita las suyas (se devuelven al salir)
  await enEscenaDePartidaAsync(async () => {
    try { for (const [pk] of platosActivos()) { const n = pk === 'plato1' ? '1º' : '2º'; await planPlatoAsync(pk, perfil, p => pintarCalc(`Calculando el plato ${n}${tp}: agarre ${p.i + 1} de ${p.n}`)); } }
    finally { CALC.activo = false; CALC.txt = ''; }
    actualizarPlatos(); evaluar(); pintarCalc();
  });
  if (planesAlDia(perfil)) toast(`Trayectorias calculadas${tp}`);
}
$('#btnCalc').addEventListener('click', () => calcularPlanes(PERFIL_EXPLORA));
// ======================= Validar con los dos perfiles (T1.8, D6) =======================
// «Validar con perfil curso»: calcula las trayectorias y la comprobación previa con «gemelo» y con «curso» y ensaya la demo
// con los dos, con los ajustes de la demo (modo, balanceo y velocidad) y la bandeja en la fase 0, como la matriz de casos.
// El resultado vale para la escena tal como está: su firma es la disposición (sin el perfil ni el sensor, que no mueven
// nada), el robot calibrado y los ajustes de la demo; cualquier otro cambio la deja «sin validar».
const VAL = { activo: false, res: null };
const FASE_VALIDAR = 0;
function firmaVal() { const { perfil, sensor, ...l } = L; return JSON.stringify([ROB.id, D.modo, D.amp, D.vel, l, otroVisible()]); } // y el robot del otro puesto, que es un obstáculo (H4)
const valAlDia = () => !!VAL.res && VAL.res.firma === firmaVal();
// Comprobación previa resumida como la guarda la escena (txt ≤ 300) y la causa del primer problema grave
function resumenPrevia(chk) {
  const g = chk.filter(c => c.grave); const i = g[0];
  return { ok: !g.length, n: g.length, txt: (i ? i.txt : 'La comprobación previa no encuentra problemas.').slice(0, 300), fallo: i ? { causa: i.info.causa || null, pct: i.info.pct, txt: i.txt } : null };
}
// Causa del fallo de una demo (D.falloDemo): si no llegó a empezar, la del primer problema de la comprobación previa
function falloDeDemo(f) {
  if (!f) return null; const info = f.info || {};
  if (info.causa === 'previo' && info.items && info.items.length) { const i = info.items[0]; return { causa: (i.info && i.info.causa) || null, pct: i.info && i.info.pct, txt: i.txt }; }
  return { causa: info.causa || null, pct: info.pct, txt: f.msg };
}
const veredictoOk = v => !!v && v.previa.ok && v.demo.fin === 'ok';
async function validar() {
  if (!robot) return; const oc = ocupado('validar'); if (oc) { toast(oc); return; }
  if (soloLectura()) { toast('Disposición de solo lectura (versión más nueva): no se valida'); return; }
  const firma = firmaVal(), fase0 = D.fase, t0 = performance.now(), cfg = { modo: D.modo, amp: D.amp, vel: D.vel, fase: FASE_VALIDAR, sinRender: true };
  VAL.activo = true; CALC.activo = true; D.validando = true; D.mantenerFallo = true; tctl.detach(); sel = null; pintarCalc('Validando…');
  D.activo = false; reiniciarDemo(); // la comprobación previa mira la escena de partida (fruta en su zona, platos en su sitio)
  let res = null;
  try {
    await new Promise(r => setTimeout(r, 30));
    for (const pf of ['gemelo', 'curso']) for (const [pk] of platosActivos()) { const n = pk === 'plato1' ? '1º' : '2º'; await planPlatoAsync(pk, pf, p => pintarCalc(`Validando: trayectorias del plato ${n} con «${pf}», agarre ${p.i + 1} de ${p.n}`)); }
    const per = {};
    for (const pf of ['gemelo', 'curso']) per[pf] = { previa: resumenPrevia(comprobarPlan({ perfil: pf })) };
    for (const pf of ['gemelo', 'curso']) {
      pintarCalc(`Validando: demo con «${pf}» (${cfg.modo}, balanceo ${fmt(cfg.amp * 100, 1)} cm${pf === 'gemelo' ? `, ${Math.round(cfg.vel * 100)} %` : ', escala 0,1'})`); await new Promise(r => setTimeout(r, 30));
      const r = await ensayo({ ...cfg, perfil: pf });
      per[pf].demo = { fin: r.fin, t_ciclo_s: r.t_mov, paso: r.paso, fallo: r.fin === 'ok' ? null : falloDeDemo(D.falloDemo), detalle: r.fin === 'ok' ? '' : (D.falloDemo ? D.falloDemo.msg : r.fallo) };
    }
    const t = { gemelo: per.gemelo.demo.t_ciclo_s, curso: per.curso.demo.t_ciclo_s };
    for (const pf of ['gemelo', 'curso']) { const d = per[pf].demo; d.motivo = d.fin === 'ok' ? null : PERFIL.motivo(d.fallo, t); per[pf].previa.motivo = per[pf].previa.ok ? null : PERFIL.motivo(per[pf].previa.fallo, t); }
    res = { firma, per, ms: Math.round(performance.now() - t0) };
  } catch (e) { console.error(e); } // un error interno no deja la página ocupada: se avisa y la escena sigue «sin validar»
  finally {
    D.activo = false; reiniciarDemo(); D.fase = fase0; VAL.activo = false; CALC.activo = false; CALC.txt = ''; D.validando = false; D.mantenerFallo = false;
  }
  if (res) VAL.res = res; actualizarPlatos(); evaluar(); pintarCalc();
  toast(!res ? 'La validación ha fallado por un error interno' : `Validado con los dos perfiles: gemelo ${veredictoOk(res.per.gemelo) ? 'pasa' : 'falla'}, curso ${veredictoOk(res.per.curso) ? 'pasa' : 'falla'}`);
}
// Barra de validación, siempre a la vista (salvo con la demo en marcha): los dos veredictos (comprobación previa y demo),
// los dos tiempos de ciclo y, si difieren, el motivo concreto
function pintarVal() {
  const el = $('#valBar'); if (!el) return; const ver = !!robot && (VAL.activo || !D.activo); el.hidden = !ver; if (!ver) return;
  $('#btnValidar').disabled = VAL.activo || CALC.activo || D.buscando;
  const r = valAlDia() ? VAL.res : null; let h;
  if (VAL.activo) h = '<span class="spin"></span><span>Validando con «gemelo» y con «curso»…</span>';
  else if (!r) h = `<span><b>Perfil «curso»: sin validar.</b> ${VAL.res ? 'La escena ha cambiado desde la última validación.' : 'Explorar usa «gemelo»: valida antes de guardar o de programar contra la simulación.'}</span>`;
  else {
    const fila = pf => { const v = r.per[pf], ok = veredictoOk(v), d = v.demo;
      const demo = d.fin === 'ok' ? 'completa' : d.fin === 'previo' ? 'no empieza' : `${d.fin === 'abort' ? 'abortada' : 'parada'} en el paso ${d.paso}`;
      return `<div class="valFila" data-perfil="${pf}"><span class="dot ${ok ? 'ok' : 'bad'}"></span><b>${pf === 'curso' ? 'Curso' : 'Gemelo'}</b> <span>previa: ${v.previa.ok ? 'sin problemas' : `${v.previa.n} ${v.previa.n === 1 ? 'problema' : 'problemas'}`} · demo: ${demo} · ciclo ${fmt(d.t_ciclo_s, 1)} s${d.fin === 'ok' ? '' : ' hasta el fallo'}</span></div>`; };
    const vg = veredictoOk(r.per.gemelo), vc = veredictoOk(r.per.curso), falla = !vg ? 'gemelo' : 'curso';
    const mot = vg === vc ? '' : (() => { const v = r.per[falla]; const m = v.previa.ok ? v.demo.motivo : v.previa.motivo; const det = v.previa.ok ? v.demo.detalle : v.previa.txt; return `<div class="valMotivo" title="${esc(det || '')}"><b>Solo pasa en ${falla === 'curso' ? '«gemelo»' : '«curso»'}. Motivo:</b> ${esc(m || '')}</div>${det && det !== m ? `<small class="valDet">${esc(det.slice(0, 300))}</small>` : ''}`; })();
    h = `<div class="valFilas">${fila('gemelo')}${fila('curso')}${mot}<small>Tiempos aproximados (no TOTG, DT4) · ${r.per.gemelo.demo.fin === 'ok' && r.per.curso.demo.fin === 'ok' ? `curso ${fmt(r.per.curso.demo.t_ciclo_s - r.per.gemelo.demo.t_ciclo_s, 1)} s frente a gemelo` : 'validado'} · ${D.modo}, balanceo ${fmt(D.amp * 100, 1)} cm, ${Math.round(D.vel * 100)} %</small></div>`;
  }
  if (el._h !== h) { $('#valTxt').innerHTML = h; el._h = h; } $('#btnValidar').textContent = r ? 'Validar otra vez' : 'Validar con perfil curso'; // solo se reescribe si cambia (se repinta cada 18 fotogramas)
}
$('#btnValidar').addEventListener('click', () => validar());
let sel = null;
const objetivo = new THREE.Group(); scene.add(objetivo); objetivo.visible = false;
{ const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 8, 32), new THREE.MeshBasicMaterial({ color: '#e6b422' })); objetivo.add(r); objetivo.add(new THREE.AxesHelper(0.06)); objetivo.userData.anillo = r; }
pickables.push({ key: 'objetivo', obj: objetivo, oculto: true, nombre: 'Objetivo de la pinza', grupo: 'ROB' });
function seleccionar(key) {
  if (D.playing) { toast('Pausa la demo para mover objetos'); return; }
  if (CALC.activo) { toast('Espera a que termine el cálculo'); return; }
  const p = pickables.find(x => x.key === key); sel = p || null;
  if (!p) { tctl.detach(); objetivo.visible = false; pintarSel(); return; }
  const modo = $('#segModo [aria-pressed="true"]').dataset.v;
  const esCam = !!p.cam && p.parte === 'pos';
  const permiteGiro = ['zona', 'persona', 'objetivo'].includes(p.key) || esCam;
  const girar = permiteGiro && modo === 'rotate';
  tctl.setMode(girar ? 'rotate' : 'translate'); tctl.setSpace(girar && esCam ? 'local' : 'world'); // la cámara gira sobre sus propios ejes: inclinar, girar y alabear
  const plano = !(p.cam && p.parte !== 'clamp') && p.key !== 'objetivo';
  if (girar) { tctl.showX = esCam; tctl.showY = esCam; tctl.showZ = true; } else { tctl.showX = true; tctl.showY = true; tctl.showZ = !plano; }
  if (p.key !== 'objetivo') objetivo.visible = false;
  tctl.attach(p.obj); pintarSel(); pintarLista();
}
function alMover() {
  if (!sel) return; const o = sel.obj, k = sel.key;
  if (k === 'zona') { L.zona.x = o.position.x; L.zona.y = o.position.y; L.zona.yaw = o.rotation.z; o.position.z = MESA.h; }
  else if (k === 'plato1' || k === 'plato2') { L[k].x = o.position.x; L[k].y = o.position.y; o.position.z = zPlato(); }
  else if (k === 'persona') { L.persona.x = o.position.x; L.persona.y = o.position.y; L.persona.yaw = o.rotation.z; o.position.z = 0; o.rotation.x = o.rotation.y = 0; aplicarBandeja(simT); }
  else if (k.startsWith('arucoE')) { L.arucoE[sel.idx].x = o.position.x; L.arucoE[sel.idx].y = o.position.y; o.position.z = MESA.h + 0.0013; }
  else if (sel.cam) { const c = L.cams[sel.cam]; if (sel.parte === 'pos' && tctl.getMode() === 'rotate') orientarDesdeQuat(c, o.quaternion); else if (sel.parte === 'pos') Object.assign(c.pos, { x: o.position.x, y: o.position.y, z: Math.max(MESA.h + 0.05, o.position.z) }); else if (sel.parte === 'mira') Object.assign(c.mira, { x: o.position.x, y: o.position.y, z: o.position.z }); else Object.assign(c.clamp, puntoBorde(o.position.x, o.position.y)); actualizarCam(sel.cam); }
  else if (k === 'objetivo') moverAObjetivo();
  VERSION_ESCENA++; actualizarZona(); actualizarPlatos(); pintarSel(); actualizarHUD();
}
tctl.addEventListener('objectChange', alMover);
function moverAObjetivo() {
  const p = objetivo.position; const q = ikTCP(p, objetivo.rotation.z, robot.q);
  objetivo.userData.anillo.material.color.set(q ? '#e6b422' : css('--bad'));
  if (q) { robot.setQ(q); sincronizarSliders(); }
  const n = CIN.ik(poseVertical(mundoABase(new THREE.Vector3(p.x, p.y, p.z + pinza.tcpZ())), yawABase(objetivo.rotation.z))).filter(s => qValida(s)).length;
  $('#ikInfo').textContent = q ? `Posturas válidas para este punto: ${n} de 8. Se elige la más cercana a la actual.` : 'Ese punto queda fuera del alcance con la pinza vertical.';
}
// Selección y arrastre directo: pulsar un objeto lo selecciona y arrastrarlo lo mueve sobre el plano horizontal
const ray = new THREE.Raycaster(); ray.params.Line.threshold = 0.004; ray.params.Points.threshold = 0.004;
let downXY = null, downGizmo = false, arr = null, hoverT = 0; const _ip = new THREE.Vector3(); const lienzo3d = renderer.domElement;
const ALIAS = new Map([[OBJ.caja1, 'plato1'], [OBJ.caja2, 'plato2'], [bandeja, 'persona'], ...brazos.map(b => [b, 'persona'])]); // partes que mueven a otro objeto
for (const k in CAMS) for (const o of [...CAMS[k].seg, CAMS[k].codo]) ALIAS.set(o, 'cam:' + k);
function ndcDe(e) { const r = lienzo3d.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
function visibleCadena(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function objetoBajo(e) {
  ray.setFromCamera(ndcDe(e), cam); ray.layers.enableAll();
  const objs = pickables.filter(p => !p.oculto || p.obj.visible).map(p => p.obj).concat([...ALIAS.keys()]);
  for (const h of ray.intersectObjects(objs, true)) { // solo mallas visibles: las líneas y los marcos ocultos no cuentan
    if (!h.object.isMesh || !visibleCadena(h.object) || isGizmo(h.object)) continue;
    let o = h.object, p = null;
    while (o && !p) { p = pickables.find(x => x.obj === o) || (ALIAS.has(o) ? pickables.find(x => x.key === ALIAS.get(o)) : null); o = o.parent; }
    if (p) return { p, punto: h.point };
  }
  return null;
}
function limitar(p, o) { const enMesa = ['zona', 'plato1', 'plato2'].includes(p.key) || p.key.startsWith('arucoE'); const hx = enMesa ? MESA.w / 2 - 0.02 : 1.6, hy = enMesa ? MESA.d / 2 - 0.02 : 1.6; o.position.x = clamp(o.position.x, -hx, hx); o.position.y = clamp(o.position.y, -hy, hy); }
lienzo3d.addEventListener('pointerdown', e => {
  downXY = [e.clientX, e.clientY]; downGizmo = tctl.dragging || tctl.axis !== null; arr = null;
  if (e.button !== 0 || medir.activo || downGizmo || D.playing || CALC.activo) return;
  const h = objetoBajo(e); if (!h) return;
  seleccionar(h.p.key); if (sel !== h.p) return;
  if (h.p.cam && h.p.parte === 'pos' && $('#segModo [aria-pressed="true"]').dataset.v === 'rotate') { arr = { p: h.p, girar: orientDe(L.cams[h.p.cam]), movido: false, x0: e.clientX, y0: e.clientY }; orbit.enabled = false; return; } // arrastrar apunta la cámara
  arr = { p: h.p, plano: new THREE.Plane(new THREE.Vector3(0, 0, 1), -h.punto.z), punto: h.punto.clone(), off: null, movido: false, x0: e.clientX, y0: e.clientY };
  orbit.enabled = false; // la cámara de la escena no gira mientras se arrastra un objeto
});
lienzo3d.addEventListener('pointermove', e => {
  if (arr) {
    if (!arr.movido && Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) < 4) return;
    if (!arr.movido) { arr.movido = true; EDITANDO = true; prepararEdicion(); if (!arr.girar) arr.off = arr.p.obj.position.clone().sub(arr.punto); lienzo3d.style.cursor = 'grabbing'; } // el desfase se toma tras reiniciar la demo (los platos vuelven a la escena)
    if (arr.girar) { const c = L.cams[arr.p.cam], g0 = arr.girar; fijarOrient(c, g0.pan + (e.clientX - arr.x0) * 0.004, g0.tilt + (e.clientY - arr.y0) * 0.004, c.roll); actualizarCam(arr.p.cam); VERSION_ESCENA++; pintarSel(); return; } // derecha/izquierda gira, arriba/abajo inclina
    ray.setFromCamera(ndcDe(e), cam); if (!ray.ray.intersectPlane(arr.plano, _ip)) return;
    const o = arr.p.obj; o.position.x = _ip.x + arr.off.x; o.position.y = _ip.y + arr.off.y; limitar(arr.p, o); alMover(); return;
  }
  if (e.buttons || e.pointerType !== 'mouse' || performance.now() - hoverT < 60) return; hoverT = performance.now();
  lienzo3d.style.cursor = !medir.activo && !D.playing && objetoBajo(e) ? 'grab' : '';
});
function finArrastre() { const a = arr; arr = null; orbit.enabled = !tctl.dragging; lienzo3d.style.cursor = ''; if (a && a.movido) { EDITANDO = false; guardarLocal(); recalcular(); } return a; }
lienzo3d.addEventListener('pointercancel', finArrastre);
lienzo3d.addEventListener('pointerup', e => {
  if (arr) { finArrastre(); return; }
  if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 5 || downGizmo || tctl.dragging) return;
  if (medir.activo) { ray.setFromCamera(ndcDe(e), cam); ray.layers.enableAll(); const hits = ray.intersectObjects(scene.children, true).filter(h => h.object.isMesh && visibleCadena(h.object) && h.object !== alcPlane && !isGizmo(h.object)); if (hits[0]) medirPunto(hits[0].point); return; }
  const h = objetoBajo(e);
  if (h) seleccionar(h.p.key); else if (sel && !D.playing) { sel = null; tctl.detach(); objetivo.visible = false; pintarSel(); pintarLista(); } // clic en vacío: deselecciona
});
function isGizmo(o) { while (o) { if (o === tctl) return true; o = o.parent; } return false; }
const medir = { activo: false, pts: [], linea: null, lbl: null };
function medirPunto(p) {
  medir.pts.push(p.clone()); if (medir.pts.length > 2) medir.pts = [p.clone()];
  if (medir.linea) { scene.remove(medir.linea); medir.linea.geometry.dispose(); }
  if (medir.lbl) { medir.lbl.parent && medir.lbl.parent.remove(medir.lbl); medir.lbl = null; }
  const pts = medir.pts.length === 1 ? [p, p.clone().add(new THREE.Vector3(0, 0, 0.0005))] : medir.pts;
  medir.linea = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e6b422', depthTest: false })); medir.linea.renderOrder = 9; scene.add(medir.linea);
  if (medir.pts.length === 2) { const d = medir.pts[0].distanceTo(medir.pts[1]); medir.lbl = etiqueta(`${mm(d)} mm`); medir.lbl.position.copy(medir.pts[0].clone().lerp(medir.pts[1], 0.5)); scene.add(medir.lbl); }
}
$('#btnMedir').addEventListener('click', e => { medir.activo = !medir.activo; e.currentTarget.setAttribute('aria-pressed', medir.activo); toast(medir.activo ? 'Haz clic en dos puntos para medir' : 'Medición desactivada'); if (!medir.activo) { medir.pts = []; if (medir.linea) scene.remove(medir.linea); if (medir.lbl) scene.remove(medir.lbl); } });

// ======================= Marcos TF =======================
const TF = [];
function marcoTF(nombre, padre) {
  const g = new THREE.Group(); const L_ = 0.06;
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(L_, 0, 0), new THREE.Vector3(), new THREE.Vector3(0, L_, 0), new THREE.Vector3(), new THREE.Vector3(0, 0, L_)]);
  geo.setAttribute('color', new THREE.Float32BufferAttribute([1, .2, .2, 1, .2, .2, .2, .8, .3, .2, .8, .3, .25, .45, 1, .25, .45, 1], 3));
  const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, toneMapped: false })); ls.renderOrder = 8; ls.layers.set(1); g.add(ls);
  const l = etiqueta(nombre, 'tf'); l.position.set(0, 0, 0.02); l.visible = false; g.add(l); g.userData.lbl = l; padre.add(g); TF.push(g); g.visible = false; return g;
}

// ======================= Demo: motor de tiempo =======================
const D = { carga: null, planes: 0, sustituidos: 0, autocol: 0, run: 0, playing: false, rate: 1, vel: 0.25, modo: 'M0', amp: 0.02, motion: 0, estado: 'REPOSO', personaOff: 0, errores: [], minCam: {}, activo: false, fase: 0, fin: null, choques: 0, roces: 0, pausas: 0, rozando: new Map(), platoEnPinza: null, piezaObjetivo: null };
let simT = 0; const ANIMS = [], LOOPS = [];
function anim(T, fn) { const run = D.run; return new Promise((res, rej) => ANIMS.push({ t0: simT, T: Math.max(T, 1e-3), fn, res, rej, run })); }
function until(fn) { const run = D.run; return new Promise((res, rej) => LOOPS.push({ fn, res, rej, run })); }
const esperar = s => anim(s, () => { });
function tickDemo(dt) {
  for (const a of ANIMS.slice()) { if (a.run !== D.run) { ANIMS.splice(ANIMS.indexOf(a), 1); a.rej(STOP); continue; } const s = Math.min(1, (simT - a.t0) / a.T); try { a.fn(s); } catch (e) { ANIMS.splice(ANIMS.indexOf(a), 1); a.rej(e); continue; } if (s >= 1) { ANIMS.splice(ANIMS.indexOf(a), 1); a.res(); } }
  for (const l of LOOPS.slice()) { if (l.run !== D.run) { LOOPS.splice(LOOPS.indexOf(l), 1); l.rej(STOP); continue; } let r; try { r = l.fn(dt); } catch (e) { LOOPS.splice(LOOPS.indexOf(l), 1); l.rej(e); continue; } if (r) { LOOPS.splice(LOOPS.indexOf(l), 1); l.res(); } }
  if (D.activo && robot) { vigilarRoces(); if ((D.tick = (D.tick || 0) + 1) % 2 === 0) { vigilarChoques(); vigilarAuto(); } }
}
function factorPersona(p) { const pc = persona.position; return Math.hypot(p.x - pc.x, p.y - pc.y) < 0.75 ? 0.5 : 1; }
function donde(p) { const b = enBase(p); return `punto (${mm(b.x)}, ${mm(b.y)}, ${mm(b.z)}) mm en base_link, a ${mm(Math.hypot(b.x, b.y))} mm del eje de la base y ${mm(b.z)} mm sobre la mesa.`; }
async function irA(p, yaw, opts = {}, desc = 'un punto') {
  let q = ikTCP(p, yaw, robot.q, opts);
  if (!q && !opts.horiz && opts.sym !== false) for (const dy of [PI / 4, -PI / 4, PI / 2]) { q = ikTCP(p, yaw + dy, robot.q, opts); if (q) break; }
  if (!q) { const dg = diagnosticarPunto(p, yaw, opts); throw new FalloDemo(`No llego a ${desc} sin chocar: ${donde(p)}`, 'fallo', dg); }
  await moveJ(q, factorPersona(p), opts, desc);
}
async function pinzaA(w) { const w0 = pinza.w; const T = Math.abs(w - w0) / 0.11 * 0.9 + 0.15; D.motion += T; await anim(T, s => pinza.setApertura(w0 + (w - w0) * smooth(s))); }
function adjuntar(obj, padre) {
  obj.updateMatrixWorld(true); padre.updateMatrixWorld(true); padre.attach(obj); VERSION_ESCENA++;
  const lleva = pinza.tcp.children.find(c => c === OBJ.plato1 || c === OBJ.plato2 || piezas.some(p => p.obj === c)); // lo que lleva la pinza entra en el modelo de colisión
  D.carga = lleva && robot ? cargaDe(lleva) : null;
}
function posReposo() { const b = BASES[L.robot]; return new THREE.Vector3(b.x + (L.robot === 'B' ? -0.22 : 0.22), b.y - 0.12, MESA.h + 0.25); }
function qReposo() { return ikTCP(posReposo(), PI / 2, null) || [0, -PI / 2, PI / 2, -PI / 2, -PI / 2, 0]; }

// Roces: puntos de la pinza (y del plato en la pinza) frente a las piezas que no se están cogiendo
const _p = new THREE.Vector3();
function vigilarRoces() {
  const pts = [tcpMundo()]; for (const d of pinza.dedos) pts.push(d.yema.getWorldPosition(new THREE.Vector3()));
  pts.push(new THREE.Vector3(0, 0, 0.07).applyMatrix4(pinza.g.matrixWorld));
  for (const pz of piezas) {
    if (pz.enPinza || pz.usada || pz === D.piezaObjetivo) continue;
    pz.obj.getWorldPosition(_p); let roza = pts.some(q => q.distanceTo(_p) < pz.F.r + 0.012);
    if (!roza && D.platoEnPinza) { const pc = D.platoEnPinza.getWorldPosition(new THREE.Vector3()); if (pz.obj.parent !== D.platoEnPinza && Math.hypot(pc.x - _p.x, pc.y - _p.y) < PLATO_R + pz.F.r * 0.6 && Math.abs(pc.z - _p.z) < 0.04) roza = true; }
    if (roza && !D.rozando.get(pz.id)) { D.roces++; $('#dRoces').textContent = D.roces; publicar('/seguridad/roce [PROPUESTA]', ['segur'], { fase: D.estado, pieza: `${pz.id}: ${pz.tipo}`, aviso: D.platoEnPinza && !pts.some(q => q.distanceTo(_p) < pz.F.r + 0.012) ? 'el plato que lleva la pinza pasa sobre una pieza' : 'la pinza toca una pieza que no está cogiendo' }); }
    D.rozando.set(pz.id, roza);
  }
}

// Choques en todo el recorrido: esquinas de las piezas de la pinza y muñeca (cápsulas) frente a la mesa y las cajas
let PUNTOS_PINZA = null; const marcaChoque = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: '#d0402b', transparent: true, opacity: 0.85, depthTest: false, toneMapped: false })); marcaChoque.renderOrder = 10; marcaChoque.visible = false; scene.add(marcaChoque);
function puntosPinza() {
  if (PUNTOS_PINZA) return PUNTOS_PINZA; PUNTOS_PINZA = [];
  for (const m of pinza.mallas()) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) PUNTOS_PINZA.push({ m, v: new THREE.Vector3(x, y, z) }); }
  return PUNTOS_PINZA;
}
const _w = new THREE.Vector3(), _l = new THREE.Vector3();
function choqueAhora() {
  let peor = null; const cajas = L.caja.on ? [OBJ.caja1, OBJ.caja2].filter(c => c.visible) : []; const hw = MESA.w / 2, hd = MESA.d / 2; const hl = CAJA_LADO / 2;
  const mira = (p, prof, contra, que) => { if (prof > 0.002 && (!peor || prof > peor.prof)) peor = { prof, contra, que, p: p.clone() }; };
  pinza.g.updateMatrixWorld(true);
  for (const { m, v } of puntosPinza()) {
    _w.copy(v).applyMatrix4(m.matrixWorld);
    if (Math.abs(_w.x) < hw && Math.abs(_w.y) < hd) mira(_w, MESA.h - _w.z, 'mesa', 'pinza');
    for (const cj of cajas) { _l.copy(_w).applyMatrix4(_inv.copy(cj.matrixWorld).invert()); if (Math.abs(_l.x) < hl && Math.abs(_l.y) < hl && _l.z < L.caja.h && _l.z > 0) mira(_w, Math.min(L.caja.h - _l.z, hl - Math.abs(_l.x), hl - Math.abs(_l.y)), 'caja', 'pinza'); }
  }
  const P = robot.puntos(); for (let i = 3; i < 7; i++) mira(P[i], MESA.h - (P[i].z - 0.042), 'mesa', 'muñeca');
  return peor;
}
function vigilarChoques() {
  const c = choqueAhora(); const antes = D.chocando;
  if (c) { marcaChoque.position.copy(c.p); marcaChoque.visible = true; D.marcaHasta = simT + 1.5; MAT.alu.emissive.set('#a3241a'); }
  else { MAT.alu.emissive.set('#000000'); if (simT > (D.marcaHasta || 0)) marcaChoque.visible = false; }
  if (c && !antes) { D.choques++; $('#dChoques').textContent = D.choques; D.ep = { fase: D.estado, contra: c.contra, que: c.que, prof: c.prof }; }
  if (c && D.ep && c.prof > D.ep.prof) Object.assign(D.ep, { prof: c.prof, contra: c.contra, que: c.que });
  if (!c && antes && D.ep) cerrarChoque();
  D.chocando = !!c;
}
function cerrarChoque() {
  const e = D.ep; D.ep = null; if (!e) return; (D.eventos = D.eventos || []).push({ ...e, t: +(simT - D.t0).toFixed(1), q: robot.q.map(v => +(v * R2D).toFixed(0)) });
  publicar('/seguridad/colision [PROPUESTA]', ['segur'], { fase: e.fase, contra: e.contra, pieza_robot: e.que, penetracion_max_mm: mm(e.prof) });
  toast(`Choque: ${e.que} contra la ${e.contra}, hasta ${mm(e.prof)} mm (${e.fase})`);
}

// ======================= Grafo ROS =======================
const NODOS = {
  v1_face_id: [8, 14, 'V1'], v1_gestures: [8, 50, 'V1'], v1_dialog: [8, 100, 'V1'], v1_tray: [8, 190, 'V1'],
  pedidos: [130, 14, 'ROB'], coordinador: [130, 82, 'ROB'], seguridad: [130, 132, 'ROB'], movimiento: [130, 180, 'ROB'], pinza: [130, 222, 'ROB'],
  v2_camera_cenital: [252, 14, 'V2'], 'v2_fruit_*': [252, 64, 'V2'], v2_calibration: [252, 132, 'V2'], v2_grasp: [252, 100, 'V2'],
};
const ARISTAS = {
  face: ['v1_face_id', 'v1_dialog'], gest: ['v1_gestures', 'v1_dialog'], ident: ['v1_dialog', 'coordinador'], order: ['v1_dialog', 'pedidos'], menu: ['pedidos', 'v1_dialog'],
  svc: ['coordinador', 'v1_dialog'], tstat: ['v1_tray', 'coordinador'], tpose: ['v1_tray', 'movimiento'], img: ['v2_camera_cenital', 'v2_fruit_*'], det: ['v2_fruit_*', 'v2_grasp'],
  fruits: ['v2_grasp', 'coordinador'], tfcal: ['v2_calibration', 'movimiento'], accion: ['coordinador', 'movimiento'], gripper: ['movimiento', 'pinza'], segur: ['seguridad', 'coordinador'],
  pedido: ['pedidos', 'coordinador'], menu2: ['pedidos', 'v2_grasp'],
};
const W_N = 100, H_N = 22; const aristasOn = new Map();
function dibujarGrafo() {
  const svg = $('#graph'); if (!svg) return; const col = GRUPO_COL(); let s = '';
  const c = n => { const [x, y] = NODOS[n]; return [x + W_N / 2, y + H_N / 2]; };
  for (const [id, [a, b]] of Object.entries(ARISTAS)) {
    const [x1, y1] = c(a), [x2, y2] = c(b); const sx = x1 < x2 ? x1 + W_N / 2 : x1 > x2 ? x1 - W_N / 2 : x1; const ex = x1 < x2 ? x2 - W_N / 2 : x1 > x2 ? x2 + W_N / 2 : x2;
    const off = (id === 'menu' || id === 'svc') ? 5 : 0; const sy = y1 + (x1 === x2 ? (y1 < y2 ? H_N / 2 : -H_N / 2) : off), ey = y2 + (x1 === x2 ? (y1 < y2 ? -H_N / 2 : H_N / 2) : off);
    const mx = (sx + ex) / 2; s += `<path class="ed${aristasOn.has(id) ? ' on' : ''}" d="M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey}"/>`;
  }
  for (const [n, [x, y, g]] of Object.entries(NODOS)) s += `<g class="nd"><rect x="${x}" y="${y}" width="${W_N}" height="${H_N}" rx="5" fill="${col[g]}22" stroke="${col[g]}"/><text x="${x + 6}" y="${y + 14.5}" fill="${css('--ink')}">${n}</text></g>`;
  svg.innerHTML = s;
}
function publicar(topic, aristas, payload) {
  for (const a of aristas) aristasOn.set(a, simT + 1.6 * D.rate);
  dibujarGrafo(); $('#dMsg').textContent = `${topic}\n` + yamlish(payload, 1);
  const li = document.createElement('li'); li.innerHTML = `<span>${fmt(simT - D.t0, 1)} s</span><span><b>${topic}</b> ${resumen(payload)}</span>`; $('#dLog').prepend(li); while ($('#dLog').children.length > 40) $('#dLog').lastChild.remove();
}
function yamlish(o, ind = 0) { const pad = '  '.repeat(ind); if (Array.isArray(o)) return o.map(v => typeof v === 'object' ? `${pad}- ${yamlish(v, ind + 1).trimStart()}` : `${pad}- ${v}`).join('\n'); return Object.entries(o).map(([k, v]) => v && typeof v === 'object' ? `${pad}${k}:\n${yamlish(v, ind + 1)}` : `${pad}${k}: ${v}`).join('\n'); }
function resumen(p) { const s = JSON.stringify(p).replace(/[{}"\[\]]/g, '').replace(/,/g, ', ').replace(/:/g, ': ').replace(/\s+/g, ' '); return s.length > 160 ? s.slice(0, 158) + '…' : s; }
function estado(e) { D.estado = e; $('#dEstado').textContent = e; }
const PASOS2 = [
  ['Reposo', 'Pantalla en espera; gesto global de inicio'], ['Identificación', 'Cara o gesto personal; desconocido = invitado'], ['Primer plato', 'Platos con alérgeno en gris'],
  ['Segundo plato', 'Se publica el pedido completo'], ['Recepción', 'La bandeja se mantiene en el recuadro: lista'], ['Servicio 1', 'Fruta al plato 1º y plato a zona_primero'],
  ['Servicio 2', 'Igual con el 2º, con la pose actual'], ['Fin', 'Retira la bandeja; vuelta a reposo'],
];
const PASOS1 = [
  ['Reposo', 'Pantalla en espera; gesto global de inicio'], ['Identificación', 'Cara o gesto personal; desconocido = invitado'], ['Plato', 'Platos con alérgeno en gris'],
  ['Sin segundo', 'Gesto «nada más»: se publica un pedido de un plato'], ['Recepción', 'La bandeja se mantiene en el recuadro: lista'], ['Servicio', 'Fruta al plato y plato al centro de la bandeja'],
  ['Fin', 'Retira la bandeja; vuelta a reposo'],
];
let PASOS = PASOS2;
function pintarPasos(i, fallo = false) { $('#dSteps').innerHTML = PASOS.map(([t, s], k) => `<li class="${k === i ? (fallo ? 'fail' : 'on') : k < i ? 'done' : ''}"><span class="n">${k + 1}</span><div>${t}<small>${s}</small></div></li>`).join(''); }
function paso(i) { D.paso = i; pintarPasos(i); }

// ======================= Comprobación previa del plan =======================
// opts.perfil: el perfil de los planes que se comprueban (T1.6; obligatorio: el de la demo, el de explorar o el de validar).
// opts.parar: para en el primer fallo grave (lo usa la búsqueda de disposiciones, que solo necesita saber si pasa).
// Las cajas se orientan con los planes de ese perfil mientras dura y vuelven a los de explorar al acabar.
const PARAR_CHK = { out: null };
// La comprobación previa mira siempre la escena de partida (H3, DT24: enEscenaDePartida)
function comprobarPlan(opts = {}) { return enEscenaDePartida(() => comprobarPlan1(opts)); }
function comprobarPlan1(opts) {
  const pf = PERFIL.de(opts.perfil).nombre; const q0 = robot ? robot.q.slice() : null;
  if (robot) orientarCajas(pf);
  try { return comprobarPlan0(opts, pf); } catch (e) { if (e !== PARAR_CHK) throw e; robot.setQ(q0); return PARAR_CHK.out; }
  finally { if (robot && pf !== PERFIL_EXPLORA) orientarCajas(PERFIL_EXPLORA); }
}
function comprobarPlan0(opts, pf) {
  const out = []; if (!robot) return out;
  const q0 = robot.q.slice(); let ctxI = {}; const add = (cls, txt, grave = false) => { out.push({ cls, txt, grave, info: { ...ctxI } }); if (grave && opts.parar) { PARAR_CHK.out = out; throw PARAR_CHK; } };
  const zTr = MESA.h + H_TR;
  // la disposición tiene que poder existir en la celda real
  for (const pr of problemasFisicos(L)) { ctxI = { fase: 'disposicion', objs: pr.objs }; add('bad', pr.txt, true); }
  // fruta del pedido
  for (const tipo of L.pedido === 1 ? ['manzana'] : ['manzana', 'uvas']) {
    ctxI = { fase: 'fruta' }; const pz = piezas.find(p => p.tipo === tipo); const c = pz.obj.getWorldPosition(new THREE.Vector3());
    const okA = ikTCP(new THREE.Vector3(c.x, c.y, zTr), 0, q0) || ikTCP(new THREE.Vector3(c.x, c.y, zTr), PI / 2, q0);
    const okG = llegaVertical(new THREE.Vector3(c.x, c.y, MESA.h + alturaAgarre(pz.F)), q0);
    if (okA && okG) add('ok', `Coger ${pz.F.nombre.toLowerCase()} en la zona de fruta`);
    else { // T1.4-5: si en las poses que fallan hay ramas analíticas y ninguna converge, no es «fuera de alcance»
      const pA = new THREE.Vector3(c.x, c.y, zTr), pG = new THREE.Vector3(c.x, c.y, MESA.h + alturaAgarre(pz.F));
      const poses = !okA ? [[pA, 0], [pA, PI / 2]] : [0, PI / 4, PI / 2, -PI / 4].map(y => [pG, y]);
      ctxI.causa = poses.every(([p, y]) => causaSinIK(p, y, {}) === 'ik_calibrada') ? 'ik_calibrada' : 'alcance';
      add('bad', ctxI.causa === 'ik_calibrada' ? `${pz.F.nombre}: IK calibrada no converge para cogerla en vertical (la IK analítica nominal tiene ramas, pero ninguna converge con la calibración del ${ROB.id})` : `${pz.F.nombre}: fuera de alcance para cogerla en vertical`, true);
    }
  }
  // platos: soltar la fruta y coger en horizontal
  for (const [pk] of platosActivos()) {
    ctxI = { fase: 'soltar', pk }; const n = pk === 'plato1' ? '1º' : '2º'; const pc = new THREE.Vector3(L[pk].x, L[pk].y, zPlato());
    const F = pk === 'plato1' ? FRUTAS.manzana : FRUTAS.uvas, nP = pk === 'plato1' ? 2 : 1; const pts = puntosSoltar(pc, F, nP); const zMax = pts[0].arr.z; ctxI.h = zMax - MESA.h;
    const ok = pts.every(p => llegaVertical(p.arr, q0) && llegaVertical(p.sol, q0));
    if (ok) add('ok', `Soltar ${nP} ${nP > 1 ? 'piezas' : 'pieza'} en el plato ${n} (pasando a ${fmt((zMax - MESA.h) * 100, 0)} cm)`); else add('bad', `Plato ${n}: no llego a soltar la fruta encima (hay que pasar a ${fmt((zMax - MESA.h) * 100, 0)} cm sobre la mesa). Acércalo a la base o baja la caja.`, true);
    ctxI = { fase: 'plato', pk }; const pl = planPlatoCache(pk, pf);
    if (!pl) { const f = planForzado(pk, pf); if (f) D.posturaImposible = { q: f.q, w: 0.03, c: f.choque, pk };
      add('bad', f && f.choque ? `Plato ${n}: el robot real no puede cogerlo en horizontal por el borde: chocaría ${textoChoque(f.choque)}${f.hol.min < 0 ? ` (${mm(-f.hol.min)} mm)` : ''}. ${L.caja.on ? 'Sube la caja o mueve el plato.' : 'Ponlo sobre la caja.'}` : `Plato ${n}: no hay ninguna dirección para cogerlo en horizontal por el borde`, true); }
    else if (pl.hol.min < -0.002) add('warn', `Plato ${n}: al cogerlo en horizontal, ${pl.hol.contra === 'caja' ? 'la pinza entra en la caja' : 'la muñeca o la pinza bajan por debajo de la mesa'} (${mm(pl.hol.min)} mm). ${L.caja.on ? 'Sube la caja.' : 'Ponlo sobre la caja.'}`);
    else add('ok', `Coger el plato ${n} en horizontal (holgura ${mm(pl.hol.min)} mm, entrada ${pl.k ? (pl.k > 0 ? '+' : '') + pl.k * 15 + '°' : 'radial'}${pl.pitch ? `, muñeca inclinada ${Math.round(pl.pitch * R2D)}°` : ''})`);
  }
  // bandeja
  const bp = poseBandeja(simT); bandeja.updateMatrixWorld(true);
  for (const [pk, zk] of platosActivos()) { // ensayo en seco: levantar, llevar nivelado y dejar
    ctxI = { fase: 'transporte', pk, zona: zk }; const pl = planPlatoCache(pk, pf); const n = pk === 'plato1' ? '1º' : '2º'; const hB = fmt((bp.z - MESA.h) * 100, 0);
    if (!pl) { add('bad', `Plato ${n} → ${zk}: sin agarre no se puede comprobar el transporte`); continue; }
    if (pl.cadena && pl.cadena.pc2) add('ok', `Llevar el plato ${n} nivelado hasta ${zk} y dejarlo (bandeja a ${hB} cm)`);
    else if (pl.cadena.fallo.fase === 'plato') { ctxI = { fase: 'plato', pk, causa: pl.cadena.fallo.causa, pct: pl.cadena.fallo.pct }; add('bad', `Plato ${n}: no puedo cogerlo y levantarlo en línea recta: ${pl.cadena.fallo.fallo} (llega al ${pl.cadena.fallo.pct} %).`, true); }
    else { ctxI.causa = pl.cadena.fallo.causa; ctxI.pct = pl.cadena.fallo.pct; add('bad', `Plato ${n} → ${zk}: no puedo llevarlo nivelado y dejarlo sin chocar: ${pl.cadena.fallo.fallo} (llega al ${pl.cadena.fallo.pct} %). Bandeja a ${hB} cm sobre la mesa.`, true); }
  }
  robot.setQ(q0);
  return out;
}
function pintarCheck(lista) { $('#dCheck').innerHTML = lista.map(c => `<li class="${c.cls}">${c.txt}</li>`).join(''); }
function verPosturaImposible() {
  const P = D.posturaImposible; if (!P) return; D.activo = false; robot.setQ(P.q); pinza.setApertura(P.w); sincronizarSliders(); actualizarHUD(); // modo manual: el HUD dice con qué choca
  if (P.c) { marcaChoque.position.copy(baseAMundo(P.c.p[0], P.c.p[1], P.c.p[2])); marcaChoque.visible = true; D.marcaHasta = simT + 1e9; }
  const pc = OBJ[P.pk].getWorldPosition(new THREE.Vector3()); animarCam(new THREE.Vector3(pc.x - 0.45, pc.y - 0.55, pc.z + 0.35), pc);
}
function mostrarFallo(titulo, txt, tipo = 'fallo') { if (D.buscando || D.validando) return; const f = $('#dFallo'); f.hidden = false; f.className = 'card fallo' + (tipo === 'abort' ? ' abort' : ''); f.innerHTML = `<div><b>${titulo}</b>${txt}</div>`; }

// ======================= Guion de la demo =======================
const MENU = { primeros: [{ plato: 'Manzanas', piezas: 2, alergenos: [] }, { plato: 'Frambuesas', piezas: 1, alergenos: ['frambuesa'] }], segundos: [{ plato: 'Uvas', piezas: 1, alergenos: [] }, { plato: 'Limón', piezas: 1, alergenos: [] }] };
// pf: perfil de movimiento de toda la demo (T1.6): cada movimiento lo lleva en su petición
async function demo(pf) {
  // D.faseInicio: fase de la bandeja al arrancar (BALANCEO(simT + D.fase)), para que la búsqueda de disposiciones ensaye
  // desde la misma (DT10). D.falloDemo: el fallo de esta demo, con su causa (la validación lo lee, T1.8).
  PERFIL.de(pf); const run = D.run; D.t0 = simT; D.faseInicio = simT + D.fase; D.fin = null; D.ctx = {}; D.perfilDemo = pf; D.falloDemo = null;
  try {
    const chk = comprobarPlan({ perfil: pf }); pintarCheck(chk); orientarCajas(pf);
    const graves = chk.filter(c => c.grave); if (graves.length) throw new FalloDemo(graves.map(g => g.txt).join(' '), 'previo', { causa: 'previo', items: graves });
    paso(0); estado('REPOSO'); publicar('/v1/dialog_state', ['ident'], { paso: 'reposo', mensaje: 'Haz el gesto de inicio' }); await esperar(1.2);
    paso(1); estado('IDENTIFICANDO');
    await anim(2.2, s => { D.personaOff = 0.7 * (1 - smooth(s)); });
    publicar('/v1/face_identity', ['face'], { candidato: 'persona_03', confianza: 0.91 }); await esperar(0.8);
    publicar('/v1/identity', ['ident'], { person_id: 'persona_03', metodo: 'cara', is_guest: false, alergias_ficticias: ['frambuesa'] }); await esperar(1.2);
    paso(2); estado('PEDIDO');
    publicar('/menu', ['menu', 'menu2'], { primeros: MENU.primeros.map(m => `${m.plato} x${m.piezas}${m.alergenos.length ? ' (gris: alérgeno)' : ''}`), segundos: MENU.segundos.map(m => `${m.plato} x${m.piezas}`) }); await esperar(1.0);
    const uno = L.pedido === 1;
    publicar('/v1/gesture_event', ['gest'], { gesto: 'dos_dedos', opcion: 1 }); await esperar(1.0);
    paso(3); if (uno) { publicar('/v1/gesture_event', ['gest'], { gesto: 'nada_mas', opcion: 0 }); await esperar(0.8); }
    publicar('/v1/order', ['order', 'ident'], { person_id: 'persona_03', primero: 'Manzanas x2', segundo: uno ? 'ninguno' : 'Uvas x1' }); await esperar(0.6);
    publicar('pedido validado [PROPUESTA]', ['pedido'], uno ? { platos: 1, primero: { fruta: 'manzana', piezas: 2 } } : { platos: 2, primero: { fruta: 'manzana', piezas: 2 }, segundo: { fruta: 'uvas', piezas: 1 } }); await esperar(0.8);
    paso(4); estado('ESPERANDO_BANDEJA');
    await anim(1.6, s => { trayState.subida = smooth(s); }); trayState.balanceo = true; if (!uno) ladoZonas(); await esperar(0.8);
    publicar('/v1/tray_status', ['tstat'], { estado: 'lista', desviacion_mm: 0 });
    const bp = poseBandeja(simT), tb = enBase(bp); publicar('/v1/tray_pose', ['tpose'], { marco: 'base_link', x: +tb.x.toFixed(3), y: +tb.y.toFixed(3), z: +tb.z.toFixed(3), yaw_deg: gradosBase(bp.yaw), marcadores_vistos: 3 }); await esperar(0.6);
    paso(5); publicar('/v2/fruits', ['img', 'det', 'fruits'], { marco: 'base_link', piezas: piezas.filter(p => !p.usada).map(p => `${p.id}: ${p.tipo}`) }); await esperar(0.5);
    await servirPlato('plato1', 'manzana', 2, zonaDe('plato1'), 1, pf);
    if (!uno) { paso(6); await servirPlato('plato2', 'uvas', 1, 'zona_segundo', 2, pf); }
    paso(uno ? 6 : 7); D.ctx = { fase: 'reposo', accion: 'volver a la postura de reposo' }; estado('HECHO'); publicar('/service_state', ['svc'], { estado: 'hecho' });
    await irA(posReposo(), PI / 2, { perfil: pf }, 'la postura de reposo'); trayState.balanceo = false;
    if (D.ep) cerrarChoque(); D.fin = 'ok'; D.playing = false; $('#dPlay').textContent = 'Reproducir demo';
    if (!D.buscando && !D.validando) toast(`Servicio completo: ${fmt(D.motion, 1)} s de movimiento ${pf === 'curso' ? 'con el perfil «curso» (escala 0,1)' : `al ${Math.round(D.vel * 100)} %`}`);
  } catch (e) {
    if (run !== D.run) return; // reinicio pedido por el usuario
    if (e instanceof FalloDemo) D.falloDemo = { causa: e.info.causa, info: e.info, msg: e.message, tipo: e.tipo, paso: D.paso };
    if (D.ep) cerrarChoque();
    if (e instanceof FalloDemo && e.tipo === 'abort') { // el coordinador publica el aborto y retira el brazo antes de terminar
      estado('ABORTADO'); pintarPasos(D.paso, true); mostrarFalloInfo(e, `Servicio abortado en el paso ${D.paso + 1} (${PASOS[D.paso][0]}).`, 'abort');
      publicar('/service_state', ['svc'], { estado: 'abortado', paso: PASOS[D.paso][0] }); D.platoEnPinza = null;
      try { await retirarSeguro(pf); } catch (e2) { }
      if (run !== D.run) return;
      if (D.ep) cerrarChoque(); D.fin = 'abort'; D.playing = false; $('#dPlay').textContent = 'Reproducir demo'; actualizarHUD(); return;
    }
    D.playing = false; $('#dPlay').textContent = 'Reproducir demo';
    if (e instanceof FalloDemo) {
      D.fin = e.tipo; if (e.tipo !== 'previo') pintarPasos(D.paso, true);
      if (e.tipo === 'previo') { estado('NO INICIADO'); mostrarFalloInfo(e, 'La demo no puede empezar con esta disposición.', 'previo'); }
      else { estado('PARADO'); mostrarFalloInfo(e, `Parada en el paso ${D.paso + 1} (${PASOS[D.paso][0]}).`, 'fallo'); }
    } else { D.fin = 'error'; estado('ERROR'); pintarPasos(D.paso, true); mostrarFallo(`Error interno en el paso ${D.paso + 1}.`, ` ${e && e.message ? e.message : e}`); console.error(e); }
  }
}
// Retirada tras un aborto (DEC-04): sube y se aparta hacia la base sin cambiar la orientación (si lleva el plato, no lo vuelca)
async function retirarSeguro(pf) {
  const ax = ejesHerramienta(); const p = tcpMundo(); const arriba = p.clone().add(new THREE.Vector3(0, 0, 0.06));
  if (Math.abs(ax.z.z) < 0.7) {
    const yaw = Math.atan2(ax.z.y, ax.z.x); const flip = Math.sign(CIN.fk(robot.q)[8]) || 1; const o = { horiz: true, flip, pitch: Math.asin(clamp(-ax.z.z, -1, 1)), minZ: -0.3, permitir: ['bandeja', 'plato:*'], perfil: pf };
    const b = BASES[L.robot]; const hacia = new THREE.Vector3(b.x - p.x, b.y - p.y, 0).normalize();
    await moveL(arriba, yaw, o, 'la retirada'); await moveL(arriba.clone().addScaledVector(hacia, 0.1), yaw, o, 'la retirada');
  } else { await moveL(arriba, yawHerramienta(), { perfil: pf }, 'la retirada'); await irA(posReposo(), PI / 2, { perfil: pf }, 'la postura de reposo'); }
}
async function servirPlato(pk, tipo, n, zona, num, pf) {
  const plato = OBJ[pk]; const pc = plato.getWorldPosition(new THREE.Vector3());
  const pts = puntosSoltar(pc, FRUTAS[tipo], n); const zTr = MESA.h + H_TR;
  if (Math.abs(ejesHerramienta().z.z) < 0.7) { estado(`TRANSITO_${num}`); await irA(posReposo(), PI / 2, { perfil: pf }, 'la postura de tránsito'); } // de horizontal a vertical, lejos de la fruta
  for (let k = 0; k < n; k++) {
    const pz = piezas.find(p => !p.usada && p.tipo === tipo); if (!pz) throw new FalloDemo(`No queda ${FRUTAS[tipo].nombre.toLowerCase()} en la zona de fruta`); pz.usada = true;
    estado(`SIRVIENDO_${num} · ${k + 1}/${n}`); D.piezaObjetivo = pz; D.ctx = { fase: 'fruta', pk, accion: `coger ${pz.F.nombre.toLowerCase()} (pieza ${pz.id}) en la zona de fruta` };
    const wAb = Math.min(0.11, pz.F.w + 0.024); const ag = planAgarreFruta(pz, wAb, robot.q);
    if (!ag) throw new FalloDemo(`No hay ninguna orientación de la pinza para coger ${pz.F.nombre.toLowerCase()} (pieza ${pz.id})`, 'fallo', { causa: 'fruta', detalle: 'Ninguna orientación de la pinza vertical llega a la pieza sin chocar.' });
    const c = ag.c, yaw = ag.yaw;
    publicar('servir_pieza [PROPUESTA]', ['accion'], { pieza: pz.id, tipo, plato: pk, agarre_z_m: +pz.F.h.toFixed(3), giro_pinza_deg: Math.round(gradosBase(yaw)), marco_giro: 'base_link', hueco_con_vecinas_mm: ag.hol === Infinity ? '—' : mm(ag.hol) });
    await pinzaA(wAb);
    await irA(new THREE.Vector3(c.x, c.y, zTr), yaw, { perfil: pf }, `la vertical de ${pz.F.nombre.toLowerCase()}`);
    const dz = alturaAgarre(pz.F) - pz.F.h, cierre = Math.max(0.01, Math.min(pz.F.w, 2 * Math.sqrt(Math.max(0, pz.F.r ** 2 - dz ** 2))) - 0.004); // ancho de la pieza a la altura de la yema
    const baja = pinza.tcpZ(cierre) - pinza.tcpZ(wAb); // al cerrar, las yemas de la RG2 avanzan: se baja menos para que acaben a la altura de agarre
    await moveL(new THREE.Vector3(c.x, c.y, MESA.h + alturaAgarre(pz.F) + baja), yaw, { estricto: true, perfil: pf }, `${pz.F.nombre.toLowerCase()}`);
    publicar('/pinza/cerrar [PROPUESTA]', ['gripper'], { ancho_mm: mm(cierre), altura_agarre_mm: mm(alturaAgarre(pz.F)) }); await pinzaA(cierre); adjuntar(pz.obj, pinza.tcp); pz.enPinza = true; D.piezaObjetivo = null;
    const dest = pts[k].arr; D.ctx = { fase: 'soltar', pk, accion: `soltar ${pz.F.nombre.toLowerCase()} en el plato ${num}` };
    await moveL(new THREE.Vector3(c.x, c.y, dest.z), yawHerramienta(), { permitir: ['mesa'], perfil: pf }, 'la altura de traslado'); // la pieza sale apoyada en la mesa
    await irA(dest, yawHerramienta(), { perfil: pf }, `la vertical del plato ${num}`);
    await moveL(pts[k].sol, yawHerramienta(), { permitir: ['plato:' + pk], perfil: pf }, `la altura de soltar en el plato ${num}`);
    await pinzaA(wAb); adjuntar(pz.obj, scene); pz.enPinza = false;
    const z0 = pz.obj.position.z, zt = pc.z + 0.006 + pz.F.h; await anim(0.35, s => { pz.obj.position.z = z0 + (zt - z0) * s * s; }); adjuntar(pz.obj, plato);
    publicar('/v2/serve_check', ['fruits'], { plato: pk, cayo_en_plato: true, piezas: k + 1 });
    await moveL(dest, yawHerramienta(), { permitir: ['plato:' + pk], perfil: pf }, 'la altura de traslado');
  }
  // coger el plato en horizontal por el borde
  estado(`LLEVANDO_${num}`); D.ctx = { fase: 'plato', pk, accion: `coger el plato ${num} por el borde` };
  const pl = planPlatoCache(pk, pf) || planAgarrePlato(pc, robot.q, { pk }); if (!pl) throw new FalloDemo(`No hay ninguna dirección para coger el plato ${num} en horizontal sin chocar.`, 'fallo', { causa: 'sin_trayectoria' });
  const oh = { horiz: true, flip: pl.flip, pitch: pl.pitch, minZ: -0.3, perfil: pf };
  publicar('coger_plato [PROPUESTA]', ['accion'], { plato: pk, agarre: 'horizontal por el borde', aproximacion_deg: pl.k * 15, inclinacion_deg: Math.round(pl.pitch * R2D), holgura_mm: mm(pl.hol.min) });
  await pinzaA(0.03);
  // postura de aproximación: la más cercana a la actual o la planificada en seco; se queda la primera con la que toda la cadena (acercarse, levantar, llevar y dejar) sale bien con la bandeja donde está ahora
  const qCerca = ikTCP(pl.pre, pl.yaw, robot.q, { ...oh, w: 0.03 }); const zAhora = zonasB[zona].getWorldPosition(new THREE.Vector3());
  const opciones = [qCerca, pl.qPre].filter((q, i, a) => q && (i === 0 || !a[0] || Math.max(...q.map((v, j) => Math.abs(v - a[0][j]))) > 0.05));
  let qAprox = null; for (const qp of opciones) { const ch = cadenaPlato(pk, { ...pl, qPre: qp }, zAhora, pf); if (ch.pc2) { qAprox = qp; break; } }
  if (!qAprox) qAprox = qCerca || pl.qPre; // si ninguna pasa, se intenta igual: el paso que falle explicará por qué
  await moveJ(qAprox, factorPersona(pl.pre), { ...oh, w: 0.03 }, `la aproximación al plato ${num}`); // movimiento articular planificado hasta 7 cm del borde
  await moveL(pl.tcp, pl.yaw, { ...oh, permitir: ['plato:' + pk], estricto: true }, `el borde del plato ${num}`);
  publicar('/pinza/cerrar [PROPUESTA]', ['gripper'], { ancho_mm: 6, objeto: 'borde del plato' }); await pinzaA(0.006);
  adjuntar(plato, pinza.tcp); D.platoEnPinza = plato;
  const sube = pl.tcp.clone(); sube.z += 0.08; await moveL(sube, pl.yaw, { ...oh, permitir: ['caja:' + pk], estricto: true }, 'la elevación del plato');
  // colocar en la bandeja
  estado(`COLOCANDO_${num}`); D.ctx = { fase: 'transporte', pk, zona, accion: `llevar el plato ${num} nivelado hasta ${zona}` }; publicar('/service_state', ['svc'], { estado: `colocando ${num}` });
  const zonaObj = zonasB[zona]; let zr = zonaObj.getWorldPosition(new THREE.Vector3()); // pose de recepción
  let tr = colocacionConTransporte(zr, robot.q, pl, D.carga, pf);
  for (let it = 1; !tr.pc2 && it < 4; it++) { // la bandeja se balancea: como MoveIt con replanificación, se espera un momento y se vuelve a planificar con su nueva pose
    publicar('/movimiento/aviso [PROPUESTA]', ['accion'], { tramo: `llevar el plato ${num}`, intento: it, motivo: tr.fallo.fallo, se_hace: 'esperar 0,6 s y replanificar con la bandeja en su pose nueva' });
    await esperar(0.6); zr = zonaObj.getWorldPosition(new THREE.Vector3()); tr = colocacionConTransporte(zr, robot.q, pl, D.carga, pf);
  }
  if (!tr.pc2) throw new FalloDemo(`No puedo llevar el plato ${num} nivelado hasta ${zona} y dejarlo sin chocar: ${tr.fallo.fallo} (llega al ${tr.fallo.pct} %). Bandeja a ${mm(zr.z - MESA.h)} mm sobre la mesa.`, 'fallo', { causa: tr.fallo.causa || 'choque', choque: tr.fallo.choque, q: tr.fallo.q, punto: tr.fallo.p, pct: tr.fallo.pct, horiz: true });
  const pc2 = tr.pc2; D.ctx = { fase: 'bandeja', pk, zona, accion: `dejar el plato ${num} en ${zona}` };
  const ohP = { horiz: true, flip: pl.flip, pitch: pl.pitch, minZ: -0.3, w: 0.006, permitir: ['bandeja'], perfil: pf }; const ctxP = ctxDe(ohP);
  const objetivoDe = z => new THREE.Vector3(z.x - pc2.d.x * R_AGARRE, z.y - pc2.d.y * R_AGARRE, z.z + H_BORDE + 0.004);
  publicar('/movimiento/transporte [PROPUESTA]', ['accion'], { destino: `encima de ${zona}`, restriccion: 'plato nivelado', largo_mm: mm(tr.r.largo) });
  await ejecutar(tr.r.ruta, factorPersona(pc2.pre), tMinCart(tr.r.largo, factorPersona(pc2.pre), pf), pf);
  const THR = 0.025, LAT = 0.12, T_ABORTO = 10;
  let z = pc2.pre.z, quieto = 0, pausado = false, tPausa = 0, tLoop = 0, sinIK = 0;
  if (D.modo === 'M0') {
    await until(dt => {
      tLoop += dt; const zl = zonaObj.getWorldPosition(new THREE.Vector3()); const dev = zl.distanceTo(zr);
      if (dev > THR) { quieto = 0; tPausa += dt; if (!pausado) { pausado = true; D.pausas++; $('#dPausas').textContent = D.pausas; estado('PAUSADO'); publicar('/v1/tray_status', ['tstat'], { estado: 'movimiento_excesivo', desviacion_mm: mm(dev) }); } if (tPausa > T_ABORTO) throw new FalloDemo(`La bandeja ha estado más de ${T_ABORTO} s fuera del volumen de movimiento natural (desviación de ${mm(dev)} mm). Según DEC-04, Robótica aborta y retira el brazo.`, 'abort', { causa: 'bandeja_movida', dev }); return false; }
      quieto += dt; if (pausado && quieto < 0.5) return false;
      if (pausado) { pausado = false; tPausa = 0; estado(`COLOCANDO_${num}`); publicar('/v1/tray_status', ['tstat'], { estado: 'lista', desviacion_mm: mm(dev) }); }
      const t = objetivoDe(zr); z = Math.max(t.z, z - 0.05 * D.vel / 0.25 * dt); D.motion += dt;
      const q = ikCercana(new THREE.Vector3(t.x, t.y, z), pc2.yaw, ohP); if (q) { servo(q, dt, ctxP, `al bajar hacia ${zona}`); sinIK = 0; } else if ((sinIK += dt) > 1) throw new FalloDemo(`Al bajar hacia ${zona}, la pose queda fuera de alcance o en choque`, 'fallo', { causa: 'alcance_bandeja' });
      if (tLoop > 60) throw new FalloDemo(`No se ha podido completar la colocación en ${zona} en 60 s`, 'abort', { causa: 'tiempo' });
      return z <= t.z + 1e-4 && tcpMundo().distanceTo(t) < 0.002;
    });
  } else {
    let prevT = null;
    await until(dt => {
      tLoop += dt; const zl = zonaPasada(zonaObj, LAT); const t = objetivoDe(zl); const p = tcpMundo();
      const ff = new THREE.Vector3(); if (prevT && dt > 0) ff.set((t.x - prevT.x) / dt, (t.y - prevT.y) / dt, 0); prevT = t.clone();
      const e = new THREE.Vector3(t.x - p.x, t.y - p.y, 0); const exy = e.length();
      const paso_ = ff.multiplyScalar(dt).addScaledVector(e, Math.min(8 * dt, 0.8)); const lim = 0.35 * D.vel / 0.25 * dt; if (paso_.length() > lim) paso_.setLength(lim);
      if (exy < 0.02) z -= 0.05 * D.vel / 0.25 * dt; else if (exy > 0.04) z = Math.min(t.z + H_AP, z + 0.03 * dt);
      z = Math.max(z, t.z); D.motion += dt;
      const q = ikCercana(new THREE.Vector3(p.x + paso_.x, p.y + paso_.y, z), pc2.yaw, ohP); if (q) { servo(q, dt, ctxP, `siguiendo la bandeja hacia ${zona}`); sinIK = 0; } else if ((sinIK += dt) > 1) throw new FalloDemo(`Siguiendo la bandeja, ${zona} sale del alcance del brazo. Baja la bandeja o acerca a la persona.`, 'abort', { causa: 'alcance_bandeja' });
      if (tLoop > 30) throw new FalloDemo(`El seguimiento no converge en 30 s (la bandeja se mueve más de lo que el brazo puede seguir)`, 'abort', { causa: 'tiempo' });
      return z <= t.z + 1e-4 && exy < 0.003 && Math.abs(p.z - t.z) < 0.002;
    });
  }
  // al tocar la bandeja, el plato pasa a moverse con ella; después se abre la pinza y la pinza sale hacia atrás
  adjuntar(plato, scene); bandeja.updateMatrixWorld(true); adjuntar(plato, bandeja); plato.position.z = 0.0005; plato.rotation.set(0, 0, plato.rotation.z); D.platoEnPinza = null;
  const errV = plato.position.clone().sub(zonaObj.position); errV.z = 0; const err = errV.length(); D.errores.push(err);
  $('#dError').textContent = D.errores.map(e => `${mm(e)}`).join(' · ') + ' mm';
  await pinzaA(0.03);
  publicar('/service_state', ['svc'], { estado: `colocado ${num}`, error_colocacion_mm: mm(err) });
  const p = tcpMundo(); const atras = p.clone().addScaledVector(pc2.eje, -0.08); const ohS = { ...ohP, w: 0.03, carga: null, permitir: ['bandeja', 'plato:' + pk] };
  await moveL(atras, pc2.yaw, ohS, 'la salida de la bandeja');
  // y sube en recta H_SALIDA con lo mismo permitido (T1.9, DT22): acaba libre, sin tocar nada con el contexto normal del
  // movimiento siguiente (tránsito o reposo), que se planifica desde un estado libre, como con MoveIt
  await moveL(atras.clone().add(new THREE.Vector3(0, 0, H_SALIDA)), pc2.yaw, ohS, 'la subida tras la salida de la bandeja'); // después, movimiento articular planificado
}
// IK para el servo: solo vale una solución de la misma rama (cerca de la postura actual); si no, el robot no puede seguir sin cambiar de postura
function ikCercana(p, yaw, opts) { const q = ikTCP(p, yaw, robot.q, opts); return q && Math.max(...q.map((v, i) => Math.abs(v - robot.q[i]))) < 0.35 ? q : null; }
function zonaPasada(z, lat) { const p0 = poseBandeja(simT - lat); const p1 = poseBandeja(simT); const now = z.getWorldPosition(new THREE.Vector3()); return now.add(new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z)); }
function reiniciarDemo() {
  D.run++; D.playing = false; D.motion = 0; D.posturaImposible = null; D.errores = []; D.personaOff = 0; D.choques = 0; D.roces = 0; D.pausas = 0; D.rozando.clear(); D.chocando = false; D.ep = null; D.eventos = []; D.carga = null; D.planes = 0; D.sustituidos = 0; D.autocol = 0; D.autoAhora = false; VERSION_ESCENA++; marcaChoque.visible = false; MAT.alu.emissive.set('#000000'); D.platoEnPinza = null; D.piezaObjetivo = null; D.fin = null; D.paso = -1;
  trayState.subida = 1; trayState.balanceo = false; aplicarBandeja(simT);
  for (const k of ['plato1', 'plato2']) { if (OBJ[k].parent !== scene) adjuntar(OBJ[k], scene); OBJ[k].rotation.set(0, 0, 0); }
  crearPiezas(); actualizarPlatos(); pinza.setApertura(0.06);
  if (robot) robot.setQ(qReposo()); estado('REPOSO'); pintarPasos(-1); aristasOn.clear(); dibujarGrafo();
  $('#dError').textContent = '—'; $('#dTiempo').textContent = '0,0 s'; $('#dChoques').textContent = '0'; $('#dRoces').textContent = '0'; $('#dPausas').textContent = '0';
  D.carga = null; pintarCalidad(); $('#dLog').innerHTML = ''; $('#dMsg').textContent = 'Pulsa «Reproducir demo» para ver los mensajes del guion.'; if (!D.mantenerFallo) $('#dFallo').hidden = true;
  $('#dPlay').textContent = 'Reproducir demo'; D.minCam = {}; sincronizarSliders();
}
// La demo usa el perfil de la escena (L.perfil, T1.6): antes de empezar se calculan sus trayectorias si no están al día
$('#dPlay').addEventListener('click', async () => {
  if (!robot || CALC.activo) return; const pf = perfilEscena();
  if ((!D.activo || D.fin) && !planesAlDia(pf)) { await calcularPlanes(pf); if (!planesAlDia(pf)) return; }
  if (!D.activo || D.fin) { reiniciarDemo(); D.activo = true; tctl.detach(); sel = null; pintarLista(); pintarSel(); D.playing = true; $('#dPlay').textContent = 'Pausar'; demo(pf); return; }
  D.playing = !D.playing; $('#dPlay').textContent = D.playing ? 'Pausar' : 'Continuar';
});
// Con una validación, un cálculo o una búsqueda en marcha no se reinicia (revisión de F1, H1, y DT31): cortaría sus ensayos y
// la validación quedaría «al día» con una demo atascada. Con la demo en marcha sí: es el uso normal del botón
const ocupadoSinDemo = accion => VAL.activo || CALC.activo || D.buscando ? ocupado(accion) : null;
$('#dReset').addEventListener('click', () => { const oc = ocupadoSinDemo('reiniciar la demo'); if (oc) { toast(oc); return; } D.activo = false; reiniciarDemo(); actualizarCheck(); });

// ======================= Evaluación, HUD y paneles =======================
function enBase(p) { return mundoABase(p); } // punto del mundo en base_link: la misma conversión que la planificación (marco(), T1.5)
// Planes de los platos por perfil (T1.6, decisión 3): CACHE_PLAN[perfil][plato]. Validar con «curso» no pisa lo calculado
// con «gemelo» ni al revés. cachePlan crea la del perfil si no existe (un test puede vaciar CACHE_PLAN entero).
const CACHE_PLAN = { gemelo: {}, curso: {} };
const cachePlan = pf => CACHE_PLAN[PERFIL.de(pf).nombre] || (CACHE_PLAN[pf] = {});
// todo lo que entra en la escena de colisión o en la cadena: robot (posición A/B y cinemática, T1.4), plato, el otro plato, caja (y su altura), zona de fruta, persona, bandeja, cámaras (posición y hacia dónde miran) y pedido, más el perfil (T1.6) y si se ve el robot del otro puesto (H4), y la amplitud del balanceo de la demo, con la que se comprueba la salida de la bandeja (T2.8)
function clavePlan(pk, pf) {
  const P = L.persona, B = L.bandeja; const r3 = v => (+v).toFixed(3), ps = o => `${r3(o.x)},${r3(o.y)}`;
  return [PERFIL.de(pf).nombre, L.robot, ROB.id, r3(L[pk].x), r3(L[pk].y), r3(zPlato()), L.caja.on, r3(L.caja.h), ps(L.plato1), ps(L.plato2), ps(L.zona), r3(L.zona.yaw), ps(P), r3(P.yaw), B.alt, B.ade, L.pedido, Object.values(L.cams).map(c => ps(c.pos) + ',' + r3(c.pos.z) + ',' + ps(c.mira) + ',' + r3(c.roll || 0)).join(';'), otroVisible() ? 'otro' : 'sin otro', (+(D.amp || 0)).toFixed(4)].join('|');
}
const planAlDia = (pk, pf) => cachePlan(pf)[pk]?.key === clavePlan(pk, pf);
// ======================= Escena de partida (H3, DT24) =======================
// La comprobación previa y las trayectorias de los platos (lo que guarda Guardar y lo que ensaya en seco la búsqueda) se
// calculan siempre sobre la escena de partida: fruta en su zona, platos en su sitio, brazo en reposo con la pinza abierta
// 6 cm, sin carga y la bandeja en su pose de recepción, como la deja reiniciarDemo(). Si la demo ya ha movido algo
// (terminada, fallida o en pausa: D.activo y D.paso ≥ 0), la escena animada se aparta mientras dura el cálculo y después se
// devuelve tal cual (mismos padres y en el mismo orden, poses, estado de cada pieza, postura, apertura, carga, bandeja y
// orientación de las cajas): así Guardar con la demo en pausa no la reinicia ni la pierde. Se eligió apartar la escena y no
// reiniciarDemo() porque reiniciar crea piezas nuevas y la demo en pausa sigue esperando con las suyas. Sin demo a medias
// no se toca nada (la matriz y las escenas v8 no pasan por aquí). Si la demo se reinicia durante un cálculo asíncrono, no
// se devuelve nada: ya está en la escena de partida.
const PARTIDA = { n: 0 };
function apartarEscena() {
  if (PARTIDA.n++ || !robot || !D.activo || D.paso < 0) return () => { PARTIDA.n--; };
  const run = D.run, objs = [OBJ.plato1, OBJ.plato2, ...piezas.map(pz => pz.obj)].map(o => ({ o, padre: o.parent, i: o.parent ? o.parent.children.indexOf(o) : -1, p: o.position.clone(), r: o.quaternion.clone() }));
  const est = { q: robot.q.slice(), w: pinza.w, carga: D.carga, sub: trayState.subida, bal: trayState.balanceo, flags: piezas.map(pz => [pz.usada, pz.enPinza]), cajas: [OBJ.caja1.rotation.z, OBJ.caja2.rotation.z], extra: OBS_EXTRA };
  trayState.subida = 1; trayState.balanceo = false; aplicarBandeja(simT);
  for (const k of ['plato1', 'plato2']) { scene.add(OBJ[k]); OBJ[k].rotation.set(0, 0, 0); }
  piezas.forEach((pz, i) => { OBJ.zona.add(pz.obj); pz.obj.position.set(pz.u, pz.v, pz.F.h); pz.obj.rotation.set(0, 0, (i * 1.7) % PI); pz.usada = false; pz.enPinza = false; });
  D.carga = null; OBS_EXTRA = []; pinza.setApertura(0.06); actualizarPlatos(); VERSION_ESCENA++; robot.setQ(qReposo());
  return () => {
    PARTIDA.n--; VERSION_ESCENA++; if (D.run !== run) return;
    for (const x of objs.filter(x => x.padre).sort((a, b) => a.i - b.i)) { x.padre.add(x.o); x.o.position.copy(x.p); x.o.quaternion.copy(x.r); }
    piezas.forEach((pz, i) => { [pz.usada, pz.enPinza] = est.flags[i]; });
    trayState.subida = est.sub; trayState.balanceo = est.bal; aplicarBandeja(simT);
    [OBJ.caja1, OBJ.caja2].forEach((c, i) => { c.rotation.z = est.cajas[i]; c.updateMatrixWorld(true); });
    pinza.setApertura(est.w); robot.setQ(est.q); D.carga = est.carga; OBS_EXTRA = est.extra; scene.updateMatrixWorld(true);
  };
}
function enEscenaDePartida(fn) { const volver = apartarEscena(); try { return fn(); } finally { volver(); } }
async function enEscenaDePartidaAsync(fn) { const volver = apartarEscena(); try { return await fn(); } finally { volver(); } }
const planesAlDia = (pf = PERFIL_EXPLORA) => !robot || platosActivos().every(([pk]) => planAlDia(pk, pf));
const sinPlan = () => EDITANDO || !planesAlDia(PERFIL_EXPLORA); // hay cambios en la escena que aún no se han calculado (explorar)
// Planificar es lo caro: solo se hace al pulsar «Calcular trayectorias», al reproducir la demo, al validar o al guardar,
// nunca al mover un objeto
function planPlatoCache(pk, pf) { if (!planAlDia(pk, pf)) { const it = pasosPlan(pk, pf); while (!it.next().done); } return cachePlan(pf)[pk].pl; }
async function planPlatoAsync(pk, pf, prog) { // igual, pero cede el control entre candidatos para que la página no se congele
  if (planAlDia(pk, pf)) return; const it = pasosPlan(pk, pf);
  for (let r = it.next(); !r.done; r = it.next()) { if (prog) prog(r.value); await new Promise(res => setTimeout(res, 0)); }
}
function* pasosPlan(pk, pf) {
  const pc = new THREE.Vector3(L[pk].x, L[pk].y, zPlato()); const key = clavePlan(pk, pf);
  {
    const bal = trayState.balanceo, sub = trayState.subida; trayState.balanceo = false; trayState.subida = 1; aplicarBandeja(simT); VERSION_ESCENA++; // el plan se hace con la bandeja en su pose de recepción
    const conFruta = OBJ[pk].children.some(c => piezas.some(p => p.obj === c));
    if (!conFruta) { const F = pk === 'plato1' ? FRUTAS.manzana : FRUTAS.uvas; const pw = OBJ[pk].getWorldPosition(new THREE.Vector3()); OBS_EXTRA = puntosSoltar(pw, F, pk === 'plato1' ? 2 : 1).map(p => [p.sol.x, p.sol.y, pw.z + 0.006 + F.h, F.r, 'plato:' + pk]); VERSION_ESCENA++; }
    const cands = planAgarrePlato(pc, qReposo(), { pk, todos: true }); let elegido = null, cadena = null;
    if (OBS_EXTRA.length) { OBS_EXTRA = []; VERSION_ESCENA++; } // la fruta prevista ya va en la carga del plato
    const zw = zonasB[zonaDe(pk)].getWorldPosition(new THREE.Vector3());
    let i = 0; for (const c of cands) { yield { i: i++, n: cands.length }; c.carga = cargaPlan(pk, c); const ch = cadenaPlato(pk, c, zw, pf); if (ch.pc2) { elegido = c; cadena = ch; break; } const rango = f => f ? (f.etapa ?? 0) * 1000 + (f.pct ?? 0) : -1; if (!cadena || rango(ch.fallo) > rango(cadena.fallo)) cadena = ch; } // se explica el fallo de la opción que llegó más lejos
    const pl = elegido || cands[0] || null; if (pl) { pl.cadena = elegido ? cadena : (cadena || { fallo: { fallo: 'sin datos', pct: 0 } }); const ca = [OBJ.caja1, OBJ.caja2][pk === 'plato1' ? 0 : 1]; if (L.caja.on) { ca.rotation.z = pl.yaw; ca.updateMatrixWorld(true); VERSION_ESCENA++; } }
    cachePlan(pf)[pk] = { key, pl, forz: undefined };
    trayState.balanceo = bal; trayState.subida = sub; aplicarBandeja(simT); VERSION_ESCENA++;
  }
  return cachePlan(pf)[pk].pl;
}
// Cadena completa en seco desde el agarre: levantar 8 cm, llevar nivelado y dejar en la zona, con el perfil pf
function cadenaPlato(pk, pl, zw, pf) {
  const o = { horiz: true, pitch: pl.pitch, flip: pl.flip, minZ: -0.3, w: 0.006, carga: pl.carga, perfil: PERFIL.de(pf).nombre };
  // acercamiento recto de 7 cm a lo largo de los dedos, desde la misma postura que usará la demo (pl.qPre)
  const ra = rutaCartesiana(pl.qPre, [{ p: pl.pre, yaw: pl.yaw }, { p: pl.tcp, yaw: pl.yaw }], { horiz: true, pitch: pl.pitch, flip: pl.flip, minZ: -0.3, w: 0.03, permitir: ['plato:' + pk], perfil: pf });
  if (!ra.ruta) return { fallo: { ...ra, fallo: `al acercarse al borde del plato, ${ra.fallo}`, fase: 'plato', etapa: 0 } };
  // elevación recta de 8 cm con el plato agarrado (el plato va en la carga)
  const rl = rutaCartesiana(ra.ruta[ra.ruta.length - 1], [{ p: pl.tcp, yaw: pl.yaw }, { p: pl.tcp.clone().add(new THREE.Vector3(0, 0, 0.08)), yaw: pl.yaw }], { ...o, permitir: ['caja:' + pk, 'plato:' + pk] });
  if (!rl.ruta) return { fallo: { ...rl, fallo: `al levantarlo de la caja, ${rl.fallo}`, fase: 'plato', etapa: 1 } };
  const qL = rl.ruta[rl.ruta.length - 1];
  const t = colocacionConTransporte(zw, qL, pl, pl.carga, pf); return t.pc2 ? { ...t, qL } : { fallo: { ...t.fallo, etapa: 2 } };
}
function cargaPlan(pk, pl) { // el plato y la fruta que llevará, en el marco de tool0 tal como quedará agarrado
  const q0 = robot.q.slice(), w0 = pinza.w; robot.setQ(pl.q); pinza.setApertura(0.006); const base = Array.from(cargaDe(OBJ[pk]));
  const pc = OBJ[pk].getWorldPosition(new THREE.Vector3()); const F = pk === 'plato1' ? FRUTAS.manzana : FRUTAS.uvas; const inv = robot.tool0.matrixWorld.clone().invert();
  if (!OBJ[pk].children.some(c => piezas.some(p => p.obj === c))) for (const p of puntosSoltar(pc, F, pk === 'plato1' ? 2 : 1)) { const v = new THREE.Vector3(p.sol.x, p.sol.y, pc.z + 0.006 + F.h).applyMatrix4(inv); base.push(v.x, v.y, v.z, F.r); }
  robot.setQ(q0); pinza.setApertura(w0); return new Float64Array(base);
}
function planForzado(pk, pf) { // la mejor postura de agarre ignorando el entorno, para enseñar por qué no se puede
  planPlatoCache(pk, pf); const C = cachePlan(pf)[pk]; if (C.forz === undefined) { const pc = new THREE.Vector3(L[pk].x, L[pk].y, zPlato()); const f = planAgarrePlato(pc, qReposo(), { pk, forzar: true }); if (f) f.choque = choqueEn(f.q, { w: 0.03, carga: null, permitir: ['plato:' + pk] }); C.forz = f; } return C.forz;
}
function estadoObjeto(k) {
  if (!robot) return null;
  if (k === 'zona') { const z = L.zona; const pts = []; for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) { const lx = u * (z.w / 2 - 0.03), ly = v * (z.d / 2 - 0.03); pts.push([z.x + Math.cos(z.yaw) * lx - Math.sin(z.yaw) * ly, z.y + Math.sin(z.yaw) * lx + Math.cos(z.yaw) * ly]); } const r = pts.map(([x, y]) => alcance(x, y, 0.035).cls); const ok = r.filter(c => c > 0).length; return { cls: ok === pts.length ? Math.min(...r) : (ok ? 1 : 0), txt: `${ok}/${pts.length} puntos alcanzables` }; }
  if (['plato1', 'plato2', 'persona'].includes(k) && sinPlan()) return { cls: 1, pend: true, txt: 'sin calcular: pulsa «Calcular trayectorias»' };
  if (k === 'plato1' || k === 'plato2') {
    const p = L[k]; const hS = zPlato() - MESA.h + 0.09; const a = alcance(p.x, p.y, hS).cls; const pl = planPlatoCache(k, PERFIL_EXPLORA);
    const g = !pl ? 0 : (pl.hol.min < -0.002 ? 0 : (pl.hol.min < 0.01 ? 1 : 2)); const f = !pl ? planForzado(k, PERFIL_EXPLORA) : null;
    const gtxt = !pl ? (f && f.choque ? `imposible, chocaría ${textoChoque(f.choque)}` : 'no hay dirección') : (pl.hol.min < -0.002 ? `choca con la ${pl.hol.contra} (${mm(pl.hol.min)} mm)` : `holgura ${mm(pl.hol.min)} mm`);
    return { cls: Math.min(a, g), txt: `soltar fruta: ${['no', 'justo', 'sí'][a]} · coger en horizontal: ${gtxt}` };
  }
  if (k === 'persona') { const pb = poseBandeja(simT); const r = platosActivos().map(([pk]) => planPlatoCache(pk, PERFIL_EXPLORA)?.cadena?.pc2 ? 2 : 0); return { cls: Math.min(...r), txt: `llevar y dejar ${r.length > 1 ? 'los platos' : 'el plato'} en la bandeja (a ${fmt((pb.z - MESA.h) * 100, 0)} cm sobre la mesa): ${r.map(c => c ? 'sí' : 'no').join(' / ')}` }; }
  return null;
}
function pintarLista() {
  $('#objList').innerHTML = pickables.filter(p => !p.oculto).map(p => { const e = estadoObjeto(p.key); const cls = e ? ['bad', 'warn', 'ok'][e.cls] : (p.cam ? (CAMS[p.cam].brazoOK ? 'ok' : 'bad') : ''); return `<button data-k="${p.key}" aria-pressed="${!!(sel && (sel.key === p.key || (sel.cam && sel.cam === p.cam)))}"><span>${p.nombre}</span><span class="dot ${cls}"></span></button>`; }).join('');
}
$('#objList').addEventListener('click', e => { const b = e.target.closest('button'); if (b) seleccionar(b.dataset.k); });
function slidersOrient(k, pre) { // giro, inclinación y alabeo en grados; ids <pre>pan_<k>…
  const o = orientDe(L.cams[k]); const f = (id, lab, v, mn, mx) => `<div class="field"><label for="${pre}${id}_${k}">${lab}</label><output id="${pre}${id}_${k}_o">${Math.round(v * R2D)}°</output><input type="range" id="${pre}${id}_${k}" min="${mn}" max="${mx}" step="1" value="${Math.round(v * R2D)}"></div>`;
  return f('pan', 'Giro (− izquierda · + derecha · 0° hacia el fondo)', o.pan, -180, 180) + f('tilt', 'Inclinación (+ hacia abajo)', o.tilt, -60, 89) + f('roll', 'Alabeo (gira la imagen)', o.roll, -180, 180);
}
function entradaOrient(e) { // deslizadores de orientación de la tarjeta de selección y de la pestaña Cámaras
  const m = /^(so|co)(pan|tilt|roll)_(\w+)$/.exec(e.target.id || ''); if (!m || !L.cams[m[3]]) return false;
  const k = m[3], c = L.cams[k], o = orientDe(c); o[m[2]] = +e.target.value * D2R; prepararEdicion(); fijarOrient(c, o.pan, o.tilt, o.roll); actualizarCam(k); VERSION_ESCENA++;
  const out = document.getElementById(e.target.id + '_o'); if (out) out.textContent = `${e.target.value}°`;
  if (e.type === 'change') { guardarLocal(); evaluar(); } return true;
}
for (const id of ['#selCard', '#camCards']) for (const t of ['input', 'change']) $(id).addEventListener(t, entradaOrient);
function pintarSel() {
  const c = $('#selCard'); if (!sel) { c.hidden = true; return; } c.hidden = false;
  const gp = { V1: 'v1', V2: 'v2', ROB: 'rob' }[sel.grupo]; const gt = { V1: 'Visión 1', V2: 'Visión 2', ROB: 'Robótica' }[sel.grupo];
  const p = sel.obj.getWorldPosition(new THREE.Vector3()); const b = enBase(p); const e = estadoObjeto(sel.key);
  const extra = sel.cam ? `<div class="seg" id="segParte">${['pos', 'mira', 'clamp'].map(pt => `<button data-v="${pt}" aria-pressed="${sel.parte === pt}">${{ pos: 'Cámara', mira: 'Punto de mira', clamp: 'Pinza de mesa' }[pt]}</button>`).join('')}</div>${slidersOrient(sel.cam, 'so')}
    <p class="hint">Con <b>Girar</b> activado, arrastra la cámara en la escena para apuntarla (derecha e izquierda giran, arriba y abajo inclinan) o usa sus anillos: rojo inclina, verde gira y azul gira la imagen.</p>` : '';
  c.innerHTML = `<header><h3>${sel.nombre}</h3><span class="pill ${gp}">${gt}</span></header>${extra}
   <dl class="kv"><dt>Posición en base_link</dt><dd>${mm(b.x)}, ${mm(b.y)}, ${mm(b.z)} mm</dd>${['zona', 'persona', 'objetivo'].includes(sel.key) ? `<dt>Giro en base_link</dt><dd>${fmt(angDiff(yawABase(sel.obj.rotation.z), 0) * R2D, 0)}°</dd>` : ''}
   ${e ? `<dt>Alcance</dt><dd><span class="pill ${['bad', 'warn', 'ok'][e.cls]}">${e.pend ? 'sin calcular' : ['no llega', 'justo', 'holgado'][e.cls]}</span></dd><dt></dt><dd>${e.txt}</dd>` : ''}</dl>`;
  const sp = $('#segParte'); if (sp) sp.addEventListener('click', ev => { const bt = ev.target.closest('button'); if (!bt) return; const map = { pos: 'cam:', mira: 'mira:', clamp: 'clamp:' }; seleccionar(map[bt.dataset.v] + sel.cam); });
}
$('#segModo').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#segModo button').forEach(x => x.setAttribute('aria-pressed', x === b)); if (sel) seleccionar(sel.key); });
const HUDC = { k: '', c: null };
function actualizarHUD() {
  if (!robot) return; const t = tcpMundo(); const b = enBase(t); const r = Math.hypot(b.x, b.y);
  let s = `<div class="hudline">TCP en base_link <b>${mm(b.x)}, ${mm(b.y)}, ${mm(b.z)} mm</b> · r ${mm(r)} mm</div>`;
  if (D.activo) s += `<div class="hudline">Coordinador <b>${D.estado}</b>${factorPersona(t) < 1 ? ' · <span class="pill warn">zona de la persona: velocidad ×0,5</span>' : ''}</div>`;
  else if (COL.listo) { // a mano (deslizadores u objetivo): avisa si la postura choca, contra sí mismo o contra algo
    const k = robot.q.map(v => v.toFixed(3)).join() + '|' + pinza.w.toFixed(3) + '|' + VERSION_ESCENA; if (k !== HUDC.k) { HUDC.k = k; HUDC.c = choqueEn(robot.q, { carga: null }); }
    if (HUDC.c) s += `<div class="hudline"><span class="pill bad">${HUDC.c.tipo === 'auto' ? 'Autocolisión' : 'Choque'}: ${textoChoque(HUDC.c)}</span></div>`;
  }
  $('#hud').innerHTML = s; $('#dTiempo').textContent = `${fmt(D.motion, 1)} s`;
  $('#tcpOut').textContent = `${mm(pinza.tcpZ())} mm (cerrada ${mm(pinza.tcpZ(0))} · abierta ${mm(pinza.tcpZ(0.11))})`;
}
function pintarCaja() {
  $$('#segCaja button').forEach(x => x.setAttribute('aria-pressed', (x.dataset.v === '1') === L.caja.on));
  $('#cajaH').value = Math.round(L.caja.h * 100); $('#cajaHOut').textContent = `${Math.round(L.caja.h * 100)} cm`; $('#cajaH').disabled = !L.caja.on;
  if (!robot) return; if (sinPlan()) { $('#cajaInfo').innerHTML = '<dt>Agarre de los platos</dt><dd><span class="pill warn">sin calcular</span> pulsa «Calcular trayectorias»</dd>'; return; }
  $('#cajaInfo').innerHTML = platosActivos().map(([k]) => { const pl = planPlatoCache(k, PERFIL_EXPLORA); const n = k === 'plato1' ? '1º' : '2º'; if (!pl) { const f = planForzado(k, PERFIL_EXPLORA); return `<dt>Coger el plato ${n}</dt><dd><span class="pill bad">${f && f.choque ? `imposible: ${textoChoque(f.choque)}${f.hol.min < 0 ? `, ${mm(-f.hol.min)} mm` : ''}` : 'sin dirección posible'}</span></dd>`; } const h = pl.hol.min; return `<dt>Holgura al coger el plato ${n}</dt><dd><span class="pill ${h < -0.002 ? 'bad' : h < 0.01 ? 'warn' : 'ok'}">${h < -0.002 ? `choca con la ${pl.hol.contra}: ${mm(h)} mm` : `${mm(h)} mm`}</span></dd>`; }).join('');
}
// Comprobación previa de la pestaña Demo: la del perfil de la escena si sus trayectorias están al día; si no, la de explorar
function actualizarCheck() {
  if ($('[data-panel="demo"]').hidden || D.activo || !robot) return; pintarPerfilDemo();
  if (sinPlan()) { pintarCheck([{ cls: 'warn', txt: 'Hay cambios sin calcular. Pulsa «Calcular trayectorias» o reproduce la demo, que calcula antes de mover el brazo.' }]); return; }
  const pf = planesAlDia(perfilEscena()) ? perfilEscena() : PERFIL_EXPLORA; pintarCheck(comprobarPlan({ perfil: pf }));
  $('#dCheckPerfil').textContent = pf === perfilEscena() ? `Con el perfil de la escena («${pf}»).` : `Con el perfil de explorar («${pf}»): las trayectorias del perfil de la escena («${perfilEscena()}») se calculan al reproducir la demo, al validar o al guardar.`;
}
function toast(t) { if (AVISO_ROBOT) { t = t ? `${t} · ${AVISO_ROBOT}` : AVISO_ROBOT; AVISO_ROBOT = null; } const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2800); }
// Aviso visible de solo lectura (T1.1), junto a las etiquetas de la cabecera
$('.chips').insertAdjacentHTML('afterbegin', '<span class="chip" id="chipSoloLectura" role="status" hidden style="border-color:var(--bad);color:var(--bad);font-weight:600"></span>');
// Aviso de calibración sospechosa del robot elegido (T1.4-4), visible desde cualquier pestaña; el detalle va en Escena
$('.chips').insertAdjacentHTML('afterbegin', '<span class="chip" id="chipRobot" role="status" hidden style="border-color:var(--bad);color:var(--bad);font-weight:600"></span>');
function pintarSoloLectura() {
  const el = $('#chipSoloLectura'), s = soloLectura(); el.hidden = !s;
  el.textContent = s ? `SOLO LECTURA · disposición v${L.version}, esta página es la v${LAYOUT.VERSION}` : '';
  el.title = s ? 'Esta disposición es de una versión más nueva del gemelo: se puede ver, pero no se guarda en Tu mesa ni en el grupo hasta que abras una compatible.' : '';
}

// Pestañas
$$('.tabs button').forEach(b => b.addEventListener('click', () => {
  $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); $$('.tab').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
  alcPlane.visible = b.dataset.tab === 'alcance'; solape.visible = alcPlane.visible && $('#lySolape').checked;
  if (b.dataset.tab === 'camaras') pintarCamaras(); if (b.dataset.tab === 'datos') pintarDatos(); if (b.dataset.tab === 'alcance') actualizarTablaAlcance(); if (b.dataset.tab === 'demo') actualizarCheck();
  try { localStorage.setItem('gemelo-tab', b.dataset.tab); } catch (e) { }
}));
$('#segRobot').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.dataset.v === L.robot || !robot) return;
  L = espejo(L); L.robot = b.dataset.v; $$('#segRobot button').forEach(x => x.setAttribute('aria-pressed', x === b));
  colocarRobots(); aplicarLayout(); toast(`Robot del grupo: ${b.dataset.v}. Distribución reflejada al otro lado.`);
});
// ----- Robot calibrado (T1.4 y T1.5) -----
// Activa la cinemática de L.robotId (decisión 2 del brief): IK, colisión (esferas y pares permitidos, iniciarColision) y
// dibujo del brazo. Lo que depende de ella se invalida: los planes (clavePlan lleva ROB.id), los obstáculos en base_link
// (su clave también), el HUD (VERSION_ESCENA), el perfil y el mapa de alcance (aplicarLayout llama a calcularMapa).
// Si el robot cambia porque se abre, se importa o se aplica una disposición con otro robotId, se avisa (corrección 9 de la
// revisión). El selector (cambiarRobotId) avisa por su cuenta: ROBOT_PEDIDO.
function aplicarCinematica() {
  const id = idValido(L.robotId);
  if (id !== ROB.id) {
    const de = ROB; ROB = robotDe(id); CIN = ROB.cin; VERSION_ESCENA++;
    if (robot) { robot.setCinematica(CIN); REF_MANIP = CIN.manip(Q_REF_MANIP); if (COL.listo) iniciarColision(); calcularPerfil(); }
    if (robot && !ROBOT_PEDIDO) avisoRobot(L.robotId !== id ? `Esta escena usa el robot «${L.robotId}», que esta versión del gemelo no conoce: se usa la cinemática nominal`
      : Math.abs(angDiff(ROB.yaw, de.yaw)) < 1e-9 ? `Esta escena usa el robot ${id}: cambia la cinemática (el giro de la base es el mismo)`
      : `Esta escena usa el robot ${id}: cambian la cinemática y el giro de la base (${gradosTxt(ROB.yaw)})`);
  }
  pintarRobotId();
}
// El aviso del robot se suma al siguiente aviso de la página (abrir o importar ponen el suyo justo después) o sale solo
function avisoRobot(t) { AVISO_ROBOT = t; setTimeout(() => { if (AVISO_ROBOT) toast(''); }, 0); }
// Postura en la que arranca el hardware simulado de sim_<id> (initial_positions.yaml del curso; configuraciones[1] de
// tests/fixtures/cinematica/<id>.json): es la del aviso de calibración sospechosa
const Q_INICIAL_SIM = [0, -1.57, 0, -1.57, 0, 0];
const gradosTxt = a => `${fmt(a * R2D, 1).replace('-', '−')}°`;
// Giro del mundo pasado a base_link, en grados en (−180, 180] con 0,1° (topics simulados, corrección 7)
function gradosBase(a) { let g = Math.round(angDiff(yawABase(a), 0) * R2D * 10) / 10; if (g <= -180) g += 360; return g; }
// Campo del prefijo de frames (T1.5-4): '' siempre; '<id>_' solo si el robot tiene URDF doble en el curso
function pintarPrefijo() {
  const s = $('#prefijo'), d = ROB.datos.doble, id = ROB.id, pf = L.prefijoFrames ?? '';
  const ops = [['', `Ninguno (sim_${id === 'nominal' ? '<id>' : id}, un robot)`]]; if (d) ops.push([`${id}_`, `${id}_ (URDF doble ${d.fichero.split('/').pop().replace('.urdf.xacro', '')})`]);
  s.innerHTML = ops.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); s.value = ops.some(o => o[0] === pf) ? pf : ''; s.disabled = ops.length < 2 || soloLectura();
}
$('#prefijo').addEventListener('change', e => { if (soloLectura()) return; L.prefijoFrames = e.target.value; guardarLocal(); pintarDatos(); toast(L.prefijoFrames ? `Frames con el prefijo «${L.prefijoFrames}» (URDF doble)` : 'Frames sin prefijo (sim_<id>)'); });
function pintarRobotId() {
  const d = ROB.datos, id = ROB.id; pintarPrefijo();
  $$('#segRobotId button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === id));
  $('#robotNota').textContent = id !== 'nominal' ? `Cinemática calibrada del robot ${id} (calibration_${id}.yaml del curso) con la IK analítica refinada. Su base_link está girado ${gradosTxt(ROB.yaw)} respecto a world (los ejes de la mesa).`
    : L.robotId === 'nominal' ? 'Robot sin identificar: cinemática nominal. Elige su id cuando lo sepáis.'
      : `Robot «${L.robotId}» desconocido en esta versión del gemelo: se usa la cinemática nominal.`;
  // Aviso permanente si los datos marcan la calibración como sospechosa (T1.4-4): sale del campo `sospechoso`, no del id
  const av = $('#robotAviso'), chip = $('#chipRobot'); av.hidden = chip.hidden = !d.sospechoso;
  if (!d.sospechoso) return;
  const T = CIN.fk(Q_INICIAL_SIM), N = KIN.fk(Q_INICIAL_SIM), pos = M => `(${[M[3], M[7], M[11]].map(v => fmt(v * 1000, 1)).join('; ')}) mm`;
  const txt = `Calibración ${id} sospechosa (SIN VALIDAR): compruébala en sim_${id} antes de usarla`;
  chip.textContent = `CALIBRACIÓN ${id} SOSPECHOSA · SIN VALIDAR`; chip.title = txt;
  av.innerHTML = `<b>${txt}.</b><span>Con esta calibración, tool0 queda a ${mm(Math.hypot(T[3] - N[3], T[7] - N[7], T[11] - N[11]))} mm de donde lo pone el UR3e nominal en la misma postura. El gemelo calcula con ella tal cual, sin corregirla.</span>
    <ol class="falloLista"><li>En el contenedor del curso: <code>ros2 launch launcher_robots_lab_robotica sim_${id}.launch.py</code> (arranca en q = (${Q_INICIAL_SIM.map(v => fmt(v, 2)).join('; ')}) rad).</li>
    <li>Sin mover el robot: <code>ros2 run tf2_ros tf2_echo base_link tool0</code>. Este gemelo predice ${pos(T)}; el nominal, ${pos(N)}.</li>
    <li>Si tf2_echo da lo que predice el gemelo, ROS ve el mismo desplazamiento y la anomalía está en calibration_${id}.yaml: pregunta al profesor antes de usar el ${id}.</li></ol>`;
}
// Cambiar de robot nunca mueve nada sin avisar (T1.5-3). Si cambia el giro de base_link, se pregunta qué se mantiene:
// la mesa (los objetos se quedan donde están, el brazo gira y cambian sus coordenadas en base_link) o la disposición
// respecto al robot (los objetos giran alrededor de la base y conservan sus coordenadas en base_link). Si no cambia el
// giro (nominal, 205 y 206), se cambia sin preguntar y se avisa.
let PREG_ROBOT = null;
// Mientras corre la demo, la validación (T1.8), el cálculo o la búsqueda de una disposición no se cambia de robot
// (correcciones 1 y 2) ni de perfil de movimiento (T1.6), ni se valida. accion: «cambiar de robot», «validar»…
const ocupado = accion => D.playing ? `Pausa la demo para ${accion}` : VAL.activo ? `Espera a que termine la validación para ${accion}` : CALC.activo ? `Espera a que termine el cálculo para ${accion}` : D.buscando ? `Espera a que termine la búsqueda de una disposición para ${accion}` : null;
const ocupadoRobot = () => ocupado('cambiar de robot');
function pedirRobotId(id) {
  if (!robot || !LAYOUT.ROBOT_IDS.includes(id)) return;
  const oc = ocupadoRobot(); if (oc) { toast(oc); return; }
  if (soloLectura()) { toast('Disposición de solo lectura (versión más nueva): no se cambia el robot'); return; }
  if (id === ROB.id && id === L.robotId) { cerrarPreguntaRobot(); return; }
  const dy = angDiff(robotDe(id).yaw, ROB.yaw);
  if (Math.abs(dy) < 1e-9) { cambiarRobotId(id, 'mesa'); return; }
  PREG_ROBOT = id;
  $('#robotPregTit').textContent = `Cambiar al robot ${id}: ¿qué se mantiene?`;
  $('#robotPregTxt').innerHTML = `El base_link del ${id} está girado ${gradosTxt(robotDe(id).yaw)} respecto a world (los ejes de la mesa); el del ${ROB.id}, ${gradosTxt(ROB.yaw)}.<br>
    <b>Mantener la mesa</b>: los objetos se quedan donde están; el brazo gira ${gradosTxt(dy)} y cambian sus coordenadas en base_link.<br>
    <b>Mantener la disposición respecto al robot</b>: los objetos, la persona y las cámaras giran ${gradosTxt(dy)} alrededor de la base y conservan sus coordenadas en base_link (las pinzas de las cámaras se pegan al borde de la mesa más cercano). Pueden quedar fuera de la mesa.`;
  $('#robotPregunta').hidden = false;
}
function cerrarPreguntaRobot() { PREG_ROBOT = null; $('#robotPregunta').hidden = true; }
// Gira la disposición `d` rad alrededor de la base b: sus coordenadas en un base_link que gira lo mismo no cambian
function girarDisposicion(l, b, d) {
  const c = Math.cos(d), s = Math.sin(d); const g = o => { const x = o.x - b.x, y = o.y - b.y; o.x = b.x + c * x - s * y; o.y = b.y + s * x + c * y; };
  [l.zona, l.plato1, l.plato2, l.persona, ...l.arucoE].forEach(g); l.zona.yaw = angDiff(l.zona.yaw + d, 0); l.persona.yaw = angDiff(l.persona.yaw + d, 0);
  for (const k in l.cams) { g(l.cams[k].clamp); g(l.cams[k].pos); g(l.cams[k].mira); }
}
// modo: 'mesa' | 'robot' (ver pedirRobotId). El prefijo de frames, si lo había, pasa a ser el del robot nuevo (o '' si no
// tiene URDF doble).
function cambiarRobotId(id, modo) {
  const de = ROB, a = robotDe(id), dy = angDiff(a.yaw, de.yaw), pre0 = L.prefijoFrames;
  if (modo === 'robot' && dy) girarDisposicion(L, BASES[L.robot], dy);
  L.robotId = id; L.prefijoFrames = pre0 && a.datos.doble ? `${id}_` : '';
  cerrarPreguntaRobot(); D.activo = false; ROBOT_PEDIDO = true; try { aplicarLayout(); } finally { ROBOT_PEDIDO = false; }
  const pre = pre0 !== L.prefijoFrames ? ` Prefijo de frames: ${L.prefijoFrames ? `«${L.prefijoFrames}»` : 'ninguno'}.` : '';
  toast(!dy ? `Robot ${id}: base_link con el mismo giro que el ${de.id}; nada se mueve. Recalcula las trayectorias.${pre}`
    : modo === 'mesa' ? `Robot ${id}: se mantiene la mesa. El brazo gira ${gradosTxt(dy)} y cambian las coordenadas en base_link.${pre}`
      : `Robot ${id}: la disposición gira ${gradosTxt(dy)} alrededor de la base y conserva sus coordenadas en base_link.${pre}`);
}
$('#segRobotId').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pedirRobotId(b.dataset.v); });
// ----- Perfil de movimiento de la escena (T1.6, D6) -----
// L.perfil es el de la demo y el del veredicto principal de la escena; explorar usa siempre «gemelo». Cambiarlo no mueve
// nada ni recalcula la geometría.
const TXT_PERFIL = {
  curso: 'Perfil de la escena: «curso», como MoveIt 2 en la simulación del curso: escala de velocidad y aceleración 0,1 con 5 rad/s² (joint_limits.yaml del curso), ruta cartesiana de MoveIt 2.11+ (pasos de 1 cm y punto medio a 1 mm y 0,01 rad) y el arranque en contacto es un fallo (START_STATE_IN_COLLISION).',
  gemelo: 'Perfil de la escena: «gemelo», el de la v8: rápido, con la velocidad de la demo, 3 rad/s² [SUPUESTO], rectas cada 4 mm y, si arranca tocando algo, se separa de ello (como FixStartStateCollision).',
};
function pintarPerfil() {
  const pf = perfilEscena(); $$('#segPerfil button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === pf));
  $('#perfilNota').innerHTML = `${TXT_PERFIL[pf]} Lo usan la demo y el veredicto que se guarda con la escena. Explorar (arrastrar objetos y «Calcular trayectorias») usa siempre «gemelo».<br><b>Tiempos aproximados</b>: trapecio por articulación sin paradas en los puntos de paso, no la parametrización TOTG de MoveIt [DT4, SIN VALIDAR].`;
  pintarPerfilDemo();
}
function pintarPerfilDemo() {
  const pf = perfilEscena();
  $('#dPerfilNota').textContent = pf === 'curso' ? 'La demo usa el perfil de la escena, «curso»: la velocidad no cambia los movimientos planificados ni las rectas, que van a escala 0,1 como en MoveIt del curso; sí cambia el seguimiento de la bandeja (M0 y M1), que es código del grupo. Tiempos aproximados, no TOTG [DT4].'
    : 'La demo usa el perfil de la escena, «gemelo»: la velocidad escala todos los movimientos. Tiempos aproximados, no TOTG [DT4].';
}
function pedirPerfil(pf) {
  if (!robot || !LAYOUT.PERFILES.includes(pf) || pf === L.perfil) return;
  const oc = ocupado('cambiar de perfil'); if (oc) { toast(oc); return; }
  if (soloLectura()) { toast('Disposición de solo lectura (versión más nueva): no se cambia el perfil'); return; }
  L.perfil = pf; guardarLocal(); pintarPerfil(); actualizarCheck(); pintarCalc();
  toast(`Perfil de la escena: «${pf}». No se mueve nada; la demo y el veredicto que se guarda usan este perfil`);
}
$('#segPerfil').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pedirPerfil(b.dataset.v); });
function responderRobot(modo) {
  if (!PREG_ROBOT) return; const oc = ocupadoRobot();
  if (oc) { cerrarPreguntaRobot(); toast(`${oc}: el robot no cambia`); return; } // la pregunta se abrió antes de empezar: no vale
  cambiarRobotId(PREG_ROBOT, modo);
}
$('#rpMesa').addEventListener('click', () => responderRobot('mesa'));
$('#rpRobot').addEventListener('click', () => responderRobot('robot'));
$('#rpCancel').addEventListener('click', () => { cerrarPreguntaRobot(); toast('El robot no cambia'); });
$('#segCaja').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || D.playing) return; L.caja.on = b.dataset.v === '1'; if (!D.activo) reiniciarDemo(); actualizarPlatos(); pintarCaja(); evaluar(); guardarLocal(); toast(L.caja.on ? 'Platos sobre la caja' : 'Platos sobre la mesa: mira la holgura al cogerlos'); });
$('#cajaH').addEventListener('input', e => { if (D.playing) return; L.caja.h = e.target.value / 100; $('#cajaHOut').textContent = `${e.target.value} cm`; EDITANDO = true; actualizarPlatos(); clearTimeout(pintarCaja._t); pintarCaja._t = setTimeout(() => { EDITANDO = false; actualizarPlatos(); pintarCaja(); evaluar(); }, 300); guardarLocal(); });
$('#apertura').addEventListener('input', e => { pinza.setApertura(e.target.value / 1000); $('#aperturaOut').textContent = `${e.target.value} mm`; actualizarHUD(); });
// Restablecer devuelve los objetos a la disposición de partida; el robot (A/B y su id calibrado) no cambia (T1.4)
$('#btnReset').addEventListener('click', () => { const r = L.robot, pf = L.prefijoFrames; L = layoutDefecto(); if (r === 'A') { L = espejo(L); L.robot = 'A'; } L.robotId = ROB.id; L.prefijoFrames = pf === `${ROB.id}_` ? pf : ''; aplicarLayout(); toast('Distribución de partida restaurada'); });
$('#btnHome').addEventListener('click', () => { if (robot) { robot.setQ(qReposo()); sincronizarSliders(); actualizarHUD(); } });
$('#btnObjetivo').addEventListener('click', () => { if (!robot) return; objetivo.visible = true; objetivo.position.copy(tcpMundo()); objetivo.rotation.set(0, 0, yawHerramienta()); seleccionar('objetivo'); toast('Arrastra el objetivo: el brazo lo sigue con cinemática inversa'); });
const JN = ['Base', 'Hombro', 'Codo', 'Muñeca 1', 'Muñeca 2', 'Muñeca 3'];
$('#jointSliders').innerHTML = JN.map((n, i) => `<div class="field"><label for="j${i}">${n}</label><output id="j${i}o">0°</output><input type="range" id="j${i}" min="-360" max="360" step="1" value="0"></div>`).join('');
JN.forEach((n, i) => $('#j' + i).addEventListener('input', e => { if (!robot || D.playing) return; const q = robot.q.slice(); q[i] = e.target.value * D2R; robot.setQ(q); $('#j' + i + 'o').textContent = `${e.target.value}°`; actualizarHUD(); }));
function sincronizarSliders() { if (!robot) return; robot.q.forEach((v, i) => { const d = Math.round(v * R2D); $('#j' + i).value = d; $('#j' + i + 'o').textContent = `${d}°`; }); }
// «Robot del otro puesto» (H4, DT25): mostrarlo u ocultarlo pone o quita un obstáculo. Invalida los planes de los dos perfiles
// (clavePlan), la caché de obstáculos (su clave) y la validación (firmaVal), y, como mover un objeto, reinicia una demo en
// pausa o terminada. Con la demo en marcha o con un cálculo, una validación o una búsqueda a medias no se cambia.
function otroVisible() { return !!(otro && otro.root.visible); } // declaración (no const): clavePlan y firmaVal están antes en el fichero
function cambiarOtro(v) {
  if (!otro) return;
  if (D.playing || CALC.activo || VAL.activo || D.buscando) { $('#lyOtro').checked = otro.root.visible; toast('Espera a que termine la demo o el cálculo para cambiar el robot del otro puesto'); return; }
  prepararEdicion('Demo reiniciada: ha cambiado el robot del otro puesto'); otro.root.visible = v; VERSION_ESCENA++; actualizarPlatos(); evaluar(); pintarCalc(); // cambian los obstáculos (DT31)
}
const capas = { lyCol: v => volCol.forEach(m => m.visible = v), lyFoto: v => foto.visible = v, lyOtro: v => cambiarOtro(v), lyTF: v => TF.forEach(t => { t.visible = v; t.userData.lbl.visible = v; }), lyEtq: v => labels.domElement.style.display = v ? '' : 'none', lyCirc: v => circ.visible = v, lyFrus: v => Object.values(CAMS).forEach(R => { R.frus.visible = R.huella.visible = v; }) };
for (const id in capas) $('#' + id).addEventListener('change', e => capas[id](e.target.checked));
const circ = new THREE.Mesh(new THREE.RingGeometry(0.497, 0.503, 128), new THREE.MeshBasicMaterial({ color: '#e6b422', side: THREE.DoubleSide, toneMapped: false })); circ.layers.set(1); scene.add(circ); circ.visible = false;
const solape = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#e6b422', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); scene.add(solape); solape.visible = false; solape.renderOrder = 3;
$('#lySolape').addEventListener('change', e => solape.visible = e.target.checked && alcPlane.visible);
function dibujarSolape() {
  const a = BASES.A, b = BASES.B, R = 0.5; const pts = [];
  for (let i = 0; i <= 64; i++) { const t = i / 64 * 2 * PI; const x = a.x + R * Math.cos(t), y = a.y + R * Math.sin(t); if (Math.hypot(x - b.x, y - b.y) <= R) pts.push(new THREE.Vector2(x, y)); }
  for (let i = 0; i <= 64; i++) { const t = i / 64 * 2 * PI; const x = b.x + R * Math.cos(t), y = b.y + R * Math.sin(t); if (Math.hypot(x - a.x, y - a.y) <= R) pts.push(new THREE.Vector2(x, y)); }
  const c = new THREE.Vector2(); pts.forEach(p => c.add(p)); c.multiplyScalar(1 / pts.length); pts.sort((p, q) => Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(q.y - c.y, q.x - c.x));
  solape.geometry.dispose(); solape.geometry = new THREE.ShapeGeometry(new THREE.Shape(pts)); solape.position.z = MESA.h + 0.002;
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  $('#solapeTxt').textContent = `Las bases están a ${mm(dist)} mm. Los círculos de 500 mm se solapan en una franja de unos ${mm(2 * R - dist)} mm en el centro de la mesa. Si el otro puesto trabaja a la vez, esa franja y el aire que hay encima no deben usarse sin coordinarse.`;
}
$$('.vbar.l button').forEach(b => b.addEventListener('click', () => { $$('.vbar.l button').forEach(x => x.setAttribute('aria-pressed', x === b)); vista(b.dataset.vista); }));
function vista(v) {
  const sx = L.robot === 'B' ? 1 : -1; let p, t;
  if (v === 'iso') { p = [-sx * 1.15, -1.45, 1.8]; t = [sx * 0.42, 0.1, 0.9]; }
  if (v === 'planta') { p = [0.0, -0.001, 2.75]; t = [0, 0, MESA.h]; }
  if (v === 'lateral') { p = [0.05, -2.2, 1.05]; t = [0.05, 0, 0.9]; }
  if (v === 'ojos') { const P = L.persona; p = [P.x + 0.08 * Math.cos(P.yaw), P.y + 0.08 * Math.sin(P.yaw), 1.64]; t = [P.x + 0.7 * Math.cos(P.yaw), P.y + 0.7 * Math.sin(P.yaw), 0.95]; }
  animarCam(new THREE.Vector3(...p), new THREE.Vector3(...t));
}
let camAnim = null; function animarCam(p, t) { camAnim = { p0: cam.position.clone(), t0: orbit.target.clone(), p, t, s: 0 }; }
let pipOn = true, verCam = null;
$('#btnPip').addEventListener('click', e => { pipOn = !pipOn; e.currentTarget.setAttribute('aria-pressed', pipOn); pintarPip(); });
$('#camModeExit').addEventListener('click', () => { verCam = null; $('#camMode').hidden = true; pintarPip(); });
function pintarPip() {
  const el = $('#pip'); if (!pipOn || verCam) { el.innerHTML = ''; return; }
  const r = view.getBoundingClientRect(); const tw = Math.min(200, (r.width - 40) / 3); const th = tw * 9 / 16;
  el.innerHTML = Object.keys(CAMS).map(k => `<div class="tile" style="width:${tw}px;height:${th}px"><span>${L.cams[k].nombre}</span></div>`).join('');
}

// ======================= Métricas de cámaras =======================
function puntosObjetivo(k) {
  const pts = [];
  if (k === 'cenital') { const z = L.zona; for (const u of [-0.5, 0, 0.5]) for (const v of [-0.5, 0.5]) pts.push(['zona', new THREE.Vector3(z.x + u * z.w, z.y + v * z.d, MESA.h + 0.03)]); for (const pk of ['plato1', 'plato2']) pts.push([pk === 'plato1' ? 'plato 1º' : 'plato 2º', OBJ[pk].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 0.02))]); }
  if (k === 'entrega') { bandeja.updateMatrixWorld(true); for (const [u, v] of [[0.12, 0.17], [0.12, -0.17], [-0.12, 0.17], [-0.12, -0.17], [0, 0]]) pts.push(['bandeja', new THREE.Vector3(u, v, 0.01).applyMatrix4(bandeja.matrixWorld)]); OBJ.arucoE.forEach((a, i) => pts.push(['marcador ' + (i + 1), a.getWorldPosition(new THREE.Vector3())])); }
  if (k === 'persona') { pts.push(['cara', persona.userData.cara.getWorldPosition(new THREE.Vector3())]); for (const s of [-1, 1]) pts.push([s < 0 ? 'mano dcha.' : 'mano izda.', new THREE.Vector3(-0.02, s * (BAND.w / 2 + 0.01), 0).applyMatrix4(bandeja.matrixWorld)]); }
  return pts;
}
const rayO = new THREE.Raycaster();
function metricasCam(k, soloLibre = false) {
  const c = L.cams[k], R = CAMS[k]; R.cam.updateMatrixWorld(true);
  const M = MODOS[c.modo]; const hf = hfovDe(c), vf = vfovDe(c), ar = areaDe(c);
  const cp = R.cam.position.clone(); const aim = new THREE.Vector3(c.mira.x, c.mira.y, c.mira.z); const dist = cp.distanceTo(aim);
  const dir = aim.clone().sub(cp).normalize(); const inc = aim.z <= MESA.h + 0.01 ? Math.abs(dir.z) : 1;
  const mmpx = SENSOR.mmPorPx(dist, ar.w, c.f, M.w, Math.max(0.2, inc)); // d·(w/f)/N ÷ cos θ (T1.7)
  let libre = Infinity; if (robot) { const P = robot.puntos(); P.push(tcpMundo()); for (let i = 1; i < P.length; i++) { if (P[i - 1].distanceTo(P[i]) < 1e-6) continue; const l = new THREE.Line3(P[i - 1], P[i]); const q = l.closestPointToPoint(cp, true, new THREE.Vector3()); libre = Math.min(libre, q.distanceTo(cp) - 0.05); } }
  if (soloLibre) return { libre };
  const pts = puntosObjetivo(k); let dentro = 0; const tapados = [], fuera = [];
  const robs = robot ? [...robot.meshes, ...pinza.mallas()] : [];
  for (const [n, p] of pts) {
    const ndc = p.clone().project(R.cam); const ok = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1 && ndc.z > -1;
    if (!ok) { fuera.push(n); continue; } dentro++;
    rayO.set(cp, p.clone().sub(cp).normalize()); rayO.far = cp.distanceTo(p) - 0.02; if (robs.length && rayO.intersectObjects(robs, false).length) tapados.push(n);
  }
  return { hf, vf, mmpx, dist, inc, alt: cp.z - MESA.h, aruco: 50 / mmpx, dentro, total: pts.length, fuera, tapados, libre, brazoOK: R.brazoOK, brazoD: R.brazoD, sensor: sensorEscena(), nota: ar.nota };
}
// Píxeles por tarea de cada cámara (T4.1, src/tareas.js): fruta, ArUco, cara y pupilas, mano, bandeja en movimiento y
// profundidad de campo. Los supuestos editables son de la sesión: no se guardan en la escena (I1, I2)
let TAREAS_CFG = TAREAS.cfgDefecto();
const v3a = v => [v.x, v.y, v.z];
// Las tareas de la cámara k, según sus objetivos (como puntosObjetivo): [{ clave, id, titulo, geos, res }] y la profundidad de campo
function tareasCam(k) {
  const c = L.cams[k], R = CAMS[k]; R.cam.updateMatrixWorld(true); bandeja.updateMatrixWorld(true); persona.updateMatrixWorld(true); OBJ.zona.updateMatrixWorld(true);
  const M = MODOS[c.modo], ar = areaDe(c), cam = { w: ar.w, f: c.f, N: M.w, Nh: M.h };
  const cp = R.cam.position.clone(), o = v3a(cp), eje = v3a(R.cam.getWorldDirection(new THREE.Vector3())), arriba = [0, 0, 1];
  const wp = obj => obj.getWorldPosition(new THREE.Vector3());
  // Un punto: profundidad a lo largo del eje, escorzo según el objeto (plano horizontal, segmento o de frente) y si cae en el campo
  const punto = (nombre, p, tipo, extra = {}) => {
    const rayo = v3a(p.clone().sub(cp).normalize()), ndc = p.clone().project(R.cam), prof = TAREAS.profundidad(v3a(p), o, eje);
    const dentro = prof > 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1 && ndc.z > -1;
    return { nombre, prof, dentro, c: tipo === 'plano' ? TAREAS.escorzoPlano(rayo, arriba) : tipo === 'segmento' ? TAREAS.escorzoSegmento(rayo, extra.eje) : 1, ...extra };
  };
  const pts = puntosObjetivo(k), de = nombre => pts.filter(([n]) => n === nombre).map(([, p]) => p), T = [];
  const marcadores = (lista, ids, etq) => lista.map((a, i) => punto(`marcador ${ids + i} (${etq})`, wp(a), 'plano', { ladoMm: a.userData.lado * 1000 }));
  const add = (clave, id, titulo, geos) => T.push({ clave, id, titulo, geos, res: TAREAS.evaluarVarios(id, geos, cam, TAREAS_CFG) });
  if (k === 'cenital') {
    add('fruta', 'fruta', `Fruta de ${fmt(TAREAS_CFG.fruta.ladoMm, 0)} mm`, de('zona').map((p, i) => punto(`zona, punto ${i + 1}`, p, 'plano')));
    add('aruco-zona', 'aruco', `ArUco de la zona (${mm(zonaMarc[0].userData.lado)} mm)`, marcadores(zonaMarc, 0, 'zona'));
  }
  if (k === 'entrega') {
    add('aruco-entrega', 'aruco', `ArUco de la entrega (${mm(OBJ.arucoE[0].userData.lado)} mm)`, marcadores(OBJ.arucoE, 4, 'entrega'));
    add('aruco-bandeja', 'aruco', `ArUco de la bandeja (${mm(bandMarc[0].userData.lado)} mm)`, marcadores(bandMarc, 6, 'bandeja'));
    add('desenfoque', 'desenfoque', 'Bandeja en movimiento', de('bandeja').map((p, i) => punto(`bandeja, punto ${i + 1}`, p)));
  }
  if (k === 'persona') {
    // Pupilas: segmento horizontal de la cara (eje y de la persona); si la cámara ve la nuca, no se ven
    const frente = new THREE.Vector3(1, 0, 0).transformDirection(persona.matrixWorld), ipd = v3a(new THREE.Vector3(0, 1, 0).transformDirection(persona.matrixWorld));
    add('pupilas', 'pupilas', 'Cara: distancia entre pupilas', de('cara').map(p => { const g = punto('cara', p, 'segmento', { eje: ipd }); if (p.clone().sub(cp).dot(frente) >= 0) g.oculto = 'la cámara ve la cara de espaldas'; return g; }));
    const manos = [...de('mano dcha.'), ...de('mano izda.')].map((p, i) => punto(i ? 'mano izda.' : 'mano dcha.', p));
    add('mano', 'mano', 'Mano', manos); add('desenfoque', 'desenfoque', 'Bandeja en movimiento (las manos)', manos);
  }
  // Profundidad de campo: enfocada en el punto de mira; los objetivos son los que la cámara ve
  const aim = new THREE.Vector3(c.mira.x, c.mira.y, c.mira.z);
  const objetivos = pts.map(([n, p]) => punto(n, p)).filter(g => g.dentro).map(g => ({ nombre: g.nombre, prof: g.prof }));
  return { tareas: T, campo: TAREAS.evaluarCampo(TAREAS.profundidad(v3a(aim), o, eje), objetivos, cam, TAREAS_CFG) };
}
// Las filas de la tarjeta de la cámara k (dentro de su <dl class="kv">): cada tarea con sus píxeles, su estado, el origen del
// tamaño y el umbral con su fuente
function htmlTareas(k) {
  const { tareas, campo } = tareasCam(k), ctx = {}; // los tipos de «marcadores», «fruta» y «exposicion» no dependen del contexto
  const tag = t => `<span class="tag ${ORIGEN.CLASE[t] || 's'}">${t}</span>`, pxf = x => fmt(x, x < 10 ? 1 : 0);
  const umbral = u => `${u.texto} · ${u.origen === 'PLAN' ? 'PLAN: la cita no se ha podido comprobar' : 'SUPUESTO SIN VALIDAR'}`;
  const fila = (clave, dt, tipo, e, pillTxt, px, detalle) => `<div class="tarea" data-tarea="${clave}" data-px="${px ?? ''}" data-estado="${e}"><div><span>${dt} ${tag(tipo)}</span><span class="pill ${TAREAS.ESTADOS[e].cls}">${pillTxt}</span></div><span class="hint">${detalle}</span></div>`;
  return `<div class="tareas"><h4>Píxeles por tarea <span class="tag s">SIN VALIDAR</span></h4>` + tareas.map(t => {
    const r = t.res, def = TAREAS.DEF[t.id], tipo = def.clave ? ORIGEN.entrada(def.clave, ctx).tipo : 'SUPUESTO', e = TAREAS.ESTADOS[r.estado];
    const pill = r.px === null ? e.txt : `${pxf(r.px)} px${t.id === 'desenfoque' ? ' de desenfoque' : r.pxImagen !== r.px ? ' en la red' : ''} · ${e.txt}`;
    const peor = r.estado === 'fuera' ? 'ningún punto en el campo' : `peor: ${r.punto}${r.nFuera ? ` (${r.nFuera} de ${r.nPuntos} fuera del campo)` : ''}`;
    const img = r.px !== null && r.pxImagen !== r.px ? ` · ${pxf(r.pxImagen)} px en la imagen` : '';
    return fila(t.clave, t.titulo, tipo, r.estado, pill, r.px, `${peor}${img}${r.nota ? ' · ' + r.nota : ''} · ${fmt(r.mmpx, 2)} mm/px · ${umbral(r.umbral)}`);
  }).join('') + (() => {
    const cm = v => fmt(v * 100, 0), lejos = campo.lejos === Infinity ? '∞' : cm(campo.lejos);
    return fila('campo', 'Profundidad de campo', 'SUPUESTO', campo.estado, campo.total ? `${cm(campo.cerca)}–${lejos} cm · ${TAREAS.ESTADOS[campo.estado].txt}` : TAREAS.ESTADOS.fuera.txt, campo.total ? campo.cerca : null,
      `enfocada a ${cm(campo.enfoque)} cm (el punto de mira); ${campo.dentro} de ${campo.total} objetivos dentro${campo.fuera.length ? ': fuera ' + [...new Set(campo.fuera)].join(', ') : ''} · ${umbral(campo.umbral)}`);
  })() + '</div>';
}
function pintarTareasCfg() {
  $('#tareasCfgCuerpo').innerHTML = TAREAS.PARAMS.map(p => {
    const [g, n] = p.id.split('.'), plan = p.origen === 'PLAN';
    return `<div class="field"><label for="tc_${p.id}" title="${p.fuente}">${p.nombre} <span class="tag ${plan ? 'f' : 's'}">${plan ? 'PLAN' : 'SUPUESTO · SIN VALIDAR'}</span></label><output>${p.unidad}</output><input type="number" id="tc_${p.id}" min="0" step="any" value="${TAREAS_CFG[g][n]}"${p.editable ? '' : ' disabled'}></div>`;
  }).join('') + '<div class="btns"><button class="btn" id="btnTareasRestaurar">Restaurar los valores de partida</button></div>';
}
$('#tareasCfgCuerpo').addEventListener('input', e => {
  const id = e.target.id.startsWith('tc_') ? e.target.id.slice(3) : null; if (!id) return;
  try { TAREAS_CFG = TAREAS.fijar(TAREAS_CFG, id, e.target.valueAsNumber); e.target.removeAttribute('aria-invalid'); } catch { e.target.setAttribute('aria-invalid', 'true'); return; }
  clearTimeout(pintarCamaras._t); pintarCamaras._t = setTimeout(pintarCamaras, 120);
});
$('#tareasCfgCuerpo').addEventListener('click', e => { if (e.target.closest('#btnTareasRestaurar')) { TAREAS_CFG = TAREAS.cfgDefecto(); pintarTareasCfg(); pintarCamaras(); } });
pintarTareasCfg();
// Ancho de banda USB (T4.3, src/usb.js): formato, reserva y bus de cada cámara, suma por bus y la salida de `lsusb -v` pegada. Todo
// es de la sesión: no se guarda en la escena (I1, I2) y el texto pegado solo se analiza, no se envía a ningún sitio (I4)
let USB_CFG = USB.cfgDefecto(), USB_LSUSB = null, USB_FIRMA = '';
const USB_CAMS = {};
const usbCam = k => USB_CAMS[k] || (USB_CAMS[k] = { formato: 'mjpeg', reserva: USB.RESERVA_MAX, bus: 1, disp: '' });
const usbEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const usbTag = (t, c) => `<span class="tag ${c}">${t}</span>`, usbSupuesto = () => usbTag('SUPUESTO · SIN VALIDAR', 's');
const usbDispClave = d => `${d.bus}:${d.dispositivo}`;
const usbCamaras = () => USB_LSUSB ? USB.camarasDe(USB_LSUSB) : [];
// Las cámaras de la escena con su modo (MODOS, el de su tarjeta), su formato, su reserva y su bus
const usbEntradas = () => Object.keys(L.cams).map(k => { const st = usbCam(k), M = MODOS[L.cams[k].modo]; return { clave: k, bus: st.bus, formato: st.formato, w: M.w, h: M.h, fps: M.fps, reserva: st.reserva }; });
const usbFirma = () => JSON.stringify(Object.keys(L.cams).map(k => [k, L.cams[k].nombre, L.cams[k].modo])) + (USB_LSUSB ? 'lsusb' : '');
// Pinta los campos de cada cámara (formato, bus, reserva y, con lsusb, su dispositivo) y los resultados
function usbPintar() {
  const devs = usbCamaras(); USB_FIRMA = usbFirma();
  $('#usbCuerpo').innerHTML = Object.keys(L.cams).map(k => {
    const c = L.cams[k], st = usbCam(k);
    const disp = devs.length ? `<div class="row"><label class="hint" for="usb_disp_${k}" style="flex:none">Dispositivo</label><select id="usb_disp_${k}" style="flex:1;width:auto"><option value="">— sin elegir —</option>${devs.map(d => `<option value="${usbDispClave(d)}"${st.disp === usbDispClave(d) ? ' selected' : ''}>Bus ${d.bus} · dispositivo ${d.dispositivo} · ${usbEsc(d.nombre)} · ${fmt(d.reservaMax, 1)} Mbit/s</option>`).join('')}</select></div>` : '';
    return `<div class="usbcam" data-cam="${k}"><div><strong>Cámara ${usbEsc(c.nombre.toLowerCase())}</strong><span class="pill" data-usb="estado"></span></div>
      <div class="row"><label class="hint" for="usb_formato_${k}" style="flex:none">Formato</label><select id="usb_formato_${k}" style="flex:1;width:auto">${Object.entries(USB.FORMATOS).map(([id, f]) => `<option value="${id}"${id === st.formato ? ' selected' : ''}>${f.nombre}</option>`).join('')}</select>
        <label class="hint" for="usb_bus_${k}" style="flex:none">Bus</label><input type="number" id="usb_bus_${k}" min="1" step="1" value="${st.bus}" style="width:64px"></div>
      <div class="field"><label for="usb_reserva_${k}">Reserva (Mbit/s)</label><output>máx. ${fmt(USB.RESERVA_MAX, 1)}</output><input type="number" id="usb_reserva_${k}" min="0" max="${USB.RESERVA_MAX}" step="any" value="${st.reserva}"></div>
      ${disp}<span class="hint" data-usb="detalle"></span></div>`;
  }).join('');
  usbActualizar();
}
// Recalcula el aviso, el estado de cada cámara y la suma por bus sin tocar los campos (así no se pierde el foco al escribir)
function usbActualizar() {
  let r; try { r = USB.evaluarBuses(usbEntradas(), USB_CFG); } catch (e) { $('#usbAviso').textContent = `No se puede estimar: ${e.message}`; $('#usbBuses').innerHTML = ''; return; }
  const E = USB.ESTADOS, pct = x => `${fmt(x * 100, 0)} %`, malos = r.buses.filter(b => b.estado === 'no');
  $('#usbAviso').innerHTML = `<strong>Aviso: ${usbEsc(r.aviso.texto)}.</strong> ` + (malos.length ? malos.map(b => `Bus ${b.bus}: ${b.claves.length === 1 ? 'la cámara no cabe' : `las ${b.claves.length} cámaras no caben`} con sus reservas o su demanda (${fmt(Math.max(b.sumaReserva, b.sumaTasa), 1)} de ${fmt(b.capacidad, 1)} Mbit/s).`).join(' ') : 'Con las reservas y los buses de ahora ningún bus se pasa.');
  for (const c of r.camaras) {
    const el = $(`#usbCuerpo .usbcam[data-cam="${c.clave}"]`); if (!el) continue;
    const e = E[c.estado], M = MODOS[L.cams[c.clave].modo], pill = $('[data-usb="estado"]', el);
    pill.className = `pill ${e.cls}`; pill.textContent = `${fmt(c.tasa, 1)} Mbit/s · ${e.txt}`;
    Object.assign(el.dataset, { estado: c.estado, tasa: c.tasa, reserva: c.reserva, bus: c.bus });
    $('[data-usb="detalle"]', el).innerHTML = `${M.w}×${M.h} a ${M.fps} fps (el modo de su tarjeta) · demanda estimada ${fmt(c.tasa, 1)} Mbit/s = ${pct(c.uso)} de la reserva de ${fmt(c.reserva, 1)}`
      + (c.factorMin !== null ? ` · el MJPEG tendría que comprimir al menos ${fmt(c.factorMin, 1)}:1 para caber (supuesto: ${fmt(USB_CFG.mjpeg.factor, 1)}:1 ${usbSupuesto()})` : ' · sin comprimir: ancho × alto × bit por píxel del formato × fps')
      + (c.reserva === USB.RESERVA_MAX ? ` · reserva máxima ${usbTag('PLAN', 'f')}` : '');
  }
  $('#usbBuses').innerHTML = '<h4 style="margin:6px 0 0;font-size:12.5px;font-weight:600">Por bus</h4>' + r.buses.map(b => {
    const e = E[b.estado], libre = b.libre >= 0 ? `quedan ${fmt(b.libre, 1)}` : `faltan ${fmt(-b.libre, 1)}`;
    return `<div class="usbbus" data-bus="${b.bus}" data-estado="${b.estado}" data-suma="${b.sumaReserva}" data-tasa="${b.sumaTasa}"><div><span>Bus ${b.bus}: ${b.claves.map(k => usbEsc(L.cams[k].nombre.toLowerCase())).join(', ')}</span><span class="pill ${e.cls}">${fmt(b.sumaReserva, 1)} de ${fmt(b.capacidad, 1)} Mbit/s · ${e.txt}</span></div>
      <span class="hint">suma de las reservas ${fmt(b.sumaReserva, 1)} Mbit/s · suma de la demanda estimada ${fmt(b.sumaTasa, 1)} Mbit/s · capacidad ${fmt(b.capacidad, 1)} Mbit/s (${fmt(USB_CFG.bus.mbit, 0)} × ${fmt(USB_CFG.bus.periodico, 2)} ${usbSupuesto()}) · ${libre} Mbit/s de reserva</span></div>`;
  }).join('');
}
// La lista de dispositivos de `lsusb -v` y, por bus, la suma de las reservas máximas de sus cámaras
function usbPintarLsusb() {
  const r = USB_LSUSB, cont = $('#usbLsusbRes'); if (!r) { cont.innerHTML = ''; return; }
  const lista = r.dispositivos.map(d => {
    let det;
    if (!d.analizado) det = usbEsc(d.nota);
    else if (d.esVideo) { const v = d.endpoints.filter(e => e.clase === 14), mx = v.find(e => e.mbit === d.reservaMax); det = `cámara: reserva máxima ${fmt(d.reservaMax, 1)} Mbit/s (${mx.transacciones} × ${mx.tamano} B, bInterval ${mx.bInterval}; ${v.length} ${v.length === 1 ? 'ajuste isócrono' : 'ajustes isócronos'} de vídeo)`; }
    else det = d.endpoints.length ? 'endpoints isócronos que no son de vídeo' : 'sin endpoints isócronos de vídeo';
    return `<div class="usbdev" data-bus="${d.bus}" data-dispositivo="${d.dispositivo}" data-video="${d.esVideo}" data-reserva="${d.reservaMax ?? ''}"><span>Bus ${d.bus} · dispositivo ${d.dispositivo} · ${usbEsc(d.id)} · ${usbEsc(d.nombre) || 'sin nombre'}</span><span class="hint">${det}</span></div>`;
  }).join('');
  const porBus = new Map(); for (const d of usbCamaras()) porBus.set(d.bus, [...(porBus.get(d.bus) || []), d]);
  const cap = USB.capacidad(USB_CFG), buses = [...porBus.keys()].sort((a, b) => a - b).map(b => {
    const ds = porBus.get(b), suma = ds.reduce((s, d) => s + d.reservaMax, 0), cabe = suma <= cap * (1 + 1e-9);
    return `<div class="usbbus" data-lsusb-bus="${b}" data-estado="${cabe ? 'ok' : 'no'}" data-suma="${suma}"><div><span>Bus ${b}: ${ds.length} ${ds.length === 1 ? 'cámara' : 'cámaras'} con su reserva máxima</span><span class="pill ${cabe ? 'ok' : 'bad'}">${fmt(suma, 1)} de ${fmt(cap, 1)} Mbit/s · ${cabe ? 'cabe' : 'no cabe'}</span></div></div>`;
  }).join('');
  cont.innerHTML = lista + buses;
}
$('#btnUsbAnalizar').addEventListener('click', () => {
  const txt = $('#usbLsusbTxt'), msg = $('#usbLsusbMsg');
  try {
    const r = USB.parsearLsusb(txt.value), n = USB.camarasDe(r).length;
    USB_LSUSB = r; txt.removeAttribute('aria-invalid'); msg.setAttribute('role', 'status');
    msg.textContent = `Analizado: ${r.dispositivos.length} ${r.dispositivos.length === 1 ? 'dispositivo' : 'dispositivos'}, ${n} ${n === 1 ? 'cámara' : 'cámaras'} de vídeo en alta velocidad.${n ? '' : ' Ninguna cámara: ¿falta sudo, o son USB 3?'}`;
    const claves = usbCamaras().map(usbDispClave); for (const k in USB_CAMS) if (!claves.includes(USB_CAMS[k].disp)) USB_CAMS[k].disp = '';
    usbPintarLsusb(); usbPintar();
  } catch (e) {
    // Una entrada mal formada no cambia nada: ni el análisis anterior ni lo elegido en las cámaras
    txt.setAttribute('aria-invalid', 'true'); msg.setAttribute('role', 'alert'); msg.textContent = `No se ha aplicado nada: ${e.message}`;
  }
});
$('#btnUsbQuitar').addEventListener('click', () => {
  USB_LSUSB = null; for (const k in USB_CAMS) USB_CAMS[k].disp = '';
  $('#usbLsusbTxt').removeAttribute('aria-invalid'); $('#usbLsusbMsg').textContent = ''; usbPintarLsusb(); usbPintar();
});
// Campos de cada cámara: se aplican al escribir (los inválidos se marcan y no se aplican); elegir un dispositivo de lsusb le pone su bus y su reserva máxima
$('#usbCuerpo').addEventListener('input', usbCampo); $('#usbCuerpo').addEventListener('change', usbCampo);
function usbCampo(e) {
  const m = /^usb_(formato|reserva|bus|disp)_(.+)$/.exec(e.target.id || ''); if (!m || !L.cams[m[2]]) return;
  const [, que, k] = m, st = usbCam(k);
  if (que === 'disp' && e.type !== 'change') return;
  try {
    if (que === 'formato') { if (!Object.hasOwn(USB.FORMATOS, e.target.value)) throw new Error('formato desconocido'); st.formato = e.target.value; }
    else if (que === 'reserva') st.reserva = USB.validarReserva(e.target.valueAsNumber);
    else if (que === 'bus') { const b = e.target.valueAsNumber; if (!Number.isInteger(b) || b < 1) throw new Error('el bus es un número entero desde 1'); st.bus = b; }
    else {
      const d = usbCamaras().find(x => usbDispClave(x) === e.target.value);
      if (e.target.value !== '' && !d) throw new Error('dispositivo desconocido');
      st.disp = e.target.value; if (d) { st.bus = d.bus; st.reserva = Math.min(d.reservaMax, USB.RESERVA_MAX); }
    }
    e.target.removeAttribute('aria-invalid'); e.target.removeAttribute('title');
  } catch (err) { e.target.setAttribute('aria-invalid', 'true'); e.target.title = err.message; return; }
  if (que === 'disp') usbPintar(); else usbActualizar();
}
function pintarUsbCfg() {
  $('#usbCfgCuerpo').innerHTML = USB.PARAMS.map(p => {
    const [g, n] = p.id.split('.'), plan = p.origen === 'PLAN';
    return `<div class="field"><label for="uc_${p.id}" title="${usbEsc(p.fuente)}">${usbEsc(p.nombre)} <span class="tag ${plan ? 'f' : 's'}">${plan ? 'PLAN' : 'SUPUESTO · SIN VALIDAR'}</span></label><output>${usbEsc(p.unidad)}</output><input type="number" id="uc_${p.id}" min="0" step="any" value="${USB_CFG[g][n]}"${p.editable ? '' : ' disabled'}></div>`;
  }).join('');
}
$('#usbCfgCuerpo').addEventListener('input', e => {
  const id = e.target.id.startsWith('uc_') ? e.target.id.slice(3) : null; if (!id) return;
  try { USB_CFG = USB.fijar(USB_CFG, id, e.target.valueAsNumber); e.target.removeAttribute('aria-invalid'); } catch { e.target.setAttribute('aria-invalid', 'true'); return; }
  usbActualizar(); usbPintarLsusb();
});
$('#btnUsbRestaurar').addEventListener('click', () => { USB_CFG = USB.cfgDefecto(); for (const k of Object.keys(USB_CAMS)) delete USB_CAMS[k]; pintarUsbCfg(); usbPintar(); usbPintarLsusb(); });
pintarUsbCfg();
// pintarCamaras lo llama: rehace los campos si cambia la lista de cámaras o algún modo; si no, solo recalcula
function usbRefrescar() { if (usbFirma() !== USB_FIRMA || !$('#usbCuerpo').firstElementChild) usbPintar(); else usbActualizar(); }
function pintarCamaras() {
  $('#camCards').innerHTML = Object.keys(L.cams).map(k => {
    const c = L.cams[k], m = metricasCam(k); const gp = c.grupo === 'V1' ? 'v1' : 'v2';
    const visCls = m.dentro === m.total && !m.tapados.length ? 'ok' : (m.dentro >= m.total * 0.6 ? 'warn' : 'bad');
    const minC = D.minCam[k]; const libre = Math.min(m.libre, minC ?? Infinity);
    return `<div class="card ${sel && sel.cam === k ? 'sel' : ''}" data-cam="${k}"><header><h3>Cámara ${c.nombre.toLowerCase()}</h3><span class="pill ${gp}">${c.grupo === 'V1' ? 'Visión 1' : 'Visión 2'}</span></header>
    <div class="field"><label for="f_${k}">Focal (zoom de la lente)</label><output>${fmt(c.f, 1)} mm</output><input type="range" id="f_${k}" min="3.6" max="10" step="0.1" value="${c.f}"></div>
    ${slidersOrient(k, 'co')}
    <div class="row"><label class="hint" for="m_${k}" style="flex:none">Modo</label><select id="m_${k}" style="flex:1;width:auto">${Object.keys(MODOS).map(x => `<option ${x === c.modo ? 'selected' : ''} value="${x}">${x.replace('x', '×')} · ${MODOS[x].fps} fps${MODOS[x].w / MODOS[x].h < 1.5 ? ' · 4:3' : ''}</option>`).join('')}</select></div>
    <dl class="kv"><dt>Campo de visión <span class="tag s">SIN VALIDAR</span></dt><dd>${fmt(m.hf * R2D, 0)}° × ${fmt(m.vf * R2D, 0)}°</dd><dt>Altura sobre la mesa</dt><dd>${mm(m.alt)} mm</dd><dt>Resolución en el punto de mira <span class="tag s">SIN VALIDAR</span></dt><dd>${fmt(m.mmpx, 2)} mm/px</dd>
    </dl>${htmlTareas(k)}<dl class="kv">
    <dt>Ve sus objetivos</dt><dd><span class="pill ${visCls}">${m.dentro}/${m.total}</span>${m.fuera.length ? ' fuera: ' + [...new Set(m.fuera)].join(', ') : ''}${m.tapados.length ? ' · tapados por el brazo: ' + [...new Set(m.tapados)].join(', ') : ''}</dd>
    <dt>Brazo Manfrotto 244</dt><dd><span class="pill ${m.brazoOK ? 'ok' : 'bad'}">${mm(m.brazoD)} de 530 mm</span></dd>
    <dt>Holgura con el UR3e</dt><dd><span class="pill ${libre > 0.08 ? 'ok' : libre > 0.02 ? 'warn' : 'bad'}">${libre === Infinity ? '—' : mm(Math.max(0, libre)) + ' mm'}</span>${minC !== undefined ? ' mínima en la demo' : ' ahora'}</dd></dl>
    ${m.nota ? `<p class="hint">Modo ${c.modo.replace('x', '×')}: ${m.nota}.</p>` : ''}
    <div class="btns"><button class="btn" data-act="sel">Mover</button><button class="btn" data-act="ver">Ver por esta cámara</button></div></div>`;
  }).join('') + `<p class="hint">Píxeles por tarea: proyección estenopeica en el peor punto visible de cada objetivo, con el escorzo del plano o del segmento. Los umbrales del ArUco son los del plan (14 px de mínimo en OpenCV 4.6, zona fiable de 32 a 50 px; la cita no se ha podido comprobar aquí); el resto de umbrales, tamaños y supuestos no tienen fuente comprobable: SIN VALIDAR y editables en «Umbrales y supuestos de las tareas» (solo de esta sesión). El campo de visión y los mm/px son de lente ideal con el sensor «${SENSOR.de(sensorEscena()).nombre}» [SIN VALIDAR]: el real se mide en la calibración intrínseca (camera_info, F4).</p>`;
  pintarSensor(); usbRefrescar();
}
// Selector del modelo de sensor (T1.7): cambia el campo de visión, el frustum, las miniaturas y las métricas; no mueve nada
function pintarSensor() {
  const s = sensorEscena(), m = SENSOR.de(s); $$('#segSensor button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === s));
  $('#sensorNota').textContent = `Sensor de la escena: ${m.nombre}, ${fmt(m.w, 3)} × ${fmt(m.h, 3)} mm (${m.origen}). Ancho completo en todos los modos (Sony); el alto, el que deja la relación de aspecto del modo. Las escenas nuevas usan la ficha de la ELP y las v8, el de la v8.`;
}
$('#segSensor').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !SENSOR.NOMBRES.includes(b.dataset.v) || b.dataset.v === L.sensor) return;
  if (soloLectura()) { toast('Disposición de solo lectura (versión más nueva): no se cambia el sensor'); return; }
  L.sensor = b.dataset.v; for (const k in L.cams) actualizarCam(k); guardarLocal(); pintarCamaras(); if (!$('[data-panel="datos"]').hidden) pintarDatos();
  toast(`Sensor: ${SENSOR.de(L.sensor).nombre}. Cambian el campo de visión y los mm/px; no se mueve nada`);
});
$('#camCards').addEventListener('input', e => {
  const id = e.target.id; if (!id || /^(so|co)(pan|tilt|roll)_/.test(id)) return; const [t, k] = id.split('_'); if (!L.cams[k]) return;
  if (t === 'f') L.cams[k].f = +e.target.value; if (t === 'm') L.cams[k].modo = e.target.value;
  actualizarCam(k); guardarLocal(); clearTimeout(pintarCamaras._t); pintarCamaras._t = setTimeout(pintarCamaras, 120);
});
$('#camCards').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b) return; const k = b.closest('[data-cam]').dataset.cam; if (b.dataset.act === 'sel') { $$('.tabs button')[0].click(); seleccionar('cam:' + k); } else { verCam = k; $('#camMode').hidden = false; $('#camModeTxt').textContent = `Viendo por la cámara ${L.cams[k].nombre.toLowerCase()}`; pintarPip(); } });

// ======================= Alcance: tabla y gráfica =======================
function actualizarTablaAlcance() {
  if (!robot) return; const r = radioA(ALC.h);
  $('#alcTxt').textContent = r && r.rmax !== null ? `A ${fmt(ALC.h * 100, 1)} cm sobre la mesa, la punta de la pinza vertical llega entre ${mm(r.rmin)} y ${mm(r.rmax)} mm del eje de la base.` : `A ${fmt(ALC.h * 100, 1)} cm sobre la mesa no hay ningún punto alcanzable con la pinza vertical.`;
  const hS = Math.round((zPlato() - MESA.h + 0.09) * 100);
  const filas = [['Zona de fruta', '3,5 cm', estadoObjeto('zona')], ['Plato 1º', `${hS} cm y borde`, estadoObjeto('plato1')], ['Plato 2º', `${hS} cm y borde`, estadoObjeto('plato2')], ['Zonas de la bandeja', `${fmt((poseBandeja(simT).z - MESA.h + 0.022) * 100, 0)} cm`, estadoObjeto('persona')]];
  $('#alcTbl tbody').innerHTML = filas.map(([n, h, e]) => `<tr><td>${n}<br><span class="hint">${e.txt}</span></td><td>${h}</td><td><span class="pill ${['bad', 'warn', 'ok'][e.cls]}">${e.pend ? 'sin calcular' : ['no llega', 'justo', 'holgado'][e.cls]}</span></td></tr>`).join('');
  dibujarGrafica();
}
function dibujarGrafica() {
  const svg = $('#chartAlc'); if (!perfilAlc) return; const W = 340, H = 190, l = 40, r = 12, t = 12, b = 30;
  const X = v => l + v / 0.6 * (W - l - r), Y = h => H - b - h / 0.4 * (H - t - b);
  const ok = perfilAlc.filter(p => p.rmax !== null);
  const area = ok.map(p => `${X(p.rmax)},${Y(p.h)}`).join(' ') + ' ' + ok.slice().reverse().map(p => `${X(p.rmin)},${Y(p.h)}`).join(' ');
  const ink = css('--muted'), acc = css('--accent'), tape = css('--tape'), line = css('--line');
  let s = '';
  for (const v of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) s += `<line x1="${X(v)}" y1="${t}" x2="${X(v)}" y2="${H - b}" stroke="${line}" stroke-width="1"/><text x="${X(v)}" y="${H - b + 14}" text-anchor="middle">${v * 100}</text>`;
  for (const h of [0, 0.1, 0.2, 0.3, 0.4]) s += `<line x1="${l}" y1="${Y(h)}" x2="${W - r}" y2="${Y(h)}" stroke="${line}" stroke-width="1"/><text x="${l - 6}" y="${Y(h) + 3}" text-anchor="end">${h * 100}</text>`;
  s += `<polygon points="${area}" fill="${acc}" fill-opacity="0.22" stroke="${acc}" stroke-width="1.6"/>`;
  s += `<line x1="${X(0.5)}" y1="${t}" x2="${X(0.5)}" y2="${H - b}" stroke="${ink}" stroke-dasharray="4 3"/><text x="${X(0.5) - 3}" y="${t + 9}" text-anchor="end">500 mm fabricante</text>`;
  s += `<line x1="${l}" y1="${Y(ALC.h)}" x2="${W - r}" y2="${Y(ALC.h)}" stroke="${tape}" stroke-width="2"/>`;
  s += `<text x="${(l + W - r) / 2}" y="${H - 2}" text-anchor="middle">distancia al eje de la base (cm)</text><text transform="translate(10,${(t + H - b) / 2}) rotate(-90)" text-anchor="middle">altura (cm)</text>`;
  svg.innerHTML = s;
}
$('#hAlc').addEventListener('input', e => { ALC.h = e.target.value / 100; $('#hAlcOut').textContent = `${fmt(+e.target.value, 1)} cm`; clearTimeout(ALC.t); ALC.t = setTimeout(calcularMapa, 120); actualizarTablaAlcance(); });
$$('[data-h]').forEach(b => b.addEventListener('click', () => { let h = b.dataset.h === 'tray' ? Math.round((poseBandeja(simT).z - MESA.h + 0.022) * 200) / 2 : b.dataset.h === 'plato' ? Math.round((zPlato() - MESA.h + 0.09) * 200) / 2 : +b.dataset.h; h = clamp(h, 0, 40); $('#hAlc').value = h; $('#hAlc').dispatchEvent(new Event('input')); }));

// ======================= Datos: YAML, importar, propuestas =======================
// posiciones.yaml (T1.5, I7): todo en el base_link del robot elegido con la conversión de la planificación (enBase), en
// metros y radianes, con redondeo fijo de 1 mm y 0,001 rad (EXPORTAR.r3 y rad3) y el origen de cada valor al final de su línea
// El origen de cada valor (T2.1) sale de ORIGEN (src/origen.js) con este contexto: el robot cuya cinemática se usa, su giro,
// el sensor de la escena y el TCP de la pinza cerrada
function ctxOrigen() { const s = sensorEscena(); return { robotId: ROB.id, sospechoso: !!ROB.datos.sospechoso, yaw: ROB.yaw, sensor: { id: s, ...SENSOR.de(s) }, tcpZ: pinza.tcpZ(0) }; }
// Modelo de exportación (T2.2–T2.4, decisión 1 de su brief): todo lo que exportan los ficheros, calculado una vez, sin
// redondear y en base_link con la conversión de la planificación (enBase, marco()). Un objeto plano, serializable con JSON,
// con el contexto de origen (ctx) y la disposición (layoutJson). Lo convierte en texto src/exportar.js (EXPORTAR), que no ve
// nada del gemelo: posiciones.yaml, parametros_celda.yaml y las TF estáticas salen de los mismos números.
function modeloExportacion() {
  const v = p => ({ x: p.x, y: p.y, z: p.z }), B = o => v(enBase({ x: o.x, y: o.y, z: o.z ?? MESA.h }));
  // La bandeja en su pose de plan (poseBandejaPlan) y sus zonas llevadas a ella con su posición en la bandeja, la de su TF
  // (DT35): durante la demo, la bandeja dibujada se balancea y lo exportado no la sigue
  const tp = poseBandejaPlan(), enPlan = l => ({ x: tp.x + Math.cos(tp.yaw) * l.x - Math.sin(tp.yaw) * l.y, y: tp.y + Math.sin(tp.yaw) * l.x + Math.cos(tp.yaw) * l.y, z: tp.z + l.z });
  const id = ROB.id, d = ROB.datos, pf = L.prefijoFrames || '';
  // Una disposición de solo lectura puede traer un robot que esta versión no conoce: se dice y se usa el nominal (corrección 5)
  const doble = pf && d.doble ? { nombre: d.doble.fichero.split('/').pop().replace('.urdf.xacro', ''), x: d.doble.x, y: d.doble.y, z: 0, yaw: d.doble.yaw - PI } : null;
  const mc = B({ x: 0, y: 0 }), zf = B(L.zona), bt = B(tp), pe = B(L.persona);
  // orient: giro (desde +y hacia +x), inclinación (positiva hacia abajo) y alabeo, en base_link (orientDe). rpy: el marco del
  // cuerpo de la cámara (REP-103: x hacia donde mira, y a la izquierda, z arriba) con setRPY. La cámara de three mira con lookAt
  // (y horizontal) y gira la imagen con rotateZ(alabeo) sobre su +z, que apunta hacia atrás: en el cuerpo es −alabeo en x.
  // px y vfov: el modo y el campo vertical de la cámara de render (camera_info, T2.5); usb: dispositivo, exposición (en
  // unidades de 100 µs de V4L2) y balance de blancos (K) de usb_cam, supuestos (ORIGEN: dispositivo_video, exposicion y
  // balance_blancos).
  const camaras = Object.keys(L.cams).map((k, i) => {
    const c = L.cams[k], o = orientDe({ pos: B(c.pos), mira: B(c.mira), roll: c.roll }), md = MODOS[c.modo];
    return { clave: k, grupo: c.grupo, modelo: 'ELP-USB12MP01-UFV', focal: c.f, modo: c.modo, hfov: hfovDe(c), vfov: vfovDe(c), px: { w: md.w, h: md.h, fps: md.fps }, pos: B(c.pos), mira: B(c.mira), clamp: B(c.clamp), orient: { pan: o.pan, tilt: o.tilt, roll: o.roll }, rpy: [-o.roll, o.tilt, PI / 2 - o.pan], usb: { dispositivo: `/dev/video${2 * i}`, exposicion: 50, balance: 4000 } };
  });
  return {
    ctx: ctxOrigen(), layoutJson: JSON.stringify(L),
    robot: { posicion: L.robot, id, idLayout: L.robotId, desconocido: L.robotId !== id, sospechoso: !!d.sospechoso, yaw: ROB.yaw, prefijo: pf, frame: `${pf}base_link`, worldABase: { x: 0, y: 0, z: 0 }, doble },
    pinza: { modelo: 'OnRobot RG2', tcpZ: pinza.tcpZ(0), carrera: RG2.carrera },
    mesa: { ancho: MESA.w, fondo: MESA.d, alto: MESA.h, ...mc, yaw: yawABase(0) },
    pedido: L.pedido,
    platos: { sobreCaja: L.caja.on, cajaAlto: L.caja.h, cajaLado: CAJA_LADO, agarre: 'horizontal_por_el_borde', radioAgarre: R_AGARRE, lista: ['plato1', 'plato2'].map(pk => ({ clave: pk.replace('plato', 'plato_'), ...B({ x: L[pk].x, y: L[pk].y, z: zPlato() }) })) },
    zona: { ...zf, yaw: yawABase(L.zona.yaw), ancho: L.zona.w, fondo: L.zona.d },
    // marcadores de entrega: planos sobre la mesa y con sus ejes (OBJ.arucoE no gira), de 6 cm (aruco(4 + i, 0.06))
    marcadores: L.arucoE.map((a, i) => ({ id: 4 + i, diccionario: 'DICT_4X4_50', lado: 0.06, ...B(a), yaw: yawABase(0) })),
    bandeja: { ...bt, yaw: yawABase(tp.yaw), zonas: ['zona_primero', 'zona_segundo', 'zona_centro'].map(k => ({ clave: k, base: B(enPlan(zonasB[k].position)), local: v(zonasB[k].position) })) }, // zona_centro siempre (DT36)
    persona: { ...pe, yaw: yawABase(L.persona.yaw) },
    camaras,
    escena: escenaExportacion(B, mc, bt, yawABase(tp.yaw), camaras),
  };
}
// Escena de colisión (T2.3, decisión 2 de su brief): los objetos de obstaculos() que se exportan, sin márgenes de roce, en
// base_link y sin redondear. La mesa y los platos, desde la disposición; las cajas, la bandeja y cada cámara con su brazo,
// desde obstaculos() (el modelo de colisión del gemelo). La bandeja, en su pose de plan (poseBandeja(0), la de su TF), con la
// caja de obstaculos() en su marco. Fuera: la persona, la fruta, la zona de fruta y el otro robot (lo dice la cabecera).
// giro de cada caja: 'plan' (el del agarre de un plan al día), 'base' (el provisional, hacia la base) o 'calculo' (a medias)
const HOLGURA_MESA = 0.001; // la cara de arriba de la mesa, 1 mm por debajo de base_link (como el suelo del profesor)
function escenaExportacion(B, mc, bt, yawBandeja, camaras) {
  const obs = obstaculos(), deTag = t => obs.filter(o => o.tag === t), P = o => ({ x: o.x, y: o.y, z: o.z });
  const grosor = Math.max(...platoPts.map(p => p[1])); // el perfil del plato dibujado (lathe)
  const objetos = [{ id: 'mesa', que: 'mesa', pose: { ...mc, rpy: [0, 0, yawABase(0)] }, formas: [{ tipo: 'caja', dims: [MESA.w, MESA.d, MESA.h], local: { x: 0, y: 0, z: -HOLGURA_MESA - MESA.h / 2 } }] }];
  const giroCaja = (pk, yaw) => {
    for (const pf of [PERFIL_EXPLORA, perfilEscena()]) { const pl = planAlDia(pk, pf) && cachePlan(pf)[pk].pl; if (pl && Math.abs(angDiff(pl.yaw, yaw)) < 1e-9) return 'plan'; }
    const b = BASES[L.robot]; return Math.abs(angDiff(Math.atan2(L[pk].y - b.y, L[pk].x - b.x), yaw)) < 1e-9 ? 'base' : 'calculo';
  };
  for (const n of ['1', '2']) for (const o of deTag(`caja:plato${n}`)) objetos.push({ id: `caja_plato_${n}`, que: 'caja', giro: giroCaja(`plato${n}`, OBJ['caja' + n].rotation.z), pose: { ...P(o), rpy: [0, 0, Math.atan2(o.s, o.c)] }, formas: [{ tipo: 'caja', dims: [2 * o.hx, 2 * o.hy, 2 * o.hz] }] });
  for (const pk of ['plato1', 'plato2']) if (pk === 'plato1' || L.pedido !== 1) objetos.push({ id: pk.replace('plato', 'plato_'), que: 'plato', pose: { ...B({ x: L[pk].x, y: L[pk].y, z: zPlato() }), rpy: [0, 0, yawABase(0)] }, formas: [{ tipo: 'cilindro', radio: PLATO_R, altura: grosor, local: { x: 0, y: 0, z: grosor / 2 } }] });
  { // la caja de la bandeja en el marco de la bandeja de ahora (la que usa obstaculos()), llevada a la pose de plan
    const o = deTag('bandeja')[0], cur = B(bandeja.position), yc = yawABase(bandeja.rotation.z), dx = o.x - cur.x, dy = o.y - cur.y;
    const local = { x: Math.cos(yc) * dx + Math.sin(yc) * dy, y: -Math.sin(yc) * dx + Math.cos(yc) * dy, z: o.z - cur.z };
    objetos.push({ id: 'bandeja', que: 'bandeja', pose: { ...bt, rpy: [0, 0, yawBandeja] }, formas: [{ tipo: 'caja', dims: [2 * o.hx, 2 * o.hy, 2 * o.hz], local }] });
  }
  for (const k of camaras) objetos.push({ id: `camara_${k.clave}`, que: 'camara', pose: { ...k.pos, rpy: k.rpy }, formas: deTag(`camara:${k.clave}`).map(o => o.t === 1 ? { tipo: 'esfera', radio: o.r, centro: P(o) } : { tipo: 'capsula', radio: o.r, a: { x: o.ax, y: o.ay, z: o.az }, b: { x: o.cx, y: o.cy, z: o.cz } }) });
  return { objetos };
}
function generarYaml(m = modeloExportacion()) { return EXPORTAR.posiciones(m, ORIGEN, new Date().toISOString().slice(0, 10)); }
// Ficheros de ROS de la disposición actual: [{ nombre, texto }] en orden fijo, deterministas (sin fecha): los de T2.2 + T2.4,
// los de la escena (T2.3) y los de las cámaras (T2.5). Los muestra y descarga la sección «Exportar a ROS» (T2.6) y los leen
// los tests con window.__g.ficherosRos()
function ficherosRos(m = modeloExportacion()) { return EXPORTAR.todos(m, ORIGEN); }
// posiciones.yaml, la tabla de fuentes y la sección «Exportar a ROS», con un mismo modelo de exportación
function pintarDatos() { const m = modeloExportacion(); $('#yaml').value = generarYaml(m); pintarFuentes(); pintarRos(m); }
$('#btnCopy').addEventListener('click', async () => { const t = $('#yaml'); try { await navigator.clipboard.writeText(t.value); toast('Copiado'); } catch (e) { t.focus(); t.select(); toast('Selecciona y copia con Ctrl+C'); } });

// ======================= Exportar a ROS (T2.6) =======================
// Sección «Exportar a ROS» del panel «Datos» (decisiones 1, 4 y 5 del brief de T2.6): los ficheros de ficherosRos() de la
// disposición abierta, en su orden y agrupados por carpeta (cada tramo seguido de ficheros de una misma carpeta, bajo su
// nombre), cada uno con Ver, Copiar y Descargar, y «Descargar todo (.tar)», con todos bajo celda_ros/ (EXPORTAR.tar). Solo
// genera texto y descargas: no habla con ROS (I4). Se repinta con pintarDatos: al abrir el panel, al cambiar el prefijo o el
// robot (aplicarLayout) y al terminar un cálculo (evaluar). Nunca calcula planes. Lo que se ve, se copia y se descarga sale
// de la misma llamada a modeloExportacion() que da el giro de las cajas (DT38). Mientras se calcula (CALC.activo, también al
// validar) o se busca una disposición (D.buscando: L es un candidato), «Descargar» y «Descargar todo» están desactivados;
// pintarCalc lo vigila (vigilarRos) y, al terminar, la sección se repinta con la disposición de ahora y los reactiva.
const RAIZ_TAR = 'celda_ros';
// Para qué sirve cada fichero, en una línea (las TF dicen su arista: el padre y el hijo de su propio texto)
const aristaTF = t => { const p = /^ {4}frame_id: '([^']*)'/m.exec(t), h = /^ {4}child_frame_id: '([^']*)'/m.exec(t); return p && h ? `${p[1]} → ${h[1]}` : null; };
const QUE_ROS = [
  [/^parametros_celda\.yaml$/, () => 'Poses y medidas de la celda, para --params-file'],
  [/^tf\/(.+)\.yaml$/, (m, t) => `TF estática ${aristaTF(t) || `hacia ${m[1]}`}`],
  [/^tf_estaticas\.sh$/, () => 'Todas las TF con static_transform_publisher (bash)'],
  [/^escena_colision\.yaml$/, () => 'CollisionObject para un nodo del grupo (no se carga en U4)'],
  [/^celda\.scene$/, () => 'Escena de MoveIt en world: load_geometry_from_file o RViz'],
  [/^celda\.scene\.txt$/, () => 'Explica celda.scene: su world, cómo cargarla y el origen'],
  [/^camera_info\/(.+)\.yaml$/, () => 'Intrínseca nominal, para ~/.ros/camera_info/'],
  [/^usb_cam\/(.+)\.yaml$/, () => 'Parámetros de usb_cam: frame_id, camera_info_url y exposición'],
];
function queEsRos(f) { for (const [re, t] of QUE_ROS) { const m = re.exec(f.nombre); if (m) return t(m, f.texto); } return 'Fichero de ROS de la disposición'; }
const nombreDescarga = n => n.replace(/\//g, '_'); // un navegador no descarga carpetas: tf/mesa.yaml → tf_mesa.yaml (el .tar las conserva)
const rosOcupado = () => CALC.activo ? 'calculo' : D.buscando ? 'busqueda' : null;
// Giro de las cajas de la escena (DT38), del modelo que da los ficheros: 'plan', 'base', 'calculo' o 'sin-cajas'
function giroCajas(m) { const g = new Set(m.escena.objetos.filter(o => o.que === 'caja').map(o => o.giro || 'calculo')); return !g.size ? 'sin-cajas' : g.has('calculo') ? 'calculo' : g.has('base') ? 'base' : 'plan'; }
const TXT_GIRO = {
  plan: ['ok', 'giro del plan', 'Las cajas de los platos llevan el giro del plan: el del agarre que eligió el gemelo al calcular las trayectorias.'],
  base: ['warn', 'giro provisional', 'Las cajas llevan el giro provisional, hacia la base del robot, porque las trayectorias no están al día. «Calcular trayectorias» pone el del plan.'],
  calculo: ['warn', 'giro a medias', 'Las cajas llevan el giro de un cálculo a medias, que ningún plan usa. «Calcular trayectorias» pone el del plan.'],
  'sin-cajas': ['ok', 'sin cajas', 'Los platos van sobre la mesa: la escena no lleva cajas.'],
};
const TXT_OCUPADO = {
  calculo: ['calculando', 'Hay un cálculo de trayectorias en marcha: «Descargar» y «Descargar todo» se activan cuando termine, porque las cajas llevarían un giro que ningún plan usa. «Ver» y «Copiar» enseñan lo que hay ahora.'],
  busqueda: ['buscando', 'Hay una búsqueda de una disposición en marcha: «Descargar» y «Descargar todo» se activan cuando termine, porque los ficheros serían los de una disposición candidata. «Ver» y «Copiar» enseñan lo que hay ahora.'],
};
function pintarRos(m = modeloExportacion()) {
  const F = ficherosRos(m), lista = listaRos(F); // la lista solo se vuelve a escribir si cambia (nombres o líneas de las TF)
  Object.assign(ROSX, { m, ficheros: F, huella: EXPORTAR.huella(m.layoutJson), giro: giroCajas(m) });
  $('#rosHuella').textContent = ROSX.huella; $('#rosFrame').textContent = m.robot.frame; $('#rosCuenta').textContent = String(F.length);
  $('#rosTarTxt').innerHTML = `Se descarga como <code>${RAIZ_TAR}_${ROSX.huella}.tar</code>: los ${F.length} ficheros bajo <code>${RAIZ_TAR}/</code>, con sus carpetas. «Descargar» de un fichero suelto cambia «/» por «_» en su nombre (<code>tf/mesa.yaml</code> → <code>tf_mesa.yaml</code>).`;
  if (lista !== ROSX.lista) { ROSX.lista = lista; $('#rosLista').innerHTML = lista; }
  verRos(ROSX.ver);
  pintarRosEstado(rosOcupado());
}
// La lista: un grupo por tramo seguido de ficheros de una misma carpeta, en el orden de ficherosRos()
function listaRos(F) {
  const grupos = [];
  for (const f of F) { const i = f.nombre.lastIndexOf('/'), c = f.nombre.slice(0, i + 1), g = grupos[grupos.length - 1]; if (g && g.c === c) g.f.push(f); else grupos.push({ c, f: [f] }); }
  const fila = (f, c) => { const n = esc(f.nombre); return `<li data-nombre="${n}"><code>${esc(f.nombre.slice(c.length)).replace(/_/g, '_<wbr>')}</code><div class="btns"><button class="btn" data-ros="ver" aria-label="Ver ${n}">Ver</button><button class="btn" data-ros="copiar" aria-label="Copiar ${n}">Copiar</button><button class="btn" data-ros="dl" aria-label="Descargar ${n}" title="Se descarga como ${esc(nombreDescarga(f.nombre))}">Descargar</button></div><small>${esc(queEsRos(f))}</small></li>`; };
  return grupos.map(g => `<div class="rosGrupo" data-carpeta="${esc(g.c)}"><h3><code>${RAIZ_TAR}/${esc(g.c)}</code></h3><ul class="props rosLista">${g.f.map(f => fila(f, g.c)).join('')}</ul></div>`).join('');
}
// La línea del estado (el giro de las cajas o lo que está en marcha) y las descargas, activas o no
function pintarRosEstado(oc) {
  ROSX.ocupado = oc; const el = $('#rosEstado'), [cls, tag, txt] = oc ? ['warn', ...TXT_OCUPADO[oc]] : TXT_GIRO[ROSX.giro];
  el.dataset.giro = ROSX.giro; el.dataset.ocupado = oc || ''; el.innerHTML = `<span class="pill ${cls}">${tag}</span> ${txt}`;
  $$('#btnRosTar, #rosLista [data-ros="dl"]').forEach(b => { b.disabled = !!oc; });
}
// Desde pintarCalc (al empezar, durante y al terminar un cálculo, y cada 18 fotogramas): si cambia lo que está en marcha y
// el panel está a la vista, desactiva las descargas o, al terminar, repinta la sección con la disposición de ahora
function vigilarRos() {
  const oc = rosOcupado(); if (oc === ROSX.ocupado || !ROSX.m || $('[data-panel="datos"]').hidden) return;
  if (oc) pintarRosEstado(oc); else pintarRos();
}
// «Ver»: el fichero en el textarea de solo lectura de la sección (nombre null: lo cierra)
function verRos(nombre, mostrar = false) {
  const f = nombre ? ROSX.ficheros.find(x => x.nombre === nombre) : null; ROSX.ver = f ? f.nombre : null;
  $('#rosVerCaja').hidden = !f; $('#rosVer').value = f ? f.texto : ''; $('#rosVerNombre').textContent = f ? `${f.nombre} · solo lectura` : '';
  $$('#rosLista li').forEach(li => li.setAttribute('aria-current', String(li.dataset.nombre === ROSX.ver)));
  if (f && mostrar) $('#rosVerCaja').scrollIntoView({ block: 'nearest' });
  return f;
}
// «Copiar»: al portapapeles o, si no hay, el fichero seleccionado en el textarea para copiarlo a mano (como #btnCopy)
async function copiarRos(nombre) {
  const f = ROSX.ficheros.find(x => x.nombre === nombre); if (!f) return;
  try { await navigator.clipboard.writeText(f.texto); toast(`Copiado: ${f.nombre}`); } catch (e) { verRos(nombre, true); const t = $('#rosVer'); t.focus(); t.select(); toast('Selecciona y copia con Ctrl+C'); }
}
// Las descargas vuelven a leer la disposición (pintarRos) para bajar justo lo que se ve; nunca durante un cálculo o una búsqueda
function puedeDescargarRos() { const oc = rosOcupado(); if (oc) { pintarRosEstado(oc); toast(oc === 'calculo' ? 'Espera a que termine el cálculo para descargar' : 'Espera a que termine la búsqueda para descargar'); return false; } pintarRos(); return true; }
$('#rosLista').addEventListener('click', e => {
  const b = e.target.closest('button[data-ros]'), li = b && b.closest('li[data-nombre]'); if (!li) return; const n = li.dataset.nombre;
  if (b.dataset.ros === 'ver') verRos(n, true);
  else if (b.dataset.ros === 'copiar') copiarRos(n);
  else if (puedeDescargarRos()) { const f = ROSX.ficheros.find(x => x.nombre === n); if (f) descargar(nombreDescarga(f.nombre), f.texto); else toast('Ese fichero ya no está en la disposición'); }
});
$('#btnRosTar').addEventListener('click', () => {
  if (!puedeDescargarRos()) return; let bytes;
  try { bytes = EXPORTAR.tar(ROSX.ficheros, RAIZ_TAR); } catch (e) { toast(`No se ha podido crear el .tar: ${e.message}`); return; }
  descargar(`${RAIZ_TAR}_${ROSX.huella}.tar`, new Blob([bytes], { type: 'application/x-tar' }));
});
// @@ESCENAS@@
let DL = null, DB = null, USER = null;
const C = window.claude;
if (C && C.use) {
  C.use('downloads').then(d => { DL = d; }).catch(() => { });
  Promise.all([C.use('user').catch(() => null), C.use('db').catch(() => null)]).then(([u, db]) => { USER = u; DB = db; iniciarEscenas(); });
} else iniciarEscenas();
async function descargar(nombre, data) {
  if (!DL) { // fuera de claude.ai (página propia): descarga normal del navegador
    try { const b = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); } catch (e) { toast('La descarga no está disponible aquí; usa Copiar'); } return;
  } try { await DL.save({ filename: nombre, data }); } catch (e) { if (e && e.code !== 'declined') toast('No se ha podido descargar'); } }
$('#btnDlYaml').addEventListener('click', () => descargar('posiciones.yaml', generarYaml()));
$('#btnPng').addEventListener('click', () => { renderer.domElement.toBlob(b => b && descargar('gemelo-celda-ur3e.png', b), 'image/png'); });
$('#btnImport').addEventListener('click', () => {
  const t = $('#yamlIn').value; const m = t.match(/#\s*layout-json:\s*(\{.*\})\s*$/m);
  if (!m) { toast('No encuentro la línea «# layout-json» del fichero exportado'); return; }
  const r = migrarLayout(m[1]); if (r.error) { toast(`El contenido no es una distribución válida: ${r.error}`); return; }
  vaciarGuardado(); L = r.layout; aplicarLayout(); toast(r.soloLectura ? 'Distribución aplicada en solo lectura: es de una versión más nueva del gemelo' : 'Distribución aplicada');
});
function aplicarLayout() {
  cerrarPreguntaRobot(); aplicarPedido(); $$('#segRobot button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === L.robot));
  colocarRobots(); actualizarZona(); actualizarPlatos(); actualizarAruco(); for (const k in L.cams) actualizarCam(k); aplicarBandeja(simT);
  reiniciarDemo(); pintarCaja(); pintarPerfil(); pintarSensor(); evaluar(); calcularMapa(); pintarSoloLectura(); guardarLocal(); if (!$('[data-panel="datos"]').hidden) pintarDatos();
}
// Tabla de fuentes del panel «Datos» (T2.1): las filas de ORIGEN con el robot, el giro, el sensor y la pinza de ahora
function pintarFuentes() { $('#srcTbl tbody').innerHTML = ORIGEN.panel(ctxOrigen()).map(e => `<tr><td>${e.nombre}<br><span class="hint">${e.fuente}</span></td><td>${e.valor}</td><td><span class="tag ${ORIGEN.CLASE[e.tipo]}">${e.tipo}</span></td></tr>`).join(''); }

// ======================= Colocación y evaluación =======================
function colocarRobots() {
  const o = L.robot === 'B' ? 'A' : 'B'; aplicarCinematica();
  robot.place(BASES[L.robot].x, BASES[L.robot].y, ROB.yaw); otro.place(BASES[o].x, BASES[o].y, 0); // base_link girado según su id (T1.4)
  circ.position.set(BASES[L.robot].x, BASES[L.robot].y, MESA.h + 0.003);
  $('#chipConf').textContent = `UR3e ${L.robot} · ${ROB.id} · RG2 · ELP IMX577`;
  otro.setQ([L.robot === 'B' ? 0 : PI, -1.9, 1.75, -1.45, -1.57, 0]);
}
function evaluar() { pintarLista(); pintarSel(); pintarCaja(); actualizarHUD(); if (!$('[data-panel="alcance"]').hidden) actualizarTablaAlcance(); if (!$('[data-panel="camaras"]').hidden) pintarCamaras(); if (!$('[data-panel="datos"]').hidden) pintarDatos(); actualizarCheck(); }

// ======================= Bucle =======================
let last = performance.now(), frame = 0, camT = 0;
function tamano() { const r = view.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); labels.setSize(r.width, r.height); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); pintarPip(); }
new ResizeObserver(tamano).observe(view);
const CAL = { ema: 16, lento: 0, bajado: false };
function bucle(now) {
  // Mientras corre ensayo() (banco de pruebas y búsqueda de alternativas) el fotograma no toca el gemelo ni dibuja: ensayo()
  // avanza simT y la bandeja por su cuenta, y un fotograma que caía en una de sus pausas según el reloj cambiaba el resultado
  // (T1.2, criterio 6: bajo carga, 2 de 5 páginas daban otro t_sim y otras pausas)
  requestAnimationFrame(bucle); if (D.banco) { last = now; return; }
  const dtr = (now - last) / 1000; const dt = Math.min(0.1, dtr); last = now; frame++;
  // calidad adaptativa: si el equipo va lento, menos píxeles y sombras más simples
  CAL.ema = CAL.ema * 0.95 + Math.min(dtr * 1000, 500) * 0.05; if (!CAL.bajado && frame > 120) { CAL.lento = CAL.ema > 45 ? CAL.lento + 1 : 0; if (CAL.lento > 90) { CAL.bajado = true; renderer.setPixelRatio(1); renderer.shadowMap.type = THREE.PCFShadowMap; tamano(); } }
  if (D.playing && !D.banco) { let tot = dt * D.rate; while (tot > 1e-9) { const h = Math.min(tot, 1 / 60); simT += h; aplicarBandeja(simT); tickDemo(h); tot -= h; } }
  else if (!D.activo) simT += dt;
  aplicarBandeja(simT);
  for (const [a, t] of aristasOn) if (simT > t) { aristasOn.delete(a); dibujarGrafo(); }
  if (camAnim) { camAnim.s = Math.min(1, camAnim.s + dt * 1.6); const k = smooth(camAnim.s); cam.position.lerpVectors(camAnim.p0, camAnim.p, k); orbit.target.lerpVectors(camAnim.t0, camAnim.t, k); if (camAnim.s >= 1) camAnim = null; }
  orbit.update();
  if (robot && frame % 6 === 0) { actualizarHUD(); if (frame % 18 === 0) { pintarCalc(); vigilarEscena(); } if (D.playing) for (const k in CAMS) { const m = metricasCam(k, true); D.minCam[k] = Math.min(D.minCam[k] ?? Infinity, m.libre); } }
  camT += dt; if (camT > 0.8 && !$('[data-panel="camaras"]').hidden && D.playing) { camT = 0; pintarCamaras(); }
  if (!D.sinRender) render();
}
function render() {
  const W = renderer.domElement.width / renderer.getPixelRatio(), H = renderer.domElement.height / renderer.getPixelRatio();
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear();
  if (verCam) {
    const c = CAMS[verCam].cam; const ar = c.aspect; let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    renderer.setScissorTest(true); renderer.setViewport((W - w) / 2, (H - h) / 2, w, h); renderer.setScissor((W - w) / 2, (H - h) / 2, w, h); renderer.clear(); const tv = tctl.visible; tctl.visible = false; renderer.render(scene, c); tctl.visible = tv; renderer.setScissorTest(false);
    labels.domElement.style.visibility = 'hidden'; return;
  }
  labels.domElement.style.visibility = ''; renderer.render(scene, cam); labels.render(scene, cam);
  if (pipOn) {
    const tw = Math.min(200, (W - 40) / 3), th = tw * 9 / 16; let x = W - 10 - tw;
    renderer.shadowMap.autoUpdate = false; renderer.setScissorTest(true); const tv = tctl.visible; tctl.visible = false; // las miniaturas enseñan lo que ve cada cámara, sin el gizmo de edición
    for (const k of Object.keys(CAMS).reverse()) { renderer.setViewport(x, 10, tw, th); renderer.setScissor(x, 10, tw, th); renderer.clear(); renderer.render(scene, CAMS[k].cam); x -= tw + 6; }
    renderer.setScissorTest(false); renderer.shadowMap.autoUpdate = true; tctl.visible = tv;
  }
}

// ======================= Banco de pruebas (solo con ?prueba) =======================
// cfg.perfil: el de la demo ensayada (T1.6); sin él, el de la escena (L.perfil)
async function ensayo(cfg = {}) {
  // El ensayo empieza con simT = 0 (H3 y criterio 6 de T1.2). La bandeja se mueve con BALANCEO(simT + D.fase), así que
  // cfg.fase es la fase de la bandeja al empezar. Y el resultado no depende de cuánto llevaba la página abierta (simT
  // sigue al reloj mientras espera) ni de lo ensayado antes: con simT absoluto, el redondeo de simT + fase y de los
  // tiempos de las animaciones cambiaba de un ensayo a otro (la matriz en orden inverso daba otros t_sim y planes).
  simT = 0; D.sinRender = !!cfg.sinRender;
  try {
    if (cfg.pedido) { L.pedido = cfg.pedido; aplicarPedido(); }
    reiniciarDemo(); if (cfg.caja !== undefined) L.caja.on = cfg.caja; if (cfg.cajaH) L.caja.h = cfg.cajaH; actualizarPlatos(); pintarCaja();
    D.modo = cfg.modo || 'M0'; D.amp = cfg.amp ?? 0.02; D.vel = cfg.vel ?? 0.25;
    reiniciarDemo(); D.activo = true; D.playing = false; D.banco = true; D.fase = cfg.fase ?? Math.random() * 100;
    const pf = PERFIL.de(cfg.perfil ?? perfilEscena()).nombre;
    const h = 1 / 60; const t0 = simT; const run = D.run; const pr = demo(pf);
    let n = 0;
    while (!D.fin && simT - t0 < (cfg.limite || 600)) {
      if (cfg.hasta && cfg.hasta(D)) { D.banco = false; D.sinRender = false; actualizarHUD(); return { parado: D.estado }; }
      simT += h; aplicarBandeja(simT); tickDemo(h);
      for (let k = 0; k < 4; k++) await Promise.resolve();
      if (++n % 240 === 0) await new Promise(r => setTimeout(r, 0));
    }
    if (!D.fin) { D.run++; }
    await new Promise(r => setTimeout(r, 0)); actualizarHUD();
    D.banco = false; D.sinRender = false;
    return { cfg, fin: D.fin || 'atascado', estado: D.estado, paso: D.paso + 1, t_sim: +(simT - t0).toFixed(1), t_mov: +D.motion.toFixed(1), errores_mm: D.errores.map(mm), choques: D.choques, roces: D.roces, pausas: D.pausas, autocol: D.autocol, planes: D.planes, sust: D.sustituidos, fallo: $('#dFallo').hidden ? '' : $('#dFallo').textContent.trim() };
  } catch (e) { // una excepción no deja la demo a medias: se cancela y la escena vuelve a la de partida; el error sigue hacia quien llamó
    D.activo = false; reiniciarDemo(); throw e;
  } finally { D.banco = false; D.sinRender = false; } // pase lo que pase, bucle() vuelve a avanzar y a dibujar (revisión de T1.2)
}

// ======================= Arranque =======================
let D_ready = false;
aplicarPedido(); dibujarGrafo(); pintarPasos(-1);
actualizarZona(); actualizarPlatos(); actualizarAruco(); for (const k in L.cams) actualizarCam(k); aplicarTema(); pintarCaja(); pintarSoloLectura(); pintarRobotId(); pintarPerfil(); pintarSensor();
$$('#segRobot button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === L.robot));
$('#segPedido').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || D.playing) return; const oc = ocupadoSinDemo('cambiar el pedido'); if (oc) { toast(oc); return; } L.pedido = +b.dataset.v; D.activo = false; aplicarPedido(); reiniciarDemo(); actualizarPlatos(); evaluar(); guardarLocal(); toast(L.pedido === 1 ? 'Pide un solo plato: va al centro de la bandeja' : 'Pide primero y segundo'); });
$('#segRate').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; D.rate = +b.dataset.v; $$('#segRate button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
$('#segModoB').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; D.modo = b.dataset.v; $$('#segModoB button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
$('#dVel').addEventListener('input', e => { D.vel = e.target.value / 100; $('#dVelOut').textContent = `${e.target.value} %`; });
$('#dAmp').addEventListener('input', e => { D.amp = e.target.value / 100; $('#dAmpOut').textContent = `${fmt(+e.target.value, 1)} cm`; actualizarCheck(); });
requestAnimationFrame(bucle);
if (location.search.includes('prueba')) window.__g = { aplicarPedido, actualizarZona, esferasObjeto, cargaDe, BAND, bandeja, aplicarBandeja: t => aplicarBandeja(t), ladoZonas: () => ladoZonas(), comprobarPlan, llegaVertical, puntosSoltar, FRUTAS, CACHE_PLAN, poseHoriz, ejeHoriz, mundoABase, enLimites, qValida, rutaNivelada: (...a) => rutaNivelada(...a), colocacionConTransporte: (...a) => colocacionConTransporte(...a), planColocar: (...a) => planColocar(...a), zonasB, ikTCP, planAgarrePlato, planColocar, planPlatoCache, KIN_: KIN, BASES, consts: { R_AGARRE, H_BORDE }, COL: () => COL, choqueEn: (q, c) => choqueEn(q, c), obstaculos: () => obstaculos(), textoChoque: c => textoChoque(c), D, L: () => L, cam, orbit, scene, renderer, OBJ, piezas: () => piezas, simT: () => simT, CAMS, actualizarCam, actualizarAruco, actualizarPlatos, metricasCam, tareasCam, TAREAS, tareasCfg: () => TAREAS_CFG, USB, usbCfg: () => USB_CFG, usbCams: () => USB_CAMS, usbLsusb: () => USB_LSUSB, estadoObjeto, alcance, comprobarPlan, ensayo, planAgarrePlato, holguraActual, get robot() { return robot; }, KIN, pinza, tcpMundo, zPlato, setL: l => { L = l; }, ESC, ALM, abrirEscena, codigoEscena, abrirCodigo, guardarEscena, escCam: cam, orbit, vista, CALC, calcularPlanes, planesAlDia, recalcular, orientDe, fijarOrient, orientarDesdeQuat, CAMS, seleccionar, tctl, generarYaml, ficherosRos: () => ficherosRos(), modeloExportacion: () => modeloExportacion(), cadenaPlato, cargaPlan, rutaCartesiana: (...a) => rutaCartesiana(...a), zonasB_: () => zonasB, zonaDe, qReposo, aplicarLayout, buscarAlternativa, candidatos, explicar, mostrarFalloInfo, diagnosticarPunto, LAYOUT, ESQ_L, migrarLayout, soloLectura, RNG, planificar: (...a) => planificar(...a), get CIN() { return CIN; }, get ROB() { return ROB; }, CALIBRACION, marco: () => marco(), baseAMundo: (x, y, z) => baseAMundo(x, y, z), tcpDeQ: (q, w) => tcpDeQ(q, w), pedirRobotId: id => pedirRobotId(id), ikNoConverge: (p, y, o) => ikNoConverge(p, y, o), posesTCP, volCol, calcularPerfil, radioA, PERFIL, prepararMoveJ: (...a) => prepararMoveJ(...a), semillaDe: (...a) => semillaDe(...a), otroVisible: () => otroVisible(), apartarEscena: () => apartarEscena(), perfilEscena: () => perfilEscena(), planesAlDiaDe: pf => planesAlDia(pf), validar: () => validar(), VAL, SENSOR, areaDe: c => areaDe(c), hfovDe: c => hfovDe(c), vfovDe: c => vfovDe(c), firmaVal: () => firmaVal(), valAlDia: () => valAlDia(), perfilesDe: e => perfilesDe(e), estadoParaGuardar: () => estadoParaGuardar(), bandejaBalanceo: () => bandejaBalanceo(), tocaBandejaEnBalanceo: (q, w) => tocaBandejaEnBalanceo(q, w) }; // T1.4: robot activo, su cinemática y el marco de base_link (una sola línea: build_web.sh la quita entera)
fetch('ur3e-malla.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => { const bin = atob(j.glb); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); new GLTFLoader().parse(u8.buffer, '', cargado, fallo); }).catch(fallo);
function fallo(err) { $('#loading').textContent = 'No se ha podido cargar el modelo del UR3e.'; console.error(err); }
function cargado(g) {
  robot = new Robot(g, 'robot'); otro = new Robot(g, 'otro', true); scene.add(robot.root, otro.root);
  robot.tool0.add(pinza.g);
  robot.setCinematica(CIN); REF_MANIP = CIN.manip(Q_REF_MANIP); // el robot de la disposición abierta (T1.4)
  colocarRobots(); aplicarBandeja(simT); iniciarColision(); crearVolumenes(); pintarCalidad(); robot.setQ(qReposo()); sincronizarSliders();
  marcoTF('mesa', scene).position.set(0, 0, MESA.h + 0.002); marcoTF('base_link', robot.root); marcoTF('tool0', robot.tool0); marcoTF('tcp', pinza.tcp);
  for (const k in CAMS) marcoTF(`camara_${k}_optical`, CAMS[k].optical); // el marco óptico de REP-103, con el nombre de su TF (T2.4)
  marcoTF('bandeja', bandeja); for (const k in zonasB) marcoTF(k, zonasB[k]).userData.lbl.element.textContent = '';
  ladoZonas(); calcularPerfil(); calcularMapa(); dibujarSolape(); vista('iso'); camAnim.s = 0.999;
  $('#loading').remove(); evaluar(); pintarPip(); D_ready = true; calcularPlanes(); // primer cálculo sin bloquear la página
  let tab = null; try { tab = localStorage.getItem('gemelo-tab'); } catch (e) { }
  if (tab && tab !== 'escena') { const b = $(`.tabs [data-tab="${tab}"]`); if (b) b.click(); }
}
