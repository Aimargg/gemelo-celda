# Barrido de la salida de la bandeja: comprobación de T2.8, H_SALIDA = 4 cm

> Generado por `node tools/barrido-salida.mjs docs/estado/barrido-salida-t28-h4.md --etiqueta "comprobación de T2.8, H_SALIDA = 4 cm"` (T2.8, DT30). No editar a mano: se regenera. Datos: `docs/estado/barrido-salida-t28-h4.json`.

## Entorno

- Código: `src/` de `e72f5ca` (con cambios sin commitear en src/) · `H_SALIDA` = 0.04 m · 2026-11-16
- Chromium 153.0.8010.12 con SwiftShader, sin GPU; una sola página para las 33 disposiciones, en el orden de la tabla. Duración: 129 s.
- Demo: perfil «curso», M0, balanceo 2 cm, velocidad 25 %, fase de la bandeja 0 (la de Validar).
- Rejilla: la disposición de partida y las 32 esquinas de persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm y bandeja.alt ±2 cm.

## Resumen

- Disposiciones: 33 · comprobación previa sin problemas: 29 · demo completa (viables): 25
- **Tocan la bandeja en el arranque del movimiento siguiente: 0 de 33**
- Tramo del último contacto con la bandeja, por salida (cada disposición tiene una por plato): subida 30 · salida 20

## Por disposición

Holguras con la bandeja en mm (mínimo de cada tramo, con el margen de 4 mm del planificador; negativa = contacto). «inicio»: la postura al acabar la subida, con la bandeja de ese instante. «arranque»: el mínimo en el arranque y, si no es en su primer fotograma, a cuánto se ha movido el TCP de la postura final de la subida y cuándo.

| Disp. | persona x/y (cm) · yaw | bandeja ade/alt (cm) | previa | demo | causa | toca | plato 1: salida · subida · inicio · arranque | plato 2: salida · subida · inicio · arranque | último contacto |
|---|---|---|---|---|---|---|---|---|---|
| partida | 0/0 · 0° | 0/0 | ok | ok (paso 8) | — | no | -20,2 · -0,7 · 41,6 · 25,4 (a 51 mm, 0,9 s) | -30,4 · -10,1 · 32,5 · 23,4 (a 14 mm, 0,62 s) | subida / subida |
| v01 | −2/−2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -10,2 · 10,9 · 50,3 · 35,8 (a 21 mm, 0,65 s) | -27,5 · -26 · 18,9 · 13,2 (a 5 mm, 0,33 s) | salida / subida |
| v02 | −2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,8 · 42,1 · 20,8 (a 51 mm, 0,9 s) | -30,5 · -22,6 · 23,6 · 16,5 (a 5 mm, 0,42 s) | salida / subida |
| v03 | −2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -18 · 12 · 28,5 · 14,8 (a 45 mm, 0,93 s) | -32 · -20,3 · 12,5 · 12,1 (a 0 mm, 0,07 s) | salida / subida |
| v04 | −2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -17,2 · 39,5 · 85,3 · 64 (a 7 mm, 1 s) | -26,6 · -24,4 · 20,6 · 13,8 (a 8 mm, 0,42 s) | salida / subida |
| v05 | −2/−2 · +5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v06 | −2/−2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,3 · 2,1 · 45,4 · 45,4 | -23,8 · 7,3 · 47,2 · 21,4 (a 51 mm, 0,93 s) | salida / salida |
| v07 | −2/−2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -18,6 · 10,9 · 32,8 · 32,8 | -23,9 · -7,4 · 29,3 · 5 (a 51 mm, 0,83 s) | salida / subida |
| v08 | −2/−2 · +5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v09 | −2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · -8,3 · 31,3 · 22,2 (a 51 mm, 0,95 s) | -29 · -14,5 · 22 · 22 | subida / subida |
| v10 | −2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,7 · 0,4 · 41,6 · 23,3 (a 51 mm, 0,93 s) | -30,9 · -17,1 · 29 · 24,8 (a 5 mm, 0,28 s) | salida / subida |
| v11 | −2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -15,9 · 5,8 · 34,2 · 27 (a 29 mm, 0,7 s) | -25,5 · -13,6 · 23,8 · 9 (a 51 mm, 1,77 s) | salida / subida |
| v12 | −2/+2 · −5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v13 | −2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -12,2 · 8,8 · 47,6 · 36,2 (a 13 mm, 0,55 s) | -37,5 · -16,3 · 15,2 · 8,4 (a 38 mm, 0,92 s) | salida / subida |
| v14 | −2/+2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,2 · 0,2 · 43,2 · 31,8 (a 51 mm, 1,05 s) | -27,8 · -14,3 · 23,5 · 13,8 (a 51 mm, 1,08 s) | salida / subida |
| v15 | −2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -24 · 15,7 · 33,1 · 18,4 (a 50 mm, 1 s) | -29,9 · -24,5 · 20,9 · 11,8 (a 51 mm, 1,05 s) | salida / subida |
| v16 | −2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,8 · 10,5 · 24,8 · 24,8 | -23,9 · -1,9 · 40,3 · 7,3 (a 51 mm, 0,82 s) | salida / subida |
| v17 | +2/−2 · −5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v18 | +2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -24 · 5,1 · 46,6 · 32 (a 22 mm, 0,83 s) | -24,2 · -12,4 · 25,8 · 25,8 | salida / subida |
| v19 | +2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -17,7 · 6,7 · 49,7 · 30,5 (a 36 mm, 0,85 s) | -26,7 · -15,7 · 26,4 · 25,3 (a 1 mm, 0,1 s) | salida / subida |
| v20 | +2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -24 · -5,1 · 37,2 · 13 (a 51 mm, 0,92 s) | -31,3 · -21,5 · 20,5 · 7,3 (a 25 mm, 0,78 s) | subida / subida |
| v21 | +2/−2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -23,9 · -0,6 · 38,7 · 22,8 (a 51 mm, 1,07 s) | -26,3 · -4,7 · 35,7 · 17,6 (a 50 mm, 1,02 s) | subida / subida |
| v22 | +2/−2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v23 | +2/−2 · +5° | +2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v24 | +2/−2 · +5° | +2/+2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v25 | +2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -23,7 · -0,1 · 39,7 · 24,6 (a 50 mm, 1 s) | -25,9 · -21,7 · 24,7 · 12,8 (a 12 mm, 0,58 s) | subida / subida |
| v26 | +2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -23 · -8,2 · 32,6 · 27,7 (a 51 mm, 1,3 s) | -30,2 · -14,5 · 24,2 · 24,2 | subida / subida |
| v27 | +2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -19,5 · 0,1 · 44 · 30,6 (a 51 mm, 0,95 s) | -22,4 · -22,8 · 22,2 · 19,6 (a 9 mm, 0,37 s) | salida / subida |
| v28 | +2/+2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,8 · 42,1 · 23,3 (a 51 mm, 0,93 s) | -21,8 · -9,1 · 29,2 · 29,2 | salida / subida |
| v29 | +2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · 2,1 · 41,5 · 25,5 (a 50 mm, 1,08 s) | -31,5 · -11,2 · 31,4 · 14,3 (a 39 mm, 0,9 s) | salida / subida |
| v30 | +2/+2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v31 | +2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -11,8 · 9,3 · 48,3 · 35,9 (a 15 mm, 0,6 s) | -29,1 · -11,9 · 25,7 · 2,2 (a 51 mm, 0,98 s) | salida / subida |
| v32 | +2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,3 · 0,2 · 43,2 · 43,2 | -22,6 · -4,2 · 30,9 · 18,9 (a 41 mm, 1,12 s) | salida / subida |

## Fallos

- v05: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v08: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v12: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v17: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v22: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
- v23: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v24: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v30: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
