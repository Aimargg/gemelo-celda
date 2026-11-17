// Validador de ficheros de parámetros de ROS 2 para --params-file (T2.2-C1): las reglas de rcl_yaml_param_parser (Jazzy)
// que rompen la carga, comprobadas con un analizador ajeno al gemelo (yaml@2.9.1, eemeli/yaml) y sin el código que genera
// los ficheros. Reglas (→ estudio estado-del-arte-gemelo-ros-generacion-config, leído en el código de la rama jazzy; nada
// probado en un contenedor ROS: lo valida el usuario en U4):
//   · YAML 1.1 (rcl lee con libyaml) y YAML 1.2 dan el mismo valor: nada como yes, on, una clave y, 0755 o 1_000 sueltos;
//   · raíz: un nombre de nodo (o /**) → ros__parameters → mapas anidados (rcl los convierte en nombres con punto);
//   · cada hoja es bool (true/false), entero, double con punto decimal en el texto o string entre comillas, o un array no
//     vacío de un solo tipo de esos escalares: nada de listas de mapas, listas de listas, null, anclas, alias ni etiquetas;
//   · un entero solo donde se espera un entero (opción `enteros`: rutas dentro de ros__parameters, p. ej.
//     'celda.marcadores.ids'). Un 203 sin comillas es un entero y no un string, y un 0 sin punto, un entero y no un double:
//     en los dos casos el nodo que declara el parámetro con otro tipo falla al cargarlo.
// Uso: problemasParams(texto, { enteros }) → lista de problemas (vacía si cumple).
import YAML from 'yaml';
import { isDeepStrictEqual } from 'node:util';

const DOUBLE = /^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/, ENTERO = /^[-+]?\d+$/;

// Primera ruta en la que difieren dos valores (para el mensaje de 1.1 frente a 1.2)
function diferencia(a, b, ruta = '') {
  if (isDeepStrictEqual(a, b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diferencia(a[k], b[k], ruta ? `${ruta}.${k}` : k); if (d) return d; }
  }
  return `${ruta || '(raíz)'}: ${JSON.stringify(a)} en YAML 1.1 y ${JSON.stringify(b)} en YAML 1.2`;
}

export function problemasParams(texto, { enteros = [] } = {}) {
  const mal = [];
  const doc = YAML.parseDocument(texto, { version: '1.2' });
  if (doc.errors.length) return doc.errors.map(e => `YAML no válido: ${e.message.split('\n')[0]}`);
  let v11; try { v11 = YAML.parse(texto, { version: '1.1' }); } catch (e) { return [`YAML 1.1 no válido: ${e.message.split('\n')[0]}`]; }
  const d = diferencia(v11, doc.toJS()); if (d) mal.push(`YAML 1.1 y 1.2 lo leen distinto: ${d}`);
  const fuente = n => texto.slice(n.range[0], n.range[1]);
  const marcas = (n, ruta) => { if (n.tag) mal.push(`${ruta}: etiqueta ${n.tag}`); if (n.anchor) mal.push(`${ruta}: ancla &${n.anchor}`); };
  // Tipo rcl de un escalar: 'bool', 'entero', 'double' o 'string'; null si no es ninguno (y lo apunta)
  function tipo(n, ruta) {
    marcas(n, ruta);
    if (n.type === 'QUOTE_SINGLE' || n.type === 'QUOTE_DOUBLE') return 'string';
    if (n.type !== 'PLAIN') { mal.push(`${ruta}: escalar de bloque (${n.type})`); return null; }
    const t = fuente(n), v = n.value;
    if (typeof v === 'boolean') return /^(true|false)$/.test(t) ? 'bool' : (mal.push(`${ruta}: booleano escrito «${t}»`), null);
    if (typeof v === 'number') {
      if (DOUBLE.test(t)) return 'double';
      if (ENTERO.test(t)) return 'entero';
      mal.push(`${ruta}: número «${t}» sin punto decimal o en una forma que rcl no lee igual`); return null;
    }
    if (v === null) { mal.push(`${ruta}: valor vacío o null`); return null; }
    mal.push(`${ruta}: string sin comillas «${t}»`); return null;
  }
  const entero = (ruta, t) => { if (t === 'entero' && !enteros.includes(ruta)) mal.push(`${ruta}: entero donde no se espera (escribe '…' si es un texto o con punto decimal si es un double)`); };
  function valor(n, ruta) {
    if (YAML.isAlias(n)) { mal.push(`${ruta}: alias`); return; }
    if (YAML.isMap(n)) { marcas(n, ruta); for (const p of n.items) clave(p, ruta, x => valor(p.value, x)); return; }
    if (YAML.isSeq(n)) {
      marcas(n, ruta);
      if (!n.items.length) { mal.push(`${ruta}: array vacío (rcl no sabe de qué tipo es)`); return; }
      const ts = new Set();
      for (const [i, it] of n.items.entries()) {
        if (YAML.isMap(it)) { mal.push(`${ruta}[${i}]: lista de mapas (rcl no las admite)`); continue; }
        if (YAML.isSeq(it)) { mal.push(`${ruta}[${i}]: lista de listas`); continue; }
        if (YAML.isAlias(it)) { mal.push(`${ruta}[${i}]: alias`); continue; }
        const t = tipo(it, `${ruta}[${i}]`); if (t) ts.add(t);
      }
      if (ts.size > 1) mal.push(`${ruta}: array con tipos mezclados (${[...ts].join(' y ')})`);
      else if (ts.size === 1) entero(ruta, [...ts][0]);
      return;
    }
    if (YAML.isScalar(n)) { entero(ruta, tipo(n, ruta)); return; }
    mal.push(`${ruta}: hoja sin valor`);
  }
  function clave(p, ruta, seguir) {
    if (!YAML.isScalar(p.key)) { mal.push(`${ruta || '(raíz)'}: clave que no es un escalar`); return; }
    marcas(p.key, ruta);
    const k = String(p.key.value);
    seguir(ruta ? `${ruta}.${k}` : k);
  }
  // Raíz: nombre de nodo → ros__parameters → parámetros
  const r = doc.contents;
  if (!YAML.isMap(r) || !r.items.length) return [...mal, 'la raíz no es un mapa de nombres de nodo'];
  for (const nodo of r.items) {
    const nombre = YAML.isScalar(nodo.key) ? String(nodo.key.value) : '?';
    if (!YAML.isMap(nodo.value) || nodo.value.items.length !== 1 || !YAML.isScalar(nodo.value.items[0].key) || nodo.value.items[0].key.value !== 'ros__parameters') { mal.push(`${nombre}: debe tener solo ros__parameters`); continue; }
    const params = nodo.value.items[0].value;
    if (!YAML.isMap(params)) { mal.push(`${nombre}.ros__parameters: no es un mapa de parámetros`); continue; }
    valor(params, '');
  }
  return mal;
}
