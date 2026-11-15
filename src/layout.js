// Versión de la disposición (layout) y su migración al cargar (T1.1, I1, I2). Sin navegador ni three: se prueba con
// node:test (tests/unit/layout.test.mjs) y se concatena en app.js con el marcador @@LAYOUT@@ (D4).
// Toda carga de un layout (Tu mesa, escenas del grupo, código de escena, YAML importado) pasa por migrarLayout.
const LAYOUT = (() => {
  const VERSION = 9;        // versión que escribe esta página
  const MAX_TXT = 50000;    // reglas de Firestore: el layout es un texto de 50.000 caracteres como máximo (I2)
  // Campos de la v9. `robotId` es el robot calibrado (T1.4 añadirá '203'–'206'); el campo `robot` sigue siendo la
  // posición A/B del brazo en la celda. `perfil`: perfil de movimiento (D6). `sensor`: modelo de sensor de las cámaras
  // (D10). En T1.1 ninguno cambia el comportamiento: T1.4, T1.6 y T1.7 les darán efecto.
  const ROBOT_IDS = ['nominal'], PERFILES = ['curso', 'gemelo'], SENSORES = ['elp-ficha', 'gemelo-v8'];
  const CAMPOS_V9 = ['version', 'robotId', 'perfil', 'sensor'];
  const NUEVA = { robotId: 'nominal', perfil: 'curso', sensor: 'elp-ficha' };   // escena nueva (layoutDefecto)
  const MIGRADA = { robotId: 'nominal', perfil: 'gemelo', sensor: 'gemelo-v8' }; // escena v8: conserva su comportamiento (I1, D6)
  const opcional = ruta => /^cams\.[^.]+\.roll$/.test(ruta); // giro de la imagen: 0 si falta (orientDe, espejo)
  const tipo = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const copia = o => JSON.parse(JSON.stringify(o));

  // ¿Tiene `v` la misma forma que `ref` (la disposición de partida)? Las claves de más se conservan sin comprobarlas.
  function forma(ref, v, ruta) {
    const t = tipo(ref), r = ruta || 'disposición';
    if (v === undefined) return `falta «${r}»`;
    if (t === 'number') return Number.isFinite(v) ? null : `«${r}» no es un número`;
    if (t === 'string') return typeof v === 'string' ? null : `«${r}» no es un texto`;
    if (t === 'boolean') return typeof v === 'boolean' ? null : `«${r}» no es sí o no`;
    if (t === 'array') {
      if (!Array.isArray(v)) return `«${r}» no es una lista`;
      if (v.length !== ref.length) return `«${r}» tiene ${v.length} elementos y debe tener ${ref.length}`;
      for (let i = 0; i < ref.length; i++) { const e = forma(ref[i], v[i], `${r}[${i}]`); if (e) return e; }
      return null;
    }
    if (tipo(v) !== 'object') return `«${r}» no es un objeto`;
    for (const k of Object.keys(ref)) {
      const rk = ruta ? `${ruta}.${k}` : k;
      if (!ruta && CAMPOS_V9.includes(k)) continue; // se comprueban aparte, según la versión
      if (v[k] === undefined && opcional(rk)) continue;
      const e = forma(ref[k], v[k], rk); if (e) return e;
    }
    return null;
  }

  // Devuelve null si el layout se puede aplicar tal cual, o el motivo por el que no (texto para el usuario).
  // esq: { ref: layoutDefecto(), robots: claves de BASES, modos: claves de MODOS, grupos: grupos de color de las cámaras }
  function validarLayout(l, esq) {
    if (tipo(l) !== 'object') return 'no es una disposición';
    if (l.version !== undefined && !(Number.isInteger(l.version) && l.version >= VERSION)) return `«version» no es válida (${JSON.stringify(l.version)})`;
    const e = forma(esq.ref, l, ''); if (e) return e;
    for (const k of Object.keys(l.cams)) if (!Object.hasOwn(esq.ref.cams, k)) return `cámara desconocida «${k}»`; // no vale «toString» ni «__proto__»
    if (!esq.robots.includes(l.robot)) return `«robot» debe ser ${esq.robots.join(' o ')}`;
    if (l.pedido !== 1 && l.pedido !== 2) return '«pedido» debe ser 1 o 2 platos';
    for (const k of Object.keys(l.cams)) {
      if (!esq.modos.includes(l.cams[k].modo)) return `«cams.${k}.modo» no es un modo de la cámara (${l.cams[k].modo})`;
      if (!esq.grupos.includes(l.cams[k].grupo)) return `«cams.${k}.grupo» no es un grupo (${l.cams[k].grupo})`;
    }
    if (l.version === VERSION) { // una versión más nueva puede tener otros valores: se abre en solo lectura
      for (const [k, lista] of [['robotId', ROBOT_IDS], ['perfil', PERFILES], ['sensor', SENSORES]]) {
        if (l[k] === undefined) return `falta «${k}»`;
        if (!lista.includes(l[k])) return `«${k}» desconocido (${JSON.stringify(l[k])})`;
      }
    }
    return null;
  }

  // Entrada: el layout como objeto o como texto JSON. Nunca modifica la entrada.
  // Salida: { layout, soloLectura } si se puede abrir, o { error } con el motivo.
  //  · Sin `version` (v8 o anterior): se completa como hacía normalizar() (caja y pedido si faltan) y se le añaden
  //    version 9, robotId 'nominal', perfil 'gemelo' y sensor 'gemelo-v8'. El resto se conserva tal cual.
  //  · Con una `version` mayor que la de esta página: se abre en solo lectura (no se guarda en local ni en el grupo).
  function migrarLayout(entrada, esq) {
    let l = entrada;
    if (typeof l === 'string') { try { l = JSON.parse(l); } catch (e) { return { error: `el texto no es JSON válido (${e.message})` }; } }
    if (tipo(l) !== 'object') return { error: 'no es una disposición' };
    l = copia(l);
    if (l.version === undefined) {
      if (!l.caja) l.caja = copia(esq.ref.caja);
      if (!l.pedido) l.pedido = 2;
      Object.assign(l, { version: VERSION }, MIGRADA);
    }
    const error = validarLayout(l, esq);
    return error ? { error } : { layout: l, soloLectura: l.version > VERSION };
  }
  const soloLectura = l => !!l && l.version > VERSION;
  // Motivo por el que un layout ya serializado no se puede guardar en el grupo, o null
  const noGuardable = txt => txt.length > MAX_TXT ? `la disposición ocupa ${txt.length.toLocaleString('es-ES')} caracteres y el máximo es ${MAX_TXT.toLocaleString('es-ES')}` : null;

  return { VERSION, MAX_TXT, ROBOT_IDS, PERFILES, SENSORES, NUEVA, MIGRADA, validarLayout, migrarLayout, soloLectura, noGuardable };
})();
if (typeof module !== 'undefined') module.exports = LAYOUT;
