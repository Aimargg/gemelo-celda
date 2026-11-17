// El tar del sistema como referencia ajena al gemelo para el paquete .tar de la sección «Exportar a ROS» (T2.6): los tests
// no leen el .tar con un lector propio, lo listan y lo extraen con `tar` en una carpeta temporal que se borra al terminar.
// TZ=UTC y LC_ALL=C: la fecha de `tar -tvf` (mtime 0 → 1970-01-01 00:00) y los mensajes no dependen del equipo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENV = { ...process.env, TZ: 'UTC', LC_ALL: 'C' };
// tar con sus argumentos en una carpeta: { codigo, salida, error }. Sin tar en el sistema, el test falla con este mensaje.
// En Windows, GNU tar (el de Git Bash) toma «C:\…» como un host remoto («Cannot connect to C:»): --force-local le dice que el
// fichero es local. bsdtar no conoce esa opción y no la necesita.
let gnu = null;
const esGnuTar = () => gnu ??= /GNU tar/.test(spawnSync('tar', ['--version'], { encoding: 'utf8', env: ENV }).stdout || '');
export function tar(args, cwd) {
  const extra = process.platform === 'win32' && args[0] !== '--version' && esGnuTar() ? ['--force-local'] : [];
  const r = spawnSync('tar', [...extra, ...args], { cwd, encoding: 'utf8', env: ENV });
  if (r.error) throw new Error(`No se puede ejecutar el tar del sistema (la referencia de T2.6): ${r.error.message}`);
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}
// ¿Es GNU tar? (la comparación byte a byte con lo que escribe GNU tar solo se hace con él)
export const esGnu = () => /GNU tar/.test(tar(['--version']).salida);
// Ejecuta fn(dir, fichero) con los bytes escritos en <dir temporal>/paquete.tar y borra la carpeta al terminar
export function conTar(bytes, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemelo-tar-'));
  try { const f = path.join(dir, 'paquete.tar'); fs.writeFileSync(f, bytes); return fn(dir, f); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// Lista (tar -tvf) y extrae (tar -xf) un .tar: { lista: líneas de -tvf, nombres: líneas de -tf, ficheros: Map(ruta → Buffer),
// carpetas: rutas de las carpetas extraídas (con / al final) }. Falla si tar no lo acepta.
export function extraer(bytes) {
  return conTar(bytes, (dir, f) => {
    const v = tar(['-tvf', f], dir); if (v.codigo !== 0) throw new Error(`tar -tvf falla (${v.codigo}): ${v.error}`);
    const t = tar(['-tf', f], dir); if (t.codigo !== 0) throw new Error(`tar -tf falla (${t.codigo}): ${t.error}`);
    const out = path.join(dir, 'x'); fs.mkdirSync(out);
    const x = tar(['-xf', f, '-C', out], dir); if (x.codigo !== 0) throw new Error(`tar -xf falla (${x.codigo}): ${x.error}`);
    const ficheros = new Map(), carpetas = [];
    const recorrer = rel => { for (const e of fs.readdirSync(path.join(out, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const r = `${rel}${e.name}`; if (e.isDirectory()) { carpetas.push(`${r}/`); recorrer(`${r}/`); } else ficheros.set(r, fs.readFileSync(path.join(out, r))); } };
    recorrer('');
    return { lista: v.salida.trim().split('\n'), nombres: t.salida.trim().split('\n'), ficheros, carpetas };
  });
}
// Una línea de `tar -tvf` (GNU o bsdtar): permisos, tamaño, fecha y nombre
export function lineaTv(l) {
  const m = /^([dl-][rwxsStT-]{9})\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|\w{3}\s+\d+\s+\d{4})\s+(.+)$/.exec(l);
  return m ? { permisos: m[1], tam: +m[2], fecha: m[3], nombre: m[4] } : null;
}
