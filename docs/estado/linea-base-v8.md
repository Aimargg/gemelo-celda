# Línea base medida de la v8

> Generado por `npm run medir` (`tests/medidas/linea-base.mjs`, tarea T0.3). No editar a mano: se regenera.
>
> **Advertencia:** todas las cifras de tiempo son de Chromium con **SwiftShader** (WebGL por CPU) en un contenedor sin GPU.
> No representan un portátil con GPU: allí la carga y el render serán bastante más rápidos. Sirven para comparar versiones
> en este mismo entorno, no como tiempos de uso real.

## Entorno

- Fecha: 2026-11-15 · código medido: `src/` de 41dd4d5 (rama f0)
- Máquina: Intel(R) Xeon(R) Processor @ 2.10GHz, 2 CPU, 8 GB, linux 6.18.44-fc-v470
- Node v22.22.0 · Playwright 1.63.0 · Chromium 153.0.8010.12 sin interfaz · WebGL: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
- Ventana 1440 × 900, deviceScaleFactor 1, red cerrada (three servido desde node_modules)

## 1. Matriz completa (32 casos, balanceo ≤ 2 cm)

Caja/mesa × M0/M1 × balanceo 0 y 2 cm × velocidad 10, 25, 50 y 100 %, fase 0, en una página nueva y en este orden
(`CASOS_MATRIZ_32` de `tests/medidas/linea-base.mjs`). Tiempo total: 54,6 s.

**Agregado:** 16 «ok», 16 «previo» · choques 0 · roces 0 · pausas 10 · autocolisiones 0.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| caja M0 balanceo 0 cm vel 10 % | ok | 8 | 272.2 | 258.3 | 0 / 0 | 0 | 0 | 0 | 4 | 5692 |
| caja M0 balanceo 0 cm vel 25 % | ok | 8 | 138.8 | 124.8 | 0 / 0 | 0 | 0 | 0 | 4 | 3478 |
| caja M0 balanceo 0 cm vel 50 % | ok | 8 | 92.2 | 78.3 | 0 / 0 | 0 | 0 | 0 | 4 | 2490 |
| caja M0 balanceo 0 cm vel 100 % | ok | 8 | 65.3 | 51.3 | 0 / 0 | 0 | 0 | 0 | 4 | 2383 |
| caja M0 balanceo 2 cm vel 10 % | ok | 8 | 279.9 | 262.4 | 15 / 8 | 0 | 0 | 4 | 4 | 4978 |
| caja M0 balanceo 2 cm vel 25 % | ok | 8 | 148.3 | 131.5 | 25 / 21 | 0 | 0 | 4 | 4 | 4738 |
| caja M0 balanceo 2 cm vel 50 % | ok | 8 | 95.5 | 80.3 | 13 / 13 | 0 | 0 | 1 | 4 | 3901 |
| caja M0 balanceo 2 cm vel 100 % | ok | 8 | 66.1 | 51.5 | 10 / 9 | 0 | 0 | 1 | 3 | 1833 |
| caja M1 balanceo 0 cm vel 10 % | ok | 8 | 273.5 | 259.5 | 0 / 0 | 0 | 0 | 0 | 4 | 4247 |
| caja M1 balanceo 0 cm vel 25 % | ok | 8 | 139.2 | 125.3 | 0 / 0 | 0 | 0 | 0 | 4 | 2617 |
| caja M1 balanceo 0 cm vel 50 % | ok | 8 | 92.5 | 78.6 | 0 / 0 | 0 | 0 | 0 | 4 | 2220 |
| caja M1 balanceo 0 cm vel 100 % | ok | 8 | 65.4 | 51.4 | 0 / 0 | 0 | 0 | 0 | 4 | 1929 |
| caja M1 balanceo 2 cm vel 10 % | ok | 8 | 276.2 | 262.2 | 5 / 8 | 0 | 0 | 0 | 4 | 4309 |
| caja M1 balanceo 2 cm vel 25 % | ok | 8 | 140.3 | 126.4 | 4 / 2 | 0 | 0 | 0 | 4 | 4035 |
| caja M1 balanceo 2 cm vel 50 % | ok | 8 | 92.3 | 78.6 | 4 / 7 | 0 | 0 | 0 | 4 | 3258 |
| caja M1 balanceo 2 cm vel 100 % | ok | 8 | 65.5 | 51.8 | 7 / 4 | 0 | 0 | 0 | 4 | 1467 |
| mesa M0 balanceo 0 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 321 |
| mesa M0 balanceo 0 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 25 |
| mesa M0 balanceo 0 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 45 |
| mesa M0 balanceo 0 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 34 |
| mesa M0 balanceo 2 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 33 |
| mesa M0 balanceo 2 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 46 |
| mesa M0 balanceo 2 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 23 |
| mesa M0 balanceo 2 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 23 |
| mesa M1 balanceo 0 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 25 |
| mesa M1 balanceo 0 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 44 |
| mesa M1 balanceo 0 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 59 |
| mesa M1 balanceo 0 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 78 |
| mesa M1 balanceo 2 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 83 |
| mesa M1 balanceo 2 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 68 |
| mesa M1 balanceo 2 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 42 |
| mesa M1 balanceo 2 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 32 |

Motivo de los casos que no terminan en «ok» (primeros 200 caracteres):
- La demo no puede empezar con esta disposición. Por quéAntes de mover nada, el coordinador ensaya en seco cada paso (coger, soltar, levantar, llevar nivelado y dejar) y alguno no es posible:Plato 1º: e

## 2. Tiempos en SwiftShader (3 páginas nuevas; mediana y rango)

| Medida | Mediana | Mín. | Máx. |
|---|---|---|---|
| Carga: inicio de la navegación → desaparece `#loading` | 13,1 s | 11,8 s | 13,3 s |
| `calcularPlanes` de la disposición por defecto (el automático tras la carga, sin caché) | 2,0 s | 1,5 s | 2,0 s |
| `ensayo` M0 (caja, 2 cm, 25 %, sin render) | 4,2 s | 4,0 s | 15,1 s |

Resultado del ensayo M0 en cada página (los cuatro primeros campos son los que compara la caracterización):

| Página | fin | pausas | choques | roces | planes | t_sim (s) |
|---|---|---|---|---|---|---|
| 1 | ok | 2 | 0 | 0 | 3 | 140.6 |
| 2 | ok | 2 | 0 | 0 | 3 | 140.6 |
| 3 | ok | 2 | 0 | 0 | 3 | 140.6 |

## 3. Tareas largas (> 200 ms) durante `calcularPlanes`

`PerformanceObserver` de tipo `longtask` instalado antes de cargar; cuenta las tareas que empiezan durante el primer
`calcularPlanes` de cada página:

| Página | Tareas > 200 ms | La más larga | Tareas > 50 ms |
|---|---|---|---|
| 1 | 4 | 597 ms | 5 |
| 2 | 4 | 736 ms | 6 |
| 3 | 4 | 747 ms | 4 |

## 4. Tamaños

| Fichero | Bytes | KiB | gzip -9 (KiB) |
|---|---|---|---|
| `dist/gemelo-celda.html` | 276512 | 270,0 | 85,7 |
| `index.html` | 275208 | 268,8 | 85,2 |
| `config.js` | 738 | 0,7 | 0,5 |
| `firebase.js` | 578666 | 565,1 | 147,0 |
| `ur3e-malla.json` | 1343443 | 1312,0 | 603,1 |
| `mesa.jpg` | 256064 | 250,1 | 249,8 |
| three 0.160.0 (8 módulos desde jsDelivr) | 1496608 | 1461,5 | 297,9 |

Destino artefacto = `dist/gemelo-celda.html` + three (+ `ur3e-malla.json` y `mesa.jpg` si se sirven). Destino web = `index.html` + `config.js` + `firebase.js` + three + `ur3e-malla.json` + `mesa.jpg`.

## 5. Variabilidad conocida

- Con la fase de la bandeja absoluta (`fase` tal cual), los resultados de `ensayo` con balanceo variaban entre ejecuciones
  idénticas (pausas 1–2, errores, t_sim y planes), porque `simT` avanza con el reloj real mientras la página carga
  (`bucle()`: `else if (!D.activo) simT += dt`) y la bandeja se mueve con `BALANCEO(simT + fase)`.
- Con la fase relativa al inicio de cada ensayo (`tests/medir.mjs`), los 8 casos de `matriz-base.json` dieron exactamente
  lo mismo en 20 ejecuciones (todos los campos; 5 seguidas, una con la CPU cargada) y las 3 escenas v8 en 11. Las cifras
  de la sección 1 usan ese procedimiento.
- **La matriz de 32 casos no es estable:** en T0.3 dio 10 pausas en dos ejecuciones y 8 en otra. Los 6 primeros casos
  coinciden; a partir de «caja M0 balanceo 2 cm vel 50 %» (1 → 0 pausas, y lo mismo a 100 %) el resto diverge en t_sim,
  errores y planes. Tómala como referencia, no como valor exacto. Mitigación posible en el lado del test: una página nueva
  por caso; la de fondo es T1.2.
- Los resultados siguen dependiendo del orden de cálculo dentro de la página (`SEMILLA` global del RRT): la tabla vale
  para este orden en una página nueva. Lo corrige T1.2.
- Los tiempos (secciones 2 y 3) varían de una ejecución a otra por la carga de la máquina: se dan mediana y rango.
- El ensayo M0 de la sección 2 dio el mismo resultado (todos los campos de la tabla) en las 3 páginas.
