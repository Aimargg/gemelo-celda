// Generador pseudoaleatorio sembrado y semilla por petición del planificador (T1.2, D5, I6). Sin navegador ni three:
// se prueba con node:test (tests/unit/rng.test.mjs) y se concatena en app.js con el marcador @@RNG@@ (D4).
const RNG = (() => {
  // xorshift32, el mismo de la v8 (texturas, modelo de colisión y RRT): la misma semilla da siempre la misma serie
  function aleat(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  // FNV-1a de 32 bits sobre los códigos del texto (en ASCII coincide con el de los bytes)
  function fnv1a(txt) { let h = 0x811c9dc5; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  const n6 = v => String(Math.round(v * 1e6)); // redondeo a 1e-6 (−0 sale «0»)
  const lista = a => a ? Array.from(a, n6).join(',') : '-';
  // Un obstáculo en texto: todas sus claves en orden alfabético (números a 1e-6), así vale para cualquier tipo de obstáculo
  function obstaculo(o) {
    let s = ''; for (const k of Object.keys(o).sort()) { const v = o[k]; if (v === undefined) continue; s += `${k}=${typeof v === 'number' ? n6(v) : typeof v === 'boolean' ? +v : v}|`; }
    return s;
  }
  // Entrada canónica de una petición de plan: q inicial y objetivo, contexto (apertura de la pinza, carga, etiquetas
  // permitidas y opciones) y obstáculos, más el perfil de movimiento. Los obstáculos se ordenan: su orden en la lista no
  // cambia si un tramo choca, así que tampoco cambia la semilla.
  function canonico(p) {
    return ['plan1', `qa:${lista(p.qa)}`, `qb:${lista(p.qb)}`, `w:${n6(p.w)}`, `carga:${lista(p.carga)}`,
      `permitir:${(p.permitir || []).slice().sort().join(',')}`, `op:${[p.conBlandos, p.sinEntorno, p.sinAuto].map(b => b ? 1 : 0).join('')}`,
      `perfil:${p.perfil}`, `obst:${p.obst ? p.obst.map(obstaculo).sort().join(';') : '-'}`].join('\n');
  }
  const semillaPlan = p => fnv1a(canonico(p));
  return { aleat, fnv1a, canonico, semillaPlan };
})();
if (typeof module !== 'undefined') module.exports = RNG;
