// Unitario del validador de parámetros de ROS 2 (tests/rcl-params.mjs, T2.2-C1): acepta un fichero que cumple las reglas
// de rcl_yaml_param_parser y rechaza cada muestra que las rompe, cada una por su motivo. Las muestras son fijas y no salen
// del gemelo: así el validador no se prueba con el mismo código que genera los ficheros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemasParams } from '../rcl-params.mjs';

const ENTEROS = { enteros: ['celda.marcadores.ids'] };
const raiz = cuerpo => `/**:\n  ros__parameters:\n${cuerpo}`;
// Bueno: bool, double, string entre comillas, arrays homogéneos, enteros donde se esperan y la clave «y» entre comillas
const BUENO = raiz(`    celda:
      activo: true  # comentario
      mesa:
        xyz: [0.497, -0.117, 0.000]
        yaw: 2.356
        frame_id: 'mesa'
      marcadores:
        ids: [4, 5]
      nombres: ['cenital', 'entrega']
      translation:
        'x': 0.1
        'y': -0.2
`);

test('un fichero que cumple las reglas de rcl no da ningún problema', () => {
  assert.deepEqual(problemasParams(BUENO, ENTEROS), []);
});

// Muestras que deben fallar: [nombre, texto, patrón del motivo esperado]
const MALAS = [
  ['lista de mapas', raiz('    celda:\n      marcadores:\n        - {id: 4, x: 0.1}\n        - {id: 5, x: 0.2}\n'), /celda\.marcadores\[0\]: lista de mapas/],
  ['[1, 2.0]', raiz('    celda:\n      xyz: [1, 2.0]\n'), /celda\.xyz: array con tipos mezclados \(entero y double\)/],
  ['un 203 sin comillas', raiz('    celda:\n      robot_id: 203\n'), /celda\.robot_id: entero donde no se espera/],
  ['un yes', raiz('    celda:\n      sobre_caja: yes\n'), /YAML 1\.1 y 1\.2 lo leen distinto: \/\*\*\.ros__parameters\.celda\.sobre_caja: true en YAML 1\.1 y "yes" en YAML 1\.2/],
  ['una clave y sin comillas', raiz('    translation:\n      x: 0.1\n      y: 0.2\n'), /YAML 1\.1 y 1\.2 lo leen distinto: .*translation\.(true|y)/],
  ['un string sin comillas', raiz('    modo: 1920x1080\n'), /modo: string sin comillas «1920x1080»/],
  ['un 0 sin punto donde va un double', raiz('    xyz: [0, 0, 0]\n'), /xyz: entero donde no se espera/],
  ['un 0755', raiz('    permisos: 0755\n'), /YAML 1\.1 y 1\.2 lo leen distinto/],
  ['un array vacío', raiz('    ids: []\n'), /ids: array vacío/],
  ['un null', raiz('    frame_id:\n'), /frame_id: valor vacío o null/],
  ['sin ros__parameters', '/**:\n  celda:\n    a: 1.0\n', /\/\*\*: debe tener solo ros__parameters/],
  ['un ancla y su alias', raiz('    a: &v 1.0\n    b: *v\n'), /a: ancla &v[\s\S]*b: alias/],
];

for (const [nombre, texto, motivo] of MALAS) {
  test(`rechaza ${nombre}`, t => {
    const p = problemasParams(texto, ENTEROS);
    t.diagnostic(`${nombre} → ${p.join(' | ')}`);
    assert.ok(p.length > 0, `${nombre}: debía fallar`);
    assert.match(p.join('\n'), motivo);
  });
}
