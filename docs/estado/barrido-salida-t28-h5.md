# Barrido de la salida de la bandeja: comprobación de T2.8, H_SALIDA = 5 cm

> Generado por `node tools/barrido-salida.mjs docs/estado/barrido-salida-t28-h5.md --etiqueta "comprobación de T2.8, H_SALIDA = 5 cm"` (T2.8, DT30). No editar a mano: se regenera. Datos: `docs/estado/barrido-salida-t28-h5.json`.

## Entorno

- Código: `src/` de `e72f5ca` (con cambios sin commitear en src/) · `H_SALIDA` = 0.05 m · 2026-11-16
- Chromium 153.0.8010.12 con SwiftShader, sin GPU; una sola página para las 33 disposiciones, en el orden de la tabla. Duración: 117 s.
- Demo: perfil «curso», M0, balanceo 2 cm, velocidad 25 %, fase de la bandeja 0 (la de Validar).
- Rejilla: la disposición de partida y las 32 esquinas de persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm y bandeja.alt ±2 cm.

## Resumen

- Disposiciones: 33 · comprobación previa sin problemas: 29 · demo completa (viables): 25
- **Tocan la bandeja en el arranque del movimiento siguiente: 0 de 33**
- Tramo del último contacto con la bandeja, por salida (cada disposición tiene una por plato): subida 31 · salida 19

## Por disposición

Holguras con la bandeja en mm (mínimo de cada tramo, con el margen de 4 mm del planificador; negativa = contacto). «inicio»: la postura al acabar la subida, con la bandeja de ese instante. «arranque»: el mínimo en el arranque y, si no es en su primer fotograma, a cuánto se ha movido el TCP de la postura final de la subida y cuándo.

| Disp. | persona x/y (cm) · yaw | bandeja ade/alt (cm) | previa | demo | causa | toca | plato 1: salida · subida · inicio · arranque | plato 2: salida · subida · inicio · arranque | último contacto |
|---|---|---|---|---|---|---|---|---|---|
| partida | 0/0 · 0° | 0/0 | ok | ok (paso 8) | — | no | -20,2 · -0,8 · 46,5 · 35,7 (a 51 mm, 0,9 s) | -27,2 · -10 · 42,6 · 32,6 (a 10 mm, 0,52 s) | subida / subida |
| v01 | −2/−2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -10,2 · 10,7 · 52,9 · 46,7 (a 52 mm, 1,03 s) | -34,9 · -34 · 16,2 · 16,2 | salida / subida |
| v02 | −2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,7 · 46,1 · 32,9 (a 51 mm, 0,9 s) | -26 · -7 · 45,1 · 35 (a 15 mm, 0,52 s) | salida / subida |
| v03 | −2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -18 · 11 · 11,5 · 11,5 | -37,2 · -26,2 · 24,6 · 13,4 (a 20 mm, 0,63 s) | salida / subida |
| v04 | −2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -17,2 · 39,5 · 99 · 73,8 (a 51 mm, 1,77 s) | -27 · -16 · 34,1 · 34 | salida / subida |
| v05 | −2/−2 · +5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v06 | −2/−2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,3 · 2,1 · 60,2 · 31,5 (a 51 mm, 1 s) | -22,2 · -3 · 45,9 · 13,1 (a 51 mm, 0,95 s) | salida / subida |
| v07 | −2/−2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -18,6 · 10,8 · 38,2 · 19 (a 42 mm, 0,98 s) | -33 · -15,9 · 34,7 · 6,9 (a 50 mm, 0,9 s) | salida / subida |
| v08 | −2/−2 · +5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v09 | −2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · -8,3 · 44,9 · 26,2 (a 51 mm, 0,95 s) | -34,1 · -31,3 · 20,9 · 16,6 (a 3 mm, 0,28 s) | subida / subida |
| v10 | −2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,7 · 0,3 · 45,8 · 34 (a 51 mm, 0,93 s) | -26,9 · -17,7 · 33,2 · 25,8 (a 29 mm, 0,85 s) | salida / subida |
| v11 | −2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -15,9 · 5,6 · 32,1 · 30,5 (a 2 mm, 0,18 s) | -35,6 · -28 · 22,6 · 15,1 (a 36 mm, 0,97 s) | salida / subida |
| v12 | −2/+2 · −5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v13 | −2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -12,2 · 8,6 · 50,2 · 46,8 (a 50 mm, 1,12 s) | -30,9 · -13,5 · 37 · 11,3 (a 51 mm, 0,98 s) | salida / subida |
| v14 | −2/+2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,2 · 0,2 · 59,1 · 32,4 (a 50 mm, 1,03 s) | -28,9 · -11,7 · 31,6 · 31,6 | salida / subida |
| v15 | −2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -24 · 15,7 · 36,8 · 18,4 (a 25 mm, 0,7 s) | -35,4 · -14,7 · 36,8 · 6 (a 51 mm, 0,87 s) | salida / subida |
| v16 | −2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,8 · 10,5 · 49,7 · 39,6 (a 28 mm, 0,73 s) | -27 · -8,9 · 43,4 · 24,9 (a 51 mm, 0,67 s) | salida / subida |
| v17 | +2/−2 · −5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v18 | +2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -24 · 5,1 · 56,5 · 42,8 (a 15 mm, 0,68 s) | -25,6 · -12,3 · 39,4 · 39,4 | salida / subida |
| v19 | +2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -17,7 · 6,7 · 58,3 · 43,6 (a 22 mm, 0,67 s) | -37,3 · -23,8 · 24,3 · 24,3 | salida / subida |
| v20 | +2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -24 · -5,1 · 53,1 · 20,5 (a 51 mm, 0,92 s) | -34,2 · -21,5 · 28,6 · 28,6 | subida / subida |
| v21 | +2/−2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -23,9 · -0,6 · 53,1 · 34,1 (a 49 mm, 1,05 s) | -35,8 · -24 · 19 · 19 | subida / subida |
| v22 | +2/−2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v23 | +2/−2 · +5° | +2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v24 | +2/−2 · +5° | +2/+2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v25 | +2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -23,7 · -0,1 · 54,5 · 32,9 (a 50 mm, 1 s) | -32,4 · -21 · 29 · 18,8 (a 23 mm, 0,78 s) | subida / subida |
| v26 | +2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -23 · -8,2 · 41,8 · 34,7 (a 51 mm, 1,3 s) | -33,5 · -16,5 · 34,9 · 34,9 | subida / subida |
| v27 | +2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -19,5 · 0 · 48,8 · 40,8 (a 51 mm, 0,95 s) | -25,9 · -7,7 · 44,9 · 37 (a 10 mm, 0,45 s) | salida / subida |
| v28 | +2/+2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,7 · 46,1 · 34,4 (a 51 mm, 0,93 s) | -25,5 · -13,7 · 36,5 · 24,2 (a 16 mm, 0,72 s) | salida / subida |
| v29 | +2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · 2,1 · 55,3 · 37,5 (a 40 mm, 0,97 s) | -33,3 · -15,1 · 37,5 · 25,4 (a 18 mm, 0,6 s) | salida / subida |
| v30 | +2/+2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v31 | +2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -11,8 · 9,1 · 50,5 · 47,1 (a 51 mm, 1,12 s) | -36,3 · -23,6 · 26,9 · 11,3 (a 51 mm, 0,97 s) | salida / subida |
| v32 | +2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,3 · 0,2 · 59,1 · 32,1 (a 50 mm, 1,03 s) | -35,6 · -14,3 · 30 · 18,7 (a 34 mm, 0,87 s) | salida / subida |

## Fallos

- v05: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v08: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v12: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v17: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v22: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
- v23: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v24: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v30: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
