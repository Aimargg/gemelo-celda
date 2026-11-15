Scripts de prueba sueltos de las versiones v4–v8 (Playwright + SwiftShader). No son una suite: sirven de referencia para T0.2.
- shot2.js: patrón de arranque (servidor local, three servido desde node_modules interceptando jsDelivr, fuentes bloqueadas, ?prueba).
- e_matriz3.js: matriz de ensayos de la demo (M0/M1, balanceo, velocidad) con window.__g.ensayo.
- test_kin.js: ida y vuelta de la IK analítica (node, require('../../src/kin.js')).
- e_fs1.js, e_fs2.js: escenas con Firestore simulado (firebase-mock.js). e_c1.js: escenas con el almacén de claude.ai (mock_claude.html).
Se borran al cerrar la fase 1 (deuda DT3).
