// Formateador de los ficheros exportados (T2.2, T2.4, D8, I7): convierte el modelo de modeloExportacion() (app.js: un objeto
// plano, sin redondear y en el base_link del robot elegido) en texto. Sin DOM, three ni globales del gemelo: el origen de
// cada valor lo da el módulo de origen que recibe cada función (src/origen.js en el gemelo) con el contexto del modelo
// (m.ctx), y aquí no se escribe ningún tipo de origen a mano. Se prueba con node:test en un contexto vm vacío
// (tests/unit/exportar.test.mjs) y se concatena en app.js con el marcador @@EXPORTAR@@ (D4).
// Modelo (todo en metros y radianes, en m.robot.frame salvo world_a_base_link y pose_en_world_doble):
//   ctx (contexto de origen) · layoutJson (JSON.stringify(L)) · robot { posicion, id, idLayout, desconocido, sospechoso,
//   yaw, prefijo, frame, worldABase {x, y, z}, doble { nombre, x, y, z, yaw } | null } · pinza { modelo, tcpZ, carrera } ·
//   mesa { ancho, fondo, alto, x, y, z, yaw } · pedido · platos { sobreCaja, cajaAlto, cajaLado, agarre, radioAgarre,
//   lista [{ clave, x, y, z }] } · zona { x, y, z, yaw, ancho, fondo } · marcadores [{ id, diccionario, lado, x, y, z, yaw }]
//   · bandeja { x, y, z, yaw, zonas [{ clave, base {x, y, z}, local {x, y, z} }] } · persona { x, y, z, yaw } ·
//   camaras [{ clave, grupo, modelo, focal, modo, hfov, pos, mira, clamp, orient { pan, tilt, roll }, rpy [r, p, y] }]
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
  function cabecera(m, O, nombre, carga, extra = []) {
    return [`# ${nombre} · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR\n`, comentario(lineaRobot(m)), comentario(lineaFrame(m)),
      `# Huella de la disposición: ${huella(m.layoutJson)} (FNV-1a de 32 bits de JSON.stringify(L), en UTF-8): casa este fichero con su disposición.\n`,
      `# Carga: ${carga} [SIN VALIDAR en ROS: U4].\n`, ...extra.map(l => `# ${l}\n`),
      `# Origen de cada valor, al final de su línea: ${O.LEYENDA}; lo que se elige en el gemelo, «${O.ELEGIDO}».\n`].join('');
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

  // Ficheros de ROS de una disposición, en orden fijo: [{ nombre, texto }] (T2.2; las TF llegan con T2.4)
  function ficherosRos(m, O) {
    return [{ nombre: 'parametros_celda.yaml', texto: parametros(m, O) }];
  }

  return { r3, rad3, huella, posiciones, parametros, ficherosRos };
})();
if (typeof module !== 'undefined') module.exports = EXPORTAR;
