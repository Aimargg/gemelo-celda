# Barrido de la salida de la bandeja: resumen de pasadas

> Generado por `node tools/barrido-salida.mjs --resumen docs/estado/barrido-salida-t28.md docs/estado/barrido-salida-v9-dev.json docs/estado/barrido-salida-t28-h2.json docs/estado/barrido-salida-t28-h3.json docs/estado/barrido-salida-t28-h4.json docs/estado/barrido-salida-t28-h5.json` (T2.8, DT30). No editar a mano. Cada fila es una pasada de las 33 disposiciones (su tabla, en su .md); «perdidas» y «ganadas» son disposiciones viables (comprobación previa y demo «curso» completas) frente a la base.

| Pasada | src/ | H_SALIDA (m) | tocan la bandeja | viables | perdidas | ganadas | holgura mínima al acabar la subida (mm) | holgura mínima en el arranque (mm) |
|---|---|---|---|---|---|---|---|---|
| código de hoy (v9-dev, fe366f5) | ebb6a8c | 0.02 | 10 (v06, v15, v18, v20, v25, v26, v27, v29, v31, v32) | 21 | — | — | -6,5 | -6,5 |
| comprobación de T2.8, H_SALIDA = 2 cm | e72f5ca | 0.02 | 0 | 26 | — | v06, v18, v24, v26, v27 | 11,9 | 2,6 |
| comprobación de T2.8, H_SALIDA = 3 cm | e72f5ca (con cambios sin commitear en src/) | 0.03 | 0 | 24 | v16 | v06, v18, v26, v27 | 3 | 1,8 |
| comprobación de T2.8, H_SALIDA = 4 cm | e72f5ca (con cambios sin commitear en src/) | 0.04 | 0 | 25 | — | v06, v18, v26, v27 | 12,5 | 2,2 |
| comprobación de T2.8, H_SALIDA = 5 cm | e72f5ca (con cambios sin commitear en src/) | 0.05 | 0 | 25 | — | v06, v18, v26, v27 | 11,5 | 6 |
