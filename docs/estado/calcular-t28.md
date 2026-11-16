# «Calcular» en la disposición de partida con cada `H_SALIDA` (T2.8, DT30)

> Medida del agente de T2.8 (2026-11-16), mediana de 5 ejecuciones de «Calcular» en la disposición de partida, con el
> código de cada pasada del barrido (`docs/estado/barrido-salida-t28.md`). Se trae aquí desde el commit 493e29a para que la
> elección de `H_SALIDA` tenga su evidencia en el repo (revisión independiente de la puerta de F2, H2). No se ha vuelto a
> medir: los tiempos dependen de la máquina; lo que cuenta es la proporción entre filas.

| Código | `H_SALIDA` | «gemelo» (s) | «curso» (s) |
|---|---|---|---|
| antes de T2.8 (v9-dev, fe366f5) | 2 cm | 0,90 | 0,59 |
| comprobación de T2.8 | 2 cm | 1,70 | 1,29 |
| comprobación de T2.8 | 3 cm | 0,91 | 0,56 |
| comprobación de T2.8 | 4 cm | 0,90 | 0,54 |
| comprobación de T2.8 | 5 cm | 0,82 | 0,54 |

Con 2 cm, la comprobación descarta los agarres de la partida y busca otros: «Calcular» casi se duplica, y la decisión 2 del
brief de T2.8 pide que la comprobación no lo encarezca de forma apreciable. Con 3 cm se pierde v16. 4 cm es el menor valor
que deja 0 contactos con la bandeja, no pierde ninguna disposición viable antes de T2.8 y no encarece «Calcular». Frente a
2 cm, 4 cm deja de ganar v24 (no viable antes de T2.8) y su holgura mínima en el arranque es 2,2 mm en vez de 2,6 mm.
Aceptado por el coordinador al cerrar F2.
