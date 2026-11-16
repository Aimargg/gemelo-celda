// Validador de camera_info en YAML (T2.5-C1): el formato que leen camera_calibration_parsers y camera_info_manager
// (image_common 5.1) y lo que exige sensor_msgs/CameraInfo a una cámara monocular. Con un analizador ajeno al gemelo
// (yaml@2.9.1, en YAML 1.1 y 1.2) y sin el código que genera el fichero (→ estudio estado-del-arte-gemelo-ros-generacion-config;
// nada probado en un contexto ROS: U4). Reglas:
//   · YAML 1.1 y 1.2 dan lo mismo; sin anclas, alias ni etiquetas;
//   · justo estas claves: image_width e image_height (enteros > 0, sin punto: yaml-cpp no lee «1920.0» como entero),
//     camera_name y distortion_model (strings no vacíos), camera_matrix, distortion_coefficients, rectification_matrix y
//     projection_matrix;
//   · cada matriz: justo rows y cols (enteros) y data (doubles con punto), con rows × cols = longitud de data; K y R 3×3,
//     P 3×4 y D 1×5 con plumb_bob;
//   · K de una cámara sin sesgo: fx, fy > 0, K[1] = K[3] = K[6] = K[7] = 0, K[8] = 1, cx en [0, w) y cy en [0, h);
//   · con nominal (por defecto): D = 0, R = I y P = [K | 0].
// Uso: problemasCameraInfo(texto, { nominal }) → lista de problemas (vacía si cumple).
import YAML from 'yaml';
import { isDeepStrictEqual } from 'node:util';

export const CLAVES_CAMERA_INFO = ['image_width', 'image_height', 'camera_name', 'camera_matrix', 'distortion_model', 'distortion_coefficients', 'rectification_matrix', 'projection_matrix'];
const DOUBLE = /^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/, ENTERO = /^[-+]?\d+$/;
const FORMA = { camera_matrix: [3, 3], rectification_matrix: [3, 3], projection_matrix: [3, 4] };

export function problemasCameraInfo(texto, { nominal = true } = {}) {
  const mal = [];
  const doc = YAML.parseDocument(texto, { version: '1.2' });
  if (doc.errors.length) return doc.errors.map(e => `YAML no válido: ${e.message.split('\n')[0]}`);
  let v11; try { v11 = YAML.parse(texto, { version: '1.1' }); } catch (e) { return [`YAML 1.1 no válido: ${e.message.split('\n')[0]}`]; }
  if (!isDeepStrictEqual(v11, doc.toJS())) mal.push('YAML 1.1 y 1.2 lo leen distinto');
  YAML.visit(doc, { Node(_, n) { if (YAML.isAlias(n)) mal.push('alias'); else { if (n.tag) mal.push(`etiqueta ${n.tag}`); if (n.anchor) mal.push(`ancla &${n.anchor}`); } } });
  const fuente = n => texto.slice(n.range[0], n.range[1]);
  const r = doc.contents;
  if (!YAML.isMap(r)) return [...mal, 'la raíz debe ser un mapa'];
  const de = (n, k) => n.items.find(p => YAML.isScalar(p.key) && String(p.key.value) === k)?.value;
  const ks = r.items.map(p => String(p.key?.value));
  for (const k of ks) if (!CLAVES_CAMERA_INFO.includes(k)) mal.push(`clave «${k}» que camera_info no tiene`);
  for (const k of CLAVES_CAMERA_INFO) if (!ks.includes(k)) mal.push(`falta «${k}»`);
  const entero = (n, ruta) => { if (!YAML.isScalar(n) || n.type !== 'PLAIN' || !ENTERO.test(fuente(n))) { mal.push(`${ruta}: debe ser un entero sin punto decimal${YAML.isScalar(n) ? ` (es «${fuente(n)}»)` : ''}`); return null; } return n.value; };
  const cadena = (n, ruta) => { if (!YAML.isScalar(n) || typeof n.value !== 'string' || !n.value) { mal.push(`${ruta}: debe ser un string no vacío`); return null; } return n.value; };
  const w = de(r, 'image_width') ? entero(de(r, 'image_width'), 'image_width') : null, h = de(r, 'image_height') ? entero(de(r, 'image_height'), 'image_height') : null;
  for (const [k, v] of [['image_width', w], ['image_height', h]]) if (v !== null && !(v > 0)) mal.push(`${k}: ${v} no es > 0`);
  if (de(r, 'camera_name')) cadena(de(r, 'camera_name'), 'camera_name');
  const modelo = de(r, 'distortion_model') ? cadena(de(r, 'distortion_model'), 'distortion_model') : null;
  const M = {};
  for (const k of ['camera_matrix', 'distortion_coefficients', 'rectification_matrix', 'projection_matrix']) {
    const n = de(r, k); if (!n) continue;
    if (!YAML.isMap(n)) { mal.push(`${k}: debe ser un mapa con rows, cols y data`); continue; }
    const mk = n.items.map(p => String(p.key?.value));
    if (mk.join() !== 'rows,cols,data') { mal.push(`${k}: debe tener justo rows, cols y data (tiene ${mk.join(', ')})`); continue; }
    const rows = entero(de(n, 'rows'), `${k}.rows`), cols = entero(de(n, 'cols'), `${k}.cols`), d = de(n, 'data');
    if (!YAML.isSeq(d)) { mal.push(`${k}.data: debe ser una lista`); continue; }
    const data = d.items.map((v, i) => { if (!YAML.isScalar(v) || v.type !== 'PLAIN' || !DOUBLE.test(fuente(v))) { mal.push(`${k}.data[${i}]: debe ser un double con punto decimal`); return NaN; } return v.value; });
    if (rows !== null && cols !== null && rows * cols !== data.length) mal.push(`${k}: rows × cols = ${rows} × ${cols} = ${rows * cols} y data tiene ${data.length} valores`);
    const forma = k === 'distortion_coefficients' ? (modelo === 'plumb_bob' ? [1, 5] : null) : FORMA[k];
    if (forma && (rows !== forma[0] || cols !== forma[1])) mal.push(`${k}: debe ser ${forma[0]} × ${forma[1]} (es ${rows} × ${cols})`);
    M[k] = data;
  }
  const K = M.camera_matrix, D = M.distortion_coefficients, R = M.rectification_matrix, P = M.projection_matrix;
  if (K && K.length === 9) {
    if (!(K[0] > 0 && K[4] > 0)) mal.push(`camera_matrix: fx y fy deben ser > 0 (${K[0]}, ${K[4]})`);
    if (K[1] !== 0 || K[3] !== 0 || K[6] !== 0 || K[7] !== 0 || K[8] !== 1) mal.push('camera_matrix: debe ser [fx, 0, cx, 0, fy, cy, 0, 0, 1]');
    if (w !== null && !(K[2] >= 0 && K[2] < w)) mal.push(`camera_matrix: cx = ${K[2]} fuera de [0, ${w})`);
    if (h !== null && !(K[5] >= 0 && K[5] < h)) mal.push(`camera_matrix: cy = ${K[5]} fuera de [0, ${h})`);
  }
  if (nominal) {
    if (modelo !== null && modelo !== 'plumb_bob') mal.push(`distortion_model: «${modelo}» y el nominal es plumb_bob`);
    if (D && !D.every(v => v === 0)) mal.push(`distortion_coefficients: el nominal es D = 0 (${D.join(', ')})`);
    if (R && !isDeepStrictEqual(R, [1, 0, 0, 0, 1, 0, 0, 0, 1])) mal.push('rectification_matrix: una cámara monocular lleva R = I');
    if (K && P && K.length === 9 && P.length === 12 && !isDeepStrictEqual(P, [K[0], K[1], K[2], 0, K[3], K[4], K[5], 0, K[6], K[7], K[8], 0])) mal.push('projection_matrix: debe ser P = [K | 0]');
  }
  return mal;
}
