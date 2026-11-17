// Unitario del formateador del .tar (EXPORTAR.tar, src/exportar.js; T2.6-C3, decisión 2 de su brief): cargado en un
// contexto vm vacío (sin TextEncoder, Buffer, DOM ni globales del gemelo). La cabecera se comprueba campo a campo con el
// formato ustar (POSIX.1-1988) escrito aquí, y el paquete entero con el tar del sistema (tests/tar-sistema.mjs), la
// referencia ajena al gemelo: lo lista, lo extrae byte a byte y rechaza una suma de control alterada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { tar as tarSistema, esGnu, conTar, extraer, lineaTv } from '../tar-sistema.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'src/exportar.js'), 'utf8');
const EXPORTAR = (() => { const m = { exports: null }; vm.runInNewContext(FUENTE, { module: m }); return m.exports; })();
const bytes = u8 => Buffer.from(u8.buffer, u8.byteOffset, u8.length); // el Uint8Array es de otro reino (el contexto vm)
const tar = (...a) => bytes(EXPORTAR.tar(...a));

// Campos de la cabecera ustar de 512 bytes en `off` (el formato, no el código que la escribe)
const ascii = (b, off, n) => { const s = b.subarray(off, off + n); const i = s.indexOf(0); return s.subarray(0, i < 0 ? n : i).toString('latin1'); };
function cabecera(b, off = 0) {
  const h = b.subarray(off, off + 512), suma = h.reduce((s, v, i) => s + (i >= 148 && i < 156 ? 0x20 : v), 0);
  return {
    name: h.subarray(0, 100).subarray(0, h.subarray(0, 100).indexOf(0) < 0 ? 100 : h.subarray(0, 100).indexOf(0)).toString('utf8'),
    mode: ascii(h, 100, 8), uid: ascii(h, 108, 8), gid: ascii(h, 116, 8), size: ascii(h, 124, 12), mtime: ascii(h, 136, 12),
    chksum: h.subarray(148, 156).toString('latin1'), tipo: String.fromCharCode(h[156]), linkname: ascii(h, 157, 100),
    magic: h.subarray(257, 263).toString('latin1'), version: h.subarray(263, 265).toString('latin1'), uname: ascii(h, 265, 32), gname: ascii(h, 297, 32),
    resto: [...h.subarray(329, 512)].every(v => v === 0), suma,
  };
}
// Entradas de un .tar recorriendo sus cabeceras: { off, ...cabecera, datos }
function entradas(b) {
  const out = []; let off = 0;
  while (off + 512 <= b.length && b.subarray(off, off + 512).some(v => v)) {
    const c = cabecera(b, off), n = parseInt(c.size, 8); out.push({ off, ...c, datos: b.subarray(off + 512, off + 512 + n) });
    off += 512 + Math.ceil(n / 512) * 512;
  }
  return { entradas: out, fin: off };
}
const TEXTOS = [{ nombre: 'a.yaml', texto: 'hola: 1\n' }, { nombre: 'tf/b.yaml', texto: "frame_id: 'mesa'  # ñ → · €\n" }, { nombre: 'x.sh', texto: '#!/bin/bash\nwait\n' }];

test('T2.6-C3: cabecera ustar: suma de control, magic «ustar\\0» con versión «00», tamaño en octal, mtime 0, uid y gid 0, usuario y grupo vacíos', () => {
  const b = tar(TEXTOS, 'celda_ros'), { entradas: E, fin } = entradas(b);
  assert.deepEqual(E.map(e => [e.name, e.tipo, e.mode]), [
    ['celda_ros/', '5', '0000755'], ['celda_ros/a.yaml', '0', '0000644'], ['celda_ros/tf/', '5', '0000755'],
    ['celda_ros/tf/b.yaml', '0', '0000644'], ['celda_ros/x.sh', '0', '0000755'],
  ]);
  for (const e of E) {
    assert.match(e.chksum, /^[0-7]{6}\0 $/, `${e.name}: chksum en 6 cifras octales, NUL y espacio`);
    assert.equal(parseInt(e.chksum, 8), e.suma, `${e.name}: la suma de control es la de los 512 bytes con su campo en espacios`);
    assert.equal(e.magic, 'ustar\0'); assert.equal(e.version, '00');
    assert.match(e.size, /^[0-7]{11}$/); assert.equal(parseInt(e.size, 8), e.datos.length);
    assert.deepEqual([e.uid, e.gid, e.mtime, e.uname, e.gname, e.linkname], ['0000000', '0000000', '00000000000', '', '', '']);
    assert.ok(e.resto, `${e.name}: devmajor, devminor y prefix vacíos`);
  }
  // el texto en UTF-8 (el tamaño es el de los bytes, no el de los caracteres) y los dos bloques de ceros al final
  assert.equal(parseInt(E[3].size, 8), Buffer.byteLength(TEXTOS[1].texto, 'utf8')); assert.notEqual(Buffer.byteLength(TEXTOS[1].texto), TEXTOS[1].texto.length);
  assert.deepEqual(E[3].datos, Buffer.from(TEXTOS[1].texto, 'utf8'));
  assert.equal(b.length, fin + 1024); assert.ok(b.subarray(fin).every(v => v === 0)); assert.equal(b.length % 512, 0);
  assert.deepEqual(tar(TEXTOS, 'celda_ros'), b, 'determinista: la misma lista da los mismos bytes');
});

test('T2.6-C3: un fichero de longitud múltiplo de 512 (sin relleno) y otro de longitud 0 (sin bloques de datos), y el tar del sistema los extrae iguales', () => {
  const mil = 'abcdefgh'.repeat(128), b = tar([{ nombre: 'mil.txt', texto: mil }, { nombre: 'vacio.txt', texto: '' }, { nombre: 'uno.txt', texto: 'z' }], 'r');
  const { entradas: E } = entradas(b);
  assert.deepEqual(E.map(e => [e.name, e.off, parseInt(e.size, 8)]), [['r/', 0, 0], ['r/mil.txt', 512, 1024], ['r/vacio.txt', 512 + 512 + 1024, 0], ['r/uno.txt', 512 + 512 + 1024 + 512, 1]]);
  assert.equal(b.length, 512 * 4 + 1024 + 512 + 1024, 'cabeceras, 1024 de datos sin relleno, nada del vacío, un bloque del de 1 byte y los dos de ceros');
  const x = extraer(b);
  assert.deepEqual(x.nombres, ['r/', 'r/mil.txt', 'r/vacio.txt', 'r/uno.txt']);
  assert.deepEqual([...x.ficheros.keys()], ['r/mil.txt', 'r/uno.txt', 'r/vacio.txt']);
  assert.equal(x.ficheros.get('r/mil.txt').toString(), mil); assert.equal(x.ficheros.get('r/vacio.txt').length, 0); assert.equal(x.ficheros.get('r/uno.txt').toString(), 'z');
});

test('T2.6-C3: un nombre de 99 caracteres (y el límite de 100) entra; uno que no cabe en el campo name se rechaza con un error claro', () => {
  const n99 = `${'n'.repeat(99 - 'celda_ros/'.length - 5)}.yaml`, n100 = `${'m'.repeat(100 - 'celda_ros/'.length - 5)}.yaml`;
  assert.equal(`celda_ros/${n99}`.length, 99); assert.equal(`celda_ros/${n100}`.length, 100);
  const x = extraer(tar([{ nombre: n99, texto: '99' }, { nombre: n100, texto: '100' }], 'celda_ros'));
  assert.deepEqual(x.nombres, ['celda_ros/', `celda_ros/${n99}`, `celda_ros/${n100}`], 'el tar del sistema lee los nombres completos');
  assert.equal(x.ficheros.get(`celda_ros/${n99}`).toString(), '99'); assert.equal(x.ficheros.get(`celda_ros/${n100}`).toString(), '100');
  const n101 = `x${n100}`;
  assert.throws(() => EXPORTAR.tar([{ nombre: n101, texto: '' }], 'celda_ros'), e => e.message === `tar: la ruta «celda_ros/${n101}» ocupa 101 bytes y el campo name de ustar admite 100`);
  // con letras de dos bytes en UTF-8 cuenta el tamaño en bytes: 50 «ñ» son 100 bytes
  assert.throws(() => EXPORTAR.tar([{ nombre: 'ñ'.repeat(50), texto: '' }], 'r'), /ocupa 102 bytes y el campo name de ustar admite 100/);
});

test('T2.6-C3: rechaza rutas que no son relativas o se repiten y textos que no lo son', () => {
  const malo = (nombre, re, raiz = 'r', texto = '') => assert.throws(() => EXPORTAR.tar([{ nombre, texto }], raiz), re, JSON.stringify(nombre));
  for (const n of ['', '/abs.yaml', '../fuera.yaml', 'tf/../x', 'a//b', 'a/', './a', 'a\\b', 'a\nb']) malo(n, /no es una ruta relativa válida|vacío o que no es texto/);
  malo('a', /la carpeta raíz/, '../r'); malo('a', /no es texto/, 'r', 5);
  assert.throws(() => EXPORTAR.tar([{ nombre: 'a', texto: '' }, { nombre: 'a', texto: '' }], 'r'), /«a» está dos veces/);
  assert.throws(() => EXPORTAR.tar([{ nombre: 'tf', texto: '' }, { nombre: 'tf/a', texto: '' }], 'r'), /«r\/tf» es un fichero y una carpeta/);
});

test('T2.6-C3: UTF-8 sin TextEncoder: igual que Buffer (también con una letra de 4 bytes y una suplente suelta, que sale como U+FFFD)', () => {
  const t = 'a ñ → 𝄞 \ud800 fin', { entradas: E } = entradas(tar([{ nombre: 'u.txt', texto: t }], 'r'));
  assert.deepEqual(E[1].datos, Buffer.from(t, 'utf8'));
});

test('T2.6-C3: el tar del sistema lista 0644, 0755 en los .sh y en las carpetas, la fecha 1970-01-01 y extrae cada fichero byte a byte', () => {
  const x = extraer(tar(TEXTOS, 'celda_ros'));
  assert.deepEqual(x.lista.map(lineaTv).map(l => l && [l.permisos, l.fecha, l.nombre]), [
    ['drwxr-xr-x', '1970-01-01 00:00', 'celda_ros/'], ['-rw-r--r--', '1970-01-01 00:00', 'celda_ros/a.yaml'], ['drwxr-xr-x', '1970-01-01 00:00', 'celda_ros/tf/'],
    ['-rw-r--r--', '1970-01-01 00:00', 'celda_ros/tf/b.yaml'], ['-rwxr-xr-x', '1970-01-01 00:00', 'celda_ros/x.sh'],
  ], x.lista.join('\n'));
  for (const f of TEXTOS) assert.deepEqual(x.ficheros.get(`celda_ros/${f.nombre}`), Buffer.from(f.texto, 'utf8'), f.nombre);
  assert.deepEqual(x.carpetas, ['celda_ros/', 'celda_ros/tf/']);
});

test('T2.6-C3: falla cuando debe: el tar del sistema detecta una suma de control alterada (en la primera cabecera y en una del medio)', () => {
  const b = tar(TEXTOS, 'celda_ros'), { entradas: E } = entradas(b);
  conTar(b, (dir, f) => assert.equal(tarSistema(['-tf', f], dir).codigo, 0, 'sin alterar, tar lo acepta'));
  for (const e of [E[0], E[3]]) {
    const m = Buffer.from(b), i = e.off + 153; m[i] = m[i] === 0x30 ? 0x31 : 0x30; // la última cifra de chksum
    conTar(m, (dir, f) => {
      const r = tarSistema(['-tf', f], dir);
      assert.notEqual(r.codigo, 0, `${e.name}: con la suma de control alterada, tar debe fallar`);
      assert.ok(r.error.trim().length > 0, `${e.name}: tar avisa del error`);
    });
  }
});

test('T2.6-C3: con GNU tar, el .tar es byte a byte el que escribe GNU tar en ustar con mtime 0, dueño 0 y los mismos permisos', t => {
  if (!esGnu()) { t.skip('el tar del sistema no es GNU tar'); return; }
  const b = tar(TEXTOS, 'celda_ros');
  conTar(b, (dir, f) => {
    const x = path.join(dir, 'x'); fs.mkdirSync(x); assert.equal(tarSistema(['-xf', f, '-C', x], dir).codigo, 0);
    // los permisos de la referencia, puestos a mano en lo extraído (el umask del sistema no cuenta)
    for (const e of entradas(b).entradas) fs.chmodSync(path.join(x, e.name), parseInt(e.mode, 8));
    fs.writeFileSync(path.join(dir, 'lista'), tarSistema(['-tf', f], dir).salida);
    const g = tarSistema(['--format=ustar', '--owner=0', '--group=0', '--numeric-owner', '--mtime=@0', '--no-recursion', '-b', '1', '-cf', path.join(dir, 'gnu.tar'), '-C', x, '-T', path.join(dir, 'lista')], dir);
    assert.equal(g.codigo, 0, g.error);
    assert.deepEqual(fs.readFileSync(path.join(dir, 'gnu.tar')), b);
  });
});
