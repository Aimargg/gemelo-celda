// Validadores de los ficheros de T2.3 (tests/collision-object.mjs y tests/scene-texto.mjs):
// aceptan una muestra válida escrita a mano y rechazan las muestras fijas de los criterios (T2.3-C1 y T2.3-C3), cada
// una con su motivo. Un validador que no rechaza nada no vale: cada muestra cambia una sola cosa de la válida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemasEscena } from '../collision-object.mjs';
import { problemasScene } from '../scene-texto.mjs';

// ---------- CollisionObject (T2.3-C1) ----------
const ESCENA = `objetos:
  - header: {frame_id: '203_base_link'}
    id: 'caja'
    pose:
      position: {'x': 0.100, 'y': -0.200, 'z': 0.050}
      orientation: {'x': 0.000000000, 'y': 0.000000000, 'z': 0.707106781, 'w': 0.707106781}
    primitives:
      - {type: 1, dimensions: [0.100, 0.100, 0.100]}
      - {type: 3, dimensions: [0.025, 0.080]}
      - {type: 2, dimensions: [0.032]}
    primitive_poses:
      - {position: {'x': 0.000, 'y': 0.000, 'z': 0.000}, orientation: {'x': 0.000000000, 'y': 0.000000000, 'z': 0.000000000, 'w': 1.000000000}}
      - {position: {'x': 0.000, 'y': 0.000, 'z': 0.063}, orientation: {'x': 0.000000000, 'y': 0.000000000, 'z': 0.000000000, 'w': 1.000000000}}
      - {position: {'x': 0.000, 'y': 0.000, 'z': 0.100}, orientation: {'x': 0.000000000, 'y': 0.000000000, 'z': 0.000000000, 'w': 1.000000000}}
`;
const cambia = (t, a, b) => { assert.ok(t.includes(a), `la muestra tiene «${a}»`); return t.replace(a, b); };
const rechaza = (problemas, re, que) => { assert.ok(problemas.some(p => re.test(p)), `${que}: ${JSON.stringify(problemas)}`); return problemas; };

test('T2.3-C1: el validador de CollisionObject acepta la muestra válida', () => {
  assert.deepEqual(problemasEscena(ESCENA, { frame: '203_base_link' }), []);
});

test('T2.3-C1: rechaza un campo inventado, un CYLINDER con 3 dimensiones, operation como entero y el id suelo', t => {
  const casos = [
    ['un campo inventado', cambia(ESCENA, "    id: 'caja'\n", "    id: 'caja'\n    color: [1.000, 0.000, 0.000]\n"), /el campo «color» no existe/],
    ['un CYLINDER con 3 dimensiones', cambia(ESCENA, '{type: 3, dimensions: [0.025, 0.080]}', '{type: 3, dimensions: [0.025, 0.080, 0.080]}'), /3 valores y el tipo 3 pide 2/],
    ['operation como entero', cambia(ESCENA, "    id: 'caja'\n", "    id: 'caja'\n    operation: 0\n"), /operation es un byte y aquí es el entero 0/],
    ['el id suelo', cambia(ESCENA, "id: 'caja'", "id: 'suelo'"), /el id suelo es el del ejemplo del profesor/],
  ];
  for (const [que, texto, re] of casos) t.diagnostic(`${que} → ${rechaza(problemasEscena(texto, { frame: '203_base_link' }), re, que).join(' | ')}`);
});

test('T2.3-C1: también rechaza un tipo 4, una dimensión 0, poses que no cuadran, un cuaternión sin normalizar, otro frame, un entero en un double, una «y» suelta e ids repetidos', () => {
  const f = { frame: '203_base_link' };
  rechaza(problemasEscena(cambia(ESCENA, '{type: 2, dimensions: [0.032]}', '{type: 4, dimensions: [0.032, 0.010]}'), f), /no es BOX \(1\), SPHERE \(2\) ni CYLINDER \(3\)/, 'CONE');
  rechaza(problemasEscena(cambia(ESCENA, '[0.032]', '[0.000]'), f), /no es > 0/, 'dimensión 0');
  rechaza(problemasEscena(ESCENA.split('\n').filter((l, i, a) => i !== a.length - 2).join('\n'), f), /3 primitives y 2 primitive_poses/, 'una pose menos');
  rechaza(problemasEscena(cambia(ESCENA, "'z': 0.707106781, 'w': 0.707106781", "'z': 0.707, 'w': 0.707"), f), /no normalizado/, 'cuaternión a 3 decimales');
  rechaza(problemasEscena(ESCENA, { frame: 'base_link' }), /debe ser «base_link»/, 'otro frame');
  rechaza(problemasEscena(cambia(ESCENA, "'x': 0.100, 'y': -0.200", "'x': 1, 'y': -0.200"), f), /double con punto decimal \(es «1»\)/, 'entero en un double');
  rechaza(problemasEscena(cambia(ESCENA, "{'x': 0.100, 'y': -0.200", "{'x': 0.100, y: -0.200"), f), /YAML 1\.1 y 1\.2 lo leen distinto/, 'una y sin comillas');
  const dos = ESCENA + ESCENA.split('\n').slice(1).join('\n');
  rechaza(problemasEscena(dos, f), /id repetido/, 'ids repetidos');
});

// ---------- .scene (T2.3-C3) ----------
const SCENE = ['gemelo_celda_811c9dc5', '* mesa', '-0.434 -0.269 0.000', '0.000000000 0.000000000 0.000000000 1.000000000', '2',
  'box', '1.180 0.830 0.760', '0.000 0.000 -0.381', '0.000000000 0.000000000 0.000000000 1.000000000', '0.300 0.300 0.320 1.000',
  'cylinder', '0.080 0.025', '0.000 0.000 0.013', '0.000000000 0.000000000 0.000000000 1.000000000', '0.960 0.950 0.930 1.000',
  '0', '* esfera', '0.100 0.200 0.300', '0.000000000 0.000000000 0.000000000 1.000000000', '1', 'sphere', '0.032', '0.000 0.000 0.000',
  '0.000000000 0.000000000 0.000000000 1.000000000', '0.080 0.080 0.090 1.000', '0', '.', ''].join('\n');

test('T2.3-C3: el validador de .scene acepta la muestra válida', () => {
  assert.deepEqual(problemasScene(SCENE), []);
});

test('T2.3-C3: rechaza un .scene sin «.» final, un número de formas que no cuadra, un tipo desconocido y un box con 2 dimensiones', t => {
  const casos = [
    ['sin «.» final', SCENE.replace('\n.\n', '\n'), /falta el «\.» final/],
    ['un número de formas que no cuadra (2 → 3)', cambia(SCENE, '\n2\nbox', '\n3\nbox'), /tipo de forma desconocido «0» \(forma 3 de 3 de «mesa»/],
    ['un número de formas que no cuadra (2 → 1)', cambia(SCENE, '\n2\nbox', '\n1\nbox'), /el número de subframes de «mesa», tras sus 1 formas/],
    ['un tipo desconocido', cambia(SCENE, '\nsphere\n', '\ncapsule\n'), /tipo de forma desconocido «capsule»/],
    ['un box con 2 dimensiones', cambia(SCENE, '\n1.180 0.830 0.760\n', '\n1.180 0.830\n'), /«1\.180 0\.830» debe ser las dimensiones de un box de «mesa» \(3 números\)/],
  ];
  for (const [que, texto, re] of casos) t.diagnostic(`${que} → ${rechaza(problemasScene(texto), re, que).join(' | ')}`);
});

test('T2.3-C3: también rechaza un color fuera de [0, 1], un cuaternión sin normalizar, un id repetido, texto tras el «.» y un nombre vacío', () => {
  rechaza(problemasScene(cambia(SCENE, '0.300 0.300 0.320 1.000', '76 60 42 1')), /fuera de \[0, 1\]/, 'color en 0–255');
  rechaza(problemasScene(cambia(SCENE, '-0.434 -0.269 0.000\n0.000000000 0.000000000 0.000000000 1.000000000', '-0.434 -0.269 0.000\n0.000 0.000 0.500 1.000')), /no está normalizado/, 'cuaternión');
  rechaza(problemasScene(cambia(SCENE, '* esfera', '* mesa')), /id «mesa» repetido/, 'id repetido');
  rechaza(problemasScene(SCENE + '* otra\n'), /texto después del «\.» final/, 'texto tras el punto');
  rechaza(problemasScene('\n' + SCENE.split('\n').slice(1).join('\n')), /falta el nombre de la escena/, 'sin nombre');
  rechaza(problemasScene(cambia(SCENE, '\n0.032\n', '\n0.032 0.010\n')), /sphere de «esfera» \(1 números\)/, 'sphere con 2 dimensiones');
});
