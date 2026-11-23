# Sistema visual del gemelo de la celda UR3e

> Fuente de verdad de los valores: las variables de `:root` en `src/part1.html` (y su versión oscura). Este documento explica
> el significado y las reglas; no copia valores. Si cambias un token, cambia allí y revisa aquí la regla que le afecte.
> Generado por IA, como todo el repo (I9). Remodelado TU.1, 2026-11-23.

## Concepto

**Guion de la demo** (dirección A de `docs/diseno/direcciones/principal/`, con la matriz de cámaras de la dirección C): la
interfaz sigue el proceso del grupo, numerado como el guion de la demo (1 Celda → 2 Cámaras → 3 Alcance → 4 Demo →
5 Exportar), y el veredicto de la demo está siempre a la vista en la cinta del ciclo.

**Para quién y para qué:** los ocho del grupo, en su portátil, de vez en cuando y sin experiencia en robótica. El trabajo
de la pantalla es decidir dónde va cada cosa de la celda, saber si la demo sale (y por qué no) y llevarse los ficheros a ROS.

## Principios

- El veredicto no se busca: la cinta del ciclo lo dice siempre («Sin calcular», «Calculando», «Sin comprobar», «Lista»,
  «En curso», «Completa», «No empieza», «Parada», «Abortada»), con palabra además de color. «Lista» solo con una
  comprobación previa vigente para esa disposición (se hace al abrir el paso 4 o al reproducir); sin ella, «Sin comprobar».
- La cinta y los puntos de los pasos solo leen: nunca calculan, planifican ni mueven nada (I6).
- La rejilla no se toca sin medir: cabecera de 42 px y vista | panel de 384 px. El lienzo 3D mide 998 × 828 a 1440 × 900 y
  hay pruebas que lo fijan (las huellas de `distorsion.test.mjs`); cambiarlo obliga a volver a medirlas en el portátil.
- Lo que se pulsa es tinta oscura; el amarillo de la cinta de carrocero es solo el paso actual y el progreso.

## Color

| Token | Función | Reglas de uso |
|---|---|---|
| `--ink` | texto y controles activos (botón principal, segmentado pulsado, vista 3D elegida) | nunca para estados |
| `--muted` | texto secundario y ayudas | mínimo 4,5:1 sobre `--panel` y `--bg` |
| `--bg`, `--panel`, `--panel2` | fondo, paneles, fondos de campo | — |
| `--line`, `--line2`, `--line-f` | separadores; `--line-f` para bordes de controles (3:1) | — |
| `--tape`, `--tape-edge`, `--tape-soft` | paso actual, progreso del ciclo, aviso de «Calcular» | nunca como fondo de texto largo |
| `--ok`, `--warn`, `--bad` (+ `-soft`) | estados: cumple, límite, no cumple / choque / fallo | siempre con palabra o cifra al lado |
| `--v1`, `--v2`, `--rob` | subgrupos (Visión 1, Visión 2, Robótica) | solo etiquetas de grupo |
| `--accent` | enlaces y foco | — |

Pares validados con `contraste.py` (2026-11-23): `--ink` y `--muted` sobre `--bg` y `--panel`, `--tape-ink` sobre `--tape`,
`--ok`, `--bad` y `--warn` sobre blanco y sobre su `-soft`, `--v1` y `--v2` sobre blanco: todos ≥ 4,5:1; `--tape-edge` sobre
blanco 3,8:1 (solo borde). El texto de los sellos rellenos es `--panel` sobre `--ok` o `--bad`: 5,34 y 6,19:1 en claro; en
oscuro, la tinta oscura sobre el verde y el rojo claros supera también 4,5:1 (revisión de TU.1, H2).

## Tipografía

| Familia | Función | Pesos |
|---|---|---|
| Barlow (`--f-ui`) | texto de interfaz | 400, 500, 600, 700 |
| Barlow Condensed (`--f-rot`) | rótulos: título, pasos, títulos de sección y de tarjeta, sello y cifra del ciclo | 500, 600, 700 |
| JetBrains Mono (`--f-mono`) | cifras, unidades y nombres de ROS (`base_link`, ficheros) | 400, 500, 700 |

Se cargan de Google Fonts; en las pruebas responden vacías y la página cae a las fuentes del sistema, sin cambiar la rejilla
(las alturas que importan están fijadas en px).

## Espacio, retícula y forma

- Escritorio: cabecera de 42 px; debajo, vista 3D y panel de 384 px con 10 px entre ellos. Radios de 8 px en paneles y
  4–6 px en controles; sin sombras salvo en lo que flota sobre la vista 3D.
- Hasta 900 px: una columna (vista arriba, pasos y panel debajo). Hasta 600 px: sin subtítulo, pasos y matriz más compactos y
  la cinta del ciclo a todo el ancho de la vista.

## Componentes y patrones

- **Pasos** (`.tabs`): las pestañas de siempre (`data-tab`) numeradas y unidas por una línea; el actual en `--tape`; un punto de
  estado en la esquina del número (1 Celda: un plato no se puede coger; 2 Cámaras: la peor tarea de la matriz; 4 Demo: el
  veredicto).
- **Cinta del ciclo** (`#ciclo`, `pintarCiclo()` en `src/app.js`): botón ▶/❚❚ (es «Reproducir demo»), sello, cifra y motivo
  corto, los 8 pasos del coordinador (hecho, actual, fallo) y el paso actual. No recibe clics salvo el botón: no estorba
  para arrastrar objetos.
- **Matriz cámara × tarea** (`#camMatriz`, `pintarMatrizCams()`): Fruta, ArUco (la peor de cada cámara), Cara, Mano, Bandeja
  (desenfoque) y Enfoque (objetivos dentro de la profundidad de campo). Pulsar una casilla marca su fila en la tarjeta.
- Barras flotantes de la vista (`.vbar`, `#calcBar`, `#valBar`, HUD) y tarjetas de los paneles, con los mismos tokens.

## Estados

- **Sin comprobar:** sello discontinuo y «el paso 4 comprueba el resto»: las trayectorias están al día, pero no hay
  comprobación previa para esta disposición.
- **Sin calcular:** sello discontinuo y «pulsa «Calcular trayectorias»»; la barra de cálculo de la vista con el borde amarillo.
- **Calculando / validando:** sello amarillo y el texto del cálculo en curso.
- **Fallo:** sello rojo con el motivo en una línea; el detalle completo sigue en el paso 4 (`#dFallo`).

## Movimiento

Solo el giro de los indicadores de cálculo y el flujo del grafo ROS 2, ya existentes; con `prefers-reduced-motion` se frenan
o paran.

## Voz y textos de interfaz

Tú, verbos de acción y la palabra exacta del estado («No empieza», no «Error»). Los textos largos de supuestos y fuentes se
mantienen: son la evidencia que el grupo tiene que poder defender.

## Accesibilidad

Objetivo WCAG 2.2 AA: contraste validado, foco visible (`--accent`), estado siempre con palabra, objetivos de al menos 24 px
(pasos de 44 px de alto, segmentados de 34 px). En la matriz, cada casilla lleva una marca visible (✓, !, ✗) y la palabra
del estado para lectores de pantalla; los puntos de los pasos llevan su estado en texto oculto (`.sr`). En la cinta, solo el
sello es región viva (`role="status"`): la cifra que cambia durante la demo no se anuncia.

## Elemento firma

La cinta del ciclo, abajo a la izquierda de la vista 3D. No se repite en otro sitio.

## Decisiones descartadas

- 2026-11-23 · Dirección B «Banco de ensayo» (árbol de la celda, inspector numérico y atajos): la más rápida para quien ya
  conoce el gemelo, pero explica poco para un grupo que lo abre de vez en cuando.
- 2026-11-23 · Dirección C «Parte de decisiones» como pantalla entera: vista 3D más pequeña y edición un nivel más abajo; se
  conserva solo su matriz cámara × tarea.
- 2026-11-23 · El raíl de pasos a la izquierda y la cinta del ciclo bajo la vista del prototipo A: cambiaban el tamaño del lienzo
  3D y obligaban a volver a medir en el portátil las huellas de `distorsion.test.mjs`; los pasos van arriba del panel y la
  cinta flota sobre la vista.
