# tests/ — arnés de pruebas del gemelo

Generado por IA, como todo el repo (I9). Las decisiones e invariantes que se citan están en `docs/planes/PLAN-gemelo-v9.md`.

## Dos niveles (T2.0, DT32)

| Nivel | Comando | Qué ejecuta | Cuándo |
|---|---|---|---|
| tarea | `npm test` · `bash tools/check.sh` | build, todos los unitarios y los e2e del nivel de tarea | antes de cada commit de entrega de una tarea |
| puerta | `npm run test:puerta` · `bash tools/check.sh --puerta` | build, todos los unitarios y los e2e de **los dos** niveles: todos los tests | en cada puerta de fase |
| rápido | `npm run test:rapido` | build, unitarios y la carga de los dos destinos | mientras se trabaja (< 2 min) |

- La lista de qué fichero e2e va en cada nivel es `tests/niveles.mjs` (`NIVELES`), y es la única: `npm run test:e2e` y
  `npm run test:e2e:puerta` la leen (`node tests/niveles.mjs tarea|puerta`). Cada fichero de `tests/e2e/` está en un solo
  nivel; la puerta ejecuta los dos. Un fichero que no esté en ningún nivel, o que esté en los dos, hace fallar
  `tests/unit/niveles.test.mjs` y los dos niveles antes de abrir ningún navegador.
- Los dos niveles de `check.sh` hacen la búsqueda de la clave del grupo (I3) y el build.
- Los e2e se ejecutan de uno en uno (`--test-concurrency=1`): con 2 núcleos y SwiftShader, dos páginas a la vez dan tiempos
  falsos y fallos por tiempo de espera. Cada test abre su propia página en un navegador nuevo (los de I6 la necesitan nueva).
- **Test nuevo:** va al nivel de tarea salvo que dure más de 60 s, sea un ensayo en orden inverso o un barrido y no sea el
  único test de su invariante. Añade su fichero a `NIVELES` y su fila a las tablas de abajo.

### Cómo se reparte y por qué

Por fichero. Lo que va primero a la puerta (decisión 2 del brief de T2.0): los ensayos en orden inverso, los barridos y los
tests de más de 60 s, salvo que sean el único test de su invariante. Después, para dejar margen bajo los 15 min a los tests
que añadan F2–F4, también van a la puerta los tests de F1 que no son de ninguna invariante y que esas fases no tocan
(revisiones de F1, avisos de la IK calibrada, coreografía de la salida de la bandeja). Los ficheros que mezclaban los dos
niveles se han partido moviendo los tests tal cual (`git diff --color-moved`): `determinismo` → `determinismo-demo`,
`matriz` → `matriz-curso`, `exportar` → `cambio-robot` y `robot` → `robot-avisos`.

Duraciones medidas en el contenedor de 2 núcleos (SwiftShader, sin GPU): «antes», en `npm test` de la fase 1
(`f1-check.log`, cada test cerraba su navegador de forma ordenada); «ahora», con el cierre de T2.0 (abajo).

| Fichero | Nivel | Tests | Antes (s) | Ahora (s) | Invariantes y motivo |
|---|---|---|---|---|---|
| `balanceo-salida` | tarea | 2 | — | 38 | T2.8 (DT30): en la disposición v27 del barrido, la demo «curso» se completa en tres fases de la bandeja y la salida no la toca; las muestras del balanceo son el obstáculo «bandeja», a 1 mm y sin la fase |
| `captura` | tarea | 4 | — | 104 | T4.6: botón «Captura sintética» por cámara con su aviso, PNG descargado válido de 640 × 480 (CRC, IDAT) con los píxeles que leyó la página, esquinas de ArUco del JSON en su sitio (2 px), JSON de la descarga = vista previa, persona sin dibujar, escena y lienzo como estaban, tiempos (la primera captura espera a la cola de SwiftShader: unos 5 s, solo se imprime; las demás ≤ 2 s, medidas 0,05–0,2 s); lo que se anota en cenital, entrega y persona; focal y modo; la web sin gancho. Medido el 2026-11-21 en un portátil con Windows (`node --test`, 27 + 17 + 13 s). TD.1 (DT45): `lado` = cuadrado negro, el markerLength de OpenCV (textura negra en todo el plano y margen blanco de lado/8 por fuera, ≥ lado/10) y las esquinas de la captura = las de `tablero_bandeja.yaml` en la cámara de entrega (< 1 px; con la convención de antes, 2,5 px). Con TD.1, 104 s en el contenedor de la nube del 2026-11-24 (33 + 31 + 17 + 23 s); sin medir en el portátil |
| `carga` | tarea | 3 | 59 | 31 | los dos destinos (D2) y la red cerrada (I2) |
| `datos` | tarea | 2 + 6 | — | 23 | I7: posiciones.yaml y la tabla de fuentes del panel «Datos» byte a byte (T2.1), red de T2.2–T2.5 |
| `deuda-f2` | tarea | 1 + 2 | — | 17 | T2.7: DT35 (zonas de plan durante la demo; posiciones.yaml de una v10 con textos raros, en YAML 1.1 y 1.2), DT31 (aviso de la capa del otro robot) y DT41 (`#btnCalc` tras un cálculo) en una página |
| `determinismo` | tarea | 3 | 95 | 50 | I6 con «gemelo» (A, B, A'), sin reintento de semilla (D5), banco de ensayo |
| `distorsion` | puerta | 3 | — | 104 | T4.5: con la distorsión apagada, los píxeles por tarea, la escena y el lienzo (hash) son los del gemelo antes de T4.5; camera_info malos rechazados con su motivo; encendida, el píxel de marcadores de la mesa coincide con Brown–Conrady (1 px; D = 0 con la proyección sin distorsión); campo extra y su máximo editable; Restaurar; la web sin gancho. Medido el 2026-11-21 en un portátil con Windows (`node --test`, 53 + 28 + 22 s) |
| `escenas-claude` | tarea | 1 | 48 | 29 | almacén de claude.ai (D2) |
| `escenas-firestore` | tarea | 2 | 99 | 50 | I2: reglas del simulacro (campos, clave, papelera). «Guardar, editar…» medía 61,7 s antes y 36,2 s ahora |
| `escenas-v8` | tarea | 1 + 3 | 96 | 49 | I1: las tres escenas v8 |
| `exportar` | tarea | 5 | 192 | 112 | I7: conversión por robot (203–206), ida y vuelta de posiciones.yaml, correcciones 5, 7 y 9 |
| `ilegibles` | tarea | 2 | 72 | 32 | DT11 e I2 con las reglas de los dos almacenes |
| `interfaz` | tarea | 2 | — | 190 | TU.1: remodelado de la interfaz. La rejilla es la de antes (cabecera de 42 px, panel de 384 px, lienzo de 998 × 828), los cinco pasos numerados son las pestañas de siempre en el orden del trabajo, la cinta del ciclo dice «Sin comprobar» sin comprobación previa, «Lista» con ella (y sigue «Lista» al cambiar la focal), «Sin calcular» y «No empieza» (con el motivo del agarre y los puntos rojos de los pasos 1 y 4) sin tocar `L`, las entradas de `CACHE_PLAN`, `firmaVal` ni `D.planes`, la matriz cámara × tarea da los píxeles y el estado de las tarjetas con marca y palabra, su casilla marca la fila y el punto del paso 2 se borra si cambia una cámara fuera de la pestaña, el botón de la cinta es «Reproducir demo», y la web. Medido el 2026-11-23 en el contenedor de la nube, unas 4 veces más lento que el portátil (DT47): 167 + 22 s; en el portátil, SIN MEDIR. Va en tarea por ser la única red de TU.1 |
| `layout` | tarea | 3 | 139 | 67 | I1 e I2: campos v9, solo lectura, 50.000 caracteres. «web: …» medía 63,6 s antes y 31,5 s ahora |
| `matriz` | tarea | 4 | 40 | 31 | I8: matriz «gemelo» en orden directo; comprobaciones de `matriz-curso.json` sin página |
| `oclusion` | tarea | 5 | — | 49 | T4.2: oclusión por el brazo a lo largo del plan que deja «Calcular» (5 tramos por plato, 694 muestras de 0,1 s): una fila por objetivo en cada cámara con lo que dio el gemelo y recalculada aparte en la página (muestreo por tiempo, interpolación de ejecutar(), esferas de `colocar()` y rayo-esfera por la ecuación de segundo grado), SIN VALIDAR y sin umbral; solo lee (`CACHE_PLAN`, `L`, `firmaVal` y `D.planes` no cambian; sin plan al día, «sin plan» y sin número; con la demo en pausa y la persona apartada, las mismas cifras); el brazo tapa a la mano de la cámara de la persona (49,5 %) y deja de tapar al alejarla (0 %); con la mitad del paso cambia ≤ 0,3 puntos; paso y margen editables, Restaurar y valores malos sin aplicar; la web sin gancho. El plan entero se muestrea en 30 ms con 694 muestras y en 102 ms con 1383 (cota de la ficha: 2 s). Medido el 2026-11-22 en un portátil con Windows (`node --test`, 10 + 6 + 13 + 10 + 10 s) |
| `perfil` | tarea | 4 | 118 | 61 | I6 con «curso» (A, B, A'), perfil de movimiento (T1.6) |
| `robot` | tarea | 2 | 90 | 46 | I6 con el 203; dibujo = colisión = TCP (T1.4) |
| `ros` | tarea | 1 + 67 | — | 33 | I7: parametros_celda.yaml (T2.2), TF estáticas (T2.4), escena de colisión (T2.3) y camera_info y usb_cam (T2.5) con nominal, 203 y prefijo en una página, y los mismos bytes dos veces en ella (Común-C1). T2.3 y T2.5 añadieron 24 subtests, de milisegundos cada uno; TD.4, 4 (los marcadores de la zona de fruta, 0–3, frente a su dibujo, también con la zona girada); TD.2, 3 (DT44: la misma z de cada zona de la bandeja en `tf/bandeja ∘ tf/zona_*`, los parámetros y posiciones.yaml; la cadena, a la exactitud del redondeo, ≤ 0,551 mm, frente a la cara de la bandeja). Entero, 101 s el 2026-11-24 en el contenedor lento (unas 4 veces el portátil); 97 s con TD.2 |
| `ros-referencias` | tarea | 1, 1 + 3 | — | 31 | I7: los ficheros de ROS (T2.2–T2.5) byte a byte con nominal, 203 y prefijo (Común-C3), red de T2.6 |
| `ros-panel` | tarea | 2 (11 + 2 subtests) | — | 47 | I7 y DT38: sección «Exportar a ROS» (T2.6) con nominal, 203 y prefijo en el artefacto y la web: lista, descargas y .tar byte a byte (el .tar, con el tar del sistema), Ver y Copiar, repintado sin cálculo y descargas desactivadas durante un cálculo |
| `sensor` | tarea | 2 | 59 | 34 | modelo de sensor (T1.7, D10) |
| `tablero` | puerta | 3 | — | 87 | T4.4: diseñador del tablero de marcadores de la bandeja: filas por marcador (id, lado, x, y, giro), añadir y quitar, campos inválidos sin aplicar, aviso de centros alineados con su tolerancia editable, Ver, Copiar y Descargar de `tablero_bandeja.yaml` (texto a mano, reglas de ros, ida y vuelta), Restaurar; la misma sección en la web; la escena no cambia. Medido el 2026-11-22 en el contenedor (`node --test`, 44 + 23 + 19 s) |
| `tareas` | tarea | 3 | — | 27 | T4.1: panel por cámara con los píxeles por tarea (proyección estenopeica), sus estados, origen y fuente; velocidad de la bandeja editable y Restaurar; la misma cifra en la web. Medido el 2026-11-21 en un portátil con Windows (`node --test`, 27 s) |
| `usb` | tarea | 4 | — | 29 | T4.3: demanda USB por cámara, suma por bus y aviso «una cámara por bus» con la reserva máxima; bus, reserva, formato y factor editables; salida de `lsusb -v` pegada; la misma sección en la web. Medido el 2026-11-21 en un portátil con Windows (`node --test`, 29 s) |
| `cambio-robot` | puerta | 3 | 186 | 122 | T1.5-3, T1.5-4 (68,6 s antes) y correcciones 1 y 2 |
| `determinismo-demo` | puerta | 1 | 38 | 32 | I6 a nivel de demo: matriz en orden inverso (también hay I6 en la tarea) |
| `matriz-curso` | puerta | 2 | 74 | 53 | matriz «curso» directa e inversa (I6 con «curso» también en la tarea) |
| `partida` | puerta | 3 | 280 | 232 | H3 (203,6 s antes) y H4 de F1 |
| `revision-f1` | puerta | 2 | 64 | 34 | H1 y H2 de la revisión de F1 |
| `ros-recarga` | puerta | 1 | — | 46 | I7: Común-C1 tras volver a abrir con la misma Tu mesa; las dos páginas calculan antes de exportar porque la escena lleva el giro de las cajas del plan (DT38). Salió de `ros` al aceptar T2.3 + T2.5 |
| `robot-avisos` | puerta | 3 | 123 | 66 | aviso del 204 e «IK calibrada no converge» (T1.4) |
| `salida` | puerta | 2 | 62 | 43 | salida de la bandeja (T1.9); la recorren también las matrices |
| `validar` | puerta | 4 | 298 | 213 | barrido de Validar (123,7 s antes), búsqueda (83,6 s antes) y porPerfil al guardar (T1.8). Desde T2.8 el barrido llega a 10 cm (el arranque en contacto de 6 cm era DT30): T1.8-1 midió 121 s |

`ros-panel` (T2.6) pulsa sus botones con `click()` en la página: `page.click` espera dos fotogramas quietos y, con SwiftShader,
cada descarga tardaba 1,5–3 s (el fichero medía 105 s; así, 47 s). `ros` y `ros-referencias`, medidos al entregar T2.3 + T2.5 (`npm test` de 14 min 25 s), en una ejecución en la que el resto de
ficheros también tardó un 10–40 % más que en esta columna (`carga`, 38 s): antes medían 66 y 24 s. `ros` sin la recarga (que
pasó a `ros-recarga`) y `ros-recarga`, medidos por el coordinador al aceptar T2.3 + T2.5.

«Tests» cuenta los `test()` de cada fichero tal como los ejecuta node:test: `escenas-v8` crea uno por escena en un bucle y
`carga` tiene una suite (`describe`) con dos tests que comparten la página de su `before`; `datos`, un test con 6 subtests
(el YAML y la tabla de cada caso) sobre la misma página.

### Invariantes en el nivel de tarea (T2.0-C4)

| Invariante | Nivel de tarea | Además, en la puerta |
|---|---|---|
| I1 escenas v8 | `escenas-v8` (3 escenas), `layout` (campos v9, código corrupto) | — |
| I2 Firestore | `escenas-firestore`, `layout` (50.000 caracteres), `ilegibles`, `carga` (red cerrada) | `validar` (porPerfil con el simulacro) |
| I3 clave | `tools/check.sh` (los dos niveles) | — |
| I4 nada a ROS | sin test todavía (DT8, T3.1) | — |
| I5 un solo HTML | `unit/i5` | — |
| I6 determinismo | `determinismo` (A, B, A' «gemelo»), `robot` (con el 203), `perfil` (con «curso»), `oclusion` (la oclusión de T4.2 solo lee `CACHE_PLAN`: ni planifica ni cambia `L`, `firmaVal` ni `D.planes`) | `determinismo-demo`, `matriz-curso` (órdenes inversos) |
| I7 exportación | `exportar` (T1.5-1 con 203–206, T1.5-2 ida y vuelta), `datos` (YAML y tabla byte a byte), `ros` (parámetros y TF estáticas de ROS: reglas de rcl, mismo texto que posiciones.yaml, ida y vuelta, árbol TF, cuaterniones, cámaras frente a su cámara de render y origen; escena de colisión: validadores de CollisionObject y de .scene, escena = obstaculos(), .scene = YAML en su world; cámaras: validador de camera_info, píxeles frente a la cámara de render y usb_cam), `ros-referencias` (los ficheros de ROS byte a byte), `ros-panel` (lo que se descarga desde el panel es `ficherosRos()`, también en el .tar), `deuda-f2` (zonas de plan durante la demo y textos raros de una v10 en posiciones.yaml), `exportar` y `datos` con `yaml11.mjs` (posiciones.yaml igual en YAML 1.1 y 1.2, TD.3), `unit/marcos`, `unit/origen`, `unit/exportar`, `unit/exportar-escena`, `unit/rcl-params`, `unit/validadores-ros`, `unit/tar`; `distorsion` (el camera_info exportado y la escena no cambian con la distorsión: T4.5) | `cambio-robot` (prefijo en el YAML) |
| I8 matriz | `matriz` (8 casos en orden directo) | — |

## Cierre del navegador (T2.0)

`abrir()` (`tests/navegador.mjs`) lanza cada navegador con `chromium.launchServer` y lo termina con `kill()` al cerrar,
en vez de `browser.close()`. Con el gemelo abierto, SwiftShader acumula fotogramas en el proceso de la GPU, y el cierre
ordenado espera a vaciarlos: tardaba 10–28 s según el tiempo que llevaba abierta la página, y 55 tests lo pagaban (medido en
T2.0). `kill()` tarda unos 40 ms, Playwright borra el perfil temporal y la carga siguiente sigue en unos 14 s. Nada del test
cambia: cada test cierra en su `finally`, después de sus comprobaciones. Con el mismo reparto, la suite completa pasó de
37 min 24 s a 23 min 15 s.

## Qué hay en tests/

- `unit/`: `node:test` sobre el código puro de `src/` (cinemática, layout, semilla, perfiles, sensor, origen de cada valor,
  formateador de los ficheros exportados y del .tar, modelo de distorsión y lectura de camera_info de T4.5, muestreo y rayos de la oclusión de T4.2, proyección y anotaciones de la captura sintética de T4.6, I5, niveles) y los validadores de los ficheros de ROS con sus muestras que deben fallar.
- `e2e/`: Playwright + Chromium con SwiftShader sobre los dos destinos; `permitidos.json`, avisos de consola permitidos.
- `fixtures/`: referencias generadas por el gemelo (`generar.mjs`, `npm run caracterizar`): matrices, escenas v8, cinemática
  del curso, `yaml/` (panel «Datos», T2.1) y `ros/<caso>/` (ficheros de ROS, T2.2–T2.5: `npm run caracterizar -- --ros`).
  `yaml-antes-td3/` no se regenera: es el `posiciones.yaml` que exportaba el gemelo antes de TD.3 (9393f30), para probar que
  un fichero antiguo se sigue importando igual (`exportar`, TD.3-C4).
- `mocks/`: simulacros de Firestore (con las reglas) y del almacén de claude.ai. No se tocan.
- `medidas/`: línea base y repetibilidad (`npm run medir`).
- `navegador.mjs` (navegador y red cerrada), `servidor.mjs` (servidor local), `medir.mjs` (procedimientos compartidos por
  tests, generador y medidas), `niveles.mjs` (los dos niveles), `rcl-params.mjs` (validador de ficheros `--params-file` con
  las reglas de `rcl_yaml_param_parser`, sobre `yaml@2.9.1` en modo 1.1 y 1.2: T2.2), `collision-object.mjs` (lista de
  `moveit_msgs/CollisionObject` para `set_message_fields`: T2.3), `scene-texto.mjs` (formato `.scene` de MoveIt: T2.3) y
  `camera-info.mjs` (camera_info de `camera_calibration_parsers`: T2.5), sin el código que genera los ficheros, y
  `tar-sistema.mjs` (el tar del sistema como referencia del .tar del panel: lista, extrae y compara, T2.6) y `yaml11.mjs`
  (lo que un lector YAML 1.1 como PyYAML leería distinto de 1.2: tipos de 1.1 con `yaml@2.9.1`, más los saltos de línea
  U+0085, U+2028 y U+2029 y los caracteres no imprimibles, que `yaml@2.9.1` no aplica; TD.3, DT42).
