# gemelo-celda — reglas para Claude Code

Gemelo digital en el navegador de la celda UR3e del proyecto final de Robótica (MUCSI, Deusto): mesa, cajas, platos,
bandeja, cámaras y un planificador propio que da veredictos sobre la disposición. **Todo el repo está generado por IA**
y no es fuente del repo del proyecto de Robótica (invariante I9).

## Fuente de verdad

- `docs/planes/PLAN-gemelo-v9.md`: objetivo, decisiones D1–D12, invariantes I1–I9, tareas y puertas. Léelo antes de
  cada encargo y cita la decisión o la invariante que aplica. Si algo choca con el plan, para y pregunta.
- Briefs de tarea en `docs/planes/briefs/`. Línea base medida en `docs/estado/linea-base-v8.md`.

## Estructura

- `src/`: fuentes (`part1.html`, `app.js`, `kin.js`, `colision.js`, `fallos.js`, `escenas.js`). Se concatenan con los
  marcadores `@@…@@`; sin módulos ES ni bundler (D4).
- `tools/build.sh` → `dist/gemelo-celda.html` (artefacto de claude.ai, con el gancho `window.__g` y `?prueba`).
- `tools/build_web.sh` → `index.html` (GitHub Pages; quita el gancho y añade `config.js`). Llama a `build.sh`.
- `web_src/`: plantillas con `@@CLAVE@@` y `PEGA_AQUI`. `tests/`: arnés de pruebas. `tests/legacy/`: referencia, no se toca.

## Construir y probar

- `npm install` (solo `playwright@1.63.0` y `three@0.160.0`, versión exacta). Si falta el navegador de Playwright 1.63.0,
  para y avisa: no ejecutes `playwright install` sin preguntar.
- `npm run build`: los dos destinos. `index.html` se versiona construido (D1).
- `npm test`: build + unitarios (`node:test`) + e2e (Playwright + Chromium con SwiftShader, sin GPU ni red).
- `npm run test:rapido`: build + unitarios + carga de los dos destinos (< 2 min).
- `bash tools/check.sh`: búsqueda de la clave (I3) en el árbol y en el índice + build + `npm test`. Pásalo antes de cada
  commit de entrega. Sin `clave_grupo.txt` la búsqueda es heurística (patrones `#g=`, `grupo ==`, rutas `grupos/…`); la
  búsqueda exacta de la clave solo se hace en el equipo del usuario, que es quien tiene ese fichero.
- `npm run caracterizar`: regenera solo `tests/fixtures/matriz-base.json` desde el gemelo actual, y solo cuando la tarea
  lo pida (p. ej. T1.2), con el diff explicado en el informe.
- `escenas-v8/` no se regenera: su `codigo` es fijo (I1). `npm run caracterizar -- --escenas` recalcula solo `esperado`
  (nunca el `codigo`) y exige explicar el diff.
- `npm run medir`: regenera la línea base (`docs/estado/linea-base-v8.md`).

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

1. `bash tools/check.sh` en verde (o explica qué falla y por qué).
2. Marca la tarea como «entregada» en la tabla de tareas del plan, con el hash del commit. No cambies nada más del plan.
3. Informa con el formato del brief: criterios con evidencia, hallazgos, deuda y desviaciones.

## Entorno de pruebas

- Chromium con `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- three se sirve desde `node_modules` interceptando jsDelivr; Google Fonts responde vacío; `config.js` y `firebase.js`
  de la web se sustituyen por `tests/navegador.mjs` (config de prueba y `tests/legacy/firebase-mock.js`).
- Espera a condiciones (`#loading` desaparece, `__g.CALC.activo` falso), no a tiempos fijos.
- Avisos de consola permitidos solo en `tests/e2e/permitidos.json`, cada uno con su texto y su motivo.
