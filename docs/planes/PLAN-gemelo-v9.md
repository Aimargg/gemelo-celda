# Plan: gemelo de la celda v9, fiel al curso, exportable a ROS y conectable en solo lectura

> **Estado:** en curso · **Última actualización:** 2026-11-15 · **Tipo:** cambio en repo existente, con rescate de deuda en la fase 0
>
> Este archivo es la fuente de verdad del desarrollo del repo `Aimargg/gemelo-celda`. Claude Code lo lee antes de cada encargo y cita sus decisiones e invariantes. Al terminar una tarea, lo único que cambia del plan es el estado de esa tarea, que pasa a «entregada» con el hash del commit. El resto de cambios llegan por brief o los hace el arquitecto.
>
> Base de conocimiento: el estudio «gemelo-ros», con corte 2026-11-15, en el Project ROBOTICA FINAL (`claude/estado-del-arte-gemelo-ros.md` y sus 12 facetas). Las citas «(→ faceta «sección»)» remiten a ese estudio.

## 1. Objetivo

Llevar el gemelo de la v8 a la v9 con cuatro cambios:
- planifica con la cinemática y los parámetros del entorno del curso;
- exporta la disposición como datos de ROS 2 listos para cargar;
- refleja en vivo, sin mandar nada, el robot simulado del contenedor;
- puntúa las cámaras por tarea.

Todo con pruebas automáticas y sin perder las escenas guardadas.

**Para qué:** que el grupo use el gemelo para decidir la disposición real y las cámaras, y para ver su propio código ROS moviendo el robot simulado. Sin esto, el gemelo da veredictos con un modelo distinto del que usará MoveIt. En la demo real, los fallos aparecerían como sorpresas.

## 2. Criterios de éxito

- [ ] `npm test` pasa en verde en un contenedor sin GPU ni red externa — se comprueba con: salida de `npm test`.
- [ ] Misma disposición y mismo perfil dan el mismo plan, se calcule en el orden que se calcule — se comprueba con: test de determinismo (I6).
- [ ] La cinemática de los robots 203–206 coincide con la que genera el xacro del curso, con error ≤0,01 mm en `tool0` — se comprueba con: test contra los ficheros de referencia de T1.3.
- [ ] Una escena guardada con la v8 se abre en la v9 con las mismas posiciones y el mismo veredicto — se comprueba con: test con escenas v8 de referencia (I1).
- [ ] Los ficheros exportados se cargan en `sim_<id>` del contenedor y las posiciones coinciden con las del gemelo (±1 mm) — se comprueba con: U-tarea de validación de F2 (`tf2_echo`, RViz).
- [ ] Con `sim_<id>` y el `ejemplos/control_robot.py` del profesor en marcha, el gemelo mueve su robot igual que la simulación, con una edad de mensaje inferior a 0,5 s, y nunca envía nada a ROS — se comprueba con: U-tarea de F3 y test I4.
- [ ] Cada cámara muestra píxeles por tarea, oclusión a lo largo de las trayectorias y un aviso de ancho de banda USB — se comprueba con: tests de F4 y captura del panel.
- [ ] Prueba de extremo a extremo: abrir una escena de Firestore → elegir el robot → Calcular → exportar a ROS → cargarlo en `sim_<id>` → conectar el espejo → ver el robot moverse y la comparación entre el plan del gemelo y el de MoveIt.

## 3. Fuera de alcance

- Mandar órdenes a ROS desde el gemelo: publicar, llamar a servicios, enviar goals o ejecutar. Requiere respuesta del profesorado sobre puertos junto al UR3e y la cláusula de control remoto de ISO 10218-2:2025 (→ industria40; → puente-ros «seguridad del puente»).
- Usar el gemelo como hardware de `ros2_control` (`joint_state_topic_hardware_interface`): no hay precedente con navegador y necesita un xacro y un nodo en el lado ROS (→ sustitutos-prueba).
- Física (Rapier, Jolt, MuJoCo) y agarre por fricción.
- Generar código de nodos, launch o paquetes del proyecto de Robótica. Choca con «código que su autor no sepa explicar = 0» (→ generacion-config «código, modelos y LLM»). Se exportan **datos**.
- Tocar el repositorio del proyecto de Robótica o copiar a él nada de este repo. El gemelo es código generado por IA (gemelo-celda-notas, sección v8).
- Cambiar la versión de three.js (r160), las reglas o el esquema de Firestore, o la librería de Firebase, sin pasar por la puerta P6/P3.
- Entrenar modelos, imágenes de personas reales y datos biométricos.

## 4. Contexto y supuestos

| Dato | Tipo | Fuente | Estado |
|---|---|---|---|
| El repo tiene solo los ficheros servidos: `index.html` (275.208 B), `config.js`, `firebase.js` (Firebase 13.1.0 empaquetado), `ur3e-malla.json`, `mesa.jpg`; un único commit `c96e82d` | observable | clon del repo, 2026-11-15 | comprobado |
| Las fuentes (`src/part1.html`, `app.js` de 156 KB, `kin.js`, `colision.js`, `fallos.js`, `escenas.js`) y los scripts `tools/build.sh` y `tools/build_web.sh` reconstruyen `index.html` **idéntico byte a byte** a `c96e82d` | observable | paquete del arquitecto, `cmp` el 2026-11-15 | comprobado |
| El `config.js` publicado en `c96e82d` es JavaScript inválido (bloque pegado dentro de `appId`); hay una versión corregida | observable | `node --check`, 2026-11-15 | comprobado; falta confirmar que el usuario la ha subido (U2) |
| No hay suite de pruebas: hay 64 scripts sueltos de Playwright sobre el gancho `window.__g` (`?prueba`), un Firestore simulado y un simulador de almacén de claude.ai | observable | carpeta de trabajo de v4–v8 | comprobado; los de referencia van en `tests/legacy/` |
| Las pruebas cargan three desde `node_modules` interceptando jsDelivr, porque el sandbox no tiene red general | observable | `tests/legacy/shot2.js` | comprobado |
| Chromium de Playwright con SwiftShader da WebGL2 sin GPU | observable | → gemelo-web «pruebas» | comprobado en contenedor Linux; SIN VALIDAR en Windows |
| El RRT usa `SEMILLA` global: cada plan depende de cuántos se hicieron antes | observable | código `colision.js` l. 196-200 | comprobado |
| `enBase` resta la base sin girar: supone que `base_link` tiene los ejes de la mesa | observable | → generacion-config «punto de partida» | comprobado |
| `base_link` está girado respecto a `world` −135° (203), −36,6° (204) y 0° (205, 206) | observable | → generacion-config «marcos» (xacro del curso) | comprobado en código; SIN VALIDAR en ROS |
| `calibration_204.yaml` deja `tool0` ≈427 mm desplazado | inferido | → moveit «riesgos del entorno del curso» | SIN VALIDAR en ROS |
| Id del robot B | indeterminado | — | HUECO (Q1) |
| Ancho de sensor de la ELP: 5,952 mm según la ficha, frente a los 6,287 mm del gemelo | observable / indeterminado | → camaras-colocacion «sensor y lente» | SIN VALIDAR hasta la intrínseca |
| roslib 2.1.0 solo ESM; su `importmap.js` está roto; con un import map a mano funciona | observable | → puente-ros «rosbridge 2.7.1 + roslibjs 2.1.0» | comprobado con ficheros npm locales; SIN VALIDAR por jsDelivr |
| rosbridge no está en la imagen del curso; el contenedor de Windows usa red bridge con 6081/5901 | observable | → puente-ros «entorno del curso» | comprobado en el repo del curso |
| Los agentes trabajan en Claude Code con acceso al repo y con npm y GitHub disponibles | supuesto | — | SIN VALIDAR (Q5) |

## 5. Decisiones

| Id | Decisión | Alternativas consideradas | Motivo | Reversible |
|---|---|---|---|---|
| D1 | Las fuentes viven en `src/`; `tools/build_web.sh` genera `index.html` en la raíz y se versiona construido (Pages sirve `main` tal cual) | GitHub Action que construye; bundler (esbuild/Vite) | Sin dependencias nuevas, reproducible (comprobado) y sin gastar compilaciones de Pages (10/h) | sí |
| D2 | Dos destinos desde las mismas fuentes: web (Pages + Firestore) y artefacto de claude.ai (`dist/gemelo-celda.html`, almacén de claude) | Abandonar el artefacto | Las dos versiones están en uso y comparten el 99 % del código | sí |
| D3 | Arnés de pruebas: Node (`node:test`) para el código puro y Playwright + Chromium con SwiftShader para la página. three@0.160.0 (y roslib en F3) se sirven desde `node_modules`. Firestore y claude.ai, siempre simulados. Cualquier petición externa no interceptada hace fallar el test | Vitest con jsdom | jsdom no tiene WebGL; el patrón ya está probado en `tests/legacy/shot2.js` | sí |
| D4 | Refactor mínimo: se extrae a ficheros nuevos de `src/` solo lo que hace falta probar o aislar (RNG, cinemática por robot, exportadores, cliente ROS, métricas de cámara). Se concatenan con el mismo mecanismo de marcadores `@@…@@` del build. Sin módulos ES ni bundler | Migrar a ESM con bundler | El artefacto tiene que ser un único HTML; reescribir 156 KB generados es el mayor riesgo de regresión | sí (deuda DT1) |
| D5 | Semilla por petición: se deriva de un hash de la entrada del plan (q inicial, objetivo, obstáculos, perfil). Se elimina `SEMILLA` global | Reiniciar `SEMILLA` en cada caso | El veredicto de una escena no debe depender de qué se calculó antes | sí |
| D6 | Dos perfiles de movimiento que conviven en un flujo «explorar → validar». «Gemelo» (el actual) es rápido y se usa al arrastrar objetos y en la búsqueda de disposiciones. «Curso» usa aceleración 5 rad/s², escala 0,1, cartesiano con `max_step` 0,01 m y trata el arranque en contacto como fallo; valida antes de guardar y para el desarrollo contra la simulación del curso. Cada escena guarda el veredicto de los dos perfiles (en `estado`, sin cambiar las reglas). Las escenas v8 conservan su veredicto «gemelo»; el de «curso» aparece «sin validar» hasta pulsar **Validar** o guardar la escena: abrirla no calcula nada (decidido 2026-11-15; precisado el 2026-11-16 con T1.8-6) | Un único perfil por defecto | El usuario necesita los dos: explorar rápido y saber si funcionará en la simulación | sí |
| D7 | Selector de robot (nominal, 203, 204, 205, 206). FK calibrada con los `calibration_<id>.yaml` del curso, guardados como datos con su atribución. IK: la analítica nominal más un refinamiento numérico sobre la FK calibrada (→ moveit «replicar MoveIt», INFERIDO). Con el 204, aviso visible de calibración sospechosa | Solo nominal; IK numérica pura | Así se replica de forma determinista lo que hace MoveIt (→ moveit) y se conservan las 8 ramas de la IK | sí |
| D8 | Exportar solo **datos**: `ros__parameters`, `CollisionObject` en YAML, `.scene`, TF estáticas por YAML y comandos, `camera_info` nominal y parámetros de `usb_cam`. Cada valor lleva comentado su origen: MEDIDO, FABRICANTE o SUPUESTO. Formato determinista | Generar launch y nodos | Regla de código explicable (→ generacion-config) | sí |
| D9 | Conexión con ROS por rosbridge con roslib 2.1.0, a través de un **adaptador único de solo lectura** (`rosEspejo`) que solo puede suscribirse. Import map a mano (roslib y eventemitter3 desde `dist/`, versión exacta) | foxglove_bridge (acciones solo como topics ocultos, cliente JS deprecado) | Es la vía en producción y la superficie de riesgo se reduce a leer (→ puente-ros) | sí |
| D10 | Modelo de sensor por modo y por cámara. Por defecto, la ficha de la ELP (5,952 mm, marcada SIN VALIDAR); el `camera_info` lo sustituye cuando haya intrínseca | Mantener 6,287 mm | El gemelo sobreestima el campo horizontal ~3° a 3,6 mm (→ camaras-colocacion) | sí |
| D11 | Nada de Web Workers ni WASM en v9 hasta el pico T5.1 | Mover ya el planificador a un worker | No se sabe si la CSP del artefacto lo permite; GitHub Pages no admite COOP/COEP (→ gemelo-web «trabajo fuera del hilo principal») | sí |
| D12 | Los agentes trabajan en ramas propias (una por tarea o lote, en su worktree) que el coordinador revisa e integra en `v9-dev` con merge `--no-ff`. Al cerrar cada fase, el coordinador fusiona `v9-dev` en `main` si la puerta está en verde (P1 delegada el 2026-11-15); fusionar equivale a desplegar. Solo el coordinador hace push | Commits directos a `main`; solo el usuario fusiona | Pages publica `main`: fusionar es pasar a producción, y el usuario delegó P1 para tener la herramienta cuanto antes | sí (revert) |

## 6. Invariantes

| Id | Regla | Cómo se comprueba |
|---|---|---|
| I1 | Toda escena v8 se abre en v9 con las mismas posiciones y el mismo veredicto. El layout lleva `version`, la migración se hace al cargar y nunca se reescribe Firestore en bloque | Test con escenas v8 de referencia (`tests/fixtures/escenas-v8/`) |
| I2 | No cambian ni los campos de escena ni las reglas de Firestore (`esEscena` con `hasOnly`, `layout` como string de 50.000 caracteres como máximo) sin pasar por P3. Las pruebas nunca tocan el Firestore real | Revisión del diff de `web_src/firestore.rules` y de `escenas.js`; el arnés aborta y suspende cualquier petición a `*.googleapis.com` / `*.firebaseio.com` |
| I3 | La clave del grupo nunca entra en git: `web_src/` contiene solo plantillas `@@CLAVE@@` y `clave_grupo.txt` y `dist/` están ignorados | `tools/check.sh` busca el patrón de la clave en los ficheros rastreados y falla si lo encuentra |
| I4 | El gemelo nunca envía nada a ROS: en el código no hay `advertise`, `publish`, `callService`, `sendGoal`, `Topic(...).publish` ni `Param.set`, salvo en el adaptador, que no los expone | Test unitario sobre las fuentes (lista de llamadas prohibidas) y e2e contra un rosbridge falso: solo recibe `subscribe` y `unsubscribe` |
| I5 | El artefacto es un solo HTML. Los scripts externos solo vienen de `cdn.jsdelivr.net` con versión exacta (three@0.160.0; roslib@2.1.0 y eventemitter3 desde F3). La web añade solo `config.js` y `firebase.js` locales | Test que analiza el HTML construido (import map y `<script src>`) |
| I6 | Misma disposición, mismo robot y mismo perfil dan el mismo plan y el mismo veredicto, sea cual sea el orden de cálculo | Test e2e: planificar A, después B, después A otra vez; A y A' iguales |
| I7 | Las exportaciones van en metros y radianes, en el `base_link` del robot elegido (o en `world` cuando se diga explícitamente), según REP-103, con redondeo fijo (1 mm, 0,001 rad) y cada valor con su origen. Los parámetros de la óptica llevan la unidad en el nombre (`focal_mm`, DT19) | Test de ida y vuelta (exportar → leer → comparar ±0,5 mm) y test de giro con los ids 203–206 |
| I8 | La matriz de ensayo de la demo en perfil «gemelo» no empeora frente a la línea base (T0.3) | Test e2e de la matriz contra `tests/fixtures/matriz-base.json` |
| I9 | Este repo no se usa como fuente del repo de Robótica. Los commits pueden llevar coautoría de IA, porque el repo se declara generado por IA | Punto de revisión en cada pull request |

## 7. Fases

## Fase 0 — Fuentes en el repo y red de seguridad
- **Objetivo:** que el código fuente esté versionado, se construya igual y tenga pruebas que detecten regresiones.
- **Hito:** en la rama `v9-dev`, `npm test` está en verde y `bash tools/build_web.sh` reproduce `index.html` de `c96e82d`. El usuario ve en GitHub las carpetas `src/`, `tools/`, `tests/` y `docs/`.
- **Puerta de calidad:** suite en verde · revisión independiente contra el plan · revisión de secretos (I3) · registro de deuda al día · P1 (fusionar en `main`, que aquí no cambia la web).

## Fase 1 — Fidelidad al curso y determinismo
- **Objetivo:** que los veredictos del gemelo sean repetibles y se calculen con el robot, los marcos, el perfil y el sensor del curso.
- **Hito:** en Ajustes se elige el robot (203–206) y el perfil «curso». El YAML sale en el `base_link` correcto y recalcular da siempre lo mismo.
- **Puerta de calidad:** suite en verde (I1, I6, I8) · revisión independiente · pasada de deuda (borrar `tests/legacy/`, DT3) · P1.

## Fase 2 — Exportar la disposición a ROS (datos)
- **Objetivo:** desde una escena, descargar los ficheros que el grupo carga en ROS sin escribir código generado.
- **Hito:** el usuario descarga el paquete de datos de una escena, lo carga en `sim_<id>` y ve en RViz la mesa, las cajas, los platos y las cámaras donde deben estar.
- **Puerta de calidad:** suite en verde (I7) · revisión independiente · U-tarea de validación en el contenedor · P1.

## Fase 3 — Espejo de ROS en solo lectura
- **Objetivo:** ver en el gemelo lo que hace el robot simulado del contenedor y comparar el plan de MoveIt con el del gemelo.
- **Hito:** con `sim_<id>` y `control_robot.py`, el robot del gemelo se mueve en vivo y se ve el plan de MoveIt superpuesto.
- **Puerta de calidad:** suite en verde (I4, I5) · revisión de seguridad (solo lectura, globs y puerto en 127.0.0.1) · revisión independiente · P1 · P4 vigente.

## Fase 4 — Cámaras por tarea
- **Objetivo:** que la decisión de dónde poner cada cámara se apoye en métricas por tarea, en la oclusión a lo largo del ciclo y en el ancho de banda.
- **Hito:** el panel de cada cámara muestra si cumple cada tarea (fruta, ArUco, cara, mano y bandeja en movimiento) y en qué porcentaje del ciclo la tapa el brazo, y avisa si las tres no caben en el USB.
- **Puerta de calidad:** suite en verde · revisión independiente · P1.

## Fase 5 — Ampliación (solo si F0–F4 están aceptadas)
- **Objetivo:** rendimiento y una fidelidad más fina: planificador fuera del hilo principal, TOTG, Pilz y URDF real.
- **Hito y puerta:** se definen al llegar, tras el pico T5.1.

## 8. Tareas

Estados: pendiente · en curso · entregada · aceptada · correcciones · bloqueada · descartada.

| Id | Fase | Tarea | Ejecutor | Depende de | Riesgo | Estado | Commit |
|---|---|---|---|---|---|---|---|
| T0.1 | 0 | Empaquetar las fuentes con la estructura del repo y comprobar que el build es idéntico | Arquitecto | — | bajo | aceptada | 41dd4d5 |
| U1 | 0 | Subir el paquete a la rama `v9-dev` o dar acceso al repo | Arquitecto (con permiso del usuario) | T0.1 | — | aceptada | 41dd4d5 |
| U2 | 0 | Confirmar que la web guarda escenas con el `config.js` corregido (subido por el arquitecto a `main`) | Usuario | — | — | pendiente | 161d7ce |
| T0.2 | 0 | Arnés de pruebas (`npm test`) y pruebas de caracterización | Claude Code | U1 | medio | aceptada | 6ed2854, dac4587 |
| T0.3 | 0 | Línea base medida (informe, sin cambiar código) | Claude Code | T0.2 | bajo | aceptada | 5d7ba13, dac4587 |
| T0.4 | 0 | `CLAUDE.md`, `tools/check.sh` y plantilla de pull request | Claude Code | T0.2 | bajo | aceptada | e8940d3, dac4587 |
| U3 | 0 | Responder Q1–Q5 | Usuario | — | — | aceptada | — |
| T1.1 | 1 | Versionar el layout y migrarlo al cargar | Claude Code | T0.3 | medio | aceptada | 4cabe6c, 69a6905 |
| T1.2 | 1 | Semilla por petición en el RRT | Claude Code | T1.1 | medio | aceptada | 0cde036, 46bd547, 69a6905 |
| T1.3 | 1 | Ficheros de referencia de cinemática generados con el xacro del curso | Claude Code | T0.2, Q4 | bajo | aceptada | cce7601 |
| T1.4 | 1 | Selector de robot con FK calibrada e IK refinada | Claude Code | T1.1, T1.3 | alto | aceptada | 83afa78, 3554b56 |
| T1.5 | 1 | `world`↔`base_link` por robot en la conversión y en la exportación | Claude Code | T1.4 | medio | aceptada | dafd643, 3554b56 |
| T1.6 | 1 | Perfil de movimiento «curso» | Claude Code | T1.2 | medio | aceptada | 3fe70b7 |
| T1.7 | 1 | Modelo de sensor de la ELP por modo | Claude Code | T1.1 | bajo | aceptada | 9bcf739 |
| T1.8 | 1 | Flujo «explorar → validar» con los dos perfiles | Claude Code | T1.6 | medio | aceptada | b44dff3, 4b80043 |
| T1.9 | 1 | Salida de la bandeja sin contacto (DT22, DT23) | Claude Code | T1.8 | medio | aceptada | 07ce862, 8f9e0ca |
| T2.0 | 2 | Arnés en dos niveles: `npm test` por tarea y suite completa en las puertas (DT32) | Claude Code | F1 | bajo | aceptada | a0ff130, cc86429 |
| T2.1 | 2 | Origen de cada valor (MEDIDO, FABRICANTE, SUPUESTO) unificado para exportar | Claude Code | F1 | bajo | aceptada | 86184e3, 1d01f34, cc86429 |
| T2.2 | 2 | YAML `ros__parameters` de poses | Claude Code | T2.1 | medio | aceptada | e9922e7, d062ed8, 10d0d8a, 90637a6 |
| T2.3 | 2 | Escena: `CollisionObject` en YAML y `.scene` | Claude Code | T2.1 | medio | aceptada | 8178f3c, 0ce94fe, 8a65d85, 6d5524b |
| T2.4 | 2 | TF estáticas (YAML por TF y comandos) | Claude Code | T2.1 | medio | aceptada | e9922e7, 0805778, 10d0d8a, 90637a6 |
| T2.5 | 2 | `camera_info` nominal y parámetros de `usb_cam` por cámara | Claude Code | T2.1, T1.7 | medio | aceptada | 8443ad3, 0ce94fe, 8a65d85, 6d5524b |
| T2.6 | 2 | Panel «Exportar a ROS» y guía de validación | Claude Code | T2.2–T2.5 | bajo | aceptada | 91c7b45, 69f8f91, 79e0a1c, 694618e |
| T2.7 | 2 | Pasada de deuda de F2: exportación (DT31, DT34–DT37, DT41) | Claude Code | T2.6 | medio | aceptada | 7f7f7b2, d2c0dfc, 24bc283, 8b86459, 64a4e5c, ebb6a8c, f37bb5d, 19ea470 |
| T2.8 | 2 | Pasada de deuda de F2: la salida de la bandeja frente a su balanceo (DT30) | Claude Code | T2.7 | medio | aceptada | 02b6bbb, e72f5ca, 493e29a, 4af84c2, c280041, f271177 |
| U4 | 2 | Validar los ficheros exportados en `sim_<id>` | Usuario | T2.6 | — | pendiente | — |
| T3.0 | 3 | Pico: roslib desde jsDelivr y permiso de red local en Pages y en el artefacto | Claude Code + usuario | F2 | medio | pendiente | |
| T3.1 | 3 | Adaptador `rosEspejo` de solo lectura con estados y reconexión | Claude Code | T3.0 | alto | pendiente | |
| T3.2 | 3 | Espejo de articulaciones y edad del dato | Claude Code | T3.1 | medio | pendiente | |
| T3.3 | 3 | Plan de MoveIt superpuesto y comparación con el plan del gemelo | Claude Code | T3.2 | medio | pendiente | |
| T3.4 | 3 | Escena de MoveIt superpuesta y diferencias con la del gemelo | Claude Code | T3.2 | medio | pendiente | |
| T3.5 | 3 | Configuración personal de rosbridge (`ros/`): globs, 127.0.0.1 y compose | Claude Code | T3.0 | medio | pendiente | |
| U5 | 3 | Arrancar rosbridge en el contenedor y conectar el espejo | Usuario | T3.5, T3.2 | — | pendiente | — |
| U6 | 1 | Tras publicar F1, abrir la web con la clave del grupo y mirar «Ilegibles» en Escenas: si no está en 0, revisar los motivos antes de que nadie borre nada | Usuario | P1 de F1 | — | pendiente | — |
| T4.1 | 4 | Métricas por tarea con umbrales con fuente | Claude Code | F1 | medio | entregada | 8ccc78d |
| T4.2 | 4 | Oclusión a lo largo de las trayectorias calculadas | Claude Code | T4.1 | alto | entregada | 90356dd |
| T4.3 | 4 | Estimador de ancho de banda USB | Claude Code | T4.1 | bajo | verificada | e113f97, e92362f, 51b3bee |
| T4.4 | 4 | Diseñador del tablero de marcadores de la bandeja | Claude Code | T4.1 | medio | pendiente | |
| T4.5 | 4 | Distorsión Brown–Conrady opcional desde `camera_info` | Claude Code | T2.5 | medio | verificada | 9ea2cf9 |
| T4.6 | 4 | Captura sintética con anotaciones | Claude Code | T4.1 | medio | pendiente | |
| T5.1 | 5 | Pico: workers y WASM bajo la CSP del artefacto | Claude Code + arquitecto | F4 | bajo | pendiente | |

### T0.1 — Paquete de fuentes (hecho por el arquitecto)

- Contenido:
  - `src/`: las 6 fuentes de la v8;
  - `tools/build.sh` (artefacto → `dist/gemelo-celda.html`) y `tools/build_web.sh` (→ `index.html`, y `dist/firestore.rules` / `dist/LEEME.md` si existe `clave_grupo.txt`);
  - `tools/firebase-bundle/` (receta de `firebase.js`);
  - `web_src/` (plantillas con `@@CLAVE@@` y `PEGA_AQUI`);
  - `tests/legacy/` (scripts de referencia y simuladores);
  - `.gitignore`;
  - este plan.
- Comprobado el 2026-11-15: el build sobre el clon reproduce `index.html` de `c96e82d` byte a byte; ningún fichero del paquete contiene la clave del grupo; `clave_grupo.txt` queda ignorado por git.

### U1 — Subir el paquete al repo (tarea del usuario)

- **Qué:** poner las carpetas nuevas en una rama aparte del repo, sin tocar la web publicada.
- **Dónde:** github.com/Aimargg/gemelo-celda.
- **Por qué:** los agentes trabajan sobre el repo. Una «rama» es una copia paralela del código: lo que se haga en ella no llega a la web hasta que la fusiones en `main`.
- **Pasos (vía web):**
  1. En la página del repo, pulsa el desplegable **main** (arriba a la izquierda), escribe `v9-dev` y pulsa **Create branch: v9-dev from main**.
  2. Con la rama `v9-dev` seleccionada, ve a **Add file › Upload files**.
  3. Descomprime `gemelo-v9-paquete.zip` en tu ordenador y arrastra a la ventana las carpetas `src`, `tools`, `web_src`, `tests`, `docs` y el fichero `.gitignore`. En Windows, `.gitignore` puede no verse en el Explorador: actívalo en **Vista › Mostrar › Elementos ocultos**.
  4. Abajo, deja marcado **Commit directly to the v9-dev branch** y pulsa **Commit changes**.
- **Alternativa:** dile al arquitecto que lo suba él. Te pedirá permiso de escritura en el repo.
- **Cómo saber que está bien:** en la rama `v9-dev` se ven las carpetas `src/`, `tools/`, `tests/` y `docs/planes/PLAN-gemelo-v9.md`, y en `main` todo sigue igual.
- **Qué devolver al plan:** «hecho».

### U2 — Confirmar que la web guarda escenas (tarea del usuario)

- **Qué:** comprobar que el `config.js` corregido está subido y que Firestore funciona.
- **Dónde:** repo, rama `main`, fichero `config.js`; y la web `https://aimargg.github.io/gemelo-celda/#g=<clave>`.
- **Por qué:** es la línea base real. Las pruebas usan un Firestore simulado y no lo ven.
- **Pasos:**
  1. Si no lo has hecho, sube el `config.js` corregido a `main` (**Add file › Upload files**; sustituye el existente).
  2. Espera 2 minutos y abre la web con el enlace completo.
  3. Pulsa **Guardar escena** y guarda una de prueba.
- **Cómo saber que está bien:** aparece «Escena guardada» y en Firestore › Datos se ve el documento.
- **Qué devolver al plan:** «hecho» o el texto del aviso rojo.

### T0.2 — Arnés de pruebas y caracterización

- **Objetivo:** que `npm test` construya y pruebe la página sin red externa, para distinguir lo que rompe un cambio de lo que ya estaba roto.
- **Alcance:**
  - Crea: `package.json` (scripts `build`, `test`, `test:rapido`), `tests/unit/`, `tests/e2e/`, `tests/fixtures/`, `tests/servidor.mjs` y `tests/navegador.mjs`.
  - No toca `src/`, `index.html`, `config.js`, `firebase.js` ni `ur3e-malla.json`.
- **Reutiliza:** el arranque de `tests/legacy/shot2.js` (servidor local, three servido desde `node_modules` interceptando jsDelivr, fuentes de Google bloqueadas, flags de SwiftShader). También `tests/legacy/test_kin.js`, `e_matriz3.js`, `e_fs1.js`, `e_fs2.js`, `firebase-mock.js` y `mock_claude.html`.
- **Dependencias nuevas:**
  - Solo de desarrollo, con versión exacta comprobada con `npm view` en el momento: `playwright`, y `three@0.160.0` para servirlo.
  - No hay dependencias de ejecución nuevas.
- **Criterios de aceptación:**
  1. `npm test` ejecuta, en este orden, `build` (los dos destinos), unitarios y e2e. Sale con código 0 si todo pasa y distinto de 0 si algo falla. El informe muestra que un test que falla adrede hace fallar la suite (sin commitear ese test).
  2. e2e de carga:
     - `dist/gemelo-celda.html?prueba` carga sin `pageerror` ni errores de consola, salvo una lista explícita de avisos permitidos en `tests/e2e/permitidos.json`;
     - `index.html` carga con un `config.js` de prueba y `firebase.js` sustituido por `firebase-mock.js` mediante intercepción, sin errores.
  3. Toda petición fuera de `localhost` que no esté interceptada aborta y **hace fallar** el test, incluidas `*.googleapis.com` y `*.firebaseio.com` (I2).
  4. Unitario de cinemática:
     - con RNG sembrado, 2000 idas y vueltas de la IK con error < 1e-6;
     - 0 soluciones inválidas;
     - el resultado es el mismo en dos ejecuciones.
  5. Caracterización de la matriz:
     - 8 casos fijos de `ensayo` (M0 y M1, balanceo de 0 y 2 cm, caja y mesa), siempre en el mismo orden dentro de una página nueva;
     - el resultado se guarda en `tests/fixtures/matriz-base.json`;
     - el test compara fin, choques, roces y pausas.
  6. Escenas:
     - con `firebase-mock.js`: guardar, editar, papelera, restaurar y borrar definitivo, incluido un intento con clave inválida que muestra el aviso de clave;
     - con `mock_claude.html`: guardar y abrir.
  7. Escenas v8 de referencia: tres escenas exportadas con `codigoEscena` (la disposición por defecto y dos variantes) en `tests/fixtures/escenas-v8/`, con un test que las abre y registra posiciones y veredicto. Es la base de I1.
  8. `npm run test:rapido` (unitarios más carga) tarda menos de 2 minutos; `npm test`, menos de 15 en el contenedor.
- **Verificación:** devolver la salida completa de `npm test`, la lista de tests y la de avisos permitidos con el motivo de cada uno.
- **Invariantes afectadas:** I2, I3 y I5 (el arnés las hace comprobables).

### T0.3 — Línea base medida

- **Objetivo:** saber cómo está la v8 antes de tocarla, para poder juzgar las mejoras.
- **Alcance:** crea `tests/medidas/` y `docs/estado/linea-base-v8.md`. No cambia comportamiento.
- **Reutiliza:** el arnés de T0.2.
- **Criterios de aceptación:**
  1. Matriz completa de 32 casos (balanceo ≤2 cm), con su resultado agregado.
  2. Tiempos en SwiftShader: carga, `calcularPlanes` de la disposición por defecto y `ensayo` M0.
  3. Tareas largas de más de 200 ms durante `calcularPlanes` (`PerformanceObserver` de tipo `longtask`): cuántas hay y la más larga.
  4. Tamaño de los dos destinos y de los recursos.
  5. Cada cifra lleva su entorno y la advertencia de que SwiftShader no representa un portátil con GPU.
- **Verificación:** el informe y el comando que lo regenera.
- **Invariantes afectadas:** ninguna (solo lectura).

### T0.4 — `CLAUDE.md`, comprobación única y plantilla de pull request

- **Objetivo:** que cada sesión de Claude Code empiece con las reglas del repo.
- **Alcance:** crea `CLAUDE.md` (máximo 80 líneas), `tools/check.sh` y `.github/pull_request_template.md`.
- **Criterios de aceptación:**
  1. `CLAUDE.md` contiene:
     - qué es el repo y que está generado por IA;
     - cómo construir y probar;
     - «nunca editar `index.html` ni `dist/` a mano»;
     - qué ficheros no se tocan (`firebase.js`, `ur3e-malla.json`, `config.js`);
     - ramas y pull requests (D12);
     - la remisión a este plan para decisiones e invariantes;
     - «al terminar una tarea, marcarla como entregada en el plan con el hash».
  2. `tools/check.sh` ejecuta la búsqueda de la clave en los ficheros rastreados (I3), el build y `npm test`, y sale con código distinto de 0 ante cualquier fallo. Se demuestra con un fichero temporal que contiene el patrón (sin commitearlo).
  3. La plantilla de pull request lista las invariantes que se deben marcar.
- **Verificación:** salida de `tools/check.sh`.
- **Invariantes afectadas:** I3 e I9.

### U3 — Responder las preguntas abiertas (tarea del usuario)

- **Qué:** elegir A, B o C en Q1–Q5 de la sección 10. Si no respondes, se aplica la opción marcada por defecto.
- **Qué devolver al plan:** las letras.

### T1.1 — Versionar el layout

- **Objetivo:** poder añadir robot, perfil y sensor a la disposición sin romper las escenas guardadas.
- **Alcance:**
  - Toca la serialización y la carga del layout (`aplicarLayout`, `codigoEscena`, guardado local y de escenas).
  - No toca las reglas de Firestore: los campos nuevos van dentro del string `layout`.
- **Reutiliza:** el patrón de `aplicarLayout` y los fixtures `escenas-v8/`.
- **Criterios de aceptación:**
  1. El layout guardado lleva `version: 9` y los campos `robotId` (`nominal` por defecto; el campo `robot` ya existe y es la posición A/B del brazo en la celda), `perfil` y `sensor`. Una escena nueva usa `curso` y `elp-ficha`; una escena v8 migrada usa `gemelo` y `gemelo-v8`.
  6. H2 (fase 0): `confirmar()` de `escenas.js` cancela el temporizador de una confirmación anterior de la misma escena.
  2. `migrarLayout` convierte cualquier layout sin `version` a v9 con esos valores por defecto. Las tres escenas v8 se abren con posiciones idénticas y el mismo veredicto (I1).
  3. Un layout con `version` mayor que la conocida se abre en solo lectura, con un aviso.
  4. Un layout corrupto (JSON inválido, sin `mesa`) muestra un error y no deja la mesa a medias.
  5. Un layout de más de 50.000 caracteres se rechaza al guardar con un mensaje claro, sin llamar a Firestore (I2).
- **Verificación:** tests de migración y de errores.
- **Invariantes afectadas:** I1 e I2.

### T1.2 — Semilla por petición

- **Objetivo:** que el veredicto no dependa del orden de cálculo (D5).
- **Alcance:**
  - Toca `colision.js`, en la generación aleatoria del RRT y en sus llamadas.
  - Nada de UI.
- **Criterios de aceptación:**
  1. Desaparece `SEMILLA` global. La semilla se deriva de un hash estable de la entrada: q inicial, objetivo, obstáculos y perfil, redondeados a 1e-6.
  2. Test I6: planificar A, después B, después A da A y A' idénticos, comparando los q del camino.
  3. La matriz de caracterización se vuelve a fijar con la nueva semilla. Su diff se documenta en el informe y no empeora el agregado de T0.3 (I8): misma cantidad de casos correctos o más.
  4. Si el RRT no encuentra camino con su semilla, el resultado sigue siendo «sin plan», con la misma explicación que ahora. No hay reintento silencioso con otra semilla.
  5. H3 (fase 0): en `ensayo()`, `cfg.fase` es la fase de la bandeja al empezar el ensayo; desaparece el parche de `tests/medir.mjs`.
  6. La matriz y la medida de escena dan todos los campos iguales (incluidos `t_sim` y `planes`) en páginas nuevas distintas; la matriz de 32 casos de la línea base deja de variar (DT7).
- **Verificación:** salida de los tests y diff de `matriz-base.json` con su explicación.
- **Invariantes afectadas:** I6 e I8.

### T1.3 — Ficheros de referencia de cinemática del curso

- **Objetivo:** tener la verdad de la cinemática de los robots 203–206 tal como la ve ROS, sin necesidad de ROS.
- **Alcance:**
  - Crea `tools/fixtures/fk_desde_xacro.py`, `tests/fixtures/cinematica/<id>.json` y `src/datos/calibracion.js` (parámetros como datos, con atribución al repo del curso `ignacioDeusto/ros2_mucsi_26_27`, commit 4e4e1a7).
  - No toca la cinemática del gemelo.
- **Reutiliza:**
  - la vía de → generacion-config «URDF y xacro fuera de ROS»: `xacro` de PyPI, `ur_description` de la rama jazzy de GitHub y los `calibration_<id>.yaml` del repo del curso;
  - un sustituto mínimo de `ament_index`.
- **Criterios de aceptación:**
  1. Para el modelo nominal y para cada id, cada JSON contiene:
     - el giro `mount_yaw`;
     - la transformada `world`→`base_link`;
     - la pose de `tool0` en `base_link` en 20 configuraciones articulares fijas (las mismas para todos los ids);
     - los nombres de los frames (con prefijo o sin él) del URDF de un solo robot y del doble.
  2. El script es determinista (dos ejecuciones dan el mismo JSON) e indica las versiones que ha usado.
  3. Se reproduce la anomalía del 204 (desplazamiento ≈427 mm) y queda anotada en el JSON como `"sospechoso": true`, con la prueba de validación en ROS (→ moveit «riesgos del entorno del curso»).
  4. Si no hay red o falta un fichero, el script falla con un mensaje que dice qué falta. No genera ficheros parciales.
- **Verificación:** los JSON, el comando que los genera y la comprobación de que el modelo nominal coincide con la FK del gemelo con error <1e-6.
- **Invariantes afectadas:** ninguna.
- **Puerta:** Q4 (copiar los datos de calibración del curso a un repo público).

### T1.4 — Selector de robot, FK calibrada e IK refinada

- **Objetivo:** planificar con la cinemática del robot elegido (D7).
- **Alcance:**
  - Toca `kin.js` (FK con los parámetros de cada robot e IK refinada), el selector junto al de lado A/B y el layout (`robotId`; `robot` sigue siendo la posición A/B).
  - No toca la colisión ni el planificador, salvo para pasarles la cinemática.
- **Reutiliza:** la IK analítica actual como semilla y `src/datos/calibracion.js`.
- **Criterios de aceptación:**
  1. La FK de cada id coincide con `tests/fixtures/cinematica/<id>.json` con error ≤0,01 mm y ≤0,001° en las 20 configuraciones.
  2. La IK calibrada refina cada rama analítica con Levenberg–Marquardt o DLS, hasta 1e-6 m y 1e-6 rad o un máximo de iteraciones. Las ramas que no convergen se descartan y se cuentan. En 2000 poses alcanzables de prueba, al menos una rama converge en ≥99,5 % de los casos con 203, 205 y 206.
  3. Con el robot `nominal` no cambia nada (I8, matriz idéntica).
  4. Con el 204 aparece un aviso permanente: «Calibración 204 sospechosa (SIN VALIDAR): compruébala en `sim_204` antes de usarla», con el comando. El gemelo no oculta el resultado.
  5. Si el refinamiento no converge para el objetivo de un plan, el fallo se explica como «IK calibrada no converge» en el panel de fallos, no como «inalcanzable».
- **Verificación:** tests de FK e IK con sus cifras y captura del selector y del aviso.
- **Invariantes afectadas:** I1, I6 e I8.

### T1.5 — `world`↔`base_link` por robot

- **Objetivo:** que las coordenadas de exportación estén en el `base_link` del robot real (→ generacion-config «marcos»).
- **Alcance:** toca `mundoABase`, `enBase` y `generarYaml`. Añade al layout el campo `prefijoFrames`, vacío por defecto.
- **Criterios de aceptación:**
  1. Para cada id, un punto de mesa conocido convertido a `base_link` coincide con la transformada de `tests/fixtures/cinematica/<id>.json` (±0,5 mm).
  2. `posiciones.yaml` indica en la cabecera el robot, el frame (con el prefijo si lo hay) y el supuesto de que `world` tiene los ejes de la mesa. Esto último se marca SUPUESTO hasta confirmarlo en el laboratorio.
  3. Si se cambia el robot de una escena, el gemelo pregunta si se mantiene la mesa (y se mueve el robot) o se mantiene la posición del robot respecto a la mesa. Nunca cambia sin avisar.
  4. El campo para el prefijo explica que solo los URDF dobles lo llevan, con un enlace al HUECO de frames del estudio.
- **Verificación:** tests de conversión y diff de un `posiciones.yaml` antes y después con el 203.
- **Invariantes afectadas:** I1 e I7.

### T1.6 — Perfil de movimiento «curso»

- **Objetivo:** que los tiempos y las comprobaciones se parezcan a MoveIt en el curso (D6, → moveit «replicar MoveIt en el gemelo»).
- **Alcance:** toca la temporización del plan, la ruta cartesiana y la comprobación del arranque, todo parametrizado por perfil. Selector en Ajustes.
- **Criterios de aceptación:**
  1. El perfil «curso» usa:
     - aceleración de 5 rad/s² y escala de 0,1;
     - ruta cartesiana con `max_step` de 0,01 m y comprobación del punto medio a 1 mm;
     - arranque en contacto = fallo, con el texto «MoveIt rechazaría el arranque en contacto».
  2. En una ruta de prueba, la duración en «curso» frente a «gemelo» sigue la relación que predicen los parámetros (test con la ruta y la tolerancia escritas).
  3. Con el perfil «gemelo», la matriz queda idéntica (I8).
  4. Las escenas nuevas usan «curso»; las v8 migradas, «gemelo» (D6). La semilla del RRT usa hoy la constante `PERFIL_PLAN = 'gemelo'` (`src/colision.js`): pasa a ser el perfil de la petición, sin cambiar la matriz «gemelo».
  5. El panel deja claro que la temporización es una aproximación y no TOTG (deuda DT4).
- **Verificación:** tests y captura del selector.
- **Invariantes afectadas:** I1, I6 e I8.

### T1.8 — Flujo «explorar → validar» con los dos perfiles

- **Objetivo:** que el grupo explore disposiciones rápido y sepa, antes de guardarlas o de desarrollar contra la simulación, si funcionarían con MoveIt del curso (D6).
- **Alcance:** toca la barra de cálculo (`CALC`, `calcularPlanes`), la búsqueda de disposiciones (`buscarAlternativa`), el guardado de escenas (`estado`) y la miniatura de cada escena. No toca las reglas de Firestore: `estado` ya admite un objeto.
- **Criterios de aceptación:**
  1. Arrastrar o mover objetos recalcula con «gemelo». El botón **Validar con perfil curso** recalcula la disposición actual con «curso» y muestra los dos veredictos a la vez.
  2. Si los dos veredictos difieren («pasa en gemelo, falla en curso»), se muestra el motivo concreto: arranque en contacto, ruta cartesiana incompleta o tiempo de ciclo.
  3. La búsqueda de disposiciones ordena los candidatos con «gemelo» y confirma con «curso» los 3 mejores antes de proponerlos; si ninguno pasa en «curso», lo dice.
  4. Al guardar, `estado` conserva `ok`, `n` y `txt` del perfil de la escena (compatibilidad con la v8) y añade `porPerfil: {gemelo, curso}`. La miniatura muestra dos puntos (gemelo y curso) y, si falta uno, «sin validar».
  5. El tiempo de ciclo de la demo se muestra con los dos perfiles, para que se vea la diferencia de velocidad.
  6. Abrir una escena v8 no cambia su veredicto «gemelo» (I1); el de «curso» se calcula al pulsar **Validar** y solo se guarda si el usuario guarda la escena.
- **Verificación:** test e2e con una disposición que pasa en los dos perfiles, otra que solo pasa en «gemelo» (arranque en contacto) y la búsqueda de disposiciones; captura de la barra.
- **Invariantes afectadas:** I1, I2 e I6.

### T1.7 — Modelo de sensor de la ELP

- **Objetivo:** calcular el campo de visión y los mm/px con el sensor que declara la ELP (D10).
- **Alcance:** toca `hfovDe`, `metricasCam` y el layout (`sensor`). No toca el render de las miniaturas salvo para el FOV.
- **Criterios de aceptación:**
  1. Las opciones de sensor son `gemelo-v8` (6,287 mm) y `ELP ficha` (5,952 mm × 4,71 mm, SIN VALIDAR), por modo. Las escenas nuevas usan la segunda y las v8 conservan la primera (I1).
  2. El FOV y los mm/px coinciden con las fórmulas de → camaras-colocacion «fórmulas y entradas» en 3 casos de prueba.
  3. La métrica muestra la etiqueta SIN VALIDAR mientras no se haya cargado un `camera_info` (F4).
- **Verificación:** tests de las fórmulas.
- **Invariantes afectadas:** I1.

### T1.9 — Salida de la bandeja sin contacto (añadida al revisar T1.8)

- **Objetivo:** que tras soltar el plato la pinza acabe libre, como tendría que hacerlo el nodo de movimiento con MoveIt, para que el perfil «curso» pueda completar la demo y la validación de T1.8 distinga disposiciones (DT22).
- **Alcance:** la coreografía de la colocación (salida de la bandeja, `planColocar` y comprobación previa) y `rutaNivelada` (DT23), igual para los dos perfiles. No toca el arranque de «curso» ni lo permitido en el movimiento siguiente.
- **Criterios de aceptación:**
  1. Tras la salida, la postura final no toca nada con el contexto del movimiento siguiente, en la matriz y en las escenas v8.
  2. La disposición por defecto completa la demo con «curso».
  3. La matriz «gemelo» no empeora (I8) y las escenas v8 conservan posiciones, comprobación previa, fin, choques y roces (I1).
  4. La matriz «curso» queda fijada en `tests/fixtures/matriz-curso.json` con su test.
- **Verificación:** tests e2e de la salida y de las dos matrices; captura de Validar con «curso» en verde.
- **Invariantes afectadas:** I1, I6 e I8.

### Fichas provisionales de F2–F5

Estas fichas se revisan y se detallan al cerrar la fase anterior, con lo aprendido.

- **T2.0** Arnés en dos niveles (DT32):
  - `npm test` (cada tarea y `check.sh`) en menos de 15 min;
  - la suite completa (orden inverso, barridos y matrices enteras), en un comando para las puertas de fase, que `check.sh --puerta` ejecuta;
  - ningún test se borra ni se debilita: cada uno queda en un nivel, con la lista de qué nivel tiene cada test en `tests/README.md`.
- **T2.1** Una sola fuente del origen de cada valor exportable (MEDIDO, FABRICANTE o SUPUESTO; hoy en la tabla FUENTES) que leen todos los exportadores.
- **T2.2** `ros__parameters`:
  - solo escalares y arrays homogéneos, sin listas de mapas, con los mapas como nombres con punto (→ generacion-config «camera_info, parámetros y poses»);
  - test: el YAML se analiza y se reconstruyen las poses (I7).
- **T2.3** Escena:
  - `CollisionObject` en YAML en el `base_link` del robot (cajas, platos como cilindros, mesa, bandeja como caja), con ids estables;
  - `.scene` en `world`, con un aviso de que `load_geometry_from_file` da `success: true` aunque el fichero esté mal;
  - un validador propio del `.scene` en los tests (→ generacion-config «escena de colisión»).
- **T2.4** TF estáticas:
  - un YAML por TF para el componente `StaticTransformBroadcasterNode` y los comandos `static_transform_publisher` con flags con nombre;
  - las aristas que calibra Visión (`base_link`→`camara_*`) van marcadas «nominal: la sustituye la calibración».
- **T2.5** Cámaras:
  - `camera_info` nominal (K a partir de la focal y el sensor; D = 0; `plumb_bob`) con `camera_name` por cámara;
  - YAML de `usb_cam` por cámara con `frame_id`, `camera_name`, `camera_info_url`, `pixel_format` (`mjpeg2rgb`), tamaño, fps y exposición manual. Esto corrige el `camera_frame_id` del launch del curso (→ camaras-colocacion «drivers»).
- **T2.6** Panel «Exportar a ROS»:
  - un botón por fichero más «copiar», sin librerías nuevas;
  - guía `docs/validar-en-ros.md` con los comandos de U4.
- **U4** En `sim_<id>`, el usuario:
  - carga las TF y la escena;
  - compara con `tf2_echo` (±1 mm) y con RViz;
  - devuelve capturas y salidas.
- **T3.0** Pico (informe, sin código para quedarse):
  - roslib 2.1.0 y eventemitter3 desde `dist/` de jsDelivr con import map a mano, en el artefacto y en Pages;
  - flujo del permiso de red local en Chrome desde Pages hacia `ws://localhost:9090`;
  - qué pasa en Safari y en el artefacto. Lo que requiera el navegador del usuario va como paso del usuario.
- **T3.1** `rosEspejo`, el único punto que habla con rosbridge:
  - estados `desconectado`, `conectando`, `conectado`, `error` y `permiso denegado`, visibles en la UI;
  - reconexión con espera creciente; tolera NaN;
  - solo expone `suscribir`/`desuscribir` (I4);
  - test contra un rosbridge falso en Node que comprueba que solo recibe `subscribe`/`unsubscribe`.
- **T3.2** `/joint_states` mueve el robot del gemelo, con nombres con prefijo o sin él. Indicador de la edad del dato (>0,5 s = «sin datos»). El planificador del gemelo se desactiva mientras el espejo está activo.
- **T3.3** `/display_planned_path` (`moveit_msgs/DisplayTrajectory`) se dibuja como un fantasma. Se compara con el plan del gemelo para el mismo objetivo (duración, longitud articular, `fraction`), según el protocolo de → moveit «replicar MoveIt en el gemelo».
- **T3.4** `/monitored_planning_scene` muestra los objetos de MoveIt superpuestos y resalta en qué difieren de la escena del gemelo (objetos que faltan o desplazados más de 5 mm).
- **T3.5** Carpeta `ros/` (herramienta personal, no del proyecto):
  - comando de rosbridge con `topics_sub_glob` limitado a los topics del espejo;
  - `topics_pub_glob`, `services_glob`, `actions_glob` y `params_glob` apuntando a un nombre inexistente, **no vacíos** (→ puente-ros «seguridad del puente»);
  - `address:=127.0.0.1`;
  - en Docker Desktop, `ports: - "127.0.0.1:9090:9090"`;
  - instrucción `apt install ros-jazzy-rosbridge-server` dentro del contenedor, sin tocar el Dockerfile del curso.
- **U5** El usuario arranca `sim_<id>`, rosbridge y `control_robot.py` en su PC y conecta el espejo desde Chrome. Nunca en la red del laboratorio con el robot real (P4).
- **T4.1** Panel por cámara con píxeles por tarea y umbrales con fuente: ArUco con ≥14 px como mínimo de OpenCV 4.6 y 32–50 px como zona fiable; fruta medida en la entrada de la red; distancia entre pupilas; mano en la entrada de la red de palma; desenfoque con una velocidad de bandeja editable (supuesta por defecto 0,1 m/s); profundidad de campo con F supuesto. Fórmulas de → camaras-colocacion «fórmulas y entradas», cada umbral con su cita.
- **T4.2** Oclusión a lo largo de las trayectorias calculadas: muestreo del plan y rayos contra el brazo y la pinza. Da el porcentaje del ciclo con el objetivo tapado, por cámara y objetivo. Test con una disposición en la que el brazo tapa a propósito.
- **T4.3** Ancho de banda USB:
  - por cámara, formato, resolución, fps y reserva (declarable, por defecto la máxima, ~196 Mbit/s); por bus, la suma;
  - aviso «con la reserva máxima cabe una cámara por bus» (→ camaras-colocacion «USB 2.0»);
  - campo para pegar la salida de `lsusb -v`.
- **T4.4** Diseñador del tablero de la bandeja:
  - ids, lado y posiciones;
  - aviso si los marcadores quedan alineados sobre un solo borde (→ percepcion-bandeja-personas «pose con varios marcadores»);
  - exporta YAML con las esquinas en el marco de la bandeja para `estimatePoseBoard`.
- **T4.5** Distorsión Brown–Conrady como post-proceso de fragmento sobre un render con más campo, con parámetros de un `camera_info` cargado (→ gemelo-web «cámaras simuladas»). Desactivada por defecto.
- **T4.6** Captura sintética 640×480 de una cámara con anotaciones 2D (fruta, platos, ArUco) en JSON:
  - sirve para probar pipelines, no para sustituir datos reales;
  - sin personas reales;
  - lectura síncrona en r160 (≈0,3 s por imagen, → gemelo-web).
- **T5.1** Pico dentro del artefacto: `new Worker(URL.createObjectURL(blob), {type:'module'})` y `WebAssembly.instantiate` de un módulo mínimo, anotando los errores de seguridad (`SecurityError`). Lo hace el arquitecto publicando una página de prueba. Según el resultado, se plantean después: planificador en un worker, TOTG portado desde MoveIt (BSD), Pilz PTP/LIN y URDF real con urdf-loader 0.13.1.

## 9. Puertas humanas

| Id | Antes de | Tipo | Motivo | Estado |
|---|---|---|---|---|
| P1 | Fusionar `v9-dev` en `main` al cerrar cada fase | delegada al coordinador (aprobado por el usuario el 2026-11-15): fusiona si la puerta de calidad de la fase está en verde y avisa | `main` es la web publicada; reversible con revert | delegada |
| P2 | Publicar la versión de artefacto en claude.ai | arquitecto, al cerrar F4 (aprobado 2026-11-15) | El enlace es público («cualquiera con el enlace») | delegada |
| P3 | Cualquier cambio en las reglas o en los campos de escena de Firestore | decisión del usuario | Puede dejar fuera escenas o abrir permisos | no prevista |
| P4 | Conectar el espejo a un ROS de la red del laboratorio o con el UR3e real | decisión del usuario tras la respuesta del profesorado | rosbridge no autentica; puertos junto al robot real | cerrada hasta PROF |
| P5 | Cambiar el perfil por defecto a «curso» | resuelta (2026-11-15): «curso» para escenas nuevas, «gemelo» para las v8 | Cambia los veredictos de las escenas guardadas | cerrada |
| P6 | Añadir una dependencia no prevista en D3 o D9, o cambiar three, Firebase o roslib de versión | delegada al coordinador (2026-11-15) si es imprescindible, comprobada en npm y registrada aquí. 2026-11-16: `yaml@2.9.1` en `devDependencies`, solo para los tests de T2.2–T2.5 (eemeli/yaml, ISC, sin dependencias, publicada el 2026-09-11): valida los YAML exportados con un analizador ajeno al gemelo, en modo 1.1 y 1.2; no entra en el HTML (I5) | Riesgo de rotura y de paquetes inventados | delegada |

## 10. Preguntas abiertas

| Id | Pregunta | Opciones y consecuencia de cada una | Bloquea a | Decide |
|---|---|---|---|---|
| Q1 | ¿Qué id es el robot B? | A) Se sabe: el selector lo trae por defecto. B) No se sabe aún (**respuesta 2026-11-15**): el selector arranca en `nominal` con un aviso | valor por defecto de T1.4 | grupo (pendiente) |
| Q2 | ¿Qué perfil por defecto? | Resuelta 2026-11-15: «curso» para escenas nuevas y «gemelo» para las v8 (D6) | T1.6 | cerrada |
| Q3 | ¿Se mantiene la versión de artefacto de claude.ai? | Resuelta 2026-11-15: la web de GitHub Pages es la herramienta principal; el artefacto se sigue construyendo (es el destino de las pruebas) y se publica una vez al cerrar F4, sin trabajo propio de claude.ai | D2, T0.2 | cerrada |
| Q4 | ¿Se copian los `calibration_<id>.yaml` del curso al repo público? | Resuelta 2026-11-15: sí, con atribución; el repo del curso es la referencia de prácticas. Lo que no cuadre (p. ej. el 204) se avisa al usuario | T1.3 | cerrada |
| Q5 | ¿Dónde trabajan los agentes? | Resuelta 2026-11-15: en la sesión en la nube del coordinador (ya en marcha). Alternativa disponible: plan-autonomo-cc en el PC del usuario | ejecución autónoma | cerrada |

## 11. Registro de deuda

| Id | Deuda | Dónde | Impacto | Cuándo se paga | Estado |
|---|---|---|---|---|---|
| DT1 | `app.js` es un monolito de 156 KB concatenado, sin módulos | `src/app.js` | Cambios con efectos lejanos | Se extrae por zonas en cada tarea (D4); un plan de modularización después de F4 | abierta |
| DT2 | `firebase.js` (579 KB) se generó fuera del repo | raíz | No se puede actualizar Firebase de forma reproducible | Receta en `tools/firebase-bundle/` (T0.1); se prueba solo si hay P6 | abierta |
| DT3 | 64 scripts de prueba sueltos | `tests/legacy/` | Duplican la suite | Pagada en la pasada de deuda de F1 (f8c98b0): `tests/legacy/` borrado; los dos simulacros, en `tests/mocks/` | pagada |
| DT4 | La temporización no es TOTG | planificador | Duraciones aproximadas | F5 (TOTG portado) o se acepta | abierta |
| DT5 | three r160 (la última es r187); la lectura de píxeles asíncrona llega en r165 | import map | Captura sintética lenta | Plan aparte con P6 | abierta |
| DT6 | Colisión por esferas frente a mallas de MoveIt | `colision.js` | Una postura libre en el gemelo puede chocar en MoveIt | F3 mide la diferencia (T3.4); F5 decide | abierta |
| DT7 | La matriz de 32 casos de la línea base no es estable entre ejecuciones (pausas 10 u 8 desde «caja M0 2 cm vel 50 %»); la de 8 casos de los tests sí lo es (5 ejecuciones, una con CPU cargada) | `docs/estado/linea-base-v8.md` §5 | Cifras de la línea base con ruido | T1.2 (semilla por petición) | pagada en T1.2: 32 casos iguales en 3 páginas (`tests/medidas/repetibilidad.mjs`); falta regenerar el informe con `npm run medir` en la pasada de deuda de F1 |
| DT8 | Aún no hay tests de I4 (nada se envía a ROS) ni de I5 (HTML único, CDN con versión exacta) | `tests/` | Las dos invariantes solo se revisan a mano | I5 pagada en la pasada de deuda de F1 (f8c98b0, `tests/unit/i5.test.mjs`, con muestras que deben fallar); I4 con el adaptador en T3.1 | abierta (I4) |
| DT9 | Sin `clave_grupo.txt`, la búsqueda de la clave en `check.sh` es heurística | `tools/check.sh` | Una clave con un formato no previsto pasaría | La búsqueda exacta se hace en la sesión del coordinador (con la clave fuera del repo) en cada puerta de fase | aceptada |
| DT10 | `buscarAlternativa` ensaya desde la fase `D.fase` y no desde la fase en que arrancó la demo que falló (ni antes ni ahora); la demo interactiva sigue con `simT` absoluto | `src/fallos.js:167`, `src/app.js` | La búsqueda es determinista, pero no reproduce el balanceo exacto del fallo | T1.8 (toca `buscarAlternativa`) | pagada en T1.8 (b44dff3): la búsqueda ensaya desde la fase en que arrancó la demo que falló |
| DT11 | `validarLayout` es más estricto que `normalizar()` de la v8: una disposición antigua fuera de esa forma se oculta del listado o se sustituye por la de partida; I1 solo está demostrado con 3 escenas. Las escenas ilegibles no se pueden borrar desde la interfaz | `src/layout.js`, `src/escenas.js` | Escenas antiguas raras invisibles para el grupo | Pagada en la pasada de deuda de F1 (63de4b8): sección «Ilegibles» con motivo, papelera y borrado, sin tocar reglas ni campos (I2). Sigue en pie que `validarLayout` es más estricto que la v8: lo cubre la sección. Una Tu mesa ilegible se copia en `gemelo-ur3e-v4-ilegible` antes de sustituirla (revisión de F1, H2; 37a82e6) | pagada |
| DT12 | `semillaPlan` serializa a precisión completa cualquier campo de obstáculo que sea array u objeto (hoy no hay ninguno). El contador de `tests/e2e/determinismo.test.mjs` no ve el `aleat` capturado en `src/app.js` | `src/rng.js`, tests | Un obstáculo nuevo con array rompería «+1e-7 no cambia la semilla»; test de «sin reintento» débil | Pagada en la pasada de deuda de F1 (0597afa): redondeo a cualquier profundidad (la semilla de referencia no cambia) y `aleat` de `app.js` delega en `RNG.aleat` | pagada |
| DT13 | Latentes sin efecto medible: la caché de esferas de la pinza guarda la primera apertura de cada milímetro; `D.tick` no se reinicia entre ensayos; `fuente_src` de los fixtures es el último commit y no el árbol | `src/colision.js:28`, `src/app.js`, `tests/fixtures/generar.mjs` | Ninguno hoy (orden directo e inverso coinciden) | Se vigilan con `tests/medidas/repetibilidad.mjs`; F5 | aceptada |
| DT14 | La IK refinada (`KIN.calibrada`) cuesta unas 4 veces la nominal: con 203–206 el cálculo y la búsqueda tardan más | `src/kin.js` | Esperas más largas fuera de `nominal` | Medida en la pasada de deuda de F1 (5aba8ac, `docs/estado/medida-f1.md`): `calcularPlanes` tarda 0,9 s con `nominal` y 2,8 s con el 203. Se optimiza en F5 si molesta | abierta (F5) |
| DT15 | Los pares de colisión permitidos se derivan por robot en el gemelo; el curso usa un SRDF único | `src/colision.js` (`iniciarColision`) | Un par permitido en el gemelo puede no estarlo en MoveIt | Con DT6: F3 los compara (T3.4) | abierta |
| DT16 | El brazo de la otra posición (A/B no elegida) es decorativo y se dibuja siempre con la cinemática nominal | `src/app.js:483` | Solo visual: no coincide con el robot real de esa posición | F2 lo revisó: la escena doble no lo necesita (el otro robot va en el URDF doble y no se exporta). Pasa a F5 | abierta (F5) |
| DT17 | `HOLGURA_SEMILLA` = 0,05 (semillas proyectadas al borde del alcance) es un valor elegido a mano y el criterio T1.4-2 (≥ 99,5 %) depende de él | `src/kin.js` | Cambiarlo puede bajar la cobertura de la IK refinada | Aceptado: está documentado en el código y lo cubre T1.4-2 | aceptada |
| DT18 | Los campos de giro del tablero en `base_link` solo entran en el obstáculo (y en la semilla) cuando el giro no es cero, para no cambiar la semilla de `nominal` | `src/colision.js` | La forma de la entrada de la semilla depende del robot | Con DT12, en la pasada de deuda de F1 | aceptada (2026-11-16): es determinista y cambiarla movería la semilla de `nominal` sin ganar nada |
| DT19 | `focal_mm` va en milímetros en `posiciones.yaml`; el resto, en metros (REP-103) | `src/app.js` (`generarYaml`) | Una unidad distinta en el mismo fichero | Aceptada al cerrar F1 (brief T2.0–T2.1, decisión 8): `focal_mm` es un parámetro de la óptica, no una pose, y lleva la unidad en el nombre; `camera_info` dará K en píxeles (T2.5) | aceptada |
| DT20 | Documentación desfasada: el generador escribe «Aún no entra en el build: se carga en T1.4» (`tools/fixtures/fk_desde_xacro.py:535`) y regenerar `calibracion.js` lo reintroduce; `CLAUDE.md` no lista `calibracion.js`, `layout.js` ni `rng.js` en `src/` | `tools/fixtures/`, `CLAUDE.md` | Un agente que lea solo `CLAUDE.md` no ve esos ficheros | Pagada en la pasada de deuda de F1 (0597afa) | pagada |
| DT21 | No hay ningún caso real en el que la comprobación de la fruta dé «IK calibrada no converge» con las calibraciones del curso (rejilla de 5 mm): su test simula que ninguna rama converge | `tests/e2e/robot.test.mjs` (corrección 3) | El texto de la fruta solo se prueba con un simulacro | Aceptado: el camino de rutaCartesiana y la comprobación previa sí se prueban con un caso encontrado | aceptada |
| DT22 | Tras «la salida de la bandeja» (8 cm hacia atrás en horizontal) la pinza sigue tocando la bandeja: con «curso» el movimiento siguiente falla (START_STATE_IN_COLLISION) en los 4 casos de caja; con «gemelo» se separa (hallazgo H2 de T1.8) | `src/app.js` (colocación) | «Validar» dice que «curso» falla en cualquier disposición | Pagada en T1.9 (07ce862): subida de `H_SALIDA` = 2 cm tras la salida, comprobada en `planColocar`; «curso» completa la demo por defecto. El margen frente al balanceo queda en DT30 | pagada |
| DT23 | `rutaNivelada` calcula el primer punto con `pinza.w` y no con la apertura de la petición: 2,3 mm con w = 6 mm (H1 de T1.8) | `src/colision.js` (`rutaNivelada`) | Primer tramo de la ruta nivelada desplazado | Pagada en T1.9 (07ce862, test T1.9-6) | pagada |
| DT24 | Tras una demo terminada o fallida, la comprobación previa de Guardar y el ensayo en seco de la búsqueda miran la fruta donde quedó (H3 de T1.8) | `src/escenas.js`, `src/fallos.js` | Veredicto guardado y búsqueda con una escena que no es la de partida | Pagada en la pasada de deuda de F1 (5b132b1): la comprobación previa y el cálculo de trayectorias apartan la escena animada y la devuelven tal cual | pagada |
| DT25 | La capa «Robot del otro puesto» quita o pone un obstáculo sin invalidar planes, caché de obstáculos ni validación (H4 de T1.8) | `src/app.js`, `src/colision.js` | Planes y veredictos calculados con otros obstáculos | Pagada en la pasada de deuda de F1 (5b132b1): la capa entra en `clavePlan`, en la clave de `obstaculos()` y en `firmaVal` | pagada |
| DT26 | La validación caduca con cualquier cambio del layout, también la focal o el modo de una cámara, que no cambian ningún obstáculo | `src/app.js` (`firmaVal`) | Hay que volver a validar sin necesidad | Aceptada: es conservadora | aceptada |
| DT27 | La búsqueda recalcula en su fase 2 los planes de la fase 1 (caché de una sola entrada por perfil) | `src/fallos.js` | Búsqueda más lenta | F5, si molesta | abierta |
| DT28 | Supuestos del perfil «curso» sin contrastar con MoveIt: 5 niveles de subdivisión, `floor(d/0,01)+1` pasos, la regla de los blandos y sin límite de velocidad del TCP | `src/perfil.js`, `src/colision.js` | El veredicto «curso» puede diferir del de la simulación | T3.3 los compara con el plan de MoveIt | abierta |
| DT29 | Una escena v9 guardada antes de T1.8 con perfil «curso» atribuye a «curso» un estado que calculó «gemelo» | `src/escenas.js` (`perfilesDe`) | Ninguno hoy: `main` sigue en v8 y no hay escenas así | Aceptada | aceptada |
| DT30 | `H_SALIDA` = 2 cm deja poco margen frente al balanceo de la bandeja: `planColocar` comprueba la subida con la bandeja en su pose de plan, pero la bandeja se mueve. En 6 de 33 disposiciones vecinas de la demo M0 2 cm, «curso» empieza el movimiento al reposo tocando la bandeja. La holgura no crece con H (con 3 cm falla un caso que pasa con 2 cm) | `src/app.js` (`planColocar`, `servirPlato`) | Un veredicto «curso» que depende de la fase de la bandeja en disposiciones cercanas a la de partida | Pasada de deuda de F2: comprobar la subida contra la bandeja en todo su balanceo y volver a medir `H_SALIDA` | pagada (T2.8) |
| DT31 | «Reiniciar» (`#dReset`) no se bloquea durante un cálculo (ya pasaba en la v8). El aviso «Demo reiniciada para mover objetos» también sale al cambiar la capa del otro robot | `src/app.js` | Reiniciar a mitad de un cálculo deja planes de una escena que ya no está; aviso confuso | El bloqueo de «Reiniciar» se pagó en la puerta de F1 (H1, 37a82e6): con validación, cálculo o búsqueda en marcha, avisa y no actúa. El aviso de la capa, en la pasada de deuda de F2 | pagada (T2.7) |
| DT32 | `npm test` tarda unos 36 min en el contenedor; T0.2 pedía menos de 15. Lo alargan las demos completas (matriz «gemelo», matriz «curso» en los dos órdenes, barridos de Validar) | `tests/e2e/` | Cada comprobación de una tarea cuesta más de media hora | Pagada en T2.0 (a0ff130, cc86429): `npm test` (nivel de tarea) tarda unos 10 min desde un clon limpio y `check.sh --puerta` (todos los tests), unos 23 min. El cierre del navegador con `kill()` sola bajó la suite completa de 37 a 23 min | pagada |
| DT33 | El bucle de render dibuja cada fotograma aunque no cambie nada. Con SwiftShader, el proceso de la GPU ocupa los dos núcleos mientras la página está abierta | `src/app.js` (bucle de animación) | Tests lentos (era la causa del cierre de 10–28 s) y consumo en equipos sin GPU | F5: dibujar solo cuando cambie algo | abierta |
| DT34 | «Agarre del plato» es una decisión del grupo y lleva MEDIDO, en el panel y, desde T2.1, en `posiciones.yaml`. D8 solo tiene tres tipos; lo elegido en el gemelo lleva `ORIGEN.ELEGIDO` desde T2.2. La posición A/B del robot lleva ELEGIDO en `parametros_celda.yaml` y MEDIDO en `posiciones.yaml` (es la elección de la base, cuya posición sí está medida) | `src/origen.js` | Una etiqueta que no dice de dónde sale el valor | Pasada de deuda de F2: decidir si las decisiones del grupo pasan a ELEGIDO (cambia el panel y los ficheros, con sus referencias) | pagada (T2.7) |
| DT35 | `posiciones.yaml` escribe `robot_id`, `frame`, `prefijo_frames` y la línea «# Robot:» sin escapar: una disposición v10 de solo lectura con un salto de línea o un `#` en `robotId` o `prefijoFrames` rompería el YAML (los ficheros de ROS de T2.2 + T2.4 sí escapan). Además, sus `zona_primero` y `zona_segundo` salen de la pose actual de la bandeja y `bandeja_recepcion` de la del plan: durante la demo no coinciden. Desde T2.3 + T2.5 (y en el `.tar` de T2.6, que crearía una subcarpeta), los nombres de fichero de `tf/`, `camera_info/` y `usb_cam/` llevan la clave del marco o de la cámara sin filtrar «/» (hoy las claves son fijas; una disposición v10 de solo lectura podría traer otras) | `src/exportar.js` (`posiciones`, nombres de fichero), `src/app.js` (`modeloExportacion`) | Un YAML roto o con zonas desplazadas si se exporta en mitad de la demo | Pasada de deuda de F2, regenerando `tests/fixtures/yaml/` con el diff explicado | pagada (T2.7) |
| DT36 | Sin exportar: `zona_centro` (pedido de un plato), los marcadores de la zona (0–3) y de la bandeja (6–9), que `posiciones.yaml` tampoco exporta | `src/app.js` (`modeloExportacion`) | Con un plato, el destino no está en los ficheros; la calibración y el seguimiento de la bandeja no tienen la pose nominal de sus marcadores | `zona_centro`, en la pasada de deuda de F2; los marcadores, en F4 (cámaras por tarea) | pagada en parte (T2.7: `zona_centro`); los marcadores, en F4 |
| DT37 | El análisis del HTML del test de I5 toma `<frame…` dentro de un string de JS por una etiqueta HTML (T2.4 cambió un texto para evitarlo) | `tests/unit/i5.test.mjs` | Un falso positivo que obliga a reescribir textos | Pasada de deuda de F2 | pagada (T2.7) |
| DT38 | El giro de las cajas de la escena de colisión (`escena_colision.yaml`, `celda.scene`) no sale de la disposición sino del estado del plan: el del agarre de un plan al día, el provisional (hacia la base) si las trayectorias no están al día, o el de un candidato si se exporta durante un cálculo. Con nominal, el del plan y el provisional difieren 60°. Cada fichero dice cuál lleva, en su cabecera y en el comentario de cada caja | `src/app.js` (`escenaExportacion`, `orientarCajas`) | La misma disposición da dos escenas distintas según se haya pulsado «Calcular»; exportada a mitad de un cálculo, unos giros que ningún plan usa | T2.6: el panel dice qué giro llevan las cajas, avisa si es el provisional y no deja descargar mientras `CALC.activo`. La recarga de Común-C1 calcula en las dos páginas (`ros-recarga`, nivel de puerta) | abierta |
| DT39 | Con el sensor «gemelo v8» y un modo 4:3, el área útil la limita el alto: la cámara de render ve en horizontal un 0,07 % menos de lo que dice `hfovDe`, y el `camera_info` (fx desde hfov, fy desde vfov) sale con fx ≠ fy: 732,941 frente a 733,447 en 1280×960, 0,44 px en el borde (0,71 px en 2048×1536). Con el sensor de la ficha (el de los casos de los tests) no pasa | `src/sensor.js`, `src/app.js` (`hfovDe`, `vfovDe`) | Un `camera_info` nominal que no es exactamente la cámara que pinta el gemelo con ese sensor | F4 (cámaras por tarea), con el modelo de sensor | abierta |
| DT40 | La escena exporta el plato con su geometría dibujada (cilindro de `PLATO_R` = 80 mm de radio y 25 mm de alto, decisión 2 del brief de T2.3); las 17 esferas de colisión del gemelo lo envuelven con hasta 82 mm de radio y de −9 a +32 mm en z | `src/app.js` (`escenaExportacion`) | MoveIt ve un plato hasta 2 mm más pequeño que el modelo de colisión del gemelo | Se acepta: a MoveIt se le da el objeto real, y el margen de seguridad es de su configuración (`padding`), no de la escena. Si U4 o F3 muestran que hace falta, se exporta la envolvente | aceptada (2026-11-16) |
| DT41 | `#btnCalc` se queda desactivado al acabar un cálculo con los planes al día: `pintarCalc` sale antes de reponerlo cuando oculta la barra, y solo lo reactiva el repintado periódico cuando vuelve a enseñarla | `src/app.js` (`pintarCalc`) | El usuario no lo ve (la barra está oculta), pero un clic justo después de cambiar de robot se pierde | Pasada de deuda de F2 (T2.7) | pagada (T2.7) |
| DT42 | `posiciones.yaml` no es YAML 1.1 seguro fuera de lo que pagó DT35: la línea `# layout-json:` lleva U+2028 sin escapar (`JSON.stringify` no lo escapa; PyYAML 6.0.3 lo lee como salto de línea y crea una clave falsa), `fecha` se lee como timestamp y las claves `y` de los mapas en línea, como `true` | `src/exportar.js` (`posiciones`) | Un lector YAML 1.1 (PyYAML, el de los scripts del grupo) lee otra cosa que yaml@2.9.1 | Pasada de deuda de F3 | abierta |
| DT43 | Lo que la comprobación del balanceo de T2.8 no cubre: el arranque hacia el reposo se mira sobre la recta en articulaciones hasta la IK de `posReposo()` y solo 5 cm de TCP (no un camino del RRT ni el plato 1 con la muñeca a 45°); en M1 el brazo sigue a la bandeja y la postura real al acabar la subida sale de dónde soltó el plato, no de la `qU` comprobada; el barrido solo valida la fase 0. Además, la aproximación al borde del plato 1 puede chocar con la bandeja según la fase (v27 con fase 21,9) y, en v05, v17 y v23, «curso» no encuentra trayectoria a la aproximación al plato 1 donde «gemelo» sí (anterior a T2.8) | `src/app.js` (`arranqueLibreEnBalanceo`, `planColocar`, `prepararMoveJ`), `tools/barrido-salida.mjs` | Veredictos de «curso» que aún pueden depender de la fase de la bandeja en tramos que no son la salida | Pasada de deuda de F3 | abierta |
| DT44 | Las zonas de la bandeja tienen z local = 0,0005 m: el doble redondeo da `tf/zona_primero.yaml` z = 0.001 sobre la bandeja (0.240 + 0.001 = 0.241) y `parametros_celda.yaml` / `posiciones.yaml` z = 0.240 para el mismo punto: 1 mm entre ficheros (I7). `ros.test.mjs` acepta 1,3 mm en la cadena | `src/app.js` (`zonasB`), `src/exportar.js` | En U4, `tf2_echo base_link zona_primero` puede quedar justo en el límite de ±1 mm frente a los parámetros | Pasada de deuda de F3 (decidir la altura de las zonas o redondear la cadena una sola vez), con las referencias regeneradas | abierta |

## 12. Registro de cambios del plan

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-15 | Creación del plan | Estudio gemelo-ros y petición del usuario de un plan para agentes autónomos |
| 2026-11-17 | T2.8 aceptada (f271177) tras la revisión del coordinador. Se acepta `H_SALIDA` = 4 cm en lugar del valor más bajo con 0 contactos (2 cm), porque con 2 cm «Calcular» en la partida casi se duplica (decisión 2 de su brief; medida en `docs/estado/calcular-t28.md`); y los cambios de los tests `validar`, `partida` y `robot-avisos`, cada uno con su motivo en c280041 y 493e29a. DT30 pagada; DT43 y DT44 nuevas. Puerta de F2: revisión independiente (código: sin bloqueos; H2 aceptada, H3 → DT43, H4 → DT44, H5 corregida en la guía) y `check.sh --puerta` limpio con la clave real (30 min 46 s; 119 unitarios y 152 e2e). La puerta pide también U4, que hace el usuario en el contenedor del curso: el coordinador adelanta la P1 de F2 a U4 para que la web publique el panel «Exportar a ROS» y la guía que U4 necesita (el enlace daba 404 hasta la P1). El hito de F2 queda abierto hasta que U4 vuelva; lo que U4 encuentre entra como tarea de corrección. Antes, en v9-dev: hooks de protección (3440d7f), subagente revisor (79f502f), finales de línea y build sin Python (e6590ca) y el tar de los tests en Windows (11578d5), para la ejecución autónoma local de F4 en la rama `v9-f4` (plan-autonomo-cc, contrato aprobado por el usuario el 2026-11-16) | Revisión independiente de F2 e informe de T2.8 |
| 2026-11-17 | T2.7 aceptada (19ea470) tras la revisión del coordinador y `check.sh` limpio con la clave real (`npm test`, 11 min 57 s). Se aceptan sus tres desviaciones: la bandeja exportada durante la demo sale de `poseBandejaPlan()` (sin balanceo y subida), porque `poseBandeja(0)` lleva el balanceo de la fase y la decisión 2 del brief la nombraba mal; `zona_centro` cuelga de `bandeja`, sin prefijo, como las otras zonas (el criterio C3 del brief decía `<prefijo>bandeja` por error); y cuatro aserciones de `exportar` y `cambio-robot` que fijaban el texto sin comillas que DT35 cambia. Un salto de línea en `robotId` o en el prefijo sale como espacio (una comilla simple de YAML no lo admite). `topics_vision` sigue en MEDIDO: es un documento del grupo, no una decisión. DT31, DT34, DT35, DT37 y DT41, pagadas; DT36, en parte; DT42 nueva. Abre T2.8 con el brief `T2.8.md` | Informe de T2.7 |
| 2026-11-16 | T2.6 aceptada (694618e) tras la revisión del coordinador (captura C7 revisada) y `check.sh` limpio con la clave real (`npm test`, 11 min 24 s). Se aceptan sus desviaciones: «Descargar» de un fichero suelto cambia «/» por «_» (los navegadores no bajan carpetas; el `.tar` las conserva); las descargas también se desactivan durante una búsqueda de disposición; la raíz sale en dos tramos para conservar el orden de `ficherosRos()`; `generarYaml` y `ficherosRos` aceptan un modelo ya calculado; las carpetas del `.tar` con 0755 y los nombres de 100 bytes. El enlace a la guía apunta a `main` y da 404 hasta la P1 de F2. DT16 pasa a F5; DT35 ampliada al `.tar`; DT41 nueva. La pasada de deuda de F2 se parte en T2.7 (exportación, brief `T2.7.md`) y T2.8 (DT30, toca el planificador) | Informe de T2.6 |
| 2026-11-16 | T2.3 y T2.5 aceptadas (6d5524b) tras la revisión del coordinador y `check.sh` limpio con la clave real (`npm test`, 13 min 33 s). El agente entregó «parcial»: el test de recarga fallaba en los ficheros de la escena porque el giro de las cajas sale del plan (DT38). El coordinador aplica el parche que propuso el agente y saca la recarga a `ros-recarga.test.mjs`, en el nivel de puerta (8a65d85), sin cambiar ninguna aserción. Se aceptan sus desviaciones: la tolerancia de ±0,5 mm en los ejes donde se redondea (los de cada cámara para sus formas, los de world para el `.scene`); T2.5-C2 en dos partes (0,05 px con la K exportada y el marco del gemelo sin redondear; con las TF exportadas, dentro de la cota de su redondeo); los puntos añadidos a la cámara de la persona; `EXPORTAR.todos()` con `EXPORTAR.ficherosRos` intacto; el estado del giro de cada caja en los ficheros, y la lista de entradas de `origen.test`. DT35 ampliada; DT38–DT40 nuevas (DT40, aceptada). Abre T2.6 con el brief `T2.6.md`, que recoge DT38 | Informe de T2.3 + T2.5 |
| 2026-11-16 | T2.2 y T2.4 aceptadas (90637a6) tras la revisión del coordinador (cuaternión recalculado aparte con la fórmula de `setRPY`: coincide) y `check.sh` limpio con la clave real. Se aceptan sus 8 desviaciones: la lista de entradas de `origen.test`, la recarga con un navegador nuevo, la tolerancia ±0,5 mm por eje de `base_link`, el cuaternión con la norma más cercana a 1, las claves `x`, `y`, `z`, `w` entre comillas (que rcl las acepte, en U4), el `trap` de `tf_estaticas.sh`, el formateador de `posiciones.yaml` en `exportar.js` y un texto cambiado por el test de I5. DT34 ampliada; DT35–DT37 nuevas. Abre T2.3 + T2.5 con el brief `T2.3-T2.5.md`. `npm test` tarda ya 12 min: el brief fija el presupuesto | Informe de T2.2 + T2.4 |
| 2026-11-16 | T2.0 y T2.1 aceptadas (cc86429) tras la revisión del coordinador y `check.sh --puerta` limpio con la clave real. Se aceptan sus desviaciones: el cierre del navegador con `kill()` en `tests/navegador.mjs` (decisión 4, medido) y la regla de 60 s aplicada con las duraciones nuevas. Su única discrepancia panel/YAML (agarre del plato) se resolvió por el panel. El coordinador corrige el test intermitente de DT11 (`ilegibles`, a1e7f5d). DT32 pagada; DT33 y DT34 nuevas. Abre T2.2 + T2.4 con el brief `T2.2-T2.4.md`; P6 aprueba `yaml@2.9.1` para los tests | Informe de T2.0–T2.1: `npm test` 10 min y la puerta 23 min; el fallo intermitente fallaba en 2–6 de 12 ejecuciones aisladas ya en `v9-dev` |
| 2026-11-16 | P1 de F1: PR #1 fusionado en `main` (5fcad7e, el árbol de e1b1eb7 comprobado) y Pages desplegado sin errores. Abre F2: brief `T2.0-T2.1.md`; T2.0 y T2.1, en curso. DT19 aceptada y I7 precisada (la óptica lleva la unidad en el nombre). Las fichas de T2.2–T2.6 se detallan en su brief, con la estructura de `origen.js` que deje T2.1 | Cierre de F1 y arranque de F2 |
| 2026-11-16 | Fase 1 cerrada. Revisión independiente de toda la fase (`origin/main...t1d`), con 3 hallazgos: H1 (Validar se podía interrumpir) y H2 (Tu mesa ilegible sin copia) se corrigen en 37a82e6 y 741c0b3, comprobados por mutación; H3 era el registro de deuda, ya al día. Hito, I1–I9 y build sin cambios: cumplen. DT11 completa y DT31 pagada en parte. Se añade U6. P1: `v9-dev` se fusiona en `main` con `check.sh` limpio y la clave real | Puerta de calidad de F1 |
| 2026-11-16 | T1.9 aceptada con la pasada de deuda de F1 (8f9e0ca) tras la revisión del coordinador y `check.sh` limpio con la clave real. Se aceptan sus 8 desviaciones; la principal es que el barrido de T1.8-1 llega a 6 cm (dx 0,04 y 0,06), porque desde T1.9 las cuatro primeras disposiciones pasan con «curso». DT3, DT11, DT12, DT20 y DT22–DT25 pagadas; DT8 (I5) pagada a medias; DT14 medida. Se añaden DT30–DT32 y T2.0 | Informe de T1.9: `H_SALIDA` = 2 cm es el menor valor que deja libres las 19 salidas medidas; el margen frente al balanceo y la duración de la suite pasan a F2 |
| 2026-11-16 | T1.6, T1.7 y T1.8 aceptadas (2fa8fbc) tras la revisión del coordinador y `check.sh` limpio con la clave real. DT10 pagada; DT18 aceptada; DT22–DT29 añadidas. T1.9 añadida a F1 y brief `T1.9-deuda-F1.md` (T1.9 y pasada de deuda de F1) | Con «curso», la demo no se completa en ninguna disposición (H2): sin arreglarlo, la validación de T1.8 no distingue disposiciones |
| 2026-11-16 | T1.4 y T1.5 aceptadas (3554b56 tras la revisión independiente del coordinador: 9 correcciones). Al abrir una escena con otro robot, el gemelo lo aplica y lo avisa. DT14–DT21 añadidas. D6 precisada: abrir una escena v8 no calcula «curso». Brief de T1.6+T1.8+T1.7 con las decisiones del coordinador (perfil en cada petición, cachés por perfil, Validar y Guardar con los dos perfiles) | Informe de T1.4+T1.5, revisión independiente y revisión del coordinador |
| 2026-11-15 | T1.1 y T1.2 aceptadas (69a6905 tras la revisión independiente: 5 correcciones). DT7 pagada; DT10–DT13 añadidas. Ficha T1.4 con `robotId`; nota de `PERFIL_PLAN` en T1.6. Brief de T1.4+T1.5 con las decisiones del coordinador (giro de la base por `mount_yaw`, una sola conversión mundo↔base, IK refinada solo fuera de `nominal`) | Informe de T1.1+T1.2, revisión independiente y revisión del coordinador |
| 2026-11-15 | Fase 0 cerrada: T0.2–T0.4 aceptadas tras revisión independiente (9 correcciones en dac4587). T1.1 usa `robotId` (el campo `robot` ya es A/B). H2 pasa a T1.1 y H3 y la variabilidad a T1.2; H1 («Ponlo sobre la caja») es comportamiento previsto. D12 reescrita para reflejar P1 delegada. DT7–DT9 añadidas | Informe de la fase 0, revisión independiente y revisión del coordinador |
| 2026-11-15 | D6 reescrita y T1.8 añadida: los dos perfiles conviven en un flujo «explorar (gemelo) → validar (curso)» | Petición del usuario, 16:18 |
| 2026-11-15 | Q1–Q5 respondidas: robot B desconocido (nominal), perfil «curso» para escenas nuevas y «gemelo» para las v8, web como herramienta principal, calibraciones del curso con atribución, agentes en la nube | Mensaje del usuario, 16:13 |
| 2026-11-15 | Ejecución autónoma aprobada: el coordinador fusiona fases en `main` (P1), publica el artefacto al cerrar F4 (P2) y puede aprobar dependencias imprescindibles (P6); Q1–Q5 con valores por defecto; prioridad del usuario: tener la herramienta lista cuanto antes | Mensaje del usuario, 16:09 |
