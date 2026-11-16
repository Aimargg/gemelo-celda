// Modelo del sensor de las cámaras ELP (T1.7, D10): área activa por modelo y por modo, y las fórmulas del campo de visión y
// de la resolución en el punto de mira (→ camaras-colocacion «fórmulas y entradas»). Sin navegador ni three: se prueba con
// node:test (tests/unit/sensor.test.mjs) y se concatena en app.js con el marcador @@SENSOR@@ (D4). Lo sustituirá el
// camera_info de la calibración intrínseca (F4).
const SENSOR = (() => {
  // mm del área activa (ancho × alto)
  const MODELOS = {
    'elp-ficha': { nombre: 'ELP ficha', w: 5.952, h: 4.71, origen: '«image size» de la ficha de la ELP AFKV100 (5,952 × 4,71 mm) [SIN VALIDAR]' },
    'gemelo-v8': { nombre: 'gemelo v8', w: 6.287, h: 4.712, origen: 'IMX577 de 4056 × 3040 píxeles de 1,55 µm: el que usaba la v8 (escenas v8, I1)' },
  };
  const NOMBRES = Object.keys(MODELOS);
  function de(s) { if (!Object.hasOwn(MODELOS, s)) throw new Error(`sensor desconocido (${JSON.stringify(s)})`); return MODELOS[s]; }
  // Área activa de un sensor en un modo { w, h, fps } (píxeles): el ancho completo en todos los modos (según Sony, todos los
  // modos del IMX577 leen el ancho completo) y el alto, min(h, w·N_alto/N_ancho). El 1920×1080 a 120 fps sale de un modo de
  // 2028 columnas y no hay fuente de si se recorta o se escala: se supone escalado (ancho completo) y se avisa [SIN VALIDAR].
  const NOTA_1080_120 = 'el 1920×1080 a 120 fps sale de un modo de 2028 columnas del IMX577: se supone escalado al ancho completo; si se recorta, el campo es menor [SIN VALIDAR]';
  function area(sensor, modo) {
    const m = de(sensor);
    return { w: m.w, h: Math.min(m.h, m.w * modo.h / modo.w), nota: modo.w === 1920 && modo.h === 1080 && modo.fps === 120 ? NOTA_1080_120 : null };
  }
  // Campo de visión de lente ideal (rad): HFOV = 2·atan(w / 2f), y lo mismo con el alto efectivo
  const hfov = (w, f) => 2 * Math.atan(w / 2 / f);
  const vfov = (h, f) => 2 * Math.atan(h / 2 / f);
  // Resolución (mm/px) a d metros: d·(w / f) / N_px y, en un plano inclinado (c = cos θ del ángulo entre el eje óptico y la
  // normal del plano), ÷ cos θ. Mismo orden de operaciones que la v8 (I1: las escenas v8 dan las mismas cifras).
  const mmPorPx = (d, w, f, N, c = 1) => d * ((w / f) / N) / c * 1000;
  return { MODELOS, NOMBRES, de, area, hfov, vfov, mmPorPx, NOTA_1080_120 };
})();
if (typeof module !== 'undefined') module.exports = SENSOR;
