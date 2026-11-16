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
    y += `fecha: ${fecha}\nrobot: ${R.posicion}  # ${og(R.posicion === 'B' ? 'base_b' : 'base_a')}\nrobot_id: ${R.desconocido ? `${R.idLayout}  # de la disposición; el gemelo no lo conoce y usa la cinemática nominal` : `${R.id}  # elegido en el gemelo`}\n`;
    const w = R.worldABase;
    y += `frame: ${frame}\nprefijo_frames: '${R.prefijo}'\nworld_a_base_link: {x: ${r3(w.x)}, y: ${r3(w.y)}, z: ${r3(w.z)}, yaw_rad: ${rad3(R.yaw)}}  # world del gemelo (ejes de la mesa): ${ot('orientacion_base_link')} · giro: mount_yaw − π del xacro del curso, ${og('orientacion_base_link')}\n`;
    if (R.doble) y += `pose_en_world_doble: {frame: ${frame}, x: ${r3(R.doble.x)}, y: ${r3(R.doble.y)}, z: ${r3(R.doble.z)}, yaw_rad: ${rad3(R.doble.yaw)}}  # xacro del curso, ${R.doble.nombre}: ${og('pose_doble')}\n`;
    y += `pinza: {modelo: ${m.pinza.modelo}, tcp_z_m: ${r3(m.pinza.tcpZ)}, carrera_m: ${r3(m.pinza.carrera)}}  # tcp_z: ${og('tcp_pinza')} · carrera: ${og('pinza')}\n`;
    const me = m.mesa;
    y += `mesa: {ancho_m: ${r3(me.ancho)}, fondo_m: ${r3(me.fondo)}, alto_m: ${r3(me.alto)}, centro_en_base_link: {x: ${r3(me.x)}, y: ${r3(me.y)}}, yaw_rad: ${rad3(me.yaw)}}  # ${conGiro ? `medidas: ${og('mesa')} · centro_en_base_link y yaw_rad: ${giroSup}` : og('mesa')}\n`;
    y += `pedido: ${m.pedido === 1 ? 'un_plato  # al centro de la bandeja' : 'dos_platos  # primero y segundo'} · elegido en el gemelo\n`;
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

  return { r3, rad3, posiciones };
})();
if (typeof module !== 'undefined') module.exports = EXPORTAR;
