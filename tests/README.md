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
| `carga` | tarea | 3 | 59 | 31 | los dos destinos (D2) y la red cerrada (I2) |
| `datos` | tarea | 2 + 6 | — | 23 | I7: posiciones.yaml y la tabla de fuentes del panel «Datos» byte a byte (T2.1), red de T2.2–T2.5 |
| `determinismo` | tarea | 3 | 95 | 50 | I6 con «gemelo» (A, B, A'), sin reintento de semilla (D5), banco de ensayo |
| `escenas-claude` | tarea | 1 | 48 | 29 | almacén de claude.ai (D2) |
| `escenas-firestore` | tarea | 2 | 99 | 50 | I2: reglas del simulacro (campos, clave, papelera). «Guardar, editar…» medía 61,7 s antes y 36,2 s ahora |
| `escenas-v8` | tarea | 1 + 3 | 96 | 49 | I1: las tres escenas v8 |
| `exportar` | tarea | 5 | 192 | 112 | I7: conversión por robot (203–206), ida y vuelta de posiciones.yaml, correcciones 5, 7 y 9 |
| `ilegibles` | tarea | 2 | 72 | 32 | DT11 e I2 con las reglas de los dos almacenes |
| `layout` | tarea | 3 | 139 | 67 | I1 e I2: campos v9, solo lectura, 50.000 caracteres. «web: …» medía 63,6 s antes y 31,5 s ahora |
| `matriz` | tarea | 4 | 40 | 31 | I8: matriz «gemelo» en orden directo; comprobaciones de `matriz-curso.json` sin página |
| `perfil` | tarea | 4 | 118 | 61 | I6 con «curso» (A, B, A'), perfil de movimiento (T1.6) |
| `robot` | tarea | 2 | 90 | 46 | I6 con el 203; dibujo = colisión = TCP (T1.4) |
| `ros` | tarea | 1 + 54, 1 | — | 75 | I7: parametros_celda.yaml (T2.2), TF estáticas (T2.4), escena de colisión (T2.3) y camera_info y usb_cam (T2.5) con nominal, 203 y prefijo en una página; los mismos bytes al volver a abrir con la misma Tu mesa (Común-C1). T2.3 y T2.5 añadieron 24 subtests a la misma página, de milisegundos cada uno |
| `ros-referencias` | tarea | 1, 1 + 3 | — | 31 | I7: los ficheros de ROS (T2.2–T2.5) byte a byte con nominal, 203 y prefijo (Común-C3), red de T2.6 |
| `sensor` | tarea | 2 | 59 | 34 | modelo de sensor (T1.7, D10) |
| `cambio-robot` | puerta | 3 | 186 | 122 | T1.5-3, T1.5-4 (68,6 s antes) y correcciones 1 y 2 |
| `determinismo-demo` | puerta | 1 | 38 | 32 | I6 a nivel de demo: matriz en orden inverso (también hay I6 en la tarea) |
| `matriz-curso` | puerta | 2 | 74 | 53 | matriz «curso» directa e inversa (I6 con «curso» también en la tarea) |
| `partida` | puerta | 3 | 280 | 232 | H3 (203,6 s antes) y H4 de F1 |
| `revision-f1` | puerta | 2 | 64 | 34 | H1 y H2 de la revisión de F1 |
| `robot-avisos` | puerta | 3 | 123 | 66 | aviso del 204 e «IK calibrada no converge» (T1.4) |
| `salida` | puerta | 2 | 62 | 43 | salida de la bandeja (T1.9); la recorren también las matrices |
| `validar` | puerta | 4 | 298 | 213 | barrido de Validar (123,7 s antes), búsqueda (83,6 s antes) y porPerfil al guardar (T1.8) |

`ros` y `ros-referencias`, medidos al entregar T2.3 + T2.5 (`npm test` de 14 min 25 s), en una ejecución en la que el resto de
ficheros también tardó un 10–40 % más que en esta columna (`carga`, 38 s): antes medían 66 y 24 s.

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
| I6 determinismo | `determinismo` (A, B, A' «gemelo»), `robot` (con el 203), `perfil` (con «curso») | `determinismo-demo`, `matriz-curso` (órdenes inversos) |
| I7 exportación | `exportar` (T1.5-1 con 203–206, T1.5-2 ida y vuelta), `datos` (YAML y tabla byte a byte), `ros` (parámetros y TF estáticas de ROS: reglas de rcl, mismo texto que posiciones.yaml, ida y vuelta, árbol TF, cuaterniones, cámaras frente a su cámara de render y origen; escena de colisión: validadores de CollisionObject y de .scene, escena = obstaculos(), .scene = YAML en su world; cámaras: validador de camera_info, píxeles frente a la cámara de render y usb_cam), `ros-referencias` (los ficheros de ROS byte a byte), `unit/marcos`, `unit/origen`, `unit/exportar`, `unit/exportar-escena`, `unit/rcl-params`, `unit/validadores-ros` | `cambio-robot` (prefijo en el YAML) |
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
  formateador de los ficheros exportados, I5, niveles) y los validadores de los ficheros de ROS con sus muestras que deben fallar.
- `e2e/`: Playwright + Chromium con SwiftShader sobre los dos destinos; `permitidos.json`, avisos de consola permitidos.
- `fixtures/`: referencias generadas por el gemelo (`generar.mjs`, `npm run caracterizar`): matrices, escenas v8, cinemática
  del curso, `yaml/` (panel «Datos», T2.1) y `ros/<caso>/` (ficheros de ROS, T2.2–T2.5: `npm run caracterizar -- --ros`).
- `mocks/`: simulacros de Firestore (con las reglas) y del almacén de claude.ai. No se tocan.
- `medidas/`: línea base y repetibilidad (`npm run medir`).
- `navegador.mjs` (navegador y red cerrada), `servidor.mjs` (servidor local), `medir.mjs` (procedimientos compartidos por
  tests, generador y medidas), `niveles.mjs` (los dos niveles), `rcl-params.mjs` (validador de ficheros `--params-file` con
  las reglas de `rcl_yaml_param_parser`, sobre `yaml@2.9.1` en modo 1.1 y 1.2: T2.2), `collision-object.mjs` (lista de
  `moveit_msgs/CollisionObject` para `set_message_fields`: T2.3), `scene-texto.mjs` (formato `.scene` de MoveIt: T2.3) y
  `camera-info.mjs` (camera_info de `camera_calibration_parsers`: T2.5), sin el código que genera los ficheros.
