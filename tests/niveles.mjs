// Niveles del arnés e2e (T2.0, DT32): la única lista de qué fichero de tests/e2e/ va en cada nivel (el porqué, en
// tests/README.md). Cada fichero está en uno solo:
//   · tarea:  npm test y bash tools/check.sh, la red de cada tarea (< 15 min en el contenedor de 2 núcleos);
//   · puerta: solo en npm run test:puerta y bash tools/check.sh --puerta, que ejecutan los DOS niveles (todo).
// Uso: node tests/niveles.mjs tarea|puerta   → node --test con esos ficheros, uno tras otro (--test-concurrency=1: con 2
// núcleos y SwiftShader, dos páginas a la vez dan tiempos falsos y fallos por tiempo de espera).
// Un fichero nuevo de tests/e2e/ que no esté aquí hace fallar los dos niveles y tests/unit/niveles.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR_E2E = 'tests/e2e';

export const NIVELES = {
  tarea: [
    'tests/e2e/carga.test.mjs',             // los dos destinos y la red cerrada (D2, I2): primero, para fallar pronto
    'tests/e2e/balanceo-salida.test.mjs',   // T2.8 (DT30): la salida de la bandeja no la toca en ninguna fase de su balanceo
    'tests/e2e/captura.test.mjs',           // T4.6: captura sintética de 640 × 480 con anotaciones 2D (PNG y JSON), esquinas de ArUco en su sitio (C3), tiempos (C4), panel en los dos destinos (C5)
    'tests/e2e/datos.test.mjs',             // I7: posiciones.yaml y la tabla de fuentes byte a byte (T2.1), red de T2.2–T2.5
    'tests/e2e/deuda-f2.test.mjs',          // T2.7: zonas de plan en la demo y textos raros en posiciones.yaml (DT35), capa del otro robot (DT31) y #btnCalc (DT41)
    'tests/e2e/determinismo.test.mjs',      // I6 con «gemelo» (A, B, A'), sin reintento de semilla (D5) y el banco de ensayo
    'tests/e2e/escenas-claude.test.mjs',    // escenas en el almacén de claude.ai (D2)
    'tests/e2e/escenas-firestore.test.mjs', // I2: escenas con el simulacro de Firestore y sus reglas
    'tests/e2e/escenas-v8.test.mjs',        // I1: las tres escenas v8 de referencia
    'tests/e2e/exportar.test.mjs',          // I7: world ↔ base_link por robot, posiciones.yaml y sus correcciones
    'tests/e2e/interfaz.test.mjs',          // TU.1: remodelado de la interfaz: misma rejilla y lienzo, pasos numerados, cinta del ciclo (solo lee) y matriz cámara × tarea, en los dos destinos
    'tests/e2e/ilegibles.test.mjs',         // DT11 e I2: escenas ilegibles con las reglas de los dos almacenes
    'tests/e2e/layout.test.mjs',            // I1 e I2: campos v9, solo lectura y el límite de 50.000 caracteres
    'tests/e2e/matriz.test.mjs',            // I8: matriz «gemelo» de 8 casos en orden directo
    'tests/e2e/oclusion.test.mjs',          // T4.2: oclusión por el brazo a lo largo del plan: cifras del gemelo = cálculo aparte (C3), solo lee (C2), tapa y no tapa, converge y es editable (C4, C5), web
    'tests/e2e/perfil.test.mjs',            // I6 con «curso» (A, B, A') y el perfil de movimiento (T1.6)
    'tests/e2e/robot.test.mjs',             // I6 con el 203 y dibujo = colisión = TCP (T1.4)
    'tests/e2e/ros.test.mjs',               // I7: ficheros de ROS de T2.2–T2.5 con nominal, 203 y prefijo, en una página
    'tests/e2e/ros-referencias.test.mjs',   // I7: ficheros de ROS byte a byte (Común-C3), red de T2.3, T2.5 y T2.6
    'tests/e2e/ros-panel.test.mjs',         // T2.6: sección «Exportar a ROS», descargas y .tar byte a byte en los dos destinos (I7)
    'tests/e2e/sensor.test.mjs',            // modelo de sensor de la ELP (T1.7, D10)
    'tests/e2e/tareas.test.mjs',            // T4.1: panel por cámara con píxeles por tarea y umbrales con fuente
    'tests/e2e/usb.test.mjs',               // T4.3: estimador de ancho de banda USB y analizador de lsusb -v
  ],
  puerta: [
    'tests/e2e/cambio-robot.test.mjs',      // pregunta al cambiar de robot, campo del prefijo y correcciones 1 y 2 (> 60 s)
    'tests/e2e/distorsion.test.mjs',        // T4.5: distorsión Brown–Conrady opcional: apagada = igual (C3), píxel de un punto conocido = la fórmula (C4), panel en los dos destinos (C5) (> 60 s)
    'tests/e2e/determinismo-demo.test.mjs', // I6 a nivel de demo: matriz «gemelo» en orden inverso
    'tests/e2e/matriz-curso.test.mjs',      // matriz «curso» en orden directo e inverso (I6 con «curso» en la demo)
    'tests/e2e/partida.test.mjs',           // H3 y H4 de F1: tres demos y Guardar (> 60 s)
    'tests/e2e/revision-f1.test.mjs',       // H1 y H2 de la revisión de F1
    'tests/e2e/ros-recarga.test.mjs',       // Común-C1 tras recargar, con las trayectorias al día en las dos páginas (DT38)
    'tests/e2e/robot-avisos.test.mjs',      // aviso del 204 e «IK calibrada no converge» (T1.4)
    'tests/e2e/salida.test.mjs',            // salida de la bandeja sin contacto (T1.9)
    'tests/e2e/validar.test.mjs',           // Validar: barrido, búsqueda y porPerfil al guardar (T1.8, > 60 s)
    'tests/e2e/tablero.test.mjs',           // T4.4: diseñador del tablero de la bandeja, aviso de alineación y tablero_bandeja.yaml (> 60 s)
  ],
};

// Los ficheros de test e2e que hay en disco (relativos a la raíz, con /), recorriendo subcarpetas
export function ficherosE2E(raiz = RAIZ, dir = DIR_E2E) {
  const out = [];
  for (const e of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...ficherosE2E(raiz, rel)); else if (e.name.endsWith('.test.mjs')) out.push(rel);
  }
  return out.sort();
}

// Errores del reparto: un fichero en ningún nivel o en los dos, repetido en un nivel, o listado y sin existir en disco
export function erroresReparto(enDisco, niveles = NIVELES) {
  const err = [], nivelesDe = new Map();
  for (const [n, lista] of Object.entries(niveles)) for (const f of lista) {
    if (!nivelesDe.has(f)) nivelesDe.set(f, []);
    if (nivelesDe.get(f).includes(n)) err.push(`${f}: repetido en el nivel «${n}»`); else nivelesDe.get(f).push(n);
  }
  for (const f of enDisco) { const n = nivelesDe.get(f) || []; if (!n.length) err.push(`${f}: no está en ningún nivel`); else if (n.length > 1) err.push(`${f}: está en los dos niveles (${n.join(' y ')})`); }
  for (const f of nivelesDe.keys()) if (!enDisco.includes(f)) err.push(`${f}: está en un nivel y no existe`);
  return err;
}

// Ficheros que ejecuta cada nivel: «tarea», los suyos; «puerta», los de los dos (la unión, todos los tests)
export function ficherosDe(nivel, niveles = NIVELES) {
  if (nivel === 'tarea') return [...niveles.tarea];
  if (nivel === 'puerta') return [...niveles.tarea, ...niveles.puerta];
  throw new Error(`nivel desconocido «${nivel}»: usa tarea o puerta`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nivel = process.argv[2];
  const err = erroresReparto(ficherosE2E());
  if (err.length) { console.error(`Reparto de tests/e2e en niveles roto (tests/niveles.mjs):\n  ${err.join('\n  ')}`); process.exit(2); }
  let ficheros; try { ficheros = ficherosDe(nivel); } catch (e) { console.error(e.message); process.exit(2); }
  console.log(`== nivel «${nivel}»: ${ficheros.length} ficheros e2e`);
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=spec', '--test-concurrency=1', ...ficheros], { cwd: RAIZ, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
