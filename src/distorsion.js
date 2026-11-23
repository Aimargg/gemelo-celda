// Distorsión Brown–Conrady opcional de la vista de una cámara (T4.5, D4): la función de distorsión del modelo `plumb_bob` de ROS/OpenCV
// y su inversa numérica (Newton), la lectura de un `camera_info` de ROS pegado como texto YAML y el campo extra que tiene que tener el
// render para que las esquinas de la imagen distorsionada sigan cubiertas. Sin DOM, sin three y sin red: solo lee el texto que se le pasa.
// Se prueba con node:test (tests/unit/distorsion-t45.test.mjs) y se concatena en app.js con el marcador @@DISTORSION@@; el post-proceso
// de fragmento (app.js) aplica la misma inversa en GLSL.
// Fuentes. El estudio «gemelo-web, cámaras simuladas» no está en el repo: solo se usa lo que da la ficha de T4.5 del plan y las
// fórmulas públicas del modelo de OpenCV (módulo calib3d, «Camera Calibration and 3D Reconstruction», modelo de distorsión) y de
// sensor_msgs/CameraInfo de ROS, citadas aquí de memoria y sin comprobar contra la fuente. El modelo, con (x, y) = (X/Z, Y/Z) en el
// marco de la cámara de OpenCV (x a la derecha, y hacia abajo, z al frente) y r² = x² + y²:
//   x_d = x·(1 + k1·r² + k2·r⁴ + k3·r⁶) + 2·p1·x·y + p2·(r² + 2·x²)
//   y_d = y·(1 + k1·r² + k2·r⁴ + k3·r⁶) + p1·(r² + 2·y²) + 2·p2·x·y        y el píxel es u = fx·x_d + cx, v = fy·y_d + cy
// `plumb_bob` de ROS: D = [k1, k2, t1, t2, k3] (t1 = p1, t2 = p2) y K = [fx 0 cx; 0 fy cy; 0 0 1]. Lo demás (el campo extra máximo del
// render) es SUPUESTO SIN VALIDAR y editable.
const DISTORSION = (() => {
  const FUENTE = 'modelo de OpenCV (calib3d) y sensor_msgs/CameraInfo de ROS: fórmulas públicas, citadas sin comprobar aquí (el estudio «gemelo-web, cámaras simuladas» no está en el repo)';
  const SIN = 'sin fuente comprobable; SUPUESTO [SIN VALIDAR]';
  const MARGEN_DEFECTO = 1.6, MARGEN_TOPE = 4;
  const PARAMS = [{ id: 'margen.max', nombre: 'Campo extra máximo del render (más ancho que el de la cámara)', unidad: '× 1', valor: MARGEN_DEFECTO, origen: 'SUPUESTO', fuente: SIN, editable: true }];
  const cfgDefecto = () => ({ margen: { max: MARGEN_DEFECTO } });
  // Cambia el campo extra máximo (devuelve una configuración nueva); un id desconocido o un valor que no sea un número de 1 a 4 falla
  function fijar(cfg, id, valor) {
    if (id !== 'margen.max') throw new Error(`parámetro desconocido (${JSON.stringify(id)})`);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 1 || valor > MARGEN_TOPE) throw new Error(`«${PARAMS[0].nombre}»: ${JSON.stringify(valor)} no está entre 1 y ${MARGEN_TOPE}`);
    return { ...cfg, margen: { ...cfg.margen, max: valor } };
  }

  const NOMBRES_D = ['k1', 'k2', 'p1 (t1)', 'p2 (t2)', 'k3'];
  const comprobarD = D => {
    if (!Array.isArray(D) || D.length !== 5) throw new Error('D tiene que ser [k1, k2, p1, p2, k3]');
    D.forEach((v, i) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${NOMBRES_D[i]}: ${typeof v === 'number' ? String(v) : JSON.stringify(v)} no es un número finito`); });
  };
  // Un punto normalizado (x, y) = (X/Z, Y/Z), con y hacia abajo, pasa a su punto distorsionado (modelo de arriba). D = 0 es la identidad
  function distorsionar(D, x, y) {
    const [k1, k2, p1, p2, k3] = D, r2 = x * x + y * y, R = 1 + r2 * (k1 + r2 * (k2 + r2 * k3));
    return { x: x * R + 2 * p1 * x * y + p2 * (r2 + 2 * x * x), y: y * R + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y };
  }
  // Inversa numérica: el (x, y) cuya imagen distorsionada es (xd, yd). Newton de 2 × 2 desde (xd, yd) con el jacobiano analítico:
  //   con R = 1 + k1·r² + k2·r⁴ + k3·r⁶ y R' = dR/dr² = k1 + 2·k2·r² + 3·k3·r⁴:
  //   ∂x_d/∂x = R + 2·x²·R' + 2·p1·y + 6·p2·x ; ∂x_d/∂y = ∂y_d/∂x = 2·x·y·R' + 2·p1·x + 2·p2·y ; ∂y_d/∂y = R + 2·y²·R' + 6·p1·y + 2·p2·x
  // Devuelve { x, y, ok }: ok es falso si no converge (un D que pliega la imagen: no tiene inversa en ese punto) o sale un valor no finito
  function inversa(D, xd, yd, tol = 1e-12, maxIter = 60) {
    const [k1, k2, p1, p2, k3] = D; let x = xd, y = yd;
    for (let i = 0; i <= maxIter; i++) {
      const r2 = x * x + y * y, R = 1 + r2 * (k1 + r2 * (k2 + r2 * k3)), f = distorsionar(D, x, y), ex = f.x - xd, ey = f.y - yd;
      if (!Number.isFinite(ex) || !Number.isFinite(ey)) return { x, y, ok: false };
      if (Math.hypot(ex, ey) < tol) return { x, y, ok: true };
      if (i === maxIter) break;
      const Rp = k1 + r2 * (2 * k2 + 3 * k3 * r2), jxx = R + 2 * x * x * Rp + 2 * p1 * y + 6 * p2 * x, jxy = 2 * x * y * Rp + 2 * p1 * x + 2 * p2 * y, jyy = R + 2 * y * y * Rp + 6 * p1 * y + 2 * p2 * x, det = jxx * jyy - jxy * jxy;
      if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return { x, y, ok: false };
      x -= (jyy * ex - jxy * ey) / det; y -= (jxx * ey - jxy * ex) / det;
    }
    return { x, y, ok: false };
  }

  // Campo que tiene que cubrir el render para pintar la imagen distorsionada: el de la cámara es ±tanX × ±tanY (en x/z e y/z; el
  // borde de la imagen) y cada punto de esa imagen sale de un punto del render, la inversa. La extensión máxima de la imagen de un
  // rectángulo por una aplicación continua e inyectiva se alcanza en su borde: se recorre el borde (33 puntos por lado) y se
  // comprueba una rejilla interior de 9 × 9 (que todo tenga inversa). Si hace falta más campo que `margenMax` veces el de la
  // cámara, el render se queda en ese máximo y `cubre` es falso (con su motivo): las esquinas quedarían sin imagen.
  function campoNecesario(D, tanX, tanY, margenMax) {
    comprobarD(D);
    if (![tanX, tanY, margenMax].every(v => Number.isFinite(v) && v > 0)) throw new Error('tanX, tanY y el margen máximo tienen que ser positivos');
    const pts = [], N = 32;
    for (let i = 0; i <= N; i++) { const t = -1 + 2 * i / N; pts.push([t * tanX, -tanY], [t * tanX, tanY], [-tanX, t * tanY], [tanX, t * tanY]); }
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) pts.push([i / 4 * tanX, j / 4 * tanY]);
    let nx = tanX, ny = tanY;
    for (const [xd, yd] of pts) {
      const r = inversa(D, xd, yd);
      if (!r.ok) return { tanX: tanX * margenMax, tanY: tanY * margenMax, razonX: margenMax, razonY: margenMax, cubre: false, motivo: `la distorsión no tiene inversa en el punto (${xd.toFixed(3)}, ${yd.toFixed(3)}) de la imagen: ese D pliega la imagen` };
      nx = Math.max(nx, Math.abs(r.x)); ny = Math.max(ny, Math.abs(r.y));
    }
    const rx = nx / tanX, ry = ny / tanY, cubre = rx <= margenMax && ry <= margenMax, PAD = 1.01; // 1 % de holgura contra el redondeo del muestreo
    const razon = r => r <= 1 ? 1 : Math.min(r * PAD, margenMax), razonX = razon(rx), razonY = razon(ry); // sin distorsión (D = 0) el render es el de la cámara
    const motivo = cubre ? '' : `las esquinas necesitan ×${Math.max(rx, ry).toFixed(2).replace('.', ',')} de campo y el máximo declarado es ×${margenMax.toFixed(2).replace('.', ',')}: parte de la imagen quedaría sin render`;
    return { tanX: tanX * razonX, tanY: tanY * razonY, razonX, razonY, cubre, motivo };
  }

  // ---------- Lectura del camera_info (YAML de camera_calibration_parsers: image_width, image_height, camera_matrix, …) ----------
  const MAX_TEXTO = 200000;
  const RE_NUM = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  // Valor suelto: entero o real, .nan y .inf de YAML, o texto (con o sin comillas)
  function escalar(s) {
    s = s.trim();
    if (/^'.*'$/.test(s) || /^".*"$/.test(s)) return s.slice(1, -1);
    if (RE_NUM.test(s)) return Number(s);
    if (/^[-+]?\.(nan|inf)$/i.test(s)) return /nan/i.test(s) ? NaN : (s[0] === '-' ? -Infinity : Infinity);
    return s;
  }
  // Quita el comentario de una línea (un # al principio o tras un espacio, fuera de comillas)
  function sinComentario(l) {
    let q = '';
    for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === q) q = ''; } else if (c === '\'' || c === '"') q = c; else if (c === '#' && (i === 0 || /\s/.test(l[i - 1]))) return l.slice(0, i); }
    return l;
  }
  // Lista de flujo [a, b, …] ya sin comentarios, de una o de varias líneas
  function listaFlujo(s, n) {
    if (!/^\[.*\]$/s.test(s)) throw new Error(`línea ${n}: se esperaba una lista [a, b, …] y hay «${s.slice(0, 40)}»`);
    const c = s.slice(1, -1).trim(); return c === '' ? [] : c.split(',').map(escalar);
  }
  // Subconjunto de YAML que usa un camera_info: «clave: valor», «clave:» con un mapa sangrado de «clave: valor» y listas de flujo
  // (también partidas en varias líneas) o de bloque («- valor»). Devuelve un objeto; una línea que no encaja falla con su número
  function leerYaml(texto) {
    const L = texto.replace(/^﻿/, '').split(/\r?\n/).map((l, i) => ({ n: i + 1, sang: l.length - l.trimStart().length, t: sinComentario(l).trimEnd().trim() })).filter(l => l.t !== '' && l.t !== '---' && !/^%/.test(l.t) && l.t !== '...');
    let i = 0;
    function mapa(sang) {
      const o = {};
      while (i < L.length && L[i].sang >= sang) {
        const l = L[i]; if (l.sang !== sang) throw new Error(`línea ${l.n}: sangría inesperada`);
        const m = /^([A-Za-z_][\w.-]*):(?:\s+(.*))?$/.exec(l.t); if (!m) throw new Error(`línea ${l.n}: no es «clave: valor» (${l.t.slice(0, 40)})`);
        if (Object.hasOwn(o, m[1])) throw new Error(`línea ${l.n}: la clave «${m[1]}» está repetida`);
        i++;
        if (m[2] === undefined || m[2] === '') {
          if (i < L.length && L[i].sang > sang) {
            if (L[i].t.startsWith('- ') || L[i].t === '-') { const v = []; while (i < L.length && L[i].sang > sang && (L[i].t.startsWith('- ') || L[i].t === '-')) { v.push(escalar(L[i].t.slice(1))); i++; } o[m[1]] = v; }
            else o[m[1]] = mapa(L[i].sang);
          } else o[m[1]] = null;
        } else if (m[2].startsWith('[')) {
          let s = m[2], n0 = l.n; while (!s.trimEnd().endsWith(']')) { if (i >= L.length) throw new Error(`línea ${n0}: la lista no se cierra con «]»`); s += ' ' + L[i].t; i++; }
          o[m[1]] = listaFlujo(s.trim(), n0);
        } else o[m[1]] = escalar(m[2]);
      }
      return o;
    }
    const raiz = mapa(L.length ? L[0].sang : 0);
    if (i < L.length) throw new Error(`línea ${L[i].n}: sangría inesperada`);
    return raiz;
  }
  const entero = (v, que) => {
    if (v === undefined) throw new Error(`falta ${que}`);
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw new Error(`${que}: ${typeof v === 'number' ? String(v) : JSON.stringify(v)} no es un entero positivo`);
    return v;
  };
  // Una matriz de camera_info: { rows, cols, data } con el tamaño pedido y todo finito
  function matriz(o, clave, rows, cols) {
    if (o === undefined || o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error(`falta «${clave}» (rows, cols y data)`);
    if (o.rows !== rows || o.cols !== cols) throw new Error(`${clave}: tiene que ser de ${rows} × ${cols} y dice ${JSON.stringify(o.rows)} × ${JSON.stringify(o.cols)}`);
    if (!Array.isArray(o.data) || o.data.length !== rows * cols) throw new Error(`${clave}: data tiene ${Array.isArray(o.data) ? o.data.length : 'ningún'} valores y una matriz de ${rows} × ${cols} lleva ${rows * cols}`);
    o.data.forEach((v, i) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${clave}: data[${i}] = ${typeof v === 'number' ? String(v) : JSON.stringify(v)} no es un número finito`); });
    return o.data.slice();
  }
  // Lee el texto de un camera_info. modo = { w, h } (opcional): el de la cámara a la que se aplicaría; si no coincide con image_width ×
  // image_height se rechaza. Solo `plumb_bob`. Devuelve { nombre, w, h, K, D: [k1, k2, p1, p2, k3] }; cualquier fallo es un Error con su motivo
  function leerCameraInfo(texto, modo) {
    if (typeof texto !== 'string' || texto.trim() === '') throw new Error('el camera_info está vacío');
    if (texto.length > MAX_TEXTO) throw new Error(`el texto pasa de ${MAX_TEXTO} caracteres: no es un camera_info`);
    const o = leerYaml(texto);
    const w = entero(o.image_width, 'image_width'), h = entero(o.image_height, 'image_height');
    const modelo = o.distortion_model;
    if (modelo === undefined) throw new Error('falta distortion_model');
    if (modelo !== 'plumb_bob') throw new Error(`distortion_model ${JSON.stringify(modelo)} no está soportado: solo plumb_bob (D = k1, k2, t1, t2, k3)`);
    const K = matriz(o.camera_matrix, 'camera_matrix', 3, 3), D = matriz(o.distortion_coefficients, 'distortion_coefficients', 1, 5);
    if (modo && (modo.w !== w || modo.h !== h)) throw new Error(`el camera_info es de ${w} × ${h} y el modo de la cámara es ${modo.w} × ${modo.h}: no coincide`);
    return { nombre: typeof o.camera_name === 'string' ? o.camera_name : '', w, h, K, D, modelo };
  }
  const esNula = D => D.every(v => v === 0);

  const api = { FUENTE, SIN, PARAMS, MARGEN_DEFECTO, MARGEN_TOPE, cfgDefecto, fijar, distorsionar, inversa, campoNecesario, leerYaml, leerCameraInfo, esNula };
  return api;
})();
if (typeof module !== 'undefined') module.exports = DISTORSION;
