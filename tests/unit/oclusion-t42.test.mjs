// Unitario de la oclusión por el brazo a lo largo del plan (src/oclusion.js, sin navegador; T4.2): la postura en el tiempo (la
// interpolación de ejecutar()), el muestreo por tiempo (n = ⌈T / paso⌉, pesos que suman T), el segmento de la cámara al
// objetivo contra una esfera (corta, roza, detrás del objetivo o de la cámara, dentro del margen), un caso con el porcentaje
// calculado a mano en el que el brazo tapa solo en una parte del recorrido, otro en el que no tapa nunca, los bordes, el
// catálogo (todo SUPUESTO [SIN VALIDAR], ninguna cita) y la configuración editable. Las cifras salen de aritmética a mano con
// números que se representan exactamente; el brazo del cálculo es una esfera de mentira cuyo centro depende de la primera
// articulación, así que no hace falta el robot ni three.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const OCLUSION = require('../../src/oclusion.js');
const cerca = (a, b, tol, que) => assert.ok(Math.abs(a - b) <= tol, `${que}: ${a} frente a ${b} (±${tol})`);
const q6 = (a = 0, b = 0) => [a, b, 0, 0, 0, 0];

test('postura en el tiempo: extremos, mitad, un cuarto, tramo de un solo punto, duración cero y punto repetido', () => {
  // ruta de dos puntos, recorrido total S = 2 y duración T = 4; el perfil suave smooth(s) = s²(3 − 2s)
  const A = { ruta: [q6(0, 0), q6(1, 2)], acum: [0, 2], S: 2, T: 4 };
  assert.deepEqual(OCLUSION.postura(A, 0), q6(0, 0), 'en t = 0, el primer punto');
  assert.deepEqual(OCLUSION.postura(A, 4), q6(1, 2), 'en t = T, el último');
  assert.deepEqual(OCLUSION.postura(A, 2), q6(0.5, 1), 'a mitad de tiempo: smooth(0,5) = 0,5');
  // t = 1: s = 0,25, smooth = 0,0625 × 2,5 = 0,15625, y la postura es 0,15625 del camino
  assert.deepEqual(OCLUSION.postura(A, 1), q6(0.15625, 0.3125));
  assert.deepEqual(OCLUSION.postura(A, 3), q6(0.84375, 1.6875), 'simétrica: 1 − 0,15625 = 0,84375');
  assert.deepEqual(OCLUSION.postura(A, -5), q6(0, 0), 'antes del inicio: se recorta');
  assert.deepEqual(OCLUSION.postura(A, 99), q6(1, 2), 'después del final: se recorta');
  assert.equal(OCLUSION.smooth(0), 0); assert.equal(OCLUSION.smooth(1), 1); assert.equal(OCLUSION.smooth(0.5), 0.5);
  // tres puntos con recorrido 1 y 3 (acum 0, 1, 4; S = 4): a mitad de tiempo u = 2, un tercio del segundo tramo
  const B = { ruta: [q6(0, 0), q6(1, 0), q6(1, 3)], acum: [0, 1, 4], S: 4, T: 8 };
  const m = OCLUSION.postura(B, 4); cerca(m[0], 1, 1e-12, 'x'); cerca(m[1], 1, 1e-12, 'y: 0 + 3 × (1/3)');
  assert.deepEqual(OCLUSION.postura(B, 0), q6(0, 0)); assert.deepEqual(OCLUSION.postura(B, 8), q6(1, 3));
  // un solo punto: siempre ese; duración cero: ya está en el final; punto repetido (acum sin avance): no divide por cero
  const U = { ruta: [[1, 2, 3, 4, 5, 6]], acum: [0], S: 0, T: 3 };
  assert.deepEqual(OCLUSION.postura(U, 1.5), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(OCLUSION.postura({ ruta: [q6(0, 0), q6(7, 8)], acum: [0, 1], S: 1, T: 0 }, 0), q6(7, 8), 'duración cero');
  const R = { ruta: [q6(0, 0), q6(0, 0), q6(2, 0)], acum: [0, 0, 2], S: 2, T: 2 };
  assert.deepEqual(OCLUSION.postura(R, 0), q6(0, 0)); assert.deepEqual(OCLUSION.postura(R, 2), q6(2, 0));
  // devuelve copias: tocar el resultado no cambia la ruta
  const c = OCLUSION.postura(A, 0); c[0] = 99; assert.equal(A.ruta[0][0], 0); const u = OCLUSION.postura(U, 0); u[0] = 99; assert.equal(U.ruta[0][0], 1);
});

test('muestreo: n = ⌈T / paso⌉ por tramo, punto medio de cada intervalo, pesos T / n que suman T, determinista', () => {
  const tramos = [{ T: 1 }, { T: 0.35 }, { T: 0 }];
  const m = OCLUSION.muestrear(tramos, 0.1);
  assert.equal(m.length, 14, '10 muestras (1 / 0,1) + 4 (⌈3,5⌉) + 0');
  const de = i => m.filter(x => x.tramo === i);
  assert.equal(de(0).length, 10); assert.equal(de(1).length, 4); assert.equal(de(2).length, 0, 'sin duración, sin muestras');
  cerca(de(0)[0].t, 0.05, 1e-12, 'primera muestra: el punto medio de [0, 0,1]'); cerca(de(0)[9].t, 0.95, 1e-12, 'última del primero');
  cerca(de(1)[0].t, 0.04375, 1e-12, 'T 0,35 en 4: intervalos de 0,0875, punto medio a 0,04375'); cerca(de(1)[3].t, 0.30625, 1e-12, 'y 3,5 intervalos: 0,30625');
  for (const x of de(0)) cerca(x.peso, 0.1, 1e-12, 'peso del primer tramo'); for (const x of de(1)) cerca(x.peso, 0.0875, 1e-12, 'peso del segundo');
  cerca(de(0).reduce((s, x) => s + x.peso, 0), 1, 1e-12, 'los pesos del primer tramo suman T'); cerca(de(1).reduce((s, x) => s + x.peso, 0), 0.35, 1e-12, 'los del segundo, 0,35');
  assert.deepEqual(de(0).map(x => x.k), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); assert.deepEqual(m.map(x => x.tramo), [...Array(10).fill(0), ...Array(4).fill(1)], 'en el orden del ciclo');
  assert.deepEqual(OCLUSION.muestrear(tramos, 0.1), m, 'determinista: sin azar ni reloj');
  // el error de redondeo no añade una muestra: 0,3 / 0,1 = 2,9999999999999996 y 0,1 × 3 / 0,1 = 3,0000000000000004
  assert.equal(OCLUSION.muestrear([{ T: 0.3 }], 0.1).length, 3); assert.equal(OCLUSION.muestrear([{ T: 0.1 * 3 }], 0.1).length, 3); assert.equal(OCLUSION.muestrear([{ T: 0.7 }], 0.1).length, 7);
  assert.equal(OCLUSION.muestrear([{ T: 0.31 }], 0.1).length, 4, 'pero 3,1 intervalos son 4');
  assert.equal(OCLUSION.muestrear([{ T: 0.05 }], 0.1).length, 1, 'un tramo corto da una muestra, de peso T');
  assert.equal(OCLUSION.muestrear([], 0.1).length, 0, 'sin tramos, sin muestras');
  // con la mitad del paso hay el doble de muestras
  assert.equal(OCLUSION.muestrear([{ T: 1 }], 0.05).length, 20);
  for (const malo of [0, -0.1, NaN, Infinity, '0.1', null, undefined]) assert.throws(() => OCLUSION.muestrear([{ T: 1 }], malo), /número positivo/, `paso ${String(malo)}`);
  assert.throws(() => OCLUSION.muestrear([{ T: 1000 }], 0.1), /10000 muestras.*el máximo son 5000/, 'cálculo acotado');
  assert.equal(OCLUSION.muestrear([{ T: 500 }], 0.1).length, 5000, 'justo en el máximo, sí');
});

test('segmento de la cámara al objetivo contra una esfera: corta, roza, detrás del objetivo o de la cámara, dentro del margen', () => {
  // cámara en el origen, objetivo a 8 m y margen de 4: el segmento va de x = 0 a x = 4 (u = (4, 0, 0), l2 = 16; k = 0,5 exacto)
  const s = OCLUSION.segmento([0, 0, 0], [8, 0, 0], 4);
  assert.deepEqual([s.ux, s.uy, s.uz, s.l2], [4, 0, 0, 16]);
  const corta = (x, y, z, r) => OCLUSION.cortaEsfera(s, x, y, z, r);
  assert.equal(corta(2, 0, 0, 1), true, 'una esfera en medio, centrada en el rayo');
  assert.equal(corta(2, 1, 0, 1.25), true, 'a 1 del rayo con radio 1,25: corta');
  assert.equal(corta(2, 1, 0, 1), false, 'a 1 del rayo con radio 1: roza (distancia = radio) y no tapa');
  assert.equal(corta(2, 2, 0, 1), false, 'a 2 del rayo: no');
  assert.equal(corta(2, 0, 1.25, 1), false, 'a 1,25 en z: no'); assert.equal(corta(2, 0, 0.5, 1), true, 'a 0,5 en z: sí');
  // detrás de la cámara (x < 0): solo tapa si su volumen llega a la cámara
  assert.equal(corta(-3, 0, 0, 1), false, 'detrás de la cámara y lejos');
  assert.equal(corta(-1, 0, 0, 1), false, 'detrás de la cámara, rozándola');
  assert.equal(corta(-0.5, 0, 0, 1), true, 'la cámara dentro de la esfera: tapada');
  // detrás del final del segmento (x > 4): el recorte de los extremos
  assert.equal(corta(7, 0, 0, 1), false, 'entre el final del segmento y el objetivo: a 3 del segmento');
  assert.equal(corta(5, 0, 0, 1), false, 'a 1 del final del segmento, radio 1: roza');
  assert.equal(corta(5, 0, 0, 1.5), true, 'a 1 del final del segmento, radio 1,5: lo alcanza');
  assert.equal(corta(12, 0, 0, 1), false, 'detrás del objetivo');
  // dentro del margen: una esfera sobre el objetivo (el dedo de la pinza, p. ej.) no tapa si no llega al final del segmento
  assert.equal(corta(8, 0, 0, 3), false, 'centrada en el objetivo con radio 3 < margen 4'); assert.equal(corta(8, 0, 0, 4), false, 'radio = margen: roza');
  assert.equal(corta(8, 0, 0, 4.5), true, 'radio mayor que el margen: llega al segmento');
  // sin margen suficiente no hay segmento: la cámara a menos del margen del punto (o justo a él) nunca queda tapada
  assert.equal(OCLUSION.segmento([0, 0, 0], [8, 0, 0], 8), null); assert.equal(OCLUSION.segmento([0, 0, 0], [8, 0, 0], 9), null); assert.equal(OCLUSION.segmento([1, 1, 1], [1, 1, 1], 0.5), null);
  // oblicuo (3-4-5): cámara en el origen y objetivo en (0, 6, 8) a 10; margen 5 deja u = (0, 3, 4), l2 = 25
  const o = OCLUSION.segmento([0, 0, 0], [0, 6, 8], 5); assert.deepEqual([o.ux, o.uy, o.uz, o.l2], [0, 3, 4, 25]);
  assert.equal(OCLUSION.cortaEsfera(o, 0, 1.5, 2, 0.5), true, 'en medio del segmento'); assert.equal(OCLUSION.cortaEsfera(o, 3, 1.5, 2, 3), false, 'a 3 del segmento con radio 3: roza');
  assert.equal(OCLUSION.cortaEsfera(o, 3, 1.5, 2, 3.5), true, 'con radio 3,5, corta');
  // la cámara no está en el origen: el mismo caso desplazado
  const d = OCLUSION.segmento([1, 1, 1], [9, 1, 1], 4); assert.deepEqual([d.ux, d.uy, d.uz, d.l2], [4, 0, 0, 16]);
  assert.equal(OCLUSION.cortaEsfera(d, 3, 1, 1, 1), true); assert.equal(OCLUSION.cortaEsfera(d, 3, 2, 1, 1), false, 'roza');
  // varias esferas: solo cuentan las n primeras
  const X = Float64Array.of(2, 5, 0, 1, 2, 0, 0, 1, 2, 0, 0, 1); // la 1.ª lejos, la 2.ª y la 3.ª en el rayo
  assert.equal(OCLUSION.tocaSegmento(s, X, 1), false); assert.equal(OCLUSION.tocaSegmento(s, X, 2), true); assert.equal(OCLUSION.tocaSegmento(s, X, 3), true); assert.equal(OCLUSION.tocaSegmento(s, X, 0), false);
});

// Un brazo de mentira: una esfera de radio R cuyo centro está en x = 10 × q[0] − 5 (y = z = 0); la cámara en (0, −10, 0) mira hacia +y
const brazo = R => { const llamadas = []; const colocar = (q, w, carga) => { llamadas.push([q[0], w, carga]); return { X: Float64Array.of(10 * q[0] - 5, 0, 0, R, 99, 99, 99, 1), n: 1 }; }; return { colocar, llamadas }; };
const CAM = { id: 'c', o: [0, -10, 0], objetivos: [] };
const TRAMO_A = { id: 'a', ruta: [q6(0), q6(1)], acum: [0, 1], S: 1, T: 1, w: 0.03, carga: null };

test('porcentaje calculado a mano: el brazo tapa solo en una parte del recorrido (un punto, dos puntos, todo y algún punto)', () => {
  // T = 1 y paso 0,25: 4 muestras a t = 0,125, 0,375, 0,625 y 0,875, de peso 0,25, con smooth(t) = 0,04296875, 0,31640625, 0,68359375 y
  // 0,95703125 (0,015625 × 2,75, 0,140625 × 2,25, 0,390625 × 1,75 y 0,765625 × 1,25). El centro de la esfera, 10 × q − 5, queda en
  // x = −4,5703125, −1,8359375, 1,8359375 y 4,5703125; el rayo de (0, −10, 0) a (0, 10, 0) va por x = 0 y el radio es 2:
  // tapan la 2.ª y la 3.ª (|x| = 1,836 < 2) y no la 1.ª ni la 4.ª (4,57 > 2): 2 de 4 = 50 % de todo y de algún punto
  const { colocar, llamadas } = brazo(2);
  const r = OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: 0.5, colocar, camaras: [{ ...CAM, objetivos: [{ id: 'uno', puntos: [[0, 10, 0]] }] }] });
  assert.equal(r.muestras, 4); cerca(r.T, 1, 1e-12, 'T');
  const o = r.camaras[0].objetivos[0]; assert.equal(o.id, 'uno'); assert.equal(o.nPuntos, 1);
  cerca(o.todo, 50, 1e-9, 'todo tapado'); cerca(o.alguno, 50, 1e-9, 'algún punto'); cerca(o.racha, 0.5, 1e-12, 'racha: dos muestras seguidas de 0,25 s');
  // la postura de cada muestra y lo que recibe colocar (apertura y carga del tramo)
  assert.equal(llamadas.length, 4); [0.04296875, 0.31640625, 0.68359375, 0.95703125].forEach((v, i) => { cerca(llamadas[i][0], v, 1e-12, `q de la muestra ${i}`); assert.equal(llamadas[i][1], 0.03); assert.equal(llamadas[i][2], null); });
  // dos puntos: P1 = (0, 10, 0) y P2 = (6, 10, 0). La distancia del centro (x, 0, 0) al rayo de (0, −10, 0) a P2 es |20x − 60| / √436 (√436 =
  // 20,88): 7,25, 4,63, 1,12 y 1,50 en las cuatro muestras, así que P2 queda tapado en la 3.ª y la 4.ª (menos de 2) y P1 en la 2.ª y la
  // 3.ª. Tapados 0, 1, 2 y 1 de 2 puntos: todo tapado solo en la 3.ª (25 %, racha 0,25 s) y algún punto en la 2.ª, la 3.ª y la 4.ª (75 %)
  const dos = OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: 0.5, colocar: brazo(2).colocar, camaras: [{ ...CAM, objetivos: [{ id: 'dos', puntos: [[0, 10, 0], [6, 10, 0]] }] }] }).camaras[0].objetivos[0];
  assert.equal(dos.nPuntos, 2); cerca(dos.todo, 25, 1e-9, 'todo tapado'); cerca(dos.alguno, 75, 1e-9, 'algún punto'); cerca(dos.racha, 0.25, 1e-12, 'racha');
  // el 0 %: con radio 0,5 el centro nunca baja de 1,836 del rayo
  const libre = OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: 0.5, colocar: brazo(0.5).colocar, camaras: [{ ...CAM, objetivos: [{ id: 'uno', puntos: [[0, 10, 0]] }] }] }).camaras[0].objetivos[0];
  assert.deepEqual([libre.todo, libre.alguno, libre.racha], [0, 0, 0], 'el brazo no tapa nunca: 0 %, y no «sin número»');
  // y con radio 5 tapa siempre (4,57 < 5): 100 % y la racha es todo el tramo
  const todo = OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: 0.5, colocar: brazo(5).colocar, camaras: [{ ...CAM, objetivos: [{ id: 'uno', puntos: [[0, 10, 0]] }] }] }).camaras[0].objetivos[0];
  cerca(todo.todo, 100, 1e-9, 'siempre tapado'); cerca(todo.racha, 1, 1e-12, 'racha = T');
});

test('porcentaje por tiempo, no por número de muestras, y la racha cruza de un tramo al siguiente', () => {
  // un segundo tramo de 0,5 s con la postura quieta en q[0] = 0,5 (x = 0: justo en el rayo), 2 muestras de 0,25 s
  const B = { id: 'b', ruta: [q6(0.5)], acum: [0], S: 0, T: 0.5, w: 0.006, carga: Float64Array.of(1, 2, 3, 0.1) };
  const dos = R => { const b = brazo(R); return { b, r: OCLUSION.calcular({ tramos: [TRAMO_A, B], paso: 0.25, margen: 0.5, colocar: b.colocar, camaras: [{ ...CAM, objetivos: [{ id: 'uno', puntos: [[0, 10, 0]] }] }] }) }; };
  // radio 2: A tapa en 2 de 4 muestras (0,5 s) y B en las 2 (0,5 s): 1 de 1,5 s = 66,67 %; la 4.ª de A está libre: dos rachas de 0,5 s
  const { b, r } = dos(2), o = r.camaras[0].objetivos[0];
  assert.equal(r.muestras, 6); cerca(r.T, 1.5, 1e-12, 'T'); cerca(o.todo, 100 * 2 / 3, 1e-9, '1 de 1,5 s'); cerca(o.alguno, 100 * 2 / 3, 1e-9, 'algún punto'); cerca(o.racha, 0.5, 1e-12, 'dos rachas de 0,5');
  assert.deepEqual(b.llamadas.map(l => l[1]), [0.03, 0.03, 0.03, 0.03, 0.006, 0.006], 'cada muestra usa la apertura de su tramo'); assert.equal(b.llamadas[3][2], null); assert.deepEqual([...b.llamadas[4][2]], [1, 2, 3, 0.1], 'y su carga');
  // radio 5: A tapa en las 4 y B en las 2: 100 % y una sola racha de 1,5 s que pasa de un tramo al otro
  const t = dos(5).r.camaras[0].objetivos[0]; cerca(t.todo, 100, 1e-9, 'siempre'); cerca(t.racha, 1.5, 1e-12, 'racha de A y B seguidas');
});

test('varias cámaras y objetivos a la vez, y los bordes: sin muestras, sin puntos, fuera de campo, un punto, cámara pegada al objetivo', () => {
  const colocar = brazo(2).colocar;
  const camaras = [
    { id: 'uno', o: [0, -10, 0], objetivos: [{ id: 'enMedio', puntos: [[0, 10, 0]] }, { id: 'fuera', puntos: [] }, { id: 'pegado', puntos: [[0, -9.8, 0]] }] },
    { id: 'dos', o: [0, 10, 0], objetivos: [{ id: 'alReves', puntos: [[0, -10, 0]] }, { id: 'lejos', puntos: [[40, 0, 0]] }] },
  ];
  const r = OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: 0.5, colocar, camaras });
  const [c1, c2] = r.camaras; assert.deepEqual(r.camaras.map(c => c.id), ['uno', 'dos']);
  cerca(c1.objetivos[0].todo, 50, 1e-9, 'objetivo en medio');
  assert.deepEqual(c1.objetivos[1], { id: 'fuera', nPuntos: 0, todo: null, alguno: null, racha: null }, 'sin puntos en el campo: sin número, no 0 %');
  assert.deepEqual([c1.objetivos[2].todo, c1.objetivos[2].alguno], [0, 0], 'la cámara a menos del margen del punto: sin segmento, nada se interpone');
  cerca(c2.objetivos[0].todo, 50, 1e-9, 'el mismo rayo al revés tapa igual'); assert.deepEqual([c2.objetivos[1].todo, c2.objetivos[1].alguno], [0, 0], 'un punto lejos de la esfera');
  // sin tramos: ninguna muestra y ningún número
  const vacio = OCLUSION.calcular({ tramos: [], paso: 0.1, margen: 0.02, colocar, camaras });
  assert.equal(vacio.muestras, 0); assert.equal(vacio.T, 0); assert.ok(vacio.camaras.every(c => c.objetivos.every(o => o.todo === null && o.alguno === null && o.racha === null)), 'sin muestras no hay porcentaje');
  // sin cámaras, sin nada que calcular
  assert.deepEqual(OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: 0.5, colocar, camaras: [] }).camaras, []);
  // el margen y el paso mal puestos se rechazan antes de calcular
  for (const m of [0, -1, NaN, '0.5', undefined]) assert.throws(() => OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0.25, margen: m, colocar, camaras }), /número positivo/);
  assert.throws(() => OCLUSION.calcular({ tramos: [TRAMO_A], paso: 0, margen: 0.5, colocar, camaras }), /número positivo/);
  // sumar y resumen a mano: pesos 0,5 con k de n = 2 tapados: [2, 2, 1, 2, 0] → todo 1,5 de 2,5 s = 60 %, algún punto 2 de 2,5 = 80 %, racha 1
  const a = OCLUSION.nuevo(); for (const k of [2, 2, 1, 2, 0]) OCLUSION.sumar(a, 0.5, k, 2);
  const e = OCLUSION.resumen(a, 2); cerca(e.todo, 60, 1e-9, 'todo'); cerca(e.alguno, 80, 1e-9, 'algún punto'); cerca(e.racha, 1, 1e-12, 'racha'); assert.equal(e.nPuntos, 2);
  assert.deepEqual(OCLUSION.resumen(OCLUSION.nuevo(), 2), { nPuntos: 2, todo: null, alguno: null, racha: null }, 'sin muestras');
  assert.deepEqual(OCLUSION.resumen(a, 0), { nPuntos: 0, todo: null, alguno: null, racha: null }, 'sin puntos');
});

test('el catálogo es todo SUPUESTO [SIN VALIDAR] y sin citas inventadas; la configuración se edita y rechaza lo que no es un número positivo', () => {
  assert.deepEqual(OCLUSION.PARAMS.map(p => p.id), ['muestreo.paso', 'rayo.margenMm']);
  for (const p of OCLUSION.PARAMS) {
    assert.equal(p.origen, 'SUPUESTO', p.id); assert.equal(p.editable, true, p.id); assert.match(p.fuente, /SUPUESTO \[SIN VALIDAR\]/, p.id);
    assert.doesNotMatch(p.fuente, /et al\.|doi\.org|arXiv|\bISO \d|\bIEEE\b|\((19|20)\d\d\)/, `${p.id}: una cita no comprobada`);
  }
  const c = OCLUSION.cfgDefecto(); assert.deepEqual(c, { muestreo: { paso: 0.1 }, rayo: { margenMm: 20 } }, 'paso de 0,1 s y margen de 20 mm, los de la ficha');
  c.muestreo.paso = 5; assert.equal(OCLUSION.cfgDefecto().muestreo.paso, 0.1, 'cada llamada da una copia');
  const n = OCLUSION.fijar(OCLUSION.cfgDefecto(), 'muestreo.paso', 0.05); assert.deepEqual(n, { muestreo: { paso: 0.05 }, rayo: { margenMm: 20 } });
  const base = OCLUSION.cfgDefecto(), m = OCLUSION.fijar(base, 'rayo.margenMm', 40); assert.equal(base.rayo.margenMm, 20, 'fijar no cambia la original'); assert.equal(m.rayo.margenMm, 40);
  for (const id of ['muestreo.paso', 'rayo.margenMm']) for (const malo of [0, -1, NaN, Infinity, -Infinity, '5', null, undefined, true, [1]]) assert.throws(() => OCLUSION.fijar(base, id, malo), /número positivo/, `${id} = ${String(malo)}`);
  assert.throws(() => OCLUSION.fijar(base, 'muestreo.nada', 1), /parámetro desconocido/); assert.throws(() => OCLUSION.fijar(base, 'x', 1), /parámetro desconocido/);
  // rangos: un paso menor de 0,01 s o mayor de 2 s y un margen mayor de 500 mm no se aplican; los bordes, sí
  for (const [id, v] of [['muestreo.paso', 0.005], ['muestreo.paso', 3], ['rayo.margenMm', 600]]) assert.throws(() => OCLUSION.fijar(base, id, v), /no está entre/, `${id} = ${v}`);
  assert.equal(OCLUSION.fijar(base, 'muestreo.paso', 0.01).muestreo.paso, 0.01); assert.equal(OCLUSION.fijar(base, 'muestreo.paso', 2).muestreo.paso, 2);
  assert.equal(OCLUSION.fijar(base, 'rayo.margenMm', 0.001).rayo.margenMm, 0.001); assert.equal(OCLUSION.fijar(base, 'rayo.margenMm', 500).rayo.margenMm, 500);
  // la nota del panel dice qué tramos entran y qué no
  const nota = OCLUSION.nota(['acercar', 'levantar', 'llevar']); assert.match(nota, /acercarse al borde del plato/); assert.match(nota, /llevarlo nivelado a la bandeja/); assert.match(nota, /No entran: el movimiento articular desde el reposo, la fruta, el servo/);
  assert.doesNotMatch(nota, /salir de la bandeja/, 'solo los que entran');
});
