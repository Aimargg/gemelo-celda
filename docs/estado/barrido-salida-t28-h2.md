# Barrido de la salida de la bandeja: comprobación de T2.8, H_SALIDA = 2 cm

> Generado por `node tools/barrido-salida.mjs docs/estado/barrido-salida-t28-h2.md --etiqueta "comprobación de T2.8, H_SALIDA = 2 cm"` (T2.8, DT30). No editar a mano: se regenera. Datos: `docs/estado/barrido-salida-t28-h2.json`.

## Entorno

- Código: `src/` de `e72f5ca` · `H_SALIDA` = 0.02 m · 2026-11-16
- Chromium 153.0.8010.12 con SwiftShader, sin GPU; una sola página para las 33 disposiciones, en el orden de la tabla. Duración: 132 s.
- Demo: perfil «curso», M0, balanceo 2 cm, velocidad 25 %, fase de la bandeja 0 (la de Validar).
- Rejilla: la disposición de partida y las 32 esquinas de persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm y bandeja.alt ±2 cm.

## Resumen

- Disposiciones: 33 · comprobación previa sin problemas: 29 · demo completa (viables): 26
- **Tocan la bandeja en el arranque del movimiento siguiente: 0 de 33**
- Tramo del último contacto con la bandeja, por salida (cada disposición tiene una por plato): salida 39 · subida 13

## Por disposición

Holguras con la bandeja en mm (mínimo de cada tramo, con el margen de 4 mm del planificador; negativa = contacto). «inicio»: la postura al acabar la subida, con la bandeja de ese instante. «arranque»: el mínimo en el arranque y, si no es en su primer fotograma, a cuánto se ha movido el TCP de la postura final de la subida y cuándo.

| Disp. | persona x/y (cm) · yaw | bandeja ade/alt (cm) | previa | demo | causa | toca | plato 1: salida · subida · inicio · arranque | plato 2: salida · subida · inicio · arranque | último contacto |
|---|---|---|---|---|---|---|---|---|---|
| partida | 0/0 · 0° | 0/0 | ok | ok (paso 8) | — | no | -11,2 · 26,1 · 49,5 · 36,6 (a 31 mm, 1 s) | -24 · -5,1 · 20,8 · 3,2 (a 50 mm, 1 s) | salida / subida |
| v01 | −2/−2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -10,2 · 10,7 · 27,2 · 12,6 (a 43 mm, 0,93 s) | -21,8 · 10,5 · 20,5 · 15,2 (a 50 mm, 0,98 s) | salida / salida |
| v02 | −2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -24 · 17 · 33,8 · 14,1 (a 50 mm, 0,9 s) | -24 · -4,6 · 22,2 · 2,6 (a 51 mm, 1,02 s) | salida / subida |
| v03 | −2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -18 · 12,1 · 36,7 · 29,4 (a 10 mm, 0,43 s) | -17 · 10,4 · 22,4 · 15,3 (a 51 mm, 0,98 s) | salida / salida |
| v04 | −2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -17,2 · 39,5 · 57,3 · 38,7 (a 38 mm, 1,58 s) | -24 · 4,6 · 17,2 · 17,2 | salida / salida |
| v05 | −2/−2 · +5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v06 | −2/−2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -21,7 · 26,6 · 49,4 · 26,5 (a 51 mm, 1,02 s) | -14 · 20,4 · 50,6 · 38,7 (a 11 mm, 0,58 s) | salida / salida |
| v07 | −2/−2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -18,6 · 11 · 27,6 · 13,8 (a 9 mm, 0,43 s) | -13,9 · 10,2 · 21,9 · 14 (a 50 mm, 0,78 s) | salida / salida |
| v08 | −2/−2 · +5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v09 | −2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -19,6 · 2,6 · 14,5 · 4,3 (a 51 mm, 1,05 s) | -10,6 · 3,5 · 34,8 · 18,2 (a 37 mm, 0,82 s) | salida / salida |
| v10 | −2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -18,8 · 15,5 · 40,6 · 30,9 (a 51 mm, 0,95 s) | -24 · 3,7 · 12,9 · 10,5 (a 50 mm, 0,95 s) | salida / salida |
| v11 | −2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -15,9 · 5,6 · 16,7 · 8,7 (a 49 mm, 0,98 s) | -23,3 · 3,7 · 16,1 · 8,8 (a 51 mm, 0,97 s) | salida / salida |
| v12 | −2/+2 · −5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v13 | −2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -12,2 · 8,6 · 25,2 · 25,2 | -11,5 · 12,8 · 25,3 · 12,7 (a 52 mm, 1,03 s) | salida / salida |
| v14 | −2/+2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,2 · 0,2 · 20,2 · 18,2 (a 2 mm, 0,2 s) | -10,4 · 21,4 · 52,2 · 38,1 (a 16 mm, 0,7 s) | salida / salida |
| v15 | −2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -24 · 15,7 · 32 · 27,2 (a 51 mm, 1,02 s) | -16,9 · 6,5 · 17,9 · 14,5 (a 51 mm, 0,72 s) | salida / salida |
| v16 | −2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,8 · 10,5 · 28,1 · 24,8 (a 40 mm, 0,8 s) | -24 · 37,1 · 50,5 · 38,7 (a 44 mm, 1,18 s) | salida / salida |
| v17 | +2/−2 · −5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v18 | +2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -24 · 4,8 · 19 · 9,8 (a 45 mm, 1,2 s) | -23,6 · -2,2 · 27,2 · 12,5 (a 35 mm, 0,83 s) | salida / subida |
| v19 | +2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -17,7 · 6,7 · 19 · 16,3 (a 50 mm, 1,02 s) | -23,9 · -5,7 · 11,9 · 11,9 | salida / subida |
| v20 | +2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -21,6 · 25,2 · 37,5 · 31,7 (a 51 mm, 1,25 s) | -18,8 · -1,4 · 29,4 · 11,5 (a 39 mm, 0,87 s) | salida / subida |
| v21 | +2/−2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -23,9 · -0,6 · 12,8 · 12,6 (a 0 mm, 0,05 s) | -15,5 · 0,6 · 31,2 · 15,5 (a 29 mm, 0,72 s) | subida / salida |
| v22 | +2/−2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v23 | +2/−2 · +5° | +2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v24 | +2/−2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -23,8 · 17,3 · 39,7 · 16,2 (a 50 mm, 1 s) | -18,4 · 15,3 · 42,8 · 28 (a 26 mm, 0,9 s) | salida / salida |
| v25 | +2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -23,7 · -0,1 · 17,3 · 15,7 (a 2 mm, 0,18 s) | -23,9 · -8,7 · 22,9 · 9,3 (a 27 mm, 0,68 s) | subida / subida |
| v26 | +2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -23 · -8,2 · 20,7 · 10,9 (a 8 mm, 0,5 s) | -23,9 · 1,6 · 14,4 · 6,5 (a 51 mm, 0,97 s) | subida / salida |
| v27 | +2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -19,5 · 0 · 26,9 · 3,2 (a 51 mm, 0,95 s) | -23,6 · -9 · 21,7 · 8,7 (a 22 mm, 0,62 s) | salida / subida |
| v28 | +2/+2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -23,9 · 17,4 · 34,2 · 13,9 (a 50 mm, 0,93 s) | -23,9 · -6,9 · 23,2 · 4,6 (a 43 mm, 0,9 s) | salida / subida |
| v29 | +2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · 2,1 · 14,1 · 14,1 | -23,2 · -9 · 19,3 · 11,6 (a 11 mm, 0,42 s) | salida / subida |
| v30 | +2/+2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v31 | +2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -11,8 · 9,1 · 24,7 · 24,7 | -23,9 · -3,1 · 20,9 · 15,6 (a 7 mm, 0,35 s) | salida / subida |
| v32 | +2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,3 · 0,2 · 20,2 · 18,5 (a 1 mm, 0,17 s) | -13,7 · 25,9 · 46,3 · 33,4 (a 35 mm, 1,07 s) | salida / salida |

## Fallos

- v05: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v08: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v12: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v17: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v22: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
- v23: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v30: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
