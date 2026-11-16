# Medida de la fase 1

> Generado por `npm run medir -- docs/estado/medida-f1.md` (`tests/medidas/linea-base.mjs`, pasada de deuda de F1, DT14). No editar a
> mano: se regenera. Tiempos de Chromium con SwiftShader (WebGL por CPU) en un contenedor sin GPU.

## Entorno

- Fecha: 2026-11-16 · código medido: `src/` de 0597afa (rama t1d)
- Máquina: Intel(R) Xeon(R) Processor @ 2.10GHz, 2 CPU, 8 GB, linux 6.18.44-fc-v470
- Node v22.22.0 · Playwright 1.63.0 · Chromium 153.0.8010.12 sin interfaz · WebGL: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
- Ventana 1440 × 900, deviceScaleFactor 1, red cerrada (three servido desde node_modules)

## 1. Carga (3 páginas nuevas; mediana y rango)

| Medida | Mediana | Mín. | Máx. |
|---|---|---|---|
| Carga: inicio de la navegación → desaparece `#loading` | 11,7 s | 11,4 s | 11,9 s |
| `calcularPlanes` automático tras la carga (nominal, «gemelo», sin caché) | 1,5 s | 1,5 s | 1,7 s |

## 2. `calcularPlanes` con el robot nominal y con el 203 (DT14)

Disposición por defecto, perfil «gemelo», caché vaciada, 3 páginas nuevas (en cada una, nominal y después 203).

| Robot | Mediana | Mín. | Máx. |
|---|---|---|---|
| nominal | 0,9 s | 0,9 s | 0,9 s |
| 203 | 2,8 s | 2,5 s | 2,8 s |

## 3. Validar

Botón «Validar con perfil curso» sobre la disposición por defecto en una página recién cargada (`VAL.res.ms`: trayectorias de
los dos perfiles, comprobación previa y demo con los dos), 3 páginas nuevas.

| Página | Validar (s) | gemelo: previa · demo · ciclo (s) | curso: previa · demo · ciclo (s) |
|---|---|---|---|
| 1 | 8,7 | sin problemas · ok · 135.1 | sin problemas · ok · 109.3 |
| 2 | 8,5 | sin problemas · ok · 135.1 | sin problemas · ok · 109.3 |
| 3 | 8,6 | sin problemas · ok · 135.1 | sin problemas · ok · 109.3 |

Mediana: 8,6 s (mín. 8,5 s, máx. 8,7 s).

## 4. Matriz de 32 casos con «gemelo»

Caja/mesa × M0/M1 × balanceo 0 y 2 cm × velocidad 10, 25, 50 y 100 %, fase 0, en una página nueva y en este orden
(`CASOS_MATRIZ_32`). Tiempo total: 54,0 s.

**Agregado:** 16 «ok», 16 «previo» · choques 0 · roces 0 · pausas 3 · autocolisiones 0.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| caja M0 balanceo 0 cm vel 10 % | ok | 8 | 304.5 | 290.6 | 0 / 0 | 0 | 0 | 0 | 5 | 6186 |
| caja M0 balanceo 0 cm vel 25 % | ok | 8 | 150.3 | 136.5 | 0 / 0 | 0 | 0 | 0 | 5 | 3488 |
| caja M0 balanceo 0 cm vel 50 % | ok | 8 | 97.9 | 84 | 0 / 0 | 0 | 0 | 0 | 5 | 3100 |
| caja M0 balanceo 0 cm vel 100 % | ok | 8 | 68.2 | 54.4 | 0 / 0 | 0 | 0 | 0 | 5 | 3086 |
| caja M0 balanceo 2 cm vel 10 % | ok | 8 | 299.2 | 284.6 | 13 / 16 | 0 | 0 | 1 | 5 | 5220 |
| caja M0 balanceo 2 cm vel 25 % | ok | 8 | 149.6 | 135.1 | 5 / 12 | 0 | 0 | 0 | 5 | 3088 |
| caja M0 balanceo 2 cm vel 50 % | ok | 8 | 100.8 | 84.2 | 8 / 14 | 0 | 0 | 2 | 4 | 2663 |
| caja M0 balanceo 2 cm vel 100 % | ok | 8 | 68.3 | 54.5 | 7 / 20 | 0 | 0 | 0 | 5 | 2651 |
| caja M1 balanceo 0 cm vel 10 % | ok | 8 | 304.5 | 290.6 | 0 / 0 | 0 | 0 | 0 | 5 | 4014 |
| caja M1 balanceo 0 cm vel 25 % | ok | 8 | 150.3 | 136.5 | 0 / 0 | 0 | 0 | 0 | 5 | 2881 |
| caja M1 balanceo 0 cm vel 50 % | ok | 8 | 97.9 | 84 | 0 / 0 | 0 | 0 | 0 | 5 | 2355 |
| caja M1 balanceo 0 cm vel 100 % | ok | 8 | 68.2 | 54.4 | 0 / 0 | 0 | 0 | 0 | 5 | 2004 |
| caja M1 balanceo 2 cm vel 10 % | ok | 8 | 299.8 | 286 | 5 / 3 | 0 | 0 | 0 | 4 | 4289 |
| caja M1 balanceo 2 cm vel 25 % | ok | 8 | 149.7 | 135.2 | 4 / 2 | 0 | 0 | 0 | 4 | 3225 |
| caja M1 balanceo 2 cm vel 50 % | ok | 8 | 98.2 | 84.4 | 4 / 5 | 0 | 0 | 0 | 5 | 3046 |
| caja M1 balanceo 2 cm vel 100 % | ok | 8 | 68 | 54.2 | 6 / 3 | 0 | 0 | 0 | 5 | 1955 |
| mesa M0 balanceo 0 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 248 |
| mesa M0 balanceo 0 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 35 |
| mesa M0 balanceo 0 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 47 |
| mesa M0 balanceo 0 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 40 |
| mesa M0 balanceo 2 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 28 |
| mesa M0 balanceo 2 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 15 |
| mesa M0 balanceo 2 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 31 |
| mesa M0 balanceo 2 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 55 |
| mesa M1 balanceo 0 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 34 |
| mesa M1 balanceo 0 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 16 |
| mesa M1 balanceo 0 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 15 |
| mesa M1 balanceo 0 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 17 |
| mesa M1 balanceo 2 cm vel 10 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 15 |
| mesa M1 balanceo 2 cm vel 25 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 19 |
| mesa M1 balanceo 2 cm vel 50 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 32 |
| mesa M1 balanceo 2 cm vel 100 % | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 61 |

## 5. Matriz de 8 casos con «curso»

Los casos de `tests/fixtures/matriz-curso.json` (`CASOS_CURSO`), en una página nueva y en este orden. Tiempo total: 13,5 s.

**Agregado:** 4 «ok», 4 «previo» · choques 0 · roces 0 · pausas 1 · autocolisiones 0.

| Caso | fin | paso | t_sim (s) | t_mov (s) | errores (mm) | choques | roces | pausas | planes | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| caja M0 balanceo 0 cm vel 25 % perfil curso | ok | 8 | 127.6 | 113.7 | 0 / 0 | 0 | 0 | 0 | 5 | 4109 |
| caja M0 balanceo 2 cm vel 25 % perfil curso | ok | 8 | 124.1 | 109.3 | 16 / 8 | 0 | 0 | 1 | 5 | 3085 |
| caja M1 balanceo 0 cm vel 25 % perfil curso | ok | 8 | 127.6 | 113.7 | 0 / 0 | 0 | 0 | 0 | 5 | 2959 |
| caja M1 balanceo 2 cm vel 25 % perfil curso | ok | 8 | 126.4 | 112.5 | 3 / 4 | 0 | 0 | 0 | 5 | 2843 |
| mesa M0 balanceo 0 cm vel 25 % perfil curso | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 349 |
| mesa M0 balanceo 2 cm vel 25 % perfil curso | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 101 |
| mesa M1 balanceo 0 cm vel 25 % perfil curso | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 26 |
| mesa M1 balanceo 2 cm vel 25 % perfil curso | previo | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 45 |
