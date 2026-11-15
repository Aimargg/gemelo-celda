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
(`CASOS_MATRIZ_32` de `tests/medidas/linea-base.mjs`). Tiempo total: 55,9 s.

**Agregado:** 16 «ok», 16 «previo» · choques 0 · roces 0 · pausas 10 · autocolisiones 0.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| caja M0 balanceo 0 cm vel 10 % | ok | 8 | 272.2 | 258.3 | 0 / 0 | 0 | 0 | 0 | 4 | 5573 |
| caja M0 balanceo 0 cm vel 25 % | ok | 8 | 138.8 | 124.8 | 0 / 0 | 0 | 0 | 0 | 4 | 3033 |
| caja M0 balanceo 0 cm vel 50 % | ok | 8 | 92.2 | 78.3 | 0 / 0 | 0 | 0 | 0 | 4 | 2714 |
| caja M0 balanceo 0 cm vel 100 % | ok | 8 | 65.3 | 51.3 | 0 / 0 | 0 | 0 | 0 | 4 | 2416 |
| caja M0 balanceo 2 cm vel 10 % | ok | 8 | 279.9 | 262.4 | 15 / 8 | 0 | 0 | 4 | 4 | 4996 |
| caja M0 balanceo 2 cm vel 25 % | ok | 8 | 148.3 | 131.5 | 25 / 21 | 0 | 0 | 4 | 4 | 4276 |
| caja M0 balanceo 2 cm vel 50 % | ok | 8 | 95.5 | 80.3 | 13 / 13 | 0 | 0 | 1 | 4 | 4056 |
| caja M0 balanceo 2 cm vel 100 % | ok | 8 | 66.1 | 51.5 | 10 / 9 | 0 | 0 | 1 | 3 | 1414 |
| caja M1 balanceo 0 cm vel 10 % | ok | 8 | 273.5 | 259.5 | 0 / 0 | 0 | 0 | 0 | 4 | 5343 |
| caja M1 balanceo 0 cm vel 25 % | ok | 8 | 139.2 | 125.3 | 0 / 0 | 0 | 0 | 0 | 4 | 2656 |
| caja M1 balanceo 0 cm vel 50 % | ok | 8 | 92.5 | 78.6 | 0 / 0 | 0 | 0 | 0 | 4 | 2576 |
| caja M1 balanceo 0 cm vel 100 % | ok | 8 | 65.4 | 51.4 | 0 / 0 | 0 | 0 | 0 | 4 | 1781 |
| caja M1 balanceo 2 cm vel 10 % | ok | 8 | 276.2 | 262.2 | 5 / 8 | 0 | 0 | 0 | 4 | 4361 |
| caja M1 balanceo 2 cm vel 25 % | ok | 8 | 143.8 | 129.8 | 4 / 8 | 0 | 0 | 0 | 5 | 3778 |
| caja M1 balanceo 2 cm vel 50 % | ok | 8 | 92.3 | 78.6 | 4 / 7 | 0 | 0 | 0 | 4 | 3476 |
| caja M1 balanceo 2 cm vel 100 % | ok | 8 | 65.6 | 51.9 | 6 / 5 | 0 | 0 | 0 | 4 | 2030 |
| mesa M0 balanceo 0 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 415 |
| mesa M0 balanceo 0 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 97 |
| mesa M0 balanceo 0 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 54 |
| mesa M0 balanceo 0 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 45 |
| mesa M0 balanceo 2 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 44 |
| mesa M0 balanceo 2 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 80 |
| mesa M0 balanceo 2 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 113 |
| mesa M0 balanceo 2 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 53 |
| mesa M1 balanceo 0 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 53 |
| mesa M1 balanceo 0 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 69 |
| mesa M1 balanceo 0 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 90 |
| mesa M1 balanceo 0 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 63 |
| mesa M1 balanceo 2 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 69 |
| mesa M1 balanceo 2 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 54 |
| mesa M1 balanceo 2 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 59 |
| mesa M1 balanceo 2 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 59 |

Motivo de los casos que no terminan en «ok» (primeros 200 caracteres):
- La demo no puede empezar con esta disposición. Por quéAntes de mover nada, el coordinador ensaya en seco cada paso (coger, soltar, levantar, llevar nivelado y dejar) y alguno no es posible:Plato 1º: e

## 2. Tiempos en SwiftShader (3 páginas nuevas; mediana y rango)

| Medida | Mediana | Mín. | Máx. |
|---|---|---|---|
| Carga: inicio de la navegación → desaparece `#loading` | 12,6 s | 12,6 s | 12,7 s |
| `calcularPlanes` de la disposición por defecto (el automático tras la carga, sin caché) | 1,8 s | 1,4 s | 2,1 s |
| `ensayo` M0 (caja, 2 cm, 25 %, sin render) | 4,7 s | 3,6 s | 15,4 s |

El ensayo M0 termina en «ok», «ok», «ok» con t_sim 147.3, 140.6, 147.3 s.

## 3. Tareas largas (> 200 ms) durante `calcularPlanes`

`PerformanceObserver` de tipo `longtask` instalado antes de cargar; cuenta las tareas que empiezan durante el primer
`calcularPlanes` de cada página:

| Página | Tareas > 200 ms | La más larga | Tareas > 50 ms |
|---|---|---|---|
| 1 | 4 | 695 ms | 6 |
| 2 | 3 | 514 ms | 4 |
| 3 | 4 | 675 ms | 6 |

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
- Con la fase relativa al inicio de cada ensayo (`tests/medir.mjs`), los 8 casos dieron exactamente lo mismo en 6
  ejecuciones (todos los campos) y las 3 escenas v8 en 3. Las cifras de la sección 1 usan ese procedimiento.
- Los resultados siguen dependiendo del orden de cálculo dentro de la página (`SEMILLA` global del RRT): la tabla vale
  para este orden en una página nueva. Lo corrige T1.2.
- Los tiempos (secciones 2 y 3) varían de una ejecución a otra por la carga de la máquina: se dan mediana y rango.
- **Variabilidad residual en esta ejecución:** el ensayo M0 de la sección 2 (primer ensayo tras la carga, mismo procedimiento
  en las 3 páginas) dio t_sim 147.3, 140.6, 147.3 s. Queda una fuente de variación sin identificar
  (sospecha: el orden en que el bucle de render y los temporizadores intercalan el cálculo asíncrono, que consume la `SEMILLA`
  global). La matriz de 32 casos es una sola ejecución: tómala como referencia, no como valor exacto.
