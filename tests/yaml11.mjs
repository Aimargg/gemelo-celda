// YAML 1.1 frente a YAML 1.2 en un fichero exportado (TD.3, DT42). Los scripts del grupo leen con PyYAML (YAML 1.1) y el
// gemelo se prueba con yaml@2.9.1 (1.2 por defecto; { version: '1.1' } aplica los tipos de 1.1: booleanos y/n/yes/no/on/off,
// timestamps…). yaml@2.9.1 no reproduce dos reglas de 1.1 que PyYAML sí aplica, y aquí se comprueban aparte:
//   · los saltos de línea: 1.1 corta también en U+0085, U+2028 y U+2029 (1.2 y yaml@2.9.1, solo en \r y \n). Un comentario
//     con uno de ellos sigue en la línea siguiente como contenido: la clave falsa de DT42. Se lee el texto cortado como 1.1;
//   · los caracteres no imprimibles (c-printable de 1.1, NON_PRINTABLE de PyYAML): con uno, PyYAML rechaza el fichero.
// problemas11(texto) devuelve la lista de lo que leería distinto un lector YAML 1.1 (vacía si se lee igual); cada entrada dice
// qué y dónde.
import YAML from 'yaml';

export const SALTOS_11 = /\r\n|[\r\n\u0085\u2028\u2029]/;
export const NO_IMPRIMIBLE = /[^\t\n\r\x20-\x7e\u0085\u00a0-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u;
const hex = c => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
const tipo = v => v === null ? 'null' : v instanceof Date ? 'timestamp' : Array.isArray(v) ? 'array' : typeof v;

// Diferencias entre lo que lee 1.1 (a) y 1.2 (b), con su ruta
function diferencias(a, b, ruta, out) {
  const ta = tipo(a), tb = tipo(b), r = ruta || '(raíz)';
  if (ta !== tb) { out.push(`${r}: YAML 1.1 lee ${ta} (${String(a)}) y 1.2, ${tb} (${String(b)})`); return; }
  if (ta === 'array') { if (a.length !== b.length) out.push(`${r}: ${a.length} elementos en 1.1 y ${b.length} en 1.2`); a.forEach((x, i) => i < b.length && diferencias(x, b[i], `${r}[${i}]`, out)); return; }
  if (ta === 'object') {
    for (const k of Object.keys(a)) if (!Object.hasOwn(b, k)) out.push(`${ruta ? `${ruta}.` : ''}${k}: clave que solo lee YAML 1.1`);
    for (const k of Object.keys(b)) if (!Object.hasOwn(a, k)) out.push(`${ruta ? `${ruta}.` : ''}${k}: clave que YAML 1.1 no lee`);
    for (const k of Object.keys(a)) if (Object.hasOwn(b, k)) diferencias(a[k], b[k], ruta ? `${ruta}.${k}` : k, out);
    return;
  }
  if (!Object.is(a, b)) out.push(`${r}: ${JSON.stringify(a)} en 1.1 y ${JSON.stringify(b)} en 1.2`);
}

export function problemas11(texto) {
  const out = [];
  texto.split('\n').forEach((l, i) => {
    for (const c of l) if (NO_IMPRIMIBLE.test(c)) out.push(`línea ${i + 1}: ${hex(c)}, no imprimible en YAML 1.1 (PyYAML rechaza el fichero)`);
    for (const c of l) if (/[\u0085\u2028\u2029]/.test(c)) out.push(`línea ${i + 1}: ${hex(c)}, salto de línea en YAML 1.1`);
  });
  const d12 = YAML.parseDocument(texto), d11 = YAML.parseDocument(texto.split(SALTOS_11).join('\n'), { version: '1.1' });
  for (const [v, d] of [['1.2', d12], ['1.1', d11]]) for (const e of [...d.errors, ...d.warnings]) out.push(`YAML ${v}: ${e.message.split('\n')[0]}`);
  if (!d11.errors.length && !d12.errors.length) diferencias(d11.toJS(), d12.toJS(), '', out);
  return out;
}
