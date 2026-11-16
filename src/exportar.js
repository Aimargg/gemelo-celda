// Formateador de los ficheros exportados (T2.2–T2.5, D8, I7): convierte el modelo de modeloExportacion() (app.js: un objeto
// plano, sin redondear y en el base_link del robot elegido) en texto. Sin DOM, three ni globales del gemelo: el origen de
// cada valor lo da el módulo de origen que recibe cada función (src/origen.js en el gemelo) con el contexto del modelo
// (m.ctx), y aquí no se escribe ningún tipo de origen a mano. Se prueba con node:test en un contexto vm vacío
// (tests/unit/exportar.test.mjs y exportar-escena.test.mjs) y se concatena en app.js con el marcador @@EXPORTAR@@ (D4).
// Modelo (todo en metros y radianes, en m.robot.frame salvo world_a_base_link y pose_en_world_doble):
//   ctx (contexto de origen) · layoutJson (JSON.stringify(L)) · robot { posicion, id, idLayout, desconocido, sospechoso,
//   yaw, prefijo, frame, worldABase {x, y, z}, doble { nombre, x, y, z, yaw } | null } · pinza { modelo, tcpZ, carrera } ·
//   mesa { ancho, fondo, alto, x, y, z, yaw } · pedido · platos { sobreCaja, cajaAlto, cajaLado, agarre, radioAgarre,
//   lista [{ clave, x, y, z }] } · zona { x, y, z, yaw, ancho, fondo } · marcadores [{ id, diccionario, lado, x, y, z, yaw }]
//   · bandeja { x, y, z, yaw, zonas [{ clave, base {x, y, z}, local {x, y, z} }] } · persona { x, y, z, yaw } ·
//   camaras [{ clave, grupo, modelo, focal, modo, hfov, vfov, px { w, h, fps }, pos, mira, clamp, orient { pan, tilt, roll },
//   rpy [r, p, y], usb { dispositivo, exposicion, balance } }] · escena { objetos [{ id, que, giro?, pose { x, y, z, rpy },
//   formas [{ tipo: 'caja' (dims [x, y, z]) | 'esfera' (radio) | 'cilindro' (radio, altura; eje z del objeto) | 'capsula'
//   (radio, a {x, y, z}, b {x, y, z}), local {x, y, z} (en el marco del objeto) o centro {x, y, z} (en base_link) }] }] }
const EXPORTAR = (() => {
  const PI = Math.PI, R2D = 180 / PI;
  // Números (I7): metros y radianes con 3 decimales (1 mm y 0,001 rad); los ángulos, en [−π, π] antes de redondear
  const r3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
  const envolver = a => { let d = a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; }; // angDiff(a, 0) de app.js
  const rad3 = a => r3(envolver(a));
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const grados = a => `${fmt(a * R2D, 1).replace('-', '−')}°`; // gradosTxt de app.js
  const P = p => `{x: ${r3(p.x)}, y: ${r3(p.y)}, z: ${r3(p.z)}}`;

  // ---------- Cabecera común: robot y calibración, frame y prefijo (las mismas líneas que posiciones.yaml) ----------
  function lineaRobot(m) {
    const R = m.robot;
    const quien = R.desconocido ? `«${R.idLayout}» (desconocido para esta versión del gemelo: se usa la cinemática nominal)`
      : R.id === 'nominal' ? 'nominal (sin identificar: cinemática nominal del UR3e)'
        : `${R.id} (calibration_${R.id}.yaml del curso${R.sospechoso ? '; calibración sospechosa, SIN VALIDAR' : ''})`;
    return `# Robot: ${quien}, en la posición ${R.posicion} de la celda (${R.posicion === 'B' ? 'derecha' : 'izquierda'} en la foto cenital).\n`;
  }
  function lineaFrame(m) {
    const R = m.robot, pf = R.prefijo;
    const como = R.doble ? ` (prefijo «${pf}» del URDF doble ${R.doble.nombre}.urdf.xacro)` : pf ? ` (prefijo «${pf}» de la disposición; esta versión del gemelo no conoce su URDF doble)` : ' (sin prefijo, como en sim_<id>)';
    return `# Frame: ${R.frame}${como}. Metros y radianes (REP-103), redondeo a 1 mm y 0,001 rad.\n`;
  }

  // ---------- posiciones.yaml (T1.5, T2.1): el mismo texto que escribía generarYaml ----------
  // fecha: 'AAAA-MM-DD' (la única línea que cambia de un día a otro)
  function posiciones(m, O, fecha) {
    const c = m.ctx, og = k => O.yaml(k, c), ot = k => O.tipo(k, c);
    const R = m.robot, frame = R.frame, sup = `# ${og('disposicion')}`;
    // Lo que depende del giro world → base_link (mount_yaw − π) lleva el origen de la orientación de base_link mientras no se
    // valide en ROS (corrección 6 de T1.5)
    const conGiro = R.yaw !== 0, giroSup = `${ot('orientacion_base_link')} (giro world→base_link sin validar en ROS)`;
    let y = `# posiciones.yaml · gemelo de la celda UR3e · BORRADOR (generado por IA)\n`;
    y += lineaRobot(m) + lineaFrame(m);
    y += `# world: el world del gemelo, con los ejes de la mesa y el origen en el centro de la base sobre el tablero [${ot('orientacion_base_link')} hasta comprobarlo en el laboratorio].\n`;
    y += `# ${frame} está girado ${rad3(R.yaw)} rad (${grados(R.yaw)}) respecto a ese world: mount_yaw − π del xacro del curso [SIN VALIDAR en ROS; docs/estado/frames.md].\n`;
    y += `# Origen de cada valor, al final de su línea: ${O.LEYENDA}. Las cámaras dan el giro desde +y de ${frame} hacia +x.\n`;
    y += `fecha: ${fecha}\nrobot: ${R.posicion}  # ${og(R.posicion === 'B' ? 'base_b' : 'base_a')}\nrobot_id: ${R.desconocido ? `${R.idLayout}  # de la disposición; el gemelo no lo conoce y usa la cinemática nominal` : `${R.id}  # ${O.ELEGIDO}`}\n`;
    const w = R.worldABase;
    y += `frame: ${frame}\nprefijo_frames: '${R.prefijo}'\nworld_a_base_link: {x: ${r3(w.x)}, y: ${r3(w.y)}, z: ${r3(w.z)}, yaw_rad: ${rad3(R.yaw)}}  # world del gemelo (ejes de la mesa): ${ot('orientacion_base_link')} · giro: mount_yaw − π del xacro del curso, ${og('orientacion_base_link')}\n`;
    if (R.doble) y += `pose_en_world_doble: {frame: ${frame}, x: ${r3(R.doble.x)}, y: ${r3(R.doble.y)}, z: ${r3(R.doble.z)}, yaw_rad: ${rad3(R.doble.yaw)}}  # xacro del curso, ${R.doble.nombre}: ${og('pose_doble')}\n`;
    y += `pinza: {modelo: ${m.pinza.modelo}, tcp_z_m: ${r3(m.pinza.tcpZ)}, carrera_m: ${r3(m.pinza.carrera)}}  # tcp_z: ${og('tcp_pinza')} · carrera: ${og('pinza')}\n`;
    const me = m.mesa;
    y += `mesa: {ancho_m: ${r3(me.ancho)}, fondo_m: ${r3(me.fondo)}, alto_m: ${r3(me.alto)}, centro_en_base_link: {x: ${r3(me.x)}, y: ${r3(me.y)}}, yaw_rad: ${rad3(me.yaw)}}  # ${conGiro ? `medidas: ${og('mesa')} · centro_en_base_link y yaw_rad: ${giroSup}` : og('mesa')}\n`;
    y += `pedido: ${m.pedido === 1 ? 'un_plato  # al centro de la bandeja' : 'dos_platos  # primero y segundo'} · ${O.ELEGIDO}\n`;
    const pl = m.platos;
    y += `platos: {sobre_caja: ${pl.sobreCaja}, caja_alto_m: ${r3(pl.cajaAlto)}, caja_lado_m: ${r3(pl.cajaLado)}, agarre: ${pl.agarre}, radio_agarre_m: ${r3(pl.radioAgarre)}}  # agarre: ${og('agarre_plato')} · resto: ${og('caja_plato')}\n`;
    const z = m.zona;
    y += `objetos:\n  zona_fruta: {x: ${r3(z.x)}, y: ${r3(z.y)}, z: ${r3(z.z)}, yaw_rad: ${rad3(z.yaw)}, ancho_m: ${r3(z.ancho)}, fondo_m: ${r3(z.fondo)}}  ${sup}\n`;
    for (const p of pl.lista) y += `  ${p.clave}: ${P(p)}  ${sup}\n`;
    m.marcadores.forEach((a, i) => { y += `  marcador_entrega_${i + 1}: {id: ${a.id}, diccionario: ${a.diccionario}, x: ${r3(a.x)}, y: ${r3(a.y)}, z: ${r3(a.z)}}  ${sup}\n`; });
    const b = m.bandeja; y += `  bandeja_recepcion: {x: ${r3(b.x)}, y: ${r3(b.y)}, z: ${r3(b.z)}, yaw_rad: ${rad3(b.yaw)}}  ${sup}\n`;
    for (const zb of b.zonas) y += `  ${zb.clave}: ${P(zb.base)}  ${sup}\n`;
    const pe = m.persona; y += `  persona: {x: ${r3(pe.x)}, y: ${r3(pe.y)}, yaw_rad: ${rad3(pe.yaw)}}  ${sup}\ncamaras:\n`;
    for (const k of m.camaras) { const o = k.orient; y += `  camara_${k.clave}: {grupo: ${k.grupo}, modelo: ${k.modelo}, focal_mm: ${k.focal.toFixed(1)}, modo: ${k.modo}, hfov_rad: ${r3(k.hfov)}, posicion: ${P(k.pos)}, mira: ${P(k.mira)}, orientacion_rad: {giro: ${rad3(o.pan)}, inclinacion: ${rad3(o.tilt)}, alabeo: ${rad3(o.roll)}}, pinza_mesa: ${P(k.clamp)}}  # pose: ${ot('disposicion')} · modelo: ${og('camaras')} · focal y modo: elegidos · hfov: ${og('campo_vision')}\n`; }
    y += `# layout-json: ${m.layoutJson}\n`;
    return y;
  }

  // ---------- Texto seguro para los ficheros de ROS (decisiones 2 y 3 del brief de T2.2–T2.4) ----------
  // Un número que no sea finito no se escribe: rcl lo leería como string o fallaría al cargar
  const num = v => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`exportar: valor no numérico (${v})`); return v; };
  const d3 = v => r3(num(v)), a3 = v => rad3(num(v)); // double de metros o de radianes: siempre con punto decimal
  const ent = v => { if (!Number.isInteger(v)) throw new Error(`exportar: se esperaba un entero (${v})`); return String(v); };
  const limpio = s => String(s).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' '); // sin saltos de línea ni de control
  const cad = s => `'${limpio(s).replace(/'/g, "''")}'`; // string entre comillas simples: YAML 1.1 y 1.2 la leen igual
  const lista = vs => `[${vs.join(', ')}]`; // array homogéneo (sin listas de mapas: rcl no las admite)
  const xyz = p => lista([d3(p.x), d3(p.y), d3(p.z)]);
  const comentario = l => limpio(l.slice(0, -1)) + '\n'; // una línea de cabecera con texto de la disposición

  // Huella de la disposición: FNV-1a de 32 bits de los bytes UTF-8 de JSON.stringify(L), en 8 cifras hexadecimales
  function huella(texto) {
    let h = 0x811c9dc5;
    const b = x => { h = Math.imul(h ^ x, 0x01000193) >>> 0; };
    for (const ch of String(texto)) {
      const c = ch.codePointAt(0);
      if (c < 0x80) b(c);
      else if (c < 0x800) { b(0xc0 | c >> 6); b(0x80 | c & 63); }
      else if (c < 0x10000) { b(0xe0 | c >> 12); b(0x80 | c >> 6 & 63); b(0x80 | c & 63); }
      else { b(0xf0 | c >> 18); b(0x80 | c >> 12 & 63); b(0x80 | c >> 6 & 63); b(0x80 | c & 63); }
    }
    return h.toString(16).padStart(8, '0');
  }

  // Árbol de parámetros: hoja (clave, valor ya escrito, comentario de origen) o mapa (clave, hijos); un mapa anidado es un
  // nombre con punto para rcl (celda.mesa.xyz)
  const hoja = (k, v, o) => ({ k, v, o });
  const mapa = (k, ...hijos) => ({ k, hijos: hijos.filter(Boolean) });
  const bloque = (nodos, n) => nodos.map(x => x.hijos ? `${' '.repeat(n)}${x.k}:\n${bloque(x.hijos, n + 2)}` : `${' '.repeat(n)}${x.k}: ${x.v}  # ${limpio(x.o)}\n`).join('');
  const raiz = nodos => `/**:\n  ros__parameters:\n${bloque(nodos, 4)}`;

  // Cabecera de los ficheros de ROS (decisión 8): sin fecha, con el robot, el frame, la huella y cómo se carga
  function cabecera(m, O, nombre, carga, extra = [], donde = 'al final de su línea') {
    return [`# ${nombre} · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR\n`, comentario(lineaRobot(m)), comentario(lineaFrame(m)),
      `# Huella de la disposición: ${huella(m.layoutJson)} (FNV-1a de 32 bits de JSON.stringify(L), en UTF-8): casa este fichero con su disposición.\n`,
      `# Carga: ${carga} [SIN VALIDAR en ROS: U4].\n`, ...extra.map(l => `# ${l}\n`),
      `# Origen de cada valor, ${donde}: ${O.LEYENDA}; lo que se elige en el gemelo, «${O.ELEGIDO}».\n`].join('');
  }

  // ---------- parametros_celda.yaml (T2.2): ros__parameters para --params-file ----------
  // Los mismos números que posiciones.yaml, escritos igual, más los frame_id de las TF, el rpy del marco de cada cámara y el
  // giro y el lado de cada marcador. Todas las poses en m.robot.frame.
  function parametros(m, O) {
    const c = m.ctx, og = k => O.yaml(k, c), ot = k => O.tipo(k, c), EL = O.ELEGIDO;
    const R = m.robot, sup = og('disposicion'), nom = og('nombre_frame');
    const giro = R.yaw !== 0 ? `${ot('orientacion_base_link')} (giro world→base_link sin validar en ROS)` : og('mesa'); // como posiciones.yaml
    const me = m.mesa, pl = m.platos, z = m.zona, b = m.bandeja, pe = m.persona;
    const nodos = [
      mapa('robot',
        hoja('posicion', cad(R.posicion), EL),
        hoja('id', cad(R.idLayout), R.desconocido ? `${EL} (de la disposición: el gemelo no lo conoce y usa la cinemática nominal)` : EL),
        hoja('frame', cad(R.frame), `${EL} (el prefijo; base_link es el del URDF)`),
        hoja('prefijo_frames', cad(R.prefijo), EL),
        mapa('world_a_base_link',
          hoja('xyz', xyz(R.worldABase), `${ot('orientacion_base_link')} (world del gemelo: ejes de la mesa, origen en la base sobre el tablero)`),
          hoja('yaw', a3(R.yaw), `${og('orientacion_base_link')}: mount_yaw − π del xacro del curso`)),
        R.doble && mapa('pose_en_world_doble', hoja('xyz', xyz(R.doble), og('pose_doble')), hoja('yaw', a3(R.doble.yaw), og('pose_doble')))),
      mapa('pinza', hoja('modelo', cad(m.pinza.modelo), og('pinza')), hoja('tcp_z_m', d3(m.pinza.tcpZ), og('tcp_pinza')), hoja('carrera_m', d3(m.pinza.carrera), og('pinza'))),
      mapa('mesa', hoja('frame_id', cad('mesa'), nom), hoja('tamano_m', lista([d3(me.ancho), d3(me.fondo), d3(me.alto)]), og('mesa')), hoja('xyz', xyz(me), giro), hoja('yaw', a3(me.yaw), giro)),
      hoja('pedido', cad(m.pedido === 1 ? 'un_plato' : 'dos_platos'), EL),
      mapa('platos',
        hoja('sobre_caja', pl.sobreCaja ? 'true' : 'false', EL),
        hoja('caja_tamano_m', lista([d3(pl.cajaLado), d3(pl.cajaLado), d3(pl.cajaAlto)]), og('caja_plato')),
        hoja('agarre', cad(pl.agarre), og('agarre_plato')),
        hoja('radio_agarre_m', d3(pl.radioAgarre), og('caja_plato')),
        ...pl.lista.map(p => mapa(p.clave, hoja('frame_id', cad(`${p.clave}_inicio`), nom), hoja('xyz', xyz(p), sup)))),
      mapa('zona_fruta', hoja('frame_id', cad('zona_fruta'), nom), hoja('xyz', xyz(z), sup), hoja('yaw', a3(z.yaw), sup), hoja('tamano_m', lista([d3(z.ancho), d3(z.fondo)]), sup)),
      mapa('marcadores',
        hoja('ids', lista(m.marcadores.map(a => ent(a.id))), og('marcadores')),
        ...m.marcadores.map(a => mapa(`marcador_${ent(a.id)}`, hoja('frame_id', cad(`marcador_${ent(a.id)}`), nom), hoja('xyz', xyz(a), sup), hoja('yaw', a3(a.yaw), sup),
          hoja('lado_m', d3(a.lado), og('lado_marcador')), hoja('diccionario', cad(a.diccionario), og('marcadores'))))),
      mapa('bandeja', hoja('frame_id', cad('bandeja'), nom), hoja('xyz', xyz(b), sup), hoja('yaw', a3(b.yaw), sup),
        ...b.zonas.map(zb => mapa(zb.clave, hoja('frame_id', cad(zb.clave), nom), hoja('xyz', xyz(zb.base), sup)))),
      mapa('persona', hoja('xy', lista([d3(pe.x), d3(pe.y)]), sup), hoja('yaw', a3(pe.yaw), sup)),
      mapa('camaras',
        hoja('nombres', lista(m.camaras.map(k => cad(k.clave))), nom),
        ...m.camaras.map(k => mapa(k.clave,
          hoja('frame_id', cad(`camara_${k.clave}_optical`), nom),
          hoja('grupo', cad(k.grupo), EL),
          hoja('modelo', cad(k.modelo), og('camaras')),
          hoja('focal_mm', num(k.focal).toFixed(1), EL),
          hoja('modo', cad(k.modo), EL),
          hoja('hfov_rad', d3(k.hfov), og('campo_vision')),
          hoja('xyz', xyz(k.pos), sup),
          hoja('rpy', lista(k.rpy.map(a3)), `${sup}; marco camara_${limpio(k.clave)} (REP-103: x hacia donde mira, y a la izquierda, z arriba)`),
          hoja('mira', xyz(k.mira), sup),
          mapa('orientacion_rad', hoja('giro', a3(k.orient.pan), sup), hoja('inclinacion', a3(k.orient.tilt), sup), hoja('alabeo', a3(k.orient.roll), sup)),
          hoja('pinza_mesa', xyz(k.clamp), sup)))),
    ];
    return cabecera(m, O, 'parametros_celda.yaml', 'ros2 run <paquete> <nodo> --ros-args --params-file parametros_celda.yaml (la raíz /** vale para cualquier nodo)', [
      `${limpio(R.frame)} está girado ${rad3(R.yaw)} rad (${grados(R.yaw)}) respecto al world del gemelo (ejes de la mesa): mount_yaw − π del xacro del curso [SIN VALIDAR en ROS].`,
      `Poses en ${limpio(R.frame)}: xyz [x, y, z] en m y rpy [roll, pitch, yaw] en rad (setRPY: R = Rz(yaw)·Ry(pitch)·Rx(roll), ejes fijos), o solo yaw si el objeto solo gira en z; tamaños en m; focal_mm en mm (DT19).`,
      'world_a_base_link y pose_en_world_doble: la pose de base_link en el world del gemelo y en el del URDF doble. frame_id: el frame de la TF del objeto (tf_estaticas.sh).',
      'Nombres en celda: robot (posicion, id, frame, prefijo_frames, world_a_base_link, pose_en_world_doble), pinza, mesa, pedido, platos (caja_tamano_m, plato_1, plato_2),',
      '  zona_fruta, marcadores (ids, marcador_<id>), bandeja (zona_primero, zona_segundo), persona (xy, yaw) y camaras (nombres, <nombre>: frame_id del marco óptico,',
      '  xyz y rpy del marco camara_<nombre>, mira, orientacion_rad como en posiciones.yaml y pinza_mesa).',
    ]) + raiz([mapa('celda', ...nodos)]);
  }

  // ---------- TF estáticas (T2.4): un tf/<child_frame_id>.yaml por arista y tf_estaticas.sh ----------
  const OPTICO = [-PI / 2, 0, -PI / 2]; // camara_<k> → camara_<k>_optical (REP-103), fijo
  // Cuaternión (x, y, z, w) de setRPY de tf2 (R = Rz(yaw)·Ry(pitch)·Rx(roll), ejes fijos) con los ángulos tal como se escriben
  // (3 decimales): el YAML y el comando dan el mismo giro. Normalizado y en enteros de 1e-9 (se escriben con 9 decimales).
  // Redondear cada componente por separado aleja |q|² de 1 hasta 2e-9: de las 81 combinaciones de ±1e-9 alrededor del
  // redondeo se queda la de |q|² más cerca de 1 (con empate, la de menos cambios); el giro cambia menos de 1e-8 rad.
  function cuaternion(rpy) {
    const [r, p, y] = rpy.map(a => +a3(a)), h = a => [Math.cos(a / 2), Math.sin(a / 2)];
    const [cr, sr] = h(r), [cp, sp] = h(p), [cy, sy] = h(y);
    return q9([sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy, cr * cp * cy + sr * sp * sy]);
  }
  // Un cuaternión (x, y, z, w) cualquiera, normalizado y en enteros de 1e-9, con la misma búsqueda de la norma más cercana a 1
  function q9(q) {
    const n = Math.hypot(...q), base = q.map(v => Math.round(v / n * 1e9));
    let mejor = base, e0 = Infinity, c0 = 5;
    for (let i = 0; i < 81; i++) {
      const d = [i % 3, (i / 3 | 0) % 3, (i / 9 | 0) % 3, (i / 27 | 0) % 3].map(k => k - 1), cand = base.map((v, j) => v + d[j]);
      const e = Math.abs(cand.reduce((s, v) => s + (v * 1e-9) ** 2, 0) - 1), cambios = d.filter(Boolean).length;
      if (e < e0 - 1e-15 || (Math.abs(e - e0) <= 1e-15 && cambios < c0)) { mejor = cand; e0 = e; c0 = cambios; }
    }
    return mejor;
  }
  const dec9 = n => `${n < 0 ? '-' : ''}${Math.floor(Math.abs(n) / 1e9)}.${String(Math.abs(n) % 1e9).padStart(9, '0')}`; // entero de 1e-9 → texto
  // Un argumento de bash: tal cual si es un nombre normal; si no, entre comillas simples (nada de la disposición se ejecuta)
  const sh = s => /^[A-Za-z0-9_./:-]+$/.test(s) ? s : `'${limpio(s).replace(/'/g, "'\\''")}'`;

  // Aristas de la decisión 6, en orden fijo: { padre, hijo, p {x, y, z}, rpy, origen, que, nominal }. La raíz es
  // <prefijo>base_link (sin arista a world: la publica el URDF); los frames de la celda no llevan prefijo.
  function aristas(m, O) {
    const c = m.ctx, og = k => O.yaml(k, c), ot = k => O.tipo(k, c);
    const raizTF = m.robot.frame, sup = og('disposicion'), cero = { x: 0, y: 0, z: 0 };
    const giro = m.robot.yaw !== 0 ? `${ot('orientacion_base_link')} (giro world→base_link sin validar en ROS)` : og('mesa'); // como posiciones.yaml
    const A = [], a = (padre, hijo, p, rpy, origen, que, nominal = null) => A.push({ padre, hijo, p, rpy, origen, que, nominal });
    a(raizTF, 'mesa', m.mesa, [0, 0, m.mesa.yaw], giro, 'centro de la cara de arriba de la mesa, con su giro');
    a(raizTF, 'zona_fruta', m.zona, [0, 0, m.zona.yaw], sup, 'centro y giro de la zona de fruta');
    for (const p of m.platos.lista) a(raizTF, `${p.clave}_inicio`, p, [0, 0, m.mesa.yaw], sup, `dónde está el ${p.clave.replace('_', ' ')} antes de cogerlo, con los ejes de la mesa (el robot lo mueve y una TF estática no lo sigue)`);
    for (const k of m.marcadores) a(raizTF, `marcador_${ent(k.id)}`, k, [0, 0, k.yaw], sup, `marcador de entrega ${ent(k.id)} (${limpio(k.diccionario)}), plano sobre la mesa y con sus ejes; convenio de ArUco de OpenCV: z sale de la cara impresa, x a la derecha e y hacia arriba del patrón`);
    a(raizTF, 'bandeja', m.bandeja, [0, 0, m.bandeja.yaw], sup, 'pose de plan de la bandeja (sin balanceo), en la cara de arriba', 'nominal: la sustituye la pose que publique Visión');
    for (const z of m.bandeja.zonas) a('bandeja', z.clave, z.local, [0, 0, 0], og('plato_bandeja_persona'), `${z.clave}, donde se deja un plato en la bandeja: cuelga de la bandeja para seguirla cuando Visión publique su pose`);
    for (const k of m.camaras) {
      const cam = `camara_${limpio(k.clave)}`;
      a(raizTF, cam, k.pos, k.rpy, sup, `marco del cuerpo de la cámara ${limpio(k.clave)} (REP-103): x hacia donde mira, y a la izquierda, z arriba`, 'nominal: la sustituye la calibración');
      a(cam, `${cam}_optical`, cero, OPTICO, og('marco_optico'), `marco óptico de la cámara ${limpio(k.clave)} (REP-103): z hacia donde mira, x a la derecha e y hacia abajo de la imagen`);
    }
    return A;
  }
  const ESCENA_DOBLE = 'En una escena doble, carga las TF de un solo robot: cada frame admite un único padre.';
  // tf/<hijo>.yaml: los 9 parámetros de tf2_ros::StaticTransformBroadcasterNode (translation.*, rotation.*, frame_id y
  // child_frame_id). Las claves x, y, z y w van entre comillas: YAML 1.1 lee una «y» suelta como true.
  function tfYaml(m, O, e) {
    const EL = O.ELEGIDO, nom = O.yaml('nombre_frame', m.ctx), q = cuaternion(e.rpy), [r, p, y] = e.rpy.map(a3);
    const nodos = [
      hoja('frame_id', cad(e.padre), e.padre === m.robot.frame ? `${EL} (el prefijo; base_link es el del URDF)` : nom),
      hoja('child_frame_id', cad(e.hijo), nom),
      mapa('translation', ...['x', 'y', 'z'].map(k => hoja(`'${k}'`, d3(e.p[k]), e.origen))),
      mapa('rotation', ...['x', 'y', 'z', 'w'].map((k, i) => hoja(`'${k}'`, dec9(q[i]), e.origen))),
    ];
    return cabecera(m, O, `tf/${e.hijo}.yaml`, `ros2 component standalone tf2_ros tf2_ros::StaticTransformBroadcasterNode --ros-args --params-file tf/${e.hijo}.yaml -r __node:=tf_${e.hijo}`, [
      `TF estática ${limpio(e.padre)} → ${e.hijo}: ${e.que}.${e.nominal ? ` ${e.nominal}.` : ''}`,
      `Giro: roll ${r}, pitch ${p}, yaw ${y} rad (setRPY: R = Rz(yaw)·Ry(pitch)·Rx(roll), ejes fijos), en cuaternión (x, y, z, w) normalizado con 9 decimales.`,
      'Las claves x, y, z y w van entre comillas: YAML 1.1 lee una «y» suelta como true.',
      ESCENA_DOBLE,
    ]) + raiz(nodos);
  }
  // tf_estaticas.sh: un static_transform_publisher (flags con nombre, ángulos en rad) por arista, en segundo plano, y wait
  function script(m, O, A) {
    let t = '#!/bin/bash\n' + cabecera(m, O, 'tf_estaticas.sh', 'bash tf_estaticas.sh, con ROS 2 Jazzy en el entorno: una static_transform_publisher por TF; Ctrl+C las para todas', [
      ESCENA_DOBLE, 'Metros y radianes; los ángulos, con setRPY (R = Rz(yaw)·Ry(pitch)·Rx(roll), ejes fijos). Los mismos números que tf/<child_frame_id>.yaml.',
    ], 'en la línea anterior a cada comando');
    t += "trap 'kill $(jobs -p) 2>/dev/null' INT TERM\n";
    for (const e of A) {
      const [r, p, y] = e.rpy.map(a3);
      t += `# ${limpio(e.padre)} → ${e.hijo}: ${limpio(e.origen)}${e.nominal ? ` · ${e.nominal}` : ''}\n`;
      t += `ros2 run tf2_ros static_transform_publisher --x ${d3(e.p.x)} --y ${d3(e.p.y)} --z ${d3(e.p.z)} --roll ${r} --pitch ${p} --yaw ${y} --frame-id ${sh(e.padre)} --child-frame-id ${sh(e.hijo)} --ros-args -r __node:=tf_${e.hijo} &\n`;
    }
    return t + 'wait\n';
  }

  // Ficheros de ROS de una disposición, en orden fijo: [{ nombre, texto }]: parametros_celda.yaml, tf/<child_frame_id>.yaml de cada
  // arista y tf_estaticas.sh
  function ficherosRos(m, O) {
    const A = aristas(m, O);
    return [{ nombre: 'parametros_celda.yaml', texto: parametros(m, O) }, ...A.map(e => ({ nombre: `tf/${e.hijo}.yaml`, texto: tfYaml(m, O, e) })), { nombre: 'tf_estaticas.sh', texto: script(m, O, A) }];
  }

  // ---------- Escena de colisión (T2.3): escena_colision.yaml (CollisionObject en <prefijo>base_link) y celda.scene (world) ----------
  // Cada objeto de m.escena.objetos pasa a { id, que, giro, p, q, formas }: la posición a 1 mm y el cuaternión de setRPY con
  // los ángulos a 0,001 rad (el mismo que su TF, si la tiene), y por forma su tipo de shape_msgs/SolidPrimitive, sus
  // dimensiones a 1 mm y su pose relativa a la del objeto (CollisionObject: primitive_poses son relativas a pose). Una forma
  // con `local` lleva esa posición en el marco del objeto; con `centro` (en base_link), la que la deja en ese punto con la pose
  // del objeto ya redondeada (Rᵀ·(centro − p)), para que el redondeo de la pose del objeto no se sume al de la forma. Una
  // cápsula de obstaculos() es un CYLINDER entre sus dos extremos más una SPHERE en cada extremo.
  const BOX = 1, SPHERE = 2, CYLINDER = 3; // shape_msgs/SolidPrimitive: dimensions BOX [x, y, z], SPHERE [radio], CYLINDER [altura, radio]
  const ID = [0, 0, 0, 1e9];
  const matQ = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
  const aObjeto = (R, v) => [0, 1, 2].map(j => R[0][j] * v[0] + R[1][j] * v[1] + R[2][j] * v[2]); // Rᵀ·v
  const aPadre = (R, v) => R.map(f => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]); // R·v
  const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const mm = v => +d3(v); // el número tal como se escribe (1 mm)
  const arco = d => d[2] < -1 + 1e-12 ? q9([1, 0, 0, 0]) : q9([-d[1], d[0], 0, 1 + d[2]]); // lleva +z a la dirección unitaria d (giro más corto)
  function objetosEscena(m) {
    return m.escena.objetos.map(o => {
      const p = [o.pose.x, o.pose.y, o.pose.z].map(mm), q = cuaternion(o.pose.rpy), R = matQ(q.map(v => v / 1e9));
      const rel = c => aObjeto(R, [c.x - p[0], c.y - p[1], c.z - p[2]]).map(mm), formas = [];
      for (const f of o.formas) {
        const pf = f.centro ? rel(f.centro) : f.local ? [f.local.x, f.local.y, f.local.z].map(mm) : [0, 0, 0];
        if (f.tipo === 'caja') formas.push({ tipo: BOX, dims: f.dims.map(mm), p: pf, q: ID });
        else if (f.tipo === 'esfera') formas.push({ tipo: SPHERE, dims: [mm(f.radio)], p: pf, q: ID });
        else if (f.tipo === 'cilindro') formas.push({ tipo: CYLINDER, dims: [mm(f.altura), mm(f.radio)], p: pf, q: ID });
        else if (f.tipo === 'capsula') {
          const d = [f.b.x - f.a.x, f.b.y - f.a.y, f.b.z - f.a.z], l = Math.hypot(...d), medio = { x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2, z: (f.a.z + f.b.z) / 2 };
          // un tramo que no llega a 1 mm no es un cilindro (dimensión 0): lo cubren las dos esferas de sus extremos
          if (mm(l) > 0) formas.push({ tipo: CYLINDER, dims: [mm(l), mm(f.radio)], p: rel(medio), q: arco(aObjeto(R, d.map(v => v / l))), nota: 'tramo de una cápsula' });
          formas.push({ tipo: SPHERE, dims: [mm(f.radio)], p: rel(f.a), q: ID, nota: 'extremo de una cápsula' }, { tipo: SPHERE, dims: [mm(f.radio)], p: rel(f.b), q: ID, nota: 'extremo de una cápsula' });
        } else throw new Error(`exportar: forma desconocida (${f.tipo})`);
      }
      return { id: limpio(o.id), que: o.que, giro: o.giro || null, p, q, formas };
    });
  }
  // Origen de la pose, del giro, de las formas y de sus poses, por tipo de objeto
  const GIRO_CAJA = { plan: 'el del agarre que eligió el plan del gemelo', base: 'provisional, hacia la base del robot: las trayectorias no están al día (Calcular)', calculo: 'el de un cálculo a medias: exporta cuando termine' };
  function origenesEscena(m, O) {
    const c = m.ctx, og = k => O.yaml(k, c), ot = k => O.tipo(k, c), sup = og('disposicion');
    const giro = m.robot.yaw !== 0 ? `${ot('orientacion_base_link')} (giro world→base_link sin validar en ROS)` : og('mesa'); // como su TF
    const tf = n => `${sup}; la de su TF ${n}`;
    return {
      mesa: { pos: () => `${giro}; la de su TF mesa (centro de la cara de arriba)`, ori: () => giro, forma: og('mesa'), poseForma: `${og('mesa_bajo_base')}; centro a media altura de la mesa` },
      caja: { pos: () => `${sup}: bajo su plato; z: ${og('caja_plato')}, media altura de la caja`, ori: o => `${og('giro_caja')}: ${GIRO_CAJA[o.giro] || GIRO_CAJA.calculo}`, forma: og('caja_plato'), poseForma: `${og('caja_plato')}: en la pose del objeto` },
      plato: { pos: o => tf(`${o.id}_inicio`), ori: o => tf(`${o.id}_inicio`), forma: `${og('plato_bandeja_persona')}: radio · ${og('grosor_plato')}: altura`, poseForma: `${og('grosor_plato')}: medio grosor por encima de su TF` },
      bandeja: { pos: () => `${tf('bandeja')} (pose de plan, sin balanceo) · nominal: la sustituye la pose que publique Visión`, ori: () => tf('bandeja'), forma: og('plato_bandeja_persona'), poseForma: og('plato_bandeja_persona') },
      camara: { pos: o => `${tf(o.id)} · nominal: la sustituye la calibración`, ori: o => tf(o.id), forma: og('colision_camara'), poseForma: og('colision_camara') },
    };
  }
  const P3 = p => `{'x': ${d3(p[0])}, 'y': ${d3(p[1])}, 'z': ${d3(p[2])}}`; // claves entre comillas: YAML 1.1 lee una «y» suelta como true
  const Q4 = q => `{'x': ${dec9(q[0])}, 'y': ${dec9(q[1])}, 'z': ${dec9(q[2])}, 'w': ${dec9(q[3])}}`;
  const TIPO_TXT = { [BOX]: 'BOX [x, y, z]', [SPHERE]: 'SPHERE [radio]', [CYLINDER]: 'CYLINDER [altura, radio]' };
  const FUERA = 'Fuera de la escena: la persona y la fruta (se mueven o son lo que se coge), la zona de fruta y el otro robot (ya está en el URDF doble, DT16).';
  const PLATOS = 'plato_1 y plato_2 son obstáculos hasta que se cogen: para cogerlos, adjúntalos a la pinza (AttachedCollisionObject) o permite el contacto en la ACM.';
  const SUELO = 'El id suelo es el de la caja del ejemplo del profesor: aquí no se usa (un ADD con el mismo id la sustituiría).';
  const lineaCajas = E => { const g = [...new Set(E.filter(o => o.que === 'caja').map(o => o.giro || 'calculo'))]; return g.length ? [`Giro de las cajas: ${g.map(x => GIRO_CAJA[x] || GIRO_CAJA.calculo).join('; ')}.`] : []; };
  // escena_colision.yaml: objetos: una lista de mapas con los campos de moveit_msgs/CollisionObject que se usan (no son
  // ros__parameters: aquí una lista de mapas sí vale). Sin operation: ADD (0) es su valor por defecto.
  function escenaYaml(m, O, E) {
    const EL = O.ELEGIDO, F = m.robot.frame, og = k => O.yaml(k, m.ctx), org = origenesEscena(m, O);
    let y = cabecera(m, O, 'escena_colision.yaml', 'un nodo del grupo lo lee con yaml.safe_load, rellena cada moveit_msgs/CollisionObject con rosidl_runtime_py.set_message_fields y los envía con el servicio apply_planning_scene (is_diff: true)', [
      `objetos: lista de moveit_msgs/CollisionObject (moveit_msgs 2.6) en ${limpio(F)}, con header.frame_id, id, pose (la del objeto), primitives y primitive_poses (relativas a pose).`,
      'Sin operation: vale ADD (0) por defecto y ADD con un id que ya existe sustituye el objeto; un byte escrito como entero no pasa por set_message_fields.',
      'SolidPrimitive: type 1 = BOX [x, y, z], 2 = SPHERE [radio] y 3 = CYLINDER [altura, radio], en m (celda.scene escribe el cilindro al revés: cylinder radio longitud).',
      'Posiciones a 1 mm; cuaterniones (x, y, z, w) normalizados con 9 decimales, de setRPY con los ángulos a 0,001 rad (los mismos que las TF). Las poses de las formas salen de la pose del objeto ya redondeada.',
      'Objetos: mesa (BOX), caja_plato_<n> (BOX, solo con los platos sobre caja), plato_<n> (CYLINDER), bandeja (BOX) y camara_<k> (SPHERE y CYLINDER: la cámara y su brazo), sin márgenes de roce.',
      'La cara de arriba de la mesa queda 1 mm por debajo de base_link, como el suelo del ejemplo del profesor: así la base del robot no arranca en contacto con la mesa.',
      PLATOS, FUERA, SUELO, ...lineaCajas(E),
      'La bandeja va en su pose de plan y cada cámara en la de su TF: las dos son nominales.',
    ]) + 'objetos:\n';
    for (const o of E) {
      const g = org[o.que];
      y += `  - header: {frame_id: ${cad(F)}}  # ${EL} (el prefijo; base_link es el del URDF)\n    id: ${cad(o.id)}  # ${og('id_escena')}\n`;
      y += `    pose:\n      position: ${P3(o.p)}  # ${limpio(g.pos(o))}\n      orientation: ${Q4(o.q)}  # ${limpio(g.ori(o))}\n    primitives:\n`;
      for (const f of o.formas) y += `      - {type: ${f.tipo}, dimensions: ${lista(f.dims.map(d3))}}  # ${limpio(g.forma)} · ${TIPO_TXT[f.tipo]}${f.nota ? `: ${f.nota}` : ''}\n`;
      y += '    primitive_poses:\n';
      for (const f of o.formas) y += `      - {position: ${P3(f.p)}, orientation: ${Q4(f.q)}}  # ${limpio(g.poseForma)}\n`;
    }
    return y;
  }
  // celda.scene: el texto de PlanningScene::loadGeometryFromStream (moveit 2.12) en el world del URDF que corresponda. Sin
  // comentarios (el lector no los ignora): lo explica celda.scene.txt. Por objeto: «* id», su pose (x y z / qx qy qz qw), el
  // número de formas y, por forma, su tipo, sus dimensiones (cylinder: radio longitud), su pose relativa y su color; luego el
  // número de subframes (0). Las formas y sus poses son las de escena_colision.yaml; solo la pose de cada objeto cambia de frame.
  const TIPO_SCENE = { [BOX]: 'box', [SPHERE]: 'sphere', [CYLINDER]: 'cylinder' };
  const COLOR = { mesa: [0.3, 0.3, 0.32, 1], caja: [0.76, 0.6, 0.42, 1], plato: [0.96, 0.95, 0.93, 1], bandeja: [0.5, 0.58, 0.65, 1], camara: [0.08, 0.08, 0.09, 1] }; // solo para verlos en RViz
  // El world del .scene: con prefijo y URDF doble conocido, el del doble (pose_en_world_doble); si no, el de sim_<id>
  // (world_a_base_link, giro puro)
  const mundoDe = m => { const R = m.robot; return R.doble ? { x: R.doble.x, y: R.doble.y, z: R.doble.z, yaw: R.doble.yaw, doble: R.doble.nombre } : { ...R.worldABase, yaw: R.yaw, doble: null }; };
  function scene(m, E) {
    const W = mundoDe(m), qW = [0, 0, Math.sin(W.yaw / 2), Math.cos(W.yaw / 2)], RW = matQ(qW), t0 = [W.x, W.y, W.z].map(num);
    let t = `gemelo_celda_${huella(m.layoutJson)}\n`;
    for (const o of E) {
      const pw = aPadre(RW, o.p).map((v, i) => v + t0[i]), qw = q9(qMul(qW, o.q.map(v => v / 1e9)));
      t += `* ${o.id}\n${pw.map(d3).join(' ')}\n${qw.map(dec9).join(' ')}\n${o.formas.length}\n`;
      for (const f of o.formas) t += `${TIPO_SCENE[f.tipo]}\n${(f.tipo === CYLINDER ? [f.dims[1], f.dims[0]] : f.dims).map(d3).join(' ')}\n${f.p.map(d3).join(' ')}\n${f.q.map(dec9).join(' ')}\n${COLOR[o.que].map(v => v.toFixed(3)).join(' ')}\n`;
      t += '0\n';
    }
    return t + '.\n';
  }
  // celda.scene.txt: en qué world está la escena, cómo se carga, el aviso del «éxito» falso y el origen de cada objeto
  function sceneTxt(m, O, E) {
    const W = mundoDe(m), F = limpio(m.robot.frame), og = k => O.yaml(k, m.ctx), org = origenesEscena(m, O);
    const donde = W.doble ? `el world del URDF doble ${limpio(W.doble)}.urdf.xacro` : 'el world de sim_<id> (el URDF de un solo robot)';
    return cabecera(m, O, 'celda.scene.txt', 'acompaña a celda.scene; cómo cargarlo, abajo', [
      `celda.scene está en ${donde}, no en ${F}: un .scene no lleva frame y MoveIt lo lee en el frame del modelo.`,
      `En ese world, ${F} está en (${d3(W.x)}, ${d3(W.y)}, ${d3(W.z)}) m con yaw ${rad3(W.yaw)} rad (${grados(W.yaw)}): p_world = Rz(yaw)·p_${F} + (x, y, z) [${og(W.doble ? 'pose_doble' : 'orientacion_base_link')}].`,
      'Los objetos, sus formas y las poses de las formas son los de escena_colision.yaml, con los mismos números; solo la pose de cada objeto pasa a world (a 1 mm, cuaterniones x y z w con 9 decimales).',
      'Formato (PlanningScene::loadGeometryFromStream, moveit 2.12): el nombre de la escena; por objeto, «* id», su pose (x y z / qx qy qz qw), el número de formas y, por forma, su tipo,',
      '  sus dimensiones (box x y z, sphere radio, cylinder radio longitud: al revés que SolidPrimitive), su pose relativa (dos líneas) y su color r g b a; luego el número de subframes (0). Al final, «.».',
      'Carga, con la ruta de dentro del contenedor donde corre move_group: ros2 service call /load_geometry_from_file moveit_msgs/srv/LoadGeometryFromFile "{file_path_and_name: /ruta/celda.scene}"',
      '  (capacidad de move_group desde MoveIt 2.11), o en RViz: MotionPlanning → Scene Objects → Import [SIN VALIDAR en ROS: U4].',
      'Aviso: load_geometry_from_file responde success: true aunque el fichero esté mal formado. Comprueba en RViz o con get_planning_scene que están todos los objetos.',
      'El .scene no admite comentarios: lo que lo explica está en este fichero. Los colores (r g b a) son solo para verlos en RViz.',
      PLATOS, FUERA, SUELO, ...lineaCajas(E),
      'Origen de cada objeto (pose · giro · formas · poses de las formas):',
      ...E.map(o => { const g = org[o.que]; return `  ${o.id}: ${limpio(g.pos(o))} · ${limpio(g.ori(o))} · ${limpio(g.forma)} · ${limpio(g.poseForma)}`; }),
    ], 'en la lista «Origen de cada objeto»');
  }
  function ficherosEscena(m, O) {
    const E = objetosEscena(m);
    return [{ nombre: 'escena_colision.yaml', texto: escenaYaml(m, O, E) }, { nombre: 'celda.scene', texto: scene(m, E) }, { nombre: 'celda.scene.txt', texto: sceneTxt(m, O, E) }];
  }

  // ---------- Cámaras (T2.5): camera_info/camara_<k>.yaml (nominal) y usb_cam/camara_<k>.yaml ----------
  // K de lente ideal con el modelo de la cámara de render del gemelo (su campo vertical y el aspecto del modo, que salen del
  // modelo de sensor): fx = (w/2)/tan(hfov/2), fy = (h/2)/tan(vfov/2), cx = (w − 1)/2 y cy = (h − 1)/2 (convenio de OpenCV y
  // ROS: el centro del píxel (0, 0) está en 0). D = 0 (plumb_bob), R = I y P = [K | 0]. En píxeles, con 3 decimales.
  function intrinseca(k) {
    const w = num(k.px.w), h = num(k.px.h), fx = w / 2 / Math.tan(num(k.hfov) / 2), fy = h / 2 / Math.tan(num(k.vfov) / 2), cx = (w - 1) / 2, cy = (h - 1) / 2;
    return { K: [fx, 0, cx, 0, fy, cy, 0, 0, 1], D: [0, 0, 0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1], P: [fx, 0, cx, 0, 0, fy, cy, 0, 0, 0, 1, 0] };
  }
  const nombreCam = k => `camara_${limpio(k.clave)}`;
  const RUTA_CI = n => `file://\${ROS_HOME}/camera_info/${n}.yaml`; // la de camera_info_manager por defecto
  function cameraInfo(m, O, k) {
    const og = x => O.yaml(x, m.ctx), EL = O.ELEGIDO, n = nombreCam(k), I = intrinseca(k), fmtCI = og('formato_camera_info'), modo = `${EL} (modo ${limpio(k.modo)})`;
    const kO = `${og('campo_vision')}; focal y modo: ${EL}`, s = m.ctx.sensor;
    const mat = (clave, rows, cols, data, o) => `${clave}:\n  rows: ${ent(rows)}  # ${fmtCI}\n  cols: ${ent(cols)}  # ${fmtCI}\n  data: ${lista(data.map(d3))}  # ${limpio(o)}\n`;
    return cabecera(m, O, `camera_info/${n}.yaml`, `el camera_info_url de usb_cam/${n}.yaml: cópialo a \${ROS_HOME}/camera_info/${n}.yaml (por defecto ~/.ros/camera_info/)`, [
      `Cámara ${limpio(k.clave)}: ${limpio(k.modelo)}, focal ${num(k.focal).toFixed(1)} mm (focal_mm, DT19), modo ${limpio(k.modo)} (${ent(k.px.w)} × ${ent(k.px.h)} a ${num(k.px.fps).toFixed(1)} fps), sensor «${limpio(s.nombre)}» de ${fmt(num(s.w), 3)} mm de ancho útil.`,
      `K en píxeles, de lente ideal y con el modelo de la cámara con la que el gemelo pinta lo que ve: fx = (w/2)/tan(hfov/2) y fy = (h/2)/tan(vfov/2), con hfov ${d3(k.hfov)} rad y vfov ${d3(k.vfov)} rad;`,
      '  cx = (w − 1)/2 y cy = (h − 1)/2: el píxel (0, 0) tiene su centro en 0, como en OpenCV y ROS. Números de las matrices con 3 decimales.',
      `D = 0 (plumb_bob), R = I y P = [K | 0]. Nominal: lo sustituye la calibración intrínseca (F4) guardada con el mismo camera_name (${n}) en la misma ruta.`,
    ]) + `image_width: ${ent(k.px.w)}  # ${modo}\nimage_height: ${ent(k.px.h)}  # ${modo}\ncamera_name: ${cad(n)}  # ${og('nombre_frame')}; el de usb_cam/${n}.yaml\n`
      + mat('camera_matrix', 3, 3, I.K, kO) + `distortion_model: 'plumb_bob'  # ${og('distorsion_nula')}\n` + mat('distortion_coefficients', 1, 5, I.D, og('distorsion_nula'))
      + mat('rectification_matrix', 3, 3, I.R, fmtCI) + mat('projection_matrix', 3, 4, I.P, `${kO}: P = [K | 0]`);
  }
  // usb_cam/camara_<k>.yaml: ros__parameters de usb_cam 0.8 para --params-file, con los enteros donde usb_cam los declara
  // (image_width, image_height, exposure y white_balance)
  function usbCam(m, O, k) {
    const og = x => O.yaml(x, m.ctx), EL = O.ELEGIDO, n = nombreCam(k), u = k.usb, modo = `${EL} (modo ${limpio(k.modo)})`;
    const nodos = [
      hoja('video_device', cad(u.dispositivo), og('dispositivo_video')),
      hoja('framerate', num(k.px.fps).toFixed(1), modo),
      hoja('image_width', ent(k.px.w), modo),
      hoja('image_height', ent(k.px.h), modo),
      hoja('pixel_format', cad('mjpeg2rgb'), og('formato_pixel')),
      hoja('camera_name', cad(n), `${og('nombre_frame')}; el de camera_info/${n}.yaml`),
      hoja('frame_id', cad(`${n}_optical`), `${og('nombre_frame')}; el marco óptico de su TF (tf/${n}_optical.yaml)`),
      hoja('camera_info_url', cad(RUTA_CI(n)), og('ruta_camera_info')),
      hoja('autoexposure', 'false', og('exposicion')),
      hoja('exposure', ent(u.exposicion), og('exposicion')),
      hoja('auto_white_balance', 'false', og('balance_blancos')),
      hoja('white_balance', ent(u.balance), og('balance_blancos')),
    ];
    return cabecera(m, O, `usb_cam/${n}.yaml`, `ros2 run usb_cam usb_cam_node_exe --ros-args -r __ns:=/${n} --params-file usb_cam/${n}.yaml (un namespace por cámara)`, [
      `Cámara ${limpio(k.clave)}: frame_id ${n}_optical, el de su TF óptica; camera_name y camera_info_url, los de camera_info/${n}.yaml.`,
      'Sustituye al camera_frame_id del launch del curso, que usb_cam no declara: con él todas las cámaras salen con frame_id default_cam y buscan el camera_info de default_cam.',
      `exposure va en unidades de V4L2 (100 µs): ${ent(u.exposicion)} = ${fmt(u.exposicion / 10, 1)} ms, con autoexposure a false; white_balance en K, con auto_white_balance a false.`,
      'video_device: compruébalo con v4l2-ctl --list-devices; mejor un /dev/v4l/by-id/…, que no cambia al reconectar las cámaras.',
    ]) + raiz(nodos);
  }
  function ficherosCamaras(m, O) {
    return [...m.camaras.map(k => ({ nombre: `camera_info/${nombreCam(k)}.yaml`, texto: cameraInfo(m, O, k) })), ...m.camaras.map(k => ({ nombre: `usb_cam/${nombreCam(k)}.yaml`, texto: usbCam(m, O, k) }))];
  }
  // Todos los ficheros de ROS de la disposición, en orden fijo: los de T2.2 + T2.4, los de la escena (T2.3) y los de las cámaras (T2.5)
  const todos = (m, O) => [...ficherosRos(m, O), ...ficherosEscena(m, O), ...ficherosCamaras(m, O)];

  // ---------- Paquete .tar (T2.6, decisión 2 de su brief): los ficheros tal cual, bajo una carpeta raíz ----------
  // Formato ustar (POSIX.1-1988) sin comprimir y determinista: la misma lista da los mismos bytes. Por entrada, una cabecera
  // de 512 bytes (name 0–99, mode 100, uid 108, gid 116, size 124, mtime 136, chksum 148, typeflag 156, magic «ustar\0» 257,
  // version «00» 263; uname 265, gname 297, devmajor 329 y devminor 337, vacíos), los datos y ceros hasta el bloque de 512.
  // mtime = 0, uid = gid = 0, 0644 (0755 los .sh y las carpetas), una entrada de carpeta («<ruta>/», typeflag 5) antes del
  // primer fichero que la usa y dos bloques de ceros al final. Los números, en octal con ceros a la izquierda y NUL; la suma
  // de control, de los 512 bytes con su campo en espacios, en 6 cifras, NUL y espacio. El texto va en UTF-8 (sin TextEncoder:
  // el módulo se prueba en un contexto vm vacío). Una ruta que no cabe en name (100 bytes) se rechaza: no se usa prefix.
  const BLOQUE = 512, NAME = 100;
  function utf8(texto) {
    const out = [];
    for (const ch of texto) {
      let c = ch.codePointAt(0); if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // una suplente suelta sale como U+FFFD, como en un Blob
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }
  // Un número en octal para un campo de `ancho` bytes: ancho − 1 cifras y el NUL que ya tiene la cabecera
  const octal = (v, ancho, campo) => { const s = v.toString(8); if (s.length > ancho - 1) throw new Error(`tar: ${v} no cabe en el campo ${campo} (${ancho - 1} cifras octales)`); return s.padStart(ancho - 1, '0'); };
  // Una ruta relativa con «/» entre partes: ni vacía, ni absoluta, ni con «.», «..», partes vacías, «\» o caracteres de control
  function rutaTar(r, que) {
    if (typeof r !== 'string' || !r) throw new Error(`tar: ${que} vacío o que no es texto`);
    for (const p of r.split('/')) if (!p || p === '.' || p === '..' || /[\u0000-\u001f\u007f\\]/.test(p)) throw new Error(`tar: ${que} «${r}» no es una ruta relativa válida (sin «/» al principio ni al final, «.», «..», «\\» ni caracteres de control)`);
    return r;
  }
  function cabeceraTar(nombre, tam, modo, tipo) {
    const h = new Uint8Array(BLOQUE), n = utf8(nombre);
    if (n.length > NAME) throw new Error(`tar: la ruta «${nombre}» ocupa ${n.length} bytes y el campo name de ustar admite ${NAME}`);
    const pon = (off, s) => { for (let i = 0; i < s.length; i++) h[off + i] = typeof s === 'string' ? s.charCodeAt(i) : s[i]; };
    pon(0, n); pon(100, octal(modo, 8, 'mode')); pon(108, octal(0, 8, 'uid')); pon(116, octal(0, 8, 'gid'));
    pon(124, octal(tam, 12, 'size')); pon(136, octal(0, 12, 'mtime')); pon(148, '        '); pon(156, tipo);
    pon(257, 'ustar'); pon(263, '00'); // devmajor y devminor, en ceros como los deja GNU tar: solo cuentan en dispositivos
    let suma = 0; for (const b of h) suma += b;
    pon(148, octal(suma, 7, 'chksum')); h[154] = 0; h[155] = 0x20;
    return h;
  }
  // ficheros: [{ nombre, texto }] (los de todos(), en su orden); raiz: la carpeta que los contiene en el .tar. Devuelve los
  // bytes (Uint8Array).
  function tar(ficheros, raiz) {
    const partes = [], vistos = new Set(), carpetas = new Set(), r = rutaTar(raiz, 'la carpeta raíz');
    const entrada = (ruta, datos, modo, tipo) => {
      partes.push(cabeceraTar(ruta, datos.length, modo, tipo));
      if (datos.length) { partes.push(Uint8Array.from(datos)); if (datos.length % BLOQUE) partes.push(new Uint8Array(BLOQUE - datos.length % BLOQUE)); }
    };
    const carpeta = c => { if (carpetas.has(c)) return; const i = c.lastIndexOf('/'); if (i > 0) carpeta(c.slice(0, i)); carpetas.add(c); entrada(`${c}/`, [], 0o755, '5'); };
    carpeta(r);
    for (const f of ficheros) {
      const ruta = `${r}/${rutaTar(f && f.nombre, 'el nombre del fichero')}`;
      if (typeof f.texto !== 'string') throw new Error(`tar: el texto de «${f.nombre}» no es texto`);
      if (vistos.has(ruta)) throw new Error(`tar: «${f.nombre}» está dos veces`);
      if (carpetas.has(ruta)) throw new Error(`tar: «${ruta}» es un fichero y una carpeta`);
      vistos.add(ruta); carpeta(ruta.slice(0, ruta.lastIndexOf('/')));
      for (const c of carpetas) if (vistos.has(c)) throw new Error(`tar: «${c}» es un fichero y una carpeta`);
      entrada(ruta, utf8(f.texto), /\.sh$/.test(ruta) ? 0o755 : 0o644, '0');
    }
    partes.push(new Uint8Array(2 * BLOQUE));
    const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0)); let o = 0;
    for (const p of partes) { out.set(p, o); o += p.length; }
    return out;
  }

  return { r3, rad3, huella, cuaternion, posiciones, parametros, ficherosRos, ficherosEscena, ficherosCamaras, todos, tar };
})();
if (typeof module !== 'undefined') module.exports = EXPORTAR;
