# Barrido de la salida de la bandeja: código de hoy (v9-dev, fe366f5)

> Generado por `node tools/barrido-salida.mjs docs/estado/barrido-salida-v9-dev.md --etiqueta "código de hoy (v9-dev, fe366f5)"` (T2.8, DT30). No editar a mano: se regenera. Datos: `docs/estado/barrido-salida-v9-dev.json`.

## Entorno

- Código: `src/` de `ebb6a8c` · `H_SALIDA` = 0.02 m · 2026-11-16
- Chromium 153.0.8010.12 con SwiftShader, sin GPU; una sola página para las 33 disposiciones, en el orden de la tabla. Duración: 122 s.
- Demo: perfil «curso», M0, balanceo 2 cm, velocidad 25 %, fase de la bandeja 0 (la de Validar).
- Rejilla: la disposición de partida y las 32 esquinas de persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm y bandeja.alt ±2 cm.

## Resumen

- Disposiciones: 33 · comprobación previa sin problemas: 29 · demo completa (viables): 21
- **Tocan la bandeja en el arranque del movimiento siguiente: 10 de 33**
- Tramo del último contacto con la bandeja, por salida (cada disposición tiene una por plato): subida 18 · salida 22 · arranque 10

## Por disposición

Holguras con la bandeja en mm (mínimo de cada tramo, con el margen de 4 mm del planificador; negativa = contacto). «inicio»: la postura al acabar la subida, con la bandeja de ese instante. «arranque»: el mínimo en el arranque y, si no es en su primer fotograma, a cuánto se ha movido el TCP de la postura final de la subida y cuándo.

| Disp. | persona x/y (cm) · yaw | bandeja ade/alt (cm) | previa | demo | causa | toca | plato 1: salida · subida · inicio · arranque | plato 2: salida · subida · inicio · arranque | último contacto |
|---|---|---|---|---|---|---|---|---|---|
| partida | 0/0 · 0° | 0/0 | ok | ok (paso 8) | — | no | -20,2 · -0,8 · 26,7 · 1,3 (a 50 mm, 0,95 s) | -28,3 · -12,8 · 8,1 · 3,6 (a 40 mm, 0,97 s) | subida / subida |
| v01 | −2/−2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -10,2 · 10,7 · 27,2 · 12,6 (a 43 mm, 0,93 s) | -25,2 · -10 · 0,1 · 0,1 | salida / subida |
| v02 | −2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,7 · 23,7 · 0,1 (a 51 mm, 0,88 s) | -29,7 · -16,5 · 5,5 · 2,5 (a 2 mm, 0,22 s) | salida / subida |
| v03 | −2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -18 · 12,1 · 36,7 · 29,4 (a 10 mm, 0,43 s) | -17 · 10,4 · 22,4 · 15,3 (a 51 mm, 0,98 s) | salida / salida |
| v04 | −2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -17,2 · 39,5 · 57,3 · 38,7 (a 38 mm, 1,58 s) | -24 · 4,6 · 17,2 · 17,2 | salida / salida |
| v05 | −2/−2 · +5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v06 | −2/−2 · +5° | −2/+2 | ok | fallo (paso 8) | arranque_contacto (bandeja) | **sí** | -22,3 · 2,1 · 18,9 · 18,3 (a 1 mm, 0,12 s) | -35,2 · -17,9 · -0,6 (parada) · -0,6 | salida / arranque |
| v07 | −2/−2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -18,6 · 11 · 27,6 · 13,8 (a 9 mm, 0,43 s) | -25,9 · -14,2 · 11,4 · 6,3 (a 9 mm, 0,3 s) | salida / subida |
| v08 | −2/−2 · +5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v09 | −2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · -8,3 · 16,3 · 9 (a 11 mm, 0,43 s) | -26,7 · -7,5 · 10,3 · 10,3 | subida / subida |
| v10 | −2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,7 · 0,3 · 24 · 15,3 (a 51 mm, 1,63 s) | -30,9 · -17,2 · 11,2 · 11,2 | salida / subida |
| v11 | −2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -15,9 · 5,6 · 16,7 · 8,7 (a 49 mm, 0,98 s) | -17,3 · -3 · 8,2 · 8,2 | salida / subida |
| v12 | −2/+2 · −5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v13 | −2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -12,2 · 8,6 · 25,2 · 25,2 | -25,7 · -14,6 · 13,5 · 6,1 (a 10 mm, 0,4 s) | salida / subida |
| v14 | −2/+2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,2 · 0,2 · 20,2 · 18,1 (a 2 mm, 0,2 s) | -33,3 · -21,9 · 9,4 · 2,5 (a 15 mm, 0,5 s) | salida / subida |
| v15 | −2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | **sí** | -24 · 15,7 · 32 · 27,2 (a 51 mm, 1,02 s) | -33,9 · -22 · 9 · -4,5 (a 26 mm, 0,72 s) | salida / arranque |
| v16 | −2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,8 · 10,5 · 28,1 · 24,6 (a 38 mm, 0,8 s) | -28,4 · -12,1 · 2,3 · 1,5 (a 1 mm, 0,12 s) | salida / subida |
| v17 | +2/−2 · −5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v18 | +2/−2 · −5° | −2/+2 | ok | fallo (paso 8) | arranque_contacto (bandeja) | **sí** | -24 · 4,8 · 19 · 9,8 (a 45 mm, 1,2 s) | -29,2 · -12,1 · -0,3 (parada) · -0,3 | salida / arranque |
| v19 | +2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -17,7 · 6,7 · 19 · 16,3 (a 50 mm, 1,02 s) | -37,3 · -23,9 · 5,6 · 5,4 (a 6 mm, 0,35 s) | salida / subida |
| v20 | +2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | **sí** | -24 · -5,1 · 13,5 · 12,2 (a 3 mm, 0,15 s) | -33,8 · -21,1 · 2,1 · -2,1 (a 2 mm, 0,27 s) | subida / arranque |
| v21 | +2/−2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -23,9 · -0,6 · 12,8 · 12,6 (a 0 mm, 0,05 s) | -15,5 · 0,6 · 31,2 · 15,5 (a 29 mm, 0,72 s) | subida / salida |
| v22 | +2/−2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v23 | +2/−2 · +5° | +2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v24 | +2/−2 · +5° | +2/+2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v25 | +2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | **sí** | -23,7 · -0,1 · 17,3 · 15,7 (a 2 mm, 0,18 s) | -36,4 · -23,8 · 3 · -1,4 (a 4 mm, 0,28 s) | subida / arranque |
| v26 | +2/+2 · −5° | −2/+2 | ok | fallo (paso 8) | arranque_contacto (bandeja) | **sí** | -23 · -8,2 · 20,7 · 10,9 (a 8 mm, 0,5 s) | -30,7 · -18,6 · -4,6 (parada) · -4,6 | subida / arranque |
| v27 | +2/+2 · −5° | +2/−2 | ok | fallo (paso 8) | arranque_contacto (bandeja) | **sí** | -19,5 · 0 · 26,9 · 3,2 (a 51 mm, 0,95 s) | -29,9 · -17,1 · -6,5 (parada) · -6,5 | salida / arranque |
| v28 | +2/+2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,7 · 23,7 · 2,3 (a 51 mm, 0,8 s) | -21,1 · -7,1 · 3,2 · 3,2 | salida / subida |
| v29 | +2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | **sí** | -24 · 2,1 · 14,1 · 14,1 | -37,5 · -23,8 · 3 · -4,8 (a 13 mm, 0,43 s) | salida / arranque |
| v30 | +2/+2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v31 | +2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | **sí** | -11,8 · 9,1 · 24,7 · 24,7 | -32,9 · -21,7 · 9,2 · -0,4 (a 20 mm, 0,53 s) | salida / arranque |
| v32 | +2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | **sí** | -22,3 · 0,2 · 20,2 · 18,4 (a 1 mm, 0,18 s) | -30,2 · -19,2 · 9,6 · -0,7 (a 20 mm, 0,52 s) | salida / arranque |

## Fallos

- v05: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v06: MoveIt rechazaría el arranque en contacto (START_STATE_IN_COLLISION): un dedo de la pinza con la bandeja, al ir hacia la postura de reposo.
- v08: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v12: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v17: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v18: MoveIt rechazaría el arranque en contacto (START_STATE_IN_COLLISION): un dedo de la pinza con la bandeja, al ir hacia la postura de reposo.
- v22: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
- v23: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v24: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v26: MoveIt rechazaría el arranque en contacto (START_STATE_IN_COLLISION): un dedo de la pinza con la bandeja, al ir hacia la postura de reposo.
- v27: MoveIt rechazaría el arranque en contacto (START_STATE_IN_COLLISION): un dedo de la pinza con la bandeja, al ir hacia la postura de reposo.
- v30: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
