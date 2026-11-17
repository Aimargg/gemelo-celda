// Validador del formato .scene de MoveIt (T2.3-C3): el texto que escribe PlanningScene::saveGeometryToStream y lee
// loadGeometryFromStream (moveit 2.12, con pose de objeto y subframes) y las formas de geometric_shapes (saveAsText). Sin el
// código que genera el fichero. Hace falta porque load_geometry_from_file responde success: true aunque el fichero esté mal
// formado (→ estudio estado-del-arte-gemelo-ros-generacion-config): este validador es la única red. Reglas, línea a línea:
//   · el nombre de la escena (una línea no vacía);
//   · por objeto: «* <id>» (id no vacío, sin espacios y único), su pose en dos líneas («x y z» y «qx qy qz qw», con
//     |q|² − 1 < 1e-9) y el número de formas (entero ≥ 1);
//   · por forma: su tipo (box, sphere, cylinder o cone; cualquier otro es «Unknown shape type»), una línea con su número exacto
//     de dimensiones, todas > 0 (box x y z, sphere radio, cylinder radio longitud, cone radio longitud), su pose (dos líneas) y
//     su color «r g b a» con 4 valores en [0, 1];
//   · el número de subframes (entero ≥ 0) y, por subframe, su nombre y su pose (dos líneas);
//   · una línea final «.» y nada después.
// Los números, decimales finitos. Uso: problemasScene(texto) → lista de problemas (vacía si cumple). Ante un error de
// estructura se para: lo que sigue ya no se puede leer en su sitio.
const NUM = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/, ENTERO = /^\d+$/;
export const FORMAS_SCENE = { box: 3, sphere: 1, cylinder: 2, cone: 2 };

export function problemasScene(texto) {
  const mal = [];
  if (!texto.endsWith('\n')) mal.push('el fichero no acaba en salto de línea');
  const ls = texto.replace(/\n$/, '').split('\n');
  let i = 0;
  const donde = () => `línea ${i}`;
  const nums = (n, que) => {
    if (i >= ls.length) throw new Error(`falta ${que} al final del fichero (¿falta el «.» final o no cuadra un número de formas?)`);
    const l = ls[i++], t = l.trim().split(/\s+/);
    if (t.length !== n || !t.every(x => NUM.test(x))) throw new Error(`${donde()}: «${l}» debe ser ${que} (${n} números)`);
    return t.map(Number);
  };
  const entero = que => {
    if (i >= ls.length) throw new Error(`falta ${que} al final del fichero`);
    const l = ls[i++]; if (!ENTERO.test(l.trim())) throw new Error(`${donde()}: «${l}» debe ser ${que} (un entero)`);
    return Number(l.trim());
  };
  const pose = que => {
    nums(3, `la posición de ${que} (x y z)`);
    const q = nums(4, `el cuaternión de ${que} (qx qy qz qw)`), n2 = q.reduce((s, v) => s + v * v, 0);
    if (!(Math.abs(n2 - 1) < 1e-9)) mal.push(`${donde()}: el cuaternión de ${que} no está normalizado (|q|² − 1 = ${n2 - 1})`);
  };
  try {
    if (!ls[0] || !ls[0].trim()) throw new Error('línea 1: falta el nombre de la escena');
    i = 1;
    const ids = new Set();
    for (;;) {
      if (i >= ls.length) throw new Error('falta el «.» final');
      const l = ls[i];
      if (l === '.') { if (i !== ls.length - 1) throw new Error(`línea ${i + 1}: hay texto después del «.» final`); break; }
      if (!l.startsWith('* ')) throw new Error(`línea ${i + 1}: «${l}» y se esperaba «* <id>» o el «.» final`);
      i++;
      const id = l.slice(2);
      if (!id || /\s/.test(id)) mal.push(`${donde()}: id «${id}» vacío o con espacios`);
      if (ids.has(id)) mal.push(`${donde()}: id «${id}» repetido`); ids.add(id);
      pose(`«${id}»`);
      const n = entero(`el número de formas de «${id}»`);
      if (n < 1) mal.push(`${donde()}: «${id}» no tiene formas`);
      for (let k = 1; k <= n; k++) {
        if (i >= ls.length) throw new Error(`falta la forma ${k} de ${n} de «${id}»`);
        const tipo = ls[i++].trim();
        if (!(tipo in FORMAS_SCENE)) throw new Error(`${donde()}: tipo de forma desconocido «${tipo}» (forma ${k} de ${n} de «${id}»; ¿no cuadra su número de formas?)`);
        const d = nums(FORMAS_SCENE[tipo], `las dimensiones de un ${tipo} de «${id}»`);
        if (!d.every(v => v > 0)) mal.push(`${donde()}: las dimensiones de un ${tipo} de «${id}» deben ser > 0 (${d.join(' ')})`);
        pose(`la forma ${k} de «${id}»`);
        const c = nums(4, `el color r g b a de la forma ${k} de «${id}»`);
        if (!c.every(v => v >= 0 && v <= 1)) mal.push(`${donde()}: el color de la forma ${k} de «${id}» tiene valores fuera de [0, 1] (${c.join(' ')})`);
      }
      const s = entero(`el número de subframes de «${id}», tras sus ${n} formas (¿no cuadra el número de formas?)`);
      for (let k = 1; k <= s; k++) { if (i >= ls.length || !ls[i].trim()) throw new Error(`falta el nombre del subframe ${k} de «${id}»`); i++; pose(`el subframe ${k} de «${id}»`); }
    }
  } catch (e) { mal.push(e.message); }
  return mal;
}
