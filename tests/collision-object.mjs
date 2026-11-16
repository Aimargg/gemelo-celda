// Validador de escena_colision.yaml (T2.3-C1): una lista de moveit_msgs/CollisionObject que un nodo carga con yaml.safe_load
// y rosidl_runtime_py.set_message_fields, comprobada con un analizador ajeno al gemelo (yaml@2.9.1, en YAML 1.1 y 1.2) y sin
// el código que genera el fichero. Reglas (→ estudio estado-del-arte-gemelo-ros-generacion-config; CollisionObject.msg de
// moveit_msgs 2.6 y SolidPrimitive.msg de shape_msgs, leídos en sus ramas; nada probado en un contexto ROS: U4):
//   · YAML 1.1 (PyYAML) y 1.2 dan el mismo valor; sin anclas, alias ni etiquetas;
//   · raíz: un mapa con solo `objetos`, una lista no vacía de mapas;
//   · cada objeto: solo campos que existen en CollisionObject, con header (solo frame_id y stamp), id, pose, primitives y
//     primitive_poses; sin `operation` (es un byte: un entero no pasa por set_message_fields; ADD = 0 es el valor por defecto);
//   · header.frame_id = el frame pedido; ids entre comillas, no vacíos, únicos y ninguno `suelo` (el del profesor);
//   · primitives: mapas con solo type y dimensions; type 1 (BOX), 2 (SPHERE) o 3 (CYLINDER), entero; tantas dimensions como
//     pide su tipo (BOX [x, y, z], SPHERE [radio], CYLINDER [altura, radio]), todas doubles con punto y > 0;
//   · tantas primitive_poses como primitives; cada pose (también la del objeto) con solo position {x, y, z} y orientation
//     {x, y, z, w}, doubles con punto (un entero en un float64 no pasa por set_message_fields) y |q|² − 1 < 1e-9.
// Uso: problemasEscena(texto, { frame }) → lista de problemas (vacía si cumple).
import YAML from 'yaml';
import { isDeepStrictEqual } from 'node:util';

// CollisionObject.msg (moveit_msgs 2.6): todos sus campos
export const CAMPOS_COLLISION_OBJECT = ['header', 'pose', 'id', 'type', 'primitives', 'primitive_poses', 'meshes', 'mesh_poses', 'planes', 'plane_poses', 'subframe_names', 'subframe_poses', 'operation'];
const USADOS = ['header', 'id', 'pose', 'primitives', 'primitive_poses'];
export const DIMENSIONES = { 1: 3, 2: 1, 3: 2 }; // BOX [x, y, z], SPHERE [radio], CYLINDER [altura, radio]
const DOUBLE = /^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/, ENTERO = /^[-+]?\d+$/;

export function problemasEscena(texto, { frame } = {}) {
  const mal = [];
  const doc = YAML.parseDocument(texto, { version: '1.2' });
  if (doc.errors.length) return doc.errors.map(e => `YAML no válido: ${e.message.split('\n')[0]}`);
  let v11; try { v11 = YAML.parse(texto, { version: '1.1' }); } catch (e) { return [`YAML 1.1 no válido: ${e.message.split('\n')[0]}`]; }
  if (!isDeepStrictEqual(v11, doc.toJS())) mal.push('YAML 1.1 y 1.2 lo leen distinto (¿una clave y, n, yes u on sin comillas?)');
  const fuente = n => texto.slice(n.range[0], n.range[1]);
  YAML.visit(doc, { Node(_, n) { if (YAML.isAlias(n)) mal.push('alias'); else { if (n.tag) mal.push(`etiqueta ${n.tag}`); if (n.anchor) mal.push(`ancla &${n.anchor}`); } } });
  const claves = n => n.items.map(p => (YAML.isScalar(p.key) ? String(p.key.value) : '?'));
  const de = (n, k) => n.items.find(p => YAML.isScalar(p.key) && String(p.key.value) === k)?.value;
  const cadena = (n, ruta) => { if (!YAML.isScalar(n) || !['QUOTE_SINGLE', 'QUOTE_DOUBLE'].includes(n.type)) { mal.push(`${ruta}: debe ser un string entre comillas`); return null; } return n.value; };
  const double = (n, ruta) => { if (!YAML.isScalar(n) || n.type !== 'PLAIN' || !DOUBLE.test(fuente(n))) { mal.push(`${ruta}: debe ser un double con punto decimal${YAML.isScalar(n) ? ` (es «${fuente(n)}»)` : ''}`); return null; } return n.value; };
  const soloClaves = (n, permitidas, ruta, exactas = false) => {
    if (!YAML.isMap(n)) { mal.push(`${ruta}: debe ser un mapa`); return false; }
    const ks = claves(n);
    for (const k of ks) if (!permitidas.includes(k)) mal.push(`${ruta}: el campo «${k}» no existe aquí (${permitidas.join(', ')})`);
    if (exactas) for (const k of permitidas) if (!ks.includes(k)) mal.push(`${ruta}: falta «${k}»`);
    return true;
  };
  function pose(n, ruta) {
    if (!soloClaves(n, ['position', 'orientation'], ruta, true)) return;
    const p = de(n, 'position'), o = de(n, 'orientation');
    if (p && soloClaves(p, ['x', 'y', 'z'], `${ruta}.position`, true)) for (const k of ['x', 'y', 'z']) { const v = de(p, k); if (v) double(v, `${ruta}.position.${k}`); }
    if (o && soloClaves(o, ['x', 'y', 'z', 'w'], `${ruta}.orientation`, true)) {
      const q = ['x', 'y', 'z', 'w'].map(k => { const v = de(o, k); return v ? double(v, `${ruta}.orientation.${k}`) : null; });
      if (q.every(v => typeof v === 'number')) { const n2 = q.reduce((s, v) => s + v * v, 0); if (!(Math.abs(n2 - 1) < 1e-9)) mal.push(`${ruta}.orientation: |q|² − 1 = ${n2 - 1} (no normalizado)`); }
    }
  }
  const r = doc.contents;
  if (!YAML.isMap(r) || claves(r).join() !== 'objetos') return [...mal, 'la raíz debe ser un mapa con solo «objetos»'];
  const objs = de(r, 'objetos');
  if (!YAML.isSeq(objs) || !objs.items.length) return [...mal, 'objetos: debe ser una lista no vacía de CollisionObject'];
  const ids = new Set();
  objs.items.forEach((o, i) => {
    let ruta = `objetos[${i}]`;
    if (!soloClaves(o, CAMPOS_COLLISION_OBJECT, ruta)) return;
    const id = de(o, 'id') ? cadena(de(o, 'id'), `${ruta}.id`) : null;
    if (id !== null) {
      ruta = `objetos[${i}] (${id})`;
      if (!id) mal.push(`${ruta}: id vacío`);
      if (id === 'suelo') mal.push(`${ruta}: el id suelo es el del ejemplo del profesor (un ADD lo sustituiría)`);
      if (ids.has(id)) mal.push(`${ruta}: id repetido`); ids.add(id);
    }
    for (const k of USADOS) if (!de(o, k)) mal.push(`${ruta}: falta «${k}»`);
    const op = de(o, 'operation');
    if (op) mal.push(`${ruta}: operation es un byte${YAML.isScalar(op) && ENTERO.test(fuente(op)) ? ` y aquí es el entero ${fuente(op)}` : ''}: set_message_fields no lo acepta desde YAML; omítelo (ADD = 0 por defecto)`);
    const h = de(o, 'header');
    if (h && soloClaves(h, ['frame_id', 'stamp'], `${ruta}.header`)) {
      const f = de(h, 'frame_id'); const fv = f ? cadena(f, `${ruta}.header.frame_id`) : (mal.push(`${ruta}.header: falta frame_id`), null);
      if (fv !== null && frame !== undefined && fv !== frame) mal.push(`${ruta}.header.frame_id: «${fv}» y debe ser «${frame}»`);
    }
    if (de(o, 'pose')) pose(de(o, 'pose'), `${ruta}.pose`);
    const prims = de(o, 'primitives'), poses = de(o, 'primitive_poses');
    if (prims && !YAML.isSeq(prims)) mal.push(`${ruta}.primitives: debe ser una lista`);
    if (poses && !YAML.isSeq(poses)) mal.push(`${ruta}.primitive_poses: debe ser una lista`);
    if (YAML.isSeq(prims)) {
      if (!prims.items.length) mal.push(`${ruta}.primitives: vacía`);
      prims.items.forEach((p, j) => {
        const rp = `${ruta}.primitives[${j}]`;
        if (!soloClaves(p, ['type', 'dimensions'], rp, true)) return;
        const t = de(p, 'type'), d = de(p, 'dimensions');
        const tipo = t && YAML.isScalar(t) && t.type === 'PLAIN' && ENTERO.test(fuente(t)) ? Number(fuente(t)) : null;
        if (tipo === null) { mal.push(`${rp}.type: debe ser un entero`); return; }
        if (!(tipo in DIMENSIONES)) { mal.push(`${rp}.type: ${tipo} no es BOX (1), SPHERE (2) ni CYLINDER (3)`); return; }
        if (!YAML.isSeq(d)) { mal.push(`${rp}.dimensions: debe ser una lista`); return; }
        if (d.items.length !== DIMENSIONES[tipo]) mal.push(`${rp}.dimensions: ${d.items.length} valores y el tipo ${tipo} pide ${DIMENSIONES[tipo]} (BOX [x, y, z], SPHERE [radio], CYLINDER [altura, radio])`);
        d.items.forEach((v, k) => { const x = double(v, `${rp}.dimensions[${k}]`); if (x !== null && !(x > 0)) mal.push(`${rp}.dimensions[${k}]: ${x} no es > 0`); });
      });
    }
    if (YAML.isSeq(poses)) {
      poses.items.forEach((p, j) => pose(p, `${ruta}.primitive_poses[${j}]`));
      if (YAML.isSeq(prims) && poses.items.length !== prims.items.length) mal.push(`${ruta}: ${prims.items.length} primitives y ${poses.items.length} primitive_poses`);
    }
  });
  return mal;
}
