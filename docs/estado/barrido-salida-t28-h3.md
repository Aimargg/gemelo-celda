# Barrido de la salida de la bandeja: comprobación de T2.8, H_SALIDA = 3 cm

> Generado por `node tools/barrido-salida.mjs docs/estado/barrido-salida-t28-h3.md --etiqueta "comprobación de T2.8, H_SALIDA = 3 cm"` (T2.8, DT30). No editar a mano: se regenera. Datos: `docs/estado/barrido-salida-t28-h3.json`.

## Entorno

- Código: `src/` de `e72f5ca` (con cambios sin commitear en src/) · `H_SALIDA` = 0.03 m · 2026-11-16
- Chromium 153.0.8010.12 con SwiftShader, sin GPU; una sola página para las 33 disposiciones, en el orden de la tabla. Duración: 124 s.
- Demo: perfil «curso», M0, balanceo 2 cm, velocidad 25 %, fase de la bandeja 0 (la de Validar).
- Rejilla: la disposición de partida y las 32 esquinas de persona.x ±2 cm, persona.y ±2 cm, persona.yaw ±5°, bandeja.ade ±2 cm y bandeja.alt ±2 cm.

## Resumen

- Disposiciones: 33 · comprobación previa sin problemas: 29 · demo completa (viables): 24
- **Tocan la bandeja en el arranque del movimiento siguiente: 0 de 33**
- Tramo del último contacto con la bandeja, por salida (cada disposición tiene una por plato): subida 23 · salida 26

## Por disposición

Holguras con la bandeja en mm (mínimo de cada tramo, con el margen de 4 mm del planificador; negativa = contacto). «inicio»: la postura al acabar la subida, con la bandeja de ese instante. «arranque»: el mínimo en el arranque y, si no es en su primer fotograma, a cuánto se ha movido el TCP de la postura final de la subida y cuándo.

| Disp. | persona x/y (cm) · yaw | bandeja ade/alt (cm) | previa | demo | causa | toca | plato 1: salida · subida · inicio · arranque | plato 2: salida · subida · inicio · arranque | último contacto |
|---|---|---|---|---|---|---|---|---|---|
| partida | 0/0 · 0° | 0/0 | ok | ok (paso 8) | — | no | -20,2 · -0,7 · 36,4 · 11,3 (a 51 mm, 0,9 s) | -26,5 · -14,8 · 8,9 · 5,5 (a 45 mm, 1,07 s) | subida / subida |
| v01 | −2/−2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -10,2 · 10,9 · 42,2 · 22,7 (a 36 mm, 0,85 s) | -25,7 · -14,5 · 18,2 · 16,4 (a 1 mm, 0,15 s) | salida / subida |
| v02 | −2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,8 · 35,8 · 13,1 (a 51 mm, 1,2 s) | -36 · -22,9 · 5,2 · 4,7 (a 0 mm, 0,08 s) | salida / subida |
| v03 | −2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -18 · 12,1 · 40,1 · 28,3 (a 9 mm, 0,4 s) | -23,9 · -6,7 · 29 · 21,9 (a 6 mm, 0,4 s) | salida / subida |
| v04 | −2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -17,2 · 39,5 · 68,7 · 51,8 (a 20 mm, 1,3 s) | -24 · 2,6 · 27,5 · 9 (a 50 mm, 1,02 s) | salida / salida |
| v05 | −2/−2 · +5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v06 | −2/−2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,3 · 2,1 · 29,8 · 21,6 (a 50 mm, 1,38 s) | -23,1 · -4,2 · 31,4 · 13,8 (a 45 mm, 0,83 s) | salida / subida |
| v07 | −2/−2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -18,6 · 11 · 13,4 · 13,3 (a 0 mm, 0,03 s) | -19 · 5,4 · 32,6 · 10,8 (a 52 mm, 0,98 s) | salida / salida |
| v08 | −2/−2 · +5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v09 | −2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · -8,3 · 21,6 · 17,5 (a 51 mm, 0,95 s) | -13,5 · 1,8 · 35,6 · 31 (a 6 mm, 0,32 s) | subida / salida |
| v10 | −2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -19,7 · 0,4 · 35,7 · 8,2 (a 49 mm, 0,92 s) | -21,6 · -9,1 · 17 · 17 | salida / subida |
| v11 | −2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -15,9 · 5,8 · 28 · 16,6 (a 39 mm, 0,85 s) | -25,5 · -13,6 · 11,6 · 9,6 (a 35 mm, 1,18 s) | salida / subida |
| v12 | −2/+2 · −5° | +2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v13 | −2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -12,2 · 8,9 · 40,2 · 23,4 (a 31 mm, 0,87 s) | -24,7 · -11 · 9 · 7,3 (a 2 mm, 0,18 s) | salida / subida |
| v14 | −2/+2 · +5° | −2/+2 | ok | ok (paso 8) | — | no | -22,2 · 0,2 · 28,7 · 17,2 (a 51 mm, 1,1 s) | -24 · 5,1 · 33,9 · 5,6 (a 51 mm, 0,95 s) | salida / salida |
| v15 | −2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -24 · 15,7 · 38,7 · 25 (a 51 mm, 1,02 s) | -10,2 · 11 · 44,4 · 13,4 (a 51 mm, 0,87 s) | salida / salida |
| v16 | −2/+2 · +5° | +2/+2 | ok | fallo (paso 7) | cartesiana_incompleta | no | -22,8 · 10,5 · 33,1 · 24,8 (a 8 mm, 0,43 s) | — | salida |
| v17 | +2/−2 · −5° | −2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v18 | +2/−2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -24 · 5 · 33,8 · 21 (a 33 mm, 1,02 s) | -30,9 · -16,4 · 10,2 · 10,1 | salida / subida |
| v19 | +2/−2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -17,7 · 6,7 · 34,3 · 21,2 (a 44 mm, 0,95 s) | -28,4 · -27,3 · 3 · 1,8 (a 1 mm, 0,13 s) | salida / subida |
| v20 | +2/−2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -24 · -5,1 · 22,8 · 22,8 | -31 · -18,2 · 10,4 · 9,8 (a 0 mm, 0,1 s) | subida / subida |
| v21 | +2/−2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -23,9 · -0,6 · 24 · 22,1 (a 45 mm, 1,23 s) | -24 · -8,3 · 21,6 · 18,3 (a 51 mm, 1,02 s) | subida / subida |
| v22 | +2/−2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v23 | +2/−2 · +5° | +2/−2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v24 | +2/−2 · +5° | +2/+2 | ok | fallo (paso 6) | sin_trayectoria | no | — | — |  |
| v25 | +2/+2 · −5° | −2/−2 | ok | ok (paso 8) | — | no | -23,7 · -0,1 · 26,3 · 20,1 (a 51 mm, 1 s) | -28 · -8,6 · 23,4 · 23,4 | subida / subida |
| v26 | +2/+2 · −5° | −2/+2 | ok | ok (paso 8) | — | no | -23 · -8,2 · 26 · 21,4 (a 3 mm, 0,3 s) | -27,5 · -15,8 · 22,2 · 19,4 (a 3 mm, 0,2 s) | subida / subida |
| v27 | +2/+2 · −5° | +2/−2 | ok | ok (paso 8) | — | no | -19,5 · 0,1 · 37,7 · 16,7 (a 38 mm, 0,82 s) | -28 · -16,1 · 8,7 · 8,7 | salida / subida |
| v28 | +2/+2 · −5° | +2/+2 | ok | ok (paso 8) | — | no | -19,4 · 0,8 · 35,8 · 8 (a 49 mm, 0,92 s) | -21,1 · -7,1 · 15,3 · 15,3 | salida / subida |
| v29 | +2/+2 · +5° | −2/−2 | ok | ok (paso 8) | — | no | -24 · 2,1 · 26,4 · 19,3 (a 50 mm, 1,13 s) | -23,3 · -6,2 · 16,5 · 8,7 (a 52 mm, 1,03 s) | salida / subida |
| v30 | +2/+2 · +5° | −2/+2 | falla | previo (paso 0) | previo | no | — | — |  |
| v31 | +2/+2 · +5° | +2/−2 | ok | ok (paso 8) | — | no | -11,8 · 9,3 · 40,1 · 23,1 (a 34 mm, 0,9 s) | -15,4 · 3,5 · 40,4 · 25,4 (a 50 mm, 0,92 s) | salida / salida |
| v32 | +2/+2 · +5° | +2/+2 | ok | ok (paso 8) | — | no | -22,3 · 0,2 · 28,7 · 19,8 (a 50 mm, 1,43 s) | -24 · 4,6 · 34,2 · 5,7 (a 51 mm, 0,95 s) | salida / salida |

## Fallos

- v05: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v08: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v12: previa: Plato 1º → zona_primero: no puedo llevarlo nivelado y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se a
- v16: No puedo llevar el plato 2 nivelado hasta zona_segundo y dejarlo sin chocar: la ruta cartesiana queda incompleta: entre dos posturas, el punto medio articular se aparta 174,6 mm y 0,795 rad de la rect
- v17: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v22: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
- v23: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v24: No encuentro una trayectoria sin colisiones hasta la aproximación al plato 1.
- v30: previa: Plato 2º → zona_segundo: no puedo llevarlo nivelado y dejarlo sin chocar: chocaría lo que lleva la pinza con la cámara cenital o su brazo (llega al 29 %). Bande
