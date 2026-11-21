# gemelo-celda — reglas para Claude Code

Gemelo digital en el navegador de la celda UR3e del proyecto final de Robótica (MUCSI, Deusto): mesa, cajas, platos,
bandeja, cámaras y un planificador propio que da veredictos sobre la disposición. **Todo el repo está generado por IA**
y no es fuente del repo del proyecto de Robótica (invariante I9).

## Fuente de verdad

- `docs/planes/PLAN-gemelo-v9.md`: objetivo, decisiones D1–D12, invariantes I1–I9, tareas y puertas. Léelo antes de
  cada encargo y cita la decisión o la invariante que aplica. Si algo choca con el plan, para y pregunta.
- Briefs de tarea en `docs/planes/briefs/`. Línea base medida en `docs/estado/linea-base-v8.md`.

## Estructura

- `src/`: fuentes (`part1.html`, `app.js`, `kin.js`, `colision.js`, `fallos.js`, `escenas.js`, `layout.js`, `rng.js`,
  `perfil.js`, `sensor.js`, `tareas.js` (píxeles por tarea de cada cámara, T4.1), `usb.js` (ancho de banda USB y análisis de `lsusb -v`, T4.3), `tablero.js` (tablero de marcadores ArUco de la bandeja: esquinas, aviso de alineados, T4.4; su YAML lo escribe `EXPORTAR.tablero`), `origen.js`, `exportar.js` y `datos/calibracion.js`, que genera
  `tools/fixtures/fk_desde_xacro.py`). Se concatenan con los marcadores `@@…@@`; sin módulos ES ni bundler (D4).
  `origen.js` es la única fuente del origen (MEDIDO, FABRICANTE o SUPUESTO) de cada valor exportable: los exportadores lo
  leen con un contexto, sin globales (T2.1). `exportar.js` (`EXPORTAR`) es el único formateador: convierte el modelo de
  `modeloExportacion()` (`app.js`, sin redondear y en `base_link`) en el texto de cada fichero exportado (T2.2).
  `EXPORTAR.tar` los empaqueta en el `.tar` del panel «Exportar a ROS» (T2.6); la guía de U4 es `docs/validar-en-ros.md`.
- `tools/build.sh` → `dist/gemelo-celda.html` (artefacto de claude.ai, con el gancho `window.__g` y `?prueba`).
- `tools/build_web.sh` → `index.html` (GitHub Pages; quita el gancho y añade `config.js`). Llama a `build.sh`.
- `web_src/`: plantillas con `@@CLAVE@@` y `PEGA_AQUI`. `tests/`: arnés de pruebas. `tests/mocks/`: simulacros de Firestore
  (`firebase-mock.js`, con las reglas) y del almacén de claude.ai (`mock_claude.html`); no se tocan.

## Construir y probar

- `npm install` (solo `playwright@1.63.0`, `three@0.160.0` y `yaml@2.9.1`, versión exacta; `yaml`, solo en los tests,
  P6). Si falta el navegador de Playwright 1.63.0, para y avisa: no ejecutes `playwright install` sin preguntar.
- `npm run build`: los dos destinos. `index.html` se versiona construido (D1).
- `npm test`: nivel de tarea (T2.0): build + unitarios (`node:test`) + e2e de tarea (Playwright + Chromium con
  SwiftShader, sin GPU ni red), < 15 min. `npm run test:puerta`: los dos niveles, todos los tests (puertas de fase).
  Qué fichero e2e va en cada nivel: `tests/niveles.mjs`; el porqué, en `tests/README.md`. Un e2e nuevo se añade allí.
- `npm run test:rapido`: build + unitarios + carga de los dos destinos (< 2 min).
- `bash tools/check.sh`: búsqueda de la clave (I3) en el árbol y en el índice + build + `npm test`; con `--puerta`, con
  `npm run test:puerta`. Pásalo antes de cada commit de entrega (`--puerta` en las puertas). Sin `clave_grupo.txt` la
  búsqueda es heurística (`#g=`, `grupo ==`, rutas `grupos/…`); la exacta solo se hace en el equipo del usuario.
- `npm run caracterizar`: regenera solo `tests/fixtures/matriz-base.json` desde el gemelo actual, y solo cuando la tarea
  lo pida (p. ej. T1.2), con el diff explicado en el informe. `npm run caracterizar -- --curso` hace lo mismo con
  `tests/fixtures/matriz-curso.json` (los 8 casos con el perfil «curso»); `-- --yaml`, con `tests/fixtures/yaml/`
  (posiciones.yaml y la tabla de fuentes del panel «Datos» con nominal, 203 y prefijo, T2.1); `-- --ros`, con
  `tests/fixtures/ros/<caso>/` (parametros_celda.yaml, tf/*.yaml y tf_estaticas.sh, T2.2 y T2.4; escena_colision.yaml,
  celda.scene y celda.scene.txt, T2.3; camera_info/*.yaml y usb_cam/*.yaml, T2.5; de los mismos casos).
- `escenas-v8/` no se regenera: su `codigo` es fijo (I1). `npm run caracterizar -- --escenas` recalcula solo `esperado`
  (nunca el `codigo`) y exige explicar el diff.
- `npm run medir`: regenera la línea base (`docs/estado/linea-base-v8.md`). `npm run medir -- <fichero>` escribe la medida
  en otro fichero (p. ej. `docs/estado/medida-f1.md`) y no toca la línea base.

## Reglas que no se rompen

- **Nunca edites `index.html` ni `dist/` a mano**: cambia `src/` y reconstruye.
- No toques `firebase.js`, `ur3e-malla.json` ni `config.js` (ni `mesa.jpg`). `config.js` lo sube el usuario.
- La clave del grupo nunca entra en git (I3): `clave_grupo.txt` y `dist/` están ignorados; en pruebas, `clave-buena`.
- Las pruebas nunca hablan con el Firestore real (I2): toda petición externa no interceptada hace fallar el test.
- No cambies three (r160), Firebase, las reglas o los campos de escena de Firestore sin su puerta (P3, P6).
- El gemelo nunca envía nada a ROS (I4). Sin Web Workers ni WASM hasta T5.1 (D11).
- Dependencias nuevas solo con P6: versión exacta comprobada con `npm view`.
- Los tests no se ajustan a ojo: un valor fijado sale de ejecutar el gemelo. Un test que no puede fallar no vale.
- Si encuentras un fallo del gemelo fuera de tu tarea, no lo arregles: fíjalo, apúntalo como hallazgo.

## Ramas, commits y pull requests (D12)

- Se trabaja en `v9-dev` (o en una rama que sale de ella). Un pull request por fase hacia `main`.
- Solo el usuario (o el coordinador con P1 delegada) fusiona en `main`: fusionar es desplegar en Pages.
- Sin push a `main`, sin `--force` y sin reescribir historia publicada.
- Mensajes de commit en español: qué cambia y por qué. Se admite coautoría de IA (I9).
- La plantilla `.github/pull_request_template.md` lista las invariantes que hay que marcar.

## Al terminar una tarea

1. `bash tools/check.sh` en verde (o explica qué falla y por qué); en una puerta de fase, `bash tools/check.sh --puerta`.
2. Marca la tarea como «entregada» en la tabla de tareas del plan, con el hash del commit. No cambies nada más del plan.
3. Informa con el formato del brief: criterios con evidencia, hallazgos, deuda y desviaciones.

## Entorno de pruebas

- Chromium con `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- three se sirve desde `node_modules` interceptando jsDelivr; Google Fonts responde vacío; `config.js` y `firebase.js`
  de la web se sustituyen por `tests/navegador.mjs` (config de prueba y `tests/mocks/firebase-mock.js`).
- Espera a condiciones (`#loading` desaparece, `__g.CALC.activo` falso), no a tiempos fijos.
- Avisos de consola permitidos solo en `tests/e2e/permitidos.json`, cada uno con su texto y su motivo.
