// Origen de cada valor exportable (T2.1, D8, I7): la única fuente de su tipo (MEDIDO, FABRICANTE o SUPUESTO), del texto y
// la fuente que enseña la tabla del panel «Datos» y del comentario corto que lleva en los ficheros exportados. Lo leen
// pintarFuentes (la tabla) y generarYaml (posiciones.yaml); los exportadores de T2.2–T2.5 leerán de aquí. Sin DOM ni three:
// se prueba con node:test (tests/unit/origen.test.mjs) y se concatena en app.js con el marcador @@ORIGEN@@ (D4).
// Lo que depende del robot, del sensor o de la pinza se calcula con un contexto explícito, nunca con globales del gemelo:
//   ctx = { robotId, sospechoso, yaw, sensor: { id, nombre, w, origen }, tcpZ }
//   robotId: el robot cuya cinemática se usa ('nominal', '203'…) · sospechoso: su calibración está marcada sospechosa
//   yaw: giro de base_link respecto a world (rad) · sensor: el modelo del sensor de la escena (SENSOR.de con su id)
//   tcpZ: TCP de la pinza cerrada (m), la que da su modelo simplificado
const ORIGEN = (() => {
  const M = 'MEDIDO', F = 'FABRICANTE', S = 'SUPUESTO';
  const TIPOS = [M, F, S];
  // Lo que ha decidido el grupo (DT34, T2.7) no es un cuarto tipo de D8: es una etiqueta propia, como ELEGIDO (abajo). La
  // lleva en el campo tipo, en la tabla y en los ficheros, la entrada cuya fuente es una decisión del grupo (agarre_plato).
  const GRUPO = 'decisión del grupo';
  const CLASE = { [M]: 'm', [F]: 'f', [S]: 's', [GRUPO]: 'g' }; // clase de la etiqueta en la tabla (.tag.m, .tag.f y .tag.s del CSS; .tag.g, la de .tag)
  const LEYENDA = `${TIPOS.slice(0, -1).join(', ')} o ${TIPOS.at(-1)}`;
  // Formatos de la tabla: los mismos que fmt, mm y gradosTxt de app.js (mismas operaciones, mismo texto)
  const R2D = 180 / Math.PI;
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const grados = a => `${fmt(a * R2D, 1).replace('-', '−')}°`;
  const con = (t, detalle) => detalle ? `${t} (${detalle})` : t; // comentario corto: el tipo y, si hace falta, por qué
  // Una entrada por valor exportable. nombre: la fila de la tabla (null = solo en los ficheros exportados).
  // tipo (uno de TIPOS o GRUPO), valor, fuente: texto o función del contexto. yaml: (tipo, ctx) → comentario corto, que
  // siempre empieza por el tipo.
  // El orden es el de la tabla.
  const ENTRADAS = [
    { clave: 'mesa', nombre: 'Mesa', tipo: M, valor: '1180 × 830 mm, superficie a 760 mm', fuente: 'Cinta + foto (regla y A4, error < 2 %)', yaml: t => t },
    { clave: 'base_b', nombre: 'Base del robot B (grupo)', tipo: M, valor: '9 y 8 cm del borde de la base a los bordes de la mesa', fuente: 'Cinta; centro con radio de base de 66 mm (supuesto)', yaml: t => con(t, 'posición de la base en la celda') },
    { clave: 'base_a', nombre: 'Base del robot A', tipo: M, valor: 'centro a 151 y 115 mm de los bordes', fuente: 'Foto ±10 mm', yaml: t => con(t, 'posición de la base en la celda') },
    { clave: 'ur3e', nombre: 'UR3e', tipo: F, valor: 'alcance 500 mm, carga 3 kg, 11,2 kg, 2020', fuente: 'Placa del robot', yaml: t => con(t, 'placa del robot') },
    {
      clave: 'cinematica', nombre: 'Cinemática del UR3e',
      tipo: c => c.robotId === 'nominal' ? F : c.sospechoso ? S : M,
      valor: c => c.robotId === 'nominal' ? 'DH oficiales, IK analítica de 8 soluciones' : `calibración del robot ${c.robotId}; IK analítica nominal refinada con Levenberg–Marquardt (1e-6 m y 1e-6 rad)`,
      fuente: c => c.robotId === 'nominal' ? 'ur_description; verificada con 2000 posturas' : `calibration_${c.robotId}.yaml del repo del curso (4e4e1a7)${c.sospechoso ? ', sospechosa' : ''}; SIN VALIDAR en ROS`,
      yaml: (t, c) => con(t, c.robotId === 'nominal' ? 'DH oficiales de ur_description' : `calibration_${c.robotId}.yaml del curso${c.sospechoso ? ', sospechosa' : ''}, sin validar en ROS`),
    },
    { clave: 'pinza', nombre: 'Pinza', tipo: M, valor: 'OnRobot RG2, 0–110 mm, 0,78 kg, 3–40 N', fuente: 'Apertura medida 110 mm + ficha', yaml: t => t },
    { clave: 'tcp_pinza', nombre: 'TCP de la pinza', tipo: S, valor: c => `${Math.round(c.tcpZ * 1000)} mm cerrada`, fuente: 'Modelo simplificado; medir en PolyScope', yaml: t => con(t, 'modelo simplificado') },
    { clave: 'agarre_plato', nombre: 'Agarre del plato', tipo: GRUPO, valor: 'horizontal por el borde, un dedo encima y otro debajo del ala', fuente: 'Decisión del grupo (12-11)', yaml: t => t },
    { clave: 'caja_plato', nombre: 'Caja bajo el plato', tipo: S, valor: '10 × 10 cm, altura regulable', fuente: 'Propuesta del grupo; tamaño sin medir', yaml: t => t },
    {
      clave: 'orientacion_base_link', nombre: 'Orientación de base_link', tipo: S,
      valor: c => `girado ${grados(c.yaw)} respecto a world; world con los ejes de la mesa`,
      fuente: 'Giro: mount_yaw − π del xacro del curso. Ejes de world: comprobar en el laboratorio (docs/estado/frames.md)',
      yaml: t => con(t, 'sin validar en ROS'),
    },
    { clave: 'camaras', nombre: 'Cámaras', tipo: M, valor: 'ELP-USB12MP01-UFV, IMX577, 3,6–10 mm, USB 2.0', fuente: 'Caja de la cámara + web del fabricante', yaml: t => t },
    {
      clave: 'campo_vision', nombre: 'Campo de visión', tipo: S,
      valor: c => `lente ideal sobre el ancho del sensor «${c.sensor.nombre}» (${fmt(c.sensor.w, 3)} mm), completo en todos los modos`,
      fuente: c => `${c.sensor.origen}; medir en la calibración intrínseca (F4)`,
      yaml: (t, c) => con(t, `lente ideal, sensor ${c.sensor.id}`),
    },
    { clave: 'marcadores', nombre: 'Marcadores', tipo: S, valor: 'ArUco DICT_4X4_50: zona 0–3, entrega 4–5, bandeja 6–9 (dibujados con su patrón real); el lado es el del cuadrado negro, el markerLength de OpenCV, con el margen blanco por fuera', fuente: 'Ids propuestos', yaml: t => con(t, 'ids propuestos') },
    { clave: 'soportes_camara', nombre: 'Soportes de cámara', tipo: M, valor: 'Manfrotto 035 + brazo 244 de 53 cm', fuente: 'Foto + ficha', yaml: t => t },
    { clave: 'fruta', nombre: 'Fruta', tipo: S, valor: 'piezas de plástico de 4,5–7 cm', fuente: 'Foto de referencia del grupo', yaml: t => t },
    { clave: 'plato_bandeja_persona', nombre: 'Plato, bandeja y persona', tipo: S, valor: 'plato Ø160 mm · bandeja 450 × 330 mm a 1,00 m del suelo · persona en el lateral derecho, de frente, con la bandeja a la derecha del robot y fuera de la mesa', fuente: 'Sin medir; posición elegida porque es donde el robot puede dejar los platos nivelados', yaml: t => con(t, 'sin medir') },
    { clave: 'modelo_colision', nombre: 'Modelo de colisión', tipo: F, valor: '162 esferas ajustadas a las mallas de colisión oficiales del UR3e y a la RG2; límites articulares de joint_limits.yaml (codo ±180°)', fuente: 'ur_description (Universal Robots)', yaml: t => t },
    { clave: 'planificacion', nombre: 'Planificación', tipo: M, valor: 'RRT-Connect con atajos para movimientos libres; rectas cada 4 mm sin saltos (perfil «gemelo») o cada 1 cm con el punto medio a 1 mm y 0,01 rad (perfil «curso»); plato siempre nivelado', fuente: 'Equivalente a lo que hará MoveIt 2; sin validar en el robot', yaml: t => con(t, 'sin validar en el robot') },
    { clave: 'aceleracion_gemelo', nombre: 'Aceleración articular (perfil «gemelo»)', tipo: S, valor: '3 rad/s² al 100 %', fuente: 'El yaml del UR3e no fija aceleraciones', yaml: t => t },
    { clave: 'perfil_curso', nombre: 'Perfil «curso»', tipo: S, valor: 'escala 0,1 de velocidad y aceleración, 5 rad/s², cartesiana de MoveIt 2.11+ y arranque en contacto = fallo', fuente: 'config/joint_limits.yaml y el ejemplo del profesor (repo del curso); tiempos con un trapecio por articulación, no TOTG (DT4)', yaml: t => con(t, 'trapecio por articulación, no TOTG') },
    { clave: 'agarre_inclinacion', nombre: 'Agarre del plato', tipo: S, valor: 'muñeca inclinada hasta 45° respecto a la horizontal', fuente: 'Probar con el plato real que no gira ni resbala', yaml: t => t },
    { clave: 'bandeja_m0_m1', nombre: 'Bandeja en M0 / M1', tipo: S, valor: 'pausa a 25 mm, aborto a 10 s; latencia 120 ms', fuente: 'DEC-04 sin cifras', yaml: t => t },
    { clave: 'velocidades', nombre: 'Velocidades', tipo: F, valor: '180°/s (base, hombro, codo), 360°/s (muñecas)', fuente: 'Ficha del UR3e', yaml: t => t },
    { clave: 'nodos_robotica', nombre: 'Nodos de Robótica', tipo: S, valor: 'coordinador, pedidos, movimiento, pinza, seguridad', fuente: 'Propuesta; D3 sin congelar', yaml: t => t },
    { clave: 'topics_vision', nombre: 'Topics de Visión', tipo: M, valor: '/v1/*, /v2/*, /menu, /service_state', fuente: 'Contexto de Visión del 7-11', yaml: t => t },
    // Solo en los ficheros exportados (no son filas de la tabla)
    { clave: 'disposicion', nombre: null, tipo: S, valor: 'posiciones de la zona de fruta, los platos, los marcadores, la bandeja, sus zonas, la persona y las cámaras', fuente: 'la disposición propuesta en el gemelo, sin medir', yaml: t => con(t, 'disposición propuesta, sin medir') },
    { clave: 'pose_doble', nombre: null, tipo: S, valor: 'pose de <id>_base_link en el world del URDF doble', fuente: 'xacro del URDF doble del curso (doble_ur3e_<a>_<b>)', yaml: t => con(t, 'sin validar en ROS') },
    // Valores nuevos de parametros_celda.yaml y de las TF estáticas (T2.2, T2.4), también solo en los ficheros
    { clave: 'nombre_frame', nombre: null, tipo: S, valor: 'nombres de los frames de la celda: mesa, zona_fruta, plato_<n>_inicio, marcador_<id>, bandeja, zona_primero, zona_segundo, zona_centro, camara_<k> y camara_<k>_optical', fuente: 'propuestos por el gemelo (T2.4); los fija el grupo con la arquitectura (D3)', yaml: t => con(t, 'nombre propuesto') },
    { clave: 'lado_marcador', nombre: null, tipo: S, valor: 'lado de 6 cm de los marcadores de entrega (ids 4 y 5)', fuente: 'el dibujo del gemelo, sin medir: el impreso puede ser otro', yaml: t => con(t, 'lado del dibujo del gemelo, sin medir') },
    { clave: 'marco_optico', nombre: null, tipo: F, valor: 'camara_<k> → camara_<k>_optical: rpy (−π/2, 0, −π/2), sin traslación', fuente: 'convenio de REP-103 (marco del cuerpo y marco óptico de una cámara)', yaml: t => con(t, 'convenio de REP-103') },
    // Valores nuevos de la escena de colisión (T2.3), también solo en los ficheros
    { clave: 'id_escena', nombre: null, tipo: S, valor: 'ids de los objetos de la escena de colisión: mesa, caja_plato_<n>, plato_<n>, bandeja y camara_<k>', fuente: 'propuestos por el gemelo (T2.3); el id suelo es el del ejemplo del profesor y no se usa', yaml: t => con(t, 'id propuesto') },
    { clave: 'mesa_bajo_base', nombre: null, tipo: S, valor: 'cara de arriba de la mesa 1 mm por debajo de base_link', fuente: 'como el suelo del ejemplo del profesor: la base del robot no arranca en contacto con la mesa', yaml: t => con(t, 'cara de arriba 1 mm por debajo de base_link, como el suelo del profesor') },
    { clave: 'giro_caja', nombre: null, tipo: S, valor: 'giro de cada caja bajo el plato: una cara hacia la pinza, la del agarre que elige el plan del gemelo; sin plan al día, hacia la base del robot', fuente: 'planificador del gemelo (agarre del plato), sin validar en ROS', yaml: t => con(t, 'giro del plan del gemelo, sin validar') },
    { clave: 'grosor_plato', nombre: null, tipo: S, valor: '25 mm de grosor: el perfil del plato dibujado en el gemelo', fuente: 'el dibujo del gemelo, sin medir', yaml: t => con(t, 'perfil del plato del gemelo, sin medir') },
    { clave: 'colision_camara', nombre: null, tipo: S, valor: 'cada cámara y su brazo, como las esferas y cápsulas del modelo de colisión del gemelo (cuerpo, dos tramos de brazo, codo y pinza de mesa)', fuente: 'obstaculos() del gemelo, sin medir', yaml: t => con(t, 'modelo de colisión del gemelo, sin medir') },
    // Valores nuevos de camera_info y de usb_cam (T2.5), también solo en los ficheros
    { clave: 'formato_camera_info', nombre: null, tipo: F, valor: 'camera_info de camera_calibration_parsers: matrices con rows, cols y data; R = I y P = [K | 0] en una cámara monocular', fuente: 'image_common 5.1 y sensor_msgs/CameraInfo', yaml: t => con(t, 'formato de camera_info') },
    { clave: 'distorsion_nula', nombre: null, tipo: S, valor: 'D = 0 (plumb_bob): lente ideal', fuente: 'sin medir; la sustituye la calibración intrínseca (F4)', yaml: t => con(t, 'lente ideal, sin distorsión') },
    { clave: 'dispositivo_video', nombre: null, tipo: S, valor: '/dev/video0, /dev/video2 y /dev/video4, en el orden de las cámaras (cada cámara UVC suele crear dos nodos de vídeo)', fuente: 'sin comprobar en los PCs del laboratorio', yaml: t => con(t, 'compruébalo con v4l2-ctl --list-devices; mejor un /dev/v4l/by-id/…') },
    { clave: 'formato_pixel', nombre: null, tipo: S, valor: 'pixel_format mjpeg2rgb: usb_cam decodifica el MJPEG de la cámara', fuente: 'README de usb_cam 0.8; los modos rápidos de la ELP van en MJPEG según la ficha, SIN VALIDAR', yaml: t => con(t, 'MJPEG decodificado por usb_cam') },
    { clave: 'ruta_camera_info', nombre: null, tipo: F, valor: 'file://${ROS_HOME}/camera_info/<camera_name>.yaml', fuente: 'ruta por defecto de camera_info_manager (image_common 5.1)', yaml: t => con(t, 'ruta por defecto de camera_info_manager') },
    { clave: 'exposicion', nombre: null, tipo: S, valor: 'exposición manual de 5 ms (exposure 50, en unidades de 100 µs de V4L2)', fuente: 'la bandeja en movimiento pide ≤ 5,6 ms; con luz de 50 Hz puede dar bandas', yaml: t => con(t, '5 ms: la bandeja en movimiento pide ≤ 5,6 ms; con luz de 50 Hz puede dar bandas') },
    { clave: 'balance_blancos', nombre: null, tipo: S, valor: 'balance de blancos manual a 4000 K', fuente: 'sin medir la luz del laboratorio', yaml: t => con(t, 'sin medir la luz del laboratorio') },
  ];
  // Lo que elige el usuario en el gemelo (robot, prefijo, pedido, focal, modo, grupo de la cámara, caja sí o no) no es un
  // origen: los ficheros exportados lo comentan con este texto en lugar de un tipo (T2.2, decisión 7 de su brief)
  const ELEGIDO = 'elegido en el gemelo';
  const POR_CLAVE = new Map(ENTRADAS.map(e => [e.clave, e]));
  const CLAVES = ENTRADAS.map(e => e.clave);
  const valorDe = (v, ctx) => typeof v === 'function' ? v(ctx) : v;
  const buscar = clave => { const e = POR_CLAVE.get(clave); if (!e) throw new Error(`origen desconocido (${JSON.stringify(clave)})`); return e; };
  // La entrada con todo resuelto para ese contexto: { clave, nombre, tipo, valor, fuente, yaml }
  function entrada(clave, ctx) {
    const e = buscar(clave), tipo = valorDe(e.tipo, ctx);
    return { clave, nombre: e.nombre, tipo, valor: valorDe(e.valor, ctx), fuente: valorDe(e.fuente, ctx), yaml: e.yaml(tipo, ctx) };
  }
  const tipo = (clave, ctx) => entrada(clave, ctx).tipo;
  const yaml = (clave, ctx) => entrada(clave, ctx).yaml;
  // Las filas de la tabla del panel «Datos», en su orden
  const panel = ctx => ENTRADAS.filter(e => e.nombre !== null).map(e => entrada(e.clave, ctx));
  return { TIPOS, CLASE, LEYENDA, ELEGIDO, GRUPO, CLAVES, entrada, tipo, yaml, panel };
})();
if (typeof module !== 'undefined') module.exports = ORIGEN;
